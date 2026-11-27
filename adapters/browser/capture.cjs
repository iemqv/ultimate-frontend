const { lookup } = require('node:dns');
const { mkdir, writeFile } = require('node:fs/promises');
const http = require('node:http');
const { isIP } = require('node:net');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);
const timeouts = { launch: 10000, navigation: 8000, step: 2000, capture: 5000 };

function isLoopback(address) {
  return address === '::1' || (isIP(address) === 4 && address.startsWith('127.'));
}

function loopbackOrigin(raw) {
  // Match the raw host as well: URL normalization accepts octal and abbreviated IPv4.
  const authority = typeof raw === 'string' && /^http:\/\/(localhost|127(?:\.\d{1,3}){3}|\[::1\])(?::\d{1,5})?\/?$/.exec(raw);
  if (!authority) throw new Error('Expected an explicit loopback HTTP origin');
  const url = new URL(raw);
  if (url.hostname !== authority[1]) throw new Error('Expected a canonical loopback host');
  return url.origin;
}

function allowed(origin, raw, method) {
  if (!safeMethods.has(method)) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' && url.origin === origin && !url.username && !url.password;
  } catch {
    return false;
  }
}

function loopbackLookup(host, options, callback) {
  lookup(host, { all: true }, (error, addresses) => {
    if (error) return callback(error);
    const local = addresses.filter(({ address }) => isLoopback(address));
    if (!local.length) return callback(new Error('localhost did not resolve to loopback'));
    if (options.all) return callback(null, local);
    return callback(null, local[0].address, local[0].family);
  });
}

