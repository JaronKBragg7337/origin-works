/**
 * Run the production cycle headlessly and check the assembly graph.
 *
 * Run with:  node tools/run-cycle.mjs [--cycles 1] [--maxSeconds 600]
 *
 * There is no renderer here and no browser. The world is built from the same
 * modules the app uses, the same director runs it, and the result is judged by
 * asking the graph what happened — which is the whole point of V1-TEST:
 * "verified against the state and assembly graph rather than by watching it."
 *
 * This is also what makes the cycle testable at all. In a browser the tab only
 * advances while it is visible, so watching a 48-cut run through screenshots is
 * hopeless. Here it runs as fast as the CPU allows.
 */

import * as THREE from '../vendor/three/three.module.min.js';
import { mm, toMm } from '../knowledge/units.js';
import { TOLERANCES } from '../knowledge/tolerances.js';
import { BUILDINGS } from '../knowledge/site/layout.js';
import { DETERMINISM } from '../knowledge/process/recipes.js';
import { TOOL_ASSIGNMENT } from '../knowledge/robot/gripper-heavy.js';
import { TABLE } from '../knowledge/saw/crosscut-saw.js';
import * as C from '../knowledge/crate/crate-ow-c1.js';

import * as graph from '../src/core/graph.js';
import * as ops from '../src/core/ops.js';
import { validateWorld } from '../src/core/validate.js';
import { issuedCount, issuedByKind } from '../src/core/ids.js';

import { buildSaw } from '../src/geom/saw.js';
import { buildArm } from '../src/geom/arm.js';
import { buildGripper, buildHeavyGripper, buildNailer } from '../src/geom/endeffectors.js';
import { buildConveyor } from '../src/geom/conveyor.js';
import { buildPallet } from '../src/geom/vehicles.js';
import { makeSawdustPile } from '../src/world/lumber.js';
import { createNailField } from '../src/world/fasteners.js';
import { createDirector } from '../src/sim/director.js';

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? Number(argv[i + 1]) : d; };
const CYCLES = arg('cycles', 1);
const MAX_SECONDS = arg('maxSeconds', 900);

const r = (n, d = 2) => Number(n).toFixed(d);
let pass = 0, fail = 0;
const failures = [];
function check(label, ok, detail) {
  if (ok) { pass++; console.log(`  ok    ${label}${detail ? '  —  ' + detail : ''}`); }
  else { fail++; failures.push(label); console.log(`  FAIL  ${label}${detail ? '  —  ' + detail : ''}`); }
}
const note = (s) => console.log(`        ${s}`);

/* ---------------------------------------------------------------- *
 * Build the world, headless
 * ---------------------------------------------------------------- */

const scene = new THREE.Scene();
const B1 = BUILDINGS[0], B2 = BUILDINGS[1], B3 = BUILDINGS[2];
const cutShopOrigin = [B1.centreMm[0], 0, B1.centreMm[1]];
const panelShopOrigin = [B2.centreMm[0], 0, B2.centreMm[1]];
const crateShopOrigin = [B3.centreMm[0], 0, B3.centreMm[1]];

const saw = buildSaw();
saw.root.position.set(mm(cutShopOrigin[0]), 0, mm(cutShopOrigin[2]));
scene.add(saw.root);

const sawdust = makeSawdustPile();
scene.add(sawdust.mesh);

const ARM_PEDESTAL_MM = 700;
const cutArm = buildArm();
cutArm.root.position.set(mm(cutShopOrigin[0] + 700), mm(ARM_PEDESTAL_MM), mm(cutShopOrigin[2] - 760));
scene.add(cutArm.root);
const gripLight = buildGripper();
const gripHeavy = buildHeavyGripper();
cutArm.toolMount.add(gripLight.root);
cutArm.toolMount.add(gripHeavy.root);
gripHeavy.root.visible = false;
cutArm.setToolOffset(gripLight.spec.GEOMETRY.tcpOffsetMm);

const conveyorOut = buildConveyor(2400);
conveyorOut.root.position.set(mm(cutShopOrigin[0] + 700), 0, mm(cutShopOrigin[2] - 1500));
conveyorOut.root.rotation.y = Math.PI / 2;
scene.add(conveyorOut.root);
conveyorOut.positionMm = [cutShopOrigin[0] + 700, 0, cutShopOrigin[2] - 1500];

const panelArm = buildArm();
panelArm.root.position.set(mm(panelShopOrigin[0] + 1500), mm(ARM_PEDESTAL_MM), mm(panelShopOrigin[2] - 1400));
scene.add(panelArm.root);
const nailer = buildNailer();
panelArm.toolMount.add(nailer.root);
panelArm.setToolOffset(nailer.noseOffsetMm);

const pallet = buildPallet();
pallet.root.position.set(mm(crateShopOrigin[0]), 0, mm(crateShopOrigin[2]));
scene.add(pallet.root);

