# Dev / Operate — Second Shelf Tool Library

Evaluator-only. Give each arm the same `prompt.txt` bytes and a fresh copy of `site/`; do not give it this test. Evaluate the resulting site, not this starter. Serve the result over local HTTP, allowing the local origin only for required resources. Use 1280 × 800 and 390 × 844 CSS-pixel viewports. Record pass/fail and an observation for each check.

## Browser checks

1. On a fresh load, compare the six visible windows with `site/pickup-windows.json`. Each row's day, time, pickup point and spots left match the source; zero is recognizable as full. Defaults are any day and full windows included. Time notation and result order may vary.
2. Starting at the page, use only the keyboard. Tab or Shift+Tab to controls and operate them with the keys appropriate for their type. Choose Tuesday: expect all three Tuesday windows and no others. Hide full windows: expect only Courtyard Gate (3 spots) and Workshop Desk (1 spot); the full Locker Wall window disappears.
3. With full windows still hidden, choose Saturday: expect no results and an explanation of the empty state. Include full windows again: the Saturday Locker Wall window (0 spots) reappears. Return to any day: all six windows reappear. No step needs a reload or pointer. Focus remains visible on controls and is not trapped or lost during updates.
4. At 390 × 844, repeat the Tuesday filter and Saturday empty-state recovery. Results and controls must remain usable without horizontal page scrolling or internet access.

## Human check

Read as a borrower. In the empty state, is it clear that the current filters found no matches, rather than the schedule failing to load? Can you see how to recover? Record what the page communicates. Accept any control type, labeling or placement that supports the scenario.
