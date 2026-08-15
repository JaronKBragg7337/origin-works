/**
 * Flatbed truck and counterbalance forklift, plus the stringer pallet.
 * Built from knowledge/vehicle/*.js and knowledge/pallet/stringer-pallet.js.
 *
 * The wheels are placed from the axle positions and their radius, so they sit
 * on the ground because the arithmetic puts them there (V1-TEST E37). The bed
 * floor height is the spec's number, so a load resting on it rests on it
 * (E34).
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, deg } from '../../knowledge/units.js';
import TRUCK, { CHASSIS, BED, AXLES, WHEELS, DRIVE } from '../../knowledge/vehicle/flatbed-truck.js';
import FORKLIFT, { TINE, CARRIAGE, TRUCK as FT, WHEELS as FW, PICK } from '../../knowledge/vehicle/forklift.js';
import PALLET, { PLAN, STRINGER, DECKBOARD, HEIGHT_MM as PALLET_H } from '../../knowledge/pallet/stringer-pallet.js';
import { boxMm, cylinderMm, chamferedBox } from './shapes.js';
import * as M from './materials.js';

function wheel(radiusMm, widthMm) {
  const g = new THREE.Group();
  const tyre = new THREE.Mesh(cylinderMm(radiusMm, radiusMm, widthMm, 20), M.rubber());
  tyre.rotation.x = Math.PI / 2;
  tyre.castShadow = true;
  g.add(tyre);
  const hub = new THREE.Mesh(cylinderMm(radiusMm * 0.45, radiusMm * 0.45, widthMm + 12, 12), M.machineTrim());
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  return g;
}

/* ================================================================ *
 * Flatbed truck
 * ================================================================ */

