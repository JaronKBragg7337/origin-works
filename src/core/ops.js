/**
 * Scoped operations at runtime.
 *
 * The collision spec in knowledge/collision.js says what an operation is. This
 * is the register that holds the open ones and answers "is this specific
 * overlap allowed right now?".
 *
 * V1-TEST H57: interpenetration is scoped to the participating objects, the
 * tool, the region and the duration — never a global switch. There is no
 * function in this file that disables collision, and that is deliberate.
 */

import { OPERATIONS, makeOperation, penetrationAllowed } from '../../knowledge/collision.js';
import * as graph from './graph.js';

/** Open operations, keyed by a handle. */
const open = new Map();
let handleSeq = 0;

/** Closed operations that left permanent penetration (a driven nail). */
const standing = [];

/**
 * Open an operation. Throws unless it names a type, a tool where the type needs
 * one, at least one participant, a bounded region and the stage that opened it.
 */
export function openOp({ type, toolId, participantIds, region, stage, nowMs }) {
  const op = makeOperation({ type, toolId, participantIds, region, openedAtMs: nowMs, stage });
  const handle = `OP${++handleSeq}`;
  open.set(handle, { ...op, handle });
  for (const id of participantIds) graph.record(id, `OP_OPEN:${type}`, { handle, toolId }, stage);
  return handle;
}

/**
 * Close an operation and run the validations its type declares. Returns the
 * findings; an empty array means the operation did what it claimed.
 *
 * @param {function} validator called with the op, returns string[] of problems
 */
export function closeOp(handle, validator = () => []) {
  const op = open.get(handle);
  if (!op) throw new Error(`No open operation ${handle}`);
  const findings = validator(op) ?? [];
  for (const id of op.participantIds) {
    graph.record(id, `OP_CLOSE:${op.type}`, { handle, findings }, op.stage);
  }
  open.delete(handle);
  // A driven nail permanently occupies wood. The *driving* ends; the resulting
  // penetration becomes a declared standing joint rather than a mystery overlap.
  if (op.spec.penetrationPersists) {
    standing.push({ type: op.type, participantIds: op.participantIds, region: op.region });
  }
  return findings;
}

/** Is an overlap between these two ids permitted right now, at this point? */
export function overlapPermitted(idA, idB, pointInRegion = true) {
  for (const op of open.values()) {
    if (penetrationAllowed(op, idA, idB, pointInRegion)) return { allowed: true, by: op.type, handle: op.handle };
  }
  for (const s of standing) {
    if (s.participantIds.includes(idA) && s.participantIds.includes(idB)) {
      return { allowed: true, by: `${s.type} (standing joint)`, handle: null };
    }
  }
  return { allowed: false };
}

/** Every open operation, for the HUD and the inspector. */
export function openOps() {
  return [...open.values()].map((o) => ({
    handle: o.handle, type: o.type, tool: o.toolId,
    participants: o.participantIds, stage: o.stage, openedAtMs: o.openedAtMs,
  }));
}

export function standingJoints() {
  return standing.length;
}

/** Anything left open longer than its type permits is a stuck operation. */
export function stuckOps(nowMs) {
  const out = [];
  for (const o of open.values()) {
    const max = OPERATIONS[o.type]?.maxDurationMs;
    if (max != null && nowMs - o.openedAtMs > max) {
      out.push({ handle: o.handle, type: o.type, openMs: Math.round(nowMs - o.openedAtMs), maxMs: max });
    }
  }
  return out;
}

export function reset() {
  open.clear();
  standing.length = 0;
  handleSeq = 0;
}
