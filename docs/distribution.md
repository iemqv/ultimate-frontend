# Skill distribution

Install one copy of `skills/ultimate-frontend` in the project directory that the chosen agent scans. Keep one source of instructions and copy the references, attribution, notices and licenses with it. The installer does not modify agent settings, add hooks, install browsers or build the optional Rust CLI. Project layouts follow [Impeccable's provider directory table](https://github.com/pbakaus/impeccable#installation).

The installer must work from the packed npm artifact, without dependencies or a network connection after download. Test each destination in a temporary project. A repeat install must leave matching files alone and refuse a conflicting or linked destination. A user can review and move an old installation before installing a different version.

Release checks cover the packaged installer, engine CLI, browser adapter, gallery and frozen comparison verifiers. Before releasing changes to the workshop runner, run `python3 -B eval/workshop/runner/test_arm.py` on Linux with the [workshop prerequisites](../eval/workshop/README.md). This mock preflight makes no live model requests. Agent discovery is a separate host-level check; a correct directory layout does not prove a live agent loaded the skill. Publishing to npm or pushing a Git revision is a separate release action.
