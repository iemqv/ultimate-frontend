use crate::model::{Contract, Intent, Kind, Step};
use serde::Serialize;
use std::collections::{BTreeMap, BTreeSet};

pub fn scene_width(width: u32) -> Option<bool> {
    match width {
        ..=480 => Some(true),
        1024.. => Some(false),
        _ => None,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum Route {
    Creative,
    Product,
    Reading,
    Approved,
    Refine,
    Critique,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Plan {
    pub route: Route,
    pub methods: Vec<&'static str>,
    pub references: Vec<&'static str>,
    pub missing: Vec<&'static str>,
    pub peer_layout_review: bool,
}

pub fn plan(c: &Contract) -> Plan {
    let route = match (&c.intent, &c.approved, &c.kind) {
        (Intent::Critique, _, _) => Route::Critique,
        (Intent::Refine, _, _) => Route::Refine,
        (_, Some(_), _) => Route::Approved,
        (_, _, Kind::Creative) => Route::Creative,
        (_, _, Kind::Product) => Route::Product,
        (_, _, Kind::Reading) => Route::Reading,
    };
    let mut p = Plan {
        route,
        methods: vec!["impeccable", "unslop"],
        references: vec!["finish-check.md"],
        missing: Vec::new(),
        peer_layout_review: c.intent == Intent::Build
            && c.kind == Kind::Creative
            && c.approved.is_none(),
    };
    match p.route {
        Route::Creative => {
            p.methods.extend(["frontend-design", "taste", "awwwards"]);
            p.references.extend([
                "creative-build.md",
                "direction-studies.md",
                "build-the-frame.md",
            ]);
            if !c
                .direction
                .as_ref()
                .is_some_and(|d| !d.materials.is_empty())
            {
                p.missing
                    .push("Name actual materials and the chosen composition");
            }
            let scenes: Vec<_> = c.direction.iter().flat_map(|d| &d.scenes).collect();
            for narrow in [true, false] {
                let mut groups = BTreeMap::<_, BTreeSet<_>>::new();
                for scene in &scenes {
                    if let Some(s) = c
                        .scenarios
                        .iter()
                        .find(|s| s.id == scene.scenario && scene_width(s.width) == Some(narrow))
                    {
                        groups
                            .entry((s.width, s.height))
                            .or_default()
                            .insert((&scene.scenario, &scene.capture));
                    }
                }
                if !groups.values().any(|frames| frames.len() >= 2) {
                    p.missing.push(if narrow {
                        "Name opening and next captures on a narrow viewport"
                    } else {
                        "Name opening and next captures on a wide viewport"
                    });
                }
            }
        }
        Route::Product | Route::Reading => {
            p.methods.push("taste");
            p.references.push("composition.md");
        }
        Route::Approved => p.references.push("build-the-frame.md"),
        Route::Refine | Route::Critique => p.references.push("signs.md"),
    }
    if c.kind != Kind::Reading
        || c.scenarios.iter().any(|s| {
            s.steps
                .iter()
                .any(|step| matches!(step, Step::Press { .. } | Step::PointerDown { .. }))
        })
    {
        p.methods.push("apple-design");
        p.references.push("interaction.md");
    }
    if c.inputs.is_empty() {
        p.missing
            .push("List the source inputs that affect this surface");
    }
    if c.scenarios.is_empty() {
        p.missing.push("Declare at least one visitor scenario");
    }
    if c.scenarios.iter().any(|s| s.capture_ids().is_empty()) {
        p.missing
            .push("Give each scenario at least one named capture");
    }
    if c.intent == Intent::Build
        && !(c.scenarios.iter().any(|s| s.width <= 480)
            && c.scenarios.iter().any(|s| s.width >= 1024))
    {
        p.missing
            .push("Check the new surface at narrow (≤480px) and wide (≥1024px) widths");
    }
    p
}
