#![cfg(unix)]

use serde_json::{Value, json};
use std::{
    fs,
    os::unix::fs::{PermissionsExt, symlink},
    process::Command,
};

#[test]
fn report_binds_declared_path_to_target_and_rejects_implicit_links() {
    let workspace = tempfile::tempdir().unwrap();
    let root = workspace.path();
    let run = |cmd: &str| {
        Command::new(env!("CARGO_BIN_EXE_uf"))
            .arg("--root")
            .arg(root)
            .args([cmd, "contract.json"])
            .output()
            .unwrap()
    };
    let link = |name: &str, target: &str| symlink(target, root.join(name)).unwrap();
    fs::write(root.join("a.css"), "body {color:red}").unwrap();
    fs::write(root.join("b.css"), "body {color:blue}").unwrap();
    link("first.css", "a.css");
    link("second.css", "b.css");
    let mut contract = json!({"version":1,"surface":"links","kind":"reading","intent":"refine",
        "visitor":"Reader","outcome":"Read an entry","inputs":["first.css","second.css"]});
    let save = |c: &Value| fs::write(root.join("contract.json"), c.to_string()).unwrap();
    save(&contract);
    assert_eq!(run("verify").status.code(), Some(3));
    let report = |cmd| serde_json::from_slice::<Value>(&run(cmd).stdout).unwrap();
    assert!(report("report")["fingerprint"].is_string());
    fs::remove_file(root.join("first.css")).unwrap();
    fs::remove_file(root.join("second.css")).unwrap();
    link("first.css", "b.css");
    link("second.css", "a.css");
    assert!(report("report")["reason"].is_string());

    fs::create_dir(root.join("src")).unwrap();
    link("src/theme.css", "../a.css");
    contract["inputs"] = json!(["src"]);
    save(&contract);
    let invalid = run("verify");
    assert_eq!(invalid.status.code(), Some(1));
    assert!(String::from_utf8_lossy(&invalid.stderr).contains("Linked input in directory scope"));
}

#[test]
fn verify_rejects_contract_link_retargeted_during_capture() {
    let workspace = tempfile::tempdir().unwrap();
    let root = workspace.path();
    let contract = json!({"version":1,"surface":"links","kind":"reading","intent":"refine",
        "visitor":"Reader","outcome":"Read an entry",
        "scenarios":[{"id":"phone","path":"/","width":375,"height":720,"state":"Resting",
            "steps":[{"op":"capture","id":"opening"}]}]});
    // The new target has identical bytes; checking only the original target or bytes misses this.
    for file in ["original.json", "replacement.json"] {
        fs::write(root.join(file), contract.to_string()).unwrap();
    }
    symlink("original.json", root.join("contract.json")).unwrap();
    fs::write(root.join("adapter.cjs"), "").unwrap();
    let node = root.join("node");
    fs::write(&node, r#"#!/bin/sh
set -eu
/bin/ln -s replacement.json next.json
/bin/mv -f next.json contract.json
printf '%s' '{"scenarios":[{"id":"phone","status":"unavailable","stepsCompleted":0,"error":null,"captures":[]}]}'
"#).unwrap();
    fs::set_permissions(&node, fs::Permissions::from_mode(0o700)).unwrap();
    let run = |extra: &[&str]| {
        Command::new(env!("CARGO_BIN_EXE_uf"))
            .arg("--root")
            .arg(root)
            .args(["verify", "contract.json"])
            .args(extra)
            .env("PATH", root)
            .env("UF_BROWSER_ADAPTER", root.join("adapter.cjs"))
            .output()
            .unwrap()
    };
    assert_eq!(run(&[]).status.code(), Some(3));
    let receipt = root.join(".ultimate-frontend/reports/links.json");
    let saved = fs::read(&receipt).unwrap();
    let result = run(&["--url", "http://127.0.0.1:8080"]);
    assert_eq!(
        fs::read_link(root.join("contract.json")).unwrap().to_str(),
        Some("replacement.json")
    );
    assert_eq!(result.status.code(), Some(3));
    assert_eq!(
        serde_json::from_slice::<Value>(&result.stdout).unwrap(),
        json!({"status":"unavailable", "reason":"Inputs changed during verification; run again"})
    );
    assert_eq!(fs::read(receipt).unwrap(), saved);
}