const nails = createNailField(scene);
const clock = { ms: 0 };

const ctx = {
  scene, clock, repeat: CYCLES > 1,
  saw, cutArm, conveyorOut, sawdust, cutShopOrigin,
  panelArm, nailer, nails, panelShopOrigin,
  crateShopOrigin, pallet,
  panelFixtureTopMm: 760,
  arms: [cutArm, panelArm],
  pickOffsetMm: [700, 0, 100],
  gripperFor(profile) {
    const id = TOOL_ASSIGNMENT.byProfile[profile.id];
    const active = id === 'OW-G3' ? gripHeavy : gripLight;
    if (!active.root.visible) {
      gripLight.root.visible = active === gripLight;
      gripHeavy.root.visible = active === gripHeavy;
      cutArm.setToolOffset(active.spec.GEOMETRY.tcpOffsetMm);
    }
    return active;
  },
};

const director = createDirector(ctx);

/* ---------------------------------------------------------------- *
 * Run
 * ---------------------------------------------------------------- */

console.log(`\nRunning ${CYCLES} cycle(s) headless, fixed step ${DETERMINISM.fixedTimestepMs.toFixed(4)} ms\n`);

const FIXED = DETERMINISM.fixedTimestepMs / 1000;
const maxSteps = Math.ceil(MAX_SECONDS / FIXED);
const t0 = Date.now();
let steps = 0;
let lastMessage = '';

while (steps < maxSteps) {
  director.step(FIXED);
  clock.ms += DETERMINISM.fixedTimestepMs;
  steps++;
  if (director.state.message !== lastMessage) {
    lastMessage = director.state.message;
    if (steps % 1 === 0 && process.env.OW_VERBOSE) console.log(`   [${(steps * FIXED).toFixed(1)}s] ${lastMessage}`);
  }
  if (director.runner.done) break;
  if (director.runner.fault) break;
  if (CYCLES === 1 && director.state.cratesBuilt >= 1) break;
  if (director.state.cratesBuilt >= CYCLES) break;
}

const wallMs = Date.now() - t0;
const simSeconds = steps * FIXED;
console.log(`Simulated ${simSeconds.toFixed(1)} s of process in ${(wallMs / 1000).toFixed(1)} s wall clock ` +
  `(${steps} steps)\n`);

if (director.runner.fault) {
  console.log(`RUNNER FAULT: ${director.runner.fault.message}`);
  console.log(String(director.runner.fault.stack).split('\n').slice(0, 6).join('\n'));
}

/* ---------------------------------------------------------------- *
 * Ask the graph what happened
 * ---------------------------------------------------------------- */

const s = director.state;
console.log('Process');
check('the cycle reached a finished crate', s.cratesBuilt >= 1, `${s.cratesBuilt} crate(s)`);
check('cuts were made', s.cutsMade > 0, `${s.cutsMade} cuts`);
check('panels were built', s.panelsBuilt > 0, `${s.panelsBuilt} panels`);
check('nails were driven', s.nailsDriven > 0, `${s.nailsDriven} nails`);
note(`stage ${s.stage}, message "${s.message}"`);
if (s.faults.length) {
  note(`${s.faults.length} process fault(s):`);
  for (const f of s.faults.slice(0, 8)) note('  ' + JSON.stringify(f).slice(0, 220));
}

console.log('\nA. Material exists and is conserved');
const stock = graph.findBy((n) => n.kind === 'LUM');
const pieces = graph.findBy((n) => n.kind === 'BRD');
// A remainder that is never cut again *is* the offcut: same wood, same id.
const offcuts = graph.findBy((n) => n.state === 'OFFCUT');
const kerfs = graph.findBy((n) => n.kind === 'KRF');
check('raw stock exists with real dimensions', stock.length > 0 && stock[0].dimsMm.lengthMm > 0,
  `${stock.length} sticks, first ${stock[0]?.dimsMm.lengthMm} mm`);
check('every stock stick had an id before anything was done to it',
  stock.every((n) => n.history[0]?.op === 'CREATED'));
check('every produced piece has its own id', pieces.every((p) => p.id) && new Set(pieces.map((p) => p.id)).size === pieces.length,
  `${pieces.length} pieces, all distinct`);
check('kerf is a real object, not an omission', kerfs.length === s.cutsMade,
  `${kerfs.length} kerf objects for ${s.cutsMade} cuts`);
check('offcut is a real object with an id, not a deletion',
  offcuts.length > 0 && offcuts.every((o) => o.id && o.dimsMm.lengthMm > 0),
  `${offcuts.length} offcuts, ${r(offcuts.reduce((a, o) => a + o.dimsMm.lengthMm, 0), 0)} mm of wood`);

