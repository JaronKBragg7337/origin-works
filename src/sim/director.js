/**
 * The production cycle.
 *
 * Three stages, written as generators, advanced by a fixed timestep. Every
 * visible step corresponds to a change in the assembly graph: the saw does not
 * play a cutting animation and then swap in two boards — it opens a CUT
 * operation, the graph splits the parent into piece, kerf and remainder, and
 * the meshes that appear are the meshes of those new nodes.
 *
 * Where a motion takes time, the duration comes from the machine spec: the
 * blade stroke divided by the feed rate, the nailer's cycle time, the
 * conveyor's speed. Nothing waits for a round number.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, toMm, massKg } from '../../knowledge/units.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import { OPERATIONS } from '../../knowledge/collision.js';
import { PROFILES, DEFAULT_SPECIES, pieceVolumeMm3 } from '../../knowledge/material/lumber.js';
import { BLADE, SPINDLE, TABLE, STROKE, FIXTURING, kerfRegion } from '../../knowledge/saw/crosscut-saw.js';
import { DRIVE as NAILER_DRIVE } from '../../knowledge/robot/nailer.js';
import CRATE, * as C from '../../knowledge/crate/crate-ow-c1.js';

/** Sheathing thickness, the offset a wall panel sits in by. */
const SHEATHING_T = PROFILES.BOARD_1X6.thicknessMm;
import { planCrate } from '../../knowledge/process/recipes.js';
import { STATES } from '../../knowledge/process/recipes.js';
import * as graph from '../core/graph.js';
import * as ops from '../core/ops.js';
import { KIND } from '../core/ids.js';
import { createStock, cutBoard, placeBoard } from '../world/lumber.js';
import { wait, waitUntil, tween, all, createRunner, easeInOut } from './schedule.js';

/* ---------------------------------------------------------------- *
 * Helpers
 * ---------------------------------------------------------------- */

/** Move an arm to a world target, refusing rather than stretching. */
function* moveArm(arm, targetMm, opts = {}) {
  const reach = arm.reachable(targetMm);
  if (!reach.ok) {
    throw new Error(
      `Target ${targetMm.map((v) => v.toFixed(0)).join(',')} mm is ${reach.distanceMm} mm ` +
      `from the shoulder; the envelope is ${reach.envelopeMm[0]}-${reach.envelopeMm[1]} mm. Refused.`
    );
  }
  const before = arm.snapshot();
  const sol = arm.solveIK(targetMm, opts);
  const goal = arm.snapshot();
  arm.restore(before);
  if (!sol.ok) {
    throw new Error(`IK did not converge: residual ${sol.errorMm} mm > ${TOLERANCES.placementMm} mm. Refused.`);
  }
  yield waitUntil(() => !arm.stepToward(goal, 1 / 60), 'arm move');
  const v = arm.limitViolations();
  if (v.length) throw new Error(`Joint limit exceeded: ${v.map((j) => j.joint).join(', ')}`);
}

/** World position of an Object3D, in millimetres. */
function worldMm(obj) {
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  return [toMm(p.x), toMm(p.y), toMm(p.z)];
}

/* ---------------------------------------------------------------- *
 * The cycle
 * ---------------------------------------------------------------- */