function endToEndHeaders(headers) {
  const result = { ...headers };
  for (const name of (result.connection || '').split(',')) delete result[name.trim().toLowerCase()];
  for (const name of ['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'proxy-connection', 'te', 'trailer', 'transfer-encoding', 'upgrade']) {
    delete result[name];
  }
  return result;
}

async function startGuard(origin) {
  const target = new URL(origin);
  // Enforce the origin on redirect hops Playwright routing cannot see.
  const server = http.createServer((req, res) => {
    if (!allowed(origin, req.url, req.method) || (req.headers['content-length'] ?? '0') !== '0' || req.headers['transfer-encoding']) {
      return res.destroy();
    }
    const url = new URL(req.url);
    const upstream = http.request(target, {
      method: req.method,
      path: url.pathname + url.search,
      headers: { ...endToEndHeaders(req.headers), host: target.host },
      lookup: loopbackLookup,
      agent: false,
    }, (response) => {
      res.writeHead(response.statusCode, endToEndHeaders(response.headers));
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    upstream.on('error', () => res.destroy());
    res.on('close', () => upstream.destroy());
    upstream.end();
  });
  for (const event of ['connect', 'upgrade']) server.on(event, (_req, socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

function viewportEvidence() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const root = document.scrollingElement;
  const viewport = { left: 0, top: 0, right: width, bottom: height };
  const intersects = (a, b) => Math.min(a.right, b.right) > Math.max(a.left, b.left)
    && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top);
  const within = (a, b) => a.left >= b.left && a.top >= b.top && a.right <= b.right && a.bottom <= b.bottom;
  const styles = new WeakMap();
  const style = (element) => {
    if (!styles.has(element)) styles.set(element, getComputedStyle(element));
    return styles.get(element);
  };
  const clip = (element) => {
    const visible = { ...viewport };
    for (let current = element; current; current = current.parentElement) {
      const css = style(current);
      if (css.opacity === '0' || css.contentVisibility === 'hidden') return null;
      if (current === root || (css.overflowX === 'visible' && css.overflowY === 'visible')) continue;
      const rect = current.getBoundingClientRect();
      const left = rect.left + current.clientLeft;
      const top = rect.top + current.clientTop;
      if (css.overflowX !== 'visible') {
        visible.left = Math.max(visible.left, left);
        visible.right = Math.min(visible.right, left + current.clientWidth);
      }
      if (css.overflowY !== 'visible') {
        visible.top = Math.max(visible.top, top);
        visible.bottom = Math.min(visible.bottom, top + current.clientHeight);
      }
    }
    return visible;
  };
  const runs = [];
  const range = document.createRange();
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
  let run;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement;
    if (!parent || style(parent).visibility !== 'visible' || parent.closest('script, style, template, noscript, select, textarea')) continue;
    const bounds = clip(parent);
    if (!bounds) continue;
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects());
    if (!rects.some((rect) => intersects(rect, bounds))) continue;
    let block = parent;
    while (block.parentElement && ['inline', 'contents'].includes(style(block).display)) block = block.parentElement;
    if (!run || run.block !== block) {
      run = { block, text: '' };
      runs.push(run);
    }
    if (rects.every((rect) => within(rect, bounds))) {
      run.text += node.data;
    } else {
      for (const token of node.data.matchAll(/\S+|\s+/g)) {
        range.setStart(node, token.index);
        range.setEnd(node, token.index + token[0].length);
        run.text += Array.from(range.getClientRects()).some((rect) => intersects(rect, bounds)) ? token[0] : ' ';
      }
    }
  }
  const text = (value) => value.replace(/\s+/g, ' ').trim();
  const lines = runs.map((entry) => text(entry.text)).filter(Boolean);
  const headings = new Map();
  for (const entry of runs) {
    const heading = entry.block.closest('h2, h3, h4, h5, h6, [role="heading"]');
    if (heading) headings.set(heading, text(`${headings.get(heading) || ''} ${entry.text}`));
  }
  const peerGroups = [];
  for (const container of document.querySelectorAll('body *')) {
    const children = Array.from(container.children);
    if (children.length < 3 || children.length > 8 || container.closest('nav, header, footer')
      || !['grid', 'inline-grid', 'flex', 'inline-flex'].includes(style(container).display)) continue;
    const first = children[0];
    if (!children.every((item) => item.tagName === first.tagName && item.getAttribute('class') === first.getAttribute('class'))) continue;
    const cards = children.map((item) => ({
      rect: item.getBoundingClientRect(),
      title: headings.get(item.querySelector('h2, h3, h4, h5, h6, [role="heading"]')),
    }));
    const exemplar = cards[0].rect;
    if (!cards.every(({ rect, title }, index) => title && rect.width >= 80 && rect.height >= 60
      && within(rect, viewport) && Math.abs(rect.top - exemplar.top) <= 4
      && Math.abs(rect.width - exemplar.width) <= exemplar.width * 0.1
      && Math.abs(rect.height - exemplar.height) <= exemplar.height * 0.1
      && (index === 0 || rect.left >= cards[index - 1].rect.right - 1))) continue;
    const names = cards.map(({ title }) => title);
    if (new Set(names).size === names.length) peerGroups.push(names);
  }
  return {
    width, height, lines, peerGroups,
    horizontalOverflow: root.scrollWidth > root.clientWidth,
    scrollY: Math.max(0, Math.round(window.scrollY)),
    scrollRange: Math.max(0, root.scrollHeight - root.clientHeight),
  };
}

function locator(page, target, options) {
  return page.getByRole(target.role, { name: target.name, exact: true, ...options });
}

async function assertFocused(page, target) {
  if (!await locator(page, target).evaluate((element) => element.matches(':focus'))) {
    throw new Error(`Expected focus on ${target.role} ${JSON.stringify(target.name)}`);
  }
}

async function act(page, step) {
  switch (step.op) {
    case 'click': return locator(page, step.target).click();
    case 'focused': return assertFocused(page, step.target);
    case 'visible': return locator(page, step.target).waitFor({ state: 'visible' });
    case 'hidden': return locator(page, step.target, { includeHidden: true }).filter({ visible: true }).first().waitFor({ state: 'detached' });
    case 'press':
      await page.keyboard.press(step.key);
      if (step.focused) await assertFocused(page, step.focused);
      return;
    case 'fill': return locator(page, step.target).fill(step.value);
    case 'text': {
      const actual = await locator(page, step.target).innerText();
      if (actual !== step.equals) throw new Error(`Expected text ${JSON.stringify(step.equals)}, got ${JSON.stringify(actual)}`);
      return;
    }
    case 'scroll': return page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), step.y);
    case 'pointer-down':
      await locator(page, step.target).hover();
      return page.mouse.down();
    case 'pointer-move': return page.mouse.move(step.x, step.y);
    case 'pointer-up': return page.mouse.up();
    default: throw new Error(`Unknown operation ${step.op}`);
  }
}

function observation(scenario) {
  return { id: scenario.id, status: 'unavailable', stepsCompleted: 0, error: null, captures: [] };
}

function diagnostic(error) {
  return String(error.message ?? error).slice(0, 1000);
}

