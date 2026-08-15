/**
 * Crosscut saw OW-S1, built from knowledge/saw/crosscut-saw.js.
 *
 * Every dimension comes from the spec. The blade is a separate object from the
 * machine body because it is a TOOL in the collision spec and it is the thing
 * that opens a CUT operation.
 *
 * Invariant 6: the guard, the clamp and the controls are modelled as operable,
 * so they operate.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, deg } from '../../knowledge/units.js';
import SAW, { BLADE, SPINDLE, TABLE, STROKE, FIXTURING, GUARDING, CONTROLS } from '../../knowledge/saw/crosscut-saw.js';
import { boxMm, cylinderMm, tubeMm, plateMm } from './shapes.js';
import * as M from './materials.js';

export function buildSaw() {
  const root = new THREE.Group();
  root.name = 'OW-S1';

  /* ---- body -------------------------------------------------- */
  const body = new THREE.Mesh(boxMm(1200, 900, 800), M.machineBody());
  body.position.y = mm(450);
  body.castShadow = body.receiveShadow = true;
  root.add(body);

  // Feet, so the machine stands on the floor rather than hovering at it.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const foot = new THREE.Mesh(boxMm(120, 20, 120), M.darkSteel());
    foot.position.set(mm(sx * 520), mm(10), mm(sz * 320));
    root.add(foot);
  }

  // Control panel on the operator side.
  const panel = new THREE.Mesh(plateMm(360, 200, 24, 10), M.machineTrim());
  panel.position.set(mm(-380), mm(1080), mm(430));
  panel.rotation.x = deg(-18);
  root.add(panel);

  const controls = new Map();
  for (const c of CONTROLS.items) {
    let g, mat;
    if (c.kind === 'lamp') { g = cylinderMm(c.diameterMm / 2, c.diameterMm / 2, 8, 12); mat = M.lampOff(); }
    else if (c.kind === 'selector') { g = cylinderMm(9, 9, 22, 10); mat = M.darkSteel(); }
    else { g = cylinderMm(c.diameterMm / 2, c.diameterMm / 2, 14, 14); mat = new THREE.MeshStandardMaterial({ color: c.colorHex ?? 0x888888, roughness: 0.5 }); }
    const knob = new THREE.Mesh(g, mat);
    knob.rotation.x = Math.PI / 2 + deg(-18);
    knob.position.set(mm(c.positionMm[0]), mm(c.positionMm[1]), mm(c.positionMm[2] + 14));
    knob.userData.control = c.id;
    root.add(knob);
    controls.set(c.id, knob);
  }

  /* ---- table and fence --------------------------------------- */
  const table = new THREE.Mesh(boxMm(TABLE.lengthMm, 40, TABLE.widthMm), M.machineTrim());
  table.position.y = mm(TABLE.heightMm - 20);
  table.receiveShadow = true;
  root.add(table);

  // Blade slot, cut visually as two table halves either side of the kerf line.
  const slot = new THREE.Mesh(boxMm(TABLE.bladeSlotWidthMm, 42, TABLE.widthMm), M.darkSteel());
  slot.position.y = mm(TABLE.heightMm - 20);
  root.add(slot);

  const fence = new THREE.Mesh(boxMm(TABLE.lengthMm, TABLE.fenceHeightMm, 20), M.darkSteel());
  fence.position.set(0, mm(TABLE.heightMm + TABLE.fenceHeightMm / 2), mm(TABLE.widthMm / 2 - 10));
  fence.castShadow = true;
  root.add(fence);

  // Measuring scale along the fence, every 100 mm. It is the datum the cut
  // length is measured from, so it is drawn where the datum actually is.
  const tickGeo = boxMm(2, 10, 3);
  for (let x = -1600; x <= 1600; x += 100) {
    const tick = new THREE.Mesh(tickGeo, M.roadLine());
    tick.position.set(mm(x), mm(TABLE.heightMm + 6), mm(TABLE.widthMm / 2 - 22));
    root.add(tick);
  }

  /* ---- column and blade -------------------------------------- */
  const column = new THREE.Mesh(boxMm(420, 800, 260), M.machineBody());
  column.position.set(0, mm(1300), mm(460));
  column.castShadow = true;
  root.add(column);

  const bladeAssembly = new THREE.Group();
  bladeAssembly.position.set(0, mm(STROKE.housedCentreYMm), 0);
  root.add(bladeAssembly);

  const blade = new THREE.Group();
  blade.name = 'BLADE';
  const plate = new THREE.Mesh(
    cylinderMm(BLADE.diameterMm / 2 - 14, BLADE.diameterMm / 2 - 14, BLADE.plateThicknessMm, 40),
    M.bladeSteel()
  );
  plate.rotation.x = Math.PI / 2;
  blade.add(plate);

  // Carbide tips: what makes the kerf wider than the plate.
  const tipGeo = boxMm(9, 7, BLADE.kerfMm);
  const tips = new THREE.InstancedMesh(tipGeo, M.carbide(), BLADE.teeth);
  const t = new THREE.Object3D();
  for (let i = 0; i < BLADE.teeth; i++) {
    const a = (i / BLADE.teeth) * Math.PI * 2;
    t.position.set(Math.cos(a) * mm(BLADE.diameterMm / 2 - 7), Math.sin(a) * mm(BLADE.diameterMm / 2 - 7), 0);
    t.rotation.set(0, 0, a);
    t.updateMatrix();
    tips.setMatrixAt(i, t.matrix);
  }
  tips.instanceMatrix.needsUpdate = true;
  blade.add(tips);

  const arbor = new THREE.Mesh(cylinderMm(BLADE.boreMm, BLADE.boreMm, 40, 12), M.darkSteel());
  arbor.rotation.x = Math.PI / 2;
  blade.add(arbor);
  bladeAssembly.add(blade);

  // Riving knife behind the blade, as on a real saw.
  const riving = new THREE.Mesh(boxMm(8, 160, BLADE.plateThicknessMm), M.darkSteel());
  riving.position.set(mm(-BLADE.diameterMm / 2 - 6), mm(40), 0);
  bladeAssembly.add(riving);

  /* ---- interlocked hood -------------------------------------- */
  const hood = new THREE.Group();
  const hoodShell = new THREE.Mesh(boxMm(420, 220, 120), M.guardYellow());
  hoodShell.position.set(0, mm(150), 0);
  hood.add(hoodShell);
  const window_ = new THREE.Mesh(boxMm(300, 140, 4), M.guardMesh());
  window_.position.set(0, mm(150), mm(62));
  hood.add(window_);
  hood.position.set(0, mm(TABLE.heightMm + 20), 0);
  root.add(hood);

  /* ---- clamp -------------------------------------------------- */
  const clamp = new THREE.Group();
  const clampPad = new THREE.Mesh(
    boxMm(FIXTURING.clamp.padLengthMm, 18, FIXTURING.clamp.padWidthMm), M.rubber()
  );
  clamp.add(clampPad);
  const clampRod = new THREE.Mesh(cylinderMm(14, 14, 300, 10), M.steel());
  clampRod.position.y = mm(160);
  clamp.add(clampRod);
  const clampCyl = new THREE.Mesh(cylinderMm(34, 34, 180, 12), M.darkSteel());
  clampCyl.position.y = mm(390);
  clamp.add(clampCyl);
  clamp.position.set(mm(-FIXTURING.clamp.offsetFromCutPlaneMm), mm(FIXTURING.clamp.openYMm), 0);
  clamp.castShadow = true;
  root.add(clamp);

  /* ---- light curtain posts ------------------------------------ */
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(boxMm(60, GUARDING.lightCurtain.heightMm, 60), M.guardYellow());
    post.position.set(mm(GUARDING.lightCurtain.planeXMm), mm(GUARDING.lightCurtain.heightMm / 2), mm(sz * 420));
    root.add(post);
  }

  /* ---- offcut bin --------------------------------------------- */
  const bin = new THREE.Group();
  const binBody = new THREE.Mesh(
    boxMm(FIXTURING.offcutBin.innerMm[0], FIXTURING.offcutBin.innerMm[1], FIXTURING.offcutBin.innerMm[2]),
    M.darkSteel()
  );
  binBody.position.y = mm(FIXTURING.offcutBin.innerMm[1] / 2);
  bin.add(binBody);
  bin.position.set(
    mm(FIXTURING.offcutBin.positionMm[0]), 0, mm(FIXTURING.offcutBin.positionMm[2])
  );
  root.add(bin);

  /* ---- runtime state ------------------------------------------ */
  const state = {
    rpm: 0,
    bladeAngle: 0,
    strokeY: STROKE.housedCentreYMm,
    hoodOpen: 0,
    clampY: FIXTURING.clamp.openYMm,
    running: false,
  };

  return {
    root, spec: SAW, state,
    blade, bladeAssembly, hood, clamp, controls,
    binPositionMm: FIXTURING.offcutBin.positionMm,

    /** Spin the blade. rpm is state, not decoration: a cut needs minRpmToCut. */
    setSpindle(rpm) { state.rpm = rpm; },

    /** Advance one frame. dt in seconds. */
    update(dt) {
      state.bladeAngle += (state.rpm / 60) * Math.PI * 2 * dt;
      blade.rotation.z = state.bladeAngle;
      bladeAssembly.position.y = mm(state.strokeY);
      hood.rotation.z = deg(-state.hoodOpen * GUARDING.hood.openRotationDeg);
      clamp.position.y = mm(state.clampY);
      const lamp = controls.get('LAMP_RUN');
      if (lamp) lamp.material = state.rpm > 0 ? M.lampOn(0xffc040) : M.lampOff();
    },

    /** Blade tip height in mm; used to prove the blade crossed the stock. */
    bladeTopMm() { return state.strokeY + BLADE.diameterMm / 2; },
    bladeBottomMm() { return state.strokeY - BLADE.diameterMm / 2; },

    /** Is the blade turning fast enough to cut? V1-TEST C21. */
    canCut() { return state.rpm >= SPINDLE.minRpmToCut; },
  };
}
