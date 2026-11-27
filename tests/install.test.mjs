import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const cli = join(root, 'bin/ultimate-frontend.mjs');
function project(t) {
  const dir = mkdtempSync(join(tmpdir(), 'uf-install-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const run = (cwd, ...args) => spawnSync(process.execPath, [cli, ...args], { cwd, encoding: 'utf8' });
const destinations = { codex: '.agents', claude: '.claude', cursor: '.cursor', copilot: '.github', gemini: '.gemini', opencode: '.opencode', pi: '.pi' };
for (const [agent, dir] of Object.entries(destinations)) {
  test(`installs the complete skill for ${agent} and preserves local edits`, t => {
    const cwd = project(t);
    const install = () => run(cwd, 'install', '--agent', agent);
    const result = install();
    assert.equal(result.status, 0, result.stderr);
    const installed = join(cwd, dir, 'skills/ultimate-frontend');
    for (const name of ['SKILL.md', 'references/creative-build.md']) {
      assert.deepEqual(readFileSync(join(installed, name)), readFileSync(join(root, 'skills/ultimate-frontend', name)));
    }
    assert.match(install().stdout, /Already installed/);
    writeFileSync(join(installed, 'SKILL.md'), 'local edit');
    assert.equal(install().status, 1);
    assert.equal(readFileSync(join(installed, 'SKILL.md'), 'utf8'), 'local edit');
  });
}

test('invalid arguments do not touch the workspace', t => {
  const cwd = project(t);
  assert.match(run(cwd, 'install').stderr, /No interactive terminal/);
  assert.equal(run(cwd, 'install', '--agent', 'pi', '--agent', '../elsewhere').status, 1);
  assert.deepEqual(readdirSync(cwd), []);
});

test('never installs through a linked provider directory', { skip: process.platform === 'win32' }, t => {
  const cwd = project(t), outside = project(t);
  symlinkSync(outside, join(cwd, '.agents'));
  assert.equal(run(cwd, 'install', '--agent', 'codex').status, 1);
  assert.deepEqual(readdirSync(outside), []);
});

test('npx installs from the packed artifact with an empty offline cache', t => {
  const cwd = project(t), packages = join(cwd, 'packages');
  mkdirSync(packages);
  const npm = (dir, ...args) => spawnSync(process.execPath, [process.env.npm_execpath, ...args], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, npm_config_cache: join(cwd, 'cache'), npm_config_offline: 'true', npm_config_audit: 'false' },
  });
  const pack = npm(root, 'pack', '--json', '--pack-destination', packages);
  assert.equal(pack.status, 0, pack.stderr);
  const [manifest] = JSON.parse(pack.stdout);
  for (const { path } of manifest.files) assert.match(path, /^(?:bin\/|skills\/|licenses\/|LICENSE$|NOTICE$|ATTRIBUTION\.md$|package\.json$|README\.md$)/);
  const result = spawnSync(process.execPath, [join(dirname(process.env.npm_execpath), 'npx-cli.js'), '--yes',
    '--package', join(packages, manifest.filename), '--', 'ultimate-frontend', 'install', '--agent', 'codex', '--agent', 'claude'], {
    cwd, encoding: 'utf8', env: { ...process.env, npm_config_offline: 'true', npm_config_cache: join(cwd, 'cache') },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(join(cwd, '.claude/skills/ultimate-frontend/SKILL.md')), readFileSync(join(root, 'skills/ultimate-frontend/SKILL.md')));
  const installed = join(cwd, '.agents/skills/ultimate-frontend');
  const source = join(root, 'skills/ultimate-frontend');
  for (const name of readdirSync(join(source, 'references'))) {
    assert.deepEqual(readFileSync(join(installed, 'references', name)), readFileSync(join(source, 'references', name)));
  }
  assert.deepEqual(readFileSync(join(installed, 'SKILL.md')), readFileSync(join(source, 'SKILL.md')));
  for (const name of ['LICENSE', 'NOTICE', 'ATTRIBUTION.md', ...readdirSync(join(root, 'licenses')).map(n => `licenses/${n}`)]) {
    assert.deepEqual(readFileSync(join(installed, name)), readFileSync(join(root, name)));
  }
});
