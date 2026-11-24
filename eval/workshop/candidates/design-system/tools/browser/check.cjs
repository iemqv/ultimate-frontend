'use strict';

const text = value => typeof value === 'string' && value.trim().length > 0;
const dimension = value => Number.isSafeInteger(value) && value > 0;
const only = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).every(key => keys.includes(key));

function validateCheckpoint(checkpoint) {
  if (!only(checkpoint, ['name', 'width', 'height', 'steps']) || !text(checkpoint.name) ||
      !dimension(checkpoint.width) || !dimension(checkpoint.height) || !Array.isArray(checkpoint.steps)) {
    throw new TypeError('Expected a checkpoint name, positive integer width and height, and steps array');
  }
  for (const [index, step] of checkpoint.steps.entries()) {
    const keys = ['op', 'role', 'name'];
    if (step?.op === 'press') keys.push('key');
    if (!only(step, keys) || !['press', 'click', 'visible', 'focused'].includes(step.op) ||
        !text(step.role) || typeof step.name !== 'string' || (step.op === 'press' && !text(step.key))) {
      throw new TypeError(`Invalid step ${index + 1}`);
    }
  }
}

async function assertNoOverflow(page) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (scrollWidth > clientWidth) throw new Error(`Horizontal overflow: ${scrollWidth}px > ${clientWidth}px`);
}

async function runStep(page, step) {
  const { op, role, name, key } = step;
  const target = page.getByRole(role, { name, exact: true });
  const count = await target.count();
  if (count !== 1) throw new Error(`Expected exactly one ${role} named ${JSON.stringify(name)}; found ${count}`);

  if (op === 'click') await target.click();
  if (op === 'visible' && !(await target.isVisible())) throw new Error('Target is not visible');
  if (op === 'focused' || op === 'press') {
    if (!(await target.evaluate(element => element.matches(':focus')))) throw new Error('Target is not focused');
    // Locator.press would focus the target and hide broken focus management.
    if (op === 'press') await page.keyboard.press(key);
  }
}

module.exports = async function check(page, contract, baseURL) {
  if (!only(contract, ['version', 'checkpoints']) || contract.version !== 1 ||
      !Array.isArray(contract.checkpoints) || contract.checkpoints.length === 0) {
    throw new TypeError('Expected a version 1 contract with at least one checkpoint');
  }
  const url = text(baseURL) ? new URL(baseURL) : null;
  if (!url || !['http:', 'https:', 'file:', 'data:'].includes(url.protocol)) {
    throw new TypeError('Expected an absolute HTTP(S), file, or data baseURL');
  }

  const results = [];
  for (const [index, checkpoint] of contract.checkpoints.entries()) {
    const name = text(checkpoint?.name) ? checkpoint.name : `Checkpoint ${index + 1}`;
    let stepLabel = '';
    try {
      validateCheckpoint(checkpoint);
      await page.setViewportSize({ width: checkpoint.width, height: checkpoint.height });
      const sameDocument = url.href.includes('#') && page.url().split('#')[0] === url.href.split('#')[0];
      let response = await page.goto(baseURL);
      // Fragment navigation may preserve the previous checkpoint's DOM.
      if (sameDocument && !response) response = await page.reload();
      if (response?.status() >= 400) throw new Error(`Navigation returned HTTP ${response.status()}`);
      await assertNoOverflow(page);
      for (const [stepIndex, step] of checkpoint.steps.entries()) {
        stepLabel = `Step ${stepIndex + 1} (${step.op}): `;
        await runStep(page, step);
        await assertNoOverflow(page);
      }
      results.push({ name, passed: true });
    } catch (error) {
      results.push({ name, passed: false, error: `${stepLabel}${error.message}` });
    }
  }
  return results;
};
