# Frontend comparison protocols

For the **agent workshop** (file editing, private browser, natural skill discovery and repeated runs), see the [workshop design and evaluation contract](workshop/DESIGN.md). Do not pool its results with the one-shot experiment below: the model has different capabilities.

## Isolated, one-shot comparison

Run two paired briefs on new subjects: Turn Twice (mechanical puzzles) and Low Lantern (observing-site planner). Each pair gets byte-identical user input, the same `openai/gpt-6.2-sol` model and medium reasoning. Hold the briefs fixed when comparing later revisions of this protocol. Earlier rounds used tools and different subjects: they are not direct measurements of a version change.

```sh
PI_EVAL_AUTH="$HOME/.pi/agent-eval/auth.json" bash eval/run.sh /absolute/path/to/new-output
python3 eval/verify.py /absolute/path/to/new-output
```

Requires Linux with merged `/usr`, bubblewrap, Python 3, GNU coreutils, Pi's npm distribution and a dedicated OpenAI Pi login. Uses four paid model calls. The trusted host refreshes the dedicated credential before the runs. Do not publish the output directory or stderr.

## Isolation contract

- Four concurrent Pi processes. Each starts in its own empty `/work`, with private home and temporary directories. No output directory is mounted; even a later arm cannot discover a previous page there. No prior sessions, project context, automatically loaded skills, extensions, MCP servers or agent tools. Only the trusted Pi transport has provider network access. Model-generated text cannot run shell commands, browse, read credentials or open files. This is a capability restriction, not an instruction to behave.
- The common system text specifies the output format only. For the treatment, the trusted launcher appends the frozen skill and references in full. It does not give the model extra tools. This tests the effect of the instructions on a single response, not autonomous skill discovery, tool use or the skill's browser correction pass. A shared model or provider can still produce similar answers. Provider-internal isolation is not independently observable.
- The host extracts one complete HTML document and writes it to a fixed filename. It does not execute the answer during generation. The collector rejects tool activity and incomplete replies. The verifier checks the exact system sections, empty tool list, user message, model, completion and artifact digest. Source pages are never repaired before comparison. A failed arm stays failed.
- Only preview completed outputs. Treat generated HTML as untrusted; keep private files out of the web root. Use sandboxed frames, block network resources and form submissions, and capture all pages at matching sizes. Preserve descriptions of failed actions as well as successful ones.

## Blind tasks

At Turn Twice, find one puzzle and explore the action offered. At Low Lantern, choose a step-free site for a 90-minute visit, compare two options, select one and clear the summary. Compare at desktop and phone widths before revealing labels. Distinguish visual preference from what the visitor can do. One sample per condition does not establish a win rate.
