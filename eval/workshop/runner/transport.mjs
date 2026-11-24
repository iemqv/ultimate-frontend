// Trusted Pi process; the browser and model-callable filesystem operations are subprocesses.
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const config = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const here = path.dirname(fileURLToPath(import.meta.url));
const out = (...parts) => path.join(config.out, ...parts);
const {
  createAgentSession, createExtensionRuntime, loadSkillsFromDir, ModelRuntime, SessionManager, SettingsManager,
} = await import(`${config.sdk}/dist/index.js`);
const { Type } = await import(`${config.sdk}/node_modules/typebox/build/index.mjs`);
const { createAssistantMessageEventStream } = await import(`${config.sdk}/node_modules/@earendil-works/pi-ai/dist/utils/event-stream.js`);
const requested = { provider: 'openai', model: 'gpt-6.2-sol', thinking: 'medium' };
const limits = { providerRequests: 24, outputTokensPerRequest: 12000, toolCalls: 64, browserCalls: 10,
  seconds: config.seconds, toolSeconds: 30 };
const viewport = { desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } };
const digest = (value) => createHash('sha256').update(value).digest('hex');
const prompt = readFileSync(out('prompt.txt'), 'utf8');
const run = { schemaVersion: 1, status: 'running', preflight: config.preflight, requested, limits,
  prompt: { file: 'prompt.txt', sha256: digest(prompt) }, startedAt: new Date().toISOString(),
  providerRequests: 0, toolCalls: 0, browserCalls: 0, browserPixelReturns: [], skillReads: [], captures: { first: null, final: {} },
  failures: [], usableOutput: false };
let session, timer;

function event(type, fields = {}) {
  appendFileSync(out('events.jsonl'), JSON.stringify({ time: new Date().toISOString(), type, ...fields }) + '\n');
}

function checkpoint() {
  writeFileSync(out('run.json.tmp'), JSON.stringify(run, null, 2) + '\n');
  renameSync(out('run.json.tmp'), out('run.json'));
}

function dispatch(op, args = {}, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(config.python, [path.join(here, 'arm.py'), '--dispatch', config.site, config.skill ?? '-', config.chromium], {
      env: { PATH: '/usr/bin:/bin', LANG: 'C.UTF-8' }, cwd: '/', stdio: ['pipe', 'pipe', 'ignore'], signal,
    });
    let bytes = 0;
    const buffers = [];
    child.stdout.on('data', (data) => {
      bytes += data.length;
      if (bytes > 8 * 1024 * 1024) child.kill('SIGKILL');
      else buffers.push(data);
    });
    child.on('error', reject);
    child.stdin.on('error', () => {});
    child.on('close', (status) => {
      try {
        if (status !== 0) throw new Error('Sandbox helper did not complete');
        const value = JSON.parse(Buffer.concat(buffers).toString('utf8'));
        if (!value.ok) throw new Error(value.error);
        resolve(value);
      } catch (error) { reject(error); }
    });
    child.stdin.end(JSON.stringify({ op, args }));
  });
}

function storeCapture(result, name, revision, callId = null) {
  const buffer = Buffer.from(result.png, 'base64');
  if (buffer.length < 33 || buffer.length > 5 * 1024 * 1024 || !buffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    throw new Error('Preview did not return a valid PNG');
  }
  const record = { file: `captures/${name}.png`, sha256: digest(buffer), bytes: buffer.length, revision, callId,
    time: new Date().toISOString(), ...result.metadata };
  writeFileSync(out(record.file), buffer, { flag: 'wx' });
  return record;
}

async function siteRevision() {
  const { files } = await dispatch('list');
  const manifest = Object.fromEntries(Object.keys(files).map((file) => [file, digest(readFileSync(path.join(config.site, file)))]));
  return { sha256: digest(JSON.stringify(manifest)), files: manifest };
}

