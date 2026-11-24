# Holdout / Operate — Night Signal Radio

Evaluator-only. Give each arm the same `prompt.txt` bytes and a fresh copy of `site/`; do not give it this test. Evaluate the resulting site, not this starter. Serve the result over local HTTP, allowing the local origin only for required resources. Use 1280 × 800 and 390 × 844 CSS-pixel viewports. Record pass/fail and an observation for each check.

## Browser checks

1. On a fresh load, compare the five clips and durations with `site/clips.json`. Nothing is selected; the total is zero and 7:00 remains. Accept equivalent minutes-and-seconds notation and any clip order.
2. Starting at the page, use only the keyboard. Tab or Shift+Tab to controls and operate them with the keys appropriate for their type. Add Night Bus Changes (total 3:00, 4:00 left), River Gauge Report (total 5:25, 1:35 left) and Lost and Found Desk (total 7:00, no time left, exactly fits). A selected clip cannot contribute twice: if an add control still exists for a selected clip, attempting to add it again must not increase the total.
3. Add Station ID: expect total 7:40 and 0:40 over. Remove River Gauge Report: expect total 5:15 and 1:45 left with no overrun. Remove the remaining clips: expect zero total, 7:00 left and all clips available. No step needs a reload or pointer. Focus remains visible on controls and is not trapped or lost during updates.
4. At 390 × 844, repeat the exact-fit and overrun transitions. Clip controls and timing information must remain usable without horizontal page scrolling or internet access.

## Human check

Read as a producer about to go on air. Can you tell which clips are in the plan and distinguish time left, exact fit and overrun without inferring state from color alone? Record what the page communicates. Accept any control type, labeling or placement that supports the scenario.
