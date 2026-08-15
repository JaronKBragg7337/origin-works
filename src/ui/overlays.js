/**
 * Debug overlays.
 *
 * V1-TEST K77: "Debug overlays — bounding volumes, axes, connection points,
 * joint axes, reach envelopes, paths, contact tests — can be switched on and
 * off."
 *
 * Each layer is built lazily and disposed when switched off, so leaving them
 * off costs nothing on a phone.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm } from '../../knowledge/units.js';
import { REACH } from '../../knowledge/robot/arm-6r.js';
import { ROUTE } from '../../knowledge/site/layout.js';
import * as graph from '../core/graph.js';

export function createOverlays(scene, ctx) {
  const layers = new Map();
  const enabled = new Set();

  function group(name) {
    if (!layers.has(name)) {
      const g = new THREE.Group();
      g.name = `overlay:${name}`;
      g.visible = false;
      scene.add(g);
      layers.set(name, g);
    }
    return layers.get(name);
  }

  function clear(name) {
    const g = layers.get(name);
    if (!g) return;
    g.traverse((o) => { o.geometry?.dispose?.(); });
    g.clear();
  }

  /* ---- bounding volumes ---------------------------------------- */
  function buildBounds() {
    const g = group('bounds');
    clear('bounds');
    const mat = new THREE.LineBasicMaterial({ color: 0x66ff99 });
    const box = new THREE.Box3();
    for (const n of graph.all()) {
      const o = n.view?.object3D;
      if (!o || !o.parent) continue;
      box.setFromObject(o);
      if (box.isEmpty()) continue;
      const size = new THREE.Vector3(), c = new THREE.Vector3();
      box.getSize(size); box.getCenter(c);
      const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat);
      geo.dispose();
      l.position.copy(c);
      g.add(l);
    }
  }

  /* ---- object axes --------------------------------------------- */
  function buildAxes() {
    const g = group('axes');
    clear('axes');
    for (const n of graph.all()) {
      const o = n.view?.object3D;
      if (!o || !o.parent) continue;
      const a = new THREE.AxesHelper(mm(140));
      o.updateWorldMatrix(true, false);
      a.position.setFromMatrixPosition(o.matrixWorld);
      a.quaternion.setFromRotationMatrix(o.matrixWorld);
      g.add(a);
    }
  }

  /* ---- robot joint axes and reach envelope ---------------------- */
  function buildRobot() {
    const g = group('robot');
    clear('robot');
    const mat = new THREE.LineBasicMaterial({ color: 0xff4dd2 });
    for (const arm of ctx.arms ?? []) {
      for (const j of arm.joints) {
        j.pivot.updateWorldMatrix(true, false);
        const p = new THREE.Vector3().setFromMatrixPosition(j.pivot.matrixWorld);
        const q = new THREE.Quaternion().setFromRotationMatrix(j.pivot.matrixWorld);
        const dir = new THREE.Vector3(...j.spec.axis).applyQuaternion(q).normalize();
        const geo = new THREE.BufferGeometry().setFromPoints([
          p.clone().addScaledVector(dir, -mm(160)),
          p.clone().addScaledVector(dir, mm(160)),
        ]);
        g.add(new THREE.Line(geo, mat));
      }
      // Reach envelope: the sphere a target must be inside.
      const sph = new THREE.Mesh(
        new THREE.SphereGeometry(mm(REACH.maxRadiusMm), 16, 12),
        new THREE.MeshBasicMaterial({ color: 0xff4dd2, wireframe: true, transparent: true, opacity: 0.12 })
      );
      const base = new THREE.Vector3();
      arm.root.getWorldPosition(base);
      sph.position.copy(base).add(new THREE.Vector3(0, mm(REACH.shoulderHeightMm), 0));
      g.add(sph);
    }
  }

  /* ---- connection and interaction points ------------------------ */
  function buildPoints() {
    const g = group('points');
    clear('points');
    const geo = new THREE.SphereGeometry(mm(22), 6, 5);
    const matC = new THREE.MeshBasicMaterial({ color: 0xffc040 });
    const p = new THREE.Vector3();
    for (const n of graph.all()) {
      const o = n.view?.object3D;
      if (!o || !o.parent || n.connections.length === 0) continue;
      o.getWorldPosition(p);
      const s = new THREE.Mesh(geo, matC);
      s.position.copy(p);
      g.add(s);
    }
  }

  /* ---- vehicle path --------------------------------------------- */
  function buildPaths() {
    const g = group('paths');
    clear('paths');
    const pts = ROUTE.waypointsMm.map((w) => new THREE.Vector3(mm(w[0]), mm(120), mm(w[1])));
    pts.push(pts[0].clone());
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x4dd2ff })));
    for (const p of pts) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(mm(400), 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x4dd2ff })
      );
      m.position.copy(p);
      g.add(m);
    }
  }

  /* ---- contact tests -------------------------------------------- */
  function buildContacts(report) {
    const g = group('contacts');
    clear('contacts');
    if (!report) return;
    const bad = new THREE.MeshBasicMaterial({ color: 0xff4444 });
    const geo = new THREE.SphereGeometry(mm(60), 8, 6);
    const p = new THREE.Vector3();
    for (const f of report.floating) {
      const o = graph.get(f.id)?.view?.object3D;
      if (!o) continue;
      o.getWorldPosition(p);
      const m = new THREE.Mesh(geo, bad); m.position.copy(p); g.add(m);
    }
    for (const i of report.interpenetrating) {
      const o = graph.get(i.a)?.view?.object3D;
      if (!o) continue;
      o.getWorldPosition(p);
      const m = new THREE.Mesh(geo, bad); m.position.copy(p); g.add(m);
    }
  }

  const builders = {
    bounds: buildBounds, axes: buildAxes, robot: buildRobot,
    points: buildPoints, paths: buildPaths, contacts: () => buildContacts(ctx.lastReport),
  };

  return {
    names: Object.keys(builders),
    isOn(name) { return enabled.has(name); },
    toggle(name) {
      const g = group(name);
      if (enabled.has(name)) { enabled.delete(name); g.visible = false; clear(name); }
      else { enabled.add(name); builders[name](); g.visible = true; }
      return enabled.has(name);
    },
    /** Rebuild the live layers. Called at a low rate, not every frame. */
    refresh() { for (const name of enabled) builders[name](); },
    activeCount() { return enabled.size; },
  };
}