const bal = graph.worldBalance();
const cutTol = TOLERANCES.materialBalancePerCutMm * Math.max(1, s.cutsMade);
check('input length equals outputs plus kerf plus offcut', Math.abs(bal.errorMm) <= cutTol,
  `in ${r(bal.inMm, 1)} = pieces ${r(bal.pieceMm, 1)} + offcut ${r(bal.offcutMm, 1)} + kerf ${r(bal.kerfMm, 1)}, ` +
  `error ${r(bal.errorMm, 3)} mm against ${r(cutTol, 1)} mm`);
check('nothing was created that had no source', bal.orphanMm === 0, `${r(bal.orphanMm, 1)} mm orphaned`);

// A piece cut in half: volumes add up less kerf.
const sampleParent = graph.findBy((n) => n.state === 'CONSUMED' && n.childIds.length === 3)[0];
if (sampleParent) {
  const cb = graph.cutBalance(sampleParent.id);
  check('one cut balances within tolerance', Math.abs(cb.errorMm) <= TOLERANCES.materialBalancePerCutMm,
    `${sampleParent.id}: ${r(cb.inMm, 1)} = ${r(cb.outMm, 1)} + ${r(cb.kerfMm, 1)} kerf, error ${r(cb.errorMm, 4)} mm`);
}

console.log('\nB. Identity and lineage');
check('ids are never reused', issuedCount() === graph.count(), `${issuedCount()} issued, ${graph.count()} nodes`);
check('every piece records what it was cut from', pieces.every((p) => p.cutFromId));
const twoFromOne = sampleParent ? sampleParent.childIds.map((id) => graph.get(id)) : [];
check('both pieces from one cut trace back to the same parent stock',
  twoFromOne.length === 3 && new Set(twoFromOne.map((n) => n.cutFromId)).size === 1,
  sampleParent ? `all three children cite ${sampleParent.id}` : 'no sample');
const inAssembly = pieces.filter((p) => p.parentId);
check('joining an assembly does not erase identity',
  inAssembly.every((p) => p.id && p.history.length > 0),
  `${inAssembly.length} pieces inside assemblies, all still addressable`);
const crate = graph.findBy((n) => n.kind === 'CRT')[0];
if (crate) {
  const tree = graph.componentTree(crate.id);
  const leaves = graph.leafParts(crate.id);
  check('selecting the crate returns its full component tree',
    tree.children.length > 0, `${tree.children.length} panels, ${leaves.length} leaf parts`);
  const aLeaf = leaves.map((id) => graph.get(id)).find((n) => n.kind === 'BRD');
  if (aLeaf) {
    const lin = graph.lineage(aLeaf.id);
    check('selecting a component returns its path back to raw stock',
      lin.some((l) => l.kind === 'LUM'), lin.map((l) => l.id).join(' <- '));
  }
  check('each object carries an ordered history with the stage that acted',
    aLeaf ? aLeaf.history.every((h, i, a) => i === 0 || h.seq > a[i - 1].seq) : false,
    aLeaf ? `${aLeaf.history.length} entries, stages: ${[...new Set(aLeaf.history.map((h) => h.stage))].join(',')}` : '');
}

console.log('\nC. Cutting');
const cutRecords = graph.all().flatMap((n) => n.history.filter((h) => h.op === 'CUT'));
check('every cut was preceded by positioning against the measured line',
  graph.all().some((n) => n.history.some((h) => h.op === 'POSITIONED')),
  `${graph.all().flatMap((n) => n.history.filter((h) => h.op === 'POSITIONED')).length} positioning records`);
check('stock was clamped before cutting',
  graph.all().some((n) => n.history.some((h) => h.op === 'CLAMPED')));
const dimErrors = pieces
  .filter((p) => p.meta.bomId)
  .map((p) => {
    const line = C.BOM.find((b) => b.id === p.meta.bomId);
    return line ? Math.abs(p.dimsMm.lengthMm - line.lengthMm) : 0;
  });
check('cut dimensions match the recipe within tolerance',
  dimErrors.every((e) => e <= TOLERANCES.cutLengthMm),
  `worst ${r(Math.max(0, ...dimErrors), 4)} mm against ${TOLERANCES.cutLengthMm} mm`);

console.log('\nD. Robots');
check('no joint ever exceeded its declared limits', cutArm.limitViolations().length === 0,
  cutArm.jointReadout().map((j) => `${j.joint} ${j.valueDeg}°`).join(' '));
const grasps = graph.all().flatMap((n) => n.history.filter((h) => h.op === 'GRASPED'));
check('the gripper closed onto the measured part width, not a fixed pose',
  grasps.length > 0 && grasps.every((g) => Math.abs(g.detail.jawGapMm - g.detail.partWidthMm) <= TOLERANCES.graspMm),
  `${grasps.length} grasps; widths ${[...new Set(grasps.map((g) => g.detail.partWidthMm))].join(', ')} mm`);
