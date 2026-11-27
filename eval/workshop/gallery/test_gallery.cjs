const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { chromium } = require(process.env.UF_PLAYWRIGHT_CORE || 'playwright-core');
const executablePath = process.env.UF_CHROMIUM;

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: __dirname });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
}

async function start(root, port = '0') {
  const server = spawn('python3', ['gallery.py', root, port], { cwd: __dirname });
  try {
    const base = await new Promise((resolve, reject) => {
      server.stdout.once('data', data => resolve(data.toString().trim().replace('Gallery: ', '')));
      server.stderr.once('data', data => reject(new Error(data.toString())));
      server.once('error', reject);
      server.once('exit', code => reject(new Error(`Gallery exited ${code}`)));
    });
    return { server, base };
  } catch (error) {
    server.kill();
    throw error;
  }
}

async function stop(server) {
  if (server.exitCode === null) {
    const closed = once(server, 'exit');
    server.kill();
    await closed;
  }
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pilot-gallery-'));
  let server, browser;
  try {
    const runs = [
      { id: 'private-control-one', brief: 'Museum', group: 'control', repeat: 1 },
      { id: 'private-baseline', brief: 'Museum', group: 'baseline', repeat: 1 },
      { id: 'private-candidate', brief: 'Museum', group: 'candidate', repeat: 1 },
      { id: 'private-control-two', brief: 'Museum', group: 'control', repeat: 2 },
      { id: 'private-missing', brief: 'Other', group: 'baseline', repeat: 1 },
    ];
    await fs.writeFile(path.join(root, 'runs.json'), JSON.stringify(runs));
    const secret = path.join(root, 'outside.js');
    await fs.writeFile(secret, 'SECRET');
    for (const { id } of runs.slice(0, -1)) {
      const site = path.join(root, 'arms', id, 'site');
      await fs.mkdir(path.join(site, 'assets'), { recursive: true });
      await fs.symlink(secret, path.join(site, 'linked.js'));
      await fs.symlink(root, path.join(site, 'linked-dir'));
      await fs.writeFile(path.join(site, 'logs.js'), 'SECRET');
      await fs.writeFile(path.join(site, 'credentials.svg'), 'SECRET');
      await fs.writeFile(path.join(site, '.hidden.js'), 'SECRET');
      const broken = id === 'private-candidate';
      await fs.writeFile(path.join(site, 'index.html'), `<!doctype html><html><meta name="viewport" content="width=device-width, initial-scale=1">
        <link rel="stylesheet" href="assets/layout.css"><script type="module" src="assets/interaction.js"></script>
        ${broken ? '<div style="width:2000px">Overflow</div><script src="missing.js"></script><script>throw new Error("synthetic failure")</script>' : '<h1>Sample exhibit</h1>'}
        <button type="button">Toggle</button><output>Initial</output></html>`);
      await fs.writeFile(path.join(site, 'assets', 'layout.css'), 'html { background: rgb(1, 20, 40); }');
      await fs.writeFile(path.join(site, 'assets', 'interaction.js'), `document.querySelector('button').onclick = () => {
        let isolated = false;
        try { void parent.document.body; } catch { isolated = true; }
        document.querySelector('output').textContent = isolated ? 'Isolated' : 'Changed';
      };`);
    }
    let base;
    ({ server, base } = await start(root));
    const board = await (await fetch(`${base}/comparisons`)).json();
    const serialized = JSON.stringify(board);
    assert.equal(board.length, 4);
    assert.equal(new Set(board.flatMap(pair => pair.slots)).size, 8);
    assert.doesNotMatch(serialized, /private-|baseline|control|candidate|repeat|index\.html/);
    assert.doesNotMatch(await (await fetch(base)).text(), /private-|baseline|control–|candidate/);
    for (const route of ['/runs.json', '/arms/', '/.pilot-gallery/seed', '/_capture', '/reveal',
      `/p/${board[0].slots[0]}/index.html`, `/p/${board[0].slots[0]}/linked.js`,
      `/p/${board[0].slots[0]}/linked-dir/outside.js`, `/p/${board[0].slots[0]}/logs.js`,
      `/p/${board[0].slots[0]}/credentials.svg`, `/p/${board[0].slots[0]}/.hidden.js`,
      `/p/${board[0].slots[0]}/%2e%2e%2f..%2foutside.js`]) {
      assert.equal((await fetch(base + route)).status, 404, route);
    }
    const previewResponse = await fetch(`${base}/p/${board[0].slots[0]}/`);
    assert.equal(previewResponse.status, 200);
    assert.match(previewResponse.headers.get('content-security-policy'), /sandbox allow-scripts; default-src 'none'/);
    assert.equal((await fetch(`${base}/reveal`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
    const result = await run('node', ['capture.cjs', root, new URL(base).port]);
    assert.equal(result.code, 1, result.output);
    const smoke = JSON.parse(await fs.readFile(path.join(root, '.pilot-gallery', 'smoke.json'), 'utf8'));
    assert.equal(smoke.results.length, 10);
    assert.equal(smoke.results.filter(record => record.passed).length, 6, JSON.stringify(smoke.results));
    for (const record of smoke.results.filter(record => record.id === 'private-candidate')) {
      assert.equal(record.screenshot, true);
      assert.equal(record.h1, false);
      assert.equal(record.horizontalOverflow, true);
      assert(record.httpErrors.some(error => error.includes('404')));
      assert(record.jsErrors.some(error => error.includes('synthetic failure')));
    }
    for (const record of smoke.results.filter(record => record.id === 'private-missing')) {
      assert.equal(record.screenshot, false);
      assert.equal(record.loadStatus, 404);
    }
    assert.deepEqual(Object.values(smoke.assignments).map(sides => sides.map(run => run.group).sort().join('/')).sort(),
      ['baseline/candidate', 'baseline/control', 'candidate/control', 'control/control']);
    browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(5000);
    await page.goto(base);
    const selector = page.getByRole('combobox', { name: 'Comparison' });
    const reveal = page.getByRole('button', { name: 'Reveal assignments' });
    const exportVotes = page.getByRole('button', { name: 'Export votes' });
    await page.waitForFunction(() => document.querySelectorAll('#comparison option').length === 4);
    assert(await reveal.isDisabled());
    assert(!(await page.locator('main').innerText()).includes('private-'));
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(await overflow(), false);
    const preview = page.getByRole('combobox', { name: 'Preview' });
    for (const [mode, width, height] of [['desktop', 1440, 960], ['mobile', 390, 844]]) {
      await preview.selectOption(mode);
      await page.waitForFunction(([w, h]) => [...document.images].length === 2 &&
        [...document.images].every(image => image.complete && image.naturalWidth === w && image.naturalHeight === h), [width, height]);
    }
    const controlIndex = board.findIndex(pair => smoke.assignments[pair.id].every(run => run.group === 'control'));
    await selector.selectOption(String(controlIndex));
    await preview.selectOption('live-mobile');
    const frame = page.frameLocator('iframe').first();
    await frame.getByRole('heading', { name: 'Sample exhibit' }).waitFor();
    assert.equal(await frame.locator('html').evaluate(el => getComputedStyle(el).backgroundColor), 'rgb(1, 20, 40)');
    await frame.getByRole('button', { name: 'Toggle' }).press('Enter');
    await frame.getByText('Isolated').waitFor();
    assert.equal(await overflow(), false);
    for (let index = 0; index < board.length; index++) {
      await selector.selectOption(String(index));
      await page.locator('input[name="visual"][value="B"]').check();
      await page.locator('input[name="task"][value="both-poor"]').check();
      await page.getByLabel('Reason').fill(`Reason ${index}`);
      await page.getByRole('button', { name: 'Save ballot' }).click();
      assert.equal(await reveal.isEnabled(), index === board.length - 1);
    }
    await page.reload();
    await page.getByText('4 of 4 ballots saved.').waitFor();
    assert.equal(await page.getByLabel('Reason').inputValue(), 'Reason 0');
    assert(await page.locator('input[name="visual"][value="B"]').isChecked());
    assert(await page.locator('input[name="task"][value="both-poor"]').isChecked());
    const reviewer = await browser.newPage();
    await reviewer.goto(base);
    await reviewer.getByText('0 of 4 ballots saved.').waitFor();
    await reviewer.close();
    const exported = page.waitForEvent('download');
    await exportVotes.click();
    const json = await fs.readFile(await (await exported).path(), 'utf8');
    assert.equal(JSON.parse(json).length, 4);
    assert.doesNotMatch(json, /private-|baseline|control|candidate/);
    await reveal.click();
    await page.getByText('Assignments revealed.', { exact: false }).waitFor();
    assert.match(await page.locator('main').innerText(), /private-/);
    assert(await page.getByRole('button', { name: 'Save ballot' }).isDisabled());
    await stop(server);
    ({ server, base } = await start(root));
    assert.deepEqual(await (await fetch(`${base}/comparisons`)).json(), board);
    assert.equal((await fetch(`${base}/s/${board[0].slots[0]}/desktop`)).status, 200);
    console.log('PASS: sandboxed interaction, opaque/stable pairing, HTTP file isolation, synthetic smoke, screenshots, ballots, export and global reveal');
  } finally {
    if (browser) await browser.close();
    if (server) await stop(server);
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
