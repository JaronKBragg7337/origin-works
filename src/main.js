/**
 * Origin Works — bootstrap.
 *
 * Builds the world from /knowledge, wires the director, the inspector and the
 * overlays, and runs a fixed-timestep process loop under a variable-rate render
 * loop. The process never sees the frame rate (V1-TEST I68).
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { mm, toMm } from '../knowledge/units.js';
import { TOLERANCES } from '../knowledge/tolerances.js';
import { PROFILES } from '../knowledge/material/lumber.js';
import { BUDGET, BUILDINGS } from '../knowledge/site/layout.js';
import { DETERMINISM } from '../knowledge/process/recipes.js';
import { TOOL_ASSIGNMENT } from '../knowledge/robot/gripper-heavy.js';
import { TABLE } from '../knowledge/saw/crosscut-saw.js';

import * as graph from './core/graph.js';
import * as ops from './core/ops.js';
import { validateWorld } from './core/validate.js';

import { buildSite } from './geom/site.js';
import { buildSaw } from './geom/saw.js';
import { buildArm } from './geom/arm.js';
import { buildGripper, buildHeavyGripper, buildNailer, buildClinchAnvil } from './geom/endeffectors.js';
import { buildConveyor } from './geom/conveyor.js';
import { buildTruck, buildForklift, buildPallet } from './geom/vehicles.js';
import { boxMm } from './geom/shapes.js';
import * as M from './geom/materials.js';

import { makeSawdustPile } from './world/lumber.js';
import { createNailField } from './world/fasteners.js';
import { createDirector } from './sim/director.js';

import { createControls } from './ui/controls.js';
import { createInspector } from './ui/inspector.js';
import { createOverlays } from './ui/overlays.js';
import { createHud } from './ui/hud.js';

/* ---------------------------------------------------------------- *
 * Renderer, scene, lighting
 * ---------------------------------------------------------------- */

const isPhone = Math.min(window.innerWidth, window.innerHeight) < 768;
const budget = isPhone ? BUDGET.phone : BUDGET.desktop;

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({
  canvas, antialias: !isPhone, powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, budget.devicePixelRatioCap));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x9fb4c4);
// Fog has to be set against the size of the site, not against a guess. The map
// is 180 m across and the far building is ~110 m from the near one, so fog that
// starts at 40 m washes out the thing you are trying to look at.
scene.fog = new THREE.Fog(0x9fb4c4, mm(120000), mm(420000));

const camera = new THREE.PerspectiveCamera(
  isPhone ? 62 : 52, window.innerWidth / window.innerHeight, mm(60), mm(400000)
);

const hemi = new THREE.HemisphereLight(0xdfeaf2, 0x5c6350, 1.15);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2dd, 2.1);
sun.position.set(mm(24000), mm(38000), mm(16000));
sun.castShadow = true;
sun.shadow.mapSize.set(budget.shadowMapSize, budget.shadowMapSize);
sun.shadow.camera.near = mm(1000);
sun.shadow.camera.far = mm(90000);
const sh = 9000;
sun.shadow.camera.left = -mm(sh); sun.shadow.camera.right = mm(sh);
sun.shadow.camera.top = mm(sh); sun.shadow.camera.bottom = -mm(sh);
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);

/* ---------------------------------------------------------------- *
 * The world
 * ---------------------------------------------------------------- */

const site = buildSite();
scene.add(site.root);

// Factory interiors are roofed, so the sun does not reach them. Real shops are
// lit by high-bay fittings; these are three of them, one per building, with the
// fitting modelled so the light comes from something visible.
for (const b of BUILDINGS) {
  const lamp = new THREE.PointLight(0xfff4e0, isPhone ? 3.2 : 4.0, mm(48000), 1.6);
  lamp.position.set(mm(b.centreMm[0]), mm(b.heightMm - 1400), mm(b.centreMm[1]));
  lamp.castShadow = false;   // measured decision: shadow-casting point lights
  scene.add(lamp);           // cost a cube render each; the sun already casts.
  const fitting = new THREE.Mesh(
    boxMm(2400, 120, 700),
    new THREE.MeshStandardMaterial({ color: 0xfff4e0, emissive: 0xfff4e0, emissiveIntensity: 1.2 })
  );
  fitting.position.copy(lamp.position);
  scene.add(fitting);
}

const B1 = BUILDINGS[0], B2 = BUILDINGS[1], B3 = BUILDINGS[2];
const cutShopOrigin = [B1.centreMm[0], 0, B1.centreMm[1]];
const panelShopOrigin = [B2.centreMm[0], 0, B2.centreMm[1]];
const crateShopOrigin = [B3.centreMm[0], 0, B3.centreMm[1]];

/* ---- cut shop --------------------------------------------------- */

