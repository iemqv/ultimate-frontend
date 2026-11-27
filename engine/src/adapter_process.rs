#[cfg(test)]
mod tests;

use anyhow::{Context, Result, bail, ensure};
use std::{
    io::{self, Read, Write},
    process::{Child, Command, ExitStatus, Stdio},
    sync::mpsc::{self, RecvTimeoutError},
    thread,
    time::{Duration, Instant},
};

pub struct Limits {
    pub timeout: Duration,
    pub stdout: usize,
    pub stderr: usize,
}

pub struct Output {
    pub status: ExitStatus,
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub stdin: io::Result<()>,
}

const POLL: Duration = Duration::from_millis(10);

pub fn invoke(command: &mut Command, input: Vec<u8>, limits: Limits) -> Result<Output> {
    let deadline = Instant::now() + limits.timeout;
    let mut group = platform::ProcessGroup::new(command)?;
    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .context("Start Node browser adapter")?;
    if let Err(error) = group.attach(&child) {
        child.kill().context("Stop uncontained browser adapter")?;
        reap(&mut child)?;
        return Err(error).context("Contain browser adapter process");
    }
    let result = collect(&mut child, input, limits, deadline);
    if result.is_err()
        && let Err(cleanup) = group.terminate(&mut child)
    {
        return result.context(format!("Browser adapter cleanup failed: {cleanup:#}"));
    }
    result
}

fn collect(child: &mut Child, input: Vec<u8>, limits: Limits, deadline: Instant) -> Result<Output> {
    enum Event {
        Stdin(io::Result<()>),
        Stdout(Result<Vec<u8>>),
        Stderr(Result<Vec<u8>>),
    }
    let (tx, rx) = mpsc::channel();
    let mut stdin = child.stdin.take().context("Missing adapter stdin")?;
    let send = tx.clone();
    thread::Builder::new().spawn(move || {
        let result = stdin.write_all(&input);
        drop(stdin);
        let _ = send.send(Event::Stdin(result));
    })?;
    let stdout = child.stdout.take().context("Missing adapter stdout")?;
    let send = tx.clone();
    thread::Builder::new().spawn(move || {
        let _ = send.send(Event::Stdout(read_output(stdout, "stdout", limits.stdout)));
    })?;
    let stderr = child.stderr.take().context("Missing adapter stderr")?;
    thread::Builder::new().spawn(move || {
        let _ = tx.send(Event::Stderr(read_output(stderr, "stderr", limits.stderr)));
    })?;

    let mut input_result = None;
    let mut stdout = None;
    let mut stderr = None;
    for _ in 0..3 {
        let remaining = deadline.saturating_duration_since(Instant::now());
        ensure!(!remaining.is_zero(), "Browser adapter timed out");
        let event = match rx.recv_timeout(remaining) {
            Ok(event) => event,
            Err(RecvTimeoutError::Timeout) => bail!("Browser adapter timed out"),
            Err(RecvTimeoutError::Disconnected) => bail!("Browser adapter I/O worker stopped"),
        };
        match event {
            Event::Stdin(value) => input_result = Some(value),
            Event::Stdout(value) => stdout = Some(value?),
            Event::Stderr(value) => stderr = Some(value?),
        }
    }
    let status = platform::wait_status(child, deadline)?.context("Browser adapter timed out")?;
    Ok(Output {
        status,
        stdin: input_result.context("Missing adapter stdin result")?,
        stdout: stdout.context("Missing adapter stdout result")?,
        stderr: stderr.context("Missing adapter stderr result")?,
    })
}

fn read_output(pipe: impl Read, stream: &str, limit: usize) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    pipe.take(limit as u64 + 1)
        .read_to_end(&mut bytes)
        .with_context(|| format!("Read browser adapter {stream}"))?;
    ensure!(
        bytes.len() <= limit,
        "Browser adapter {stream} exceeded {limit} bytes"
    );
    Ok(bytes)
}

fn wait_until(child: &mut Child, deadline: Instant) -> io::Result<Option<ExitStatus>> {
    loop {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            return Ok(None);
        }
        if let Some(status) = child.try_wait()? {
            return Ok(Some(status));
        }
        thread::sleep(remaining.min(POLL));
    }
}

fn reap(child: &mut Child) -> Result<()> {
    wait_until(child, Instant::now() + Duration::from_secs(1))?
        .context("Could not reap browser adapter after termination")?;
    Ok(())
}

#[cfg(unix)]
mod platform {
    use super::*;
    use std::os::unix::process::CommandExt;

    pub struct ProcessGroup;