async function captureFrame(page, outputDir, scenario, id) {
  const valid = (value) => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
  if (!valid(scenario.id) || !valid(id)) throw new Error('Invalid scenario or capture ID');
  await page.evaluate(async (timeout) => {
    let timer;
    try {
      await Promise.race([document.fonts.ready, new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Fonts did not settle before capture')), timeout);
      })]);
    } finally { clearTimeout(timer); }
  }, timeouts.capture);
  const before = await page.evaluate(viewportEvidence);
  const png = await page.screenshot({ type: 'png', scale: 'css', timeout: timeouts.capture });
  const evidence = await page.evaluate(viewportEvidence);
  if (evidence.width !== scenario.width || evidence.height !== scenario.height) throw new Error('Viewport dimensions changed');
  if (!isDeepStrictEqual(before, evidence)) throw new Error('Viewport evidence changed during capture');
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, `${scenario.id}-${id}.png`), png, { flag: 'wx' });
  return { id, ...evidence };
}

async function runScenario(browser, origin, outputDir, scenario) {
  const result = observation(scenario);
  let context;
  let page;
  let phase = 'navigation';
  let crashed = false;
  try {
    const url = new URL(scenario.path, origin);
    if (!allowed(origin, url.href, 'GET') || !/^\/(?!\/)/.test(scenario.path) || /[\\\r\n\t]/.test(scenario.path)) {
      throw new Error('Expected an origin-relative scenario path');
    }
    context = await browser.newContext({
      viewport: { width: scenario.width, height: scenario.height },
      reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    context.setDefaultTimeout(timeouts.step);
    context.setDefaultNavigationTimeout(timeouts.navigation);
    await context.route('**/*', (route) => {
      const req = route.request();
      return allowed(origin, req.url(), req.method()) ? route.continue() : route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', (socket) => socket.close());
    page = await context.newPage();
    page.on('crash', () => { crashed = true; });
    let documentError;
    page.on('response', response => {
      if (response.request().isNavigationRequest() && response.frame() === page.mainFrame() && response.status() >= 400) {
        documentError = new Error(`Preview navigation returned HTTP ${response.status()}`);
      }
    });
    context.on('page', (popup) => popup.close().catch(() => {}));
    const response = await page.goto(url.href, { waitUntil: 'load' });
    if (!response || !response.ok() || !allowed(origin, page.url(), 'GET')) {
      throw new Error(`Preview did not load${response ? ` (HTTP ${response.status()})` : ''}`);
    }
    for (const step of scenario.steps) {
      phase = step.op;
      if (step.op === 'capture') {
        if (!allowed(origin, page.url(), 'GET')) throw new Error('Capture requires a loaded preview page on the approved origin');
        result.captures.push(await captureFrame(page, outputDir, scenario, step.id));
      } else {
        await act(page, step);
      }
      if (documentError) throw documentError;
      result.stepsCompleted++;
    }
    result.status = 'pass';
  } catch (error) {
    result.status = ['navigation', 'capture'].includes(phase) || crashed || !browser.isConnected() ? 'unavailable' : 'fail';
    result.error = `${phase}: ${diagnostic(error)}`;
  } finally {
    await context?.close().catch(() => {});
  }
  return result;
}

async function run({ baseUrl, outputDir, scenarios }) {
  let browser;
  let guard;
  try {
    const origin = loopbackOrigin(baseUrl);
    if (scenarios.length === 0) return [];
    const core = process.env.UF_PLAYWRIGHT_CORE;
    const { chromium } = require(core ? path.resolve(core) : 'playwright-core');
    guard = await startGuard(origin);
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.UF_CHROMIUM || undefined,
      timeout: timeouts.launch,
      args: [
        `--proxy-server=http://127.0.0.1:${guard.address().port}`,
        '--proxy-bypass-list=<-loopback>',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
      ],
    });
    const results = [];
    for (const scenario of scenarios) results.push(await runScenario(browser, origin, outputDir, scenario));
    return results;
  } catch (error) {
    return scenarios.map((scenario) => ({ ...observation(scenario), error: diagnostic(error) }));
  } finally {
    try {
      await browser?.close();
    } finally {
      if (guard) {
        guard.close();
        guard.closeAllConnections();
      }
    }
  }
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const message = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  if (!Array.isArray(message?.scenarios) || typeof message.outputDir !== 'string' || !message.outputDir) {
    throw new Error('Expected {baseUrl, outputDir, scenarios}');
  }
  process.stdout.write(`${JSON.stringify({ scenarios: await run(message) })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${diagnostic(error)}\n`);
  process.exitCode = 1;
});
