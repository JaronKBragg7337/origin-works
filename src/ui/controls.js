/**
 * Camera controls. Mobile is the primary target, not an afterthought.
 *
 * One-finger drag orbits, two-finger pinch dollies and two-finger drag pans.
 * Mouse works the same way. Written here rather than imported so the app has no
 * dependency beyond the vendored three.module, and so the touch handling is
 * tuned for a phone rather than adapted from a desktop control.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm } from '../../knowledge/units.js';

export function createControls(camera, dom, { targetMm = [0, 0, 0], minDistMm = 900, maxDistMm = 140000 } = {}) {
  const target = new THREE.Vector3(mm(targetMm[0]), mm(targetMm[1]), mm(targetMm[2]));
  // Phi is measured from +Y, so PI/2 is horizontal. At PI/3.1 the whole frustum
  // pointed below the horizon and a 9 m factory wall 27 m away sat entirely
  // above the top of the view — the buildings were rendering and could not be
  // seen. PI/2.45 puts the eye about 20 degrees above the target.
  const spherical = new THREE.Spherical(mm(24000), Math.PI / 2.45, Math.PI / 4);
  const sphericalDelta = new THREE.Spherical(0, 0, 0);
  const panOffset = new THREE.Vector3();
  let dollyScale = 1;

  const state = { dragging: false, mode: null, moved: false };
  let lastX = 0, lastY = 0, lastDist = 0;
  const pointers = new Map();

  const ROTATE_SPEED = 0.005;
  const PAN_SPEED = 1.4;
  const DAMPING = 0.12;

  function onDown(e) {
    dom.setPointerCapture?.(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    state.dragging = true;
    state.moved = false;
    if (pointers.size === 1) { state.mode = 'rotate'; lastX = e.clientX; lastY = e.clientY; }
    else if (pointers.size === 2) {
      state.mode = 'zoompan';
      const [a, b] = [...pointers.values()];
      lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      lastX = (a.x + b.x) / 2; lastY = (a.y + b.y) / 2;
    }
  }

  function onMove(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (state.mode === 'rotate' && pointers.size === 1) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(dx) + Math.abs(dy) > 3) state.moved = true;
      sphericalDelta.theta -= dx * ROTATE_SPEED;
      sphericalDelta.phi -= dy * ROTATE_SPEED;
      lastX = e.clientX; lastY = e.clientY;
    } else if (state.mode === 'zoompan' && pointers.size === 2) {
      state.moved = true;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      if (lastDist > 0) dollyScale *= lastDist / dist;
      pan(cx - lastX, cy - lastY);
      lastDist = dist; lastX = cx; lastY = cy;
    }
  }

  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size === 0) { state.dragging = false; state.mode = null; }
    else if (pointers.size === 1) {
      state.mode = 'rotate';
      const [a] = [...pointers.values()];
      lastX = a.x; lastY = a.y;
    }
  }

  function pan(dx, dy) {
    const offset = new THREE.Vector3().setFromSpherical(spherical);
    const dist = offset.length() * Math.tan((camera.fov / 2) * Math.PI / 180) * 2;
    const el = dom.clientHeight || 1;
    const vx = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const vy = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    panOffset.addScaledVector(vx, (-dx * dist / el) * PAN_SPEED);
    panOffset.addScaledVector(vy, (dy * dist / el) * PAN_SPEED);
  }

  function onWheel(e) {
    e.preventDefault();
    dollyScale *= e.deltaY > 0 ? 1.08 : 1 / 1.08;
  }

  dom.addEventListener('pointerdown', onDown);
  dom.addEventListener('pointermove', onMove);
  dom.addEventListener('pointerup', onUp);
  dom.addEventListener('pointercancel', onUp);
  dom.addEventListener('wheel', onWheel, { passive: false });
  dom.style.touchAction = 'none';

  return {
    target,
    /** True when the last pointer sequence was a drag, so taps can select. */
    get wasDrag() { return state.moved; },

    lookAt(posMm, distanceMm) {
      target.set(mm(posMm[0]), mm(posMm[1]), mm(posMm[2]));
      if (distanceMm) spherical.radius = mm(distanceMm);
    },

    update() {
      spherical.theta += sphericalDelta.theta;
      spherical.phi += sphericalDelta.phi;
      spherical.phi = Math.max(0.08, Math.min(Math.PI / 2 - 0.02, spherical.phi));
      spherical.radius *= dollyScale;
      spherical.radius = Math.max(mm(minDistMm), Math.min(mm(maxDistMm), spherical.radius));

      target.add(panOffset);
      const offset = new THREE.Vector3().setFromSpherical(spherical);
      camera.position.copy(target).add(offset);
      camera.lookAt(target);

      sphericalDelta.theta *= 1 - DAMPING;
      sphericalDelta.phi *= 1 - DAMPING;
      panOffset.multiplyScalar(1 - DAMPING);
      dollyScale = 1 + (dollyScale - 1) * (1 - DAMPING);
    },
  };
}
