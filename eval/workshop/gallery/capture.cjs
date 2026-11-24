const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/postman/app/resources/app/node_modules/playwright-core');

// Match the Chromium executable used by ultimate-frontend-eval-r4/browser.cjs.
const executablePath = '/home/bigboss/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell';
const viewports = { desktop: { width: 1440, height: 960 }, mobile: { width: 390, height: 844 } };

function ensureDirectory(location) {
  try {
    fs.mkdirSync(location, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  if (!fs.lstatSync(location).isDirectory()) throw new Error(`Not a regular directory: ${location}`);
}

function writePrivate(location, bytes) {
  const temporary = `${location}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, bytes, { flag: 'wx', mode: 0o600 });
  try {
    fs.renameSync(temporary, location);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

async function capture(browser, base, run, mode, viewport, destination) {
  const prefix = `${base}/c/${run.token}/`;
  const report = { id: run.id, mode, viewport, loadStatus: null, h1: null, horizontalOverflow: null,
    screenshot: false, httpErrors: [], jsErrors: [], requestErrors: [], captureErrors: [] };
  const httpErrors = new Set();
  let page;
  try {
    fs.rmSync(destination, { force: true });
    page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    page.setDefaultTimeout(5000);
    await page.route('**/*', route => {
      if (route.request().url().startsWith(prefix)) return route.continue();
      report.requestErrors.push(`Blocked request: ${route.request().url()}`);
      return route.abort();
    });
    // Chromium can block an opaque-origin asset before Playwright exposes its response.
    const network = await page.context().newCDPSession(page);
    const urls = new Map();
    network.on('Network.requestWillBeSent', event => urls.set(event.requestId, event.request.url));
    network.on('Network.responseReceivedExtraInfo', event => {
      if (event.statusCode >= 400 && urls.has(event.requestId)) {
        httpErrors.add(`${event.statusCode} ${urls.get(event.requestId)}`);
      }
    });
    await network.send('Network.enable');
    page.on('response', response => {
      if (response.status() >= 400) httpErrors.add(`${response.status()} ${response.url()}`);
    });
    page.on('requestfailed', request => report.requestErrors.push(`${request.failure()?.errorText} ${request.url()}`));
    page.on('pageerror', error => report.jsErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) {
        report.jsErrors.push(message.text());
      }
    });
    try {
      const response = await page.goto(prefix, { waitUntil: 'load' });
      report.loadStatus = response?.status() ?? null;
    } catch (error) {
      report.captureErrors.push(`Load: ${error.message}`);
    }
    try {
      await page.locator('h1').first().waitFor({ state: 'visible', timeout: 1500 });
      report.h1 = true;
    } catch {
      report.h1 = false;
    }
    try {
      report.horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    } catch (error) {
      report.captureErrors.push(`Viewport: ${error.message}`);
    }
    if (report.loadStatus >= 200 && report.loadStatus < 300) {
      try {
        writePrivate(destination, await page.screenshot({ animations: 'disabled', timeout: 5000 }));
        report.screenshot = true;
      } catch (error) {
        report.captureErrors.push(`Screenshot: ${error.message}`);
      }
    }
  } catch (error) {
    report.captureErrors.push(error.message);
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (error) {
        report.captureErrors.push(`Close: ${error.message}`);
      }
    }
  }
  report.httpErrors = [...httpErrors];
  report.passed = report.loadStatus === 200 && report.h1 === true && report.horizontalOverflow === false &&
    report.screenshot && !['httpErrors', 'jsErrors', 'requestErrors', 'captureErrors'].some(key => report[key].length);
  return report;
}

async function main() {
  const [rootArg, portArg, extra] = process.argv.slice(2);
  if (!rootArg || !/^\d+$/.test(portArg || '') || extra !== undefined) {
    throw new Error('Usage: node capture.cjs ROOT PORT');
  }
  const root = path.resolve(rootArg);
  if (fs.realpathSync(root) !== root) throw new Error('ROOT must not traverse symlinks');
  const state = path.join(root, '.pilot-gallery');
  const output = path.join(state, 'captures');
  if (!fs.lstatSync(state).isDirectory()) throw new Error('Start the gallery before capture');
  const seedPath = path.join(state, 'seed');
  if (!fs.lstatSync(seedPath).isFile()) throw new Error('Missing regular gallery seed file');
  const seed = fs.readFileSync(seedPath, 'ascii');
  if (!/^[a-f0-9]{64}$/.test(seed)) throw new Error('Invalid gallery seed');
  const base = `http://127.0.0.1:${Number(portArg)}`;
  const response = await fetch(`${base}/_capture`, {
    headers: { Authorization: `Bearer ${seed}` }, redirect: 'error', signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Capture plan unavailable (${response.status}); check ROOT and PORT`);
  const { runs, assignments } = await response.json();
  ensureDirectory(output);
  const results = [];
  const browser = await chromium.launch({ executablePath, args: ['--no-sandbox'] });
  try {
    for (const run of runs) {
      if (!/^[a-f0-9]{32}$/.test(run.token)) throw new Error('Invalid opaque capture token');
      for (const [mode, viewport] of Object.entries(viewports)) {
        const result = await capture(browser, base, run, mode, viewport, path.join(output, `${run.token}-${mode}.png`));
        results.push(result);
        console.log(`${run.id} ${mode}: ${result.passed ? 'PASS' : 'FAIL'}`);
      }
    }
  } finally {
    await browser.close();
    writePrivate(path.join(state, 'smoke.json'), `${JSON.stringify({ assignments, results }, null, 2)}\n`);
  }
  console.log(`Private smoke report: ${path.join(state, 'smoke.json')}`);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
