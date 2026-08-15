/**
 * Every tolerance in the project, in one place, in millimetres and degrees.
 *
 * Invariant 5 (AGENTS.md): "Validate with tolerances, not exact equality."
 * V1-TEST item 60: "Contact tests use the tolerances in /knowledge, not exact
 * equality."
 *
 * Nothing here is copied from a source. These are engineering choices for the
 * simulation, and each one carries the reason it has the value it has. Where a
 * real process tolerance exists it is noted, and the simulation tolerance is
 * set no tighter than the process could hold.
 */

export const TOLERANCES = Object.freeze({
  origin: 'original',
  note: 'Simulation tolerances. Not sourced; each justified in place.',

  /** A cut piece may differ from its recipe length by this much. */
  cutLengthMm: 0.5,
  cutLengthWhy:
    'An industrial crosscut saw with a fence holds roughly ±0.4 mm on ' +
    'repeat cuts. 0.5 mm gives the simulation no more accuracy than the ' +
    'machine it is modelling.',

  /** Cross-section of a dressed board may differ from nominal by this much. */
  sectionMm: 0.4,
  sectionWhy:
    'Planer variation. PS 20 dressed sizes are minimums, so real stock ' +
    'runs at or slightly above nominal.',

  /** Two faces are "touching" when the gap between them is within this. */
  contactMm: 0.5,
  contactWhy:
    'Boards the design says touch (V1-TEST G49) are checked against this. ' +
    'Tighter than a nail head, looser than float error.',

  /** An object is "supported" when its lowest support gap is within this. */
  supportMm: 1.0,
  supportWhy:
    'V1-TEST H55, "no object floats unsupported". Deliberately looser than ' +
    'contactMm: a board resting on a slightly uneven surface is still ' +
    'supported, but a board 2 mm in the air is floating.',

  /** Two solids interpenetrate if they overlap by more than this. */
  penetrationMm: 0.25,
  penetrationWhy:
    'V1-TEST H56. Below a quarter millimetre is numerical noise from ' +
    'float32 transforms, not a physical overlap.',

  /** A fastener is at its specified depth when within this of it. */
  fastenerDepthMm: 0.5,
  fastenerDepthWhy: 'V1-TEST F43. Same order as the nail shank diameter tolerance.',

  /** Total material balance may drift by this per cut, and no more. */
  materialBalancePerCutMm: 0.5,
  materialBalanceWhy:
    'V1-TEST A7. Accumulates over a cut plan: n cuts allow n × this. If a ' +
    'stock length cannot be accounted for within that, material was ' +
    'created or destroyed and the cycle fails.',

  /** Angular tolerance for "perpendicular", "parallel", joint axes. */
  angleDeg: 0.5,
  angleWhy: 'V1-TEST F41. Half a degree over a 100 mm nail is 0.9 mm of tip drift.',

  /** Positional tolerance for a part placed in an assembly. */
  placementMm: 1.0,
  placementWhy: 'V1-TEST G50/G53. Looser than cut tolerance because errors stack.',

  /** A gripper has "closed on the part" when jaw gap is within this of part width. */
  graspMm: 0.5,
  graspWhy:
    'V1-TEST D29, "the gripper closes onto the part\'s actual width, not to ' +
    'a fixed pose". Matched to gripper repeatability rounded up from 0.05 mm ' +
    'to allow for board section variation.',

  /** A wheel is on the ground when its contact gap is within this. */
  wheelContactMm: 2.0,
  wheelContactWhy:
    'V1-TEST E37. Looser than supportMm because a tyre deflects and the ' +
    'road has a modelled crown.',

  /** Minimum clearance required to call a fit "it fits". */
  fitClearanceMm: 5.0,
  fitClearanceWhy:
    'V1-TEST E38 and H61, forklift tines through pallet openings and ' +
    'vehicles through doorways. Anything under 5 mm is a jam in practice.',
});

/** True when |a - b| <= tol. The only equality test the project uses on lengths. */
export function within(a, b, tol) {
  return Math.abs(a - b) <= tol;
}

/** Signed overlap of two 1-D intervals; negative means a gap. */
export function overlap1d(minA, maxA, minB, maxB) {
  return Math.min(maxA, maxB) - Math.max(minA, minB);
}
