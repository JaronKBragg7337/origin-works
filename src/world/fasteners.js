/**
 * Fasteners in the world.
 *
 * A nail here is three things at once, and it has to be all three:
 *   - a graph node with an id, a length, a diameter, an axis and two members
 *     it connects (V1-TEST F40, F45)
 *   - an instance in an InstancedMesh, so 252 of them cost two draw calls
 *   - a scoped penetration, opened as a DRIVE_FASTENER operation and validated
 *     when the driving ends (V1-TEST F42, F43, F47, H57, H58)
 *
 * Instancing is a rendering decision. It changes nothing about the graph: each
 * instance has its own node, and removing the mesh would not remove the nail.
 */

import * as THREE from '../../vendor/three/three.module.min.js';
import { mm, toMm, toDeg } from '../../knowledge/units.js';
import { TOLERANCES } from '../../knowledge/tolerances.js';
import { evaluateJoint } from '../../knowledge/fastener/nailing-rules.js';
import { OPERATIONS } from '../../knowledge/collision.js';
import { nailGeometry } from '../geom/shapes.js';
import { steel } from '../geom/materials.js';
import * as graph from '../core/graph.js';
import * as ops from '../core/ops.js';
import { KIND } from '../core/ids.js';

const MAX_PER_TYPE = 512;

/**
 * One InstancedMesh per nail type. Nails are never removed, so the write
 * cursor only advances — which matches the fact that a driven nail stays
 * driven.
 */
