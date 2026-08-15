/**
 * Six-axis arm OW-A6: geometry and kinematics, built from
 * knowledge/robot/arm-6r.js.
 *
 * The chain is constructed from the spec's link offsets and fixed rotations,
 * in the source's own Z-up convention, inside a root that converts to the
 * scene's Y-up. The spec numbers are never touched.
 *
 * V1-TEST D25-D32 all resolve here:
 *   - the chain is base -> joints -> links -> wrist -> tool flange -> end effector
 *   - each joint rotates about its own declared axis
 *   - joint values are clamped to the declared limits on every solver step, so
 *     a limit cannot be exceeded even transiently
 *   - an unreachable target is refused, with the residual in millimetres
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, toMm, deg, toDeg } from '../../knowledge/units.js';
import ARM, { CHAIN, JOINTS, REACH, COLLISION, MOTION } from '../../knowledge/robot/arm-6r.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import { cylinderMm } from './shapes.js';
import * as M from './materials.js';

/** A capsule from a to b (millimetres, link frame). */
function capsule(radiusMm, aMm, bMm, material) {
  const a = new THREE.Vector3(mm(aMm[0]), mm(aMm[1]), mm(aMm[2]));
  const b = new THREE.Vector3(mm(bMm[0]), mm(bMm[1]), mm(bMm[2]));
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CapsuleGeometry(mm(radiusMm), Math.max(len, 1e-5), 3, 12);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  if (len > 1e-6) {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  }
  mesh.position.copy(a).addScaledVector(dir, 0.5);
  return mesh;
}

