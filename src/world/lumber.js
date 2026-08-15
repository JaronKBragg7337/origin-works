/**
 * Lumber in the world: stock, cutting, offcuts and kerf waste.
 *
 * This is where V1-TEST section A is decided.
 *
 *   A cut takes one piece of wood and produces two pieces of wood and a pile of
 *   sawdust. The lengths add up. Nothing is deleted, and nothing appears.
 *
 * A board's local frame: length along +X, thickness along +Y, width along +Z,
 * centred on its own bounding box. Ends are at ±length/2.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, toMm, massKg } from '../../knowledge/units.js';
import { pieceVolumeMm3, profileAreaMm2, DEFAULT_SPECIES } from '../../knowledge/material/lumber.js';
import { BLADE } from '../../knowledge/saw/crosscut-saw.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import * as graph from '../core/graph.js';
import { KIND } from '../core/ids.js';
import { chamferedBox } from '../geom/shapes.js';
import { boardMaterials, sawdust } from '../geom/materials.js';

/** Geometry cache keyed by exact millimetre dimensions. */
const geoCache = new Map();

function boardGeometry(profile, lengthMm) {
  const key = `${profile.id}:${lengthMm.toFixed(2)}`;
  if (!geoCache.has(key)) {
    geoCache.set(key, chamferedBox(lengthMm, profile.thicknessMm, profile.widthMm, 1.2));
  }
  return geoCache.get(key);
}

export function cachedGeometryCount() {
  return geoCache.size;
}

/**
 * Build the Object3D for a board. The material array records which ends were
 * sawn, so a cut end is visibly a cut end.
 */
