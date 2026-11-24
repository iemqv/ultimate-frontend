// Runs only inside the bubblewrap preview namespace.
const { readFileSync } = require('node:fs');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('/playwright');

const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.otf': 'font/otf', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const errorText = (message) => String(message).replace(/\s+/g, ' ').slice(0, 250);

async function serve(request, response) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      response.writeHead(405).end();
      return;
    }
    const url = new URL(request.url, 'http://localhost');
    const name = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filename = await fs.realpath(path.resolve('/site', '.' + name));
    if (!filename.startsWith('/site/') || !(await fs.stat(filename)).isFile()) throw new Error('Not a site file');
    const body = await fs.readFile(filename);
    const contentType = types[path.extname(filename).toLowerCase()] ?? 'application/octet-stream';
    response.writeHead(200, { 'Content-Type': contentType, 'Content-Length': body.length, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}

async function preview({ width, height, actions = [], fullPage = false }) {
  if (!Number.isInteger(width) || width < 300 || width > 1600 || !Number.isInteger(height) || height < 360 || height > 1050 || !Array.isArray(actions) || actions.length > 6) {
    throw new Error('Viewport must be 300–1600 × 360–1050 and at most six actions are allowed');
  }
  const server = http.createServer(serve);
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: '/chromium/chrome-headless-shell', timeout: 8000,
      args: ['--no-sandbox', '--disable-background-networking', '--disable-extensions', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
      reducedMotion: 'reduce', serviceWorkers: 'block', acceptDownloads: false });
    const pageErrors = [], networkErrors = [], blockedRequests = [];
    const limited = (items, item) => { if (items.length < 12) items.push(errorText(item)); };
    await context.route('**/*', async (route) => {
      if (new URL(route.request().url()).origin === origin) return route.continue();
      limited(blockedRequests, route.request().url());
      return route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', (socket) => {
      limited(blockedRequests, socket.url());
      return socket.close();
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => limited(pageErrors, error.message));
    page.on('response', (res) => { if (res.status() >= 400) limited(networkErrors, `${res.status()} ${new URL(res.url()).pathname}`); });
    page.on('requestfailed', (req) => {
      const url = new URL(req.url());
      if (url.origin === origin) limited(networkErrors, `${req.failure()?.errorText} ${url.pathname}`);
    });
    page.setDefaultTimeout(1600);
    const response = await page.goto(`${origin}/`, { waitUntil: 'load', timeout: 7000 });
    if (!response?.ok()) throw new Error(`Preview needs a readable site/index.html (HTTP ${response?.status() ?? 'unknown'})`);
    const actionResults = [];
    for (const action of actions) {
      try {
        if (typeof action.selector === 'string' && action.selector.length <= 240 && action.type === 'click') {
          await page.locator(action.selector).first().click();
        } else if (typeof action.key === 'string' && /^[a-zA-Z0-9+ -]{1,40}$/.test(action.key) && action.type === 'press') {
          if (typeof action.selector === 'string' && action.selector.length <= 240) {
            await page.locator(action.selector).first().press(action.key);
          } else await page.keyboard.press(action.key);
        } else if (action.type === 'scroll' && Number.isInteger(action.y) && Math.abs(action.y) <= 10000) {
          await page.evaluate((y) => window.scrollTo(0, y), action.y);
        } else throw new Error('Expected click with selector, press with key, or scroll with y');
        actionResults.push({ ...action, ok: true });
      } catch (error) {
        actionResults.push({ ...action, ok: false, error: errorText(error.message) });
        break;
      }
    }
    const state = await page.evaluate(() => ({
      title: document.title.slice(0, 180),
      heading: document.querySelector('h1')?.textContent?.trim().slice(0, 220) ?? '',
      scrollY: Math.round(scrollY), scrollWidth: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      focus: document.activeElement?.textContent?.trim().slice(0, 140) ?? '',
    }));
    const capped = fullPage && (state.scrollWidth > width || state.scrollHeight > 4096);
    const screenshot = await page.screenshot({ animations: 'disabled', timeout: 5000, fullPage,
      ...(capped ? { clip: { x: 0, y: 0, width, height: Math.min(Math.max(state.scrollHeight, height), 4096) } } : {}) });
    if (screenshot.length > 5 * 1024 * 1024) throw new Error('PNG exceeds 5 MiB; try a smaller viewport');
    return { ok: true, png: screenshot.toString('base64'), metadata: {
      engine: 'chromium', version: browser.version(), route: new URL(page.url()).origin === origin ? new URL(page.url()).pathname : 'outside-preview',
      width, height, imageWidth: screenshot.readUInt32BE(16), imageHeight: screenshot.readUInt32BE(20),
      fullPage, capped, state, pageErrors, networkErrors, blockedRequests, actionResults,
    } };
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

(async () => {
  try {
    const request = JSON.parse(readFileSync(0, 'utf8'));
    if (request.op !== 'preview') throw new Error('Unknown browser operation');
    process.stdout.write(JSON.stringify(await preview(request.args)));
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: errorText(error.message) }));
  }
})();
