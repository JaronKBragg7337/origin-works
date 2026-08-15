/**
 * The assembly graph.
 *
 * This is the source of truth. The Three.js scene is a *view* of it. If the
 * graph does not say a board was cut, then no amount of animation makes it so
 * (invariant 10, V1-TEST 10).
 *
 * Every node carries: id, type, dimensions, state, stage, parent, children,
 * connections, fasteners, collision bounds, interaction points, history and
 * origin — which is the list V1-TEST 75 asks the inspector to show.
 */

import { newId, KIND } from './ids.js';

/** id -> node. Nodes are never deleted; consumed ones stay for lineage. */
const nodes = new Map();

/** Monotonic tick, so history entries order deterministically without a clock. */
let seq = 0;

/**
 * Create a node.
 *
 * `origin` is a **link**, not a string — VISION.md stage 2 extends lineage
 * behind lumber to logs and trees, and that has to work without rewriting
 * anything here.
 */
export function createNode({
  kind, type, specId = null, dimsMm = null, state = 'STOCK', stage = null,
  originId = null, originKind = null, cutFromId = null, meta = {},
}) {
  const id = newId(kind);
  const node = {
    id, kind, type, specId,
    dimsMm: dimsMm ? { ...dimsMm } : null,
    state, stage,
    parentId: null,
    childIds: [],
    /** Non-hierarchical links: "this board touches that board". */
    connections: [],
    /** Fastener ids that pass through this node. */
    fastenerIds: [],
    /** For a fastener: the node ids it connects. V1-TEST F45. */
    connectsIds: [],
    /** Where it came from. A link, so it can point at a log one day. */
    origin: { id: originId, kind: originKind },
    cutFromId,
    history: [],
    /** Filled by the view layer so the inspector can read live transforms. */
    view: null,
    meta,
  };
  nodes.set(id, node);
  record(id, 'CREATED', { type, state, dimsMm });
  return node;
}

export function get(id) {
  return nodes.get(id) ?? null;
}

export function all() {
  return [...nodes.values()];
}

export function count() {
  return nodes.size;
}

export function findBy(pred) {
  return [...nodes.values()].filter(pred);
}

/**
 * Append to an object's history. V1-TEST B17: each object carries a history of
 * the operations performed on it, in order, with the stage that performed each.
 */
export function record(id, op, detail = {}, stage = null) {
  const n = nodes.get(id);
  if (!n) return;
  n.history.push({ seq: seq++, op, stage: stage ?? n.stage, detail });
}

/** Change state, and record it. State is a single field, so an object can never
 *  be in two states — which is how V1-TEST I64 is made structurally impossible. */
export function setState(id, state, stage = null) {
  const n = nodes.get(id);
  if (!n) return;
  const from = n.state;
  n.state = state;
  if (stage) n.stage = stage;
  record(id, 'STATE', { from, to: state }, stage);
}

/**
 * Put `childId` inside `parentId`. Identity is not erased (V1-TEST B14) — the
 * child keeps its id, its history and its own children. The parent gains a
 * reference, nothing is merged.
 */
export function attach(parentId, childId, stage = null) {
  const p = nodes.get(parentId), c = nodes.get(childId);
  if (!p || !c) throw new Error(`attach: missing node ${!p ? parentId : childId}`);
  if (c.parentId && c.parentId !== parentId) {
    throw new Error(
      `${childId} is already in ${c.parentId}; an object cannot be in two ` +
      `assemblies at once (V1-TEST I64)`
    );
  }
  if (!p.childIds.includes(childId)) p.childIds.push(childId);
  c.parentId = parentId;
  record(childId, 'ATTACHED', { to: parentId }, stage);
  record(parentId, 'RECEIVED', { child: childId }, stage);
}

/** Record that two parts touch, both ways. */
export function connect(aId, bId, kind = 'CONTACT', detail = {}) {
  const a = nodes.get(aId), b = nodes.get(bId);
  if (!a || !b) throw new Error('connect: missing node');
  a.connections.push({ to: bId, kind, ...detail });
  b.connections.push({ to: aId, kind, ...detail });
}

/**
 * Register a fastener between two members. V1-TEST F45: both connected parts
 * list the fastener, and the fastener lists both parts. Enforced here so it
 * cannot be half-done.
 */
export function fasten(fastenerId, aId, bId, detail = {}) {
  const f = nodes.get(fastenerId), a = nodes.get(aId), b = nodes.get(bId);
  if (!f || !a || !b) throw new Error('fasten: missing node');
  f.connectsIds = [aId, bId];
  if (!a.fastenerIds.includes(fastenerId)) a.fastenerIds.push(fastenerId);
  if (!b.fastenerIds.includes(fastenerId)) b.fastenerIds.push(fastenerId);
  record(fastenerId, 'DRIVEN', { into: [aId, bId], ...detail });
  record(aId, 'FASTENED', { fastener: fastenerId, to: bId, ...detail });
  record(bId, 'FASTENED', { fastener: fastenerId, to: aId, ...detail });
}