const textResult = (text) => ({ content: [{ type: 'text', text }] });
function tool(name, description, parameters, action) {
  return {
    name, label: name, description, parameters, executionMode: 'sequential',
    async execute(id, args, signal) {
      const started = Date.now();
      try {
        if (++run.toolCalls > limits.toolCalls) throw new Error('Arm tool call budget exhausted');
        const [result, evidence] = await action(args, signal, id);
        event('tool', { id, name, ok: true, elapsedMs: Date.now() - started, ...evidence });
        checkpoint();
        return result;
      } catch (error) {
        event('tool', { id, name, ok: false, elapsedMs: Date.now() - started, error: error.message });
        throw error;
      }
    },
  };
}
const boundedPath = Type.String({ minLength: 1, maxLength: 300 });
const selector = Type.String({ maxLength: 240 });
const tools = [
  tool('list_site', 'List private site files and sizes. Paths are relative to /site.', Type.Object({}), async (_, signal) => {
    const { files } = await dispatch('list', {}, signal);
    return [textResult(JSON.stringify(files)), { files: Object.keys(files).length }];
  }),
  tool('read', 'Read a whole UTF-8 text file in /site; also reads a discovered skill at /skill and its references if present. Relative paths resolve in /site.', Type.Object({ path: boundedPath }), async (args, signal, id) => {
    const { text, ok, ...evidence } = await dispatch('read', args, signal);
    if (evidence.path.startsWith('/skill/')) run.skillReads.push({ callId: id, ...evidence });
    return [textResult(text), evidence];
  }),
  tool('write_site', 'Create or replace a complete private /site file, creating parent directories. Use UTF-8 for HTML/CSS/JS/SVG; optionally encode a binary asset as base64.',
    Type.Object({ path: boundedPath, content: Type.String({ maxLength: 4 * 1024 * 1024 }), encoding: Type.Optional(Type.Union([Type.Literal('utf8'), Type.Literal('base64')])) }),
    async (args, signal) => {
      const { ok, ...evidence } = await dispatch('write', args, signal);
      return [textResult(`Wrote ${evidence.path} (${evidence.bytes} bytes)`), evidence];
    }),
  tool('preview', 'Open the private site/index.html in Chromium and return actual PNG pixels and render diagnostics. Each call starts from a fresh page. Optionally click a CSS selector, press a key, or scroll before capturing.',
    Type.Object({
      width: Type.Integer({ minimum: 300, maximum: 1600 }), height: Type.Integer({ minimum: 360, maximum: 1050 }),
      fullPage: Type.Optional(Type.Boolean()),
      actions: Type.Optional(Type.Array(Type.Union([
        Type.Object({ type: Type.Literal('click'), selector }),
        Type.Object({ type: Type.Literal('press'), key: Type.String({ maxLength: 40 }), selector: Type.Optional(selector) }),
        Type.Object({ type: Type.Literal('scroll'), y: Type.Integer({ minimum: -10000, maximum: 10000 }) }),
      ]), { maxItems: 6 })),
    }), async (args, signal, id) => {
      if (++run.browserCalls > limits.browserCalls) throw new Error('Arm preview call budget exhausted');
      const revision = await siteRevision();
      const result = await dispatch('preview', args, signal);
      const capture = storeCapture(result, run.browserPixelReturns.length === 0 ? 'first' : `preview-${run.browserCalls}`, revision.sha256, id);
      if (run.browserPixelReturns.length === 0) run.captures.first = capture;
      run.browserPixelReturns.push(capture);
      return [{ content: [{ type: 'text', text: JSON.stringify(result.metadata) },
        { type: 'image', mimeType: 'image/png', data: result.png }] }, { capture }];
    }),
];

