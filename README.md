# Ultimate Frontend

A skill for coding agents that build and review web interfaces. Ask for a printmaker’s portfolio and it starts with a print worth looking at. Ask to fix keyboard navigation in a settings panel and it leaves the rest of the panel alone.

## Install in a project

Run the installer **from the project where you want the skill**, then reload your agent. It copies Markdown instructions, references and license notices. It does not edit agent settings, call a model or install browser tooling. Requires Node.js 20 or later.

Install the [npm package](https://www.npmjs.com/package/ultimate-frontend) for your agent. For Claude Code:

```sh
npx ultimate-frontend@0.6.0 install --agent claude
```

| Agent | `--agent` | Skill directory in your project |
| --- | --- | --- |
| Codex (default) | `codex` | `.agents/skills/ultimate-frontend/` |
| Claude Code | `claude` | `.claude/skills/ultimate-frontend/` |
| Cursor | `cursor` | `.cursor/skills/ultimate-frontend/` |
| GitHub Copilot | `copilot` | `.github/skills/ultimate-frontend/` |
| Gemini CLI | `gemini` | `.gemini/skills/ultimate-frontend/` |
| OpenCode | `opencode` | `.opencode/skills/ultimate-frontend/` |
| Pi | `pi` | `.pi/skills/ultimate-frontend/` |

Repeat the command for another agent. An identical install is a no-op. If the destination differs, the installer stops: move the old copy aside before upgrading. To uninstall, remove just the skill directory in the table.

## Give the agent a task

Use the skill by name in a normal request. In Pi you can also type `/skill:ultimate-frontend`.

| Try this | Expected scope |
| --- | --- |
| “Build a portfolio for a woodcut artist. Visitors should be able to inspect the prints.” | Choose a composition around the work. Build the opening and what happens when a visitor selects a print, at phone and desktop widths. |
| “Make this reorderable list work without a mouse.” | Preserve its layout. Check pickup, placement, focus and cancellation with the keyboard. |
| “Review checkout against this approved mockup. Don’t change code.” | Inspect the specified states and report observed differences. The approved comp outranks stylistic suggestions. |

**One example, not a benchmark:** in the [print workshop comparison](https://github.com/iemqv/ultimate-frontend/blob/main/comparison/current/RESULTS.md), the control produced a scrolling page; the 0.5.0 skill produced a browsable print with a texture view. The control was more useful for finding a class. The [saved screenshots](https://github.com/iemqv/ultimate-frontend/tree/main/comparison/current) are from that experiment, not the current release.

## Optional: verify a running interface

Your agent supplies the model and edits the application. The skill itself has no API endpoint. Without extra tools it can guide the implementation and report what remains unchecked. The checkout includes `uf`, a local Rust CLI for planning, recording project decisions and verifying declared browser scenarios. It is **not included** in the npm installer.

```sh
# From the ultimate-frontend checkout, before starting your agent:
cargo build --release --locked --manifest-path engine/Cargo.toml
export UF_BIN="$PWD/engine/target/release/uf"
export UF_BROWSER_ADAPTER="$PWD/adapters/browser/capture.cjs"
```

For browser checks, provide `playwright-core` and its Chromium browser. Set `UF_PLAYWRIGHT_CORE` to the absolute package directory if Node cannot resolve it, and `UF_CHROMIUM` to the executable if using a separate Chromium install. Start your app on an isolated loopback origin. Verification checks only the declared actions, states, regions and viewports. An unavailable browser is not a pass. See the [engine contract](https://github.com/iemqv/ultimate-frontend/blob/main/docs/engine-contract.md) for commands and exit codes.

## Check a contribution

- `npm test` checks the installer and an offline install from the actual tarball.
- `cargo test --locked --manifest-path engine/Cargo.toml` checks the CLI. With the binary built and browser configured as above, `node --test adapters/browser/capture.test.cjs engine/tests/browser.cjs` runs real Chromium fixtures.
- `python3 comparison/verify.py` and `python3 comparison/current/verify.py` check recorded evidence offline. They do not rerun the model or certify a new version’s design quality.

## Credits and licenses

Adapted from Anthropic’s frontend-design, Emil Kowalski’s apple-design, Leonxlnx’s Taste Skill, Paul Bakaus’s Impeccable and Damir Sokolovsky’s Unslop (CC BY 4.0). The page-sequencing method also draws on Awwwards. [Attribution](ATTRIBUTION.md) lists the source revisions, adaptations and individual license terms. The installer keeps those notices with each copy.