    fn signal_group(child: &Child, signal: libc::c_int) -> io::Result<bool> {
        // SAFETY: the unreaped child is the leader of the group we created.
        if unsafe { libc::kill(-(child.id() as libc::pid_t), signal) } == 0 {
            return Ok(true);
        }
        let error = io::Error::last_os_error();
        if error.raw_os_error() == Some(libc::ESRCH) {
            return Ok(false);
        }
        Err(error)
    }

    pub fn wait_status(child: &mut Child, deadline: Instant) -> io::Result<Option<ExitStatus>> {
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            if remaining.is_zero() {
                return Ok(None);
            }
            // Keep the child's PID reserved until we've signalled any remaining group members.
            // SAFETY: waitid writes valid siginfo on success; a zero si_pid means no exit yet.
            let mut info = unsafe { std::mem::zeroed::<libc::siginfo_t>() };
            let result = unsafe {
                libc::waitid(
                    libc::P_PID,
                    child.id(),
                    &mut info,
                    libc::WEXITED | libc::WNOHANG | libc::WNOWAIT,
                )
            };
            if result == -1 {
                let error = io::Error::last_os_error();
                if error.kind() == io::ErrorKind::Interrupted {
                    continue;
                }
                return Err(error);
            }
            if unsafe { info.si_pid() } != 0 {
                signal_group(child, libc::SIGKILL)?;
                return child.wait().map(Some);
            }
            thread::sleep(remaining.min(POLL));
        }
    }

    impl ProcessGroup {
        pub fn new(command: &mut Command) -> Result<Self> {
            command.process_group(0);
            Ok(Self)
        }

        pub fn attach(&mut self, _: &Child) -> io::Result<()> {
            Ok(())
        }

        pub fn terminate(&mut self, child: &mut Child) -> Result<()> {
            // Playwright launches Chromium in its own group. Its first SIGINT tries to close
            // Chromium gracefully, and its second SIGINT force-kills that group if still live.
            // If Node cannot handle signals, SIGKILL covers only the adapter's own group.
            for signal in [libc::SIGINT, libc::SIGINT, libc::SIGKILL] {
                match signal_group(child, signal) {
                    Ok(false) => break,
                    Ok(true) => (),
                    Err(err) => {
                        child.kill()?;
                        reap(child)?;
                        return Err(err.into());
                    }
                }
                if signal != libc::SIGKILL {
                    thread::sleep(Duration::from_millis(250));
                }
            }
            reap(child)
        }
    }
}

#[cfg(windows)]
mod platform {
    use super::*;
    use std::{
        os::windows::io::{AsRawHandle, FromRawHandle, OwnedHandle},
        ptr::null,
    };
    use windows_sys::Win32::System::JobObjects::{
        AssignProcessToJobObject, CreateJobObjectW, JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE,
        JOBOBJECT_EXTENDED_LIMIT_INFORMATION, JobObjectExtendedLimitInformation,
        SetInformationJobObject,
    };

    pub struct ProcessGroup(Option<OwnedHandle>);

    pub fn wait_status(child: &mut Child, deadline: Instant) -> io::Result<Option<ExitStatus>> {
        wait_until(child, deadline)
    }

    impl ProcessGroup {
        pub fn new(_: &mut Command) -> Result<Self> {
            // SAFETY: null attributes and name create an unnamed, non-inheritable job.
            let handle = unsafe { CreateJobObjectW(null(), null()) };
            if handle.is_null() {
                return Err(io::Error::last_os_error()).context("Create browser adapter job");
            }
            // SAFETY: creation returned a valid handle owned only by this caller.
            let job = unsafe { OwnedHandle::from_raw_handle(handle) };
            let mut info = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            // SAFETY: the supplied type and size correspond to the information class.
            let configured = unsafe {
                SetInformationJobObject(
                    job.as_raw_handle(),
                    JobObjectExtendedLimitInformation,
                    (&raw const info).cast(),
                    size_of::<JOBOBJECT_EXTENDED_LIMIT_INFORMATION>() as u32,
                )
            };
            if configured == 0 {
                return Err(io::Error::last_os_error()).context("Configure browser adapter job");
            }
            Ok(Self(Some(job)))
        }

        pub fn attach(&mut self, child: &Child) -> io::Result<()> {
            let job = self.0.as_ref().expect("Job is still open");
            // The bundled adapter waits for stdin before starting Chromium; attach it first.
            // SAFETY: both handles are live for the duration of the call.
            if unsafe { AssignProcessToJobObject(job.as_raw_handle(), child.as_raw_handle()) } == 0
            {
                return Err(io::Error::last_os_error());
            }
            Ok(())
        }

        pub fn terminate(&mut self, child: &mut Child) -> Result<()> {
            drop(self.0.take());
            reap(child)
        }
    }
}
