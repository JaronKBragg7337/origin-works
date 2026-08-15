/**
 * Collision groups and scoped-penetration operations.
 *
 * Collision here is **process-aware**, not a universal no-overlap rule. A nail
 * is supposed to enter a board. A blade is supposed to cross the stock. A
 * gripper jaw is supposed to close until it contacts. What is never allowed is
 * turning collision off globally and calling the result a manufacturing step.
 *
 * V1-TEST H56-H59:
 *   56. No two solid objects interpenetrate outside a declared operation.
 *   57. Where interpenetration is intended it is scoped to the participating
 *       objects, the tool, the region and the duration, via collision groups or
 *       operation state, never by switching collision off globally.
 *   58. The resulting penetration is still validated.
 *   59. When the operation ends, normal collision resumes for those objects.
 *
 * The mechanism: an operation is a record with a type, an explicit list of
 * participant ids, a tool id, a bounded region, and a duration. While it is
 * open, the penetration checker consults it. It cannot be opened without all
 * five, it cannot cover an object not named in it, and closing it runs the
 * validation the operation type declares.
 */

/**
 * Collision groups. A pair of groups either collides or it does not; this is
 * the static layer, before any operation is opened.
 */
export const GROUPS = Object.freeze({
  WORLD: 'WORLD',           // ground, road, building shells
  STOCK: 'STOCK',           // raw and cut lumber
  ASSEMBLY: 'ASSEMBLY',     // panels and crates
  FASTENER: 'FASTENER',     // nails
  MACHINE: 'MACHINE',       // saw bodies, conveyor frames, fixtures
  TOOL: 'TOOL',             // blade, gripper jaws, driver nose
  ROBOT: 'ROBOT',           // arm links
  VEHICLE: 'VEHICLE',       // truck, forklift
});

/**
 * Static collision matrix. `false` means these two never collide even outside
 * an operation, and the reason is recorded — an unexplained `false` here would
 * be exactly the "globally disabled collision" that invariant 5 forbids.
 */
export const MATRIX = Object.freeze({
  [`${GROUPS.FASTENER}|${GROUPS.FASTENER}`]: Object.freeze({
    collides: false,
    why: 'Nails in a joint are never coincident by construction; the spacing ' +
         'rules guarantee separation and the validator checks it directly. ' +
         'Pairwise nail-nail contact would cost O(n^2) for no information.',
  }),
});

/** Do these two groups collide when no operation is open? */
export function groupsCollide(a, b) {
  const entry = MATRIX[`${a}|${b}`] ?? MATRIX[`${b}|${a}`];
  return entry ? entry.collides : true;
}

/**
 * The operation types that may create penetration, and what each one must
 * validate when it closes. Nothing may open an operation of a type not listed
 * here.
 */
export const OPERATIONS = Object.freeze({
  CUT: Object.freeze({
    id: 'CUT',
    tool: GROUPS.TOOL,
    participants: [GROUPS.STOCK],
    /** The blade may occupy the kerf volume, and nothing else. */
    regionKind: 'kerf-slab',
    maxDurationMs: 4000,
    validateOnClose: [
      'both output pieces exist and have ids',
      'input length equals sum of outputs plus kerf plus offcut within tolerance',
      'cut faces lie on the declared cut plane within cutLengthMm',
      'blade is clear of both pieces',
    ],
    why: 'V1-TEST C19-C24 and A5-A8.',
  }),

  DRIVE_FASTENER: Object.freeze({
    id: 'DRIVE_FASTENER',
    tool: GROUPS.TOOL,
    participants: [GROUPS.FASTENER, GROUPS.STOCK, GROUPS.ASSEMBLY],
    /** A cylinder on the nail axis, shank diameter, from head to point. */
    regionKind: 'fastener-cylinder',
    maxDurationMs: 600,
    validateOnClose: [
      'fastener penetrates both named members',
      'insertion depth within fastenerDepthMm of specification',
      'axis within angleDeg of the joint normal',
      'no protrusion through the far face unless the joint declares a clinch',
      'both members list the fastener and the fastener lists both members',
    ],
    why: 'V1-TEST F40-F47 and H58. This operation stays open for the life of ' +
         'the joint: a driven nail permanently occupies wood. What closes is ' +
         'the *driving*; the standing penetration is then a declared joint, ' +
         'not an unexplained overlap.',
    penetrationPersists: true,
  }),

  GRASP: Object.freeze({
    id: 'GRASP',
    tool: GROUPS.TOOL,
    participants: [GROUPS.STOCK, GROUPS.ASSEMBLY],
    /** Only the jaw pads may approach; a jaw may touch, never sink in. */
    regionKind: 'jaw-pads',
    maxDurationMs: null,
    /** Grasp allows contact, not penetration. Tolerance is zero overlap. */
    allowedPenetrationMm: 0,
    validateOnClose: [
      'jaw gap equals the part width within graspMm',
      'part transform is rigid relative to the flange while held',
      'no jaw-part overlap beyond penetrationMm',
    ],
    why: 'V1-TEST D29-D30. Listed as an operation because the jaws must be ' +
         'allowed to approach inside normal clearance, not because they may ' +
         'overlap the part.',
  }),

  SEAT: Object.freeze({
    id: 'SEAT',
    tool: null,
    participants: [GROUPS.STOCK, GROUPS.ASSEMBLY, GROUPS.MACHINE],
    /** An insertion fit: lid cleats into the crate opening, tines into a pallet. */
    regionKind: 'declared-fit',
    maxDurationMs: 3000,
    allowedPenetrationMm: 0,
    validateOnClose: [
      'the fit clearance is positive and at least fitClearanceMm',
      'the seated part rests on its declared support faces',
    ],
    why: 'V1-TEST H61. An insertion fit is a clearance, not an overlap. If the ' +
         'numbers say it interferes, the design is wrong and this fails.',
  }),
});

/**
 * An operation record. The checker refuses anything missing a field, which is
 * what makes the scope explicit rather than implied.
 */
export function makeOperation({ type, toolId, participantIds, region, openedAtMs, stage }) {
  const spec = OPERATIONS[type];
  if (!spec) throw new Error(`Unknown operation type "${type}"`);
  if (spec.tool !== null && !toolId) throw new Error(`${type} requires a toolId`);
  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    throw new Error(`${type} requires at least one participant id`);
  }
  if (!region) throw new Error(`${type} requires a bounded region`);
  if (typeof openedAtMs !== 'number') throw new Error(`${type} requires openedAtMs`);
  if (!stage) throw new Error(`${type} requires the stage that opened it`);
  return Object.freeze({
    type, toolId, participantIds: Object.freeze([...participantIds]),
    region, openedAtMs, stage, spec,
  });
}

/**
 * Is this specific overlap permitted right now? Everything about the answer is
 * scoped: both objects must be named in the operation, the tool must match, and
 * the overlap must lie inside the declared region.
 */
export function penetrationAllowed(op, idA, idB, pointInRegion) {
  if (!op) return false;
  const named = op.participantIds;
  const aOk = named.includes(idA) || idA === op.toolId;
  const bOk = named.includes(idB) || idB === op.toolId;
  return aOk && bOk && pointInRegion === true;
}
