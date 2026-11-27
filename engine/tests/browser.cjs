const assert = require('node:assert/strict');
const { execFile } = require('node:child_process');
const { mkdtemp, readFile, rm, writeFile, appendFile, copyFile } = require('node:fs/promises');
const { createServer } = require('node:http');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const repo = path.resolve(__dirname, '../..');
const bin = process.env.UF_BIN || path.join(repo, 'engine/target/debug/uf');
const adapter = path.join(repo, 'adapters/browser/capture.cjs');
const fixture = `<!doctype html><html><meta charset="utf-8"><title>Preferences</title>
<style>body{margin:0;background:#18493c;color:white}button{margin:24px;padding:12px}button:focus-visible{outline:3px solid #fce46a}</style>
<button onclick="this.textContent='Saved'">Save preferences</button></html>`;
const target = (name) => ({ role: 'button', name });

function run(root, args, browserAdapter = adapter) {
  return new Promise((resolve, reject) => {
    execFile(bin, ['--root', root, ...args], {
      env: { ...process.env, UF_BROWSER_ADAPTER: browserAdapter }, timeout: 30000, maxBuffer: 1024 * 1024,
    }, (err, stdout, stderr) => {
      if (err && ![2, 3].includes(err.code)) return reject(new Error(`${err.message}\n${stderr}`));
      try { resolve({ code: err?.code ?? 0, report: JSON.parse(stdout) }); }
      catch (error) { reject(error); }
    });
  });
}

test('a later adapter error preserves a completed failing scenario', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'uf-partial-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const mock = path.join(root, 'adapter.cjs');
  await writeFile(mock, `const { scenarios } = JSON.parse(require('node:fs').readFileSync(0));
    if (scenarios.some(s => s.id === 'second')) process.exit(1);
    console.log(JSON.stringify({scenarios:[{id:'first', status:'fail', stepsCompleted:0, error:'wrong focus', captures:[]}]}));`);
  await writeFile(path.join(root, 'contract.json'), JSON.stringify({version:1, surface:'partial', kind:'product', intent:'refine', visitor:'Member', outcome:'Save', inputs:['adapter.cjs'],
    scenarios:['first','second'].map(id => ({id, path:'/', width:375, height:720, state:'Save', steps:[{op:'capture', id:'saved'}]}))}));
  const {code, report} = await run(root, ['verify', 'contract.json', '--url', 'http://127.0.0.1'], mock);
  assert.equal(code, 2);
  assert.deepEqual(report.scenarios.map(s => s.status), ['fail','unavailable']);
  assert.equal(report.scenarios[0].error, 'wrong focus');
});

test('uf checks rendered keyboard behavior, approved regions and evidence freshness', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'uf-browser-'));
  const source = path.join(root, 'index.html');
  const contractPath = path.join(root, 'surface.json');
  const reference = path.join(root, 'reference.png');
  const server = createServer(async (_req, res) => {
    try { res.writeHead(200, { 'Content-Type': 'text/html' }).end(await readFile(source)); }
    catch { res.end(); }
  });
  try {
    await writeFile(source, fixture);
    await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
    const args = ['verify', 'surface.json', '--url', `http://127.0.0.1:${server.address().port}`];
    const contract = {
      version: 1, surface: 'preferences', intent: 'refine', kind: 'product',
      visitor: 'Member', outcome: 'Save preferences with keyboard', inputs: ['index.html'],
      scenarios: [{ id: 'phone', state: 'After saving', path: '/', width: 375, height: 700, reducedMotion: true,
        steps: [{ op: 'press', key: 'Tab' }, { op: 'focused', target: target('Save preferences') },
          { op: 'press', key: 'Enter', focused: target('Saved') },
          { op: 'visible', target: target('Saved') }, { op: 'capture', id: 'saved' }] }],
    };
    const save = () => writeFile(contractPath, JSON.stringify(contract));
    await save();
    const initial = await run(root, args);
    assert.equal(initial.code, 0, JSON.stringify(initial.report));
    assert.equal(initial.report.scenarios[0].stepsCompleted, 5);
    const [png] = Object.keys(initial.report.artifacts);
    assert.ok(png.endsWith('phone-saved.png'));
    await copyFile(png, reference);
    assert.equal((await run(root, ['report', 'surface.json'])).code, 0);
    await appendFile(png, 'corrupted');
    assert.equal((await run(root, ['report', 'surface.json'])).code, 3);

    contract.approved = { frames: [{ reference: 'reference.png', scenario: 'phone', capture: 'saved', regions: [
      { id: 'lower-canvas', x: 120, y: 200, width: 160, height: 100, maxMeanDelta: 0 },
    ] }] };
    await save();
    const match = await run(root, args);
    assert.equal(match.code, 0, JSON.stringify(match.report));
    assert.equal(match.report.findings.find(f => f.id === 'impeccable.approved-region').meanDelta, 0);
    await writeFile(source, fixture.replace('#18493c', '#990011'));
    assert.equal((await run(root, ['report', 'surface.json'])).code, 3);
    const diff = await run(root, args);
    assert.equal(diff.code, 2, JSON.stringify(diff.report));
    const region = diff.report.findings.find(f => f.id === 'impeccable.approved-region');
    assert.ok(region.meanDelta > 0 && region.blocking);

    await writeFile(source, fixture.replace('<button ', '<button tabindex="-1" '));
    delete contract.approved;
    await save();
    const focus = await run(root, args);
    assert.equal(focus.code, 2, JSON.stringify(focus.report));
    assert.equal(focus.report.scenarios[0].status, 'fail');
    assert.equal(focus.report.scenarios[0].stepsCompleted, 1);

    await writeFile(source, fixture);
    contract.kind = 'creative';
    contract.intent = 'build';
    contract.scenarios = [375, 1280].map(width => ({ id: `view-${width}`, width, height: 700, path: '/', state: 'Inspect the print', steps: [
      {op:'capture', id:'opening'}, {op:'capture', id:'next'}, {op:'click', target:target('Save preferences')}, {op:'capture', id:'extra'},
    ] }));
    contract.direction = {composition:'Print first', narrow:'One print', materials:[{source:'index.html',role:'Print',provenance:'Fixture'}],
      scenes:contract.scenarios.flatMap(s => ['opening','next','extra'].map(id => ({scenario:s.id, capture:id, change:id}))) };
    await save();
    const unchanged = await run(root, args);
    assert.equal(unchanged.code, 2, JSON.stringify(unchanged.report));
    assert.equal(unchanged.report.findings.filter(f => f.id === 'awwwards.distinct-scenes' && f.status === 'fail').length, 2);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
