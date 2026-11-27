use anyhow::{Result, ensure};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Contract {
    pub version: u32,
    pub surface: String,
    pub intent: Intent,
    pub kind: Kind,
    pub visitor: String,
    pub outcome: String,
    #[serde(default)]
    pub locks: Vec<Lock>,
    #[serde(default)]
    pub inputs: Vec<String>,
    pub direction: Option<Direction>,
    pub approved: Option<Approved>,
    #[serde(default)]
    pub scenarios: Vec<Scenario>,
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Intent {
    Build,
    Refine,
    Critique,
}

#[derive(Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum Kind {
    Creative,
    Product,
    Reading,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Lock {
    pub source: String,
    pub preserve: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Direction {
    pub materials: Vec<Material>,
    pub composition: String,
    pub narrow: String,
    pub scenes: Vec<Scene>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Material {
    pub source: String,
    pub provenance: String,
    pub role: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Scene {
    pub scenario: String,
    pub capture: String,
    pub change: String,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Approved {
    pub frames: Vec<Frame>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Frame {
    pub reference: String,
    pub scenario: String,
    pub capture: String,
    pub regions: Vec<Region>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Region {
    pub id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
    pub max_mean_delta: f64,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Scenario {
    pub id: String,
    pub path: String,
    pub width: u32,
    pub height: u32,
    pub state: String,
    #[serde(default)]
    pub reduced_motion: bool,
    pub steps: Vec<Step>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(tag = "op", rename_all = "kebab-case", deny_unknown_fields)]
pub enum Step {
    Click {
        target: Target,
    },
    Focused {
        target: Target,
    },
    Visible {
        target: Target,
    },
    Hidden {
        target: Target,
    },
    Press {
        key: String,
        focused: Option<Target>,
    },
    Fill {
        target: Target,
        value: String,
    },
    Text {
        target: Target,
        equals: String,
    },
    Scroll {
        y: i32,
    },
    PointerDown {
        target: Target,
    },
    PointerMove {
        x: i32,
        y: i32,
    },
    PointerUp,
    Capture {
        id: String,
    },
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct Target {
    pub role: String,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Status {
    Pass,
    Fail,
    Unavailable,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Observation {
    pub id: String,
    pub status: Status,
    pub steps_completed: usize,
    pub error: Option<String>,
    pub captures: Vec<Capture>,
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Capture {
    pub id: String,
    pub width: u32,
    pub height: u32,
    pub horizontal_overflow: bool,
    pub lines: Vec<String>,
    pub peer_groups: Vec<Vec<String>>,
    pub scroll_y: u32,
    pub scroll_range: u32,
}

pub fn slug(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 64
        && s.as_bytes()[0].is_ascii_alphanumeric()
        && s.bytes()
            .all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == b'-')
}

fn present(s: &str) -> bool {
    !s.trim().is_empty()
}

impl Scenario {
    pub fn capture_ids(&self) -> BTreeSet<&str> {
        self.steps
            .iter()
            .filter_map(|s| match s {
                Step::Capture { id } => Some(id.as_str()),
                _ => None,
            })
            .collect()
    }
}

impl Contract {
    pub fn validate(&self) -> Result<()> {
        ensure!(self.version == 1, "Expected contract version 1");
        ensure!(slug(&self.surface), "Invalid surface ID");
        ensure!(
            present(&self.visitor) && present(&self.outcome),
            "Describe the visitor and outcome"
        );
        ensure!(
            self.locks
                .iter()
                .all(|l| present(&l.source) && present(&l.preserve)),
            "Lock must name its source and what to preserve"
        );
        ensure!(
            self.scenarios.len() <= 20,
            "At most 20 scenarios per contract"
        );
        let mut ids = BTreeSet::new();
        let mut artifact_names = BTreeSet::new();
        for scenario in &self.scenarios {
            ensure!(
                slug(&scenario.id) && ids.insert(&scenario.id),
                "Invalid or duplicate scenario: {}",
                scenario.id
            );
            ensure!(
                (240..=3840).contains(&scenario.width) && (240..=2400).contains(&scenario.height),
                "Unsupported viewport in {}",
                scenario.id
            );
            ensure!(
                scenario.path.starts_with('/')
                    && !scenario.path.starts_with("//")
                    && !scenario.path.contains(['\\', '\r', '\n', '\t']),
                "Expected origin-relative scenario path"
            );
            ensure!(
                present(&scenario.state) && scenario.steps.len() <= 50,
                "Missing state or too many steps in {}",
                scenario.id
            );
            let mut captures = BTreeSet::new();
            let mut down = false;
            for step in &scenario.steps {
                match step {
                    Step::Capture { id } => ensure!(
                        slug(id)
                            && captures.insert(id)
                            && artifact_names.insert(format!("{}-{id}", scenario.id)),
                        "Invalid or ambiguous capture ID: {}/{id}",
                        scenario.id
                    ),
                    Step::PointerDown { .. } => {
                        ensure!(!down, "Pointer is already down");
                        down = true;
                    }
                    Step::PointerMove { x, y } => ensure!(
                        *x >= 0
                            && *y >= 0
                            && (*x as u32) < scenario.width
                            && (*y as u32) < scenario.height,
                        "Pointer coordinates outside viewport"
                    ),
                    Step::PointerUp => {
                        ensure!(down, "Pointer is not down");
                        down = false;
                    }
                    _ => {}
                }
            }
            ensure!(!down, "Release the pointer in {}", scenario.id);
        }
        if let Some(direction) = &self.direction {
            ensure!(
                present(&direction.composition) && present(&direction.narrow),
                "Describe composition and narrow treatment"
            );
            for material in &direction.materials {
                ensure!(
                    present(&material.source)
                        && present(&material.provenance)
                        && present(&material.role),
                    "Material requires source, provenance and role"
                );
            }
            let mut scenes = BTreeSet::new();
            for scene in &direction.scenes {
                ensure!(present(&scene.change), "Explain what changes in the scene");
                ensure!(
                    scenes.insert((&scene.scenario, &scene.capture)),
                    "Duplicate scene capture: {}/{}",
                    scene.scenario,
                    scene.capture
                );
                self.validate_capture(&scene.scenario, &scene.capture)?;
            }
        }
        if let Some(approved) = &self.approved {
            ensure!(
                !approved.frames.is_empty(),
                "Approved comparison requires frames"
            );
            let mut frames = BTreeSet::new();
            for frame in &approved.frames {
                self.validate_capture(&frame.scenario, &frame.capture)?;
                ensure!(
                    frames.insert((&frame.scenario, &frame.capture)) && !frame.regions.is_empty(),
                    "Duplicate approved frame or missing regions"
                );
                let mut regions = BTreeSet::new();
                for r in &frame.regions {
                    ensure!(
                        slug(&r.id)
                            && regions.insert(&r.id)
                            && r.width > 0
                            && r.height > 0
                            && (0.0..=1.0).contains(&r.max_mean_delta),
                        "Invalid approved region: {}",
                        r.id
                    );
                }
            }
        }
        Ok(())
    }

    fn validate_capture(&self, scenario: &str, capture: &str) -> Result<()> {
        ensure!(
            self.scenarios
                .iter()
                .any(|s| s.id == scenario && s.capture_ids().contains(capture)),
            "Unknown capture {scenario}/{capture}"
        );
        Ok(())
    }
}
