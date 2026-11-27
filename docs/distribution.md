# Skill distribution

Install one copy of `skills/ultimate-frontend` in the project directory that the chosen agent scans. Keep one source of instructions and copy the references, attribution, notices and licenses with it. The installer does not modify agent settings, add hooks, install browsers or build the optional Rust CLI. Project layouts follow [Impeccable's provider directory table](https://github.com/pbakaus/impeccable#installation).

The installer must work from the packed npm artifact, without dependencies or a network connection after download. Test each destination in a temporary project. A repeat install must leave matching files alone and refuse a conflicting or linked destination. A user can review and move an old installation before installing a different version.

Release checks cover the packaged installer, engine CLI, browser adapter, gallery and frozen comparison verifiers. Before releasing changes to the workshop runner, run `python3 -B eval/workshop/runner/test_arm.py` on Linux with the [workshop prerequisites](../eval/workshop/README.md). This mock preflight makes no live model requests. Agent discovery is a separate host-level check; a correct directory layout does not prove a live agent loaded the skill.

## Publish a version

Register `iemqv`, `ultimate-frontend` and `release.yml` in the npm package's GitHub Actions trusted publisher settings. Leave the environment blank and allow `npm publish`. No repository npm token is needed.

Every push to `main` runs Check. After it passes, Release creates one version for that push, publishes it to npm and attaches the same archive to a GitHub Release. A push with several commits produces one release. Other branches and pull requests do not publish.

**Patch:** change nothing. After `v0.7.0`, the next push releases `0.7.1`. **Minor or major:** set `version` in the root `package.json` to the desired higher version, for example `0.8.0` or `1.0.0`, and push. The workflow stamps the npm and Rust manifests in a release-only commit and tags it. It never pushes back to `main`. Thus `package.json` on `main` contains the requested version, not necessarily the latest published patch.

If publication is interrupted, rerun the failed job. It reuses the tag reserved for that push and checks the archive against any existing npm publication and GitHub release asset. An older push cannot replace a newer release as `latest`; if that push has already been superseded, apply any needed change on current `main`.
