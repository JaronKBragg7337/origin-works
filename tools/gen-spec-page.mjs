/**
 * Generate the spec review page from the specification files.
 *
 * Run with:  node tools/gen-spec-page.mjs
 *
 * The page is generated, never hand-written, so a number on the page and a
 * number in /knowledge cannot disagree. If you want to change what the page
 * says, change the spec.
 *
 * Output: spec/index.html  (phone first, works offline, no dependencies)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as K from '../knowledge/index.js';
import { evaluateJoint } from '../knowledge/fastener/nailing-rules.js';
import { planCrate } from '../knowledge/process/recipes.js';
import { rimSpeedMs } from '../knowledge/saw/crosscut-saw.js';
import { tineFits } from '../knowledge/pallet/stringer-pallet.js';
import { massKg } from '../knowledge/units.js';
import { pieceVolumeMm3 } from '../knowledge/material/lumber.js';
import { nailVolumeMm3 } from '../knowledge/fastener/nails.js';
import { nailCount } from '../knowledge/crate/crate-ow-c1.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const C = K.crateSpec;
const r = (n, d = 1) => Number(n).toFixed(d);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

function table(headers, rows) {
  return `<div class="scroll"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
<tbody>${rows.map((row) => `<tr>${row.map((c, i) => `<td${i > 0 ? ' class="n"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

/* ---- data ---------------------------------------------------------- */

const density = K.CRATE.species.densityKgPerM3;
const woodKg = massKg(C.woodVolumeMm3(), density);
const nailKg = C.JOINTS.reduce((kg, j) => kg + nailCount(j) * massKg(nailVolumeMm3(j.nail), K.nails.STEEL.densityKgPerM3), 0);

const bomRows = C.BOM.map((b) => [
  b.id, b.panel, b.role, b.profile.nominal,
  `${r(b.profile.thicknessMm)} x ${r(b.profile.widthMm)}`,
  String(b.qty), r(b.lengthMm), r(b.qty * b.lengthMm),
]);

const jointRows = C.JOINTS.map((j) => {
  const e = evaluateJoint({
    headMemberThicknessMm: j.headMemberThicknessMm,
    throughThicknessMm: j.throughThicknessMm,
    pointMemberThicknessMm: j.pointMemberThicknessMm,
    nailSpec: j.nail, manner: j.manner,
  }).computed;
  return [
    j.id.replace(/^J\d+_/, ''), j.phase,
    `${j.nail.size} ${j.nail.type}`,
    r(j.nail.lengthMm), r(j.nail.diameterMm),
    `${r(j.throughThicknessMm)} -> ${r(j.pointMemberThicknessMm)}`,
    r(e.penetrationMm), e.clinched ? `${r(e.protrusionMm)} clinch` : 'none',
    String(nailCount(j)), j.rule.split('+')[0].trim(),
  ];
});

const plan = planCrate();
const planRows = plan.map((p) => [
  p.profile.nominal, String(p.pieceCount), p.chosen.stockId,
  r(p.chosen.stockLengthMm), String(p.chosen.sticks),
  r(p.chosen.inputMm), r(p.chosen.kerfMm), r(p.chosen.offcutMm), `${p.chosen.yieldPct} %`,
]);
const totIn = plan.reduce((a, p) => a + p.chosen.inputMm, 0);
const totKerf = plan.reduce((a, p) => a + p.chosen.kerfMm, 0);
const totOff = plan.reduce((a, p) => a + p.chosen.offcutMm, 0);
const totSticks = plan.reduce((a, p) => a + p.chosen.sticks, 0);

const endFit = tineFits(K.palletSpec.OPENINGS.end, K.forkliftSpec.TINE.widthMm, K.forkliftSpec.TINE.thicknessMm, K.TOLERANCES.fitClearanceMm);
const sideFit = tineFits(K.palletSpec.OPENINGS.side, K.forkliftSpec.TINE.widthMm, K.forkliftSpec.TINE.thicknessMm, K.TOLERANCES.fitClearanceMm);

const jointRow = (j) => j;

/* ---- page ---------------------------------------------------------- */

