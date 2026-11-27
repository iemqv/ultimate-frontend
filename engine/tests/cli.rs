use serde_json::{Value, json};
use std::{fs, path::Path, process::Command};
use tempfile::TempDir;

fn run(root: &Path, args: &[&str]) -> (i32, Value) {
    let output = Command::new(env!("CARGO_BIN_EXE_uf"))
        .arg("--root")
        .arg(root)
        .args(args)
        .output()
        .unwrap();
    let code = output.status.code().unwrap();
    if code == 1 {
        return (code, json!(String::from_utf8(output.stderr).unwrap()));
    }
    (code, serde_json::from_slice(&output.stdout).unwrap())
}

fn fixture() -> (TempDir, Value) {
    let dir = tempfile::tempdir().unwrap();
    fs::write(dir.path().join("DESIGN.md"), "Use the project wordmark").unwrap();
    fs::write(dir.path().join("app.css"), "button { outline: none; }").unwrap();
    let c = json!({
        "version": 1, "surface": "settings", "intent": "refine", "kind": "product",
        "visitor": "Member", "outcome": "Change preferences",
        "locks": [{"source":"DESIGN.md", "preserve":"Project wordmark"}], "inputs":["app.css"],
        "scenarios":[{"id":"phone","path":"/","width":375,"height":720,"state":"Resting",
                       "steps":[{"op":"capture","id":"opening"}]}]
    });
    (dir, c)
}

fn save(root: &Path, contract: &Value) {
    fs::write(root.join("contract.json"), contract.to_string()).unwrap();
}