const saw = buildSaw();
saw.root.position.set(mm(cutShopOrigin[0]), 0, mm(cutShopOrigin[2]));
scene.add(saw.root);

const sawdust = makeSawdustPile();
sawdust.mesh.position.set(mm(cutShopOrigin[0]), 0, mm(cutShopOrigin[2] - 300));
scene.add(sawdust.mesh);

// A pedestal, because a 1150 mm arm mounted on the floor cannot reach a 900 mm
// table. The pedestal height is derived from that, not chosen for looks.
const ARM_PEDESTAL_MM = 700;
const armPedestal = new THREE.Mesh(boxMm(420, ARM_PEDESTAL_MM, 420), M.darkSteel());
armPedestal.position.set(
  mm(cutShopOrigin[0] + 700), mm(ARM_PEDESTAL_MM / 2), mm(cutShopOrigin[2] - 760)
);
armPedestal.castShadow = armPedestal.receiveShadow = true;
scene.add(armPedestal);

const cutArm = buildArm();
cutArm.root.position.set(
  mm(cutShopOrigin[0] + 700), mm(ARM_PEDESTAL_MM), mm(cutShopOrigin[2] - 760)
);
scene.add(cutArm.root);

const gripLight = buildGripper();
const gripHeavy = buildHeavyGripper();
cutArm.toolMount.add(gripLight.root);
cutArm.toolMount.add(gripHeavy.root);
gripHeavy.root.visible = false;
// The solver drives the tool tip, so it has to know how far past the flange
// the active tool reaches.
cutArm.setToolOffset(gripLight.spec.GEOMETRY.tcpOffsetMm);

const conveyorOut = buildConveyor(2400);
conveyorOut.root.position.set(
  mm(cutShopOrigin[0] + 700), 0, mm(cutShopOrigin[2] - 1500)
);
conveyorOut.root.rotation.y = Math.PI / 2;
scene.add(conveyorOut.root);
conveyorOut.positionMm = [cutShopOrigin[0] + 700, 0, cutShopOrigin[2] - 1500];

/* ---- panel shop -------------------------------------------------- */

const panelAnvil = buildClinchAnvil();
panelAnvil.root.position.set(mm(panelShopOrigin[0]), mm(760), mm(panelShopOrigin[2]));
scene.add(panelAnvil.root);

const panelFixture = new THREE.Mesh(boxMm(4000, 760, 2200), M.machineTrim());
panelFixture.position.set(mm(panelShopOrigin[0]), mm(380), mm(panelShopOrigin[2]));
panelFixture.receiveShadow = true;
scene.add(panelFixture);

const panelPedestal = new THREE.Mesh(boxMm(420, ARM_PEDESTAL_MM, 420), M.darkSteel());
panelPedestal.position.set(mm(panelShopOrigin[0] + 1500), mm(ARM_PEDESTAL_MM / 2), mm(panelShopOrigin[2] - 1400));
scene.add(panelPedestal);

const panelArm = buildArm();
panelArm.root.position.set(mm(panelShopOrigin[0] + 1500), mm(ARM_PEDESTAL_MM), mm(panelShopOrigin[2] - 1400));
scene.add(panelArm.root);
const nailer = buildNailer();
panelArm.toolMount.add(nailer.root);
panelArm.setToolOffset(nailer.noseOffsetMm);

const conveyorPanelIn = buildConveyor(3000);
conveyorPanelIn.root.position.set(mm(panelShopOrigin[0] - 2600), 0, mm(panelShopOrigin[2]));
scene.add(conveyorPanelIn.root);

/* ---- crate shop -------------------------------------------------- */

const pallet = buildPallet();
pallet.root.position.set(mm(crateShopOrigin[0]), 0, mm(crateShopOrigin[2]));
scene.add(pallet.root);

const crateFixture = new THREE.Mesh(boxMm(3000, 200, 2400), M.concrete());
crateFixture.position.set(mm(crateShopOrigin[0]), mm(100), mm(crateShopOrigin[2]));
crateFixture.receiveShadow = true;
scene.add(crateFixture);

const forklift = buildForklift();
forklift.root.position.set(mm(crateShopOrigin[0] - 6000), 0, mm(crateShopOrigin[2] + 5000));
forklift.root.rotation.y = Math.PI;
forklift.setTineSpacing(500);
scene.add(forklift.root);

const truck = buildTruck();
truck.root.position.set(mm(-20000), 0, mm(-32000));
scene.add(truck.root);

/* ---- fasteners --------------------------------------------------- */

const nails = createNailField(scene);

/* ---- register the machines so they are inspectable too ----------- */
// V1-TEST 75 says "any object", not "any board". A saw that cannot be selected
// cannot be checked.
function registerMachine({ kind, type, specId, object3D, dimsMm = null, stage = null, meta = {} }) {
  const node = graph.createNode({
    kind, type, specId, dimsMm, state: 'PLACED', stage, originKind: 'INSTALLED',
    meta: { ...meta, staticInstalled: true },
  });
  object3D.userData.owId = node.id;
  node.view = { object3D };
  return node;
}

