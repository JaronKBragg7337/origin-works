/**
 * Roller conveyor OW-C. Millimetres.
 *
 * Roller pitch and conveying speed are from SOURCES.md S7. Frame, drive and
 * transfer geometry are original.
 *
 * The conveyor matters to the invariants for one specific reason: a piece on a
 * conveyor is **supported by rollers it is touching** (V1-TEST H55), and it
 * moves because the rollers turn, not because a tween moved it. The number of
 * rollers under a piece is therefore a real quantity the inspector reports.
 */

import { GROUPS } from '../collision.js';

export const ROLLERS = Object.freeze({
  source: 'S7',
  pitchMm: 75.0,
  diameterMm: 50.0,
  /** Rollers are driven by round belts between adjacent rollers, as in S7. */
  driveKind: 'round-belt-between-rollers',
  origin_diameter: 'original',
  diameterWhy: '50 mm is the common light-to-medium duty roller diameter in S7 catalogues.',
});

export const SPEED = Object.freeze({
  source: 'S7',
  conveyingSpeedMmPerS: 300.0,
  speedNote: 'S7 gives 0.3 m/s as the maximum for this class. Run at the maximum.',
  accelMmPerS2: 600.0,
  accelOrigin: 'original',
});

export const FRAME = Object.freeze({
  origin: 'original',
  /** Between the frame rails: must clear the widest piece carried. */
  innerWidthMm: 700.0,
  railHeightMm: 120.0,
  railThicknessMm: 6.0,
  /** Top of roller. Matched to the saw table so transfers are level. */
  topOfRollerHeightMm: 900.0,
  legPitchMm: 1500.0,
  legSectionMm: [60, 60],
  /** Side guides keep a board from walking off. */
  guideHeightMm: 60.0,
});

/**
 * Segments in the cell. Each has a length and therefore a roller count, which
 * is derived, not stated — so a segment cannot claim rollers it has no room for.
 */
export const SEGMENTS = Object.freeze([
  Object.freeze({ id: 'CONV_SAW_OUT', lengthMm: 2400, fromMm: [0, 0, 0], headingDeg: 0, role: 'saw outfeed' }),
  Object.freeze({ id: 'CONV_PANEL_IN', lengthMm: 3000, fromMm: [0, 0, 0], headingDeg: 0, role: 'panel shop infeed' }),
  Object.freeze({ id: 'CONV_PANEL_OUT', lengthMm: 2400, fromMm: [0, 0, 0], headingDeg: 0, role: 'panel shop outfeed' }),
]);

export function rollerCount(lengthMm) {
  return Math.floor(lengthMm / ROLLERS.pitchMm) + 1;
}

/**
 * How many rollers are under a piece of this length. If this returns fewer than
 * two, the piece is not supported and the process must not put it there.
 * V1-TEST H55.
 */
export function rollersUnder(pieceLengthMm) {
  return Math.floor(pieceLengthMm / ROLLERS.pitchMm) + 1;
}

export const MIN_ROLLERS_FOR_SUPPORT = 2;

/** Shortest piece this conveyor may carry. Derived from the pitch. */
export function minCarriableLengthMm() {
  return ROLLERS.pitchMm * (MIN_ROLLERS_FOR_SUPPORT - 1) + ROLLERS.diameterMm;
}

/**
 * Transfer points: where a piece leaves one conveyor for another surface. These
 * are interaction points, not decoration — a handoff happens at one of these or
 * it does not happen (V1-TEST I66).
 */
export const TRANSFER = Object.freeze({
  origin: 'original',
  points: Object.freeze([
    Object.freeze({ id: 'XFER_SAW_TO_CONV', kind: 'transfer', normal: [0, 1, 0], gapMm: 30, gapWhy: 'Under one roller pitch, so a board is never unsupported mid-transfer.' }),
    Object.freeze({ id: 'XFER_CONV_TO_PICK', kind: 'grasp-presentation', normal: [0, 1, 0] }),
  ]),
  /** A gap wider than this leaves a board momentarily unsupported. */
  maxGapMm: 74.0,
  maxGapWhy: 'One roller pitch less 1 mm. Beyond it, support is not guaranteed.',
});

export const COLLISION = Object.freeze({
  group: GROUPS.MACHINE,
  /** The frame is boxes; the rollers are one box, not 33 cylinders. */
  representation: 'boxes',
  boxWhy:
    'Collision geometry is simple and reliable by policy. Roller cylinders ' +
    'are rendered, but the collision surface a board rests on is the plane ' +
    'through the roller tops.',
  supportPlaneYMm: FRAME.topOfRollerHeightMm,
});

export const CONVEYOR = Object.freeze({
  id: 'OW-C',
  label: 'Roller conveyor',
  ROLLERS, SPEED, FRAME, SEGMENTS, TRANSFER, COLLISION,
});
export default CONVEYOR;
