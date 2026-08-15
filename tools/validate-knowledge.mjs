/**
 * Validate the specification layer.
 *
 * Run with:  node tools/validate-knowledge.mjs
 *
 * This runs before any geometry exists, and it is the reason the measurements
 * can be reviewed on their own. It recomputes every derived number, checks
 * every fastener against the rule the bill of materials claims justifies it,
 * balances the material, and checks the fits that V1-TEST asks about.
 *
 * A check that passes prints its number. A number without a check is not
 * evidence, and a check without a number is not a measurement.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as K from '../knowledge/index.js';
import { evaluateJoint, rowsForContactWidth, minClinchAllowanceMm } from '../knowledge/fastener/nailing-rules.js';
import { planCrate, stickBalance, cutList, transitionLegal } from '../knowledge/process/recipes.js';
import { rimSpeedMs } from '../knowledge/saw/crosscut-saw.js';
import { tineFits, loadFits } from '../knowledge/pallet/stringer-pallet.js';
import { loadWithinBed } from '../knowledge/vehicle/flatbed-truck.js';
import { truckClearsDoor, forkliftClearsDoor, routeLengthMm } from '../knowledge/site/layout.js';
import { closeOnWidth, canHold } from '../knowledge/robot/gripper-2f.js';
import { rollersUnder, MIN_ROLLERS_FOR_SUPPORT } from '../knowledge/conveyor/roller-conveyor.js';
import { massKg } from '../knowledge/units.js';
import { pieceVolumeMm3 } from '../knowledge/material/lumber.js';
import { nailVolumeMm3 } from '../knowledge/fastener/nails.js';
import { nailCount } from '../knowledge/crate/crate-ow-c1.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pass = 0;
let fail = 0;
const failures = [];
const sections = [];
let current = null;

function section(name) {
  current = { name, lines: [] };
  sections.push(current);
}
function check(label, ok, detail) {
  if (ok) { pass++; current.lines.push(`  ok    ${label}${detail ? '  —  ' + detail : ''}`); }
  else { fail++; failures.push(`${current.name}: ${label} — ${detail ?? ''}`); current.lines.push(`  FAIL  ${label}${detail ? '  —  ' + detail : ''}`); }
}
function note(text) { current.lines.push(`        ${text}`); }
const r = (n, d = 2) => Number(n).toFixed(d);

/* ================================================================== *
 * 1. Units: one conversion, and it round-trips.
 * ================================================================== */
section('Units');
{
  const { mm, toMm, WORLD_UNITS_PER_MM, MM_PER_WORLD_UNIT } = K.units;
  check('mm -> world -> mm round-trips', Math.abs(toMm(mm(838.2)) - 838.2) < 1e-9,
    `838.2 mm -> ${mm(838.2)} wu -> ${toMm(mm(838.2))} mm`);
  check('conversion constants are reciprocal',
    Math.abs(WORLD_UNITS_PER_MM * MM_PER_WORLD_UNIT - 1) < 1e-12,
    `${WORLD_UNITS_PER_MM} x ${MM_PER_WORLD_UNIT}`);
  check('mm() rejects non-finite input', (() => { try { mm(NaN); return false; } catch { return true; } })());
  check('1 world unit is 1 metre', MM_PER_WORLD_UNIT === 1000);
}

/* ================================================================== *
 * 2. Sourcing: every source id used must exist in SOURCES.md.
 * ================================================================== */
