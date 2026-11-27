use crate::model::Contract;
use anyhow::{Context, Result, bail, ensure};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeSet,
    fs,
    io::{self, Read, Write},
    path::{Component, Path, PathBuf},
};

const STATE: &str = ".ultimate-frontend";
const MAX_CONTRACT_BYTES: u64 = 512 * 1024;
const SKIP: &[&str] = &[STATE, ".git", "node_modules", "target"];
const CONTEXT: &[(&str, &str)] = &[
    ("AGENTS.md", "project-instructions"),
    ("PRODUCT.md", "product"),
    ("DESIGN.md", "design"),
    ("design-system.md", "design"),
    ("docs/DESIGN.md", "design"),
    ("package.json", "stack"),
    ("src/tokens.css", "tokens"),
    ("app/globals.css", "styles"),
    ("src/components", "components"),
    ("components", "components"),
];

pub struct Project {
    pub root: PathBuf,
}

impl Project {
    pub fn open(root: &Path) -> Result<Self> {
        let root = root.canonicalize().context("Resolve workspace")?;
        ensure!(root.is_dir(), "Workspace is not a directory");
        Ok(Self { root })
    }

    pub fn path(&self, relative: &str) -> Result<PathBuf> {
        let path = Path::new(relative);
        ensure!(
            !relative.is_empty()
                && path
                    .components()
                    .all(|c| matches!(c, Component::Normal(_) | Component::CurDir)),
            "Expected project-relative path: {relative}"
        );
        let real = self
            .root
            .join(path)
            .canonicalize()
            .with_context(|| format!("Resolve {relative}"))?;
        ensure!(
            real.starts_with(&self.root),
            "Path escapes workspace: {relative}"
        );
        Ok(real)
    }

    pub fn read_contract(&self, relative: &str) -> Result<(PathBuf, Vec<u8>)> {
        let path = self.path(relative)?;
        let metadata = fs::metadata(&path)?;
        ensure!(
            metadata.is_file() && metadata.len() <= MAX_CONTRACT_BYTES,
            "Contract must be a JSON file of at most 512 KiB"
        );
        let mut bytes = Vec::new();
        fs::File::open(&path)?
            .take(MAX_CONTRACT_BYTES + 1)
            .read_to_end(&mut bytes)?;
        ensure!(
            bytes.len() as u64 <= MAX_CONTRACT_BYTES,
            "Contract exceeds 512 KiB"
        );
        Ok((path, bytes))
    }

    fn state(&self, name: &str, create: bool) -> Result<PathBuf> {
        let mut path = self.root.clone();
        for part in [STATE, name] {
            path.push(part);
            match fs::symlink_metadata(&path) {
                Ok(info) => ensure!(
                    info.is_dir() && !info.file_type().is_symlink(),
                    "Unsafe state directory: {}",
                    path.display()
                ),
                Err(e) if e.kind() == io::ErrorKind::NotFound && create => {
                    match fs::create_dir(&path) {
                        Ok(()) => (),
                        Err(e) if e.kind() == io::ErrorKind::AlreadyExists => {
                            let info = fs::symlink_metadata(&path)?;
                            ensure!(
                                info.is_dir() && !info.file_type().is_symlink(),
                                "Unsafe state directory"
                            );
                        }
                        Err(e) => return Err(e.into()),
                    }
                }
                Err(e) if e.kind() == io::ErrorKind::NotFound => (),
                Err(e) => return Err(e.into()),
            }
        }
        Ok(path)
    }

    pub fn evidence_dir(&self) -> Result<PathBuf> {
        self.state("evidence", true)
    }

    pub fn receipt(&self, surface: &str) -> Result<PathBuf> {
        Ok(self
            .state("reports", false)?
            .join(format!("{surface}.json")))
    }

    pub fn save_report(&self, surface: &str, value: &impl Serialize) -> Result<()> {
        save(
            &self.state("reports", true)?.join(format!("{surface}.json")),
            value,
        )
    }

    pub fn record(&self, c: &Contract) -> Result<PathBuf> {
        self.input_files(c, |_, _| Ok(()))?;
        let dir = self.state("decisions", true)?;
        let path = dir.join(format!("{}.json", c.surface));
        save(
            &path,
            &json!({"version":1, "surface":c.surface, "kind":c.kind, "visitor":c.visitor,
            "outcome":c.outcome, "locks":c.locks, "direction":c.direction, "approved":c.approved,
            "scenarios":c.scenarios, "inputs":c.inputs}),
        )?;
        Ok(path)
    }

