/**
 * The HUD: what is happening, what the graph says, and the numbers.
 *
 * The frame rate here is the number V1-TEST 81 asks for. It is measured over a
 * rolling window with the cycle running, and it is displayed rather than
 * described.
 */

import { TOLERANCES } from '../../knowledge/tolerances.js';
import { BUDGET } from '../../knowledge/site/layout.js';
import * as graph from '../core/graph.js';
import { issuedCount } from '../core/ids.js';
import * as ops from '../core/ops.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function createHud({ dom, director, overlays, renderer, onSpeed, onRestart, onFocusStage }) {
  const bar = document.createElement('div');
  bar.id = 'hud';
  dom.appendChild(bar);

  const report = document.createElement('div');
  report.id = 'report';
  report.className = 'panel hidden';
  dom.appendChild(report);

  const frames = [];
  let last = performance.now();
  let fps = 0, fpsMin = 0, fps1pctLow = 0;

  bar.innerHTML = `
    <div class="hud-row hud-main">
      <span class="stage" id="hud-stage">—</span>
      <span class="msg" id="hud-msg"></span>
    </div>
    <div class="hud-row hud-nums" id="hud-nums"></div>
    <div class="hud-row hud-btns">
      <button data-speed="1">1×</button>
      <button data-speed="4" class="on">4×</button>
      <button data-speed="16">16×</button>
      <span class="sep"></span>
      <button id="btn-overlays">overlays</button>
      <button id="btn-report">report</button>
      <button id="btn-restart">restart</button>
    </div>
    <div class="hud-row hud-over hidden" id="hud-over"></div>`;

  const over = bar.querySelector('#hud-over');
  over.innerHTML = overlays.names
    .map((n) => `<button data-overlay="${n}">${n}</button>`).join('');

  bar.querySelectorAll('[data-speed]').forEach((b) => b.addEventListener('click', () => {
    bar.querySelectorAll('[data-speed]').forEach((x) => x.classList.remove('on'));
    b.classList.add('on');
    onSpeed(Number(b.dataset.speed));
  }));
  bar.querySelector('#btn-overlays').addEventListener('click', () => over.classList.toggle('hidden'));
  bar.querySelectorAll('[data-overlay]').forEach((b) => b.addEventListener('click', () => {
    b.classList.toggle('on', overlays.toggle(b.dataset.overlay));
  }));
  bar.querySelector('#btn-restart').addEventListener('click', () => onRestart());
  bar.querySelector('#btn-report').addEventListener('click', () => {
    report.classList.toggle('hidden');
    if (!report.classList.contains('hidden')) renderReport();
  });
  bar.querySelector('#hud-stage').addEventListener('click', () => onFocusStage?.());

  let lastReport = null;

  function renderReport() {
    const r = lastReport;
    if (!r) { report.innerHTML = '<div class="head"><b>validation</b></div><div class="body">not run yet</div>'; return; }
    const info = renderer.info;
    const budget = BUDGET.phone;
    let h = `<div class="head"><b>validation report</b>
      <button id="rep-close" aria-label="close">×</button></div><div class="body">`;
    h += `<div class="sec ${r.clean ? 'ok' : 'bad'}">${r.clean ? 'CLEAN' : 'PROBLEMS FOUND'}</div>`;
    h += `<div class="r"><span>objects checked</span><b>${r.counts.checked}</b></div>`;
    h += `<div class="r"><span>floating</span><b class="${r.counts.floating ? 'bad' : 'ok'}">${r.counts.floating}</b></div>`;
    h += `<div class="r"><span>interpenetrating</span><b class="${r.counts.interpenetrating ? 'bad' : 'ok'}">${r.counts.interpenetrating}</b></div>`;
    h += `<div class="r"><span>orphaned</span><b class="${r.counts.orphaned ? 'bad' : 'ok'}">${r.counts.orphaned}</b></div>`;
    h += `<div class="r"><span>stuck operations</span><b class="${r.counts.illegal ? 'bad' : 'ok'}">${r.counts.illegal}</b></div>`;

    h += `<div class="sec">material balance (mm)</div>`;
    h += `<div class="r"><span>stock in</span><b>${r.balance.inMm.toFixed(1)}</b></div>`;
    h += `<div class="r"><span>pieces</span><b>${r.balance.pieceMm.toFixed(1)}</b></div>`;
    h += `<div class="r"><span>offcut</span><b>${r.balance.offcutMm.toFixed(1)}</b></div>`;
    h += `<div class="r"><span>kerf</span><b>${r.balance.kerfMm.toFixed(1)}</b></div>`;
    h += `<div class="r"><span>error</span><b class="${Math.abs(r.balance.errorMm) < 0.5 ? 'ok' : 'bad'}">${r.balance.errorMm.toFixed(3)}</b></div>`;

    h += `<div class="sec">tolerances used (mm)</div>`;
    h += `<div class="r"><span>support</span><b>${TOLERANCES.supportMm}</b></div>`;
    h += `<div class="r"><span>penetration</span><b>${TOLERANCES.penetrationMm}</b></div>`;
    h += `<div class="r"><span>contact</span><b>${TOLERANCES.contactMm}</b></div>`;

    h += `<div class="sec">render, measured</div>`;
    h += `<div class="r"><span>fps</span><b>${fps.toFixed(1)} <span class="muted">1% low ${fps1pctLow.toFixed(1)}</span></b></div>`;
    h += `<div class="r"><span>draw calls</span><b class="${info.render.calls <= budget.maxDrawCalls ? 'ok' : 'bad'}">${info.render.calls} <span class="muted">budget ${budget.maxDrawCalls}</span></b></div>`;
    h += `<div class="r"><span>triangles</span><b class="${info.render.triangles <= budget.maxTriangles ? 'ok' : 'bad'}">${info.render.triangles.toLocaleString('en-GB')} <span class="muted">budget ${budget.maxTriangles.toLocaleString('en-GB')}</span></b></div>`;
    h += `<div class="r"><span>geometries</span><b>${info.memory.geometries}</b></div>`;
    h += `<div class="r"><span>viewport</span><b>${window.innerWidth} × ${window.innerHeight} css px, dpr ${window.devicePixelRatio.toFixed(2)}</b></div>`;

    const problems = [...r.floating.slice(0, 6).map((f) => `floating ${f.id} by ${f.gapMm ?? '?'} mm`),
      ...r.interpenetrating.slice(0, 6).map((i) => `${i.a} ∩ ${i.b} by ${i.depthMm} mm`),
      ...r.orphaned.slice(0, 6).map((o) => `${o.id}: ${o.why}`),
      ...r.illegal.slice(0, 6).map((o) => `${o.id}: ${o.why}`)];
    if (problems.length) {
      h += `<div class="sec">detail</div><div class="hist">` +
        problems.map((p) => `<div class="h">${esc(p)}</div>`).join('') + `</div>`;
    }
    const faults = director.state.faults;
    if (faults.length) {
      h += `<div class="sec">process faults</div><div class="hist">` +
        faults.slice(-8).map((f) => `<div class="h">${esc(JSON.stringify(f).slice(0, 200))}</div>`).join('') + `</div>`;
    }
    h += `</div>`;
    report.innerHTML = h;
    report.querySelector('#rep-close')?.addEventListener('click', () => report.classList.add('hidden'));
  }

  return {
    setReport(r) { lastReport = r; if (!report.classList.contains('hidden')) renderReport(); },

    frame() {
      const now = performance.now();
      const dt = now - last;
      last = now;
      frames.push(dt);
      if (frames.length > 180) frames.shift();
      const avg = frames.reduce((a, b) => a + b, 0) / frames.length;
      fps = 1000 / avg;
      const sorted = [...frames].sort((a, b) => b - a);
      fps1pctLow = 1000 / (sorted[Math.floor(sorted.length * 0.01)] ?? avg);
      fpsMin = 1000 / (sorted[0] ?? avg);
    },

    update() {
      const s = director.state;
      bar.querySelector('#hud-stage').textContent = s.stage;
      bar.querySelector('#hud-msg').textContent = s.message;
      const info = renderer.info;
      bar.querySelector('#hud-nums').innerHTML =
        `<span><b>${fps.toFixed(0)}</b> fps</span>` +
        `<span><b>${info.render.calls}</b> draws</span>` +
        `<span><b>${graph.count()}</b> nodes</span>` +
        `<span><b>${issuedCount()}</b> ids</span>` +
        `<span><b>${s.cutsMade}</b> cuts</span>` +
        `<span><b>${s.nailsDriven}</b> nails</span>` +
        `<span><b>${s.panelsBuilt}</b> panels</span>` +
        `<span><b>${s.cratesBuilt}</b> crates</span>` +
        `<span><b>${ops.openOps().length}</b> ops</span>` +
        (s.faults.length ? `<span class="bad"><b>${s.faults.length}</b> faults</span>` : '');
    },

    get fps() { return fps; },
    get fps1pctLow() { return fps1pctLow; },
    get fpsMin() { return fpsMin; },
  };
}