registerMachine({ kind: 'MCH', type: 'crosscut saw', specId: 'OW-S1', object3D: saw.root, stage: 'CUT_SHOP',
  dimsMm: { lengthMm: TABLE.lengthMm, widthMm: TABLE.widthMm, heightMm: TABLE.heightMm },
  meta: { collisionGroup: 'MACHINE', bladeKerfMm: 3.5 } });
const cutArmNode = registerMachine({ kind: 'RBT', type: 'six-axis arm', specId: 'OW-A6', object3D: cutArm.root, stage: 'CUT_SHOP',
  meta: { collisionGroup: 'ROBOT' } });
const panelArmNode = registerMachine({ kind: 'RBT', type: 'six-axis arm', specId: 'OW-A6', object3D: panelArm.root, stage: 'PANEL_SHOP',
  meta: { collisionGroup: 'ROBOT' } });
registerMachine({ kind: 'MCH', type: 'roller conveyor', specId: 'OW-C', object3D: conveyorOut.root, stage: 'CUT_SHOP',
  dimsMm: { lengthMm: 2400 }, meta: { collisionGroup: 'MACHINE', rollers: conveyorOut.rollerCount } });
registerMachine({ kind: 'MCH', type: 'roller conveyor', specId: 'OW-C', object3D: conveyorPanelIn.root, stage: 'PANEL_SHOP',
  dimsMm: { lengthMm: 3000 }, meta: { collisionGroup: 'MACHINE', rollers: conveyorPanelIn.rollerCount } });
registerMachine({ kind: 'VEH', type: 'flatbed truck', specId: 'OW-T7', object3D: truck.root,
  meta: { collisionGroup: 'VEHICLE' } });
registerMachine({ kind: 'VEH', type: 'counterbalance forklift', specId: 'OW-F15', object3D: forklift.root, stage: 'CRATE_SHOP',
  meta: { collisionGroup: 'VEHICLE' } });
registerMachine({ kind: 'PAL', type: 'stringer pallet', specId: 'OW-P48', object3D: pallet.root, stage: 'CRATE_SHOP',
  dimsMm: { lengthMm: 1219.2, widthMm: 1016, heightMm: pallet.heightMm, partCount: pallet.parts.length },
  meta: { collisionGroup: 'STOCK' } });
for (const b of site.buildings) {
  registerMachine({ kind: 'BLD', type: b.spec.label, specId: b.spec.id, object3D: b.root, stage: b.spec.stage,
    dimsMm: { lengthMm: b.spec.footprintMm[0], widthMm: b.spec.footprintMm[1], heightMm: b.spec.heightMm },
    meta: { collisionGroup: 'WORLD', openingWidthMm: b.openingWidthMm, openingHeightMm: b.openingHeightMm } });
}

/* ---------------------------------------------------------------- *
 * Director
 * ---------------------------------------------------------------- */

const clock = { ms: 0 };

const ctx = {
  scene, clock, repeat: true,
  saw, cutArm, conveyorOut, sawdust, cutShopOrigin,
  panelArm, nailer, nails, panelShopOrigin, panelFixtureTopMm: 760,
  crateShopOrigin, pallet, forklift, truck,
  arms: [cutArm, panelArm],
  lastReport: null,
  /** Where a cut piece is presented to the arm, relative to the cut shop origin. */
  pickOffsetMm: [700, 0, 100],
  gripperFor(profile) {
    const id = TOOL_ASSIGNMENT.byProfile[profile.id];
    const active = id === 'OW-G3' ? gripHeavy : gripLight;
    if (active.root.visible === false) {
      gripLight.root.visible = active === gripLight;
      gripHeavy.root.visible = active === gripHeavy;
      // A tool change moves the tip, and the solver must be told.
      cutArm.setToolOffset(active.spec.GEOMETRY.tcpOffsetMm);
      graph.record(cutArm.spec.id, 'TOOL_CHANGE', {
        to: active.spec.id, forProfile: profile.id, ms: TOOL_ASSIGNMENT.toolChangeMs,
      }, 'CUT_SHOP');
    }
    return active;
  },
};

const director = createDirector(ctx);

/* ---------------------------------------------------------------- *
 * UI
 * ---------------------------------------------------------------- */

const uiRoot = document.getElementById('ui');
const controls = createControls(camera, renderer.domElement, {
  targetMm: [cutShopOrigin[0], 1200, cutShopOrigin[2]],
});
controls.lookAt([cutShopOrigin[0], 1200, cutShopOrigin[2]], 9000);

