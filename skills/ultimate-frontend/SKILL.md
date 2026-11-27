---
name: ultimate-frontend
description: Design, build, refine or critique a web frontend. Use for creative websites, product and reading interfaces, approved visual comps, copy and interaction work. Choose one route for the visitor's task and distinguish source checks from browser evidence.
---

# Ultimate Frontend

Use this as the single entry point. Read the brief, project instructions, design docs, tokens, components, content, and known decisions for the affected surface. Identify the visitor, useful outcome, and what must stay. The brief, existing design system, approved comp, truthful content, and accessibility requirements govern; generic visual advice does not override them. If authoritative sources conflict in a way that changes the result, identify the conflict before implementing. Don't copy project tokens or facts into a second source of truth.

Read [Engine workflow](references/engine-workflow.md) for `uf` discovery, route planning, and evidence. If the executable is unavailable, use the same route and checks directly; don't install anything automatically. Select **one** route in this order:

| Route | What to do |
| --- | --- |
| **Critique** | Review only. Reproduce the affected state and width when possible. Use [Signs](references/signs.md) and relevant [Interaction](references/interaction.md) guidance. Report the evidence, visitor impact, and specific remedy; don't edit the project or record a decision. |
| **Refine** | Reproduce the defect and fix it locally. Preserve surrounding choices and any supplied comp. Use [Signs](references/signs.md) or [Interaction](references/interaction.md) as relevant. Compare before and after in the same state and width; don't turn the fix into a redesign. |
| **Build to an approved comp** | Treat the supplied composition as the reference, not an inspiration board. Use [Build the frame](references/build-the-frame.md) to preserve working edges, typography, crops, and responsive order. Match declared regions at the corresponding state and width; don't audition another identity. |
| **Open creative build or substantial redesign** | Follow [Creative build](references/creative-build.md). For a short brief, start inside the destination. Choose an idea from the subject and build the resting and next useful states before adding a shell or sections. A direction study is required; a second rendered comp is not. |
| **Product or reading build** | Use [Composition](references/composition.md) to organize real data or prose around the work. Give the visitor the deciding fact or working control at the point of need. Use comparable rows, grids, ordinary controls, or sustained prose when appropriate. Don't apply the open creative route's tile or copy constraints here. |

The routes combine six methods, not six skill invocations:

- **Impeccable:** identify the surface job and preserve/build boundary; compare implementation to the approved frame when one exists.
- **Frontend Design:** derive a distinctive spatial or typographic choice from the subject, not from a preset look.
- **Taste:** choose a medium that lets the visitor use the real material; study a structural alternative when it helps resolve a choice.
- **Awwwards:** connect creative scenes so the next frame changes what the visitor sees, knows, or can do. A state change can be the next scene; scroll effects aren't required.
- **Apple Design:** match feedback to input, and cover release, interruption, recovery, keyboard parity, and reduced motion as applicable. Read [Interaction](references/interaction.md) for the affected controls.
- **Unslop:** remove observable copy or hierarchy defects, not every repeated shape or phrase. Keep essential labels, facts, and authored language. For RTL layouts read [RTL](references/rtl.md) before setting alignment and directional behavior.

Use the [finish check](references/finish-check.md) for every route. Inspect the actual frames and exercise the visitor's task where the browser is available. If it isn't, say which frames, states, and behaviors remain unobserved. Never invent commercial facts, endorsements, addresses, or a successful transaction to complete a layout.

Credits and changes: `ATTRIBUTION.md` in the distribution. The included visual diagnostics and RTL catalog are by [Damir Sokolovsky](https://github.com/heydamir/unslop), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