    pub fn inspect(&self) -> Result<Value> {
        let mut decisions = Vec::new();
        let dir = self.state("decisions", false)?;
        if dir.is_dir() {
            for entry in fs::read_dir(dir)? {
                let entry = entry?;
                if entry.file_type()?.is_file()
                    && entry.path().extension().is_some_and(|x| x == "json")
                {
                    decisions.push(
                        entry
                            .path()
                            .strip_prefix(&self.root)?
                            .to_string_lossy()
                            .into_owned(),
                    );
                }
            }
        }
        decisions.sort();
        let sources: Vec<_> = CONTEXT
            .iter()
            .filter_map(|(path, role)| {
                self.path(path)
                    .ok()
                    .map(|_| json!({"path":path,"role":role}))
            })
            .collect();
        Ok(json!({"version":1,"root":self.root,"sources":sources,"decisions":decisions}))
    }

    fn source(&self, path: &str) -> Result<PathBuf> {
        let path = self.path(path)?;
        ensure!(
            path.strip_prefix(&self.root)?
                .components()
                .all(|p| !SKIP.iter().any(|name| p.as_os_str() == *name)),
            "Generated or private input: {}",
            path.display()
        );
        Ok(path)
    }

    fn input_files(
        &self,
        c: &Contract,
        mut visit_source: impl FnMut(&str, &Path) -> Result<()>,
    ) -> Result<BTreeSet<PathBuf>> {
        let mut files = BTreeSet::new();
        for path in c
            .inputs
            .iter()
            .map(String::as_str)
            .chain(c.locks.iter().map(|l| l.source.as_str()))
            .chain(
                c.direction
                    .iter()
                    .flat_map(|d| d.materials.iter().map(|m| m.source.as_str())),
            )
        {
            let target = self.source(path)?;
            visit_source(path, &target)?;
            walk(&target, &mut files)?;
        }
        for frame in c.approved.iter().flat_map(|a| &a.frames) {
            let target = self.reference(&frame.reference)?;
            visit_source(&frame.reference, &target)?;
            walk(&target, &mut files)?;
        }
        Ok(files)
    }

    pub fn reference(&self, path: &str) -> Result<PathBuf> {
        let target = self.source(path)?;
        ensure!(
            target.is_file(),
            "Approved reference must be a file: {path}"
        );
        Ok(target)
    }

    pub fn snapshot(&self, bytes: &[u8], c: &Contract) -> Result<Snapshot> {
        let mut hash = Sha256::new();
        fingerprint_part(&mut hash, bytes);
        let files = self.input_files(c, |path, target| {
            let name = target
                .strip_prefix(&self.root)?
                .to_str()
                .context("Input path must be UTF-8")?;
            fingerprint_part(&mut hash, path.as_bytes());
            fingerprint_part(&mut hash, name.as_bytes());
            Ok(())
        })?;
        let mut total = 0;
        for file in &files {
            let name = file
                .strip_prefix(&self.root)?
                .to_str()
                .context("Input path must be UTF-8")?;
            total += fs::metadata(file)?.len();
            ensure!(
                total <= 128 * 1024 * 1024,
                "Input scope exceeds 128 MiB; list narrower inputs"
            );
            fingerprint_part(&mut hash, name.as_bytes());
            fingerprint_part(&mut hash, &fs::read(file)?);
        }
        Ok(Snapshot {
            fingerprint: format!("{:x}", hash.finalize()),
            files: files.into_iter().collect(),
        })
    }
}

pub struct Snapshot {
    pub fingerprint: String,
    pub files: Vec<PathBuf>,
}

fn walk(path: &Path, files: &mut BTreeSet<PathBuf>) -> Result<()> {
    let meta = fs::symlink_metadata(path)?;
    if meta.is_dir() {
        for entry in fs::read_dir(path)? {
            let entry = entry?;
            if !SKIP.iter().any(|name| entry.file_name() == *name) {
                walk(&entry.path(), files)?;
            }
        }
    } else if meta.is_file() {
        files.insert(path.to_path_buf());
        ensure!(files.len() <= 5_000, "Input scope exceeds 5000 files");
    } else if meta.file_type().is_symlink() {
        bail!(
            "Linked input in directory scope: {}; list narrower inputs and declare the link explicitly",
            path.display()
        );
    } else {
        bail!("Unsupported input: {}", path.display());
    }
    Ok(())
}

fn fingerprint_part(hash: &mut Sha256, bytes: &[u8]) {
    hash.update((bytes.len() as u64).to_le_bytes());
    hash.update(bytes);
}

pub fn file_digest(path: &Path) -> Result<String> {
    let mut file = fs::File::open(path)?;
    let mut hash = Sha256::new();
    io::copy(&mut file, &mut hash)?;
    Ok(format!("{:x}", hash.finalize()))
}

pub fn save(path: &Path, value: &impl Serialize) -> Result<()> {
    let parent = path.parent().context("Missing parent")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)?;
    serde_json::to_writer_pretty(&mut temp, value)?;
    writeln!(temp)?;
    temp.as_file().sync_all()?;
    temp.persist(path)?;
    Ok(())
}
