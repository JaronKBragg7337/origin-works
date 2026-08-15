/**
 * Recipes and stages. Millimetres.
 *
 * Invariant 7: deterministic, no runtime AI. Production runs from recipes and
 * state machines (V1-TEST I62), stages hand off explicitly (I66), and the same
 * seed and inputs produce the same result (I68).
 *
 * A recipe is data. It says what goes in, what comes out, and what the machine
 * does in between. It does not say when, because "when" is the state machine's
 * business and a timer must never be what advances a stage.
 */

import { PROFILES } from '../material/lumber.js';
import { BLADE } from '../saw/crosscut-saw.js';
import { BOM } from '../crate/crate-ow-c1.js';
import { STOCK_LENGTHS_MM } from '../material/lumber.js';

/** The three factories on the map. One crate crosses all three. */
export const STAGES = Object.freeze([
  Object.freeze({
    id: 'CUT_SHOP',
    label: 'Cut shop',
    consumes: 'stock lumber',
    produces: 'cut pieces, offcuts, kerf waste',
    machines: ['OW-S1', 'OW-A6', 'OW-C'],
    answers: ['V1-TEST A', 'V1-TEST C'],
  }),
  Object.freeze({
    id: 'PANEL_SHOP',
    label: 'Panel shop',
    consumes: 'cut pieces',
    produces: 'base, two sides, two ends, lid',
    machines: ['OW-A6', 'OW-N1', 'OW-C'],
    answers: ['V1-TEST F', 'V1-TEST G (panels)'],
  }),
  Object.freeze({
    id: 'CRATE_SHOP',
    label: 'Crate shop',
    consumes: 'panels',
    produces: 'closed crate on a pallet',
    machines: ['OW-A6', 'OW-N1', 'OW-F15'],
    answers: ['V1-TEST G (crate)', 'V1-TEST H'],
  }),
]);

/**
 * Handoffs. A stage advances when the *next* stage acknowledges receipt of a
 * named manifest, not when a duration elapses. This is the mechanism behind
 * V1-TEST I66, and it is the same mechanism VISION.md stage 5 will use to move
 * an object between worlds — which is why it is a manifest and not a callback.
 */
export const HANDOFFS = Object.freeze([
  Object.freeze({ id: 'H1', from: 'CUT_SHOP', to: 'PANEL_SHOP', via: 'OW-T7', manifest: 'cut-piece list with ids' }),
  Object.freeze({ id: 'H2', from: 'PANEL_SHOP', to: 'CRATE_SHOP', via: 'OW-T7', manifest: 'panel list with component trees' }),
  Object.freeze({ id: 'H3', from: 'CRATE_SHOP', to: 'YARD', via: 'OW-F15', manifest: 'crate on pallet' }),
]);

/**
 * The cut list, grouped by profile. Derived from the crate's bill of materials
 * so the two can never disagree.
 */
export function cutList() {
  const byProfile = new Map();
  for (const item of BOM) {
    const key = item.profile.id;
    if (!byProfile.has(key)) byProfile.set(key, { profile: item.profile, pieces: [] });
    for (let i = 0; i < item.qty; i++) {
      byProfile.get(key).pieces.push({ bomId: item.id, role: item.role, panel: item.panel, lengthMm: item.lengthMm });
    }
  }
  return byProfile;
}

/**
 * Plan the cuts for one profile: pack the required pieces into stock lengths,
 * longest first, accounting for the kerf on every cut.
 *
 * This is where V1-TEST A5 and A7 are decided. The kerf is removed from the
 * material here, in the plan, before any geometry exists — so the world cannot
 * later "forget" it.
 *
 * Deterministic by construction: sorted input, no randomness, no time.
 *
 * @param {number[]} pieceLengthsMm
 * @param {number} stockLengthMm
 * @param {number} kerfMm
 */
export function planCuts(pieceLengthsMm, stockLengthMm, kerfMm = BLADE.kerfMm) {
  const remaining = [...pieceLengthsMm].sort((a, b) => b - a);
  const sticks = [];

  while (remaining.length > 0) {
    const stick = { stockLengthMm, pieces: [], kerfCount: 0, offcutMm: 0 };
    let used = 0;
    for (let i = 0; i < remaining.length; ) {
      const piece = remaining[i];
      // Every cut that separates a piece from the stick consumes one kerf.
      const cost = piece + kerfMm;
      if (used + cost <= stockLengthMm) {
        stick.pieces.push(piece);
        stick.kerfCount += 1;
        used += cost;
        remaining.splice(i, 1);
      } else {
        i++;
      }
    }
    if (stick.pieces.length === 0) {
      throw new Error(
        `Piece of ${remaining[0]} mm does not fit ${stockLengthMm} mm stock ` +
          `with a ${kerfMm} mm kerf`
      );
    }
    stick.offcutMm = stockLengthMm - used;
    sticks.push(stick);
  }
  return sticks;
}