export function buildTruck() {
  const root = new THREE.Group();
  root.name = TRUCK.id;
  const r = WHEELS.diameterMm / 2;

  // Chassis rails at axle height.
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(boxMm(CHASSIS.overallLengthMm - 600, 220, 160), M.darkSteel());
    rail.position.set(mm(-200), mm(r + 120), mm(sz * 420));
    rail.castShadow = true;
    root.add(rail);
  }

  const cab = new THREE.Mesh(boxMm(1900, 1900, 2350), M.truckPaint());
  cab.position.set(mm(2500), mm(1700), 0);
  cab.castShadow = true;
  root.add(cab);

  const windscreen = new THREE.Mesh(boxMm(60, 900, 2050), M.glass());
  windscreen.position.set(mm(3420), mm(2050), 0);
  root.add(windscreen);

  const grille = new THREE.Mesh(boxMm(140, 700, 2100), M.darkSteel());
  grille.position.set(mm(3480), mm(1100), 0);
  root.add(grille);

  for (const sz of [-1, 1]) {
    const lamp = new THREE.Mesh(boxMm(80, 260, 300), M.lampOff());
    lamp.position.set(mm(3480), mm(1300), mm(sz * 800));
    root.add(lamp);
    const mirror = new THREE.Mesh(boxMm(40, 420, 140), M.darkSteel());
    mirror.position.set(mm(3200), mm(2250), mm(sz * 1280));
    root.add(mirror);
  }

  // Bed floor, headboard and operable gates.
  const floor = new THREE.Mesh(boxMm(BED.innerMm.lengthMm, BED.floorThicknessMm, BED.innerMm.widthMm), M.machineTrim());
  floor.position.set(mm(-600), mm(BED.floorYMm - BED.floorThicknessMm / 2), 0);
  floor.receiveShadow = true;
  root.add(floor);

  const headboard = new THREE.Mesh(boxMm(60, BED.headboardHeightMm, BED.innerMm.widthMm), M.truckPaint());
  headboard.position.set(mm(1720), mm(BED.floorYMm + BED.headboardHeightMm / 2), 0);
  headboard.castShadow = true;
  root.add(headboard);

  const gates = [];
  for (const sz of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(mm(-600), mm(BED.floorYMm), mm(sz * BED.innerMm.widthMm / 2));
    const gate = new THREE.Mesh(
      boxMm(BED.innerMm.lengthMm, BED.gate.heightMm, BED.gate.thicknessMm), M.truckPaint()
    );
    gate.position.y = mm(BED.gate.heightMm / 2);
    gate.castShadow = true;
    hinge.add(gate);
    hinge.userData.sign = sz;
    root.add(hinge);
    gates.push(hinge);
  }

  // Lashing points along the bed.
  for (let x = -BED.innerMm.lengthMm / 2; x <= BED.innerMm.lengthMm / 2; x += BED.lashingPointPitchMm) {
    for (const sz of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(mm(28), mm(6), 4, 8), M.steel());
      ring.position.set(mm(-600 + x), mm(BED.floorYMm + 10), mm(sz * (BED.innerMm.widthMm / 2 - 40)));
      ring.rotation.y = Math.PI / 2;
      root.add(ring);
    }
  }

  const wheels = [];
  for (const axle of [AXLES.front, AXLES.rear]) {
    const pairs = axle.wheels === 4 ? [-1, 1] : [-1, 1];
    for (const sz of pairs) {
      const offsets = axle.wheels === 4 ? [-WHEELS.widthMm / 2 - 20, WHEELS.widthMm / 2 + 20] : [0];
      for (const off of offsets) {
        const w = wheel(r, WHEELS.widthMm);
        w.position.set(mm(axle.xMm), mm(r), mm(sz * axle.trackMm / 2 + off * Math.sign(sz)));
        w.userData.steered = !!axle.steered;
        root.add(w);
        wheels.push(w);
      }
    }
  }

  const beacon = new THREE.Mesh(cylinderMm(70, 70, 120, 10), M.lampOff());
  beacon.position.set(mm(2100), mm(2700), 0);
  root.add(beacon);

  const state = { gateOpen: 0, wheelAngle: 0, speedMmPerS: 0, moving: false };

  return {
    root, spec: TRUCK, wheels, gates, state,
    bedFloorYMm: BED.floorYMm,
    bedInnerMm: BED.innerMm,
    /** Bed centre in the truck's local frame; loads are placed relative to it. */
    bedCentreLocalMm: [-600, BED.floorYMm, 0],

    setGates(t) {
      state.gateOpen = Math.min(1, Math.max(0, t));
      for (const h of gates) h.rotation.x = h.userData.sign * deg(state.gateOpen * BED.gate.openAngleDeg);
    },

    update(dt) {
      if (state.speedMmPerS !== 0) {
        state.wheelAngle += (state.speedMmPerS / (WHEELS.diameterMm / 2)) * dt;
        for (const w of wheels) w.rotation.z = -state.wheelAngle;
      }
      beacon.material = state.moving ? M.lampOn(0xffa000) : M.lampOff();
    },

    /** Lowest point of every wheel, in mm, for the ground-contact check. */
    wheelContactsMm() {
      const p = new THREE.Vector3();
      return wheels.map((w) => {
        w.getWorldPosition(p);
        return { y: (p.y * 1000) - WHEELS.diameterMm / 2 };
      });
    },
  };
}

/* ================================================================ *
 * Forklift
 * ================================================================ */

