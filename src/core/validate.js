/**
 * The runtime validation report.
 *
 * V1-TEST K78: "A validation report lists any floating, interpenetrating or
 * orphaned object, and reads clean at the end of a cycle."
 *
 * This runs against the live scene and the live graph, using the tolerances in
 * knowledge/tolerances.js. It is the thing that turns "it looks right" into a
 * number, and it is deliberately allowed to fail loudly.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import { toMm } from '../../knowledge/units.js';
import * as graph from './graph.js';
import * as ops from './ops.js';

const _boxA = new THREE.Box3();
const _boxB = new THREE.Box3();

/** States whose objects are physical and must obey the physical checks. */
const PHYSICAL = new Set([
  'STOCK', 'CLAMPED', 'CUT', 'OFFCUT', 'ON_CONVEYOR', 'PLACED', 'FASTENED', 'IN_ASSEMBLY', 'HELD',
]);

/** Objects that are gone from the world but kept in the graph for lineage. */
const NON_PHYSICAL = new Set(['CONSUMED', 'SCRAPPED', 'KERF_WASTE']);


/** Is `ancestorId` above `nodeId` in the containment hierarchy? */
function isAncestor(ancestorId, nodeId) {
  let n = graph.get(nodeId);
  let guard = 0;
  while (n?.parentId && guard++ < 64) {
    if (n.parentId === ancestorId) return true;
    n = graph.get(n.parentId);
  }
  return false;
}

function worldBox(node, out) {
  if (!node.view?.object3D) return null;
  out.setFromObject(node.view.object3D);
  return out.isEmpty() ? null : out;
}

/**
 * Full report. `supportSurfaces` are world-space Y planes an object may rest
 * on (ground, tables, conveyors, bed floors) supplied by the scene.
 */
