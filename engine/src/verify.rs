use crate::{
    adapter_process::{self, Limits as AdapterLimits},
    model::{Capture, Contract, Kind, Observation, Scenario, Status},
    project::{Project, Snapshot, file_digest},
    route,
};
use anyhow::{Context, Result, ensure};
use image::{ImageReader, Limits, RgbaImage};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::Command,
    time::{Duration, Instant},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    version: u32,
    engine: String,
    surface: String,
    fingerprint: String,
    base_url: Option<String>,
    freshness_scope: String,
    findings: Vec<Finding>,
    scenarios: Vec<Observation>,
    artifacts: BTreeMap<String, String>,
    pub status: Status,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Finding {
    id: &'static str,
    status: Status,
    blocking: bool,
    evidence: String,
    mean_delta: Option<f64>,
}

impl Report {
    fn finding(
        &mut self,
        id: &'static str,
        status: Status,
        blocking: bool,
        evidence: impl Into<String>,
    ) {
        self.findings.push(Finding {
            id,
            status,
            blocking,
            evidence: evidence.into(),
            mean_delta: None,
        });
    }

    fn summarize(&mut self) {
        self.status = if self
            .findings
            .iter()
            .any(|f| f.blocking && f.status == Status::Fail)
        {
            Status::Fail
        } else if self
            .findings
            .iter()
            .any(|f| f.blocking && f.status == Status::Unavailable)
        {
            Status::Unavailable
        } else {
            Status::Pass
        };
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct BrowserResponse {
    scenarios: Vec<Observation>,
}

fn capture(
    project: &Project,
    output: &Path,
    spec: &Scenario,
    url: &str,
    timeout: Duration,
    stdout_left: &mut usize,
) -> Result<Observation> {
    let adapter = std::env::var_os("UF_BROWSER_ADAPTER")
        .map(PathBuf::from)
        .unwrap_or(std::env::current_exe()?.with_file_name("capture.cjs"));
    let adapter = adapter
        .canonicalize()
        .context("Browser adapter not found; set UF_BROWSER_ADAPTER")?;
    let message =
        serde_json::to_vec(&json!({"baseUrl":url,"outputDir":output,"scenarios":[spec]}))?;
    let result = adapter_process::invoke(
        Command::new("node").arg(adapter).current_dir(&project.root),
        message,
        AdapterLimits {
            timeout,
            stdout: *stdout_left,
            stderr: 64 * 1024,
        },
    )?;
    ensure!(
        result.status.success(),
        "Browser adapter: {}",
        String::from_utf8_lossy(&result.stderr)
            .chars()
            .take(900)
            .collect::<String>()
    );
    *stdout_left -= result.stdout.len();
    result.stdin.context("Write browser adapter input")?;
    let response: BrowserResponse =
        serde_json::from_slice(&result.stdout).context("Read browser observations")?;
    let [obs]: [Observation; 1] = response
        .scenarios
        .try_into()
        .ok()
        .context("Expected one browser scenario")?;
    {
        let expected = spec.capture_ids();
        let actual: BTreeSet<_> = obs.captures.iter().map(|c| c.id.as_str()).collect();
        ensure!(
            obs.id == spec.id
                && actual.len() == obs.captures.len()
                && actual.is_subset(&expected)
                && obs.steps_completed <= spec.steps.len()
                && (obs.status != Status::Pass
                    || (actual == expected && obs.steps_completed == spec.steps.len())),
            "Invalid browser observations for {}",
            spec.id
        );
        ensure!(
            obs.captures
                .iter()
                .all(|c| c.width == spec.width && c.height == spec.height),
            "Unexpected captured size for {}",
            spec.id
        );
    }
    Ok(obs)
}

fn image(path: &Path) -> Result<RgbaImage> {
    let mut limits = Limits::default();
    limits.max_image_width = Some(3840);
    limits.max_image_height = Some(2400);
    limits.max_alloc = Some(96 * 1024 * 1024);
    let mut reader = ImageReader::with_format(
        std::io::BufReader::new(fs::File::open(path)?),
        image::ImageFormat::Png,
    );
    reader.limits(limits);
    Ok(reader.decode()?.into_rgba8())
}

fn artifact_key(scenario: &str, capture: &str) -> String {
    format!("{scenario}-{capture}.png")
}

fn capture_checks(
    report: &mut Report,
    c: &Contract,
    output: &Path,
    spec: &Scenario,
    frame: &Capture,
) -> Result<()> {
    let label = format!(
        "{}/{} ({}×{})",
        spec.id, frame.id, frame.width, frame.height
    );
    let file = output.join(artifact_key(&spec.id, &frame.id));
    let info = fs::symlink_metadata(&file)?;
    ensure!(info.is_file(), "Missing regular capture: {label}");
    let png = image(&file)?;
    ensure!(
        png.dimensions() == (frame.width, frame.height),
        "Wrong PNG dimensions: {label}"
    );
    report
        .artifacts
        .insert(file.to_string_lossy().into_owned(), file_digest(&file)?);
    report.finding(
        "render.horizontal-overflow",
        if frame.horizontal_overflow {
            Status::Fail
        } else {
            Status::Pass
        },
        true,
        &label,
    );
    let mut seen = BTreeSet::new();
    let duplicates: BTreeSet<_> = frame
        .lines
        .iter()
        .map(|line| line.split_whitespace().collect::<Vec<_>>().join(" "))
        .filter(|line| line.split_whitespace().count() >= 3 && line.len() >= 12)
        .filter(|line| !seen.insert(line.to_lowercase()))
        .collect();
    for duplicate in duplicates {
        report.finding(
            "unslop.repeated-line",
            Status::Fail,
            false,
            format!("{label}: {duplicate}"),
        );
    }
    if route::plan(c).peer_layout_review {
        for group in &frame.peer_groups {
            report.finding(
                "unslop.creative-peer-layout",
                Status::Fail,
                false,
                format!("{label}: {}", group.join(" | ")),
            );
        }
    }
    Ok(())
}

fn compare(report: &mut Report, project: &Project, c: &Contract, output: &Path) {
    let Some(approved) = &c.approved else {
        return;
    };
    for frame in &approved.frames {
        let name = format!("{}/{}", frame.scenario, frame.capture);
        let compare = || -> Result<_> {
            let capture = output.join(artifact_key(&frame.scenario, &frame.capture));
            ensure!(
                report
                    .artifacts
                    .contains_key(capture.to_string_lossy().as_ref()),
                "No verified capture for this frame"
            );
            let expected = image(&project.reference(&frame.reference)?)?;
            let actual = image(&capture)?;
            ensure!(
                expected.dimensions() == actual.dimensions(),
                "Reference and capture dimensions differ"
            );
            Ok((expected, actual))
        };
        let (expected, actual) = match compare() {
            Ok(pair) => pair,
            Err(e) => {
                report.finding(
                    "impeccable.approved-frame",
                    Status::Unavailable,
                    true,
                    format!("{name}: {e}"),
                );
                continue;
            }
        };
        for r in &frame.regions {
            let label = format!("{name}/{}", r.id);
            let right = r.x.checked_add(r.width);
            let bottom = r.y.checked_add(r.height);
            if right.is_none_or(|x| x > actual.width())
                || bottom.is_none_or(|y| y > actual.height())
            {
                report.finding(
                    "impeccable.approved-region",
                    Status::Fail,
                    true,
                    format!("{label}: region outside frame"),
                );
                continue;
            }
            let mut sum = 0u64;
            for y in r.y..r.y + r.height {
                for x in r.x..r.x + r.width {
                    for (a, b) in expected
                        .get_pixel(x, y)
                        .0
                        .iter()
                        .zip(actual.get_pixel(x, y).0)
                    {
                        sum += u64::from(a.abs_diff(b));
                    }
                }
            }
            let delta = sum as f64 / (f64::from(r.width) * f64::from(r.height) * 4.0 * 255.0);
            report.findings.push(Finding {
                id: "impeccable.approved-region",
                status: if delta <= r.max_mean_delta {
                    Status::Pass
                } else {
                    Status::Fail
                },
                blocking: true,
                evidence: format!("{label}: limit {}", r.max_mean_delta),
                mean_delta: Some(delta),
            });
        }
    }
}

fn scenes(report: &mut Report, c: &Contract, observations: &[Observation], output: &Path) {
    let Some(d) = &c.direction else {
        return;
    };
    let mut leads = BTreeMap::<(u32, u32), Vec<(&Capture, &str)>>::new();
    for scene in &d.scenes {
        if let Some(frame) = observations
            .iter()
            .find(|o| o.id == scene.scenario)
            .and_then(|o| o.captures.iter().find(|f| f.id == scene.capture))
        {
            let file = output.join(artifact_key(&scene.scenario, &scene.capture));
            if route::scene_width(frame.width).is_some()
                && let Some(digest) = report.artifacts.get(file.to_string_lossy().as_ref())
            {
                leads
                    .entry((frame.width, frame.height))
                    .or_default()
                    .push((frame, digest));
            }
        }
    }
    let mut findings = Vec::new();
    for ((w, h), frames) in leads {
        let width = format!("{w}×{h}");
        if let [(_, opening), (_, next), ..] = frames.as_slice()
            && opening == next
        {
            findings.push((
                "awwwards.distinct-scenes",
                Status::Fail,
                true,
                format!("{width}: opening and next scene share one PNG"),
            ));
        }
        if frames.iter().any(|(f, _)| f.scroll_range >= f.height)
            && !frames.iter().any(|(f, _)| {
                f.scroll_range > 0
                    && (0.25..=0.75).contains(&(f64::from(f.scroll_y) / f64::from(f.scroll_range)))
            })
        {
            findings.push((
                "awwwards.middle-frame",
                Status::Unavailable,
                true,
                format!("{width}: capture a middle scroll state"),
            ));
        }
    }
    for (id, status, blocking, evidence) in findings {
        report.finding(id, status, blocking, evidence);
    }
}

fn source_checks(report: &mut Report, project: &Project, snapshot: &Snapshot) -> Result<()> {
    for file in &snapshot.files {
        if !file.extension().is_some_and(|x| x == "css") || fs::metadata(file)?.len() > 256 * 1024 {
            continue;
        }
        let contents = fs::read_to_string(file)?;
        for (i, line) in contents.lines().enumerate() {
            let line = line
                .split_whitespace()
                .collect::<String>()
                .to_ascii_lowercase();
            if line.contains("outline:none") || line.contains("outline:0;") {
                let name = file.strip_prefix(&project.root)?;
                report.finding(
                    "impeccable.source-outline-removal",
                    Status::Fail,
                    false,
                    format!(
                        "{}:{}: check for a visible replacement focus indicator",
                        name.display(),
                        i + 1
                    ),
                );
            }
        }
    }
    Ok(())
}

pub fn verify(
    project: &Project,
    contract_argument: &str,
    contract_path: &Path,
    bytes: &[u8],
    c: &Contract,
    url: Option<&str>,
) -> Result<Option<Report>> {
    let snapshot = project.snapshot(bytes, c)?;
    let mut report = Report { version: 1, engine: env!("CARGO_PKG_VERSION").into(), surface: c.surface.clone(), fingerprint: snapshot.fingerprint.clone(),
        base_url: url.map(str::to_owned), freshness_scope: "Declared local files and capture bytes; server-to-source correspondence is not attested".into(),
        findings: vec![], scenarios: vec![], artifacts: BTreeMap::new(), status: Status::Unavailable };
    for message in route::plan(c).missing {
        report.finding("contract.requirement", Status::Unavailable, true, message);
    }
    source_checks(&mut report, project, &snapshot)?;
    let mut evidence = None;
    if let Some(url) = url.filter(|_| !c.scenarios.is_empty()) {
        let output = tempfile::Builder::new()
            .prefix(&format!("{}-", c.surface))
            .tempdir_in(project.evidence_dir()?)?;
        let deadline = Instant::now() + Duration::from_secs(120);
        let mut stdout_left = 8 * 1024 * 1024;
        let mut observations = Vec::new();
        for spec in &c.scenarios {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let result = if remaining.is_zero() || stdout_left == 0 {
                Err(anyhow::anyhow!("Browser verification budget exhausted"))
            } else {
                capture(
                    project,
                    output.path(),
                    spec,
                    url,
                    remaining,
                    &mut stdout_left,
                )
            };
            let obs = result.unwrap_or_else(|error| Observation {
                id: spec.id.clone(),
                status: Status::Unavailable,
                steps_completed: 0,
                error: Some(format!("{error:#}")),
                captures: Vec::new(),
            });
            report.finding(
                "browser.scenario",
                obs.status,
                true,
                format!(
                    "{}: {}",
                    spec.id,
                    obs.error.as_deref().unwrap_or(&spec.state)
                ),
            );
            for frame in &obs.captures {
                if let Err(e) = capture_checks(&mut report, c, output.path(), spec, frame) {
                    report.finding(
                        "browser.capture",
                        Status::Unavailable,
                        true,
                        format!("{}/{}: {e}", spec.id, frame.id),
                    );
                }
            }
            observations.push(obs);
        }
        compare(&mut report, project, c, output.path());
        if c.kind == Kind::Creative && route::plan(c).peer_layout_review {
            scenes(&mut report, c, &observations, output.path());
        }
        report.scenarios = observations;
        if !report.artifacts.is_empty() {
            evidence = Some(output);
        }
    } else {
        report.finding(
            "browser.unavailable",
            Status::Unavailable,
            true,
            "Supply --url for a running isolated project preview",
        );
    }
    if !project
        .snapshot(bytes, c)
        .is_ok_and(|s| s.fingerprint == report.fingerprint)
        || !project
            .read_contract(contract_argument)
            .is_ok_and(|(p, b)| p == contract_path && b == bytes)
    {
        return Ok(None);
    }
    report.summarize();
    // A concurrent reader may have opened the previous receipt and not yet read its PNGs.
    // Retention needs a separate reader/writer protocol; do not prune superseded evidence here.
    project.save_report(&c.surface, &report)?;
    if let Some(dir) = evidence {
        let _ = dir.keep();
    }
    Ok(Some(report))
}

pub fn current_report(
    project: &Project,
    bytes: &[u8],
    c: &Contract,
) -> Result<Option<serde_json::Value>> {
    let file = project.receipt(&c.surface)?;
    let input = match fs::symlink_metadata(&file) {
        Ok(info) if info.is_file() => fs::read(file)?,
        Ok(_) => return Ok(None),
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(e.into()),
    };
    let value: serde_json::Value = serde_json::from_slice(&input)?;
    let snapshot = match project.snapshot(bytes, c) {
        Ok(s) => s,
        Err(_) => return Ok(None),
    };
    if value.get("version").and_then(|v| v.as_u64()) != Some(1)
        || value.get("engine").and_then(|v| v.as_str()) != Some(env!("CARGO_PKG_VERSION"))
        || value.get("fingerprint").and_then(|v| v.as_str()) != Some(&snapshot.fingerprint)
    {
        return Ok(None);
    }
    let artifacts = value
        .get("artifacts")
        .and_then(|v| v.as_object())
        .context("Invalid report artifact map")?;
    for (path, digest) in artifacts {
        let path = Path::new(path);
        let store = project.root.join(".ultimate-frontend/evidence");
        if !path
            .canonicalize()
            .is_ok_and(|real| real == path && real.starts_with(store))
            || file_digest(path).ok().as_deref() != digest.as_str()
        {
            return Ok(None);
        }
    }
    Ok(Some(value))
}