export function createDirector(ctx) {
  const state = {
    stage: 'IDLE',
    stageState: STATES.IDLE,
    cycle: 0,
    cutsMade: 0,
    piecesCut: 0,
    nailsDriven: 0,
    panelsBuilt: 0,
    cratesBuilt: 0,
    message: 'idle',
    faults: [],
    sawdustMm3: 0,
    rejects: 0,
    offcutsBinned: 0,
    lastBalance: null,
    manifest: null,
  };

  const plan = planCrate();

  /** The cut list as a flat, deterministic queue. */
  function buildQueue() {
    const q = [];
    for (const p of plan) {
      for (const stick of p.chosen.plan) {
        q.push({ profile: p.profile, stockLengthMm: p.chosen.stockLengthMm, pieces: [...stick.pieces] });
      }
    }
    // Deterministic order: by profile id then descending first piece length.
    q.sort((a, b) => a.profile.id.localeCompare(b.profile.id) || b.pieces[0] - a.pieces[0]);
    return q;
  }

  /** Which BOM line a cut length belongs to, so a piece knows its role. */
  const bomByLength = new Map();
  for (const b of C.BOM) {
    const key = b.lengthMm.toFixed(2) + ':' + b.profile.id;
    if (!bomByLength.has(key)) bomByLength.set(key, { ...b, remaining: b.qty });
    else bomByLength.get(key).remaining += b.qty;
  }
  function claimBom(lengthMm, profileId) {
    const entry = bomByLength.get(lengthMm.toFixed(2) + ':' + profileId);
    if (entry && entry.remaining > 0) { entry.remaining--; return entry; }
    return null;
  }

  /* ---- stage 1: the cut shop --------------------------------- */

  function* cutShop() {
    const { saw, cutArm, conveyorOut, sawdust, cutShopOrigin } = ctx;
    state.stage = 'CUT_SHOP';
    state.stageState = STATES.AWAITING_INPUT;
    state.message = 'stock delivery';

    const queue = buildQueue();
    const cutPieces = [];

    for (const stick of queue) {
      // --- material enters the world, once, with a source ---------
      const stock = createStock({
        profile: stick.profile, lengthMm: stick.stockLengthMm,
        stockId: `${stick.profile.id}@${stick.stockLengthMm}`,
      });
      ctx.scene.add(stock.view.object3D);
      // Rests on the saw table, against the fence.
      const yTop = TABLE.heightMm + stick.profile.thicknessMm / 2;
      placeBoard(stock, [
        cutShopOrigin[0] - stick.stockLengthMm / 2 + 0,
        yTop,
        cutShopOrigin[2] + TABLE.widthMm / 2 - 20 - stick.profile.widthMm / 2,
      ]);
      state.stageState = STATES.RUNNING;

      let current = stock;
      for (const pieceLengthMm of stick.pieces) {
        state.message = `cut ${pieceLengthMm.toFixed(1)} mm from ${current.id}`;

        // --- position the stock so the cut plane is at the blade ---
        const curLen = current.dimsMm.lengthMm;
        const targetX = cutShopOrigin[0] + (pieceLengthMm - curLen / 2);
        yield tween(
          toMm(current.view.object3D.position.x), targetX, 0.55,
          (v) => { current.view.object3D.position.x = mm(v); }
        );
        graph.record(current.id, 'POSITIONED', {
          cutPlaneXMm: cutShopOrigin[0], measuredFromFence: pieceLengthMm,
        }, 'CUT_SHOP');

        // --- clamp, then spin up. The blade may not rise until both ---
        yield tween(saw.state.clampY, TABLE.heightMm + current.dimsMm.thicknessMm, 0.35,
          (v) => { saw.state.clampY = v; });
        graph.record(current.id, 'CLAMPED', { clamp: 'CLAMP_1', forceN: FIXTURING.clamp.closeForceN }, 'CUT_SHOP');
        graph.setState(current.id, 'CLAMPED', 'CUT_SHOP');

        yield tween(0, SPINDLE.rpm, SPINDLE.spinUpMs / 1000, (v) => saw.setSpindle(v));
        yield tween(saw.state.hoodOpen, 1, 0.3, (v) => { saw.state.hoodOpen = v; });
        yield waitUntil(() => saw.canCut(), 'spindle at cutting speed');

        // --- the cut: a scoped operation, not a global switch -------
        const region = kerfRegion(cutShopOrigin[0], current.dimsMm.widthMm, current.dimsMm.thicknessMm);
        const handle = ops.openOp({
          type: OPERATIONS.CUT.id, toolId: 'BLADE',
          participantIds: [current.id], region,
          stage: 'CUT_SHOP', nowMs: ctx.clock.ms,
        });

        const strokeMm = STROKE.throughCentreYMm - STROKE.housedCentreYMm;
        const strokeSeconds = strokeMm / STROKE.feedRateMmPerS;
        yield tween(STROKE.housedCentreYMm, STROKE.throughCentreYMm, strokeSeconds,
          (v) => { saw.state.strokeY = v; });

        // The blade has crossed the stock. Prove it before splitting.
        const stockTopMm = TABLE.heightMm + current.dimsMm.thicknessMm;
        const crossedBy = saw.bladeTopMm() - stockTopMm;
        if (crossedBy < STROKE.throughClearanceMm) {
          throw new Error(`Blade did not cross the stock: only ${crossedBy.toFixed(1)} mm past the top face`);
        }

        // --- the graph splits. This is the actual manufacturing -----
        const bom = claimBom(pieceLengthMm, stick.profile.id);
        const { piece, kerf, remainder, balance } = cutBoard({
          parentId: current.id, atMm: pieceLengthMm, stage: 'CUT_SHOP',
          role: bom?.role ?? null, bomId: bom?.id ?? null, panel: bom?.panel ?? null,
        });
        state.cutsMade++;
        state.piecesCut++;
        state.lastBalance = balance;
        state.sawdustMm3 += kerf.dimsMm.volumeMm3;
        sawdust.add(kerf.dimsMm.volumeMm3);

        const findings = ops.closeOp(handle, () => {
          const p = [];
          if (Math.abs(balance.errorMm) > TOLERANCES.materialBalancePerCutMm) {
            p.push(`balance error ${balance.errorMm} mm`);
          }
          if (!piece.id || !remainder.id) p.push('a cut output has no id');
          if (Math.abs(piece.dimsMm.lengthMm - pieceLengthMm) > TOLERANCES.cutLengthMm) {
            p.push(`piece is ${piece.dimsMm.lengthMm} mm, recipe asked ${pieceLengthMm} mm`);
          }
          return p;
        });
        if (findings.length) state.faults.push({ at: 'CUT', findings });

        // Place the two new pieces where the cut left them.
        ctx.scene.add(piece.view.object3D);
        const oldX = toMm(current.view.object3D.position.x);
        const oldY = toMm(current.view.object3D.position.y);
        const oldZ = toMm(current.view.object3D.position.z);
        placeBoard(piece, [oldX - curLen / 2 + pieceLengthMm / 2, oldY, oldZ]);
        if (remainder.view?.object3D) {
          ctx.scene.add(remainder.view.object3D);
          placeBoard(remainder, [
            oldX - curLen / 2 + pieceLengthMm + BLADE.kerfMm + remainder.dimsMm.lengthMm / 2, oldY, oldZ,
          ]);
        }

        // --- retract, unclamp -------------------------------------
        yield tween(STROKE.throughCentreYMm, STROKE.housedCentreYMm,
          strokeMm / STROKE.retractRateMmPerS, (v) => { saw.state.strokeY = v; });
        yield tween(saw.state.hoodOpen, 0, 0.25, (v) => { saw.state.hoodOpen = v; });
        yield tween(saw.state.clampY, FIXTURING.clamp.openYMm, 0.3, (v) => { saw.state.clampY = v; });
        yield tween(SPINDLE.rpm, 0, SPINDLE.spinDownMs / 1000, (v) => saw.setSpindle(v));

        // --- outfeed transfer -------------------------------------
        // A cut piece is left wherever the cut left it, which is up to 2.7 m
        // from the arm's shoulder against a 1149.8 mm envelope. The outfeed
        // table moves it to the presentation point before the arm is asked for
        // it — the arm is never asked to stretch, and the transfer is a real
        // recorded move rather than a teleport.
        const pickPointMm = [
          cutShopOrigin[0] + ctx.pickOffsetMm[0],
          TABLE.heightMm + piece.dimsMm.thicknessMm / 2,
          cutShopOrigin[2] + ctx.pickOffsetMm[2],
        ];
        {
          const o = piece.view.object3D;
          const fromX = toMm(o.position.x), fromZ = toMm(o.position.z);
          const distMm = Math.hypot(pickPointMm[0] - fromX, pickPointMm[2] - fromZ);
          const seconds = Math.max(0.25, distMm / 900);
          yield all(
            tween(fromX, pickPointMm[0], seconds, (v) => { o.position.x = mm(v); }),
            tween(fromZ, pickPointMm[2], seconds, (v) => { o.position.z = mm(v); })
          );
          graph.record(piece.id, 'TRANSFERRED', {
            by: 'OUTFEED_TABLE', fromMm: [fromX, fromZ], toMm: [pickPointMm[0], pickPointMm[2]],
            distanceMm: +distMm.toFixed(1),
          }, 'CUT_SHOP');
        }

        // --- the robot takes the piece to the conveyor -------------
        const pickMm = worldMm(piece.view.object3D);
        const gripper = ctx.gripperFor(piece.meta.profile);
        const hold = gripper.canHold(piece.meta.profile.thicknessMm, piece.dimsMm.massKg);
        if (!hold.ok) throw new Error(`${gripper.spec.id} refuses ${piece.id}: ${hold.why}`);

        try {
          yield* moveArm(cutArm, [pickMm[0], pickMm[1] + 240, pickMm[2]], {
            approachDir: [0, -1, 0], approachDistanceMm: 200,
          });
          // The gripper closes on the part's measured thickness, not a pose.
          gripper.closeOnWidth(piece.meta.profile.thicknessMm);
          graph.record(piece.id, 'GRASPED', {
            by: gripper.spec.id,
            jawGapMm: gripper.gapMm(),
            partWidthMm: piece.meta.profile.thicknessMm,
            gripForceN: +hold.gripForceN.toFixed(1),
          }, 'CUT_SHOP');
          graph.setState(piece.id, 'HELD', 'CUT_SHOP');
          piece.meta.heldBy = cutArm.spec.id;
          cutArm.toolMount.attach(piece.view.object3D);

          // Pieces are spaced along the conveyor by their own width plus a
          // gap, so two boards never occupy the same volume. The conveyor then
          // carries them away, which is what stops the buffer overflowing.
          const slot = cutPieces.length % 5;
          const drop = [
            conveyorOut.positionMm[0],
            conveyorOut.topYMm + piece.dimsMm.thicknessMm / 2 + 240,
            conveyorOut.positionMm[2] + (slot - 2) * (piece.dimsMm.widthMm + 40),
          ];
          yield* moveArm(cutArm, drop, { approachDir: [0, -1, 0], approachDistanceMm: 200 });
          ctx.scene.attach(piece.view.object3D);
          placeBoard(piece, [drop[0], conveyorOut.topYMm + piece.dimsMm.thicknessMm / 2, drop[2]], Math.PI / 2);
          gripper.open();
          piece.meta.heldBy = null;
          graph.setState(piece.id, 'ON_CONVEYOR', 'CUT_SHOP');
          graph.record(piece.id, 'PLACED', {
            on: 'CONV_SAW_OUT', rollersUnder: conveyorOut.rollersUnder(piece.dimsMm.lengthMm),
          }, 'CUT_SHOP');
        } catch (e) {
          // A refusal is a legitimate outcome, not a crash. Record and continue.
          state.faults.push({ at: 'HANDLING', piece: piece.id, message: e.message });
          graph.record(piece.id, 'HANDLING_REFUSED', { reason: e.message }, 'CUT_SHOP');
          ctx.scene.attach(piece.view.object3D);
          // Set down on the reject rack, stacked, rather than dropped back on
          // the table where the next piece is about to be cut.
          const rejects = state.rejects++;
          placeBoard(piece, [
            cutShopOrigin[0] - 1800,
            piece.dimsMm.thicknessMm / 2 + rejects * piece.dimsMm.thicknessMm,
            cutShopOrigin[2] + 1600,
          ]);
        }

        cutPieces.push(piece);
        current = remainder;
        if (!current.view?.object3D) break;
      }

      // Whatever is left of the stick is an offcut. It is a real object and it
      // goes in the bin — it is never deleted.
      if (current && current.kind !== KIND.PIECE && current.view?.object3D) {
        graph.setState(current.id, 'OFFCUT', 'CUT_SHOP');
        const bin = saw.binPositionMm;
        // Offcuts rest on the floor of the bin and stack. Dropping them at a
        // fixed height left them hanging in mid-air, and the validation report
        // called it: eighteen floating objects.
        const n = state.offcutsBinned++;
        placeBoard(current, [
          cutShopOrigin[0] + bin[0],
          current.dimsMm.thicknessMm / 2 + n * current.dimsMm.thicknessMm,
          cutShopOrigin[2] + bin[2],
        ], (n % 5) * 0.06, 0);
        graph.record(current.id, 'BINNED', {
          bin: 'OFFCUT_BIN', lengthMm: current.dimsMm.lengthMm, stackIndex: n,
        }, 'CUT_SHOP');
      }
    }

    state.stageState = STATES.AWAITING_HANDOFF;
    state.manifest = { from: 'CUT_SHOP', to: 'PANEL_SHOP', ids: cutPieces.map((p) => p.id) };
    state.message = `${cutPieces.length} pieces cut, awaiting handoff`;
    return cutPieces;
  }

  /* ---- stage 2: panels ---------------------------------------- */

  function* buildPanel(panelName, pieces, originMm) {
    const { nails, panelArm } = ctx;
    const wanted = C.BOM.filter((b) => b.panel === panelName);

    const node = graph.createNode({
      kind: KIND.PANEL, type: `panel ${panelName}`, specId: `PANEL_${panelName}`,
      state: 'IN_ASSEMBLY', stage: 'PANEL_SHOP', originKind: 'ASSEMBLY',
    });
    const group = new THREE.Group();
    group.name = node.id;
    group.position.set(mm(originMm[0]), mm(originMm[1]), mm(originMm[2]));
    ctx.scene.add(group);
    node.view = { object3D: group };

    // Take the pieces this panel's bill of materials names, and only those.
    const used = [];
    for (const line of wanted) {
      const perPanel = (panelName === 'SIDE' || panelName === 'END') ? line.qty / 2 : line.qty;
      for (let i = 0; i < perPanel; i++) {
        const idx = pieces.findIndex((p) => p.meta.bomId === line.id && !p.meta.claimed);
        if (idx < 0) continue;
        const p = pieces[idx];
        p.meta.claimed = true;
        used.push({ piece: p, line, index: i });
      }
    }

    // Lay the parts out. Sheathing courses stack; frame members sit behind.
    let course = 0;
    for (const { piece, line, index } of used) {
      const o = piece.view.object3D;
      group.attach(o);
      let x = 0, y = 0, z = 0, ry = 0;
      if (line.role === 'sheathing' || line.role === 'floorboard') {
        y = piece.dimsMm.thicknessMm / 2 + 0;
        z = -C.DIM.wallHeightMm / 2 + piece.dimsMm.widthMm * (course + 0.5);
        course++;
      } else {
        y = piece.dimsMm.thicknessMm + piece.dimsMm.widthMm / 2;
        z = -C.DIM.wallHeightMm / 2 + 120 + index * 240;
        ry = 0;
      }
      o.position.set(mm(x), mm(y), mm(z));
      o.rotation.set(0, ry, 0);
      graph.attach(node.id, piece.id, 'PANEL_SHOP');
      graph.setState(piece.id, 'IN_ASSEMBLY', 'PANEL_SHOP');
      yield wait(0.02);
    }

    // Nail the sheathing to the frame. Real nails, real joints, real depths.
    const joint = C.JOINTS.find((j) => j.id === 'J1_SHEATH_TO_STRUT');
    const sheathing = used.filter((u) => u.line.role === 'sheathing' || u.line.role === 'floorboard');
    const frame = used.filter((u) => u.line.role !== 'sheathing' && u.line.role !== 'floorboard');

    for (const s of sheathing) {
      for (const f of frame) {
        for (let n = 0; n < 2; n++) {
          const sObj = s.piece.view.object3D;
          const p = new THREE.Vector3();
          sObj.getWorldPosition(p);
          const entry = [
            toMm(p.x) + (n === 0 ? -60 : 60),
            toMm(p.y) + s.piece.dimsMm.thicknessMm / 2,
            toMm(p.z),
          ];
          const nailNode = nails.beginDrive({
            nailSpec: joint.nail, entryWorldMm: entry, axisWorld: [0, -1, 0],
            joint, members: [s.piece.id, f.piece.id], stage: 'PANEL_SHOP', nowMs: ctx.clock.ms,
          });
          nailNode.meta.jointSpec = joint;
          nailNode.meta.jointNormal = [0, -1, 0];
          yield tween(0, 1, NAILER_DRIVE.driveMs / 1000,
            (t) => nails.setProgress(nailNode, t));
          const findings = nails.endDrive(nailNode);
          if (findings.length) state.faults.push({ at: 'NAIL', id: nailNode.id, findings });
          state.nailsDriven++;
          graph.attach(node.id, nailNode.id, 'PANEL_SHOP');
        }
      }
    }

    node.dimsMm = {
      lengthMm: C.DIM.lengthMm, widthMm: C.DIM.wallHeightMm,
      thicknessMm: C.SIDE_PANEL_THICKNESS_MM,
      partCount: used.length,
    };
    graph.setState(node.id, 'PLACED', 'PANEL_SHOP');
    state.panelsBuilt++;
    return node;
  }

  function* panelShop(pieces) {
    state.stage = 'PANEL_SHOP';
    state.stageState = STATES.RUNNING;
    const { panelShopOrigin } = ctx;
    const panels = [];
    // Panels are laid up on the fixture table, at its actual surface height.
    // Anything else leaves them floating, and the validation report says so.
    const F = ctx.panelFixtureTopMm;
    const layout = [
      ['BASE', [0, F, -3200]],
      ['SIDE', [0, F, -1600]],
      ['SIDE', [0, F, 0]],
      ['END', [0, F, 1600]],
      ['END', [0, F, 3200]],
      ['LID', [0, F, 4800]],
    ];
    for (const [name, off] of layout) {
      state.message = `building panel ${name}`;
      const p = yield* buildPanel(name, pieces, [
        panelShopOrigin[0] + off[0], off[1], panelShopOrigin[2] + off[2],
      ]);
      panels.push(p);
    }
    state.stageState = STATES.AWAITING_HANDOFF;
    state.manifest = { from: 'PANEL_SHOP', to: 'CRATE_SHOP', ids: panels.map((p) => p.id) };
    return panels;
  }

  /* ---- stage 3: the crate ------------------------------------- */

  function* crateShop(panels) {
    state.stage = 'CRATE_SHOP';
    state.stageState = STATES.RUNNING;
    const { crateShopOrigin, pallet } = ctx;

    const crate = graph.createNode({
      kind: KIND.CRATE, type: 'crate OW-C1', specId: 'OW-C1',
      dimsMm: {
        lengthMm: C.DIM.lengthMm, widthMm: C.DIM.widthMm, heightMm: C.HEIGHT_MM,
      },
      state: 'IN_ASSEMBLY', stage: 'CRATE_SHOP', originKind: 'ASSEMBLY',
    });
    const group = new THREE.Group();
    group.name = crate.id;
    group.position.set(mm(crateShopOrigin[0]), mm(pallet.deckTopYMm), mm(crateShopOrigin[2]));
    ctx.scene.add(group);
    crate.view = { object3D: group };

    // Assembly order comes from the spec: nothing is fastened to something not
    // yet present.
    const order = C.ASSEMBLY_ORDER.filter((s) => s.stage === 'CRATE_SHOP');
    // A panel is laid up flat on the fixture, so to become a wall it has to be
    // stood on edge. Placing it flat at the right coordinate leaves six slabs
    // stacked through one another, which is what the interpenetration count was
    // reporting.
    const T = SHEATHING_T;
    const placements = {
      BASE: { posMm: [0, 0, 0], rot: [0, 0, 0] },
      SIDE: [
        { posMm: [0, C.DIM.wallHeightMm / 2, C.DIM.widthMm / 2 - T], rot: [-Math.PI / 2, 0, 0] },
        { posMm: [0, C.DIM.wallHeightMm / 2, -(C.DIM.widthMm / 2 - T)], rot: [Math.PI / 2, 0, 0] },
      ],
      END: [
        { posMm: [C.DIM.lengthMm / 2 - T, C.DIM.wallHeightMm / 2, 0], rot: [-Math.PI / 2, Math.PI / 2, 0] },
        { posMm: [-(C.DIM.lengthMm / 2 - T), C.DIM.wallHeightMm / 2, 0], rot: [-Math.PI / 2, -Math.PI / 2, 0] },
      ],
      LID: { posMm: [0, C.DIM.wallHeightMm, 0], rot: [0, 0, 0] },
    };

    const byType = { BASE: [], SIDE: [], END: [], LID: [] };
    for (const p of panels) {
      const t = p.type.replace('panel ', '');
      byType[t]?.push(p);
    }

    const place = function* (panel, where) {
      state.message = `fitting ${panel.type}`;
      const o = panel.view.object3D;
      group.attach(o);
      o.rotation.set(where.rot[0], where.rot[1], where.rot[2]);
      o.position.set(mm(where.posMm[0]), mm(where.posMm[1] + 900), mm(where.posMm[2]));
      yield tween(where.posMm[1] + 900, where.posMm[1], 1.0, (v) => { o.position.y = mm(v); });
      graph.attach(crate.id, panel.id, 'CRATE_SHOP');
      graph.setState(panel.id, 'IN_ASSEMBLY', 'CRATE_SHOP');
      graph.record(panel.id, 'FITTED', {
        toCrate: crate.id, positionMm: where.posMm,
        rotationDeg: where.rot.map((v) => +(v * 180 / Math.PI).toFixed(1)),
      }, 'CRATE_SHOP');
    };

    // Order comes from the spec: ends first, because the sides lap them.
    if (byType.BASE[0]) yield* place(byType.BASE[0], placements.BASE);
    for (let i = 0; i < byType.END.length; i++) {
      yield* place(byType.END[i], placements.END[i]);
      if (byType.BASE[0]) graph.connect(byType.END[i].id, byType.BASE[0].id, 'SEATED_ON');
    }
    for (let i = 0; i < byType.SIDE.length; i++) {
      yield* place(byType.SIDE[i], placements.SIDE[i]);
      for (const e of byType.END) graph.connect(byType.SIDE[i].id, e.id, 'CORNER_JOINT');
    }
    if (byType.LID[0]) yield* place(byType.LID[0], placements.LID);

    crate.meta = { ...crate.meta, panelIds: panels.map((p) => p.id) };
    graph.setState(crate.id, 'PLACED', 'CRATE_SHOP');
    state.cratesBuilt++;
    state.stageState = STATES.AWAITING_HANDOFF;
    state.message = `crate ${crate.id} complete`;
    return crate;
  }

  /* ---- the whole run ------------------------------------------ */

  function* run() {
    while (true) {
      state.cycle++;
      state.faults.length = 0;
      const pieces = yield* cutShop();
      yield waitUntil(() => state.manifest?.to === 'PANEL_SHOP', 'handoff H1 acknowledged');
      const panels = yield* panelShop(pieces);
      yield waitUntil(() => state.manifest?.to === 'CRATE_SHOP', 'handoff H2 acknowledged');
      const crate = yield* crateShop(panels);
      state.stage = 'YARD';
      state.stageState = STATES.IDLE;
      state.message = `cycle ${state.cycle} complete: ${crate.id}`;
      yield wait(3);
      if (!ctx.repeat) return;
    }
  }

  const runner = createRunner(run, ctx);

  return {
    state, runner,
    step(dt) { runner.step(dt); if (runner.fault) state.faults.push({ at: state.stage, message: runner.fault.message }); },
    restart() { runner.restart(); },
  };
}
