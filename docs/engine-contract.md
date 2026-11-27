# Local verification engine

The optional `uf` command runs from a source checkout. The [skill installer](distribution.md) does not ship the CLI or the browser adapter.

## Set up the engine

From the Ultimate Frontend checkout, build the CLI and set these variables before starting your agent:

```sh
cargo build --release --locked --manifest-path engine/Cargo.toml
export UF_BIN="$PWD/engine/target/release/uf"
export UF_BROWSER_ADAPTER="$PWD/adapters/browser/capture.cjs"
```

For browser checks, provide `playwright-core` and its Chromium browser. If Node cannot resolve `playwright-core`, set `UF_PLAYWRIGHT_CORE` to the package directory's absolute path. If you use a separate Chromium install, set `UF_CHROMIUM` to its executable. See the [engine workflow](../skills/ultimate-frontend/references/engine-workflow.md) for how to verify a local preview.

## Ownership

A single Rust program owns project context discovery, validation, route planning, decision persistence, source checks, interpretation of browser observations, approved-frame comparison and report freshness. The standalone Playwright adapter owns browser launch, input, capture and measurement. The skill owns taste, copy judgment, competing ideas, negotiation and implementation. Project design documents and source tokens remain authoritative. Do not duplicate them in engine state.

## Command line

`uf --root <workspace> inspect | plan <contract.json> | record <contract.json> | verify <contract.json> [--url <base>] | report <contract.json>`; `--root` defaults to cwd. JSON on stdout, diagnostics on stderr. Exit 0 for successful command or passing gate, 1 for usage/input/runtime error, 2 for an observed blocking failure, 3 for required unavailable/stale evidence. The binary discovers its adapter next to itself, or via `UF_BROWSER_ADAPTER`. Paths in contracts are relative to root and must resolve inside it. Only `record` writes a project decision; verification writes local evidence, never app files. Critique cannot write a decision. Clients must use a clean version of the app on a user-approved, isolated loopback server, not a signed-in or production session. Browser verification does not claim an arbitrary live server serves the hashed source files.

## Domain

A versioned `Contract` contains `surface`, `intent` (build/refine/critique), `kind` (creative/product/reading), `visitor`, `outcome`, `locks` (project source pointers), `inputs` (files or directories for verification freshness), optional `direction`, optional `approved`, and a `scenarios` list. IDs are safe stable slugs. The plan selects a closed route and names applicable methods, directives and missing requirements. Only creative builds with no approved comp require a direction study, material and opening/next evidence. For each viewport size, list the opening and next captures first in `direction.scenes`, followed by any additional captures. A distinct middle frame cannot substitute for a changed next state. Refine and critique retain scope; approved fixes use the supplied composition. Creative and product scenarios use both narrow and wide widths for a new build; refinements may use a single affected width. The contract is a concise record, not a score of taste.

`Decision` contains only surface intent and project references, not transient execution state. `Scenario` declares URL path, viewport and motion preference, steps described by accessible role and exact name, and a state label. The capture protocol is `{baseUrl, outputDir, scenarios}` on stdin, `{scenarios:[...]}` on stdout. Each result carries ID, outcome, steps completed, error if applicable, and observed width/height, overflow, visible text, visual peer-group leads, and a PNG for captured states. Missing capability differs from failed interaction. Scenario assertions driven by keyboard must not focus the target before the action. The CLI invokes the adapter once per scenario under a shared 120-second budget. If a later scenario cannot finish, earlier failures and captures remain in the report. Use a fresh session per scenario. Limit traffic to the exact approved origin and block mutating HTTP methods; state-changing production work is out of scope.

`Approved` compares explicitly declared regions and geometry with an approved PNG at the declared state/width; the report keeps each measured delta. A missing region/capture/reference never passes on another region's merit. Text repetition or peer layouts are review cues, not universal prohibitions. Record/report use stable IDs and versioned envelopes. Reports are keyed to a SHA-256 fingerprint of exact contract bytes and listed input/lock/reference files, and bind captured artifacts. Verify before and after capture; a changed input invalidates publication. Reports explicitly qualify evidence: only the selected app URL, scenarios, source scope and widths were observed. The author is responsible for listing all files affecting a surface and ensuring server freshness.

## Testing

`engine/tests/` exercises CLI contracts, decision persistence and report freshness. The Node suites in `adapters/browser/` and `engine/tests/` exercise real browser actions and regional drift against loopback fixtures.
