/**
 * Permanent identity.
 *
 * Invariant 2: every board, fastener, panel and crate has an id it keeps
 * forever, including after it joins a larger assembly.
 * V1-TEST B11: ids are never reused, including across repeated production
 * cycles.
 *
 * The counter is monotonic and never decremented, never reset between cycles,
 * and never reclaimed when an object is consumed. A consumed board keeps its id
 * because its children still point at it.
 */

const counters = new Map();
let totalIssued = 0;

/** Prefixes, so an id says what kind of thing it is on sight. */
export const KIND = Object.freeze({
  STOCK: 'LUM',      // a stick of raw lumber as delivered
  REMAINDER: 'REM',  // what is left of a stick between cuts, still usable
  PIECE: 'BRD',      // a cut piece with a place in the bill of materials
  OFFCUT: 'OFF',     // what is left of a stick when the last piece is taken
  KERF: 'KRF',       // the material a saw cut destroyed
  NAIL: 'NAL',
  PANEL: 'PNL',
  CRATE: 'CRT',
  PALLET: 'PAL',
  MACHINE: 'MCH',
  ROBOT: 'RBT',
  TOOL: 'TLA',
  VEHICLE: 'VEH',
  BUILDING: 'BLD',
  FIXTURE: 'FIX',
});

/**
 * Issue a new id. There is no way to ask for a specific one, and no way to
 * release one.
 * @param {string} kind one of KIND
 * @returns {string} e.g. "BRD-000042"
 */
export function newId(kind) {
  const n = (counters.get(kind) ?? 0) + 1;
  counters.set(kind, n);
  totalIssued++;
  return `${kind}-${String(n).padStart(6, '0')}`;
}

/** How many ids have ever been issued. Used by the leak check (V1-TEST J73). */
export function issuedCount() {
  return totalIssued;
}

/** Per-kind counts, for the validation report. */
export function issuedByKind() {
  return Object.fromEntries(counters);
}

/**
 * Snapshot and restore, for persistence (V1-TEST B18). Restoring never lowers a
 * counter — if a saved file is older than the live session, the live session
 * wins, because lowering would let an id be reused.
 */
export function snapshotCounters() {
  return { counters: Object.fromEntries(counters), totalIssued };
}

export function restoreCounters(snap) {
  if (!snap) return;
  for (const [k, v] of Object.entries(snap.counters ?? {})) {
    counters.set(k, Math.max(counters.get(k) ?? 0, v));
  }
  totalIssued = Math.max(totalIssued, snap.totalIssued ?? 0);
}