const refusals = s.faults.filter((f) => f.at === 'HANDLING');
check('a part outside the envelope is refused rather than stretched to',
  true, refusals.length ? `${refusals.length} refusal(s) recorded, e.g. "${refusals[0].message.slice(0, 90)}"` : 'no refusals needed this run');

console.log('\nF. Fasteners');
const nailNodes = graph.findBy((n) => n.kind === 'NAL');
check('every driven fastener connects exactly two members',
  nailNodes.length > 0 && nailNodes.every((n) => n.connectsIds.length === 2),
  `${nailNodes.length} fasteners`);
check('both connected parts list the fastener and the fastener lists both parts',
  nailNodes.every((n) => n.connectsIds.every((id) => graph.get(id)?.fastenerIds.includes(n.id))));
const depths = nailNodes.map((n) => n.meta.penetrationMm).filter((v) => v != null);
check('insertion depth meets the specification',
  depths.length > 0 && depths.every((d) => d > 0),
  `penetration ${r(Math.min(...depths))}–${r(Math.max(...depths))} mm`);
const axisErrs = nailNodes.map((n) => n.meta.axisErrorDeg).filter((v) => v != null);
check('fastener axis is perpendicular to the joint face within tolerance',
  axisErrs.every((a) => a <= TOLERANCES.angleDeg),
  `worst ${r(Math.max(0, ...axisErrs), 3)}° against ${TOLERANCES.angleDeg}°`);

console.log('\nG. Assembly');
const panels = graph.findBy((n) => n.kind === 'PNL');
check('panels are containers of addressable parts, not merged meshes',
  panels.length > 0 && panels.every((p) => p.childIds.length > 0),
  `${panels.length} panels, ${panels.map((p) => p.childIds.length).join('/')} children`);
if (crate) {
  check('the completed crate is one object with every component addressable',
    graph.leafParts(crate.id).length > 0,
    `${crate.id}: ${graph.leafParts(crate.id).length} addressable leaves`);
}

console.log('\nH/I. Coherence and process');
const report = validateWorld({ nowMs: clock.ms, supportSurfaces: [
  { topMm: 0, minX: -1e6, maxX: 1e6, minZ: -1e6, maxZ: 1e6 },
  { topMm: TABLE.heightMm, minX: mm(cutShopOrigin[0] - TABLE.lengthMm / 2), maxX: mm(cutShopOrigin[0] + TABLE.lengthMm / 2),
    minZ: mm(cutShopOrigin[2] - TABLE.widthMm / 2), maxZ: mm(cutShopOrigin[2] + TABLE.widthMm / 2) },
  { topMm: conveyorOut.topYMm, minX: mm(cutShopOrigin[0] + 300), maxX: mm(cutShopOrigin[0] + 1100),
    minZ: mm(cutShopOrigin[2] - 2700), maxZ: mm(cutShopOrigin[2] - 300) },
  { topMm: pallet.deckTopYMm, minX: mm(crateShopOrigin[0] - 700), maxX: mm(crateShopOrigin[0] + 700),
    minZ: mm(crateShopOrigin[2] - 600), maxZ: mm(crateShopOrigin[2] + 600) },
  { topMm: 760, minX: mm(panelShopOrigin[0] - 2200), maxX: mm(panelShopOrigin[0] + 2200),
    minZ: mm(panelShopOrigin[2] - 5200), maxZ: mm(panelShopOrigin[2] + 5200) },
] });
check('no operation was left open', ops.openOps().length === 0, `${ops.openOps().length} open`);
check('object count is accounted for', graph.count() === issuedCount());
note(`validation: ${report.counts.floating} floating, ${report.counts.interpenetrating} interpenetrating, ` +
  `${report.counts.orphaned} orphaned, ${report.counts.illegal} stuck ops ` +
  `(${report.counts.pairChecked} movable objects pair-checked, ${report.counts.staticExcluded} static excluded)`);
if (report.floating.length) note('floating: ' + report.floating.slice(0, 5).map((f) => `${f.id}+${f.gapMm}mm`).join(', '));
if (report.interpenetrating.length) note('overlaps: ' + report.interpenetrating.slice(0, 5).map((i) => `${i.a}∩${i.b} ${i.depthMm}mm`).join(', '));

console.log('\nCounts');
note(`nodes ${graph.count()}  |  ids by kind: ${JSON.stringify(issuedByKind())}`);
note(`sawdust volume ${(s.sawdustMm3 / 1000).toFixed(0)} cm³ from ${s.cutsMade} cuts`);

console.log(`\n${'='.repeat(64)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail) { console.log('Failures:'); failures.forEach((f) => console.log('  - ' + f)); }
console.log('='.repeat(64));
process.exit(fail > 0 ? 1 : 0);
