'use strict';

const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { chromium } = require('playwright');
const check = require('./check.cjs');

let browser;
let page;
before(async () => {
  const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
  page = await browser.newPage({ viewport: { width: 640, height: 480 } });
});
after(() => browser?.close());

const dataURL = html => `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>${html}`)}`;
const fixture = ({ restoreFocus = true, focusClose = true } = {}) => dataURL(`
  <title>Browser check fixture</title>
  <style>
    @media (max-width: 400px) { #desktop { display: none; } }
    #oversized { width: 500px; }
  </style>
  <button id="open">Open queue</button>
  <button>Open queue history</button>
  <div id="queue" role="dialog" aria-label="Queue" hidden>
    <button id="close">Close queue</button>
  </div>
  <h1 id="desktop">Desktop layout</h1>
  <button>Duplicate</button><button>Duplicate</button>
  <button id="expand">Expand content</button>
  <div id="oversized" hidden>Wide content</div>
  <script>
    const open = document.getElementById('open');
    const close = document.getElementById('close');
    const queue = document.getElementById('queue');
    open.onclick = () => { queue.hidden = false; ${focusClose ? 'close.focus();' : ''} };
    close.onkeydown = event => {
      if (event.key === 'Escape') { queue.hidden = true; ${restoreFocus ? 'open.focus();' : ''} }
    };
    document.getElementById('expand').onclick = () => { document.getElementById('oversized').hidden = false; };
  </script>
`);
const step = (op, name, role = 'button') => ({ op, role, name });
const checkpoint = (name, steps, width = 640) => ({ name, width, height: 480, steps });
const contract = (...checkpoints) => ({ version: 1, checkpoints });
const clickOpen = step('click', 'Open queue');
const pressEscape = { ...step('press', 'Close queue'), key: 'Escape' };
const closeAndRestore = [clickOpen, step('visible', 'Queue', 'dialog'), pressEscape, step('focused', 'Open queue')];

test('click and Escape use exact accessible names and restore focus on desktop and mobile', async () => {
  assert.deepEqual(await check(page, contract(
    checkpoint('desktop', [step('visible', 'Desktop layout', 'heading'), ...closeAndRestore]),
    checkpoint('mobile', closeAndRestore, 360),
  ), fixture()), [{ name: 'desktop', passed: true }, { name: 'mobile', passed: true }]);
});

test('reports broken Escape focus restoration and never focuses the press target for the page', async () => {
  const [notRestored] = await check(page, contract(checkpoint('restore focus', closeAndRestore)),
    fixture({ restoreFocus: false }));
  assert.equal(notRestored.passed, false);
  assert.match(notRestored.error, /Step 4 \(focused\): Target is not focused/);

  const [notFocused] = await check(page, contract(checkpoint('press from current focus', [clickOpen, pressEscape])),
    fixture({ focusClose: false }));
  assert.equal(notFocused.passed, false);
  assert.match(notFocused.error, /Step 2 \(press\): Target is not focused/);
});

test('reports exact-name misses and ambiguous matches, then reloads for the next checkpoint', async () => {
  const [ambiguous, partial, missing, next] = await check(page, contract(
    checkpoint('ambiguous', [clickOpen, step('click', 'Duplicate')]),
    checkpoint('partial', [step('visible', 'Open')]),
    checkpoint('missing on mobile', [step('visible', 'Desktop layout', 'heading')], 360),
    checkpoint('reset', [step('visible', 'Open queue')]),
  ), fixture());
  assert.equal(ambiguous.passed, false);
  assert.match(ambiguous.error, /found 2/);
  assert.equal(partial.passed, false);
  assert.match(partial.error, /found 0/);
  assert.equal(missing.passed, false);
  assert.match(missing.error, /found 0/);
  assert.deepEqual(next, { name: 'reset', passed: true });
  assert.equal(await page.getByRole('dialog').count(), 0);
});

test('fragment URLs get a fresh document even when checkpoints use the same URL', async () => {
  const results = await check(page, contract(
    checkpoint('open', [clickOpen, step('visible', 'Queue', 'dialog')]),
    checkpoint('closed on load', [step('visible', 'Open queue')]),
  ), `${fixture()}#open`);
  assert.deepEqual(results, [{ name: 'open', passed: true }, { name: 'closed on load', passed: true }]);
  assert.equal(await page.getByRole('dialog').count(), 0);
});

test('reports horizontal overflow at navigation and after interaction without failing vertical scroll', async () => {
  const [initial] = await check(page, contract(checkpoint('initial', [], 360)),
    dataURL('<div style="width:500px">Wide content</div>'));
  assert.equal(initial.passed, false);
  assert.match(initial.error, /Horizontal overflow: .* > 360px/);

  const [afterClick, reset] = await check(page, contract(
    checkpoint('after click', [step('click', 'Expand content')], 360),
    checkpoint('reset', [], 360),
  ), fixture());
  assert.equal(afterClick.passed, false);
  assert.match(afterClick.error, /Step 1 \(click\): Horizontal overflow/);
  assert.deepEqual(reset, { name: 'reset', passed: true });
  assert.deepEqual(await check(page, contract(checkpoint('vertical', [], 360)),
    dataURL('<div style="height:2000px">Long content</div>')), [{ name: 'vertical', passed: true }]);
});

test('rejects invalid top-level input; malformed checkpoints fail without skipping valid ones', async () => {
  await assert.rejects(check(page, { version: 2, checkpoints: [] }, fixture()), /version 1/);
  await assert.rejects(check(page, contract(), fixture()), /at least one checkpoint/);
  const valid = checkpoint('valid', [step('visible', 'Open queue')]);
  await assert.rejects(check(page, contract(valid), 'javascript:void(0)'), /baseURL/);
  const [invalidViewport, invalidStep, invalidKey, next] = await check(page, contract(
    checkpoint('bad width', [], 0),
    checkpoint('bad step', [{ ...step('click', 'Open queue'), url: fixture() }]),
    checkpoint('bad key', [{ ...pressEscape, key: '' }]),
    valid,
  ), fixture());
  assert.equal(invalidViewport.passed, false);
  assert.match(invalidViewport.error, /positive integer width/);
  for (const invalid of [invalidStep, invalidKey]) {
    assert.equal(invalid.passed, false);
    assert.match(invalid.error, /Invalid step 1/);
  }
  assert.deepEqual(next, { name: 'valid', passed: true });
});
