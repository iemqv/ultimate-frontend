'use strict';

const get = id => document.getElementById(id);
const comparison = get('comparison');
const preview = get('preview');
const ballot = get('ballot');
const reveal = get('reveal');
const exportButton = get('export');
const status = get('status');
const reason = get('reason');
const choices = { A: 'A', B: 'B', tie: 'Tie', 'both-poor': 'Both poor', 'not-observed': 'Not observed' };
const dimensions = { desktop: [1440, 960], mobile: [390, 844] };
let pairs = [];
let votes = Object.create(null);
let storageKey;
let assignments;

function node(tag, text) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  return element;
}

for (const [name, label] of [['visual', 'Visual quality'], ['task', 'Task completion']]) {
  const fieldset = node('fieldset');
  fieldset.append(node('legend', label));
  for (const [value, text] of Object.entries(choices)) {
    const option = node('label');
    const input = node('input');
    Object.assign(input, { type: 'radio', name, value, required: true });
    option.append(input, ` ${text}`);
    fieldset.append(option);
  }
  get('choices').append(fieldset);
}

function validVote(vote) {
  return vote && Object.hasOwn(choices, vote.visual) && Object.hasOwn(choices, vote.task) &&
    typeof vote.reason === 'string' && vote.reason.trim().length > 0 && vote.reason.trim().length <= 1000;
}

function updateControls(message = '') {
  const count = Object.keys(votes).length;
  exportButton.disabled = count === 0;
  reveal.disabled = count === 0 || count !== pairs.length || Boolean(assignments);
  status.textContent = `${count} of ${pairs.length} ballots saved.${message ? ` ${message}` : ''}`;
}

function renderPreviews() {
  const pair = pairs[Number(comparison.value)];
  if (!pair) return;
  const sides = get('sides');
  const live = preview.value.startsWith('live-');
  const mode = preview.value.replace('live-', '');
  const [width, height] = dimensions[mode];
  sides.replaceChildren(...pair.slots.map((slot, index) => {
    const side = node('article');
    const label = index === 0 ? 'A' : 'B';
    const assignment = assignments?.[pair.id][index];
    side.append(node('h3', label));
    if (assignment) side.append(node('p', `${assignment.group} · repeat ${assignment.repeat} · ${assignment.id}`));
    const viewport = node('div');
    viewport.className = 'viewport';
    if (live) {
      const frame = node('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      frame.referrerPolicy = 'no-referrer';
      Object.assign(frame, { src: `/p/${slot}/`, title: `Interactive preview ${label}`, width, height });
      viewport.append(frame);
    } else {
      const image = node('img');
      Object.assign(image, { src: `/s/${slot}/${mode}`, alt: `Screenshot of preview ${label}`, width, height });
      image.addEventListener('error', () => {
        viewport.replaceChildren(node('p', 'Screenshot unavailable. Try the interactive preview.'));
      });
      viewport.append(image);
    }
    side.append(viewport);
    return side;
  }));
}

function selectPair() {
  const pair = pairs[Number(comparison.value)];
  const heading = get('brief');
  heading.textContent = pair.brief;
  ballot.reset();
  const vote = votes[pair.id];
  if (vote) {
    ballot.elements.visual.value = vote.visual;
    ballot.elements.task.value = vote.task;
    reason.value = vote.reason;
  }
  reason.setCustomValidity('');
  renderPreviews();
}

comparison.addEventListener('change', selectPair);
preview.addEventListener('change', renderPreviews);
reason.addEventListener('input', () => reason.setCustomValidity(''));
ballot.addEventListener('submit', event => {
  event.preventDefault();
  const pair = pairs[Number(comparison.value)];
  const vote = { visual: ballot.elements.visual.value, task: ballot.elements.task.value, reason: reason.value.trim() };
  if (!validVote(vote)) {
    reason.setCustomValidity('Enter a reason for your choices.');
    reason.reportValidity();
    return;
  }
  const next = { ...votes, [pair.id]: vote };
  try {
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    updateControls('Could not save to this browser. Check browser storage settings.');
    return;
  }
  votes = next;
  updateControls('Ballot saved.');
});

exportButton.addEventListener('click', () => {
  const records = pairs.filter(pair => votes[pair.id]).map(pair => ({
    comparison: pair.id, brief: pair.brief, ...votes[pair.id],
  }));
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
  const link = node('a');
  link.href = url;
  link.download = 'pilot-votes.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

reveal.addEventListener('click', async () => {
  reveal.disabled = true;
  try {
    const response = await fetch('/reveal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(votes),
    });
    if (!response.ok) throw new Error();
    assignments = await response.json();
    for (const field of ballot.elements) field.disabled = true;
    renderPreviews();
    updateControls('Assignments revealed. Ballots are read-only in this view.');
  } catch {
    updateControls('Could not reveal assignments. Try again.');
  }
});

async function main() {
  const response = await fetch('/comparisons');
  if (!response.ok) throw new Error();
  pairs = await response.json();
  if (!pairs.length) {
    status.textContent = 'No comparisons are available for these runs.';
    preview.disabled = true;
    return;
  }
  storageKey = `pilot-ballots:${pairs.map(pair => pair.id).join(',')}`;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '{}');
    for (const { id } of pairs) if (validVote(stored?.[id])) votes[id] = stored[id];
  } catch {
    // Inaccessible or malformed storage must not block browsing previews.
  }
  pairs.forEach((pair, index) => {
    const option = node('option', `${index + 1} · ${pair.brief}`);
    option.value = index;
    comparison.append(option);
  });
  comparison.disabled = false;
  get('brief').hidden = get('sides').hidden = ballot.hidden = false;
  selectPair();
  updateControls();
}

main().catch(() => { status.textContent = 'Could not load comparisons. Reload to retry.'; });
