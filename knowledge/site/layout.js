/**
 * The map. Millimetres.
 *
 * One map, a road, three factories. Invariant 9: multi-page transport is
 * designed for but not built until a single crate completes the whole run
 * repeatedly.
 *
 * Everything here is original. The one number that is not free is the door
 * opening, which is sized against the truck in vehicle/flatbed-truck.js and
 * checked by the validator (V1-TEST E38).
 */

import { CHASSIS, BED } from '../vehicle/flatbed-truck.js';
import { TRUCK as FORK_TRUCK } from '../vehicle/forklift.js';

export const GROUND = Object.freeze({
  origin: 'original',
  sizeMm: [180000, 180000],
  /** Flat. A crown or slope would make "all wheels contact" ambiguous. */
  levelYMm: 0,
  levelWhy:
    'Deliberately flat in V1. V1-TEST E37 asks whether all wheels touch the ' +
    'ground; on a flat ground that is a clean yes/no, and adding terrain ' +
    'before the cycle works would only blur it.',
});

export const ROAD = Object.freeze({
  origin: 'original',
  widthMm: 7000,
  widthWhy: `Two ${CHASSIS.overallWidthMm} mm trucks passing, plus 1060 mm of margin.`,
  surfaceThicknessMm: 120,
  laneCentreOffsetMm: 1750,
  /** Corner radius, set by the truck that has to get round it. */
  minCornerRadiusMm: 12000,
  cornerWhy: 'Comfortably above the truck turning radius; the route is checked against it.',
  markings: Object.freeze({ centreLineWidthMm: 150, edgeLineWidthMm: 100, dashLengthMm: 3000, dashGapMm: 3000 }),
});

/**
 * The route. A closed loop touching all three factory doors and the yard. The
 * vehicle follows this (V1-TEST E36) rather than crossing terrain or buildings,
 * and "follows" means its position is on the polyline, not near it.
 */
export const ROUTE = Object.freeze({
  id: 'ROUTE_MAIN',
  closed: true,
  /** Waypoints, [x, z] on the ground plane. */
  waypointsMm: Object.freeze([
    [-60000, -40000], [ 0, -40000], [ 60000, -40000],
    [ 60000,  0], [ 60000,  40000],
    [ 0,  40000], [-60000,  40000],
    [-60000,  0],
  ]),
  /** Tolerance for "on the road": half the road width less half the truck. */
  corridorHalfWidthMm: ROAD.widthMm / 2 - CHASSIS.overallWidthMm / 2,
});

/**
 * Buildings. Each has a footprint, a door, and a yard the truck backs into.
 * The door opening is the number V1-TEST E38 tests.
 */
function building(id, label, stage, centreMm, footprintMm, doorHeadingDeg) {
  return Object.freeze({
    id, label, stage,
    centreMm: Object.freeze(centreMm),
    footprintMm: Object.freeze(footprintMm),
    heightMm: 9000,
    doorHeadingDeg,
    door: Object.freeze({
      id: `${id}_DOOR`,
      /** Sized from the truck, with margin, and checked rather than asserted. */
      openingWidthMm: 5000,
      openingHeightMm: 5000,
      openingOrigin: 'original',
      openingWhy:
        `Truck is ${CHASSIS.overallWidthMm} mm wide and ${CHASSIS.cabHeightMm} mm ` +
        `to the cab roof; a load on the bed at ${BED.floorYMm} mm can add more. ` +
        `5000 mm square clears both with margin the validator computes.`,
      /** Invariant 6: it looks operable, so it operates. */
      kind: 'roller-shutter',
      travelMs: 3200,
      slatHeightMm: 120,
    }),
    yard: Object.freeze({
      sizeMm: [26000, 20000],
      /** Where the truck stops to be loaded. */
      dockMm: Object.freeze([centreMm[0], centreMm[1] + footprintMm[1] / 2 + 9000]),
    }),
  });
}

export const BUILDINGS = Object.freeze([
  building('B1', 'Cut shop', 'CUT_SHOP', [-45000, -20000], [42000, 28000], 90),
  building('B2', 'Panel shop', 'PANEL_SHOP', [10000, -20000], [46000, 30000], 90),
  building('B3', 'Crate shop', 'CRATE_SHOP', [62000, 12000], [40000, 30000], 180),
]);

export const YARD = Object.freeze({
  id: 'YARD',
  label: 'Finished goods yard',
  centreMm: [10000, 34000],
  sizeMm: [40000, 16000],
  /** Where finished crates on pallets are set down and counted. */
  palletGridMm: Object.freeze({ pitchXMm: 1600, pitchZMm: 1400, columns: 8, rows: 4 }),
});

/**
 * Lighting and camera are not specification, but the phone budget is. These
 * are the numbers the render layer must hit, and they are here rather than in
 * the renderer so they are reviewable alongside everything else.
 */
export const BUDGET = Object.freeze({
  origin: 'original',
  why:
    'Invariant 8: phone and desktop from the first commit. A budget that is ' +
    'not written down is not a target. These are checked by measurement at a ' +
    'phone viewport, per V1-TEST 81, not by impression.',
  phone: Object.freeze({
    viewportCss: [390, 844],
    devicePixelRatioCap: 2,
    targetFps: 30,
    maxDrawCalls: 150,
    maxTriangles: 350000,
    maxTextureMemoryMb: 48,
    shadowMapSize: 1024,
  }),
  desktop: Object.freeze({
    viewportCss: [1920, 1080],
    devicePixelRatioCap: 2,
    targetFps: 60,
    maxDrawCalls: 400,
    maxTriangles: 1500000,
    maxTextureMemoryMb: 192,
    shadowMapSize: 2048,
  }),
  rule:
    'Any fidelity reduction for mobile is a measured decision with the number ' +
    'that justified it recorded next to it. V1-TEST 82.',
});

/** Distance along the route between two stages, for transport timing. */
export function routeLengthMm() {
  const w = ROUTE.waypointsMm;
  let total = 0;
  for (let i = 0; i < w.length; i++) {
    const a = w[i];
    const b = w[(i + 1) % w.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return total;
}

/** Does the truck clear a door? V1-TEST E38 — computed, not claimed. */
export function truckClearsDoor(door, loadHeightAboveBedMm = 0) {
  const neededWidthMm = CHASSIS.overallWidthMm;
  const neededHeightMm = Math.max(
    CHASSIS.cabHeightMm,
    BED.floorYMm + loadHeightAboveBedMm
  );
  return {
    ok:
      door.openingWidthMm - neededWidthMm >= 0 &&
      door.openingHeightMm - neededHeightMm >= 0,
    widthClearanceMm: +(door.openingWidthMm - neededWidthMm).toFixed(1),
    heightClearanceMm: +(door.openingHeightMm - neededHeightMm).toFixed(1),
  };
}

/** Does the forklift clear a door? Same question, different vehicle. */
export function forkliftClearsDoor(door) {
  return {
    ok:
      door.openingWidthMm - FORK_TRUCK.overallWidthMm >= 0 &&
      door.openingHeightMm - FORK_TRUCK.overallHeightMm >= 0,
    widthClearanceMm: +(door.openingWidthMm - FORK_TRUCK.overallWidthMm).toFixed(1),
    heightClearanceMm: +(door.openingHeightMm - FORK_TRUCK.overallHeightMm).toFixed(1),
  };
}

export const SITE = Object.freeze({
  id: 'SITE_V1',
  GROUND, ROAD, ROUTE, BUILDINGS, YARD, BUDGET,
});
export default SITE;
