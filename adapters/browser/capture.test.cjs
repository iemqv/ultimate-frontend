const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile, readdir, rm, writeFile } = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');

const adapter = path.join(__dirname, 'capture.cjs');
const target = (role, name) => ({ role, name });
const button = (name) => target('button', name);
const capture = (id) => ({ op: 'capture', id });
const scenario = (id, steps, pathname = '/') => ({
  id, path: pathname, width: 480, height: 320, state: id, reducedMotion: true, steps,
});

async function invoke(input, env = {}) {
  const child = spawn(process.execPath, [adapter], {
    env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'], timeout: 45000,
  });
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
  child.stdin.end(JSON.stringify(input));
  const [code, signal] = await once(child, 'close');
  assert.equal(code, 0, `${signal || ''} ${stderr}`);
  return JSON.parse(stdout);
}

async function localServer(t, handler, onUpgrade = () => {}) {
  const server = http.createServer(handler);
  server.on('upgrade', (request, socket) => { onUpgrade(request); socket.destroy(); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

async function directory(t) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'uf-capture-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

const document = (body) => `<!doctype html><meta charset="utf-8">${body}`;
function html(res, body) {
  res.setHeader('Content-Type', 'text/html');
  res.end(document(body));
}

test('rejects non-loopback, credentials, aliases, and non-origin base URLs before loading Playwright', async () => {
  for (const baseUrl of ['https://localhost', 'http://example.com', 'http://127.1', 'http://localhost.evil.test', 'http://localhost@127.0.0.1', 'http://localhost/path']) {
    const spec = scenario('preview', [capture('opening')]);
    const response = await invoke({ baseUrl, outputDir: '/unused', scenarios: [spec] });
    assert.deepEqual(response, { scenarios: [{
      id: 'preview', status: 'unavailable', stepsCompleted: 0,
      error: 'Expected an explicit loopback HTTP origin', captures: [],
    }] });
  }
});

test('reports unavailable browser capability using the exact observation envelope', async () => {
  const response = await invoke({ baseUrl: 'http://127.0.0.1:1', outputDir: '/unused', scenarios: [scenario('preview', [])] }, {
    UF_PLAYWRIGHT_CORE: path.join(os.tmpdir(), 'missing-uf-playwright', 'package'),
  });
  assert.deepEqual(Object.keys(response), ['scenarios']);
  const [observation] = response.scenarios;
  assert.match(observation.error, /Cannot find module/);
  assert.deepEqual(observation, {
    id: 'preview', status: 'unavailable', stepsCompleted: 0, error: observation.error, captures: [],
  });
});

test('reports browser launch failure as unavailable', async (t) => {
  const outputDir = await directory(t);
  const { scenarios: [observation] } = await invoke({
    baseUrl: 'http://localhost:1', outputDir, scenarios: [scenario('preview', [capture('opening')])],
  }, { UF_CHROMIUM: path.join(outputDir, 'missing-chromium') });
  assert.equal(observation.status, 'unavailable');
  assert.equal(observation.stepsCompleted, 0);
  assert.match(observation.error, /missing-chromium/);
  assert.deepEqual(await readdir(outputDir), []);
});

test('captures real viewport evidence and drives actions, keyboard, pointer and isolated state', async (t) => {
  const outputDir = await directory(t);
  const baseUrl = await localServer(t, (req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { Location: '/' });
      res.end();
    } else if (req.url === '/missing') {
      res.writeHead(404).end();
    } else {
      html(res, `
        <style>
          body { margin: 0; }
          #cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          article { min-height: 64px; }
          #clip { height: 18px; overflow: hidden; }
          #drag { touch-action: none; }
          #wide { width: 650px; }
        </style>
        <button id="start" aria-label="Start">Start</button><button hidden aria-label="Start">Start</button><button>Start over</button>
        <label>Message <input></label><button id="drag">Drag</button>
        <p role="status" aria-label="Result">Initial</p>
        <p hidden>Invisible text</p><p style="opacity: 0">Transparent text</p>
        <div id="clip">Inside clip<br>Clipped away</div>
        <section id="cards">
          <article><h2>Alpha</h2></article><article><h2>Beta</h2></article><article><h2>Gamma</h2></article>
        </section>
        <div style="height: 430px" id="wide"></div><p>Far below the opening</p>
        <script>
          const status = document.querySelector('[role=status]');
          status.textContent = localStorage.state || 'Initial';
          start.onclick = () => { localStorage.state = status.textContent = 'Started'; start.hidden = true; };
          document.querySelector('input').oninput = (event) => status.textContent = event.target.value;
          let down = false, moved = false;
          drag.onpointerdown = (event) => { down = true; drag.setPointerCapture(event.pointerId); };
          drag.onpointermove = () => { if (down) moved = true; };
          drag.onpointerup = () => { if (moved) status.textContent = 'Dragged'; };
          document.body.dataset.motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
          document.body.insertAdjacentHTML('afterbegin', '<p role="note">Reduced: ' + document.body.dataset.motion + '</p>');
        </script>`);
    }
  });
  const result = target('status', 'Result');
  const text = (equals, target = result) => ({ op: 'text', target, equals });
  const specs = [
    scenario('interaction', [
      text('Reduced: true', target('note', '')), { op: 'visible', target: button('Start') }, capture('opening'),
      { op: 'press', key: 'Tab', focused: button('Start') }, { op: 'focused', target: button('Start') },
      { op: 'click', target: button('Start') }, { op: 'hidden', target: button('Start') }, text('Started'),
      { op: 'fill', target: target('textbox', 'Message'), value: 'Typed' }, text('Typed'),
      { op: 'pointer-down', target: button('Drag') }, { op: 'pointer-move', x: 320, y: 100 },
      { op: 'pointer-up' }, text('Dragged'), { op: 'scroll', y: 2000 }, capture('end'),
    ], '/redirect'),
    scenario('fresh', [text('Initial')]),
    scenario('still-visible', [{ op: 'hidden', target: button('Start') }]),
    scenario('keyboard-fail', [{ op: 'press', key: 'Tab', focused: button('Start over') }]),
    scenario('text-fail', [capture('before'), text('Not the displayed value'), capture('after')]),
    scenario('navigation-fail', [capture('missing')], '/missing'),
  ];
  const { scenarios: observations } = await invoke({ baseUrl, outputDir, scenarios: specs });
  assert.deepEqual(observations.map((obs) => [obs.id, obs.status, obs.stepsCompleted]), [
    ['interaction', 'pass', 16], ['fresh', 'pass', 1], ['still-visible', 'fail', 0], ['keyboard-fail', 'fail', 0],
    ['text-fail', 'fail', 1], ['navigation-fail', 'unavailable', 0],
  ], JSON.stringify(observations));
  const [opening, end] = observations[0].captures;
  assert.deepEqual(Object.keys(opening).sort(), ['id', 'width', 'height', 'horizontalOverflow', 'lines', 'peerGroups', 'scrollY', 'scrollRange'].sort());
  assert.equal(opening.id, 'opening');
  assert.equal(opening.width, 480);
  assert.equal(opening.height, 320);
  assert.equal(opening.horizontalOverflow, true);
  assert.deepEqual(opening.peerGroups, [['Alpha', 'Beta', 'Gamma']]);
  assert.ok(opening.lines.includes('Inside clip'), JSON.stringify(opening.lines));
  for (const invisible of ['Invisible text', 'Transparent text', 'Clipped away', 'Far below the opening']) {
    assert.ok(!opening.lines.join(' ').includes(invisible), JSON.stringify(opening.lines));
  }
  assert.equal(opening.scrollY, 0);
  assert.ok(end.scrollRange > 0);
  assert.equal(end.scrollY, end.scrollRange);
  assert.ok(end.lines.includes('Far below the opening'));
  assert.equal(observations[0].error, null);
  assert.deepEqual((await readdir(outputDir)).sort(), ['interaction-end.png', 'interaction-opening.png', 'text-fail-before.png']);
  const png = await readFile(path.join(outputDir, 'interaction-opening.png'));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), 480);
  assert.equal(png.readUInt32BE(20), 320);
});

