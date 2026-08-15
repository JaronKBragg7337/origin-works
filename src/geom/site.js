/**
 * The map: ground, road, three factory buildings and the yard.
 * Built from knowledge/site/layout.js, at true scale.
 *
 * Every building is a shell with a real opening whose size was checked against
 * the truck (V1-TEST E38). The shutters are operable because they look operable
 * (invariant 6).
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, deg } from '../../knowledge/units.js';
import SITE, { GROUND, ROAD, ROUTE, BUILDINGS, YARD, APRON_MARGIN_MM } from '../../knowledge/site/layout.js';
import { boxMm } from './shapes.js';
import * as M from './materials.js';

/** Road built as quads along the route polyline, with a centre line. */
function buildRoad() {
  const g = new THREE.Group();
  const w = ROAD.widthMm;
  const pts = ROUTE.waypointsMm;
  const surf = [];
  const line = [];

  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const nx = -dz / len, nz = dx / len;

    const push = (arr, halfW, y) => {
      const p = [
        [a[0] + nx * halfW, y, a[1] + nz * halfW],
        [b[0] + nx * halfW, y, b[1] + nz * halfW],
        [b[0] - nx * halfW, y, b[1] - nz * halfW],
        [a[0] - nx * halfW, y, a[1] - nz * halfW],
      ];
      const tri = (p0, p1, p2) => arr.push(mm(p0[0]), mm(p0[1]), mm(p0[2]),
                                           mm(p1[0]), mm(p1[1]), mm(p1[2]),
                                           mm(p2[0]), mm(p2[1]), mm(p2[2]));
      tri(p[0], p[1], p[2]); tri(p[0], p[2], p[3]);
    };
    push(surf, w / 2, 20);
    push(line, ROAD.markings.centreLineWidthMm / 2, 24);

    // Corner patch, so the joins are filled rather than notched.
    const corner = [];
    const c = b;
    for (let k = 0; k < 8; k++) {
      const t0 = (k / 8) * Math.PI * 2, t1 = ((k + 1) / 8) * Math.PI * 2;
      corner.push(
        mm(c[0]), mm(20), mm(c[1]),
        mm(c[0] + Math.cos(t0) * w / 2), mm(20), mm(c[1] + Math.sin(t0) * w / 2),
        mm(c[0] + Math.cos(t1) * w / 2), mm(20), mm(c[1] + Math.sin(t1) * w / 2),
      );
    }
    surf.push(...corner);
  }

  const mk = (arr, mat) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true;
    return m;
  };
  g.add(mk(surf, M.asphalt()));
  g.add(mk(line, M.roadLine()));
  return g;
}

