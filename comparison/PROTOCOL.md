# One brief, two sites

The question is whether loading Ultimate Frontend changes what a visitor sees and can do, not whether an agent can follow a more detailed art brief. Use the bytes of `prompt.txt` for both arms. Start each arm with an empty fixture. Do not supply assets, examples, site copy, a style, a stack, or section requirements. Do not edit the generated sites, select a weaker control, or tell one generator what the other built.

## Build under test

Evaluate changes under `skills/ultimate-frontend/`, not in the brief. The skill must work without access to the comparison, a particular brand, web search, or a paid image tool.

## Run and inspect

From the repository root, set `PI_EVAL_AUTH` to a dedicated Pi evaluation credential (never daily auth). Use the prerequisites in `eval/workshop/runner/arm.py`. With a new empty directory `$work/empty`, run:

```sh
python3 eval/workshop/runner/arm.py "$work/control" "$work/empty" comparison/prompt.txt -
python3 eval/workshop/runner/arm.py "$work/treatment" "$work/empty" comparison/prompt.txt skills/ultimate-frontend
```

The page author owns only the viewer; a separate integration step copies the original outputs. Screen both sites using the same isolated Chromium renderer at 1440 × 960 and 390 × 844, without scrolling or actions. The viewer uses viewport captures, not differently scaled full-page overviews. The original `run.json` stays unchanged even when its automatic full-page capture fails. To reproduce first viewports without using credentials, run `python3 -B comparison/capture.py comparison/a /tmp/uf-views-a` and repeat for `b` with a separate output directory. Each `views.json` binds the independently captured PNGs to the final site revision. Use a new, nonexistent capture destination outside both sites. `python3 comparison/verify.py` checks the published bytes, skill reads against the archived generation revision, and matched inputs. To replay a published treatment, unpack the corresponding archive and pass its `ultimate-frontend` directory to the runner. Use `comparison/current/revision/skill.tar.gz` for the [current pair](current/index.html) or `comparison/revision/skill.tar.gz` for the [previous pair](index.html). The current viewer also shows A at mid-scroll and B after selecting the next print. Run `python3 -B comparison/current/verify.py` to verify those views and the current pair. Inspect both at the same widths before reading labels. Look for (1) a composition that could not be transferred to another studio by changing its name, (2) material worth looking at rather than interface decorations, (3) a meaningful next action with feedback and a return path, and (4) absence of recurrent template and copy tells. A prettier palette is not sufficient. Separate observed defects from taste. Record the verdict and limitations; one pair cannot establish a win rate. Never repair either submission after generation.