#[test]
fn read_only_critique_and_scoped_refinement() {
    let (dir, mut contract) = fixture();
    let root = dir.path();
    save(root, &contract);
    let (_, context) = run(root, &["inspect"]);
    assert_eq!(
        context["sources"],
        json!([{"path":"DESIGN.md","role":"design"}])
    );
    let (code, plan) = run(root, &["plan", "contract.json"]);
    assert_eq!(code, 0);
    assert_eq!(plan["route"], "refine");
    assert_eq!(plan["missing"], json!([]));
    assert_eq!(plan["peerLayoutReview"], false);
    assert_eq!(run(root, &["record", "contract.json"]).0, 0);
    let (_, context) = run(root, &["inspect"]);
    assert_eq!(
        context["decisions"],
        json!([".ultimate-frontend/decisions/settings.json"])
    );
    contract["intent"] = json!("critique");
    contract["visitor"] = json!("Someone else");
    save(root, &contract);
    let (_, plan) = run(root, &["plan", "contract.json"]);
    assert_eq!(plan["route"], "critique");
    assert_eq!(run(root, &["record", "contract.json"]).0, 1);
    let decision: Value = serde_json::from_slice(
        &fs::read(root.join(".ultimate-frontend/decisions/settings.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(decision["visitor"], "Member");
    assert_eq!(decision["locks"][0]["source"], "DESIGN.md");
}

#[test]
fn record_rejects_invalid_references_without_replacing_decision() {
    let (dir, mut contract) = fixture();
    let root = dir.path();
    save(root, &contract);
    assert_eq!(run(root, &["record", "contract.json"]).0, 0);
    let path = root.join(".ultimate-frontend/decisions/settings.json");
    let saved = fs::read(&path).unwrap();

    contract["inputs"] = json!(["missing.css"]);
    save(root, &contract);
    let (code, error) = run(root, &["record", "contract.json"]);
    assert_eq!(code, 1);
    assert!(error.as_str().unwrap().contains("Resolve missing.css"));
    assert_eq!(fs::read(&path).unwrap(), saved);

    contract["inputs"] = json!(["app.css"]);
    contract["approved"] = json!({"frames": [{"reference": "reference.png", "scenario":"phone", "capture":"opening",
        "regions":[{"id":"hero", "x":0, "y":0,"width":100,"height":100,"maxMeanDelta":0.02}]}]});
    save(root, &contract);
    let (code, error) = run(root, &["record", "contract.json"]);
    assert_eq!(code, 1);
    assert!(error.as_str().unwrap().contains("Resolve reference.png"));
    assert_eq!(fs::read(&path).unwrap(), saved);

    fs::create_dir(root.join("reference.png")).unwrap();
    let (code, error) = run(root, &["record", "contract.json"]);
    assert_eq!(code, 1);
    assert!(
        error
            .as_str()
            .unwrap()
            .contains("Approved reference must be a file")
    );
    assert_eq!(fs::read(&path).unwrap(), saved);

    fs::remove_dir(root.join("reference.png")).unwrap();
    image::RgbaImage::new(375, 720)
        .save(root.join("reference.png"))
        .unwrap();
    assert_eq!(run(root, &["record", "contract.json"]).0, 0);
}

#[test]
fn missing_browser_never_passes_and_stale_inputs_invalidate_report() {
    let (dir, contract) = fixture();
    let root = dir.path();
    save(root, &contract);
    let (code, report) = run(root, &["verify", "contract.json"]);
    assert_eq!(code, 3);
    assert_eq!(report["status"], "unavailable");
    let findings = report["findings"].as_array().unwrap();
    assert!(
        findings
            .iter()
            .any(|f| f["id"] == "impeccable.source-outline-removal" && f["blocking"] == false)
    );
    assert!(
        findings
            .iter()
            .any(|f| f["id"] == "browser.unavailable" && f["blocking"] == true)
    );
    assert_eq!(run(root, &["report", "contract.json"]), (3, report));
    fs::write(root.join("DESIGN.md"), "Updated wordmark").unwrap();
    let (code, stale) = run(root, &["report", "contract.json"]);
    assert_eq!(code, 3);
    assert!(
        stale["reason"]
            .as_str()
            .unwrap()
            .contains("No current report")
    );
}

#[test]
fn creative_and_approved_work_have_distinct_requirements() {
    let (dir, mut c) = fixture();
    let root = dir.path();
    c["intent"] = json!("build");
    c["kind"] = json!("creative");
    save(root, &c);
    let (_, creative) = run(root, &["plan", "contract.json"]);
    assert_eq!(creative["route"], "creative");
    assert_eq!(creative["peerLayoutReview"], true);
    assert_eq!(creative["methods"].as_array().unwrap().len(), 6);
    assert_eq!(creative["missing"].as_array().unwrap().len(), 4);
    c["direction"] = json!({"materials":[{"source":"app.css","provenance":"Fixture","role":"Color"}],
    "composition":"Centered layout", "narrow":"Stack content", "scenes":[
        {"scenario":"phone","capture":"opening","change":"Initial"},
        {"scenario":"phone-next","capture":"opening","change":"Next"}
    ]});
    let mut next = c["scenarios"][0].clone();
    next["id"] = json!("phone-next");
    next["width"] = json!(390);
    c["scenarios"].as_array_mut().unwrap().push(next);
    save(root, &c);
    let (_, mixed) = run(root, &["plan", "contract.json"]);
    let narrow_missing = |plan: &Value| {
        plan["missing"].as_array().unwrap().iter().any(|x| {
            x.as_str()
                .unwrap()
                .contains("next captures on a narrow viewport")
        })
    };
    assert!(narrow_missing(&mixed));
    c["scenarios"][1]["width"] = json!(375);
    save(root, &c);
    let (_, matched) = run(root, &["plan", "contract.json"]);
    assert!(!narrow_missing(&matched));
    c["approved"] = json!({"frames": [{"reference": "reference.png", "scenario":"phone", "capture":"opening",
        "regions":[{"id":"hero", "x":0, "y":0,"width":100,"height":100,"maxMeanDelta":0.02}]}]});
    save(root, &c);
    let (_, approved) = run(root, &["plan", "contract.json"]);
    assert_eq!(approved["route"], "approved");
    assert_eq!(approved["peerLayoutReview"], false);
    assert_eq!(approved["missing"].as_array().unwrap().len(), 1);
}