const overlays = createOverlays(scene, ctx);
const inspector = createInspector({
  scene, camera, renderer, dom: uiRoot, nails,
  onFocus: (posMm, distMm) => controls.lookAt(posMm, distMm),
});

let stageIndex = 0;
const stageViews = [
  { mm: [cutShopOrigin[0], 1200, cutShopOrigin[2]], d: 9000 },
  { mm: [panelShopOrigin[0], 1200, panelShopOrigin[2]], d: 11000 },
  { mm: [crateShopOrigin[0], 1200, crateShopOrigin[2]], d: 9000 },
  { mm: [8000, 2000, 0], d: 120000 },
];

let speed = 4;
const hud = createHud({
  dom: uiRoot, director, overlays, renderer,
  onSpeed: (s) => { speed = s; },
  onRestart: () => location.reload(),
  onFocusStage: () => {
    stageIndex = (stageIndex + 1) % stageViews.length;
    controls.lookAt(stageViews[stageIndex].mm, stageViews[stageIndex].d);
  },
});

// Tap to select. A drag is not a tap.
renderer.domElement.addEventListener('pointerup', (e) => {
  if (controls.wasDrag) return;
  inspector.pickAt(e.clientX, e.clientY);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, budget.devicePixelRatioCap));
});

/* ---------------------------------------------------------------- *
 * Loops
 * ---------------------------------------------------------------- */

const FIXED = DETERMINISM.fixedTimestepMs / 1000;
let acc = 0;
let lastT = performance.now();
let sinceValidate = 0;
let sinceOverlay = 0;

conveyorOut.run(true);
conveyorPanelIn.run(true);

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  let dt = (now - lastT) / 1000;
  lastT = now;
  dt = Math.min(dt, 0.1);

  // Fixed-step process. Wall-clock speed changes how many steps run per frame;
  // it never changes what a step does.
  acc += dt * speed;
  let guard = 0;
  while (acc >= FIXED && guard++ < 240) {
    acc -= FIXED;
    clock.ms += DETERMINISM.fixedTimestepMs;
    director.step(FIXED);
  }

  // View-only updates run at frame rate.
  saw.update(dt * speed);
  conveyorOut.update(dt * speed);
  conveyorPanelIn.update(dt * speed);
  truck.update(dt * speed);
  forklift.update(dt * speed);
  controls.update();

  sinceValidate += dt;
  if (sinceValidate > 1.0) {
    sinceValidate = 0;
    const report = validateWorld({ nowMs: clock.ms, supportSurfaces: supportSurfaces() });
    ctx.lastReport = report;
    hud.setReport(report);
  }

  sinceOverlay += dt;
  if (sinceOverlay > 0.5 && overlays.activeCount() > 0) { sinceOverlay = 0; overlays.refresh(); }

  inspector.refresh();
  hud.frame();
  hud.update();
  renderer.render(scene, camera);
}

/** Surfaces an object may rest on, in world millimetres. */
function supportSurfaces() {
  const s = [...site.supportSurfaces()];
  const wide = (cx, cz, w, d, topMm) => ({
    topMm, minX: mm(cx - w / 2), maxX: mm(cx + w / 2), minZ: mm(cz - d / 2), maxZ: mm(cz + d / 2),
  });
  s.push(wide(cutShopOrigin[0], cutShopOrigin[2], TABLE.lengthMm, TABLE.widthMm, TABLE.heightMm));
  s.push(wide(cutShopOrigin[0] + 700, cutShopOrigin[2] - 1500, 800, 2400, conveyorOut.topYMm));
  s.push(wide(cutShopOrigin[0] + 700, cutShopOrigin[2] - 760, 420, 420, ARM_PEDESTAL_MM));
  s.push(wide(panelShopOrigin[0] + 1500, panelShopOrigin[2] - 1400, 420, 420, ARM_PEDESTAL_MM));
  s.push(wide(panelShopOrigin[0], panelShopOrigin[2], 4000, 2200, 760));
  s.push(wide(crateShopOrigin[0], crateShopOrigin[2], 3000, 2400, 200));
  s.push(wide(crateShopOrigin[0], crateShopOrigin[2], 1220, 1016, pallet.deckTopYMm));
  return s;
}

document.getElementById('boot')?.remove();
frame();

/* Expose for measurement from the console and from automated checks. */
window.OW = {
  graph, ops, scene, renderer, camera, director, inspector, overlays, nails,
  validate: () => validateWorld({ nowMs: clock.ms, supportSurfaces: supportSurfaces() }),
  metrics: () => ({
    fps: hud.fps, fps1pctLow: hud.fps1pctLow,
    drawCalls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    geometries: renderer.info.memory.geometries,
    nodes: graph.count(),
    viewport: [window.innerWidth, window.innerHeight],
    dpr: window.devicePixelRatio,
    budget,
    state: { ...director.state },
  }),
  setSpeed: (s) => { speed = s; },
};
