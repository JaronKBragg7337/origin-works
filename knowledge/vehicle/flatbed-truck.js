/**
 * Flatbed truck OW-T7. Millimetres.
 *
 * The vehicle that answers V1-TEST section E. Everything here is original;
 * there is no source because no specific truck was copied. The dimensions are
 * those of an ordinary rigid two-axle flatbed.
 *
 * The three numbers that carry the tests:
 *   BED.innerMm      — E33, loaded pieces sit within the declared bed bounds
 *   BED.floorYMm     — E34, nothing floats above the bed or sinks into it
 *   AXLES / WHEELS   — E37, all wheels contact the ground for the whole journey
 */

import { GROUPS } from '../collision.js';

export const CHASSIS = Object.freeze({
  origin: 'original',
  overallLengthMm: 7200.0,
  overallWidthMm: 2440.0,
  cabHeightMm: 2650.0,
  wheelbaseMm: 4200.0,
  frontOverhangMm: 1250.0,
  rearOverhangMm: 1750.0,
  groundClearanceMm: 220.0,
  kerbMassKg: 4800,
  payloadKg: 3500,
});

/**
 * The bed. `innerMm` is the declared bound a load must sit inside, and
 * `floorYMm` is the surface it must sit on — not above, not in.
 */
export const BED = Object.freeze({
  origin: 'original',
  innerMm: Object.freeze({ lengthMm: 4600.0, widthMm: 2340.0 }),
  floorYMm: 1080.0,
  floorThicknessMm: 40.0,
  /** Side gates, which are modelled as operable because they look operable. */
  gate: Object.freeze({
    heightMm: 600.0,
    thicknessMm: 45.0,
    hingeAxis: 'x',
    openAngleDeg: 92,
    travelMs: 900,
    latched: true,
  }),
  /** Headboard, fixed. A load cannot slide forward past it. */
  headboardHeightMm: 1200.0,
  /** Lashing points, so a secured load is secured to something. */
  lashingPointPitchMm: 600.0,
});

export const AXLES = Object.freeze({
  origin: 'original',
  front: Object.freeze({ xMm: 2400.0, trackMm: 2050.0, wheels: 2, steered: true }),
  rear: Object.freeze({ xMm: -1800.0, trackMm: 1850.0, wheels: 4, driven: true }),
  maxSteerAngleDeg: 42.0,
});

export const WHEELS = Object.freeze({
  origin: 'original',
  diameterMm: 950.0,
  widthMm: 245.0,
  /** Static deflection under load; why wheelContactMm is 2 mm, not 0. */
  deflectionLadenMm: 12.0,
});

export const DRIVE = Object.freeze({
  origin: 'original',
  maxSpeedMmPerS: 11000.0,
  maxSpeedYardMmPerS: 3000.0,
  maxSpeedYardWhy: 'Speed limit inside the site. The road route uses this.',
  accelMmPerS2: 900.0,
  brakeMmPerS2: 2200.0,
  /** Turning radius, from wheelbase and max steer. Derived, not stated. */
  get turningRadiusMm() {
    return CHASSIS.wheelbaseMm / Math.tan((AXLES.maxSteerAngleDeg * Math.PI) / 180);
  },
});

export const CONTROLS = Object.freeze({
  origin: 'original',
  items: Object.freeze([
    Object.freeze({ id: 'DOOR_L', kind: 'door', hingeAxis: 'y', openAngleDeg: 75, travelMs: 800 }),
    Object.freeze({ id: 'DOOR_R', kind: 'door', hingeAxis: 'y', openAngleDeg: 75, travelMs: 800 }),
    Object.freeze({ id: 'GATE_L', kind: 'gate', boundTo: 'BED.gate' }),
    Object.freeze({ id: 'GATE_R', kind: 'gate', boundTo: 'BED.gate' }),
    Object.freeze({ id: 'BEACON', kind: 'lamp', positionMm: [2100, 2700, 0], colorHex: 0xffa000, boundTo: 'moving' }),
    Object.freeze({ id: 'LAMP_REVERSE', kind: 'lamp', positionMm: [-3550, 900, 700], colorHex: 0xffffff, boundTo: 'reversing' }),
  ]),
});

export const COLLISION = Object.freeze({
  group: GROUPS.VEHICLE,
  boxes: Object.freeze([
    Object.freeze({ id: 'CAB', centreMm: [2500, 1700, 0], sizeMm: [1900, 1900, 2350] }),
    Object.freeze({ id: 'BED_FLOOR', centreMm: [-600, 1060, 0], sizeMm: [4600, 40, 2340] }),
    Object.freeze({ id: 'GATE_L', centreMm: [-600, 1400, 1190], sizeMm: [4600, 600, 45], moving: true }),
    Object.freeze({ id: 'GATE_R', centreMm: [-600, 1400, -1190], sizeMm: [4600, 600, 45], moving: true }),
    Object.freeze({ id: 'HEADBOARD', centreMm: [1720, 1680, 0], sizeMm: [60, 1200, 2340] }),
  ]),
});

/**
 * Is a load inside the declared bed bounds? Returns the margins so a failure
 * says by how much and on which axis. V1-TEST E33.
 */
export function loadWithinBed(loadLengthMm, loadWidthMm, loadHeightMm) {
  const lengthMarginMm = BED.innerMm.lengthMm - loadLengthMm;
  const widthMarginMm = BED.innerMm.widthMm - loadWidthMm;
  const heightUnderGateMm = BED.gate.heightMm - loadHeightMm;
  return {
    ok: lengthMarginMm >= 0 && widthMarginMm >= 0,
    lengthMarginMm: +lengthMarginMm.toFixed(1),
    widthMarginMm: +widthMarginMm.toFixed(1),
    aboveGateMm: +(-heightUnderGateMm).toFixed(1),
    needsLashing: heightUnderGateMm < 0,
  };
}

/** Where a load must sit: on the bed floor, not above it or in it. E34. */
export function loadRestYMm() {
  return BED.floorYMm;
}

export const TRUCK = Object.freeze({
  id: 'OW-T7',
  label: 'Flatbed truck',
  origin: 'original',
  CHASSIS, BED, AXLES, WHEELS, DRIVE, CONTROLS, COLLISION,
});
export default TRUCK;