export function createNailField(scene) {
  const fields = new Map();   // nailSpec.id -> { mesh, count, spec }

  function fieldFor(nailSpec) {
    if (!fields.has(nailSpec.id)) {
      const mesh = new THREE.InstancedMesh(nailGeometry(nailSpec), steel(), MAX_PER_TYPE);
      mesh.count = 0;
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `nails:${nailSpec.id}`;
      mesh.userData.nailField = nailSpec.id;
      scene.add(mesh);
      fields.set(nailSpec.id, { mesh, spec: nailSpec, nodes: [] });
    }
    return fields.get(nailSpec.id);
  }

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);
  const _pos = new THREE.Vector3();
  const _scale = new THREE.Vector3(1, 1, 1);

  /**
   * Drive a nail.
   *
   * @param entryWorldMm  where the head sits when fully driven, world mm
   * @param axisWorld     unit vector the nail travels along (points into wood)
   * @param joint         the joint spec from the crate BOM
   * @param members       [aId, bId] the two members it must connect
   * @param progress      0..1 driving progress; 1 is fully driven
   */
  function beginDrive({ nailSpec, entryWorldMm, axisWorld, joint, members, stage, nowMs }) {
    const f = fieldFor(nailSpec);
    const index = f.mesh.count;
    if (index >= MAX_PER_TYPE) throw new Error(`Nail field ${nailSpec.id} is full`);
    f.mesh.count = index + 1;

    const node = graph.createNode({
      kind: KIND.NAIL,
      type: `${nailSpec.size} ${nailSpec.type} nail`,
      specId: nailSpec.id,
      dimsMm: {
        lengthMm: nailSpec.lengthMm,
        diameterMm: nailSpec.diameterMm,
        headDiameterMm: nailSpec.headDiameterMm,
        pointLengthMm: nailSpec.pointLengthMm,
      },
      state: 'STOCK',
      stage,
      originKind: 'MAGAZINE',
      meta: {
        fieldId: nailSpec.id, index, jointId: joint.id,
        axisWorld: [...axisWorld], entryWorldMm: [...entryWorldMm],
        nailSpec,
      },
    });
    f.nodes.push(node);

    const region = {
      kind: 'fastener-cylinder',
      originMm: [...entryWorldMm],
      axis: [...axisWorld],
      diameterMm: nailSpec.diameterMm,
      lengthMm: nailSpec.lengthMm,
    };
    const handle = ops.openOp({
      type: OPERATIONS.DRIVE_FASTENER.id,
      toolId: 'OW-N1',
      participantIds: [node.id, ...members],
      region, stage, nowMs,
    });
    node.meta.opHandle = handle;
    node.meta.members = [...members];
    graph.setState(node.id, 'BEING_DRIVEN', stage);
    setProgress(node, 0);
    return node;
  }

  /** Move the nail along its axis. 0 = tip at the surface, 1 = head seated. */
  function setProgress(node, t) {
    const f = fields.get(node.meta.fieldId);
    if (!f) return;
    const spec = node.meta.nailSpec;
    const axis = new THREE.Vector3(...node.meta.axisWorld).normalize();
    const entry = new THREE.Vector3(
      mm(node.meta.entryWorldMm[0]), mm(node.meta.entryWorldMm[1]), mm(node.meta.entryWorldMm[2])
    );
    // At t=0 the nail is standing off by its own length; at t=1 the head is at entry.
    const standoff = mm(spec.lengthMm) * (1 - t);
    _pos.copy(entry).addScaledVector(axis, -standoff);
    // Geometry runs from head at +0 down to point at -length along local +Y,
    // so local -Y must point along the driving axis.
    _q.setFromUnitVectors(_up, axis.clone().negate());
    _m.compose(_pos, _q, _scale);
    f.mesh.setMatrixAt(node.meta.index, _m);
    f.mesh.instanceMatrix.needsUpdate = true;
    node.meta.progress = t;
  }

  /**
   * Finish driving and validate. Returns the findings; empty means the nail is
   * where the drawing says it is.
   */
  function endDrive(node, { membersPresent = true } = {}) {
    setProgress(node, 1);
    const spec = node.meta.nailSpec;
    const joint = node.meta.joint ?? null;

    const findings = ops.closeOp(node.meta.opHandle, () => {
      const problems = [];
      if (!membersPresent) problems.push('a named member was not present at the joint');

      const j = node.meta.jointSpec;
      if (j) {
        const e = evaluateJoint({
          headMemberThicknessMm: j.headMemberThicknessMm,
          throughThicknessMm: j.throughThicknessMm,
          pointMemberThicknessMm: j.pointMemberThicknessMm,
          nailSpec: spec,
          manner: j.manner,
        });
        if (!e.ok) problems.push(...e.findings);

        // Does it actually reach the second member?
        const penetration = spec.lengthMm - j.throughThicknessMm;
        if (penetration <= 0) problems.push('nail does not reach the second member');
        node.meta.penetrationMm = +penetration.toFixed(2);
        node.meta.protrusionMm = +e.computed.protrusionMm.toFixed(2);
        node.meta.clinched = e.computed.clinched;

        // Axis perpendicular to the joint face, within the angle tolerance.
        const axis = new THREE.Vector3(...node.meta.axisWorld).normalize();
        const normal = new THREE.Vector3(...(node.meta.jointNormal ?? node.meta.axisWorld)).normalize();
        const angleDeg = toDeg(Math.acos(Math.min(1, Math.abs(axis.dot(normal)))));
        node.meta.axisErrorDeg = +angleDeg.toFixed(3);
        if (angleDeg > TOLERANCES.angleDeg) {
          problems.push(`axis is ${angleDeg.toFixed(2)} deg off the joint normal`);
        }
      }
      return problems;
    });

    graph.setState(node.id, 'FASTENED', node.stage);
    const [a, b] = node.meta.members;
    graph.fasten(node.id, a, b, {
      jointId: node.meta.jointId,
      penetrationMm: node.meta.penetrationMm,
      protrusionMm: node.meta.protrusionMm,
      clinched: node.meta.clinched,
      axisErrorDeg: node.meta.axisErrorDeg,
      findings,
    });
    return findings;
  }

  return {
    fieldFor, beginDrive, setProgress, endDrive,
    /** Draw calls used by fasteners: one per nail type. */
    drawCalls() { return fields.size; },
    totalNails() { return [...fields.values()].reduce((n, f) => n + f.mesh.count, 0); },
    /** Resolve a raycast hit on a nail field back to the nail node. */
    nodeForInstance(fieldId, instanceId) {
      const f = fields.get(fieldId);
      if (!f) return null;
      return f.nodes.find((n) => n.meta.index === instanceId) ?? null;
    },
    fields,
  };
}
