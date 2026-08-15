/**
 * Primitive geometry builders.
 *
 * Everything here takes millimetres and converts through `mm()` from
 * knowledge/units.js. No other conversion exists.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm } from '../../knowledge/units.js';

/**
 * A box with chamfered edges, flat shaded, with material groups so a board's
 * end grain can differ from its faces and a freshly sawn end can differ from a
 * mill end.
 *
 * Groups:
 *   0  long faces (+Y, -Y, +Z, -Z)
 *   1  end at +X
 *   2  end at -X
 *   3  chamfer bands and corners
 *
 * Built non-indexed so every facet keeps its own normal and the chamfer reads
 * as a real bevel rather than a smooth blur.
 */
export function chamferedBox(wMm, hMm, dMm, chamferMm = 1.2) {
  const w = mm(wMm) / 2, h = mm(hMm) / 2, d = mm(dMm) / 2;
  const c = Math.min(mm(chamferMm), w * 0.45, h * 0.45, d * 0.45);

  const pos = [];
  const groups = [];   // [start, count, materialIndex] accumulated below
  let vertCount = 0;
  let groupStart = 0;
  let groupMat = -1;

  function beginGroup(mat) {
    if (groupMat === mat) return;
    if (groupMat >= 0) groups.push([groupStart, vertCount - groupStart, groupMat]);
    groupStart = vertCount;
    groupMat = mat;
  }
  function tri(a, b, cc) {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2]);
    vertCount += 3;
  }
  function quad(a, b, cc, dd) { tri(a, b, cc); tri(a, cc, dd); }

  // The eight "shrunk" corner coordinates per axis.
  const X = [-w, w], Y = [-h, h], Z = [-d, d];
  const xi = [-w + c, w - c], yi = [-h + c, h - c], zi = [-d + c, d - c];

  /* --- six inset faces ------------------------------------------- */
  // +X and -X are the ends (groups 1 and 2); the other four are faces (group 0).
  beginGroup(1);
  quad([X[1], yi[0], zi[0]], [X[1], yi[1], zi[0]], [X[1], yi[1], zi[1]], [X[1], yi[0], zi[1]]);
  beginGroup(2);
  quad([X[0], yi[0], zi[1]], [X[0], yi[1], zi[1]], [X[0], yi[1], zi[0]], [X[0], yi[0], zi[0]]);

  beginGroup(0);
  // +Y, -Y
  quad([xi[0], Y[1], zi[1]], [xi[1], Y[1], zi[1]], [xi[1], Y[1], zi[0]], [xi[0], Y[1], zi[0]]);
  quad([xi[0], Y[0], zi[0]], [xi[1], Y[0], zi[0]], [xi[1], Y[0], zi[1]], [xi[0], Y[0], zi[1]]);
  // +Z, -Z
  quad([xi[0], yi[0], Z[1]], [xi[1], yi[0], Z[1]], [xi[1], yi[1], Z[1]], [xi[0], yi[1], Z[1]]);
  quad([xi[0], yi[1], Z[0]], [xi[1], yi[1], Z[0]], [xi[1], yi[0], Z[0]], [xi[0], yi[0], Z[0]]);

  /* --- twelve chamfer bands -------------------------------------- */
  beginGroup(3);
  // Bands running along X (4 of them), between a Y face and a Z face.
  for (const sy of [0, 1]) for (const sz of [0, 1]) {
    const yF = Y[sy], zF = Z[sz], yI = yi[sy], zI = zi[sz];
    const a = [xi[0], yF, zI], b = [xi[1], yF, zI];
    const e = [xi[1], yI, zF], f = [xi[0], yI, zF];
    if ((sy === sz)) quad(a, b, e, f); else quad(f, e, b, a);
  }
  // Bands running along Y, between an X face and a Z face.
  for (const sx of [0, 1]) for (const sz of [0, 1]) {
    const xF = X[sx], zF = Z[sz], xI = xi[sx], zI = zi[sz];
    const a = [xF, yi[0], zI], b = [xF, yi[1], zI];
    const e = [xI, yi[1], zF], f = [xI, yi[0], zF];
    if ((sx === sz)) quad(f, e, b, a); else quad(a, b, e, f);
  }
  // Bands running along Z, between an X face and a Y face.
  for (const sx of [0, 1]) for (const sy of [0, 1]) {
    const xF = X[sx], yF = Y[sy], xI = xi[sx], yI = yi[sy];
    const a = [xF, yI, zi[0]], b = [xF, yI, zi[1]];
    const e = [xI, yF, zi[1]], f = [xI, yF, zi[0]];
    if ((sx === sy)) quad(a, b, e, f); else quad(f, e, b, a);
  }

  /* --- eight corner triangles ------------------------------------ */
  for (const sx of [0, 1]) for (const sy of [0, 1]) for (const sz of [0, 1]) {
    const a = [X[sx], yi[sy], zi[sz]];
    const b = [xi[sx], Y[sy], zi[sz]];
    const cc = [xi[sx], yi[sy], Z[sz]];
    const flip = (sx + sy + sz) % 2 === 1;
    flip ? tri(a, b, cc) : tri(a, cc, b);
  }

  groups.push([groupStart, vertCount - groupStart, groupMat]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  for (const [s, cnt, m] of groups) g.addGroup(s, cnt, m);
  return g;
}

