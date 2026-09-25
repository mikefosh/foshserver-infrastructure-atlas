/* Infrastructure Atlas — interaction layer. */

import { buildScene } from './scene.js';
import { COMPONENTS, byId, PLATFORM } from './hardware.js';

const canvas  = document.getElementById('scene');
const stage   = document.getElementById('stage');
const labelsEl = document.getElementById('labels');
const panel   = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const rail    = document.getElementById('rail');
const hint    = document.getElementById('hint');
const loading = document.getElementById('loading');

const btnExplode = document.getElementById('btn-explode');
const btnLabels  = document.getElementById('btn-labels');
const btnReset   = document.getElementById('btn-reset');

const view = buildScene(canvas);
window.atlasView = view;   // handy for debugging and automated checks; nothing else uses it

/* ---------- tiny DOM helper (no innerHTML anywhere) ---------- */

function el(tag, props = {}, kids = []) {
  const n = document.createElement(tag);
  for (const k in props) {
    if (k === 'class') n.className = props[k];
    else if (k === 'text') n.textContent = props[k];
    else n.setAttribute(k, props[k]);
  }
  for (const c of [].concat(kids)) if (c) n.appendChild(c);
  return n;
}

/* ---------- component rail ---------- */

const chips = {};
for (const c of COMPONENTS) {
  const chip = el('button', {
    type: 'button',
    class: 'chip' + (c.accent === 'amber' ? ' amber' : ''),
    role: 'listitem',
    'data-id': c.id,
  }, [
    el('span', { class: 'chip-dot', 'aria-hidden': 'true' }),
    el('span', { text: c.short }),
  ]);
  chip.addEventListener('click', () => choose(c.id, true));
  chips[c.id] = chip;
  rail.appendChild(chip);
}

/* ---------- info panel ---------- */

function swapBlock(activeId) {
  const cur = byId.hba, next = byId.hba_new;
  const row = (c, cls, tag) => el('div', { class: 'p-swap-row ' + cls }, [
    el('span', { class: 'p-swap-tag', text: tag }),
    el('span', { class: 'p-swap-name', text: c.name }),
    el('span', { class: 'p-swap-spec', text: c.facts.join('  ·  ') }),
  ]);
  return el('div', { class: 'p-swap' }, [
    row(cur, activeId === 'hba' ? 'now current' : 'now', 'Installed today'),
    row(next, 'next', 'Incoming upgrade'),
  ]);
}

function renderPanel(id) {
  const c = byId[id];
  panelBody.textContent = '';

  panelBody.appendChild(el('p', {
    class: 'p-label' + (c.accent === 'amber' ? ' amber' : ''), text: c.label,
  }));
  panelBody.appendChild(el('h2', { class: 'p-title', text: c.name }));
  panelBody.appendChild(el('p', { class: 'p-sub', text: c.sub }));

  if (c.status) panelBody.appendChild(el('p', { class: 'p-status', text: c.status }));

  if (c.swap) {
    panelBody.appendChild(swapBlock(id));
  } else {
    panelBody.appendChild(el('ul', { class: 'p-facts' },
      c.facts.map((f) => el('li', { text: f }))));
  }

  for (const p of c.desc) panelBody.appendChild(el('p', { class: 'p-desc', text: p }));

  if (id === 'chassis') {
    panelBody.appendChild(el('ul', { class: 'p-facts' }, [
      el('li', { text: PLATFORM.board }),
      el('li', { text: PLATFORM.os + ' · ' + PLATFORM.stack }),
      el('li', { text: PLATFORM.roles }),
    ]));
  }

  panel.classList.add('open');
  panel.scrollTop = 0;
}

function choose(id, focusPanel) {
  view.select(id);
  view.stopAuto();
  for (const k in chips) chips[k].classList.toggle('active', k === id);
  renderPanel(id);
  dismissHint();
  if (focusPanel) document.getElementById('panel-close').focus({ preventScroll: true });
}

function closePanel() {
  panel.classList.remove('open');
  view.select(null);
  for (const k in chips) chips[k].classList.remove('active');
}

document.getElementById('panel-close').addEventListener('click', closePanel);

/* ---------- pointer: orbit, pinch, click-to-select ---------- */

const pointers = new Map();
let dragged = false, lastPinch = 0;