/* ------------------------------------------------------------------ *
 * Lineage
 * ------------------------------------------------------------------ */

/**
 * The path from a piece back to raw stock. V1-TEST B16.
 * Follows `cutFromId` then `origin.id`, so it will keep working when lumber
 * gains a log above it.
 */
export function lineage(id) {
  const chain = [];
  let cur = nodes.get(id);
  const guard = new Set();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    chain.push({ id: cur.id, kind: cur.kind, type: cur.type, state: cur.state });
    const nextId = cur.cutFromId ?? cur.origin?.id ?? null;
    cur = nextId ? nodes.get(nextId) : null;
  }
  return chain;
}

/**
 * The full component tree under a node. V1-TEST B15: selecting a finished crate
 * returns its full component tree.
 */
export function componentTree(id, depth = 0) {
  const n = nodes.get(id);
  if (!n) return null;
  return {
    id: n.id, kind: n.kind, type: n.type, state: n.state, depth,
    dimsMm: n.dimsMm,
    fastenerIds: [...n.fastenerIds],
    children: n.childIds.map((c) => componentTree(c, depth + 1)),
  };
}

/** Flatten a component tree to a list of leaf part ids. */
export function leafParts(id) {
  const out = [];
  const walk = (nid) => {
    const n = nodes.get(nid);
    if (!n) return;
    if (n.childIds.length === 0) out.push(n.id);
    else n.childIds.forEach(walk);
  };
  walk(id);
  return out;
}

/** Root of whatever assembly this node is in. */
export function rootOf(id) {
  let n = nodes.get(id);
  while (n?.parentId) n = nodes.get(n.parentId);
  return n ?? null;
}

/* ------------------------------------------------------------------ *
 * Material accounting
 * ------------------------------------------------------------------ */

/**
 * Balance one cut: the parent's length must equal its children's lengths plus
 * the kerf. V1-TEST A7 and A8, checked against the graph rather than asserted.
 */
export function cutBalance(parentId) {
  const p = nodes.get(parentId);
  if (!p) return null;
  const kids = p.childIds.map((c) => nodes.get(c)).filter(Boolean);
  const outMm = kids.filter((k) => k.kind !== KIND.KERF).reduce((a, k) => a + (k.dimsMm?.lengthMm ?? 0), 0);
  const kerfMm = kids.filter((k) => k.kind === KIND.KERF).reduce((a, k) => a + (k.dimsMm?.lengthMm ?? 0), 0);
  const inMm = p.dimsMm?.lengthMm ?? 0;
  return { inMm, outMm, kerfMm, errorMm: inMm - (outMm + kerfMm) };
}

/**
 * Whole-world material balance: every stick of stock ever created against
 * everything derived from it. V1-TEST A9 and J74.
 */
export function worldBalance() {
  // Input is only material that entered the world from outside: a delivered
  // stick has no cutFromId. A remainder between cuts is *not* input — its
  // material is already counted in the stick it came from, and counting it
  // again inflates the input side by the whole intermediate chain.
  const delivered = findBy((n) => n.kind === KIND.STOCK && !n.cutFromId);
  let inMm = 0, pieceMm = 0, offcutMm = 0, kerfMm = 0, remainderMm = 0, orphanMm = 0;
  for (const s of delivered) inMm += s.dimsMm?.lengthMm ?? 0;

  // Output is every leaf of the cutting tree: nothing that was itself cut up,
  // because its children already account for it.
  for (const n of nodes.values()) {
    if (n.state === 'CONSUMED') continue;
    const L = n.dimsMm?.lengthMm ?? 0;
    if (n.kind === KIND.PIECE) pieceMm += L;
    else if (n.kind === KIND.OFFCUT) offcutMm += L;
    else if (n.kind === KIND.KERF) kerfMm += L;
    else if (n.kind === KIND.REMAINDER) remainderMm += L;
  }
  for (const n of nodes.values()) {
    if ((n.kind === KIND.PIECE || n.kind === KIND.OFFCUT || n.kind === KIND.REMAINDER) && !n.cutFromId) {
      orphanMm += n.dimsMm?.lengthMm ?? 0;
    }
  }
  const outMm = pieceMm + offcutMm + kerfMm + remainderMm;
  return {
    inMm: +inMm.toFixed(3),
    pieceMm: +pieceMm.toFixed(3),
    offcutMm: +offcutMm.toFixed(3),
    kerfMm: +kerfMm.toFixed(3),
    remainderMm: +remainderMm.toFixed(3),
    errorMm: +(inMm - outMm).toFixed(3),
    orphanMm: +orphanMm.toFixed(3),
    stockCount: delivered.length,
  };
}

/* ------------------------------------------------------------------ *
 * Persistence (V1-TEST B18)
 * ------------------------------------------------------------------ */

export function serialise() {
  return {
    seq,
    nodes: [...nodes.values()].map((n) => ({ ...n, view: undefined })),
  };
}

export function reset() {
  nodes.clear();
  seq = 0;
}

export { KIND };
