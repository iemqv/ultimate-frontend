# Browser checkpoints

`check.cjs` is a CommonJS adapter for a caller-owned Playwright `Page`. Load it from the candidate root and pass the page and the URL of the page under test:

```js
const check = require('./tools/browser/check.cjs');

const results = await check(page, {
  version: 1,
  checkpoints: [{
    name: 'Queue keyboard behavior on mobile',
    width: 360,
    height: 640,
    steps: [
      { op: 'click', role: 'button', name: 'Open queue' },
      { op: 'visible', role: 'dialog', name: 'Queue' },
      { op: 'press', role: 'button', name: 'Close queue', key: 'Escape' },
      { op: 'focused', role: 'button', name: 'Open queue' },
    ],
  }],
}, baseURL);

for (const result of results) {
  if (!result.passed) console.error(`${result.name}: ${result.error}`);
}
```

- Each checkpoint sets the viewport (positive integer width and height in CSS pixels) and navigates to the same absolute `http:`, `https:`, `file:`, or `data:` URL. The adapter leaves the page open at the final state. It does not clear cookies, storage, or other browser context state. The host controls browser lifecycle, timeouts, and routing, including redirects and resources loaded by the candidate.
- Every step requires exactly one Playwright role match, with a case-sensitive, exact accessible name after Playwright's whitespace normalization. `click` uses Playwright's normal actionability checks. `visible`, `focused`, and match counts are immediate observations; the adapter does not wait for app-specific transitions. `press` checks that the target already has focus and sends a Playwright keyboard key (such as `Escape` or `Shift+Tab`) without moving focus first. To test the resulting focus, add a separate `focused` step.
- Horizontal document overflow is checked after navigation and after each step. Vertical scrolling is allowed. An empty `steps` array checks navigation and overflow only. These checks do not detect clipping or overflow inside individual elements.
- The first error stops that checkpoint, not the run. Results are in input order: `{ name, passed: true }` or `{ name, passed: false, error }`. An invalid checkpoint without a valid name uses `Checkpoint N`. A malformed top-level contract or base URL rejects the call. The contract cannot supply navigation URLs or JavaScript.

## Local tests

Use locally available `playwright` and Chromium to run `node --test check.test.cjs` from this directory. If Chromium is installed outside Playwright's expected cache, set `CHROMIUM_EXECUTABLE_PATH` to its executable. The tests own their browser and use inline `data:` fixtures without a server or external resources. They include two Escape regressions: missing focus transfer on open and missing focus restoration on close.
