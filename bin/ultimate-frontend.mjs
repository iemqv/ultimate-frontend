#!/usr/bin/env node
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skill = 'ultimate-frontend';
const agents = new Map(Object.entries({
  codex: '.agents', claude: '.claude', cursor: '.cursor', copilot: '.github',
  gemini: '.gemini', opencode: '.opencode', pi: '.pi',
}));
const usage = `Usage: ultimate-frontend install [--agent ${[...agents.keys()].join('|')}]\nInstalls in the current project. Default: codex (.agents/skills).`;

function directory(path) {
  try { mkdirSync(path); } catch (err) { if (err.code !== 'EEXIST') throw err; }
  if (!lstatSync(path).isDirectory()) throw new Error(`Expected a directory, not a file or link: ${path}`);
}

function sameTree(source, dest) {
  const stat = lstatSync(dest, { throwIfNoEntry: false });
  if (!stat) return false;
  if (lstatSync(source).isDirectory()) {
    if (!stat.isDirectory()) return false;
    const entries = readdirSync(source);
    return entries.length === readdirSync(dest).length && entries.every(name => sameTree(join(source, name), join(dest, name)));
  }
  return stat.isFile() && stat.size === lstatSync(source).size && readFileSync(source).equals(readFileSync(dest));
}

function install(agent) {
  const parent = join(process.cwd(), agents.get(agent));
  directory(parent);
  const skills = join(parent, 'skills');
  directory(skills);
  const dest = join(skills, skill);
  const stage = mkdtempSync(join(parent, '.ultimate-frontend-'));
  try {
    cpSync(join(root, 'skills', skill), stage, { recursive: true });
    for (const name of ['LICENSE', 'NOTICE', 'ATTRIBUTION.md']) copyFileSync(join(root, name), join(stage, name));
    cpSync(join(root, 'licenses'), join(stage, 'licenses'), { recursive: true });
    if (lstatSync(dest, { throwIfNoEntry: false })) {
      if (!sameTree(stage, dest)) throw new Error(`Existing installation differs: ${dest}. Move it aside before reinstalling.`);
      console.log(`Already installed: ${relative(process.cwd(), dest)}`);
    } else {
      renameSync(stage, dest);
      console.log(`Installed: ${relative(process.cwd(), dest)}. Reload your agent.`);
    }
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

const args = process.argv.slice(2);
if (args.length === 1 && ['-h', '--help'].includes(args[0])) console.log(usage);
else if (args[0] === 'install' && (args.length === 1 || (args.length === 3 && args[1] === '--agent' && agents.has(args[2])))) {
  try { install(args[2] ?? 'codex'); } catch (err) { console.error(err.message); process.exitCode = 1; }
} else { console.error(usage); process.exitCode = 1; }