/** One factory: shell, roof, opening, shutter, apron, signage band. */
function buildBuilding(b) {
  const g = new THREE.Group();
  g.name = b.id;
  g.position.set(mm(b.centreMm[0]), 0, mm(b.centreMm[1]));

  const [W, D] = b.footprintMm;
  const H = b.heightMm;
  const wallT = 200;

  const shell = new THREE.Group();
  shell.rotation.y = deg(b.doorHeadingDeg);
  g.add(shell);

  // Concrete apron the building stands on, so it does not float on grass.
  // It lives inside the shell so it rotates with the door heading — outside it,
  // a 90-degree heading left the apron crossed with the walls.
  const apron = new THREE.Mesh(boxMm(W + APRON_MARGIN_MM * 2, 150, D + APRON_MARGIN_MM * 2), M.concrete());
  apron.position.y = mm(75);
  apron.receiveShadow = true;
  shell.add(apron);

  const door = b.door;
  const halfDoor = door.openingWidthMm / 2;

  // Front wall in three pieces, leaving a real hole for the opening.
  const frontZ = D / 2 - wallT / 2;
  const sideW = (W - door.openingWidthMm) / 2;
  for (const s of [-1, 1]) {
    const piece = new THREE.Mesh(boxMm(sideW, H, wallT), M.wallPanel());
    piece.position.set(mm(s * (halfDoor + sideW / 2)), mm(H / 2), mm(frontZ));
    piece.castShadow = piece.receiveShadow = true;
    shell.add(piece);
  }
  const lintel = new THREE.Mesh(boxMm(door.openingWidthMm, H - door.openingHeightMm, wallT), M.wallPanel());
  lintel.position.set(0, mm(door.openingHeightMm + (H - door.openingHeightMm) / 2), mm(frontZ));
  lintel.castShadow = true;
  shell.add(lintel);

  // Back and sides.
  const back = new THREE.Mesh(boxMm(W, H, wallT), M.wallPanel());
  back.position.set(0, mm(H / 2), mm(-frontZ));
  back.castShadow = back.receiveShadow = true;
  shell.add(back);
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(boxMm(wallT, H, D - wallT * 2), M.wallPanel());
    side.position.set(mm(s * (W / 2 - wallT / 2)), mm(H / 2), 0);
    side.castShadow = side.receiveShadow = true;
    shell.add(side);
  }

  // Roof and a trim band, which is what makes a box read as a building.
  const roof = new THREE.Mesh(boxMm(W + 400, 300, D + 400), M.roof());
  roof.position.y = mm(H + 150);
  roof.castShadow = true;
  shell.add(roof);
  const band = new THREE.Mesh(boxMm(W + 60, 700, D + 60), M.wallTrim());
  band.position.y = mm(H - 1200);
  shell.add(band);

  // Roof vents and ducting.
  for (let i = -1; i <= 1; i++) {
    const vent = new THREE.Mesh(boxMm(1800, 700, 1800), M.roof());
    vent.position.set(mm(i * W / 4), mm(H + 600), mm(-D / 6));
    vent.castShadow = true;
    shell.add(vent);
  }

  // Roller shutter, operable.
  const shutter = new THREE.Group();
  const slats = Math.floor(door.openingHeightMm / door.slatHeightMm);
  const slatGeo = boxMm(door.openingWidthMm - 60, door.slatHeightMm - 8, 60);
  const shutterMesh = new THREE.InstancedMesh(slatGeo, M.shutter(), slats);
  const dm = new THREE.Object3D();
  for (let i = 0; i < slats; i++) {
    dm.position.set(0, mm(door.slatHeightMm * (i + 0.5)), 0);
    dm.updateMatrix();
    shutterMesh.setMatrixAt(i, dm.matrix);
  }
  shutterMesh.instanceMatrix.needsUpdate = true;
  shutter.add(shutterMesh);
  shutter.position.set(0, 0, mm(frontZ + wallT / 2 + 40));
  shell.add(shutter);

  // Door jambs, painted.
  for (const s of [-1, 1]) {
    const jamb = new THREE.Mesh(boxMm(180, door.openingHeightMm, 260), M.guardYellow());
    jamb.position.set(mm(s * (halfDoor + 90)), mm(door.openingHeightMm / 2), mm(frontZ + wallT / 2));
    shell.add(jamb);
  }

  const state = { shutterOpen: 0 };

  return {
    root: g, spec: b, shutter, state,
    openingWidthMm: door.openingWidthMm,
    openingHeightMm: door.openingHeightMm,
    setShutter(t) {
      state.shutterOpen = Math.min(1, Math.max(0, t));
      shutter.position.y = mm(state.shutterOpen * door.openingHeightMm);
    },
    /** Where inside the building the machines go. */
    interiorOrigin: [b.centreMm[0], 0, b.centreMm[1]],
  };
}

export function buildSite() {
  const root = new THREE.Group();
  root.name = 'SITE';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(mm(GROUND.sizeMm[0]), mm(GROUND.sizeMm[1])), M.ground()
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  root.add(buildRoad());

  const buildings = BUILDINGS.map(buildBuilding);
  for (const b of buildings) root.add(b.root);

  // Yard apron and pallet grid markings.
  const yard = new THREE.Mesh(boxMm(YARD.sizeMm[0], 150, YARD.sizeMm[1]), M.concrete());
  yard.position.set(mm(YARD.centreMm[0]), mm(75), mm(YARD.centreMm[1]));
  yard.receiveShadow = true;
  root.add(yard);

  return {
    root, spec: SITE, buildings,
    /** Support surfaces the validation report tests "not floating" against. */
    supportSurfaces() {
      const out = [{
        topMm: 0,
        minX: -GROUND.sizeMm[0] / 2 * 0.001, maxX: GROUND.sizeMm[0] / 2 * 0.001,
        minZ: -GROUND.sizeMm[1] / 2 * 0.001, maxZ: GROUND.sizeMm[1] / 2 * 0.001,
      }];
      return out;
    },
    update(dt) { /* shutters are driven by the director */ },
  };
}
