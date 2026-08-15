/**
 * The inspector.
 *
 * V1-TEST K75: "Any object can be selected and shows id, type, dimensions,
 * position, rotation, state, stage, parent, children, connections, fasteners,
 * collision bounds, interaction points, history and origin."
 * V1-TEST K76: "Every claim in sections A to J is checkable from that
 * inspector, without reading the console."
 *
 * So this panel is not a debug convenience. It is the instrument the project is
 * checked with, and everything it prints is read live from the graph and the
 * scene — never cached, never summarised.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { toMm, toDeg } from '../../knowledge/units.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import * as graph from '../core/graph.js';
import * as ops from '../core/ops.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const n1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const n2 = (v) => (v == null ? '—' : Number(v).toFixed(2));

export function createInspector({ scene, camera, renderer, dom, nails, onFocus }) {
  const panel = document.createElement('div');
  panel.id = 'inspector';
  panel.className = 'panel hidden';
  dom.appendChild(panel);

  const ray = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const box = new THREE.Box3();
  const size = new THREE.Vector3();
  const centre = new THREE.Vector3();

  let selectedId = null;
  let highlight = null;

  function clearHighlight() {
    if (highlight) { highlight.parent?.remove(highlight); highlight.geometry.dispose(); highlight = null; }
  }

  function setHighlight(object3D) {
    clearHighlight();
    if (!object3D) return;
    box.setFromObject(object3D);
    if (box.isEmpty()) return;
    box.getSize(size); box.getCenter(centre);
    const geo = new THREE.BoxGeometry(size.x * 1.02, size.y * 1.02, size.z * 1.02);
    highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x4dd2ff, depthTest: false })
    );
    geo.dispose();
    highlight.renderOrder = 999;
    highlight.position.copy(centre);
    scene.add(highlight);
  }

  /** Resolve a raycast hit to a graph node — walking up for grouped meshes. */
  function nodeFromHit(hit) {
    if (hit.object.userData.nailField != null && hit.instanceId != null) {
      return nails.nodeForInstance(hit.object.userData.nailField, hit.instanceId);
    }
    let o = hit.object;
    while (o) {
      if (o.userData.owId) return graph.get(o.userData.owId);
      if (o.name && graph.get(o.name)) return graph.get(o.name);
      o = o.parent;
    }
    return null;
  }

  function pick(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(pointer, camera);
    const hits = ray.intersectObjects(scene.children, true);
    for (const h of hits) {
      if (h.object === highlight) continue;
      const node = nodeFromHit(h);
      if (node) return node;
    }
    return null;
  }

  function select(id) {
    selectedId = id;
    const node = id ? graph.get(id) : null;
    setHighlight(node?.view?.object3D ?? null);
    render();
  }

  /* ---------------- rendering the panel ---------------- */

  function liveTransform(node) {
    const o = node.view?.object3D;
    if (!o) return null;
    const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    o.updateWorldMatrix(true, false);
    o.matrixWorld.decompose(p, q, s);
    const e = new THREE.Euler().setFromQuaternion(q);
    box.setFromObject(o); box.getSize(size);
    return {
      positionMm: [toMm(p.x), toMm(p.y), toMm(p.z)],
      rotationDeg: [toDeg(e.x), toDeg(e.y), toDeg(e.z)],
      boundsMm: [toMm(size.x), toMm(size.y), toMm(size.z)],
      bottomMm: toMm(box.min.y),
    };
  }

  function row(k, v) { return `<div class="r"><span>${esc(k)}</span><b>${v}</b></div>`; }

  function idLink(id) {
    return id ? `<a href="#" data-id="${esc(id)}">${esc(id)}</a>` : '—';
  }

  function render() {
    const node = selectedId ? graph.get(selectedId) : null;
    if (!node) { panel.classList.add('hidden'); return; }
    panel.classList.remove('hidden');

    const t = liveTransform(node);
    const d = node.dimsMm ?? {};
    const lin = graph.lineage(node.id);
    const tree = graph.componentTree(node.id);
    const leaves = graph.leafParts(node.id);

    let html = `<div class="head">
      <div><span class="kind">${esc(node.kind)}</span> <b>${esc(node.id)}</b></div>
      <button id="insp-close" aria-label="close">×</button>
    </div>
    <div class="body">`;

    html += `<div class="sec">${esc(node.type)}</div>`;
    html += row('state', `<span class="pill">${esc(node.state)}</span>`);
    html += row('stage', esc(node.stage ?? '—'));

    /* dimensions */
    html += `<div class="sec">dimensions (mm)</div>`;
    if (d.lengthMm != null) html += row('length', n2(d.lengthMm));
    if (d.thicknessMm != null) html += row('thickness', n2(d.thicknessMm));
    if (d.widthMm != null) html += row('width', n2(d.widthMm));
    if (d.heightMm != null) html += row('height', n2(d.heightMm));
    if (d.diameterMm != null) html += row('diameter', n2(d.diameterMm));
    if (d.volumeMm3 != null) html += row('volume', `${(d.volumeMm3 / 1000).toFixed(1)} cm³`);
    if (d.massKg != null) html += row('mass', `${n2(d.massKg)} kg`);
    if (d.partCount != null) html += row('parts', d.partCount);

    /* live transform */
    if (t) {
      html += `<div class="sec">world transform</div>`;
      html += row('position', t.positionMm.map(n1).join(', '));
      html += row('rotation', t.rotationDeg.map(n1).join(', ') + ' °');
      html += row('bounds', t.boundsMm.map(n1).join(' × '));
      html += row('lowest point', `${n1(t.bottomMm)} mm`);
    }

    /* hierarchy */
    html += `<div class="sec">hierarchy</div>`;
    html += row('parent', idLink(node.parentId));
    html += row('children', node.childIds.length
      ? node.childIds.map(idLink).join(' ') : '—');
    if (leaves.length > 1) html += row('leaf parts', leaves.length);

    /* lineage */
    html += `<div class="sec">origin</div>`;
    html += row('cut from', idLink(node.cutFromId));
    html += row('origin', node.origin?.id ? idLink(node.origin.id) : esc(node.origin?.kind ?? '—'));
    if (lin.length > 1) {
      html += `<div class="chain">${lin.map((l, i) =>
        `${i ? '<span class="arrow">←</span>' : ''}<a href="#" data-id="${esc(l.id)}">${esc(l.id)}</a>`
      ).join('')}</div>`;
    }

    /* connections and fasteners */
    html += `<div class="sec">connections</div>`;
    html += row('fasteners', node.fastenerIds.length
      ? `${node.fastenerIds.length} <span class="muted">${node.fastenerIds.slice(0, 4).map(idLink).join(' ')}${node.fastenerIds.length > 4 ? ' …' : ''}</span>`
      : '—');
    if (node.connectsIds.length) html += row('connects', node.connectsIds.map(idLink).join(' '));
    html += row('contacts', node.connections.length
      ? node.connections.slice(0, 6).map((c) => `${esc(c.kind)}→${idLink(c.to)}`).join('<br>') : '—');

    /* fastener specifics */
    if (node.kind === 'NAL') {
      html += `<div class="sec">fastener</div>`;
      html += row('joint', esc(node.meta.jointId ?? '—'));
      html += row('penetration', `${n2(node.meta.penetrationMm)} mm`);
      html += row('protrusion', `${n2(node.meta.protrusionMm)} mm`);
      html += row('clinched', node.meta.clinched ? 'yes' : 'no');
      html += row('axis error', `${n2(node.meta.axisErrorDeg)} ° <span class="muted">tol ${TOLERANCES.angleDeg}</span>`);
      html += row('members', (node.meta.members ?? []).map(idLink).join(' '));
    }

    /* collision */
    html += `<div class="sec">collision</div>`;
    html += row('group', esc(node.meta.collisionGroup ?? (node.kind === 'NAL' ? 'FASTENER' : 'STOCK')));
    const open = ops.openOps().filter((o) => o.participants.includes(node.id));
    html += row('open operations', open.length ? open.map((o) => `${esc(o.type)} <span class="muted">${esc(o.handle)}</span>`).join('<br>') : 'none');

    /* history */
    html += `<div class="sec">history (${node.history.length})</div>`;
    html += `<div class="hist">` + node.history.slice(-14).map((h) =>
      `<div class="h"><span class="seq">${h.seq}</span><b>${esc(h.op)}</b>` +
      `<span class="muted">${esc(h.stage ?? '')}</span>` +
      (Object.keys(h.detail ?? {}).length
        ? `<div class="det">${esc(JSON.stringify(h.detail).slice(0, 180))}</div>` : '') +
      `</div>`).join('') + `</div>`;

    /* component tree */
    if (tree && tree.children.length) {
      html += `<div class="sec">component tree</div><div class="tree">`;
      const walk = (t2) => {
        html += `<div style="padding-left:${t2.depth * 10}px">` +
          `<a href="#" data-id="${esc(t2.id)}">${esc(t2.id)}</a> ` +
          `<span class="muted">${esc(t2.type)}</span></div>`;
        t2.children.forEach(walk);
      };
      tree.children.forEach(walk);
      html += `</div>`;
    }

    html += `<div class="acts"><button id="insp-focus">focus camera</button></div>`;
    html += `</div>`;
    panel.innerHTML = html;

    panel.querySelector('#insp-close')?.addEventListener('click', () => select(null));
    panel.querySelector('#insp-focus')?.addEventListener('click', () => {
      const o = graph.get(selectedId)?.view?.object3D;
      if (o) {
        box.setFromObject(o); box.getCenter(centre); box.getSize(size);
        onFocus?.([toMm(centre.x), toMm(centre.y), toMm(centre.z)],
          Math.max(toMm(size.length()) * 2.2, 1200));
      }
    });
    panel.querySelectorAll('a[data-id]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); select(a.dataset.id); });
    });
  }

  return {
    panel,
    select,
    get selectedId() { return selectedId; },
    pickAt(x, y) {
      const node = pick(x, y);
      select(node?.id ?? null);
      return node;
    },
    /** Re-read live values; the panel shows the world as it is now. */
    refresh() { if (selectedId) render(); if (highlight) setHighlight(graph.get(selectedId)?.view?.object3D); },
  };
}
