#!/usr/bin/env node
import { copyFileSync, cpSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const skill = 'ultimate-frontend';
const agents = new Map(Object.entries({
  codex: '.agents', claude: '.claude', cursor: '.cursor', copilot: '.github',
  gemini: '.gemini', opencode: '.opencode', pi: '.pi',
}));
const usage = `Usage: ultimate-frontend install [--agent NAME ...]\nChoose agents in your terminal or repeat --agent for scripts. Agents: ${[...agents.keys()].join(', ')}.`;

async function chooseAgents() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('No interactive terminal. Specify an agent, e.g. install --agent claude.');
  const names = [...agents.keys()];
  console.log(`Install Ultimate Frontend in ${process.cwd()}\n`);
  names.forEach((name, i) => console.log(`  ${i + 1}. ${name.padEnd(9)} ${agents.get(name)}/skills/`));
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    prompt.setPrompt('Choose numbers or names, separated by commas (Enter to cancel): ');
    prompt.prompt();
    for await (const line of prompt) {
      if (!line.trim()) break;
      const selected = line.trim().split(/[\s,]+/).map(value => /^\d+$/.test(value) ? names[Number(value) - 1] : value.toLowerCase());
      if (selected.every(name => agents.has(name))) return selected;
      console.error('Unknown selection. Choose from the agents listed above.');
      prompt.prompt();
    }
    return [];
  } finally { prompt.close(); }
}

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
else if (args[0] === 'install') {
  try {
    const selected = [];
    for (let i = 1; i < args.length; i += 2) {
      if (args[i] !== '--agent' || !agents.has(args[i + 1])) throw new Error(usage);
      selected.push(args[i + 1]);
    }
    const targets = new Set(selected.length ? selected : await chooseAgents());
    if (!targets.size) console.log('Cancelled. Nothing installed.');
    for (const name of targets) install(name);
  } catch (err) { console.error(err.message); process.exitCode = 1; }
} else { console.error(usage); process.exitCode = 1; }
