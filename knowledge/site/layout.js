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
  /**
   * Waypoints, [x, z] on the ground plane.
   *
   * The loop is sized so it clears every building apron. That is not a matter
   * of taste: a road drawn through a factory wall is a geometry disagreement,
   * and `siteClashes()` below fails on it.
   */
  waypointsMm: Object.freeze([
    [-78000, -60000], [ 0, -60000], [ 78000, -60000],
    [ 78000,  0], [ 78000,  60000],
    [ 0,  60000], [-78000,  60000],
    [-78000,  0],
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
  building('B1', 'Cut shop', 'CUT_SHOP', [-45000, -25000], [42000, 28000], 90),
  building('B2', 'Panel shop', 'PANEL_SHOP', [10000, -25000], [46000, 30000], 90),
  building('B3', 'Crate shop', 'CRATE_SHOP', [48000, 20000], [40000, 30000], 180),
]);

export const YARD = Object.freeze({
  id: 'YARD',
  label: 'Finished goods yard',
  centreMm: [-20000, 30000],
  sizeMm: [40000, 16000],
  /** Where finished crates on pallets are set down and counted. */
  palletGridMm: Object.freeze({ pitchXMm: 1600, pitchZMm: 1400, columns: 8, rows: 4 }),
});

/** Margin the apron adds around a building shell, per side. */
export const APRON_MARGIN_MM = 3000;

/**
 * A building's footprint in **world** axes, after its door heading is applied.
 *
 * This is the function that stops the layout being eyeballed. A heading of 90°
 * swaps the footprint's axes, so a building declared 42 × 28 m occupies
 * 28 × 42 m of the map — which is exactly how a road ended up drawn through
 * three factory walls the first time this was laid out.
 */
export function buildingExtentMm(b, { includeApron = true } = {}) {
  const [W, D] = b.footprintMm;
  const m = includeApron ? APRON_MARGIN_MM * 2 : 0;
  const swap = Math.abs(Math.round(b.doorHeadingDeg / 90) % 2) === 1;
  const halfX = (swap ? D + m : W + m) / 2;
  const halfZ = (swap ? W + m : D + m) / 2;
  return {
    minX: b.centreMm[0] - halfX, maxX: b.centreMm[0] + halfX,
    minZ: b.centreMm[1] - halfZ, maxZ: b.centreMm[1] + halfZ,
  };
}

function segmentBoxOverlap(a, b, halfWidthMm, box) {
  // Axis-aligned road segments only, which is all this route uses.
  const minX = Math.min(a[0], b[0]) - halfWidthMm, maxX = Math.max(a[0], b[0]) + halfWidthMm;
  const minZ = Math.min(a[1], b[1]) - halfWidthMm, maxZ = Math.max(a[1], b[1]) + halfWidthMm;
  const ox = Math.min(maxX, box.maxX) - Math.max(minX, box.minX);
  const oz = Math.min(maxZ, box.maxZ) - Math.max(minZ, box.minZ);
  return ox > 0 && oz > 0 ? { overlapXMm: +ox.toFixed(0), overlapZMm: +oz.toFixed(0) } : null;
}

/**
 * Every place the site disagrees with itself: road through a building, or two
 * buildings sharing ground. Returns an empty array when the map is coherent.
 */
export function siteClashes() {
  const out = [];
  const boxes = BUILDINGS.map((b) => ({ id: b.id, box: buildingExtentMm(b) }));
  boxes.push({ id: 'YARD', box: {
    minX: YARD.centreMm[0] - YARD.sizeMm[0] / 2, maxX: YARD.centreMm[0] + YARD.sizeMm[0] / 2,
    minZ: YARD.centreMm[1] - YARD.sizeMm[1] / 2, maxZ: YARD.centreMm[1] + YARD.sizeMm[1] / 2,
  } });

  const w = ROAD.widthMm / 2;
  for (const { id, box } of boxes) {
    for (let i = 0; i < ROUTE.waypointsMm.length; i++) {
      const a = ROUTE.waypointsMm[i];
      const b2 = ROUTE.waypointsMm[(i + 1) % ROUTE.waypointsMm.length];
      const hit = segmentBoxOverlap(a, b2, w, box);
      if (hit) out.push({ kind: 'road-through-building', id, segment: i, ...hit });
    }
  }
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const A = boxes[i].box, B = boxes[j].box;
      const ox = Math.min(A.maxX, B.maxX) - Math.max(A.minX, B.minX);
      const oz = Math.min(A.maxZ, B.maxZ) - Math.max(A.minZ, B.minZ);
      if (ox > 0 && oz > 0) {
        out.push({ kind: 'buildings-overlap', a: boxes[i].id, b: boxes[j].id, overlapXMm: +ox.toFixed(0), overlapZMm: +oz.toFixed(0) });
      }
    }
  }
  return out;
}

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