export function validateWorld({ nowMs = 0, supportSurfaces = [] } = {}) {
  const floating = [];
  const interpenetrating = [];
  const orphaned = [];
  const illegal = [];

  const physical = graph.all().filter(
    (n) => n.view?.object3D && PHYSICAL.has(n.state) && !NON_PHYSICAL.has(n.state)
  );

  /* ---- floating: every physical object rests on something -------- */
  for (const n of physical) {
    // Held parts are supported by the gripper; parts inside an assembly are
    // supported by the assembly. Both are recorded relationships, not excuses:
    // if the relationship is missing, it still reports.
    if (n.state === 'HELD') {
      if (!n.meta.heldBy) floating.push({ id: n.id, why: 'state HELD but nothing holds it' });
      continue;
    }
    if (n.parentId) continue;

    const b = worldBox(n, _boxA);
    if (!b) continue;
    const bottomMm = toMm(b.min.y);
    let best = Infinity;
    for (const s of supportSurfaces) {
      if (b.max.x < s.minX || b.min.x > s.maxX || b.max.z < s.minZ || b.min.z > s.maxZ) continue;
      best = Math.min(best, Math.abs(bottomMm - s.topMm));
    }
    // Or resting on another physical object.
    if (best > TOLERANCES.supportMm) {
      for (const m of physical) {
        if (m === n || m.parentId) continue;
        const c = worldBox(m, _boxB);
        if (!c) continue;
        if (b.max.x < c.min.x || b.min.x > c.max.x || b.max.z < c.min.z || b.min.z > c.max.z) continue;
        best = Math.min(best, Math.abs(bottomMm - toMm(c.max.y)));
      }
    }
    if (best > TOLERANCES.supportMm) {
      floating.push({ id: n.id, type: n.type, gapMm: Number.isFinite(best) ? +best.toFixed(2) : null });
    }
  }

  /* ---- interpenetration: outside a declared operation ------------ */
  // Broad phase on world boxes. Parts inside the same assembly are expected to
  // touch, and touching within penetrationMm is contact, not overlap.
  //
  // Installed machines are excluded from the pairwise test, and the report says
  // so rather than hiding it. Their axis-aligned bounds are not their collision
  // volumes — a saw's AABB spans its own outfeed and offcut bin — so testing
  // AABB against AABB would report overlaps that are not overlaps. What matters
  // here, and what is tested, is workpiece against workpiece.
  const movable = physical.filter((n) => !n.meta.staticInstalled);
  const excludedStatic = physical.length - movable.length;
  const tol = TOLERANCES.penetrationMm / 1000; // world units
  for (let i = 0; i < movable.length; i++) {
    const a = movable[i];
    const ba = worldBox(a, _boxA);
    if (!ba) continue;
    const baClone = ba.clone();
    for (let j = i + 1; j < movable.length; j++) {
      const b = movable[j];
      const bb = worldBox(b, _boxB);
      if (!bb) continue;
      const ox = Math.min(baClone.max.x, bb.max.x) - Math.max(baClone.min.x, bb.min.x);
      const oy = Math.min(baClone.max.y, bb.max.y) - Math.max(baClone.min.y, bb.min.y);
      const oz = Math.min(baClone.max.z, bb.max.z) - Math.max(baClone.min.z, bb.min.z);
      const depth = Math.min(ox, oy, oz);
      if (ox <= tol || oy <= tol || oz <= tol) continue;

      const permitted = ops.overlapPermitted(a.id, b.id);
      if (permitted.allowed) continue;
      // Two parts of the same assembly may share a fastener region.
      if (a.parentId && a.parentId === b.parentId) continue;
      // A part necessarily overlaps the bounds of the assembly it is inside,
      // and of that assembly's assembly. Reporting it would be reporting that
      // a board is inside the crate it is part of.
      if (isAncestor(a.id, b.id) || isAncestor(b.id, a.id)) continue;
      interpenetrating.push({
        a: a.id, b: b.id, depthMm: +toMm(depth).toFixed(2),
      });
    }
  }

  /* ---- orphans: derived material with no source ------------------ */
  for (const n of graph.all()) {
    if ((n.kind === 'BRD' || n.kind === 'OFF' || n.kind === 'KRF' || n.kind === 'REM') && !n.cutFromId) {
      orphaned.push({ id: n.id, why: 'derived piece with no parent stock' });
    }
    if (n.kind === 'NAL' && n.connectsIds.length !== 2 && n.state === 'FASTENED') {
      orphaned.push({ id: n.id, why: `driven fastener connects ${n.connectsIds.length} members, expected 2` });
    }
  }

  /* ---- operations left open too long ----------------------------- */
  for (const s of ops.stuckOps(nowMs)) {
    illegal.push({ id: s.handle, why: `${s.type} open ${s.openMs} ms, limit ${s.maxMs} ms` });
  }

  const balance = graph.worldBalance();
  const balanceOk = Math.abs(balance.errorMm) <= TOLERANCES.materialBalancePerCutMm * Math.max(1, balance.stockCount * 12);

  return {
    nowMs,
    clean: floating.length === 0 && interpenetrating.length === 0 &&
           orphaned.length === 0 && illegal.length === 0 && balanceOk,
    counts: {
      checked: physical.length,
      pairChecked: movable.length,
      staticExcluded: excludedStatic,
      floating: floating.length,
      interpenetrating: interpenetrating.length,
      orphaned: orphaned.length,
      illegal: illegal.length,
    },
    floating, interpenetrating, orphaned, illegal,
    balance, balanceOk,
    tolerancesUsed: {
      supportMm: TOLERANCES.supportMm,
      penetrationMm: TOLERANCES.penetrationMm,
      contactMm: TOLERANCES.contactMm,
    },
  };
}

/** Contact test with tolerance, for "these boards are touching" (V1-TEST G49). */
export function facesTouching(boxA, boxB, axis = 'y') {
  const gap = axis === 'y' ? boxB.min.y - boxA.max.y
    : axis === 'x' ? boxB.min.x - boxA.max.x
    : boxB.min.z - boxA.max.z;
  return Math.abs(toMm(gap)) <= TOLERANCES.contactMm;
}
