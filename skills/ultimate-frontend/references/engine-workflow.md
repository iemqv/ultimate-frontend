# Engine workflow

The `uf` CLI discovers candidate project sources, plans from an explicit contract, persists decisions on request, and interprets verification evidence. The browser adapter runs scenarios and captures observations. You still choose direction, write and implement, judge the frames, and decide which findings matter to the visitor. Neither a green report nor a screenshot is a design score.

## Discover, plan, and preserve

1. Use an existing executable: `UF_BIN` if configured as an absolute path, otherwise `uf` on `PATH`. The examples below use `uf`; replace it with `"$UF_BIN"` when using the configured path. Do not auto-install, use `npx`, fetch an adapter, or change host settings. If there is no executable or shell access, inspect the project and select the route manually; report the engine checks you couldn't run.
2. Run `uf --root ROOT inspect` (omit `--root ROOT` if the workspace is the current directory). Read the discovered sources and decisions that apply, plus any instructions, content, tokens and component variants the project stores elsewhere. Discovery is not exhaustive. A past decision is not permission to overwrite a current project lock.
3. Write a small version-1 `CONTRACT.json` under the chosen workspace and run `uf --root ROOT plan CONTRACT.json`. Use the [contract examples](engine-examples.md) as a starting point. Choose intent and kind from the brief, list the files that affect the surface, link the locks, and name the visitor's outcome and scenarios. Address the returned `missing` entries; a successful `plan` command can still have unmet requirements. A new build needs scenarios at ≤480px and ≥1024px; a refinement or critique may use just the affected width. Give each scenario a named capture.
4. Implement only the selected route. For an open creative build, use actual material and inspect the first useful render before extending it; name opening and next captures at matching viewport dimensions for both narrow and wide. For a scoped fix, check what changed and what was preserved. If project decision persistence is authorized and useful to a future session, run `uf --root ROOT record CONTRACT.json`. This writes or replaces the local decision for the surface under `.ultimate-frontend/decisions/`. Link source files rather than duplicating their rules. Don't record a critique.

Paths to the contract, source inputs, locks, materials and reference PNGs are relative to the workspace root and must resolve inside it. Use stable IDs (lowercase letters, digits and hyphens, starting with a letter or digit). List relevant code, styles, templates, meaningful fixtures, configuration and assets as inputs; locks, materials and reference PNGs are also fingerprinted. Don't list the whole repository when a narrower scope will do. If a directory contains a symbolic link, replace that directory scope with narrower inputs and list the link explicitly. Never commit machine-local evidence as design authority.

For a review-only request, don't create a contract or engine state in the reviewed project. `inspect`, `plan` and `report` are read-only; `verify` writes local reports and may write captures. If an isolated copy with a representative preview is authorized, put any new contract and verification outputs there. Otherwise use non-mutating observation or source review, and say which checks were skipped.

## Verify and report

```sh
uf --root ROOT verify CONTRACT.json --url http://127.0.0.1:4173
uf --root ROOT report CONTRACT.json
```

Use only a user-approved, isolated loopback preview serving the version under review, with representative data and no signed-in or production state. The adapter is resolved next to the binary or through `UF_BROWSER_ADAPTER` if already configured. Scenario paths are origin-relative; don't assume remote assets or mutating requests will work. Do not bypass the preview restrictions to make a test pass.

If there is no approved preview, omit `--url` for source checks; browser evidence will be unavailable. If the adapter or browser is missing, distinguish that from a successfully run scenario that failed. An already available, authorized browser can provide separately labeled manual observations; it does not turn an unavailable engine gate into a pass. Without a browser, do source checks, state what was done, and name the unverified viewports, rendered states, interactions and approved regions. Don't substitute an old capture, CSS inspection or successful build for fresh browser evidence.

Use ordered steps with exact accessible role and name. For keyboard checks, drive focus with real keystrokes, then assert focus and outcome; don't focus the target in advance. Use pointer steps for applicable gestures. If the adapter can't express a check (for example pointer cancellation or inspecting intermediate motion), test it manually when possible; otherwise report the gap.

The workflow commands emit JSON on stdout and diagnostics on stderr. Exit `0` means command success or a passing gate, `1` usage/input/runtime error, `2` an observed blocking failure, and `3` required evidence unavailable or stale. Read individual findings, including when a report contains both a failure and evidence gaps. `report` reads saved evidence; it doesn't recapture. Edits to the contract or listed files and missing or changed capture artifacts can invalidate it. Rerun relevant checks on changed inputs. A fresh report binds declared files and artifacts, not proof that the preview serves those files; keep the preview current yourself.

Open the settled frames. Check the hierarchy and copy, interpret repetition or peer-group findings in context, and compare each required approved region separately. No whole-frame result or unrelated region makes up for a missing, unavailable, or failing required region. Use the [finish check](finish-check.md) and report the scenario, viewport, input, outcome, and remaining evidence gaps. A final capture doesn't prove that you checked the first render before extending it.
