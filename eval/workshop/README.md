# Tool-enabled workshop

The [experiment contract](DESIGN.md) separates what a model does in a browser from what a visitor can do on the finished page. The [ballot](BALLOT.md) separates task completion from visual preference. Neither the workshop nor its experimental candidates are installed with the skill.

## Review the November 24 local experiment

| Round | Blind gallery on this machine | Sites | What it tests |
| --- | --- | ---: | --- |
| Development | <http://127.0.0.1:41771/> | 12 | Control and 0.3.0, twice per brief, including control/control comparisons |
| Held out | <http://127.0.0.1:41772/> | 9 | Control, frozen 0.3.0 and the visible-compositions candidate on three new briefs |

Use the interactive preview for actions and the desktop and phone screenshots to compare layouts at equal widths. Save one visual and one task judgment per pair. Use **Not observed** for missing evidence. Export the two ballots before revealing groups. Both galleries and their data are local; there is no public deployment.

## Reproduce the protocol

Run from this directory on Linux with the Pi SDK and bubblewrap. Set `UF_PLAYWRIGHT_CORE` to the installed `playwright-core` directory and `UF_CHROMIUM` to the `chrome-headless-shell` executable in a standalone Chromium distribution. The runner mounts these two runtime directories read-only for preview; use dedicated distributions, not project or home directories. Set `PI_EVAL_AUTH` to a separate local Pi evaluation profile, never your everyday credentials. Do not publish a round output directory. The unit tests below are offline. Each `round.py` invocation runs a free transport preflight and then uses live inference. A new development round freezes the skill in the current checkout, not the historical 0.3.0 version; the holdout uses the supplied pilot baseline.

```sh
python3 -B -m unittest test_round test_verify_inputs
python3 -B round.py /absolute/new-pilot
python3 -B round.py /absolute/new-holdout --pilot /absolute/new-pilot --candidate "$PWD/candidates/visible-compositions"
```

For each completed round, run `python3 verify_inputs.py ROOT` and `python3 evidence.py ROOT`. Both report incomplete deliveries as failures; do not replace those runs. To view the results, start `python3 gallery/gallery.py ROOT PORT`, then run `node gallery/capture.cjs ROOT PORT` in another terminal. See [gallery instructions](gallery/README.md). Gallery viewport screenshots are independent of the runner's full-page captures. The model's preview calls are not proof that it noticed or acted on a particular detail.

The experimental candidate differs from the frozen skill only in `references/composition.md`. It asks the agent to render two arrangements together **before** building a new showcase, then remove the sheet. It does not ask for alternatives on an operational tool. Only the human ballots can establish a preference for the resulting pages.