test('navigation after a click must reach a successful document', async t => {
  const outputDir = await directory(t);
  const baseUrl = await localServer(t, (req, res) => {
    if (req.url === '/') return html(res, '<a href="/good">Available</a><a href="/bad">Missing</a>');
    res.statusCode = req.url === '/good' ? 200 : 404;
    html(res, '<p>Destination</p>');
  });
  const specs = ['Available', 'Missing'].map(name => scenario(name.toLowerCase(), [
    { op: 'click', target: target('link', name) }, capture('destination'),
  ]));
  const { scenarios: [good, bad] } = await invoke({ baseUrl, outputDir, scenarios: specs });
  assert.equal(good.status, 'pass', good.error);
  assert.notEqual(bad.status, 'pass');
  assert.match(bad.error, /HTTP 404/);
  assert.deepEqual(bad.captures, []);
});

test('network guard blocks redirected origins, writes, sockets, workers, and popup egress', async (t) => {
  const outputDir = await directory(t);
  const escaped = [];
  const external = await localServer(t, (req, res) => { escaped.push(req.url); res.end('unexpected'); }, (req) => escaped.push(req.url));
  const seen = [];
  const baseUrl = await localServer(t, (req, res) => {
    seen.push([req.method, req.url]);
    if (req.url === '/redirect') return res.writeHead(302, { Location: `${external}/redirected` }).end();
    if (req.url === '/script') return res.end('allowed');
    html(res, `
      <button>Run checks</button><p role="status" aria-label="Guard">Pending</p>
      <script>
        const run = async () => {
          const want = ${JSON.stringify(external)};
          const blocked = (url, init) => fetch(url, init).then(() => false, () => true);
          const socketBlocked = (url) => new Promise((resolve) => {
            const socket = new WebSocket(url.replace(/^http:/, 'ws:'));
            socket.addEventListener('close', () => resolve(true));
            socket.addEventListener('error', () => resolve(true));
            socket.addEventListener('open', () => { socket.close(); resolve(false); });
          });
          window.open(want + '/popup', '_blank');
          window.open('/redirect', '_blank');
          const results = await Promise.all([
            fetch('/script').then((response) => response.text()).then((value) => value === 'allowed'),
            blocked(want + '/direct'), blocked('/redirect'),
            blocked('/write', { method: 'POST', body: 'write' }),
            blocked('/delete', { method: 'DELETE' }),
            navigator.serviceWorker.register('/sw.js').catch(() => null).then(async () =>
              !navigator.serviceWorker.controller && !await navigator.serviceWorker.getRegistration()),
            socketBlocked(want + '/socket'), socketBlocked(location.origin + '/socket'),
          ]);
          const status = document.querySelector('[role=status]');
          status.textContent = results.every(Boolean) ? 'Blocked' : JSON.stringify(results);
          status.setAttribute('aria-label', 'Guard settled');
        };
        document.querySelector('button').onclick = run;
      </script>`);
  }, (req) => seen.push(['UPGRADE', req.url]));
  const settled = target('status', 'Guard settled');
  const { scenarios } = await invoke({ baseUrl, outputDir, scenarios: [
    scenario('guarded', [
      { op: 'click', target: button('Run checks') }, { op: 'visible', target: settled },
      { op: 'text', target: settled, equals: 'Blocked' }, capture('guarded'),
    ]),
    scenario('blocked-navigation', [capture('off-origin')], '/redirect'),
    scenario('invalid-path', [], `//127.0.0.1:${new URL(external).port}/bad`),
  ] });
  assert.deepEqual(scenarios.map((obs) => obs.status), ['pass', 'unavailable', 'unavailable'], JSON.stringify(scenarios));
  assert.ok(seen.some(([method, url]) => method === 'GET' && url === '/script'));
  assert.ok(seen.some(([method, url]) => method === 'GET' && url === '/redirect'));
  assert.ok(seen.every(([method, url]) => method === 'GET' && !['/write', '/delete', '/sw.js', '/socket'].includes(url)), JSON.stringify(seen));
  assert.deepEqual(escaped, []);
});

test('capture IO failures are unavailable and do not count the capture step', async (t) => {
  const dir = await directory(t);
  const outputDir = path.join(dir, 'file');
  await writeFile(outputDir, 'not a directory');
  const baseUrl = await localServer(t, (_req, res) => html(res, '<h1>Fixture</h1>'));
  const { scenarios: [obs] } = await invoke({ baseUrl: baseUrl.replace('127.0.0.1', 'localhost'), outputDir, scenarios: [scenario('capture-error', [
    { op: 'visible', target: target('heading', 'Fixture') }, capture('failure'),
  ])] });
  assert.equal(obs.status, 'unavailable');
  assert.equal(obs.stepsCompleted, 1);
  assert.match(obs.error, /^capture:/);
  assert.deepEqual(obs.captures, []);
});