function boardMesh(profile, lengthMm, cutEnds) {
  const mesh = new THREE.Mesh(
    boardGeometry(profile, lengthMm),
    boardMaterials({ plusXCut: cutEnds.plusX, minusXCut: cutEnds.minusX })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function dims(profile, lengthMm) {
  return {
    lengthMm,
    thicknessMm: profile.thicknessMm,
    widthMm: profile.widthMm,
    volumeMm3: pieceVolumeMm3(profile, lengthMm),
    massKg: massKg(pieceVolumeMm3(profile, lengthMm), DEFAULT_SPECIES.densityKgPerM3),
  };
}

/**
 * Create a stick of raw stock. This is the only place material enters the
 * world, which is what makes V1-TEST A9 ("nothing is created that had no
 * source") checkable: every other piece has a cutFromId.
 */
export function createStock({ profile, lengthMm, stockId, stage = 'CUT_SHOP' }) {
  const node = graph.createNode({
    kind: KIND.STOCK,
    type: `stock ${profile.nominal}`,
    specId: profile.id,
    dimsMm: dims(profile, lengthMm),
    state: 'STOCK',
    stage,
    originKind: 'DELIVERY',
    meta: { profile, stockId, cutEnds: { plusX: false, minusX: false }, species: DEFAULT_SPECIES.id },
  });
  const mesh = boardMesh(profile, lengthMm, { plusX: false, minusX: false });
  mesh.userData.owId = node.id;
  node.view = { object3D: mesh };
  graph.record(node.id, 'DELIVERED', { stockId, lengthMm, profile: profile.id }, stage);
  return node;
}

/**
 * Cut a piece of wood at `atMm` from its -X end.
 *
 * Produces exactly three children:
 *   - the piece from the -X end to the cut, length `atMm`
 *   - kerf waste, length BLADE.kerfMm, as a real object
 *   - the remainder, from the cut to the +X end
 *
 * The parent becomes CONSUMED. It stays in the graph forever, because both
 * children point at it (V1-TEST B12, B13).
 *
 * @returns {{piece, kerf, remainder, balance}}
 */
export function cutBoard({ parentId, atMm, stage = 'CUT_SHOP', role = null, bomId = null, panel = null }) {
  const parent = graph.get(parentId);
  if (!parent) throw new Error(`cutBoard: no node ${parentId}`);
  if (parent.state === 'CONSUMED') throw new Error(`${parentId} was already cut`);

  const profile = parent.meta.profile;
  const inLen = parent.dimsMm.lengthMm;
  const kerfMm = BLADE.kerfMm;
  const remLen = inLen - atMm - kerfMm;

  if (atMm <= 0 || remLen < 0) {
    throw new Error(
      `cutBoard: cannot take ${atMm} mm plus ${kerfMm} mm kerf from ${inLen} mm`
    );
  }

  const parentCuts = parent.meta.cutEnds;

  // The piece: its -X end is whatever the parent's -X end was, its +X end is sawn.
  const pieceCuts = { minusX: parentCuts.minusX, plusX: true };
  const piece = graph.createNode({
    kind: KIND.PIECE,
    type: role ? `${role} ${profile.nominal}` : `piece ${profile.nominal}`,
    specId: profile.id,
    dimsMm: dims(profile, atMm),
    state: 'CUT',
    stage,
    cutFromId: parentId,
    originId: parent.origin.id ?? parentId,
    originKind: parent.origin.kind ?? 'DELIVERY',
    meta: { profile, cutEnds: pieceCuts, role, bomId, panel, species: parent.meta.species },
  });
  const pieceMesh = boardMesh(profile, atMm, pieceCuts);
  pieceMesh.userData.owId = piece.id;
  piece.view = { object3D: pieceMesh };

  // The kerf: real material, destroyed as sawdust. Not a deletion.
  const kerf = graph.createNode({
    kind: KIND.KERF,
    type: 'kerf waste',
    specId: profile.id,
    dimsMm: dims(profile, kerfMm),
    state: 'KERF_WASTE',
    stage,
    cutFromId: parentId,
    originId: parent.origin.id ?? parentId,
    originKind: parent.origin.kind ?? 'DELIVERY',
    meta: { profile, sectionAreaMm2: profileAreaMm2(profile), species: parent.meta.species },
  });
  // Sawdust has a volume but no useful shape; it is represented as loose
  // material at the saw, and it is counted.
  kerf.view = null;

  // The remainder: its -X end is sawn, its +X end is whatever the parent's was.
  const remCuts = { minusX: true, plusX: parentCuts.plusX };
  const remainder = graph.createNode({
    kind: remLen > 0 ? KIND.REMAINDER : KIND.OFFCUT,
    type: remLen > 0 ? `remainder ${profile.nominal}` : `offcut ${profile.nominal}`,
    specId: profile.id,
    dimsMm: dims(profile, Math.max(remLen, 0)),
    state: remLen > 0 ? 'STOCK' : 'OFFCUT',
    stage,
    cutFromId: parentId,
    originId: parent.origin.id ?? parentId,
    originKind: parent.origin.kind ?? 'DELIVERY',
    meta: { profile, cutEnds: remCuts, species: parent.meta.species },
  });
  if (remLen > 0.05) {
    const remMesh = boardMesh(profile, remLen, remCuts);
    remMesh.userData.owId = remainder.id;
    remainder.view = { object3D: remMesh };
  }

  graph.attach(parentId, piece.id, stage);
  graph.attach(parentId, kerf.id, stage);
  graph.attach(parentId, remainder.id, stage);
  // attach() sets parentId, which would make the pieces look contained. They
  // are lineage children, not assembly children: clear the containment link and
  // keep cutFromId as the record. Lineage survives; the pieces stay free.
  piece.parentId = null;
  kerf.parentId = null;
  remainder.parentId = null;
  parent.childIds = [piece.id, kerf.id, remainder.id];

  graph.setState(parentId, 'CONSUMED', stage);
  if (parent.view?.object3D?.parent) parent.view.object3D.parent.remove(parent.view.object3D);

  const balance = graph.cutBalance(parentId);
  graph.record(parentId, 'CUT', {
    atMm, kerfMm, producedIds: [piece.id, kerf.id, remainder.id], balance,
  }, stage);
  graph.record(piece.id, 'CUT_FROM', { parent: parentId, atMm, kerfMm }, stage);

  if (Math.abs(balance.errorMm) > TOLERANCES.materialBalancePerCutMm) {
    throw new Error(
      `Material balance failed on ${parentId}: in ${balance.inMm} != out ` +
      `${balance.outMm} + kerf ${balance.kerfMm} (error ${balance.errorMm} mm)`
    );
  }

  return { piece, kerf, remainder, balance };
}

/**
 * A visible sawdust pile that grows as kerf accumulates. The volume it shows is
 * the real summed kerf volume, so it is a readout, not a prop.
 */
export function makeSawdustPile() {
  const geo = new THREE.ConeGeometry(1, 1, 12);
  geo.translate(0, 0.5, 0);
  const mesh = new THREE.Mesh(geo, sawdust());
  mesh.receiveShadow = true;
  mesh.scale.setScalar(0.0001);
  let volumeMm3 = 0;
  return {
    mesh,
    add(mm3) {
      volumeMm3 += mm3;
      // Cone of 30 degrees repose: V = (1/3)pi r^2 h, h = r*tan(30).
      const v = volumeMm3 * 1e-9;                        // m^3
      const r = Math.cbrt((3 * v) / (Math.PI * Math.tan(Math.PI / 6)));
      mesh.scale.set(Math.max(r, 1e-4), Math.max(r * Math.tan(Math.PI / 6), 1e-4), Math.max(r, 1e-4));
    },
    get volumeMm3() { return volumeMm3; },
  };
}

/** Place a board in the world by its centre, in millimetres, with a heading. */
export function placeBoard(node, [xMm, yMm, zMm], rotY = 0, rotZ = 0) {
  const o = node.view?.object3D;
  if (!o) return;
  o.position.set(mm(xMm), mm(yMm), mm(zMm));
  o.rotation.set(0, rotY, rotZ);
}

/** Read a board's world-space centre back in millimetres, for the inspector. */
export function boardPositionMm(node) {
  const o = node.view?.object3D;
  if (!o) return null;
  const p = new THREE.Vector3();
  o.getWorldPosition(p);
  return [toMm(p.x), toMm(p.y), toMm(p.z)];
}
