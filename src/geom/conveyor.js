/**
 * Roller conveyor, from knowledge/conveyor/roller-conveyor.js.
 *
 * The rollers are instanced and they turn. A board on the conveyor advances
 * because the rollers advance it — the surface speed and the board speed are
 * the same number, taken from the spec, so "it moved because the conveyor
 * moved" is true rather than decorative.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm } from '../../knowledge/units.js';
import CONVEYOR, { ROLLERS, SPEED, FRAME, rollerCount } from '../../knowledge/conveyor/roller-conveyor.js';
import { boxMm, tubeMm } from './shapes.js';
import * as M from './materials.js';

export function buildConveyor(lengthMm, { withGuides = true } = {}) {
  const root = new THREE.Group();
  root.name = 'OW-C';

  const n = rollerCount(lengthMm);

  /* ---- side rails ------------------------------------------- */
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(
      boxMm(lengthMm, FRAME.railHeightMm, FRAME.railThicknessMm), M.machineBody()
    );
    rail.position.set(0,
      mm(FRAME.topOfRollerHeightMm - ROLLERS.diameterMm / 2 - FRAME.railHeightMm / 2 + 20),
      mm(sz * (FRAME.innerWidthMm / 2 + FRAME.railThicknessMm / 2)));
    rail.castShadow = rail.receiveShadow = true;
    root.add(rail);

    if (withGuides) {
      const guide = new THREE.Mesh(boxMm(lengthMm, FRAME.guideHeightMm, 4), M.machineTrim());
      guide.position.set(0,
        mm(FRAME.topOfRollerHeightMm + FRAME.guideHeightMm / 2),
        mm(sz * (FRAME.innerWidthMm / 2 + 2)));
      root.add(guide);
    }
  }

  /* ---- legs -------------------------------------------------- */
  const legTop = FRAME.topOfRollerHeightMm - ROLLERS.diameterMm / 2 - FRAME.railHeightMm + 20;
  const legCount = Math.max(2, Math.floor(lengthMm / FRAME.legPitchMm) + 1);
  for (let i = 0; i < legCount; i++) {
    const x = -lengthMm / 2 + (i / Math.max(1, legCount - 1)) * lengthMm;
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(
        boxMm(FRAME.legSectionMm[0], legTop, FRAME.legSectionMm[1]), M.darkSteel()
      );
      leg.position.set(mm(x), mm(legTop / 2), mm(sz * (FRAME.innerWidthMm / 2)));
      leg.castShadow = true;
      root.add(leg);
    }
    // Cross brace: it is what stops the legs racking, so it is modelled.
    const brace = new THREE.Mesh(boxMm(30, 30, FRAME.innerWidthMm), M.darkSteel());
    brace.position.set(mm(x), mm(legTop * 0.35), 0);
    root.add(brace);
  }

  /* ---- rollers, instanced ------------------------------------ */
  const rollerGeo = tubeMm(ROLLERS.diameterMm / 2, FRAME.innerWidthMm, 10);
  const rollers = new THREE.InstancedMesh(rollerGeo, M.steel(), n);
  rollers.castShadow = true;
  const dummy = new THREE.Object3D();
  const y = mm(FRAME.topOfRollerHeightMm - ROLLERS.diameterMm / 2);
  for (let i = 0; i < n; i++) {
    dummy.position.set(mm(-lengthMm / 2 + i * ROLLERS.pitchMm), y, 0);
    dummy.rotation.set(Math.PI / 2, 0, 0);
    dummy.updateMatrix();
    rollers.setMatrixAt(i, dummy.matrix);
  }
  rollers.instanceMatrix.needsUpdate = true;
  root.add(rollers);

  /* ---- drive belt and motor ---------------------------------- */
  const motor = new THREE.Mesh(boxMm(220, 180, 160), M.darkSteel());
  motor.position.set(mm(-lengthMm / 2 + 140), mm(legTop - 120), mm(FRAME.innerWidthMm / 2 + 130));
  motor.castShadow = true;
  root.add(motor);
  const motorShaft = new THREE.Mesh(tubeMm(18, 120, 8), M.steel());
  motorShaft.rotation.z = Math.PI / 2;
  motorShaft.position.set(mm(-lengthMm / 2 + 140), mm(legTop - 120), mm(FRAME.innerWidthMm / 2 + 50));
  root.add(motorShaft);

  const state = { speedMmPerS: 0, rollerAngle: 0 };

  return {
    root, spec: CONVEYOR, lengthMm, rollerCount: n,
    topYMm: FRAME.topOfRollerHeightMm,
    innerWidthMm: FRAME.innerWidthMm,
    state,

    run(on = true) { state.speedMmPerS = on ? SPEED.conveyingSpeedMmPerS : 0; },

    update(dt) {
      if (state.speedMmPerS === 0) return;
      // Surface speed = omega * r. The rollers turn at the rate that produces
      // the conveying speed; they are not spun at an arbitrary rate.
      const omega = (state.speedMmPerS / (ROLLERS.diameterMm / 2));
      state.rollerAngle += omega * dt;
      const dummy2 = new THREE.Object3D();
      for (let i = 0; i < n; i++) {
        dummy2.position.set(mm(-lengthMm / 2 + i * ROLLERS.pitchMm), y, 0);
        dummy2.rotation.set(Math.PI / 2, 0, state.rollerAngle);
        dummy2.updateMatrix();
        rollers.setMatrixAt(i, dummy2.matrix);
      }
      rollers.instanceMatrix.needsUpdate = true;
    },

    /** How many rollers are under a piece of this length, right now. */
    rollersUnder(pieceLengthMm) {
      return Math.floor(pieceLengthMm / ROLLERS.pitchMm) + 1;
    },
  };
}