function mockedStream(model, context) {
  const turn = run.providerRequests;
  let calls;
  if (turn === 1) {
    calls = [
      ['read', { path: '/skill/SKILL.md' }],
      ['read', { path: `${config.probe.sibling}` }],
      ['read', { path: '../sibling/secret.txt' }],
      ['read', { path: `${config.probe.auth}` }],
      ['read', { path: 'asset.svg' }],
      ['preview', { ...viewport.mobile, actions: [{ type: 'press', selector: '#action', key: 'Enter' }] }],
    ];
  } else if (turn === 2) {
    const results = context.messages.filter((message) => message.role === 'toolResult');
    run.mockSawNativeImage = results.some((message) => message.content.some((c) => c.type === 'image' && c.mimeType === 'image/png' && c.data.startsWith('iVBOR')));
    run.mockReadDenied = results.filter((message) => message.isError).length;
    calls = [
      ['write_site', { path: 'index.html', content: '<!doctype html><title>Final arm</title><h1>Final site</h1><link rel="stylesheet" href="style.css"><script src="app.js" defer></script>' }],
      ['write_site', { path: 'style.css', content: 'body { background: #0034cc; color: white; }' }],
      ['write_site', { path: 'app.js', content: 'document.querySelector("h1").append(" with JS");' }],
    ];
  } else if (turn === 3) calls = [];
  else throw new Error('Unexpected preflight model turn');
  const content = calls.length ? calls.map(([name, args], index) => ({ type: 'toolCall', id: `call_${turn}_${index}`, name, arguments: args })) : [{ type: 'text', text: 'Mock build complete' }];
  const stopReason = calls.length ? 'toolUse' : 'stop';
  const stream = createAssistantMessageEventStream();
  const message = { role: 'assistant', content, api: model.api, provider: model.provider, model: model.id, stopReason,
    timestamp: Date.now(), usage: { input: 13, output: 7, cacheRead: 2, cacheWrite: 0, totalTokens: 22,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
  stream.push({ type: 'done', reason: stopReason, message });
  return stream;
}

checkpoint();
try {
  const runtime = await ModelRuntime.create({ authPath: config.auth, modelsPath: null, refreshOnCreate: false });
  if (config.preflight) await runtime.setRuntimeApiKey(requested.provider, 'preflight-no-network');
  const model = runtime.getPhysicalModel(requested.provider, requested.model);
  if (!model?.input?.includes('image')) throw new Error('Requested Pi model is missing or cannot receive screenshots');
  const nativeStream = runtime.streamSimple.bind(runtime);
  runtime.streamSimple = (selected, context, options) => {
    if (selected.id !== model.id || selected.provider !== model.provider || options?.reasoning !== requested.thinking) {
      throw new Error('Unexpected model or thinking level');
    }
    if (run.providerRequests >= limits.providerRequests) throw new Error('Arm provider request budget exhausted');
    if (run.toolCalls >= limits.toolCalls) throw new Error('Arm tool call budget exhausted');
    run.providerRequests++;
    event('provider_request', { number: run.providerRequests, provider: selected.provider, model: selected.id, thinking: options.reasoning });
    checkpoint();
    return config.preflight ? mockedStream(selected, context) : nativeStream(selected, context, {
      ...options, maxTokens: limits.outputTokensPerRequest, maxRetries: 0,
    });
  };
  if (config.preflight) {
    const { ok, ...isolation } = await dispatch('probe', config.probe);
    run.isolation = isolation;
  }
  const discovery = config.skill ? loadSkillsFromDir({ dir: config.skill, source: 'evaluation' }) : { skills: [], diagnostics: [] };
  if (config.skill && (discovery.skills.length !== 1 || discovery.skills[0].disableModelInvocation || discovery.skills[0].filePath !== path.join(config.skill, 'SKILL.md'))) {
    throw new Error('Expected one discoverable SKILL.md at the skill input root');
  }
  discovery.skills = discovery.skills.map((skill) => ({ ...skill, baseDir: '/skill', filePath: '/skill/SKILL.md' }));
  run.skills = discovery.skills.map(({ name, description, filePath }) => ({ name, description, filePath,
    sha256: digest(readFileSync(path.join(config.skill, 'SKILL.md'))) }));
  const resources = {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => discovery,
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => 'You are building a frontend in a private evaluation workspace. Use only the declared tools. Work in /site; deliver the runnable page as /site/index.html and keep its assets local. Preview is an isolated Chromium browser. Report what you did and any verification limits.',
    getSystemPromptSource: () => undefined,
    getAppendSystemPrompt: () => [],
    getAppendSystemPromptSources: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
  ({ session } = await createAgentSession({ cwd: '/site', agentDir: config.agentDir, model, modelRuntime: runtime,
    thinkingLevel: requested.thinking, noTools: 'builtin', tools: tools.map((item) => item.name), customTools: tools,
    sessionManager: SessionManager.inMemory('/site'), resourceLoader: resources,
    settingsManager: SettingsManager.inMemory({ blockImages: false, cacheWarming: 'off', compaction: { enabled: false },
      retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: 90000 } } }),
  }));
  run.settings = { model: session.model.id, provider: session.model.provider, api: session.model.api, thinking: session.thinkingLevel,
    tools: session.getActiveToolNames(), extensions: [], contextFiles: [], persistence: 'memory', cacheWarming: 'off', retries: 0 };
  if (JSON.stringify([...run.settings.tools].sort()) !== JSON.stringify(tools.map((item) => item.name).sort())) throw new Error('Unexpected active tools');
  if (session.thinkingLevel !== requested.thinking) throw new Error('Pi clamped the requested thinking level');
  writeFileSync(out('system-prompt.txt'), session.systemPrompt);
  if (run.skills.length && !session.systemPrompt.includes('<location>/skill/SKILL.md</location>')) throw new Error('Pi did not advertise the native skill');
  checkpoint();
  timer = setTimeout(() => { run.failures.push('Arm generation deadline exceeded'); void session.abort(); }, limits.seconds * 1000);
  await session.prompt(prompt, { expandPromptTemplates: false });
  const answers = session.messages.filter((msg) => msg.role === 'assistant');
  const last = answers.at(-1);
  if (!last || ['error', 'aborted', 'length'].includes(last.stopReason)) {
    run.failures.push(last?.errorMessage?.slice(0, 600) || `Generation ended without a complete final response (${last?.stopReason ?? 'none'})`);
  }
  run.responses = answers.map(({ provider, model: id, stopReason, usage }) => ({ provider, model: id, stopReason, usage }));
  writeFileSync(out('response.txt'), session.getLastAssistantText() ?? '');
} catch (error) {
  run.failures.push(error.message.slice(0, 600));
} finally {
  clearTimeout(timer);
  if (session) {
    run.usage = session.getSessionStats();
    session.dispose();
  }
}

try {
  const revision = await siteRevision();
  run.output = { entry: 'site/index.html', ...revision };
  if (!Object.hasOwn(revision.files, 'index.html')) throw new Error('No site/index.html was produced');
  for (const [name, dimensions] of Object.entries(viewport)) {
    try {
      const result = await dispatch('preview', { ...dimensions, fullPage: true });
      run.captures.final[name] = storeCapture(result, `final-${name}`, revision.sha256);
      event('final_capture', { name, capture: run.captures.final[name] });
    } catch (error) {
      run.failures.push(`Final ${name} capture: ${error.message.slice(0, 600)}`);
    }
  }
  run.usableOutput = Boolean(run.captures.final.desktop && run.captures.final.mobile);
} catch (error) {
  run.failures.push(error.message.slice(0, 600));
}
run.status = run.failures.length ? 'failed' : 'completed';
run.finishedAt = new Date().toISOString();
checkpoint();
process.exitCode = run.status === 'completed' ? 0 : 1;
