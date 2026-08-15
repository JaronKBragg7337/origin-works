/**
 * Two-finger parallel gripper OW-G2. Millimetres.
 *
 * Performance figures are the published specification of a 5 kg-class two-
 * finger gripper (SOURCES.md S8). The geometry is original.
 *
 * V1-TEST D29-D30:
 *   29. the gripper closes onto the part's actual width, not to a fixed pose
 *   30. the gripped part moves with the gripper and does not drift or
 *       interpenetrate it
 *
 * That first one is why `closeOnWidth()` exists and why there is no
 * `CLOSED_POSE` constant anywhere in this file.
 */

import { GROUPS, OPERATIONS } from '../collision.js';

export const PERFORMANCE = Object.freeze({
  source: 'S8',
  strokeMm: 85.0,
  gripForceMinN: 20.0,
  gripForceMaxN: 235.0,
  closingSpeedMaxMmPerS: 150.0,
  payloadKg: 5.0,
  repeatabilityMm: 0.05,
  massKg: 1.3,
});

export const GEOMETRY = Object.freeze({
  origin: 'original',
  why: 'Built to the S8 performance envelope; no proprietary geometry copied.',
  /** Body from the tool flange to the finger roots. */
  bodyMm: [90, 148, 76],
  flangeDiameterMm: 75.0,
  flangeThicknessMm: 12.0,
  /** Each jaw travels half the stroke, symmetrically about the tool axis. */
  jawTravelPerSideMm: 42.5,
  jaw: Object.freeze({
    lengthMm: 96.0,
    widthMm: 40.0,
    thicknessMm: 18.0,
    /** The pad is the only part permitted to contact the workpiece. */
    padThicknessMm: 4.0,
    padMaterial: 'nitrile',
    padFrictionCoefficient: 0.7,
    padFrictionWhy: 'original: rubber on dry softwood, conventional value.',
  }),
  /** Distance from the flange face to the pad face along the tool axis. */
  tcpOffsetMm: 172.0,
});

/**
 * What this gripper can hold. A board wider than the stroke is refused, not
 * stretched to — the same refusal the arm makes for an unreachable target.
 */
export const GRASP_LIMITS = Object.freeze({
  minWidthMm: 8.0,
  maxWidthMm: PERFORMANCE.strokeMm,
  minWidthWhy: 'original: below 8 mm the pads foul each other.',
});

/**
 * Jaw positions for a given part width. This is the whole point of D29: the
 * commanded pose is a function of the measured part, and if the part is a
 * different width the jaws end up somewhere else.
 *
 * @param {number} partWidthMm the part's actual measured width
 * @returns {{perSideMm: number, gapMm: number}}
 */
export function closeOnWidth(partWidthMm) {
  if (partWidthMm < GRASP_LIMITS.minWidthMm || partWidthMm > GRASP_LIMITS.maxWidthMm) {
    throw new RangeError(
      `Part width ${partWidthMm} mm is outside the ${GRASP_LIMITS.minWidthMm}-` +
        `${GRASP_LIMITS.maxWidthMm} mm grasp range; refuse rather than stretch to it`
    );
  }
  const perSideMm = (PERFORMANCE.strokeMm - partWidthMm) / 2;
  return { perSideMm, gapMm: partWidthMm };
}

/**
 * Grip force needed to hold a mass without slipping, with a safety factor.
 * Two pads, friction mu, vertical carry, factor of 2 for acceleration.
 */
export function requiredGripForceN(massKg, accelerationMs2 = 9.81 * 2) {
  const mu = GEOMETRY.jaw.padFrictionCoefficient;
  return (massKg * accelerationMs2) / (2 * mu);
}

/** Can this gripper hold this part? Checked before the move, not after. */
export function canHold(partWidthMm, partMassKg) {
  if (partWidthMm < GRASP_LIMITS.minWidthMm || partWidthMm > GRASP_LIMITS.maxWidthMm) {
    return { ok: false, why: `width ${partWidthMm} mm outside grasp range` };
  }
  if (partMassKg > PERFORMANCE.payloadKg) {
    return { ok: false, why: `mass ${partMassKg.toFixed(2)} kg exceeds ${PERFORMANCE.payloadKg} kg payload` };
  }
  const needN = requiredGripForceN(partMassKg);
  if (needN > PERFORMANCE.gripForceMaxN) {
    return { ok: false, why: `needs ${needN.toFixed(0)} N, gripper gives ${PERFORMANCE.gripForceMaxN} N` };
  }
  return { ok: true, gripForceN: Math.max(needN, PERFORMANCE.gripForceMinN) };
}

/**
 * Grasp points on a board: where the pads may close. A board is grasped across
 * its thickness (the smaller dimension) so the pads meet parallel faces.
 */
export function graspPointsForBoard(profile, lengthMm) {
  const acrossMm = profile.thicknessMm;
  const alongMm = lengthMm;
  return Object.freeze({
    graspAcrossMm: acrossMm,
    /** Grasp at the centre of mass unless the piece is long enough to need two. */
    positionsMm: alongMm > 900
      ? [alongMm * 0.3, alongMm * 0.7]
      : [alongMm * 0.5],
    approachAxis: 'y',
    closeAxis: 'z',
    note: 'Pads close on the board thickness; the wide faces stay clear.',
  });
}

export const COLLISION = Object.freeze({
  group: GROUPS.TOOL,
  permittedOperation: OPERATIONS.GRASP.id,
  boxes: Object.freeze([
    Object.freeze({ id: 'BODY', centreMm: [0, 74, 0], sizeMm: GEOMETRY.bodyMm }),
    Object.freeze({ id: 'JAW_A', centreMm: [0, 196, 0], sizeMm: [40, 96, 18], moving: true }),
    Object.freeze({ id: 'JAW_B', centreMm: [0, 196, 0], sizeMm: [40, 96, 18], moving: true }),
  ]),
  /** Jaws contact. They never overlap: GRASP declares allowedPenetrationMm 0. */
  allowedPenetrationMm: 0,
});

export const INTERACTION = Object.freeze({
  points: Object.freeze([
    Object.freeze({ id: 'TCP', kind: 'tool-centre-point', positionMm: [0, GEOMETRY.tcpOffsetMm, 0], normal: [0, 1, 0] }),
    Object.freeze({ id: 'PAD_A', kind: 'contact-face', normal: [0, 0, 1] }),
    Object.freeze({ id: 'PAD_B', kind: 'contact-face', normal: [0, 0, -1] }),
  ]),
});

export const GRIPPER = Object.freeze({
  id: 'OW-G2',
  label: 'Two-finger parallel gripper',
  source: 'S8',
  sourceNote: 'Performance figures only. Geometry is original.',
  PERFORMANCE, GEOMETRY, GRASP_LIMITS, COLLISION, INTERACTION,
});
export default GRIPPER;
