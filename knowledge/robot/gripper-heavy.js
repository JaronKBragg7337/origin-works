/**
 * Heavy two-finger parallel gripper OW-G3. Millimetres.
 *
 * This tool exists because the validator said the other one could not do the
 * job. `tools/validate-knowledge.mjs` computes the widest and heaviest member
 * in the crate's bill of materials; the 4x4 skid is 88.9 mm across and 3.38 kg,
 * and OW-G2 has an 85.0 mm stroke. It cannot close on a skid, and stretching
 * its pose to pretend otherwise is exactly the failure V1-TEST D29 is written
 * to catch.
 *
 * So the requirement was measured first and the tool specified second. Every
 * number below is original, and the two that matter are derived from the bill
 * of materials rather than chosen: see REQUIREMENT.
 */

import { GROUPS, OPERATIONS } from '../collision.js';
import { PROFILES, DEFAULT_SPECIES, pieceVolumeMm3 } from '../material/lumber.js';
import { BOM } from '../crate/crate-ow-c1.js';
import { massKg } from '../units.js';

/**
 * What the process actually demands of this gripper, computed from the crate.
 * If the crate changes, this changes, and the validator re-checks the tool
 * against it.
 */
export const REQUIREMENT = (() => {
  let widestMm = 0;
  let heaviestKg = 0;
  for (const b of BOM) {
    // A board is grasped across its thickness; a square timber across either.
    const acrossMm = b.profile.thicknessMm;
    if (acrossMm > widestMm) widestMm = acrossMm;
    const kg = massKg(pieceVolumeMm3(b.profile, b.lengthMm), DEFAULT_SPECIES.densityKgPerM3);
    if (kg > heaviestKg) heaviestKg = kg;
  }
  return Object.freeze({
    widestGraspMm: +widestMm.toFixed(2),
    heaviestPartKg: +heaviestKg.toFixed(3),
    strokeMarginFactor: 1.6,
    payloadMarginFactor: 2.5,
    minStrokeMm: +(widestMm * 1.6).toFixed(1),
    minPayloadKg: +(heaviestKg * 2.5).toFixed(2),
    why:
      'Stroke margin so the jaws open clear of the part before closing; ' +
      'payload margin so the gripper is not run at its limit on every pick.',
  });
})();

export const PERFORMANCE = Object.freeze({
  origin: 'original',
  why: 'Specified against REQUIREMENT above, which is computed from the crate BOM.',
  strokeMm: 160.0,
  gripForceMinN: 60.0,
  gripForceMaxN: 600.0,
  closingSpeedMaxMmPerS: 120.0,
  payloadKg: 12.0,
  repeatabilityMm: 0.08,
  massKg: 3.2,
});

export const GEOMETRY = Object.freeze({
  origin: 'original',
  bodyMm: [130, 190, 110],
  flangeDiameterMm: 75.0,
  flangeThicknessMm: 12.0,
  jawTravelPerSideMm: 80.0,
  jaw: Object.freeze({
    lengthMm: 140.0,
    widthMm: 60.0,
    thicknessMm: 26.0,
    padThicknessMm: 6.0,
    padMaterial: 'nitrile',
    padFrictionCoefficient: 0.7,
  }),
  tcpOffsetMm: 244.0,
});

export const GRASP_LIMITS = Object.freeze({
  minWidthMm: 14.0,
  maxWidthMm: PERFORMANCE.strokeMm,
});

/** Same contract as OW-G2: the pose is a function of the measured part. */
export function closeOnWidth(partWidthMm) {
  if (partWidthMm < GRASP_LIMITS.minWidthMm || partWidthMm > GRASP_LIMITS.maxWidthMm) {
    throw new RangeError(
      `Part width ${partWidthMm} mm is outside the ${GRASP_LIMITS.minWidthMm}-` +
        `${GRASP_LIMITS.maxWidthMm} mm grasp range; refuse rather than stretch to it`
    );
  }
  return { perSideMm: (PERFORMANCE.strokeMm - partWidthMm) / 2, gapMm: partWidthMm };
}

export function requiredGripForceN(kg, accelerationMs2 = 9.81 * 2) {
  return (kg * accelerationMs2) / (2 * GEOMETRY.jaw.padFrictionCoefficient);
}

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
 * Which end effector handles which profile. The cut shop and panel shop each
 * carry both, and a tool change is a real, timed operation rather than a
 * silent swap.
 */
export const TOOL_ASSIGNMENT = Object.freeze({
  origin: 'derived',
  byProfile: Object.freeze({
    [PROFILES.BOARD_1X4.id]: 'OW-G2',
    [PROFILES.BOARD_1X6.id]: 'OW-G2',
    [PROFILES.BOARD_2X4.id]: 'OW-G3',
    [PROFILES.TIMBER_4X4.id]: 'OW-G3',
  }),
  toolChangeMs: 4200,
  toolChangeWhy: 'A real coupler unlatches, parks, and latches. Timed, not free.',
});

export const COLLISION = Object.freeze({
  group: GROUPS.TOOL,
  permittedOperation: OPERATIONS.GRASP.id,
  boxes: Object.freeze([
    Object.freeze({ id: 'BODY', centreMm: [0, 95, 0], sizeMm: GEOMETRY.bodyMm }),
    Object.freeze({ id: 'JAW_A', centreMm: [0, 260, 0], sizeMm: [60, 140, 26], moving: true }),
    Object.freeze({ id: 'JAW_B', centreMm: [0, 260, 0], sizeMm: [60, 140, 26], moving: true }),
  ]),
  allowedPenetrationMm: 0,
});

export const GRIPPER_HEAVY = Object.freeze({
  id: 'OW-G3',
  label: 'Heavy two-finger parallel gripper',
  origin: 'original',
  REQUIREMENT, PERFORMANCE, GEOMETRY, GRASP_LIMITS, TOOL_ASSIGNMENT, COLLISION,
});
export default GRIPPER_HEAVY;