canvas.addEventListener('pointerdown', (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragged = false;
  canvas.classList.add('grabbing');
});

canvas.addEventListener('pointermove', (e) => {
  const prev = pointers.get(e.pointerId);

  if (!prev) {
    // hover highlight only when not dragging
    const id = view.pick(e.clientX, e.clientY);
    view.hover(id);
    canvas.classList.toggle('pickable', !!id);
    return;
  }

  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  prev.x = e.clientX; prev.y = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 3) dragged = true;

  if (pointers.size === 1) {
    view.orbitBy(dx * 0.0062, dy * 0.0062);
  } else if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastPinch) view.zoomBy(lastPinch / dist);
    lastPinch = dist;
  }
  dismissHint();
});

function endPointer(e) {
  const had = pointers.get(e.pointerId);
  pointers.delete(e.pointerId);
  if (pointers.size < 2) lastPinch = 0;
  canvas.classList.remove('grabbing');

  if (had && !dragged && e.type === 'pointerup') {
    const id = view.pick(e.clientX, e.clientY);
    if (id) choose(id, false);
    else closePanel();
  }
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  view.zoomBy(Math.exp(e.deltaY * 0.0011));
  dismissHint();
}, { passive: false });

/* ---------- keyboard ---------- */

canvas.setAttribute('tabindex', '0');

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const tag = (e.target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  switch (e.key) {
    case 'Escape':    closePanel(); break;
    case 'r': case 'R': view.resetView(); break;
    case 'e': case 'E': btnExplode.click(); break;
    case 'l': case 'L': btnLabels.click(); break;
    case 'ArrowLeft':  view.orbitBy(-0.12, 0); e.preventDefault(); break;
    case 'ArrowRight': view.orbitBy(0.12, 0); e.preventDefault(); break;
    case 'ArrowUp':    view.orbitBy(0, -0.09); e.preventDefault(); break;
    case 'ArrowDown':  view.orbitBy(0, 0.09); e.preventDefault(); break;
    case '+': case '=': view.zoomBy(0.88); break;
    case '-': case '_': view.zoomBy(1.14); break;
    default: return;
  }
  dismissHint();
});

/* ---------- toolbar ---------- */

let exploded = false;
btnExplode.addEventListener('click', () => {
  exploded = !exploded;
  view.setExploded(exploded);
  btnExplode.setAttribute('aria-pressed', String(exploded));
  dismissHint();
});

let labelsOn = true;
btnLabels.addEventListener('click', () => {
  labelsOn = !labelsOn;
  labelsEl.classList.toggle('hidden', !labelsOn);
  btnLabels.setAttribute('aria-pressed', String(labelsOn));
});

btnReset.addEventListener('click', () => { view.resetView(); dismissHint(); });

/* ---------- floating labels ---------- */

const labelNodes = {};
for (const c of COMPONENTS) {
  const n = el('div', { class: 'lbl' + (c.accent === 'amber' ? ' amber' : ''), text: c.short });
  labelNodes[c.id] = n;
  labelsEl.appendChild(n);
}

function syncLabels() {
  if (!labelsOn) return;
  const shown = new Set();
  for (const p of view.labelPositions()) {
    const n = labelNodes[p.id];
    if (!n) continue;
    shown.add(p.id);
    n.style.left = p.x + 'px';
    n.style.top = p.y + 'px';
    n.style.display = '';
    n.classList.toggle('dim', !!view.selected && view.selected !== p.id);
  }
  for (const id in labelNodes) if (!shown.has(id)) labelNodes[id].style.display = 'none';
}

/* ---------- hint ---------- */

let hintGone = false;
function dismissHint() {
  if (hintGone) return;
  hintGone = true;
  hint.classList.add('gone');
}
setTimeout(dismissHint, 9000);

/* ---------- resize ---------- */

const ro = new ResizeObserver(() => view.resize());
ro.observe(stage);
window.addEventListener('orientationchange', () => setTimeout(() => view.resize(), 250));

/* ---------- loop ---------- */

let last = performance.now(), firstFrame = true;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  view.update(dt);
  syncLabels();

  if (firstFrame) {
    firstFrame = false;
    loading.classList.add('gone');
    setTimeout(() => { loading.style.display = 'none'; }, 600);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
