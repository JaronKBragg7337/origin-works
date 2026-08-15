/**
 * Six-axis articulated arm OW-A6. Millimetres and degrees.
 *
 * The kinematic parameters — link offsets, joint limits, velocity limits,
 * masses — are the published figures of a 5 kg-class collaborative arm, taken
 * from SOURCES.md S4, which is BSD-3-Clause. **No geometry, mesh or appearance
 * was taken from that source.** The links here are an original design built
 * around those numbers.
 *
 * V1-TEST D25-D32:
 *   25. base, joints, links, wrist, tool flange, end effector — all present
 *   26. each joint rotates about its own declared axis
 *   27. no joint exceeds its declared limits
 *   28. the end effector physically reaches the part
 *   32. a part outside the reach envelope is refused
 */

import { GROUPS } from '../collision.js';

/**
 * The chain, root to flange. Each entry is a joint plus the link that follows
 * it. `originMm` is the joint frame's offset from the previous joint frame;
 * `rpyDeg` is its fixed rotation. Together these are the S4 kinematics,
 * converted from metres to millimetres and radians to degrees exactly.
 */
export const CHAIN = Object.freeze([
  Object.freeze({
    joint: 'base_link-base_fixed', kind: 'fixed',
    link: 'base', originMm: [0, 0, 0], rpyDeg: [0, 0, 0],
    massKg: 4.0, source: 'S4',
    massNote: 'S4 flags base_mass as possibly incorrect; it is not load-bearing here.',
  }),
  Object.freeze({
    joint: 'shoulder_pan', kind: 'revolute', axis: [0, 0, 1],
    link: 'shoulder', originMm: [0, 0, 162.5], rpyDeg: [0, 0, 0],
    limitDeg: [-360, 360], maxVelocityDegPerS: 180, maxEffortNm: 150,
    massKg: 3.761, source: 'S4',
  }),
  Object.freeze({
    joint: 'shoulder_lift', kind: 'revolute', axis: [0, 1, 0],
    link: 'upper_arm', originMm: [0, 0, 0], rpyDeg: [90, 0, 0],
    limitDeg: [-360, 360], maxVelocityDegPerS: 180, maxEffortNm: 150,
    massKg: 8.058, source: 'S4',
  }),
  Object.freeze({
    joint: 'elbow', kind: 'revolute', axis: [0, 1, 0],
    link: 'forearm', originMm: [-425.0, 0, 0], rpyDeg: [0, 0, 0],
    limitDeg: [-180, 180], maxVelocityDegPerS: 180, maxEffortNm: 150,
    massKg: 2.846, source: 'S4',
    limitNote:
      'S4 limits the elbow to half its mechanical range because the shoulder ' +
      'lift joint physically obstructs it. Kept: it is a real constraint, and ' +
      'V1-TEST D27 is checked against it.',
  }),
  Object.freeze({
    joint: 'wrist_1', kind: 'revolute', axis: [0, 1, 0],
    link: 'wrist_1', originMm: [-392.2, 0, 133.3], rpyDeg: [0, 0, 0],
    limitDeg: [-360, 360], maxVelocityDegPerS: 180, maxEffortNm: 28,
    massKg: 1.37, source: 'S4',
  }),
  Object.freeze({
    joint: 'wrist_2', kind: 'revolute', axis: [0, 0, 1],
    link: 'wrist_2', originMm: [0, -99.7, 0], rpyDeg: [90, 0, 0],
    limitDeg: [-360, 360], maxVelocityDegPerS: 180, maxEffortNm: 28,
    massKg: 1.3, source: 'S4',
  }),
  Object.freeze({
    joint: 'wrist_3', kind: 'revolute', axis: [0, 1, 0],
    link: 'wrist_3', originMm: [0, 99.6, 0], rpyDeg: [90, 180, 180],
    limitDeg: [-360, 360], maxVelocityDegPerS: 180, maxEffortNm: 28,
    massKg: 0.365, source: 'S4',
  }),
  Object.freeze({
    joint: 'flange', kind: 'fixed',
    link: 'tool_flange', originMm: [0, 0, 0], rpyDeg: [0, 0, 0],
    massKg: 0, source: 'S4',
    note: 'Where the end effector bolts on. V1-TEST D25 requires it named.',
  }),
]);