export function buildForklift() {
  const root = new THREE.Group();
  root.name = FORKLIFT.id;

  const chassis = new THREE.Mesh(boxMm(1400, 700, FT.overallWidthMm), M.forkliftPaint());
  chassis.position.set(mm(-700), mm(500), 0);
  chassis.castShadow = true;
  root.add(chassis);

  const counterweight = new THREE.Mesh(boxMm(500, 620, FT.overallWidthMm - 60), M.darkSteel());
  counterweight.position.set(mm(-1150), mm(480), 0);
  counterweight.castShadow = true;
  root.add(counterweight);

  const seat = new THREE.Mesh(boxMm(420, 420, 480), M.rubber());
  seat.position.set(mm(-620), mm(1050), 0);
  root.add(seat);

  // Overhead guard: four posts and a cage, because a forklift has one.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(boxMm(70, 1200, 70), M.forkliftPaint());
    post.position.set(mm(-600 + sx * 450), mm(1450), mm(sz * 450));
    post.castShadow = true;
    root.add(post);
  }
  const cage = new THREE.Mesh(boxMm(1300, 80, 1000), M.darkSteel());
  cage.position.set(mm(-600), mm(2060), 0);
  cage.castShadow = true;
  root.add(cage);

  // Mast: two channels and a moving carriage.
  const mast = new THREE.Group();
  for (const sz of [-1, 1]) {
    const channel = new THREE.Mesh(boxMm(120, 2100, 120), M.darkSteel());
    channel.position.set(0, mm(1050), mm(sz * 380));
    channel.castShadow = true;
    mast.add(channel);
  }
  mast.position.set(mm(180), 0, 0);
  root.add(mast);

  const carriage = new THREE.Group();
  const back = new THREE.Mesh(boxMm(80, CARRIAGE.heightMm, CARRIAGE.widthMm), M.darkSteel());
  back.position.set(0, mm(CARRIAGE.heightMm / 2), 0);
  carriage.add(back);

  const tines = [];
  for (const sz of [-1, 1]) {
    const tine = new THREE.Group();
    const shank = new THREE.Mesh(
      boxMm(TINE.lengthMm - TINE.tipTaperLengthMm, TINE.thicknessMm, TINE.widthMm), M.steel()
    );
    shank.position.set(mm((TINE.lengthMm - TINE.tipTaperLengthMm) / 2), mm(TINE.thicknessMm / 2), 0);
    shank.castShadow = true;
    tine.add(shank);
    // Tapered tip, so a tine finds an opening rather than butting it.
    const tip = new THREE.Mesh(
      chamferedBox(TINE.tipTaperLengthMm, TINE.tipThicknessMm, TINE.widthMm, 2), M.steel()
    );
    tip.position.set(mm(TINE.lengthMm - TINE.tipTaperLengthMm / 2), mm(TINE.tipThicknessMm / 2), 0);
    tine.add(tip);
    // Vertical heel that hooks the carriage.
    const heel = new THREE.Mesh(boxMm(TINE.thicknessMm, 320, TINE.widthMm), M.steel());
    heel.position.set(mm(TINE.thicknessMm / 2), mm(160), 0);
    tine.add(heel);

    tine.position.set(0, 0, mm(sz * 250));
    carriage.add(tine);
    tines.push(tine);
  }
  carriage.position.set(mm(180), 0, 0);
  root.add(carriage);

  const wheels = [];
  for (const [xMm, spec, steered] of [[0, FW.front, false], [-FT.wheelbaseMm, FW.rear, true]]) {
    for (const sz of [-1, 1]) {
      const w = wheel(spec.diameterMm / 2, spec.widthMm);
      w.position.set(mm(xMm), mm(spec.diameterMm / 2), mm(sz * (steered ? FT.trackRearMm : FT.trackFrontMm) / 2));
      w.userData.steered = steered;
      root.add(w);
      wheels.push(w);
    }
  }

  const beacon = new THREE.Mesh(cylinderMm(60, 60, 110, 10), M.lampOff());
  beacon.position.set(mm(-600), mm(2160), 0);
  root.add(beacon);

  const state = { liftMm: 0, wheelAngle: 0, speedMmPerS: 0, moving: false, tineSpacingMm: 500 };

  return {
    root, spec: FORKLIFT, carriage, tines, wheels, state,
    tineTopYMm() { return state.liftMm + TINE.thicknessMm; },

    setLift(hMm) {
      state.liftMm = Math.min(CARRIAGE.maxLiftHeightMm, Math.max(0, hMm));
      carriage.position.y = mm(state.liftMm);
    },
    setTineSpacing(mmSpacing) {
      const s = Math.min(TINE.spacingMaxMm, Math.max(TINE.spacingMinMm, mmSpacing));
      state.tineSpacingMm = s;
      tines[0].position.z = mm(-s / 2);
      tines[1].position.z = mm(s / 2);
    },
    update(dt) {
      if (state.speedMmPerS !== 0) {
        state.wheelAngle += (state.speedMmPerS / (FW.front.diameterMm / 2)) * dt;
        for (const w of wheels) w.rotation.z = -state.wheelAngle;
      }
      beacon.material = state.moving ? M.lampOn(0xffa000) : M.lampOff();
    },
  };
}

