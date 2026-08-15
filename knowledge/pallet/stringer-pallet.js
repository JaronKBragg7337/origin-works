/**
 * Stringer pallet OW-P48. Millimetres.
 *
 * A 48 x 40 in stringer-class, flush, non-reversible pallet with partial
 * four-way entry. Every dimension below comes from SOURCES.md S5, a USDA Forest
 * Service research publication that describes exactly this pallet, converted
 * from inches at 25.4 mm/in with no rounding.
 *
 * The pallet's job in V1-TEST is item 61: "Forklift tines fit pallet openings;
 * parts fit fixtures; the geometry agrees." That check is arithmetic on the
 * numbers in this file against the numbers in vehicle/forklift.js, and the
 * validator performs it.
 *
 * The pallet is also an assembly with its own bill of materials. It is not
 * manufactured in V1 — it arrives as a bought-in item — but it is built from
 * addressable parts so that Stage 2 can put it on a production line without
 * changing anything.
 */

import { inchToMm } from '../units.js';
import { GROUPS } from '../collision.js';

export const PLAN = Object.freeze({
  source: 'S5',
  lengthMm: inchToMm(48),  // 1219.2, along the stringers
  widthMm: inchToMm(40),   // 1016.0, along the deckboards
  class: 'stringer',
  style: 'flush, non-reversible',
  entry: 'partial four-way',
});

export const STRINGER = Object.freeze({
  source: 'S5',
  count: 3,
  widthMm: inchToMm(1.5),   // 38.1
  heightMm: inchToMm(3.5),  // 88.9
  lengthMm: inchToMm(48),   // 1219.2
  notch: Object.freeze({
    /** Two notches per stringer, located 6 in from each end. */
    countPerStringer: 2,
    fromEndMm: inchToMm(6),   // 152.4
    depthMm: inchToMm(1.5),   // 38.1
    lengthMm: inchToMm(9),    // 228.6
    filletRadiusMm: inchToMm(0.5), // 12.7
  }),
});

export const DECKBOARD = Object.freeze({
  source: 'S5',
  topCount: 7,
  bottomCount: 5,
  thicknessMm: inchToMm(0.625), // 15.875
  /** Deckboards span the 40 in width. */
  lengthMm: inchToMm(40),
  /** Width is not given by S5; derived so 7 boards fit the 48 in length. */
  widthMm: 88.9,
  widthOrigin: 'original',
  widthWhy:
    'S5 gives the counts and thickness but not the deckboard width. 88.9 mm ' +
    '(a nominal 1x4) x 7 boards = 622.3 mm of the 1219.2 mm length, leaving ' +
    '596.9 mm distributed as 6 gaps of 99.5 mm. Ordinary for a GMA pallet.',
});

/** Overall height: bottom deck + stringer + top deck. Derived. */
export const HEIGHT_MM =
  DECKBOARD.thicknessMm + STRINGER.heightMm + DECKBOARD.thicknessMm;

/**
 * The openings a fork may enter. Two kinds, and they are different sizes — this
 * is exactly why "the geometry agrees" is a real check and not a formality.
 *
 * END entry (between the stringers, from a 40 in end): the opening is bounded
 * above by the top deck and below by the bottom deck, so its height is the full
 * stringer height.
 *
 * SIDE entry (through the notches, from a 48 in side): the opening is only as
 * tall as the notch is deep.
 */
export const OPENINGS = Object.freeze({
  end: Object.freeze({
    id: 'ENTRY_END',
    heightMm: STRINGER.heightMm,          // 88.9
    /** Clear width between adjacent stringers. */
    widthMm: (PLAN.widthMm - 3 * STRINGER.widthMm) / 2, // 450.95
    count: 2,
    derivedFrom: 'PLAN.widthMm, STRINGER.widthMm, STRINGER.count',
  }),
  side: Object.freeze({
    id: 'ENTRY_SIDE',
    heightMm: STRINGER.notch.depthMm,     // 38.1
    widthMm: STRINGER.notch.lengthMm,     // 228.6
    count: 2,
    derivedFrom: 'STRINGER.notch',
  }),
});

/** Bill of materials. 3 stringers + 12 deckboards = 15 parts. */
export const BOM = Object.freeze([
  Object.freeze({ role: 'stringer', qty: 3, profileMm: [STRINGER.widthMm, STRINGER.heightMm], lengthMm: STRINGER.lengthMm, notched: true }),
  Object.freeze({ role: 'deckboard_top', qty: 7, profileMm: [DECKBOARD.thicknessMm, DECKBOARD.widthMm], lengthMm: DECKBOARD.lengthMm }),
  Object.freeze({ role: 'deckboard_bottom', qty: 5, profileMm: [DECKBOARD.thicknessMm, DECKBOARD.widthMm], lengthMm: DECKBOARD.lengthMm }),
]);

export const PART_COUNT = BOM.reduce((n, b) => n + b.qty, 0);

export const LOAD = Object.freeze({
  origin: 'original',
  ratedLoadKg: 1000,
  ratedLoadWhy: 'Conventional for a GMA-footprint stringer pallet; not from S5.',
  /** Top deck surface: what a crate rests on. */
  deckTopYMm: HEIGHT_MM,
});

export const COLLISION = Object.freeze({
  group: GROUPS.STOCK,
  /** Boxes per member, so the fork openings are real voids, not a hollow claim. */
  representation: 'per-member-boxes',
  representationWhy:
    'A single bounding box would make the fork openings disappear and turn ' +
    'V1-TEST 61 into a lie. The openings have to be actual gaps.',
});

/**
 * Does a fork tine fit this opening? Returns the clearances, so a failure says
 * by how much. V1-TEST H61.
 */
export function tineFits(opening, tineWidthMm, tineThicknessMm, requiredClearanceMm) {
  const heightClearanceMm = opening.heightMm - tineThicknessMm;
  const widthClearanceMm = opening.widthMm - tineWidthMm;
  return {
    ok: heightClearanceMm >= requiredClearanceMm && widthClearanceMm >= requiredClearanceMm,
    heightClearanceMm: +heightClearanceMm.toFixed(2),
    widthClearanceMm: +widthClearanceMm.toFixed(2),
  };
}

/** Does a load of this footprint sit within the deck? V1-TEST E33 analogue. */
export function loadFits(footprintLengthMm, footprintWidthMm) {
  return {
    ok: footprintLengthMm <= PLAN.lengthMm && footprintWidthMm <= PLAN.widthMm,
    overhangLengthMm: +(footprintLengthMm - PLAN.lengthMm).toFixed(2),
    overhangWidthMm: +(footprintWidthMm - PLAN.widthMm).toFixed(2),
  };
}

export const PALLET = Object.freeze({
  id: 'OW-P48',
  label: 'Stringer pallet, 48 x 40 in',
  source: 'S5',
  PLAN, STRINGER, DECKBOARD, OPENINGS, BOM, PART_COUNT, LOAD, COLLISION,
  heightMm: HEIGHT_MM,
});
export default PALLET;
