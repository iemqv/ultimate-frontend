---
name: ultimate-frontend
description: Build, refine or critique user-facing interfaces from project constraints through art direction, interaction and browser verification. Use on websites, product surfaces and frontend components.
---

# Ultimate Frontend: project design loop

Start from the project, not a style preset. One set of decisions travels from brief to implementation to verification. Do not run five independent design passes.

## Read the project; choose the route

Read the applicable project instructions, design record, tokens, source content and components. For an existing surface, inspect the affected live state before changing it. Identify the visitor, the decision they need to make, the supplied fact or object that supports it, and the outcome a real control can deliver. Separate constraints from choices. If the project already answers a question, don't ask it again. Never invent facts or a production service to fill a mockup.

- **Create:** choose the primary job (persuade, experience, operate or read). Use [composition](references/composition.md) to compare plausible ways of encountering the actual material. Sketch in notes unless real uncertainty warrants rendering alternatives. Commit to a hierarchy for desktop *and* phone, not a palette name.
- **Refine:** read the last decision and try the failing task. Identify the smallest change to the data, placement or interaction that will help. Keep the identity, unaffected structure and working paths. Do not audition a new visual direction.
- **Critique:** keep the repository read-only. Describe the observed obstacle, its location, its consequence and the smallest remedy. Do not create a design record or implement a fix.

## Hand off a decision, not another brief

For a new surface or a durable change to project conventions, record the decision **before implementing it** in the project's existing design document, adding only what it doesn't say. If it has none, use its established private project-notes location. Only in a writable development repository without such a convention use `DESIGN.md` beside the project documentation. If writing notes isn't permitted (e.g. only public deployable files are allowed), keep the decision in the working context and provide it in the handoff instead. Never put private notes in shipped page copy or add a runtime dependency on them. Tiny edits do not require a new document. Use [the decision record](references/decision-record.md) to retain what the next session actually needs.

## Build with the decision in hand

Impeccable sets scope and usability constraints. Anthropic supplies the composition; Taste tests it against the available material. Place the real decision cue where the visitor compares or acts. Carry a defining visual relationship into the next section and onto the phone; derive role tokens from the project instead of restyling its controls. For operation, start with the data a person must read. For an exhibit, decide whether the visitor should first examine one object or compare several. Never enforce a universal card ban.

Apple's interaction guidance owns feedback, commitment, keyboard equivalence and return. Prefer a native control. Preserve focus, selection and return position. Read [interaction](references/interaction.md) when motion, interruption or gestures actually affect the task. This is not an Apple visual theme.

## Close the loop once

Reopen the recorded visitor path and exercise it on the resulting screen. Use [finish check](references/finish-check.md). Inspect actual pixels at the relevant widths. Where a project already uses Playwright, its page can run the [optional browser adapter](tools/browser/README.md); otherwise use available browser tools directly. A saved image is not a visual judgment and an unavailable tool is not a pass.

Impeccable tests whether the visitor can finish the task; Unslop identifies interchangeable or distracting choices **on the render**. Resolve conflicts in order: fixed brief and accessibility, working task, adopted direction, polish. For authorized implementation, batch confirmed defects and recheck only affected states. If the task has a writable decision record, update its entry with the observed route, outcome and any gap. For critique or a read-only handoff, report observations and proposed remedies without writing files. Do not reopen an approved direction for taste alone. If no defect remains, stop.

Adapted from Anthropic, Emil Kowalski, Leonxlnx, Paul Bakaus and Damir Sokolovsky's [Unslop](https://github.com/heydamir/unslop) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)). The project-owned handoff and bounded browser loop modify and combine their methods; see `ATTRIBUTION.md` in the distribution.