/* ================================================================ *
 * Stringer pallet — a real assembly of 15 parts, with real openings
 * ================================================================ */

export function buildPallet() {
  const root = new THREE.Group();
  root.name = PALLET.id;

  const parts = [];
  const notch = STRINGER.notch;

  // Three stringers running along the 48 in length, each notched twice.
  const stringerZ = [-PLAN.widthMm / 2 + STRINGER.widthMm / 2, 0, PLAN.widthMm / 2 - STRINGER.widthMm / 2];
  for (const z of stringerZ) {
    // A notched stringer is three solid segments, so the notch is a real void.
    const n1Start = -PLAN.lengthMm / 2 + notch.fromEndMm;
    const n1End = n1Start + notch.lengthMm;
    const n2End = PLAN.lengthMm / 2 - notch.fromEndMm;
    const n2Start = n2End - notch.lengthMm;

    const segs = [
      [-PLAN.lengthMm / 2, n1Start, STRINGER.heightMm, 0],
      [n1Start, n1End, STRINGER.heightMm - notch.depthMm, notch.depthMm],
      [n1End, n2Start, STRINGER.heightMm, 0],
      [n2Start, n2End, STRINGER.heightMm - notch.depthMm, notch.depthMm],
      [n2End, PLAN.lengthMm / 2, STRINGER.heightMm, 0],
    ];
    for (const [x0, x1, h, lift] of segs) {
      const len = x1 - x0;
      if (len <= 0.1) continue;
      const seg = new THREE.Mesh(chamferedBox(len, h, STRINGER.widthMm, 1.5), [
        M.woodFace(), M.woodMillEnd(), M.woodMillEnd(), M.woodChamfer(),
      ]);
      seg.position.set(mm((x0 + x1) / 2), mm(DECKBOARD.thicknessMm + lift + h / 2), mm(z));
      seg.castShadow = seg.receiveShadow = true;
      root.add(seg);
      parts.push(seg);
    }
  }

  // Deckboards, top and bottom, spanning the 40 in width.
  const layDeck = (count, yMm) => {
    const pitch = (PLAN.lengthMm - DECKBOARD.widthMm) / (count - 1);
    for (let i = 0; i < count; i++) {
      const x = -PLAN.lengthMm / 2 + DECKBOARD.widthMm / 2 + i * pitch;
      const b = new THREE.Mesh(
        chamferedBox(DECKBOARD.widthMm, DECKBOARD.thicknessMm, PLAN.widthMm, 1.2),
        [M.woodFace(), M.woodMillEnd(), M.woodMillEnd(), M.woodChamfer()]
      );
      b.position.set(mm(x), mm(yMm), 0);
      b.castShadow = b.receiveShadow = true;
      root.add(b);
      parts.push(b);
    }
  };
  layDeck(DECKBOARD.bottomCount, DECKBOARD.thicknessMm / 2);
  layDeck(DECKBOARD.topCount, PALLET_H - DECKBOARD.thicknessMm / 2);

  return { root, spec: PALLET, parts, heightMm: PALLET_H, deckTopYMm: PALLET_H };
}