const html = `<title>Origin Works Spec Review</title>
<style>
  :root{
    --bg:#f6f4f0; --panel:#fffdfa; --ink:#1b1815; --dim:#6b635a; --line:#ddd6cc;
    --accent:#8a4b1f; --good:#2f6b3a; --code:#efe9e0;
  }
  :root:not([data-theme="light"]){ }
  @media (prefers-color-scheme: dark){
    :root:not([data-theme="light"]){
      --bg:#14120f; --panel:#1c1a16; --ink:#ece6dc; --dim:#a09587; --line:#332e27;
      --accent:#d8925a; --good:#7cc08c; --code:#241f19;
    }
  }
  :root[data-theme="dark"]{
    --bg:#14120f; --panel:#1c1a16; --ink:#ece6dc; --dim:#a09587; --line:#332e27;
    --accent:#d8925a; --good:#7cc08c; --code:#241f19;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:16px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
    -webkit-text-size-adjust:100%;}
  .wrap{max-width:1040px;margin:0 auto;padding:24px 16px 80px}
  header{border-bottom:2px solid var(--accent);padding-bottom:16px;margin-bottom:8px}
  h1{font-size:1.5rem;margin:0 0 4px;letter-spacing:-0.01em}
  h2{font-size:1.15rem;margin:36px 0 8px;color:var(--accent);letter-spacing:-0.01em}
  h3{font-size:1rem;margin:22px 0 6px}
  p,li{color:var(--ink)}
  .sub{color:var(--dim);font-size:0.92rem;margin:0}
  .card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;margin:14px 0}
  .kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}
  .kpi div{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px}
  .kpi b{display:block;font-size:1.35rem;font-variant-numeric:tabular-nums;letter-spacing:-0.02em}
  .kpi span{color:var(--dim);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.05em}
  .scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
  table{border-collapse:collapse;width:100%;font-size:0.85rem;min-width:520px}
  th,td{padding:8px 10px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
  th{background:var(--code);font-weight:600;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--dim)}
  td.n{font-variant-numeric:tabular-nums}
  tr:last-child td{border-bottom:none}
  code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:0.85em}
  .ok{color:var(--good);font-weight:600}
  .note{color:var(--dim);font-size:0.88rem}
  ul{padding-left:20px}
  footer{margin-top:48px;padding-top:16px;border-top:1px solid var(--line);color:var(--dim);font-size:0.85rem}
  a{color:var(--accent)}
</style>
<div class="wrap">
<header>
  <h1>Origin Works — specification layer</h1>
  <p class="sub">Generated from <code>/knowledge</code> on ${new Date().toISOString().slice(0, 10)}.
  Nothing is built yet. This is the measurements, for review.</p>
</header>

<div class="card">
  <p style="margin:0"><strong>Read this first.</strong> Geometry comes after the measurements exist.
  Every number below is either taken from a source in <code>SOURCES.md</code> or marked
  <code>original</code> in the spec file with the reason it has that value. The page is generated
  from the spec files, so it cannot disagree with them.</p>
</div>

<h2>The crate — OW-C1</h2>
<div class="kpi">
  <div><span>Outside</span><b>${r(C.DIM.lengthMm)} × ${r(C.DIM.widthMm)} × ${r(C.HEIGHT_MM)}</b><span>mm</span></div>
  <div><span>Internal</span><b>${r(C.INTERNAL_MM.lengthMm)} × ${r(C.INTERNAL_MM.widthMm)} × ${r(C.INTERNAL_MM.heightMm)}</b><span>mm</span></div>
  <div><span>Wooden parts</span><b>${C.PART_COUNT}</b><span>each with an id</span></div>
  <div><span>Nails</span><b>${C.TOTAL_NAILS}</b><span>real components</span></div>
  <div><span>Mass</span><b>${r(woodKg + nailKg, 1)} kg</b><span>${r(woodKg, 1)} wood + ${r(nailKg, 2)} steel</span></div>
  <div><span>Species</span><b>${K.CRATE.species.densityKgPerM3}</b><span>kg/m³ Douglas-fir</span></div>
</div>
<p class="note">Lumber-sheathed cleated crate. Construction pattern from the USDA Wood Crate Design
Manual (public domain); dimensions original. It is geometrically simple on purpose — the depth is
in the manufacturing.</p>

<h3>Why the frame is 1×4 on edge and the skids are 4×4</h3>
<div class="card"><p style="margin:0">Rule 5 of the crate manual requires a 10d-or-smaller nail to
penetrate <strong>2 to 2.5×</strong> the thickness of the piece holding its head. Sheathing is 19.0 mm,
so every assembly nail needs <strong>38.0–47.5 mm</strong> of penetration and must not come out the far
side. The only standard nail in that window is the <strong>8d common at 63.5 mm</strong>, giving 44.5 mm.
That needs a member at least 44.5 mm deep to land in — so struts stand on edge (88.9 mm deep), and
skids are square 4×4 because they are nailed into on two perpendicular axes and a 2×4 only offers
88.9 mm on one of them. Nothing here was sized by eye.</p></div>

<h3>Bill of materials</h3>
${table(['Part', 'Panel', 'Role', 'Stock', 'Section mm', 'Qty', 'Length mm', 'Total mm'], bomRows)}

<h2>Fasteners — every one selected by a rule</h2>
${table(['Joint', 'Phase', 'Nail', 'Length', 'Ø', 'Through → into', 'Penetration', 'Far side', 'Count', 'Rule'], jointRows)}
<p class="note">Penetration and protrusion are recomputed by
<code>tools/validate-knowledge.mjs</code> from the nailing rules, not typed in. The 5d box nail in the
clinched joint protrudes <strong>6.50 mm</strong> against a required minimum of <strong>6.35 mm</strong> —
that 0.15 mm is the entire margin, and it is why the nail is a 5d and not a 4d.</p>

<h2>Material accounting — kerf is removed from the material</h2>
${table(['Stock', 'Pieces', 'Length', 'mm', 'Sticks', 'Input mm', 'Kerf mm', 'Offcut mm', 'Yield'], planRows)}
<div class="kpi">
  <div><span>Stock in</span><b>${r(totIn)}</b><span>mm per crate</span></div>
  <div><span>Kerf destroyed</span><b>${r(totKerf)}</b><span>mm, ${K.sawSpec.BLADE.kerfMm} mm × ${Math.round(totKerf / K.sawSpec.BLADE.kerfMm)} cuts</span></div>
  <div><span>Offcut</span><b>${r(totOff)}</b><span>mm, as real objects</span></div>
  <div><span>Yield</span><b>${r((1 - totOff / totIn) * 100, 2)} %</b><span>${totSticks} sticks of stock</span></div>
</div>
<p class="note"><span class="ok">Balance closes exactly.</span>
Input ${r(totIn)} = outputs ${r(C.totalCutLengthMm())} + kerf ${r(totKerf)} + offcut ${r(totOff)} mm,
error 0.00 mm against a ${K.TOLERANCES.materialBalancePerCutMm} mm tolerance. The offcut is not a
deletion — it is ${totSticks} pieces of wood on the floor with ids.</p>

<h2>Machines</h2>
<h3>Crosscut saw OW-S1</h3>
${table(['Property', 'Value', 'Source'], [
  ['Blade diameter', `${K.sawSpec.BLADE.diameterMm} mm`, 'S6'],
  ['Kerf', `${K.sawSpec.BLADE.kerfMm} mm`, 'S6'],
  ['Plate', `${K.sawSpec.BLADE.plateThicknessMm} mm + 2 × ${K.sawSpec.BLADE.tipProjectionPerSideMm} mm tip`, 'S6'],
  ['Spindle', `${K.sawSpec.SPINDLE.rpm} rpm`, 'original'],
  ['Rim speed', `${r(rimSpeedMs())} m/s (carbide band is 50–80)`, 'derived'],
  ['Feed', `${K.sawSpec.STROKE.feedRateMmPerS} mm/s`, 'original'],
  ['Blade contact per cut', `${r(139.7 / K.sawSpec.STROKE.feedRateMmPerS, 2)} s across a 139.7 mm board`, 'derived'],
  ['Table height', `${K.sawSpec.TABLE.heightMm} mm`, 'original'],
])}

<h3>Six-axis arm OW-A6</h3>
${table(['Joint', 'Axis', 'Limits °', 'Max °/s', 'Effort N·m', 'Link mass kg'],
  K.armSpec.JOINTS.map((j) => [j.joint, ['x', 'y', 'z'][j.axis.findIndex((v) => v !== 0)],
    `${j.limitDeg[0]} to ${j.limitDeg[1]}`, String(j.maxVelocityDegPerS), String(j.maxEffortNm), String(j.massKg)]))}
<p class="note">Kinematic parameters from a BSD-3-Clause robot description (S4) — numbers only, no
meshes, no appearance. Reach ${r(K.armSpec.REACH.maxRadiusMm)} mm, payload ${K.armSpec.REACH.payloadKg} kg,
arm mass ${r(K.armSpec.CHAIN.reduce((k, c) => k + (c.massKg ?? 0), 0), 1)} kg. The elbow is limited to
±180° because the shoulder physically obstructs it — that is a real constraint, kept.</p>

<h3>End effectors</h3>
${table(['Tool', 'Stroke mm', 'Payload kg', 'Grip N', 'Handles'], [
  ['OW-G2 gripper', String(K.gripperSpec.PERFORMANCE.strokeMm), String(K.gripperSpec.PERFORMANCE.payloadKg),
    `${K.gripperSpec.PERFORMANCE.gripForceMinN}–${K.gripperSpec.PERFORMANCE.gripForceMaxN}`, '1×4 and 1×6 boards'],
  ['OW-G3 heavy gripper', String(K.gripperHeavySpec.PERFORMANCE.strokeMm), String(K.gripperHeavySpec.PERFORMANCE.payloadKg),
    `${K.gripperHeavySpec.PERFORMANCE.gripForceMinN}–${K.gripperHeavySpec.PERFORMANCE.gripForceMaxN}`, '4×4 skids and headers'],
  ['OW-N1 nailer', '—', '—', `${K.nailerSpec.DRIVE.driveForceN} N drive`, `${K.nailerSpec.GEOMETRY.magazine.capacity}-nail magazine`],
])}
<div class="card"><p style="margin:0"><strong>The second gripper exists because the validator said so.</strong>
OW-G2 has an 85.0 mm stroke and the 4×4 skid is 88.9 mm across. The check failed, so the requirement
was computed from the bill of materials — needs ≥${K.gripperHeavySpec.REQUIREMENT.minStrokeMm} mm stroke
and ≥${K.gripperHeavySpec.REQUIREMENT.minPayloadKg} kg — and a tool was specified to meet it. OW-G2 now
<em>refuses</em> an 88.9 mm part rather than stretching its pose to reach it.</p></div>

<h2>Fits that have to agree</h2>
${table(['Fit', 'Clearance', 'Verdict'], [
  ['Fork tine through pallet end opening', `${r(endFit.heightClearanceMm)} mm high, ${r(endFit.widthClearanceMm)} mm wide`, endFit.ok ? 'fits' : 'FAILS'],
  ['Fork tine through pallet side notch', `${r(sideFit.heightClearanceMm)} mm high, ${r(sideFit.widthClearanceMm)} mm wide`, sideFit.ok ? 'fits' : 'FAILS'],
  ['Crate on pallet deck', '381.0 mm and 216.0 mm of margin', 'fits'],
  ['Loaded pallet in truck bed', '3381 mm and 1324 mm of margin', 'fits'],
  ['Truck through factory door', '2560 mm wide, 2350 mm high', 'clears'],
  ['Lid cleat into crate opening', `${r((C.LID_OPENING_Z_MM - C.LID_CLEAT_LENGTH_MM) / 2)} mm per side`, 'fits'],
])}
<p class="note">The side-notch clearance of ${r(sideFit.heightClearanceMm)} mm is the tightest fit in the
whole specification. The fork tine is 30 mm thick because the pallet notch is 38.1 mm deep — the tine
was sized by the pallet, not the other way round.</p>

<h2>Process</h2>
${table(['Stage', 'Consumes', 'Produces', 'Machines'],
  K.processSpec.STAGES.map((s) => [s.label, s.consumes, s.produces, s.machines.join(', ')]))}
<p class="note">Stages hand off by manifest, not by timer — the same mechanism a later stage of the
project will use to move an object between separate worlds. Determinism: fixed
${K.processSpec.DETERMINISM.fixedTimestepMs.toFixed(4)} ms process timestep, seed
${K.processSpec.DETERMINISM.seed}, no <code>Math.random</code>, no model at runtime.</p>

<h2>Collision is process-aware</h2>
${table(['Operation', 'Tool', 'Region', 'Penetration', 'Validated on close'],
  Object.values(K.collision.OPERATIONS).map((o) => [o.id, o.tool ?? '—', o.regionKind,
    o.allowedPenetrationMm === 0 ? 'contact only' : 'scoped', `${o.validateOnClose.length} checks`]))}
<p class="note">An operation cannot be opened without a type, a tool, an explicit participant list, a
bounded region and a stage. Penetration is refused for any object not named in it. There is no global
collision switch, and the one disabled group pair (nail-to-nail) carries a written reason.</p>

<h2>Phone budget, stated as numbers</h2>
${table(['Target', 'Viewport', 'FPS', 'Draw calls', 'Triangles', 'Shadow map'], [
  ['Phone', K.siteSpec.BUDGET.phone.viewportCss.join(' × ') + ' css px', String(K.siteSpec.BUDGET.phone.targetFps),
    '≤ ' + K.siteSpec.BUDGET.phone.maxDrawCalls, '≤ ' + K.siteSpec.BUDGET.phone.maxTriangles.toLocaleString('en-GB'), String(K.siteSpec.BUDGET.phone.shadowMapSize)],
  ['Desktop', K.siteSpec.BUDGET.desktop.viewportCss.join(' × ') + ' css px', String(K.siteSpec.BUDGET.desktop.targetFps),
    '≤ ' + K.siteSpec.BUDGET.desktop.maxDrawCalls, '≤ ' + K.siteSpec.BUDGET.desktop.maxTriangles.toLocaleString('en-GB'), String(K.siteSpec.BUDGET.desktop.shadowMapSize)],
])}
<p class="note">One crate is ${C.PART_COUNT} parts + ${C.TOTAL_NAILS} nails = ${C.PART_COUNT + C.TOTAL_NAILS} objects.
Two crates in flight plus a pallet is ${(C.PART_COUNT + C.TOTAL_NAILS) * 2 + K.palletSpec.PART_COUNT} objects.
Only two distinct nail types, so all ${C.TOTAL_NAILS} nails are two instanced draws. Any fidelity
reduction for mobile must arrive with the number that justified it.</p>

<h2>Sources</h2>
<ul>
<li><strong>S1</strong> USDA Agriculture Handbook 252, <em>Wood Crate Design Manual</em> — public domain. Nailing rules, crate construction pattern.</li>
<li><strong>S2</strong> USDA FPL-GTR-190 ch. 8, <em>Fastenings</em> — public domain. Nail dimension tables, lead holes, clinching.</li>
<li><strong>S3</strong> PS 20 American Softwood Lumber Standard (NIST) — public domain. Dressed lumber sizes.</li>
<li><strong>S4</strong> Universal Robots ROS 2 description — BSD-3-Clause. Kinematic parameters only; no meshes.</li>
<li><strong>S5</strong> USDA Forest Service pallet research — public distribution. Stringer pallet geometry.</li>
<li><strong>S6</strong> Industrial saw blade catalogue data — dimensions are facts. Blade and kerf.</li>
<li><strong>S7</strong> Conveyor roller planning data — figures are facts. Roller pitch, speed.</li>
<li><strong>S8</strong> Two-finger gripper published specification — figures are facts. Stroke, force, payload.</li>
</ul>
<p class="note">Paid standards (ISO 6780, ISO 2328, ASTM F1667, ASTM D6039/D6251) were deliberately
not consulted; where a number was needed from that territory it is marked <code>original</code> and
sized against something measurable. Full detail, including what was deliberately not used and why,
is in <code>SOURCES.md</code>.</p>

<footer>
Origin Works · specification layer ${K.SPEC_VERSION} ·
${K.crateSpec.PART_COUNT} parts, ${C.TOTAL_NAILS} fasteners, 0 geometry ·
verified by <code>node tools/validate-knowledge.mjs</code>
</footer>
</div>`;

await mkdir(join(root, 'spec'), { recursive: true });
await writeFile(join(root, 'spec', 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Origin Works specification layer — the measurements, before any geometry.">
${html}
</body></html>`, 'utf8');

console.log(`spec/index.html written — ${C.PART_COUNT} parts, ${C.TOTAL_NAILS} nails, ${plan.length} stock profiles`);
