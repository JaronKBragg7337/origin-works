/**
 * End effectors: two parallel grippers and a nailer, from
 * knowledge/robot/gripper-2f.js, gripper-heavy.js and nailer.js.
 *
 * The jaws move to a position computed from the part's measured width. There is
 * no closed pose constant anywhere in this file, because V1-TEST D29 is about
 * exactly that: the gripper closes onto the part's actual width, not to a fixed
 * pose.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm } from '../../knowledge/units.js';
import GRIPPER, * as G2 from '../../knowledge/robot/gripper-2f.js';
import GRIPPER_HEAVY, * as G3 from '../../knowledge/robot/gripper-heavy.js';
import NAILER, { GEOMETRY as NG, DRIVE, CLINCH_ANVIL } from '../../knowledge/robot/nailer.js';
import { boxMm, cylinderMm, plateMm } from './shapes.js';
import * as M from './materials.js';

function buildParallelGripper(spec, api) {
  const { PERFORMANCE: P, GEOMETRY: GEO } = spec;
  const root = new THREE.Group();
  root.name = spec.id;

  const flangePlate = new THREE.Mesh(
    cylinderMm(GEO.flangeDiameterMm / 2, GEO.flangeDiameterMm / 2, GEO.flangeThicknessMm, 20),
    M.darkSteel()
  );
  flangePlate.position.y = mm(GEO.flangeThicknessMm / 2);
  root.add(flangePlate);

  const body = new THREE.Mesh(boxMm(...GEO.bodyMm), M.robotBody());
  body.position.y = mm(GEO.flangeThicknessMm + GEO.bodyMm[1] / 2);
  body.castShadow = true;
  root.add(body);

  // Drive screw and rails: the mechanism that makes the jaws move.
  const rail = new THREE.Mesh(cylinderMm(7, 7, GEO.bodyMm[2] * 1.6, 8), M.steel());
  rail.rotation.x = Math.PI / 2;
  rail.position.y = mm(GEO.flangeThicknessMm + GEO.bodyMm[1] - 18);
  root.add(rail);

  const jaws = [];
  for (const sign of [-1, 1]) {
    const jaw = new THREE.Group();
    const finger = new THREE.Mesh(
      boxMm(GEO.jaw.widthMm, GEO.jaw.lengthMm, GEO.jaw.thicknessMm), M.robotBody()
    );
    finger.position.y = mm(GEO.jaw.lengthMm / 2);
    finger.castShadow = true;
    jaw.add(finger);

    const pad = new THREE.Mesh(
      boxMm(GEO.jaw.widthMm * 0.9, GEO.jaw.lengthMm * 0.75, GEO.jaw.padThicknessMm), M.rubber()
    );
    pad.position.set(0, mm(GEO.jaw.lengthMm / 2),
      -sign * mm(GEO.jaw.thicknessMm / 2 + GEO.jaw.padThicknessMm / 2));
    jaw.add(pad);

    jaw.position.y = mm(GEO.flangeThicknessMm + GEO.bodyMm[1]);
    jaw.userData.sign = sign;
    root.add(jaw);
    jaws.push(jaw);
  }

  const tcp = new THREE.Object3D();
  tcp.position.y = mm(GEO.tcpOffsetMm);
  root.add(tcp);

  const state = { gapMm: P.strokeMm, holdingId: null, gripForceN: 0 };

  function setGap(gapMm) {
    state.gapMm = gapMm;
    for (const jaw of jaws) jaw.position.z = jaw.userData.sign * mm(gapMm / 2);
  }
  setGap(P.strokeMm);

  return {
    root, spec, tcp, jaws, state,
    /** Close onto a measured width. Throws if the part is outside the range. */
    closeOnWidth(partWidthMm) {
      const r = api.closeOnWidth(partWidthMm);   // throws for out-of-range
      setGap(partWidthMm);
      return r;
    },
    open() { setGap(P.strokeMm); },
    setGap,
    canHold: api.canHold,
    /** Jaw gap now, in millimetres, read back for validation. */
    gapMm() { return state.gapMm; },
    strokeMm: P.strokeMm,
  };
}

export function buildGripper() {
  return buildParallelGripper(GRIPPER, { closeOnWidth: G2.closeOnWidth, canHold: G2.canHold });
}

export function buildHeavyGripper() {
  return buildParallelGripper(GRIPPER_HEAVY, { closeOnWidth: G3.closeOnWidth, canHold: G3.canHold });
}

/**
 * The nailer. Its nose contacts the work and never enters it; only the nail
 * enters. That distinction is the whole of V1-TEST F47 and H57.
 */
export function buildNailer() {
  const root = new THREE.Group();
  root.name = NAILER.id;

  const flangePlate = new THREE.Mesh(
    cylinderMm(NG.flangeDiameterMm / 2, NG.flangeDiameterMm / 2, NG.flangeThicknessMm, 20), M.darkSteel()
  );
  flangePlate.position.y = mm(NG.flangeThicknessMm / 2);
  root.add(flangePlate);

  const body = new THREE.Mesh(boxMm(...NG.bodyMm), M.machineBody());
  body.position.y = mm(NG.flangeThicknessMm + NG.bodyMm[1] / 2);
  body.castShadow = true;
  root.add(body);

  // Air line, because a pneumatic tool needs air.
  const hose = new THREE.Mesh(cylinderMm(11, 11, 220, 8), M.rubber());
  hose.position.set(mm(-40), mm(90), mm(-56));
  hose.rotation.z = Math.PI / 5;
  root.add(hose);

  const magazine = new THREE.Mesh(boxMm(40, 200, 60), M.darkSteel());
  magazine.position.set(0, mm(150), mm(-70));
  magazine.rotation.x = -Math.PI / 180 * NG.magazine.stripAngleDeg;
  root.add(magazine);

  const nose = new THREE.Mesh(
    cylinderMm(NG.nose.outerDiameterMm / 2, NG.nose.outerDiameterMm / 2, 40, 12), M.steel()
  );
  nose.position.y = mm(NG.noseOffsetMm - 20);
  root.add(nose);

  const tcp = new THREE.Object3D();
  tcp.position.y = mm(NG.noseOffsetMm);
  root.add(tcp);

  const state = { noseContact: false, driving: false, magazine: NG.magazine.capacity };

  return {
    root, spec: NAILER, tcp, state,
    noseOffsetMm: NG.noseOffsetMm,
    cycleMs: DRIVE.cycleMs,
    take() {
      if (state.magazine <= 0) return false;
      state.magazine--;
      return true;
    },
    reload() { state.magazine = NG.magazine.capacity; },
    magazineCount() { return state.magazine; },
  };
}

/** The clinch anvil that sits under a fabrication joint and bends the point. */
export function buildClinchAnvil() {
  const root = new THREE.Group();
  root.name = CLINCH_ANVIL.id;
  const face = new THREE.Mesh(boxMm(CLINCH_ANVIL.faceMm[0], 24, CLINCH_ANVIL.faceMm[1]), M.steel());
  root.add(face);
  const post = new THREE.Mesh(boxMm(40, 260, 40), M.darkSteel());
  post.position.y = mm(-142);
  root.add(post);
  return { root, spec: CLINCH_ANVIL };
}
