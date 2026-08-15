/**
 * Counterbalance forklift OW-F15. Millimetres.
 *
 * ISO 2328, which standardises hook-on fork arm mounting dimensions, is a paid
 * standard and was **not consulted**. The fork tines here are therefore
 * original, and they are sized by the only constraint that matters for
 * V1-TEST H61: they must pass through the openings of the pallet in
 * pallet/stringer-pallet.js with a stated clearance. That check is arithmetic
 * the validator runs, not a claim in a comment.
 */

import { GROUPS, OPERATIONS } from '../collision.js';

export const TINE = Object.freeze({
  origin: 'original',
  why:
    'Sized against pallet/stringer-pallet.js OPENINGS. Side entry is the ' +
    'tighter case: the notch is 38.1 mm deep and 228.6 mm long, so the tine ' +
    'must be under 38.1 mm thick and under 228.6 mm wide. 30 mm x 100 mm ' +
    'leaves 8.1 mm and 128.6 mm of clearance respectively.',
  widthMm: 100.0,
  thicknessMm: 30.0,
  lengthMm: 1070.0,
  lengthWhy: '1070 mm reaches through a 1016 mm pallet width with 54 mm to spare.',
  /** Tapered tip, so a tine finds an opening rather than butting against it. */
  tipTaperLengthMm: 180.0,
  tipThicknessMm: 12.0,
  /** Spacing between tine centres, adjustable on the carriage. */
  spacingMinMm: 250.0,
  spacingMaxMm: 900.0,
  count: 2,
});

export const CARRIAGE = Object.freeze({
  origin: 'original',
  widthMm: 900.0,
  heightMm: 380.0,
  liftSpeedMmPerS: 450.0,
  lowerSpeedMmPerS: 500.0,
  maxLiftHeightMm: 3000.0,
  /** Mast tilt, which is what stops a load sliding off on the move. */
  tiltBackDeg: 6.0,
  tiltForwardDeg: 3.0,
});

export const TRUCK = Object.freeze({
  origin: 'original',
  why:
    'Dimensions of a 1500 kg electric four-wheel counterbalance truck. The ' +
    'turning radius is the one published figure used as a target: 2315 mm ' +
    'is typical for this class, and the wheelbase is chosen to produce it.',
  ratedCapacityKg: 1500,
  loadCentreMm: 500,
  overallLengthToFaceMm: 2100.0,
  overallWidthMm: 1070.0,
  overallHeightMm: 2100.0,
  wheelbaseMm: 1400.0,
  trackFrontMm: 900.0,
  trackRearMm: 870.0,
  groundClearanceMm: 100.0,
  turningRadiusMm: 2315.0,
  travelSpeedLadenMmPerS: 3300.0,
  travelSpeedUnladenMmPerS: 4200.0,
  massKg: 2900,
});

export const WHEELS = Object.freeze({
  origin: 'original',
  front: Object.freeze({ diameterMm: 457.0, widthMm: 150.0, count: 2, driven: true }),
  rear: Object.freeze({ diameterMm: 380.0, widthMm: 140.0, count: 2, steered: true }),
  /** V1-TEST E37: all wheels contact the ground for the whole journey. */
  maxSteerAngleDeg: 78.0,
});

/**
 * The fork approach. A pick is not "the pallet became a child of the forklift".
 * It is: tines aligned to an opening, tines inserted to depth, carriage lifted
 * until the pallet's bottom deck leaves the ground.
 */
export const PICK = Object.freeze({
  origin: 'original',
  approachSpeedMmPerS: 250.0,
  /** How far into the pallet the tines go before lifting. */
  insertionDepthMm: 1000.0,
  insertionDepthWhy: 'Just short of the 1016 mm pallet width, so the tips do not protrude.',
  /** Vertical gap between tine top face and the underside of the top deck. */
  entryClearanceMm: 4.0,
  liftClearanceMm: 120.0,
  liftClearanceWhy: 'Enough to clear floor debris; low enough to stay stable.',
});

export const CONTROLS = Object.freeze({
  origin: 'original',
  items: Object.freeze([
    Object.freeze({ id: 'LEVER_LIFT', kind: 'lever', positionMm: [180, 1080, 380], travelDeg: 30, action: 'lift' }),
    Object.freeze({ id: 'LEVER_TILT', kind: 'lever', positionMm: [240, 1080, 380], travelDeg: 30, action: 'tilt' }),
    Object.freeze({ id: 'STEER_WHEEL', kind: 'wheel', positionMm: [0, 1120, 300], diameterMm: 300, action: 'steer' }),
    Object.freeze({ id: 'PEDAL_DRIVE', kind: 'pedal', positionMm: [-60, 520, 120], travelDeg: 18, action: 'drive' }),
    Object.freeze({ id: 'BEACON', kind: 'lamp', positionMm: [0, 2080, -400], colorHex: 0xffa000, boundTo: 'moving' }),
  ]),
});

export const COLLISION = Object.freeze({
  group: GROUPS.VEHICLE,
  permittedOperation: OPERATIONS.SEAT.id,
  boxes: Object.freeze([
    Object.freeze({ id: 'CHASSIS', centreMm: [-700, 500, 0], sizeMm: [1400, 700, 1070] }),
    Object.freeze({ id: 'MAST', centreMm: [180, 1050, 0], sizeMm: [160, 2100, 900] }),
    Object.freeze({ id: 'OVERHEAD_GUARD', centreMm: [-600, 2060, 0], sizeMm: [1300, 80, 1000] }),
    Object.freeze({ id: 'TINE_L', centreMm: [770, 40, -200], sizeMm: [1070, 30, 100], isTool: true }),
    Object.freeze({ id: 'TINE_R', centreMm: [770, 40, 200], sizeMm: [1070, 30, 100], isTool: true }),
  ]),
});

/** Overall footprint with a pallet on the forks. Used for door clearance (E38). */
export function ladenFootprintMm(palletLengthMm) {
  return {
    lengthMm: TRUCK.overallLengthToFaceMm + palletLengthMm,
    widthMm: Math.max(TRUCK.overallWidthMm, palletLengthMm),
    heightMm: TRUCK.overallHeightMm,
  };
}

export const FORKLIFT = Object.freeze({
  id: 'OW-F15',
  label: 'Counterbalance forklift, 1500 kg',
  origin: 'original',
  TINE, CARRIAGE, TRUCK, WHEELS, PICK, CONTROLS, COLLISION,
});
export default FORKLIFT;
