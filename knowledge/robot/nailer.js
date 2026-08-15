/**
 * Pneumatic nailer end effector OW-N1. Millimetres.
 *
 * The tool that makes V1-TEST section F answerable. It holds a magazine of real
 * nail objects, presents a nose to the joint, and drives one nail per cycle
 * along a declared axis to a declared depth.
 *
 * Everything here is original. There is no source for this tool because no
 * proprietary tool was copied; the numbers are chosen and justified in place.
 */

import { GROUPS, OPERATIONS } from '../collision.js';

export const GEOMETRY = Object.freeze({
  origin: 'original',
  bodyMm: [110, 240, 96],
  flangeDiameterMm: 75.0,
  flangeThicknessMm: 12.0,
  /** Distance from the flange face to the nose tip along the tool axis. */
  noseOffsetMm: 268.0,
  nose: Object.freeze({
    /** The nose contacts the workpiece; it never enters it. */
    outerDiameterMm: 16.0,
    boreDiameterMm: 5.0,
    contactFaceWidthMm: 5.5,
  }),
  magazine: Object.freeze({
    capacity: 60,
    /** Angle of the strip, as on a real coil or strip nailer. */
    stripAngleDeg: 21,
    reloadMs: 2500,
  }),
});

export const DRIVE = Object.freeze({
  origin: 'original',
  why:
    'A production pneumatic nailer fires in tens of milliseconds. 90 ms of ' +
    'driving plus 210 ms of nose-contact settle gives a cycle a person can ' +
    'actually watch, without pretending the nail teleports.',
  driveMs: 90,
  contactSettleMs: 210,
  retractMs: 140,
  cycleMs: 440,
  /** Nose must be in contact before the drive is permitted to start. */
  requiresNoseContact: true,
  /** Drive force, high enough to seat the largest nail the process uses. */
  driveForceN: 1400,
});

/**
 * Clinching. S1 rule 4 requires the protruding point to be bent over. That is a
 * second operation, performed by an anvil beneath the work, and it needs its
 * own geometry because a clinched nail is visibly bent.
 */
export const CLINCH_ANVIL = Object.freeze({
  origin: 'original',
  why: 'S1 rule 4 requires clinching; a clinch needs an anvil under the joint.',
  id: 'CLINCH_ANVIL',
  /** Anvil sits below the joint, opposite the nose. */
  faceMm: [60, 60],
  /** The bend the anvil imposes on the protruding point. */
  bendAngleDeg: 88,
  bendRadiusMm: 2.0,
  /**
   * S1: "Nails clinched across the grain have approximately 20% more
   * resistance to withdrawal than nails clinched along the grain."
   * The anvil is therefore oriented to bend across the grain, always.
   */
  bendAcrossGrain: true,
  bendAcrossGrainSource: 'S2',
  travelMs: 180,
});

/** Collision: the nose contacts, the nail penetrates. Different objects. */
export const COLLISION = Object.freeze({
  group: GROUPS.TOOL,
  permittedOperation: OPERATIONS.DRIVE_FASTENER.id,
  boxes: Object.freeze([
    Object.freeze({ id: 'BODY', centreMm: [0, 120, 0], sizeMm: GEOMETRY.bodyMm }),
    Object.freeze({ id: 'MAGAZINE', centreMm: [0, 150, -70], sizeMm: [40, 200, 60] }),
    Object.freeze({ id: 'NOSE', centreMm: [0, 258, 0], sizeMm: [16, 40, 16] }),
  ]),
  /** The nose itself may never enter wood. Only the nail may. */
  nosePenetrationAllowedMm: 0,
});

export const INTERACTION = Object.freeze({
  points: Object.freeze([
    Object.freeze({ id: 'NOSE_TIP', kind: 'contact-point', positionMm: [0, GEOMETRY.noseOffsetMm, 0], normal: [0, 1, 0] }),
    Object.freeze({ id: 'DRIVE_AXIS', kind: 'axis', originMm: [0, GEOMETRY.noseOffsetMm, 0], directionMm: [0, 1, 0] }),
  ]),
});

/**
 * The region a driven nail may occupy: a cylinder on the drive axis, shank
 * diameter, from the head down to the point. This is the scoped region that
 * makes the penetration legal, and its length is the thing V1-TEST F43 measures.
 */
export function fastenerRegion(nailSpec, entryPointMm, axis) {
  return Object.freeze({
    kind: 'fastener-cylinder',
    originMm: [...entryPointMm],
    axis: [...axis],
    diameterMm: nailSpec.diameterMm,
    lengthMm: nailSpec.lengthMm,
  });
}

/** How far the point sits below the entry face once driven. */
export function insertionDepthMm(nailSpec, throughThicknessMm) {
  return nailSpec.lengthMm - throughThicknessMm;
}

export const NAILER = Object.freeze({
  id: 'OW-N1',
  label: 'Pneumatic nailer',
  origin: 'original',
  GEOMETRY, DRIVE, CLINCH_ANVIL, COLLISION, INTERACTION,
});
export default NAILER;