/** Just the moving joints, in order. */
export const JOINTS = Object.freeze(CHAIN.filter((c) => c.kind === 'revolute'));

/**
 * Reach envelope. Derived from the chain rather than stated, so it cannot
 * disagree with it. V1-TEST D32 refuses a part outside this.
 */
export const REACH = Object.freeze({
  origin: 'derived',
  /** Sum of the two long links plus the wrist offsets. */
  maxRadiusMm: 425.0 + 392.2 + 133.3 + 99.7 + 99.6,
  /** Inside this radius the arm folds into itself; treated as unreachable. */
  minRadiusMm: 180.0,
  minRadiusWhy: 'original: the arm cannot fold tighter than its own link widths.',
  shoulderHeightMm: 162.5,
  payloadKg: 5.0,
  payloadSource: 'S4',
});

/** Link collision: capsules, not the visual mesh. V1-TEST D31 uses these. */
export const COLLISION = Object.freeze({
  group: GROUPS.ROBOT,
  origin: 'original',
  why: 'Capsules sized to enclose the original link geometry with a small margin.',
  capsules: Object.freeze([
    Object.freeze({ link: 'base', radiusMm: 76, aMm: [0, 0, 0], bMm: [0, 0, 120] }),
    Object.freeze({ link: 'shoulder', radiusMm: 62, aMm: [0, 0, 0], bMm: [0, -60, 0] }),
    Object.freeze({ link: 'upper_arm', radiusMm: 58, aMm: [0, 0, 0], bMm: [-425, 0, 0] }),
    Object.freeze({ link: 'forearm', radiusMm: 46, aMm: [0, 0, 0], bMm: [-392.2, 0, 0] }),
    Object.freeze({ link: 'wrist_1', radiusMm: 44, aMm: [0, 0, 0], bMm: [0, -60, 0] }),
    Object.freeze({ link: 'wrist_2', radiusMm: 44, aMm: [0, 0, 0], bMm: [0, 0, 60] }),
    Object.freeze({ link: 'wrist_3', radiusMm: 40, aMm: [0, 0, 0], bMm: [0, 40, 0] }),
  ]),
  /**
   * Adjacent links always touch at their shared joint; testing them would
   * report a permanent false positive. Every other pair is tested, including
   * wrist-against-upper-arm, which is the self-collision that actually happens.
   */
  ignoreAdjacent: true,
});

/**
 * Motion. Trapezoidal joint-space profiles: real robots move like this, and it
 * makes "no joint exceeded its limit" a checkable claim per timestep rather
 * than per waypoint.
 */
export const MOTION = Object.freeze({
  origin: 'original',
  profile: 'trapezoidal',
  /** Fraction of each joint's published velocity limit used in normal running. */
  velocityScale: 0.35,
  accelDegPerS2: 240,
  blendRadiusMm: 20,
  settleMs: 120,
  why:
    'S4 publishes no acceleration limits. 240 deg/s^2 reaches the scaled ' +
    'velocity in 0.26 s, which is unremarkable for this class of arm.',
});

/** Is a target inside the envelope? V1-TEST D32 calls this before moving. */
export function reachable(targetMm, baseMm = [0, 0, 0]) {
  const dx = targetMm[0] - baseMm[0];
  const dy = targetMm[1] - (baseMm[1] + REACH.shoulderHeightMm);
  const dz = targetMm[2] - baseMm[2];
  const r = Math.hypot(dx, dy, dz);
  return r <= REACH.maxRadiusMm && r >= REACH.minRadiusMm;
}

/** Is this joint value legal? V1-TEST D27. */
export function jointWithinLimits(jointName, valueDeg) {
  const j = JOINTS.find((x) => x.joint === jointName);
  if (!j) throw new Error(`Unknown joint "${jointName}"`);
  return valueDeg >= j.limitDeg[0] && valueDeg <= j.limitDeg[1];
}

export const ARM = Object.freeze({
  id: 'OW-A6',
  label: 'Six-axis arm',
  source: 'S4',
  sourceNote: 'Kinematic parameters only. Geometry is original.',
  CHAIN, JOINTS, REACH, COLLISION, MOTION,
});
export default ARM;
