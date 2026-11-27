use super::*;
use std::{env, fs};

fn command(mode: &str) -> Command {
    let mut command = Command::new(env::current_exe().unwrap());
    command
        .args([
            "--ignored",
            "--exact",
            "adapter_process::tests::fixture",
            "--nocapture",
        ])
        .env("UF_TEST_ADAPTER_MODE", mode);
    command
}

fn limits(timeout_ms: u64) -> Limits {
    Limits {
        timeout: Duration::from_millis(timeout_ms),
        stdout: 4096,
        stderr: 4096,
    }
}

#[test]
#[ignore = "subprocess fixture"]
fn fixture() {
    match env::var("UF_TEST_ADAPTER_MODE").unwrap().as_str() {
        "duplex" => {
            io::stdout().write_all(&vec![b'x'; 128 * 1024]).unwrap();
            let mut message = Vec::new();
            io::stdin().read_to_end(&mut message).unwrap();
            assert_eq!(message, vec![b'm'; 256 * 1024]);
            io::stderr().write_all(b"done").unwrap();
        }
        "stdout" => io::stdout().write_all(&[b'x'; 8192]).unwrap(),
        "stderr" => io::stderr().write_all(&[b'x'; 8192]).unwrap(),
        "hang" => thread::sleep(Duration::from_secs(10)),
        "spawn" | "spawn-and-hang" => {
            io::copy(&mut io::stdin().lock(), &mut io::sink()).unwrap();
            let marker = env::var("UF_TEST_ADAPTER_MARKER").unwrap();
            let mut child = command("delayed-marker")
                .env("UF_TEST_ADAPTER_MARKER", marker)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .unwrap();
            assert!(child.try_wait().unwrap().is_none());
            if env::var("UF_TEST_ADAPTER_MODE").unwrap() == "spawn-and-hang" {
                thread::sleep(Duration::from_secs(10));
            }
            // Otherwise return without waiting, with no pipes held open by the descendant.
        }
        "delayed-marker" => {
            thread::sleep(Duration::from_secs(1));
            fs::write(env::var("UF_TEST_ADAPTER_MARKER").unwrap(), "survived").unwrap();
        }
        _ => panic!("Unexpected fixture mode"),
    }
}

#[test]
fn invoke_drains_output_while_sending_stdin() {
    let output = invoke(
        &mut command("duplex"),
        vec![b'm'; 256 * 1024],
        Limits {
            stdout: 256 * 1024,
            ..limits(4000)
        },
    )
    .unwrap();
    assert!(output.status.success());
    output.stdin.unwrap();
    let payload = vec![b'x'; 128 * 1024];
    assert!(
        output
            .stdout
            .windows(payload.len())
            .any(|part| part == payload)
    );
    assert_eq!(output.stderr, b"done");
}

#[test]
fn invoke_rejects_stdout_and_stderr_over_their_limits() {
    for stream in ["stdout", "stderr"] {
        let failure = invoke(&mut command(stream), vec![], limits(4000))
            .err()
            .unwrap();
        assert!(
            failure
                .to_string()
                .contains(&format!("{stream} exceeded 4096 bytes")),
            "{failure:#}"
        );
    }
}

#[test]
fn invoke_times_out_when_adapter_never_reads_stdin() {
    let started = Instant::now();
    let failure = invoke(&mut command("hang"), vec![b'm'; 256 * 1024], limits(300))
        .err()
        .unwrap();
    assert!(
        failure.to_string().contains("Browser adapter timed out"),
        "{failure:#}"
    );
    assert!(started.elapsed() < Duration::from_secs(3));
}

#[test]
fn invoke_cleans_up_descendants_on_exit_and_timeout() {
    let workspace = tempfile::tempdir().unwrap();
    let exit_marker = workspace.path().join("survived-exit");
    let timeout_marker = workspace.path().join("survived-timeout");
    let output = invoke(
        command("spawn").env("UF_TEST_ADAPTER_MARKER", &exit_marker),
        vec![],
        limits(4000),
    )
    .unwrap();
    assert!(output.status.success());
    let error = invoke(
        command("spawn-and-hang").env("UF_TEST_ADAPTER_MARKER", &timeout_marker),
        vec![],
        limits(500),
    )
    .err()
    .unwrap();
    assert!(
        error.to_string().contains("Browser adapter timed out"),
        "{error:#}"
    );
    thread::sleep(Duration::from_millis(1250));
    assert!(
        !exit_marker.exists(),
        "Adapter descendant was left alive after exit"
    );
    assert!(
        !timeout_marker.exists(),
        "Adapter descendant was left alive after timeout"
    );
}
