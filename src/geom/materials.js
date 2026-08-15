/**
 * Materials.
 *
 * Wood gets three: the dressed face, the mill end, and the freshly sawn end.
 * That last one is not decoration — V1-TEST C22 asks that cut faces appear
 * where the cut was, and the only way to see that is for a sawn end to look
 * different from an end that came from the mill.
 *
 * Every material is created once and shared, so the draw-call budget in
 * knowledge/site/layout.js is reachable.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { DEFAULT_SPECIES } from '../../knowledge/material/lumber.js';
import { STEEL } from '../../knowledge/fastener/nails.js';

const cache = new Map();
function once(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

/* ---------- wood ------------------------------------------------- */

export const woodFace = () => once('woodFace', () => new THREE.MeshStandardMaterial({
  color: DEFAULT_SPECIES.colorHexDry, roughness: 0.82, metalness: 0.0, flatShading: true,
}));

/** Mill end: slightly darker and duller than the face. */
export const woodMillEnd = () => once('woodMillEnd', () => new THREE.MeshStandardMaterial({
  color: 0xb08f63, roughness: 0.9, metalness: 0.0, flatShading: true,
}));

/** Sawn end: pale, because the blade just exposed fresh fibre. */
export const woodCutEnd = () => once('woodCutEnd', () => new THREE.MeshStandardMaterial({
  color: DEFAULT_SPECIES.colorHexCut, roughness: 0.72, metalness: 0.0, flatShading: true,
}));

export const woodChamfer = () => once('woodChamfer', () => new THREE.MeshStandardMaterial({
  color: 0xd6b485, roughness: 0.78, metalness: 0.0, flatShading: true,
}));

/**
 * A board's four-slot material array, matching the group order in
 * shapes.chamferedBox: faces, +X end, -X end, chamfer.
 * `endsCut` says which ends were produced by a saw in this world.
 */
export function boardMaterials({ plusXCut = false, minusXCut = false } = {}) {
  return [
    woodFace(),
    plusXCut ? woodCutEnd() : woodMillEnd(),
    minusXCut ? woodCutEnd() : woodMillEnd(),
    woodChamfer(),
  ];
}

/* ---------- metal ------------------------------------------------ */

export const steel = () => once('steel', () => new THREE.MeshStandardMaterial({
  color: STEEL.colorHex, roughness: 0.42, metalness: 0.85,
}));

export const darkSteel = () => once('darkSteel', () => new THREE.MeshStandardMaterial({
  color: 0x3a3f45, roughness: 0.55, metalness: 0.7,
}));

export const bladeSteel = () => once('bladeSteel', () => new THREE.MeshStandardMaterial({
  color: 0xb9c0c7, roughness: 0.22, metalness: 0.95, side: THREE.DoubleSide,
}));

export const carbide = () => once('carbide', () => new THREE.MeshStandardMaterial({
  color: 0x59616b, roughness: 0.35, metalness: 0.9,
}));

/* ---------- machine paint ---------------------------------------- */

export const machineBody = () => once('machineBody', () => new THREE.MeshStandardMaterial({
  color: 0x2f6f8f, roughness: 0.6, metalness: 0.25,
}));

export const machineTrim = () => once('machineTrim', () => new THREE.MeshStandardMaterial({
  color: 0xe0e3e6, roughness: 0.65, metalness: 0.1,
}));

export const robotBody = () => once('robotBody', () => new THREE.MeshStandardMaterial({
  color: 0xdfe2e5, roughness: 0.45, metalness: 0.15,
}));

export const robotJoint = () => once('robotJoint', () => new THREE.MeshStandardMaterial({
  color: 0x1f2429, roughness: 0.5, metalness: 0.5,
}));

export const guardYellow = () => once('guardYellow', () => new THREE.MeshStandardMaterial({
  color: 0xf0b429, roughness: 0.6, metalness: 0.15,
}));

export const guardMesh = () => once('guardMesh', () => new THREE.MeshStandardMaterial({
  color: 0x2a2e33, roughness: 0.7, metalness: 0.4,
  transparent: true, opacity: 0.35, side: THREE.DoubleSide,
}));

export const rubber = () => once('rubber', () => new THREE.MeshStandardMaterial({
  color: 0x1a1c1e, roughness: 0.95, metalness: 0.0,
}));

export const glass = () => once('glass', () => new THREE.MeshStandardMaterial({
  color: 0x9fd3e0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45,
}));

export const lampOn = (hex) => once(`lampOn${hex}`, () => new THREE.MeshStandardMaterial({
  color: hex, emissive: hex, emissiveIntensity: 1.4, roughness: 0.4,
}));

export const lampOff = () => once('lampOff', () => new THREE.MeshStandardMaterial({
  color: 0x50555a, roughness: 0.6, metalness: 0.2,
}));

/* ---------- vehicles --------------------------------------------- */

export const truckPaint = () => once('truckPaint', () => new THREE.MeshStandardMaterial({
  color: 0x9a3b2c, roughness: 0.45, metalness: 0.3,
}));

export const forkliftPaint = () => once('forkliftPaint', () => new THREE.MeshStandardMaterial({
  color: 0xd9761b, roughness: 0.5, metalness: 0.25,
}));

/* ---------- site ------------------------------------------------- */

export const ground = () => once('ground', () => new THREE.MeshStandardMaterial({
  color: 0x6f7a5e, roughness: 1.0, metalness: 0.0,
}));

export const asphalt = () => once('asphalt', () => new THREE.MeshStandardMaterial({
  color: 0x33363a, roughness: 0.95, metalness: 0.0,
}));

export const roadLine = () => once('roadLine', () => new THREE.MeshStandardMaterial({
  color: 0xd8d2b8, roughness: 0.85, metalness: 0.0,
}));

export const concrete = () => once('concrete', () => new THREE.MeshStandardMaterial({
  color: 0x8b8d88, roughness: 0.95, metalness: 0.0,
}));

export const wallPanel = () => once('wallPanel', () => new THREE.MeshStandardMaterial({
  color: 0xb9bcbe, roughness: 0.7, metalness: 0.15,
}));

export const wallTrim = () => once('wallTrim', () => new THREE.MeshStandardMaterial({
  color: 0x35566b, roughness: 0.6, metalness: 0.2,
}));

export const roof = () => once('roof', () => new THREE.MeshStandardMaterial({
  color: 0x6e7276, roughness: 0.8, metalness: 0.3,
}));

export const shutter = () => once('shutter', () => new THREE.MeshStandardMaterial({
  color: 0x9aa0a5, roughness: 0.55, metalness: 0.45,
}));

/** Sawdust, for the kerf waste that a cut actually produces. */
export const sawdust = () => once('sawdust', () => new THREE.MeshStandardMaterial({
  color: 0xd9c49a, roughness: 1.0, metalness: 0.0,
}));

/* ---------- selection and overlays -------------------------------- */

export const selectionMat = () => once('selection', () => new THREE.MeshBasicMaterial({
  color: 0x4dd2ff, wireframe: true, transparent: true, opacity: 0.9,
}));

export function disposeAll() {
  for (const m of cache.values()) m.dispose?.();
  cache.clear();
}

export function materialCount() {
  return cache.size;
}
