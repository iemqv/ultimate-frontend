# Ultimate Frontend

**One skill for frontend direction, interaction, and browser verification.**

[Open the current two-site comparison](comparison/current/index.html) in a browser from a local checkout. Both sites started from the same one-line brief and an empty workspace. Compare desktop and phone renders, try both sites, then reveal which one used the skill.

Ultimate Frontend combines six approaches without loading six skills. Taste and Awwwards guide the choice of subject and how it develops down the page. Impeccable and frontend-design turn that idea into a rendered composition. Apple Design governs the controls; Unslop cuts stock layouts and unnecessary words before they become finished sections. For a short creative brief, build the experience the visitor came for and its next useful state before deciding whether the site needs more sections. Product tasks use a separate route, and approved comps stay authoritative.

## Use with Pi

From a local checkout:

```sh
pi --skill ./skills/ultimate-frontend
```

Describe the UI task in your own words, or invoke `/skill:ultimate-frontend` explicitly. To install the checkout as a persistent Pi package, run `pi install "$PWD"` from the repository root. If your Pi setup already loads the source skills, disable them for this project if you want a single frontend workflow.

For other agents that support `SKILL.md`, place the `skills/ultimate-frontend` directory in their skill directory. Keep its `references/` directory with it and retain the attribution and licenses when distributing copies. Pi is the reference integration; other runtimes are not verified here.

## What changes with the task

| Task | What the skill prioritizes |
| --- | --- |
| Design a product landing page | Compare two ideas drawn from the subject. Build the opening state and the next useful state. Inspect both at desktop and phone widths, and check the middle of any scrolling page. |
| Refine a drag-to-reorder list | Preserve the existing UI. Keep the row under the pointer, support interruption and keyboard reordering, and verify the result after a drop. |
| Critique an existing settings screen | Inspect the live screen and its states. Report observed obstacles and their impact without editing the code. |

Accessibility, project constraints, and the approved direction outrank stylistic suggestions. A dashboard doesn't inherit a landing page's need for visual drama. A gesture doesn't inherit a blanket prohibition on animation: motion is useful when it communicates state or preserves continuity.

## Evaluate a change

See the [one-brief protocol](comparison/PROTOCOL.md) for the live-agent experiment and [current results](comparison/current/RESULTS.md) for observations and limitations (contains spoilers). The [previous pair](comparison/index.html) and its [findings](comparison/RESULTS.md) are preserved. The `comparison/` directory holds frozen evidence, including the exact skill revision for each published pair. The `eval/` directory holds [earlier protocols and fixtures](eval/README.md); neither directory ships with the skill.

## Credits

Adapted from [Anthropic's frontend-design](https://github.com/anthropics/skills), [Emil Kowalski's apple-design](https://github.com/emilkowalski/skills), [Leonxlnx's Taste Skill](https://github.com/Leonxlnx/taste-skill), [Paul Bakaus's Impeccable](https://github.com/pbakaus/impeccable), and [Damir Sokolovsky's Unslop](https://github.com/heydamir/unslop) ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/), adapted). The page-sequencing method also draws on [Awwwards](https://github.com/juliobsz/skills). See [Attribution](ATTRIBUTION.md) for source identifiers, modifications and original terms.