/**
 * Material accounting for a planned stick. V1-TEST A7:
 *   input length = sum of outputs + kerf + offcut, within tolerance.
 *
 * Note the offcut is a **real object** (A6). It is produced, it has an id, and
 * it goes in the offcut bin. It is never a deletion.
 */
export function stickBalance(stick) {
  const outputsMm = stick.pieces.reduce((a, b) => a + b, 0);
  const kerfMm = stick.kerfCount * BLADE.kerfMm;
  const total = outputsMm + kerfMm + stick.offcutMm;
  return {
    inputMm: stick.stockLengthMm,
    outputsMm: +outputsMm.toFixed(3),
    kerfMm: +kerfMm.toFixed(3),
    offcutMm: +stick.offcutMm.toFixed(3),
    totalMm: +total.toFixed(3),
    errorMm: +(stick.stockLengthMm - total).toFixed(6),
  };
}

/**
 * Full plan for one crate: every profile, both candidate stock lengths, and the
 * yield of each. The planner picks the stock length that wastes least, and the
 * choice is recorded so it can be explained rather than assumed.
 */
export function planCrate() {
  const plan = [];
  for (const [profileId, group] of cutList()) {
    const lengths = group.pieces.map((p) => p.lengthMm);
    const candidates = STOCK_LENGTHS_MM.lengths.map((s) => {
      const sticks = planCuts(lengths, s.lengthMm);
      const offcutMm = sticks.reduce((a, st) => a + st.offcutMm, 0);
      const kerfMm = sticks.reduce((a, st) => a + st.kerfCount * BLADE.kerfMm, 0);
      const inputMm = sticks.length * s.lengthMm;
      return {
        stockId: s.id, stockLengthMm: s.lengthMm,
        sticks: sticks.length, inputMm, kerfMm: +kerfMm.toFixed(1),
        offcutMm: +offcutMm.toFixed(1),
        yieldPct: +((1 - offcutMm / inputMm) * 100).toFixed(2),
        plan: sticks,
      };
    });
    const chosen = candidates.reduce((a, b) => (b.offcutMm < a.offcutMm ? b : a));
    plan.push({ profileId, profile: group.profile, pieceCount: lengths.length, candidates, chosen });
  }
  return plan;
}

/**
 * Stage state machine. Every stage is one of these, and a part is always in a
 * legal state for where it is (V1-TEST I63). An interrupted cycle resumes from
 * the last completed state or fails cleanly (I67) — which is why FAULT has an
 * explicit edge back to IDLE and not a silent reset.
 */
export const STATES = Object.freeze({
  IDLE: 'IDLE',
  AWAITING_INPUT: 'AWAITING_INPUT',
  RUNNING: 'RUNNING',
  AWAITING_HANDOFF: 'AWAITING_HANDOFF',
  FAULT: 'FAULT',
});

export const TRANSITIONS = Object.freeze({
  IDLE: ['AWAITING_INPUT'],
  AWAITING_INPUT: ['RUNNING', 'FAULT'],
  RUNNING: ['AWAITING_HANDOFF', 'FAULT'],
  AWAITING_HANDOFF: ['IDLE', 'FAULT'],
  FAULT: ['IDLE'],
});

export function transitionLegal(from, to) {
  return (TRANSITIONS[from] ?? []).includes(to);
}

/**
 * Object states. A board is in exactly one of these, and the inspector reports
 * it. "Two places at once" (V1-TEST I64) is impossible because HELD, ON_CONVEYOR
 * and IN_ASSEMBLY are mutually exclusive values of one field, not flags.
 */
export const OBJECT_STATES = Object.freeze([
  'STOCK', 'CLAMPED', 'BEING_CUT', 'CUT', 'OFFCUT',
  'ON_CONVEYOR', 'HELD', 'IN_TRANSIT', 'PLACED', 'FASTENED', 'IN_ASSEMBLY', 'SCRAPPED',
]);

/**
 * Determinism. One seed, threaded through everything that could otherwise vary.
 * There is nothing random in V1's process; the seed exists so that when
 * something is added that could be, it is still reproducible.
 */
export const DETERMINISM = Object.freeze({
  seed: 20260815,
  rule: 'No Math.random anywhere. No Date.now in process logic. No model at runtime.',
  fixedTimestepMs: 16.6667,
  fixedTimestepWhy:
    'Process logic steps at a fixed rate so the same inputs give the same ' +
    'result regardless of frame rate. Rendering interpolates; the graph does not.',
});

export const PROCESS = Object.freeze({
  STAGES, HANDOFFS, STATES, TRANSITIONS, OBJECT_STATES, DETERMINISM,
  PARALLEL_PROFILES: Object.freeze(Object.keys(PROFILES)),
});
export default PROCESS;