/** Plain box in millimetres. For collision proxies and simple structure. */
export function boxMm(wMm, hMm, dMm) {
  return new THREE.BoxGeometry(mm(wMm), mm(hMm), mm(dMm));
}

/** Cylinder in millimetres, default axis +Y. */
export function cylinderMm(rTopMm, rBotMm, hMm, seg = 16) {
  return new THREE.CylinderGeometry(mm(rTopMm), mm(rBotMm), mm(hMm), seg);
}

/** A steel tube: outer cylinder, for conveyor rollers and machine columns. */
export function tubeMm(rMm, hMm, seg = 12) {
  return new THREE.CylinderGeometry(mm(rMm), mm(rMm), mm(hMm), seg);
}

/**
 * A nail: shank, head and diamond point, as one geometry along +Y with the
 * head at y=0 and the point at y=-length. Built from the real dimensions so
 * V1-TEST F40 ("a real component with diameter, length, head and axis") is
 * satisfied by construction.
 */
export function nailGeometry(nailSpec) {
  const parts = [];
  const rShank = nailSpec.diameterMm / 2;
  const shankLen = nailSpec.lengthMm - nailSpec.pointLengthMm;

  const head = new THREE.CylinderGeometry(
    mm(nailSpec.headDiameterMm / 2), mm(nailSpec.headDiameterMm / 2),
    mm(nailSpec.headThicknessMm), 10
  );
  head.translate(0, mm(-nailSpec.headThicknessMm / 2), 0);
  parts.push(head);

  const shank = new THREE.CylinderGeometry(mm(rShank), mm(rShank), mm(shankLen), 8);
  shank.translate(0, mm(-nailSpec.headThicknessMm - shankLen / 2), 0);
  parts.push(shank);

  const point = new THREE.CylinderGeometry(mm(rShank), 0, mm(nailSpec.pointLengthMm), 8);
  point.translate(0, mm(-nailSpec.headThicknessMm - shankLen - nailSpec.pointLengthMm / 2), 0);
  parts.push(point);

  return mergeGeometries(parts);
}

/** Minimal geometry merge, so no addon import is needed. Positions + normals. */
export function mergeGeometries(list) {
  // Convert first, then count. An indexed geometry expands when it is made
  // non-indexed, so counting before conversion under-allocates the buffer and
  // the last geometry overruns it.
  const flat = list.map((g) => {
    const gg = g.index ? g.toNonIndexed() : g;
    if (!gg.attributes.normal) gg.computeVertexNormals();
    return { src: g, geo: gg };
  });
  let total = 0;
  for (const { geo } of flat) total += geo.attributes.position.count;

  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  let o = 0;
  for (const { src, geo } of flat) {
    pos.set(geo.attributes.position.array, o * 3);
    nor.set(geo.attributes.normal.array, o * 3);
    o += geo.attributes.position.count;
    if (geo !== src) geo.dispose();
    src.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}

/** An extruded rounded-corner plate, for machine panels and guards. */
export function plateMm(wMm, hMm, tMm, rMm = 6) {
  const w = mm(wMm) / 2, h = mm(hMm) / 2, r = Math.min(mm(rMm), w, h);
  const s = new THREE.Shape();
  s.moveTo(-w + r, -h);
  s.lineTo(w - r, -h); s.quadraticCurveTo(w, -h, w, -h + r);
  s.lineTo(w, h - r);  s.quadraticCurveTo(w, h, w - r, h);
  s.lineTo(-w + r, h); s.quadraticCurveTo(-w, h, -w, h - r);
  s.lineTo(-w, -h + r); s.quadraticCurveTo(-w, -h, -w + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: mm(tMm), bevelEnabled: false, curveSegments: 3 });
  g.translate(0, 0, -mm(tMm) / 2);
  return g;
}
