mod adapter_process;
mod model;
mod project;
mod route;
mod verify;

use anyhow::{Context, Result, bail, ensure};
use model::{Contract, Intent, Status};
use project::Project;
use serde_json::{Value, json};
use std::{env, path::PathBuf, process::ExitCode};

const USAGE: &str = "Usage: uf [--root WORKSPACE] inspect\n       uf [--root WORKSPACE] plan|record|report CONTRACT.json\n       uf [--root WORKSPACE] verify CONTRACT.json [--url LOOPBACK_URL]";

fn status(value: Status) -> u8 {
    match value {
        Status::Pass => 0,
        Status::Fail => 2,
        Status::Unavailable => 3,
    }
}

fn run(mut args: Vec<String>) -> Result<(Value, u8)> {
    let root = if args.first().is_some_and(|x| x == "--root") {
        ensure!(args.len() >= 3, "{USAGE}");
        PathBuf::from(args.drain(..2).nth(1).context("Missing workspace")?)
    } else {
        env::current_dir()?
    };
    let project = Project::open(&root)?;
    match args.as_slice() {
        [cmd] if cmd == "inspect" => return Ok((project.inspect()?, 0)),
        [cmd, _] if matches!(cmd.as_str(), "plan" | "record" | "report" | "verify") => (),
        [cmd, _, flag, _] if cmd == "verify" && flag == "--url" => (),
        _ => bail!("{USAGE}"),
    }
    let (path, bytes) = project.read_contract(&args[1])?;
    let contract: Contract = serde_json::from_slice(&bytes).context("Parse contract JSON")?;
    contract.validate()?;
    match args[0].as_str() {
        "plan" => Ok((serde_json::to_value(route::plan(&contract))?, 0)),
        "record" => {
            ensure!(
                contract.intent != Intent::Critique,
                "Critique cannot write a project decision"
            );
            let path = project.record(&contract)?;
            Ok((json!({"decision":path.strip_prefix(&project.root)?}), 0))
        }
        "verify" => {
            let Some(report) = verify::verify(
                &project,
                &args[1],
                &path,
                &bytes,
                &contract,
                args.get(3).map(String::as_str),
            )?
            else {
                return Ok((
                    json!({"status":"unavailable", "reason":"Inputs changed during verification; run again"}),
                    3,
                ));
            };
            let code = status(report.status);
            Ok((serde_json::to_value(report)?, code))
        }
        "report" => match verify::current_report(&project, &bytes, &contract)? {
            Some(value) => {
                let result = serde_json::from_value::<Status>(
                    value
                        .get("status")
                        .context("Missing report status")?
                        .clone(),
                )?;
                Ok((value, status(result)))
            }
            None => Ok((
                json!({"status":"unavailable", "reason":"No current report for these inputs; run verify"}),
                3,
            )),
        },
        _ => unreachable!("Already validated command"),
    }
}

fn main() -> ExitCode {
    let args = env::args().skip(1).collect::<Vec<_>>();
    if matches!(args.as_slice(), [] | [_]) {
        match args.first().map(String::as_str) {
            None | Some("-h" | "--help") => {
                println!("{USAGE}");
                return ExitCode::SUCCESS;
            }
            Some("-V" | "--version") => {
                println!("uf {}", env!("CARGO_PKG_VERSION"));
                return ExitCode::SUCCESS;
            }
            _ => (),
        }
    }
    match run(args).and_then(|(out, code)| {
        println!("{}", serde_json::to_string_pretty(&out)?);
        Ok(code)
    }) {
        Ok(code) => ExitCode::from(code),
        Err(e) => {
            eprintln!("uf: {e:#}");
            ExitCode::FAILURE
        }
    }
}
