# Design system and evaluation contract

Status: baseline experiment. The installed `ultimate-frontend` stays at 0.3.0. The zero-tool experiment in `../run.sh` remains a separate protocol.

## Product boundary

A person asks for a site in ordinary language. The project supplies content, constraints and an existing identity where available. One skill selects the applicable steps; the five sources are not five successive reviewers. The host supplies file editing and a browser. The evaluation tools must not become runtime dependencies of the skill.

| Decision | Owner | Evidence and handoff |
| --- | --- | --- |
| What must work and what must stay? | Impeccable's task framing, subordinate to the project | Existing project facts, the visitor's decision, fixed constraints. Don't produce a competing project brief. |
| How should the audience encounter the material? | Anthropic direction with Taste's test against actual content | For a new showcase, compare two openings and the transition into the next section. New visual artifacts are the candidate intervention, not a condition imposed on controls. |
| How should that choice behave? | Apple Design | Actual input, feedback, completion and return; keep native interactions unless a specific task benefits from something else. |
| Does it work, and is its identity more than decoration? | Impeccable for the user task; Unslop for visual critique | One browser pass, one set of findings, one batch of corrections, focused recheck. A stylistic objection does not overrule a working comparison or a fixed requirement. |

Accessibility and the required task outrank novelty. An existing brand outranks a generic visual preference. Code should establish observed facts (loaded asset, viewport, keyboard state), not certify taste. Never claim a browser check when no pixels were inspected. No mandatory image generator, remote service, or unconditional full redesign.

## Experiment

1. Freeze skill bytes, three development briefs, three withheld briefs, starter assets and human tasks before launch. Reserve the withheld set; never provide its evaluation tasks or any judging rubric to an arm. Three kinds: open showcase, showcase with material, operational UI.
2. Use one trusted inference transport per arm. Model tools expose only that arm's workspace and private renderer, with identical capabilities and limits for all groups. The model never receives transport credentials. Browser network namespace cannot reach the host, siblings or internet. A free preflight has to pass before starting paid inference. A change to the trust boundary invalidates its preflight.
3. Development: compare no design skill vs a frozen copy of 0.3.0, twice per brief. Use fresh processes, randomized order, common model and reasoning setting. A failure or skipped skill/browser remains in its assigned condition. Retain raw outcomes; do not regenerate a losing arm. Keep model-reported work distinct from captured browser evidence. Record browser input to the model separately from independent final screenshots.
4. Collect first and final render evidence when available; same desktop and phone widths for evaluation. Inspect failure cases and the visitor task for each site, not just page load. Blind gallery includes an unlabelled control/control comparison and permits ties or both poor. Visual preference belongs to the human judge; task correctness and aesthetic judgement are separate outcomes.
5. Diagnose where the effect is lost: exposure, uptake, ability to see a render, choice of composition, fidelity on phone or broken action. Prepare a candidate only for a supported problem. For a composition intervention change only the selection mechanism: two visible cheap alternatives on open showcase work, with the actual title, artifact and next action; choose one, don't ship both or impose this on maintenance and operational tasks. Do not replace the installed skill during the experiment.
6. Held-out comparison: control, frozen 0.3.0, candidate with identical workshop. Report actual generations/cost availability, task failures, observations and missing evidence. No release or superiority claim without blind preference on new briefs and no material regression on the operational task. Human votes are never synthesized by the agent.

## Owners and integration order

Workshop transport owns one arm, never experiment assignment. Fixture pack owns the common inputs, their rights and task instructions. Coordinator owns assignment, freezing inputs, process outcomes and failure accounting. Gallery owns anonymized viewing and human votes; it doesn't edit generated sites. The main agent integrates the lanes and performs the scenario checks. No pushes, silent retries, or promotion of an unjudged candidate.