section('Sourcing');
{
  const sourcesMd = await readFile(join(__dirname, '..', 'SOURCES.md'), 'utf8');
  const declared = new Set([...sourcesMd.matchAll(/^##\s+(S\d+)\s+—/gm)].map((m) => m[1]));
  check('SOURCES.md declares every id in KNOWN_SOURCES',
    K.KNOWN_SOURCES.every((s) => declared.has(s)),
    `declared: ${[...declared].sort().join(', ')}`);

  // Walk every spec object and collect `source:` values actually used.
  const used = new Set();
  const seen = new WeakSet();
  const walk = (o) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return;
    seen.add(o);
    for (const [k, v] of Object.entries(o)) {
      if (k === 'source' && typeof v === 'string') used.add(v);
      else if (typeof v === 'object') walk(v);
    }
  };
  for (const key of Object.keys(K)) walk(K[key]);
  const unknown = [...used].filter((s) => !declared.has(s));
  check('no spec cites a source that SOURCES.md does not declare',
    unknown.length === 0, unknown.length ? `unknown: ${unknown.join(', ')}` : `cited: ${[...used].sort().join(', ')}`);
}

/* ================================================================== *
 * 3. Lumber: dressed sizes are the PS 20 values.
 * ================================================================== */
section('Lumber');
{
  const { PROFILES, DRESSED_MM } = K.lumber;
  check('nominal 1 in dressed thickness is 19.0 mm', DRESSED_MM.thickness[1] === 19.0);
  check('nominal 2 in dressed thickness is 38.1 mm', DRESSED_MM.thickness[2] === 38.1);
  check('1x6 is 19.0 x 139.7 mm',
    PROFILES.BOARD_1X6.thicknessMm === 19.0 && PROFILES.BOARD_1X6.widthMm === 139.7);
  check('4x4 is square', PROFILES.TIMBER_4X4.thicknessMm === PROFILES.TIMBER_4X4.widthMm,
    `${PROFILES.TIMBER_4X4.thicknessMm} mm`);
  check('every profile declares a source', Object.values(PROFILES).every((p) => p.source));
}

/* ================================================================== *
 * 4. Nails: the transcribed tables are internally consistent.
 * ================================================================== */
section('Nail tables');
{
  const { COMMON_NAILS, BOX_NAILS, nail } = K.nails;
  const ascending = (t) => t.every((n, i) => i === 0 || n.lengthMm > t[i - 1].lengthMm);
  check('common nail table is ascending by length', ascending(COMMON_NAILS));
  check('box nail table is ascending by length', ascending(BOX_NAILS));
  const inchOk = (t) => t.every((n) => Math.abs(n.lengthIn * 25.4 - n.lengthMm) < 0.06);
  check('common nail mm values match their inch values', inchOk(COMMON_NAILS));
  check('box nail mm values match their inch values', inchOk(BOX_NAILS));
  // S2: box nails are the same length as common nails but slightly smaller diameter.
  const shared = COMMON_NAILS.filter((c) => BOX_NAILS.some((b) => b.size === c.size));
  check('box nails share the length of the common nail of the same size, at smaller diameter',
    shared.every((c) => { const b = BOX_NAILS.find((x) => x.size === c.size);
      return b.lengthMm === c.lengthMm && b.diameterMm < c.diameterMm; }),
    `${shared.length} shared sizes checked`);
  const n8 = nail('common', '8d');
  check('8d common resolves to 63.5 x 3.33 mm', n8.lengthMm === 63.5 && n8.diameterMm === 3.33);
  check('lead hole is 90 % of shank', Math.abs(n8.leadHoleDiameterMm - 3.33 * 0.9) < 1e-6,
    `${r(n8.leadHoleDiameterMm, 3)} mm`);
}

/* ================================================================== *
 * 5. Crate geometry: every derived dimension recomputed independently.
 * ================================================================== */
section('Crate OW-C1 geometry');
{
  const C = K.crateSpec;
  check('length is six 139.7 mm boards', Math.abs(C.DIM.lengthMm - 6 * 139.7) < 1e-9, `${r(C.DIM.lengthMm, 1)} mm`);
  check('wall height is four 139.7 mm courses', Math.abs(C.DIM.wallHeightMm - 4 * 139.7) < 1e-9, `${r(C.DIM.wallHeightMm, 1)} mm`);
  check('floor deck sits at skid + deck thickness', Math.abs(C.FLOOR_Y_MM - (88.9 + 19.0)) < 1e-9, `${r(C.FLOOR_Y_MM, 1)} mm`);
  check('overall height is wall + lid', Math.abs(C.HEIGHT_MM - (C.DIM.wallHeightMm + 19.0)) < 1e-9, `${r(C.HEIGHT_MM, 1)} mm`);
  check('end panel fits between the side sheathing inner faces',
    Math.abs(C.END_PANEL_WIDTH_MM - (C.DIM.widthMm - 2 * 19.0)) < 1e-9, `${r(C.END_PANEL_WIDTH_MM, 1)} mm`);
  check('strut height fills floor deck to top rail',
    Math.abs(C.STRUT_HEIGHT_MM - (C.DIM.wallHeightMm - 88.9 - C.FLOOR_Y_MM)) < 1e-9, `${r(C.STRUT_HEIGHT_MM, 1)} mm`);
  check('header spans between the skids',
    Math.abs(C.HEADER_LENGTH_MM - (C.DIM.widthMm - 2 * 88.9)) < 1e-9, `${r(C.HEADER_LENGTH_MM, 1)} mm`);

  const lidClearance = (C.LID_OPENING_Z_MM - C.LID_CLEAT_LENGTH_MM) / 2;
  check('lid cleat clearance meets fitClearanceMm', lidClearance >= K.TOLERANCES.fitClearanceMm,
    `${r(lidClearance, 1)} mm per side, need ${K.TOLERANCES.fitClearanceMm}`);

  check('48 wooden parts', C.PART_COUNT === 48, `${C.PART_COUNT} parts`);
  note(`outside ${r(C.DIM.lengthMm, 1)} x ${r(C.DIM.widthMm, 1)} x ${r(C.HEIGHT_MM, 1)} mm`);
  note(`internal ${r(C.INTERNAL_MM.lengthMm, 1)} x ${r(C.INTERNAL_MM.widthMm, 1)} x ${r(C.INTERNAL_MM.heightMm, 1)} mm`);
}

/* ================================================================== *
 * 6. Joints: every fastener re-derived from the S1 rules.
 * ================================================================== */
section('Joints against S1 nailing rules');
{
  const C = K.crateSpec;
  for (const j of C.JOINTS) {
    const res = evaluateJoint({
      headMemberThicknessMm: j.headMemberThicknessMm,
      throughThicknessMm: j.throughThicknessMm,
      pointMemberThicknessMm: j.pointMemberThicknessMm,
      nailSpec: j.nail,
      manner: j.manner,
    });
    const c = res.computed;
    const desc = `${j.nail.type} ${j.nail.size} ${j.nail.lengthMm} mm, ` +
      `penetration ${r(c.penetrationMm)} mm, ` +
      (c.clinched ? `clinch ${r(c.protrusionMm)} mm (min ${r(minClinchAllowanceMm(j.nail.size))})` : `no protrusion`);
    check(`${j.id}`, res.ok, res.ok ? desc : res.findings.join('; '));

    if (j.clinched !== undefined) {
      check(`${j.id} clinch claim matches the rule`, j.clinched === c.clinched,
        `BOM ${j.clinched}, rule ${c.clinched}`);
    }
    if (j.rows !== undefined) {
      // Contact width is the point member's face width presented to the run.
      const contactWidthMm = j.id === 'J3_BASE_FLOOR_TO_SKID' || j.id === 'J5_WALL_TO_BASE' ? 88.9 : 19.0;
      check(`${j.id} row count matches S1 rule 11`, j.rows === rowsForContactWidth(contactWidthMm),
        `${j.rows} rows for ${contactWidthMm} mm contact`);
    }
  }

  const perJoint = C.JOINTS.map((j) => `${j.id}=${nailCount(j)}`);
  note(perJoint.join('  '));
  check('total nail count is positive and derived', C.TOTAL_NAILS > 0, `${C.TOTAL_NAILS} nails`);
}

/* ================================================================== *
 * 7. Assembly order: nothing is fastened to what is not yet present.
 * ================================================================== */
section('Assembly order');
{
  const C = K.crateSpec;
  const bomIds = new Set(C.BOM.map((b) => b.id));
  const available = new Set(bomIds);
  let ok = true; const missing = [];
  for (const step of C.ASSEMBLY_ORDER) {
    for (const need of step.consumes) {
      if (!available.has(need)) { ok = false; missing.push(`step ${step.step} needs ${need}`); }
    }
    available.add(step.produces);
  }
  check('every step\'s inputs exist before it runs', ok, missing.join('; ') || `${C.ASSEMBLY_ORDER.length} steps`);
  check('the last step produces a closed crate',
    C.ASSEMBLY_ORDER.at(-1).produces === 'CRATE_CLOSED');
  const joinIds = new Set(C.JOINTS.map((j) => j.id));
  const badJoints = C.ASSEMBLY_ORDER.flatMap((s) => s.joints).filter((j) => !joinIds.has(j));
  check('every step cites a joint that exists', badJoints.length === 0, badJoints.join(', '));
}

/* ================================================================== *
 * 8. Material accounting: input = outputs + kerf + offcut.
 * ================================================================== */
section('Material accounting');
{
  const plan = planCrate();
  let totalInput = 0, totalOut = 0, totalKerf = 0, totalOffcut = 0, worstErr = 0, sticks = 0;
  for (const p of plan) {
    for (const stick of p.chosen.plan) {
      const b = stickBalance(stick);
      worstErr = Math.max(worstErr, Math.abs(b.errorMm));
      totalInput += b.inputMm; totalOut += b.outputsMm; totalKerf += b.kerfMm; totalOffcut += b.offcutMm;
      sticks++;
    }
    note(`${p.profileId}: ${p.pieceCount} pieces from ${p.chosen.sticks} x ${p.chosen.stockLengthMm} mm ` +
      `(${p.chosen.stockId}), kerf ${r(p.chosen.kerfMm, 1)} mm, offcut ${r(p.chosen.offcutMm, 1)} mm, yield ${p.chosen.yieldPct} %`);
  }
  const tol = K.TOLERANCES.materialBalancePerCutMm;
  check('every stick balances within tolerance', worstErr <= tol,
    `worst error ${worstErr.toExponential(2)} mm, tolerance ${tol} mm`);
  check('total balances', Math.abs(totalInput - (totalOut + totalKerf + totalOffcut)) < 1e-6,
    `in ${r(totalInput, 1)} = out ${r(totalOut, 1)} + kerf ${r(totalKerf, 1)} + offcut ${r(totalOffcut, 1)} mm`);
  note(`${sticks} sticks of stock per crate; overall yield ${r((1 - totalOffcut / totalInput) * 100, 2)} %`);

  // Cross-check the cut list against the bill of materials.
  let listed = 0;
  for (const [, g] of cutList()) listed += g.pieces.length;
  check('cut list piece count equals the bill of materials', listed === K.crateSpec.PART_COUNT,
    `${listed} pieces`);
}

/* ================================================================== *
 * 9. Mass, and whether the robot can actually lift these parts.
 * ================================================================== */
section('Mass and handling');
{
  const C = K.crateSpec;
  const density = K.CRATE.species.densityKgPerM3;
  const woodKg = massKg(C.woodVolumeMm3(), density);
  const nailKg = C.JOINTS.reduce((kg, j) =>
    kg + nailCount(j) * massKg(nailVolumeMm3(j.nail), K.nails.STEEL.densityKgPerM3), 0);
  note(`wood ${r(woodKg)} kg + nails ${r(nailKg)} kg = crate ${r(woodKg + nailKg)} kg`);

  // Every part must be handled by one of the declared end effectors, and the
  // assignment must be the one TOOL_ASSIGNMENT declares — not whichever fits.
  const H = K.gripperHeavySpec;
  const tools = {
    'OW-G2': { canHold, closeOnWidth, stroke: K.gripperSpec.PERFORMANCE.strokeMm },
    'OW-G3': { canHold: H.canHold, closeOnWidth: H.closeOnWidth, stroke: H.PERFORMANCE.strokeMm },
  };
  let heaviest = { kg: 0 };
  let allHandled = true; const unhandled = [];
  for (const b of C.BOM) {
    const kg = massKg(pieceVolumeMm3(b.profile, b.lengthMm), density);
    if (kg > heaviest.kg) heaviest = { kg, id: b.id, profile: b.profile };
    const toolId = H.TOOL_ASSIGNMENT.byProfile[b.profile.id];
    const t = tools[toolId];
    const res = t ? t.canHold(b.profile.thicknessMm, kg) : { ok: false, why: 'no tool assigned' };
    if (!res.ok) { allHandled = false; unhandled.push(`${b.id} (${b.profile.id}, ${r(kg)} kg, ${b.profile.thicknessMm} mm) on ${toolId}: ${res.why}`); }
  }
  check('every part in the bill of materials has an end effector that can hold it',
    allHandled, allHandled ? `${C.BOM.length} bom lines across ${Object.keys(tools).length} tools` : unhandled.join(' | '));

  check('the heavy gripper meets the requirement computed from the crate',
    H.PERFORMANCE.strokeMm >= H.REQUIREMENT.minStrokeMm && H.PERFORMANCE.payloadKg >= H.REQUIREMENT.minPayloadKg,
    `needs >=${H.REQUIREMENT.minStrokeMm} mm stroke and >=${H.REQUIREMENT.minPayloadKg} kg; ` +
    `has ${H.PERFORMANCE.strokeMm} mm and ${H.PERFORMANCE.payloadKg} kg ` +
    `(widest part ${H.REQUIREMENT.widestGraspMm} mm, heaviest ${H.REQUIREMENT.heaviestPartKg} kg)`);

  check('the light gripper is correctly refused the wide members',
    (() => { try { closeOnWidth(88.9); return false; } catch { return true; } })(),
    `OW-G2 stroke ${K.gripperSpec.PERFORMANCE.strokeMm} mm < 88.9 mm skid: refused, not stretched to`);

  const g3 = H.closeOnWidth(88.9);
  check('the heavy gripper closes on the 88.9 mm skid', g3.gapMm === 88.9,
    `jaws ${r(g3.perSideMm)} mm per side of a ${H.PERFORMANCE.strokeMm} mm stroke`);

  // Panel masses: whether an arm can carry a finished panel at all.
  const panelKg = {};
  for (const b of C.BOM) {
    const kg = massKg(pieceVolumeMm3(b.profile, b.lengthMm), density) * b.qty;
    const per = b.panel === 'SIDE' || b.panel === 'END' ? 2 : 1;
    panelKg[b.panel] = (panelKg[b.panel] ?? 0) + kg / per;
  }
  note(Object.entries(panelKg).map(([k, v]) => `${k} ${r(v)} kg`).join(', '));
  const overPayload = Object.entries(panelKg).filter(([, v]) => v > K.armSpec.REACH.payloadKg);
  check('panels heavier than the arm payload are identified, not assumed away',
    overPayload.length > 0,
    `${overPayload.map(([k, v]) => `${k} ${r(v)} kg`).join(', ')} exceed the ` +
    `${K.armSpec.REACH.payloadKg} kg payload — these move by conveyor and fixture, not carried`);
}

/* ================================================================== *
 * 10. Saw: derived rim speed lands in the stated band.
 * ================================================================== */
section('Saw');
{
  const v = rimSpeedMs();
  check('rim speed is inside the 50-80 m/s carbide band', v >= 50 && v <= 80, `${r(v, 1)} m/s at ${K.sawSpec.SPINDLE.rpm} rpm`);
  check('kerf exceeds plate thickness', K.sawSpec.BLADE.kerfMm > K.sawSpec.BLADE.plateThicknessMm,
    `kerf ${K.sawSpec.BLADE.kerfMm} mm, plate ${K.sawSpec.BLADE.plateThicknessMm} mm`);
  check('kerf equals plate plus both tip projections',
    Math.abs(K.sawSpec.BLADE.kerfMm - (K.sawSpec.BLADE.plateThicknessMm + 2 * K.sawSpec.BLADE.tipProjectionPerSideMm)) < 1e-9,
    `${K.sawSpec.BLADE.plateThicknessMm} + 2 x ${K.sawSpec.BLADE.tipProjectionPerSideMm} = ${K.sawSpec.BLADE.kerfMm} mm`);

  const deepest = 139.7; // widest board, cut across its width
  const stroke = K.sawSpec.STROKE.throughCentreYMm - K.sawSpec.STROKE.housedCentreYMm;
  const bladeTopAtFullStroke = K.sawSpec.STROKE.throughCentreYMm + K.sawSpec.BLADE.diameterMm / 2;
  const stockTop = K.sawSpec.TABLE.heightMm + 19.0;
  check('blade fully crosses the thickest stock at full stroke',
    bladeTopAtFullStroke - stockTop >= K.sawSpec.STROKE.throughClearanceMm,
    `blade top ${r(bladeTopAtFullStroke, 1)} mm vs stock top ${r(stockTop, 1)} mm ` +
    `= ${r(bladeTopAtFullStroke - stockTop, 1)} mm clear, need ${K.sawSpec.STROKE.throughClearanceMm}`);
  note(`stroke ${r(stroke, 1)} mm at ${K.sawSpec.STROKE.feedRateMmPerS} mm/s = ${r(stroke / K.sawSpec.STROKE.feedRateMmPerS, 2)} s per cut`);
  note(`cutting ${r(deepest, 1)} mm of board width takes ${r(deepest / K.sawSpec.STROKE.feedRateMmPerS, 2)} s of blade contact`);
}

/* ================================================================== *
 * 11. Robot: chain is complete and the envelope is consistent.
 * ================================================================== */
section('Robot');
{
  const A = K.armSpec;
  const links = A.CHAIN.map((c) => c.link);
  for (const need of ['base', 'shoulder', 'upper_arm', 'forearm', 'wrist_1', 'wrist_2', 'wrist_3', 'tool_flange']) {
    check(`chain contains ${need}`, links.includes(need));
  }
  check('six revolute joints', A.JOINTS.length === 6);
  check('every revolute joint declares its own axis',
    A.JOINTS.every((j) => Array.isArray(j.axis) && j.axis.filter((v) => v !== 0).length === 1),
    A.JOINTS.map((j) => `${j.joint}:${['x', 'y', 'z'][j.axis.findIndex((v) => v !== 0)]}`).join(' '));
  check('every joint declares finite limits',
    A.JOINTS.every((j) => Number.isFinite(j.limitDeg[0]) && Number.isFinite(j.limitDeg[1]) && j.limitDeg[0] < j.limitDeg[1]));
  check('elbow is limited more tightly than the others',
    A.JOINTS.find((j) => j.joint === 'elbow').limitDeg[1] === 180);
  check('reach envelope equals the sum of the link offsets',
    Math.abs(A.REACH.maxRadiusMm - (425.0 + 392.2 + 133.3 + 99.7 + 99.6)) < 1e-9, `${r(A.REACH.maxRadiusMm, 1)} mm`);
  check('jointWithinLimits rejects an out-of-range value', A.jointWithinLimits('elbow', 200) === false);
  check('reachable() refuses a point beyond the envelope',
    A.reachable([2000, 0, 0]) === false && A.reachable([700, 300, 0]) === true);
  const totalKg = A.CHAIN.reduce((k, c) => k + (c.massKg ?? 0), 0);
  note(`arm mass ${r(totalKg)} kg, reach ${r(A.REACH.maxRadiusMm, 1)} mm, payload ${A.REACH.payloadKg} kg`);
}

/* ================================================================== *
 * 12. Fits: the geometry has to agree. V1-TEST H61 and E33/E38.
 * ================================================================== */
section('Fits');
{
  const P = K.palletSpec;
  const F = K.forkliftSpec;
  const clearance = K.TOLERANCES.fitClearanceMm;

  const endFit = tineFits(P.OPENINGS.end, F.TINE.widthMm, F.TINE.thicknessMm, clearance);
  check('fork tine fits the pallet end opening', endFit.ok,
    `height clear ${r(endFit.heightClearanceMm)} mm, width clear ${r(endFit.widthClearanceMm)} mm`);

  const sideFit = tineFits(P.OPENINGS.side, F.TINE.widthMm, F.TINE.thicknessMm, clearance);
  check('fork tine fits the pallet side notch', sideFit.ok,
    `height clear ${r(sideFit.heightClearanceMm)} mm, width clear ${r(sideFit.widthClearanceMm)} mm`);

  check('tine spacing can straddle the pallet end openings',
    F.TINE.spacingMaxMm >= P.OPENINGS.end.widthMm / 2 && F.TINE.spacingMinMm <= P.OPENINGS.end.widthMm,
    `openings ${r(P.OPENINGS.end.widthMm)} mm wide, spacing ${F.TINE.spacingMinMm}-${F.TINE.spacingMaxMm} mm`);

  check('tines do not protrude past the far side of the pallet',
    F.PICK.insertionDepthMm <= P.PLAN.widthMm,
    `insert ${F.PICK.insertionDepthMm} mm into ${r(P.PLAN.widthMm, 1)} mm`);

  const C = K.crateSpec;
  const onPallet = loadFits(C.FOOTPRINT_MM.lengthMm, C.FOOTPRINT_MM.widthMm);
  check('crate sits within the pallet deck', onPallet.ok,
    `overhang ${r(onPallet.overhangLengthMm)} / ${r(onPallet.overhangWidthMm)} mm (negative is margin)`);

  const stackH = P.PALLET.heightMm + C.HEIGHT_MM;
  const bed = loadWithinBed(P.PLAN.lengthMm, P.PLAN.widthMm, stackH);
  check('a pallet of crate fits inside the truck bed bounds', bed.ok,
    `length margin ${r(bed.lengthMarginMm, 0)} mm, width margin ${r(bed.widthMarginMm, 0)} mm`);
  note(`load stands ${r(bed.aboveGateMm, 0)} mm above the ${K.truckSpec.BED.gate.heightMm} mm side gate; lashing required: ${bed.needsLashing}`);

  for (const b of K.siteSpec.BUILDINGS) {
    const t = truckClearsDoor(b.door, stackH);
    check(`truck clears ${b.id} door`, t.ok, `width ${r(t.widthClearanceMm, 0)} mm, height ${r(t.heightClearanceMm, 0)} mm`);
    const f = forkliftClearsDoor(b.door);
    check(`forklift clears ${b.id} door`, f.ok, `width ${r(f.widthClearanceMm, 0)} mm, height ${r(f.heightClearanceMm, 0)} mm`);
  }

  const turn = K.truckSpec.DRIVE.turningRadiusMm;
  check('road corner radius exceeds the truck turning radius',
    K.siteSpec.ROAD.minCornerRadiusMm > turn, `corner ${K.siteSpec.ROAD.minCornerRadiusMm} mm vs turn ${r(turn, 0)} mm`);
  check('road corridor leaves the truck room on the road',
    K.siteSpec.ROUTE.corridorHalfWidthMm > 0, `${r(K.siteSpec.ROUTE.corridorHalfWidthMm, 0)} mm each side`);
  note(`route is ${r(routeLengthMm() / 1000, 1)} m; at ${K.truckSpec.DRIVE.maxSpeedYardMmPerS} mm/s a full lap is ` +
    `${r(routeLengthMm() / K.truckSpec.DRIVE.maxSpeedYardMmPerS, 1)} s`);
}

/* ================================================================== *
 * 13. Conveyor: shortest piece is still supported.
 * ================================================================== */
section('Conveyor');
{
  const shortest = Math.min(...K.crateSpec.BOM.map((b) => b.lengthMm));
  const n = rollersUnder(shortest);
  check('the shortest cut piece rests on at least two rollers', n >= MIN_ROLLERS_FOR_SUPPORT,
    `shortest piece ${r(shortest, 1)} mm spans ${n} rollers at ${K.conveyorSpec.ROLLERS.pitchMm} mm pitch`);
  check('the widest piece fits between the frame rails',
    139.7 <= K.conveyorSpec.FRAME.innerWidthMm, `139.7 mm in ${K.conveyorSpec.FRAME.innerWidthMm} mm`);
  check('longest piece fits the longest conveyor segment',
    Math.max(...K.crateSpec.BOM.map((b) => b.lengthMm)) < Math.max(...K.conveyorSpec.SEGMENTS.map((s) => s.lengthMm)));
  check('conveyor top is level with the saw table',
    K.conveyorSpec.FRAME.topOfRollerHeightMm === K.sawSpec.TABLE.heightMm,
    `both ${K.sawSpec.TABLE.heightMm} mm`);
  check('transfer gap is under one roller pitch',
    K.conveyorSpec.TRANSFER.maxGapMm < K.conveyorSpec.ROLLERS.pitchMm);
}

/* ================================================================== *
 * 14. Process: the state machine cannot skip a state.
 * ================================================================== */
section('Process');
{
  const S = K.processSpec.STATES;
  check('RUNNING cannot jump straight to IDLE', transitionLegal(S.RUNNING, S.IDLE) === false);
  check('every stage can reach FAULT', ['AWAITING_INPUT', 'RUNNING', 'AWAITING_HANDOFF']
    .every((s) => transitionLegal(s, S.FAULT)));
  check('FAULT can only return to IDLE',
    transitionLegal(S.FAULT, S.IDLE) && !transitionLegal(S.FAULT, S.RUNNING));
  check('three stages', K.processSpec.STAGES.length === 3,
    K.processSpec.STAGES.map((s) => s.id).join(' -> '));
  check('handoffs chain the stages in order',
    K.processSpec.HANDOFFS[0].from === 'CUT_SHOP' && K.processSpec.HANDOFFS[1].from === 'PANEL_SHOP');
  check('determinism rule is declared', typeof K.processSpec.DETERMINISM.seed === 'number');
  check('planCuts is deterministic', (() => {
    const a = JSON.stringify(planCrate());
    const b = JSON.stringify(planCrate());
    return a === b;
  })(), 'two identical plans from identical inputs');
}

/* ================================================================== *
 * 15. Collision: no group pair is silently disabled.
 * ================================================================== */
section('Collision policy');
{
  const M = K.collision.MATRIX;
  check('every disabled group pair carries a reason',
    Object.values(M).every((e) => e.collides === true || (typeof e.why === 'string' && e.why.length > 20)),
    `${Object.keys(M).length} explicit entries`);
  check('all pairs collide by default', K.collision.groupsCollide('STOCK', 'MACHINE') === true);
  check('every penetrating operation declares participants, region and validation',
    Object.values(K.collision.OPERATIONS).every((o) =>
      o.regionKind && Array.isArray(o.participants) && Array.isArray(o.validateOnClose) && o.validateOnClose.length > 0));
  check('makeOperation refuses an operation with no region', (() => {
    try { K.collision.makeOperation({ type: 'CUT', toolId: 'BLADE', participantIds: ['x'], openedAtMs: 0, stage: 'CUT_SHOP' }); return false; }
    catch { return true; }
  })());
  check('makeOperation refuses an unknown type', (() => {
    try { K.collision.makeOperation({ type: 'NOPE', toolId: 't', participantIds: ['x'], region: {}, openedAtMs: 0, stage: 's' }); return false; }
    catch { return true; }
  })());
  check('penetration is refused for an object not named in the operation', (() => {
    const op = K.collision.makeOperation({ type: 'CUT', toolId: 'BLADE', participantIds: ['STOCK_1'], region: {}, openedAtMs: 0, stage: 'CUT_SHOP' });
    return K.collision.penetrationAllowed(op, 'STOCK_2', 'BLADE', true) === false;
  })());
  check('GRASP allows contact but zero penetration', K.collision.OPERATIONS.GRASP.allowedPenetrationMm === 0);
}

/* ================================================================== *
 * 16. Mobile budget is stated as numbers.
 * ================================================================== */
section('Render budget');
{
  const B = K.siteSpec.BUDGET;
  check('phone budget states a viewport, a target frame rate and a draw call cap',
    Array.isArray(B.phone.viewportCss) && B.phone.targetFps > 0 && B.phone.maxDrawCalls > 0,
    `${B.phone.viewportCss.join('x')} css px, ${B.phone.targetFps} fps, <=${B.phone.maxDrawCalls} draw calls, <=${B.phone.maxTriangles} tris`);
  check('desktop budget is stated separately', B.desktop.targetFps >= B.phone.targetFps);

  // Object budget: how many objects a full cycle has to carry.
  const C = K.crateSpec;
  const perCrate = C.PART_COUNT + C.TOTAL_NAILS;
  note(`one crate is ${C.PART_COUNT} parts + ${C.TOTAL_NAILS} nails = ${perCrate} objects`);
  note(`two crates in flight plus a pallet of ${K.palletSpec.PART_COUNT} parts = ${perCrate * 2 + K.palletSpec.PART_COUNT} objects`);
  check('nails can be instanced into one draw call per nail type',
    new Set(C.JOINTS.map((j) => j.nail.id)).size <= 4,
    `${new Set(C.JOINTS.map((j) => j.nail.id)).size} distinct nail types: ${[...new Set(C.JOINTS.map((j) => j.nail.size + ' ' + j.nail.type))].join(', ')}`);
}

/* ================================================================== *
 * Report
 * ================================================================== */
for (const s of sections) {
  console.log(`\n${s.name}`);
  for (const l of s.lines) console.log(l);
}
console.log(`\n${'='.repeat(64)}`);
console.log(`${pass} passed, ${fail} failed`);
if (fail > 0) {
  console.log('\nFailures:');
  for (const f of failures) console.log(`  - ${f}`);
}
console.log('='.repeat(64));
process.exit(fail > 0 ? 1 : 0);