export function buildArm() {
  /** Converts the spec's Z-up frame to the scene's Y-up frame. */
  const root = new THREE.Group();
  root.name = ARM.id;
  const zUp = new THREE.Group();
  zUp.rotation.x = -Math.PI / 2;
  root.add(zUp);

  const joints = [];       // { spec, pivot, value }
  const frames = new Map();
  let cursor = zUp;

  for (const link of CHAIN) {
    const frame = new THREE.Group();
    frame.name = `frame:${link.joint}`;
    frame.position.set(mm(link.originMm[0]), mm(link.originMm[1]), mm(link.originMm[2]));
    frame.rotation.set(deg(link.rpyDeg[0]), deg(link.rpyDeg[1]), deg(link.rpyDeg[2]), 'ZYX');
    cursor.add(frame);

    let attachPoint = frame;
    if (link.kind === 'revolute') {
      const pivot = new THREE.Group();
      pivot.name = `joint:${link.joint}`;
      frame.add(pivot);
      joints.push({ spec: link, pivot, value: 0 });
      attachPoint = pivot;

      // Joint housing, so a joint reads as a joint.
      const housing = new THREE.Mesh(cylinderMm(64, 64, 92, 16), M.robotJoint());
      const ax = link.axis;
      if (ax[0]) housing.rotation.z = Math.PI / 2;
      else if (ax[2]) housing.rotation.x = Math.PI / 2;
      attachPoint.add(housing);
    }

    // Link body from the collision capsule, so visual and collision agree.
    const cap = COLLISION.capsules.find((c) => c.link === link.link);
    if (cap) attachPoint.add(capsule(cap.radiusMm, cap.aMm, cap.bMm, M.robotBody()));

    frames.set(link.link, attachPoint);
    cursor = attachPoint;
  }

  /** Where an end effector bolts on. */
  const flange = frames.get('tool_flange');
  const toolMount = new THREE.Group();
  toolMount.name = 'toolMount';
  flange.add(toolMount);

  /**
   * The point the solver actually drives. Without this the IK would place the
   * *flange* on the target and the tool would hang past it by its own length —
   * a 172 mm error that would show up as a gripper closing on thin air.
   */
  const toolTip = new THREE.Object3D();
  toolTip.name = 'toolTip';
  toolMount.add(toolTip);

  // Cable conduit down the arm — industrial infrastructure, not decoration:
  // it is what makes the arm look like it is powered.
  const upper = frames.get('upper_arm');
  if (upper) {
    const conduit = capsule(16, [-40, 0, 96], [-380, 0, 96], M.rubber());
    upper.add(conduit);
  }

  const base = frames.get('base');
  if (base) {
    const plinth = new THREE.Mesh(cylinderMm(120, 140, 60, 20), M.darkSteel());
    plinth.position.z = mm(30);
    plinth.rotation.x = Math.PI / 2;
    base.add(plinth);
    for (let i = 0; i < 4; i++) {
      const bolt = new THREE.Mesh(cylinderMm(9, 9, 24, 8), M.steel());
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      bolt.position.set(Math.cos(a) * mm(110), Math.sin(a) * mm(110), mm(66));
      bolt.rotation.x = Math.PI / 2;
      base.add(bolt);
    }
  }

  /* ---------------- kinematics ---------------- */

  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _axis = new THREE.Vector3();
  const _jp = new THREE.Vector3(), _tcp = new THREE.Vector3(), _aux = new THREE.Vector3();
  const _q = new THREE.Quaternion();

  function applyJoints() {
    for (const j of joints) {
      const [ax, ay, az] = j.spec.axis;
      j.pivot.rotation.set(ax * j.value, ay * j.value, az * j.value);
    }
    root.updateWorldMatrix(true, true);
  }

  function clampToLimits(j, radians) {
    const lo = deg(j.spec.limitDeg[0]), hi = deg(j.spec.limitDeg[1]);
    return Math.min(hi, Math.max(lo, radians));
  }

  /** Tool centre point in world space — the tool's tip, not the flange. */
  function tcpWorld(out = new THREE.Vector3()) {
    return toolTip.getWorldPosition(out);
  }

  /** Set the active tool's reach past the flange, in millimetres. */
  function setToolOffset(offsetMm) {
    toolTip.position.set(0, mm(offsetMm), 0);
    root.updateWorldMatrix(true, true);
  }

  /**
   * A point `distanceMm` **beyond the tool tip**, along the tool axis.
   *
   * It has to be measured from the tip, not the flange. Measured from the
   * flange, the aux point and its target disagree by the tool's own length and
   * the solver chases a pose that does not exist — which showed up as a CCD
   * residual stuck at 214.7 mm on every pick.
   */
  function auxWorld(distanceMm, out = new THREE.Vector3()) {
    out.set(0, toolTip.position.y + mm(distanceMm), 0);
    return toolMount.localToWorld(out);
  }

  /**
   * CCD inverse kinematics with per-step limit clamping.
   *
   * Solves for the tool point and, when `approachDir` is given, for a second
   * point along the tool axis — which pins the orientation without needing a
   * full analytic solution.
   *
   * Returns the residual in millimetres. It does not silently succeed: if the
   * residual is above tolerance the caller is expected to refuse the move,
   * which is V1-TEST D32.
   */
  /**
   * Solve from several seed poses and keep the best.
   *
   * Cyclic coordinate descent is a local method: from a single seed it settles
   * into whatever minimum it happens to fall into, and for this arm that left a
   * 528 mm residual on a target it can physically reach. Retrying from a few
   * spread-out seeds is what a real planner does, and it is the difference
   * between "unreachable" and "the solver gave up".
   */
  function solveIK(targetMm, opts = {}) {
    const seeds = opts.seeds ?? SEEDS;
    let best = null, bestJoints = null;
    for (const seed of seeds) {
      restore(seed);
      const res = solveIKFromHere(targetMm, opts);
      if (!best || res.errorMm < best.errorMm) { best = res; bestJoints = snapshot(); }
      if (res.ok) break;
    }
    restore(bestJoints);
    return best;
  }

  /** Seed poses, spread so the solver is not always starting from one basin. */
  const SEEDS = [
    [0, -60, 80, -110, -90, 0],
    [0, -90, 100, -100, -90, 0],
    [0, -40, 60, -110, -90, 0],
    [0, -120, 120, -90, -90, 0],
    [45, -70, 90, -110, -90, 0],
  ].map((p) => p.map((d) => deg(d)));

  function solveIKFromHere(targetMm, { approachDir = null, approachDistanceMm = 180, iterations = 140 } = {}) {
    const target = new THREE.Vector3(mm(targetMm[0]), mm(targetMm[1]), mm(targetMm[2]));
    // The aux point sits `approachDistanceMm` beyond the tip along the tool
    // axis, so its target sits the same distance beyond the target along the
    // approach direction. Aligning the two aligns the tool with the approach.
    const auxTarget = approachDir
      ? target.clone().addScaledVector(
          new THREE.Vector3(...approachDir).normalize(), mm(approachDistanceMm))
      : null;

    applyJoints();

    /** One CCD sweep chasing `point` (a getter) onto `goal`, over `range` joints. */
    function sweep(getPoint, goal, from, to) {
      for (let k = to; k >= from; k--) {
        const j = joints[k];
        j.pivot.getWorldPosition(_jp);
        j.pivot.getWorldQuaternion(_q);
        _axis.set(...j.spec.axis).applyQuaternion(_q).normalize();

        _v1.subVectors(getPoint(), _jp).projectOnPlane(_axis);
        _v2.subVectors(goal, _jp).projectOnPlane(_axis);
        if (_v1.lengthSq() < 1e-12 || _v2.lengthSq() < 1e-12) continue;
        _v1.normalize(); _v2.normalize();
        const cos = Math.min(1, Math.max(-1, _v1.dot(_v2)));
        const sign = Math.sign(_axis.dot(new THREE.Vector3().crossVectors(_v1, _v2))) || 1;
        j.value = clampToLimits(j, j.value + Math.acos(cos) * sign);
        applyJoints();
      }
    }

    // Phase 1: position only, all six joints. Blending the approach direction
    // into this loop makes it markedly worse — it turned a 0.8 mm solve into a
    // 45 mm one — so orientation is a separate pass that is not allowed to
    // spoil the position it starts from.
    let best = Infinity;
    for (let it = 0; it < iterations; it++) {
      sweep(() => tcpWorld(_tcp), target, 0, joints.length - 1);
      best = tcpWorld(_tcp).distanceTo(target);
      if (toMm(best) < TOLERANCES.placementMm) break;
    }

    // Phase 2: aim the tool along the approach direction using the wrist only,
    // and roll it back if that costs more position error than it is worth.
    if (auxTarget) {
      const beforeJoints = joints.map((j) => j.value);
      for (let it = 0; it < 24; it++) {
        sweep(() => auxWorld(approachDistanceMm, _aux), auxTarget, 3, joints.length - 1);
      }
      const after = tcpWorld(_tcp).distanceTo(target);
      if (toMm(after) > TOLERANCES.placementMm && toMm(after) > toMm(best)) {
        joints.forEach((j, i) => { j.value = beforeJoints[i]; });
        applyJoints();
      } else {
        best = after;
      }
    }

    return {
      ok: toMm(best) <= TOLERANCES.placementMm,
      errorMm: +toMm(best).toFixed(3),
      joints: joints.map((j) => ({ joint: j.spec.joint, deg: +toDeg(j.value).toFixed(2) })),
    };
  }

  /** Every joint value, in degrees, for the inspector. */
  function jointReadout() {
    return joints.map((j) => ({
      joint: j.spec.joint,
      valueDeg: +toDeg(j.value).toFixed(2),
      limitDeg: j.spec.limitDeg,
      withinLimits: toDeg(j.value) >= j.spec.limitDeg[0] && toDeg(j.value) <= j.spec.limitDeg[1],
      axis: j.spec.axis,
    }));
  }

  /** Any joint outside its declared limit right now. Should always be empty. */
  function limitViolations() {
    return jointReadout().filter((j) => !j.withinLimits);
  }

  /** Is a world-space point inside the reach envelope? V1-TEST D32. */
  function reachable(targetMm) {
    const basePos = new THREE.Vector3();
    root.getWorldPosition(basePos);
    const d = Math.hypot(
      targetMm[0] - toMm(basePos.x),
      targetMm[1] - (toMm(basePos.y) + REACH.shoulderHeightMm),
      targetMm[2] - toMm(basePos.z)
    );
    // The tool extends the envelope by its own length, but only when it points
    // at the target — so this bound is optimistic and the IK residual is the
    // real test. A target that passes here can still be refused by solveIK.
    const toolMm = toMm(toolTip.position.y);
    return {
      ok: d <= REACH.maxRadiusMm + toolMm && d >= REACH.minRadiusMm,
      distanceMm: +d.toFixed(1),
      envelopeMm: [REACH.minRadiusMm, +(REACH.maxRadiusMm + toolMm).toFixed(1)],
    };
  }

  /** Move joints toward a goal at the scaled velocity limit. dt in seconds. */
  const goal = joints.map(() => 0);
  function setGoalFromCurrent() { joints.forEach((j, i) => { goal[i] = j.value; }); }
  function captureGoal() { joints.forEach((j, i) => { goal[i] = j.value; }); }
  function restore(values) { joints.forEach((j, i) => { j.value = values[i]; }); applyJoints(); }
  function snapshot() { return joints.map((j) => j.value); }

  function stepToward(targetValues, dt) {
    let moving = false;
    joints.forEach((j, i) => {
      const maxStep = deg(j.spec.maxVelocityDegPerS * MOTION.velocityScale) * dt;
      const d = targetValues[i] - j.value;
      if (Math.abs(d) <= maxStep) j.value = targetValues[i];
      else { j.value += Math.sign(d) * maxStep; moving = true; }
      j.value = clampToLimits(j, j.value);
    });
    applyJoints();
    return moving;
  }

  applyJoints();

  return {
    root, spec: ARM, joints, toolMount, toolTip, frames,
    applyJoints, solveIK, jointReadout, limitViolations, reachable, setToolOffset,
    tcpWorld, snapshot, restore, stepToward, setGoalFromCurrent, captureGoal,
    /** Home pose: reachable, clear of the table, and inside every limit. */
    home() {
      const preset = [0, -60, 80, -110, -90, 0];
      return preset.map((d) => deg(d));
    },
  };
}
