/**
 * The general nailing rules, from SOURCES.md S1 (USDA Agriculture Handbook 252,
 * "Wood Crate Design Manual"), pp. 17-19.
 *
 * These are written as **functions, not prose**, so that the bill of materials
 * can declare which rule justified each fastener and the validator can
 * recompute it. A nail in this project is not chosen because it looked right.
 * It is chosen because a rule returned it, and the rule is checkable.
 *
 * Transcription note: the PDF's text layer renders vulgar fractions as
 * mojibake. The clinch allowances below (¼ / ⅜ / ½ in) were confirmed by
 * reading page 21 of the source as an image, not by guessing at the pattern.
 */

import { inchToMm } from '../units.js';

/** Penny sizes in ascending order, so "up to sevenpenny" is computable. */
const PENNY_ORDER = ['2d', '3d', '4d', '5d', '6d', '7d', '8d', '9d', '10d', '12d', '16d', '20d', '30d', '40d', '50d', '60d'];

function pennyIndex(size) {
  const i = PENNY_ORDER.indexOf(size);
  if (i < 0) throw new Error(`Unknown penny size "${size}"`);
  return i;
}

/** S1 rule 4: clinch when the combined thickness is 3 inches or less. */
export const CLINCH_MAX_COMBINED_MM = inchToMm(3);

/**
 * S1 rule 4 — minimum clinch allowance, by nail size.
 *
 *   "A ¼-inch minimum clinch should be used for nails up to sevenpenny, a
 *    ⅜-inch clinch for eightpenny through twelvepenny nails, and a ½-inch
 *    clinch for larger nails."
 *
 * @param {string} size penny size, e.g. '5d'
 * @returns {number} minimum length of nail that must protrude, mm
 */
export function minClinchAllowanceMm(size) {
  const i = pennyIndex(size);
  if (i <= pennyIndex('7d')) return inchToMm(0.25);
  if (i <= pennyIndex('12d')) return inchToMm(0.375);
  return inchToMm(0.5);
}

/**
 * S1 rule 4 — does this joint get clinched?
 * @param {number} combinedThicknessMm total thickness the nail passes through
 * @param {'flatwise'|'face-to-edge'} manner how the members meet
 */
export function shouldClinch(combinedThicknessMm, manner = 'flatwise') {
  // Rule 5: "Nails are not clinched ... when the flat face of one member is
  // nailed to the edge of another."
  if (manner === 'face-to-edge') return false;
  return combinedThicknessMm <= CLINCH_MAX_COMBINED_MM;
}

/**
 * S1 rule 4 — shortest nail that can pass through and still be clinched.
 * @returns {number} mm
 */
export function minNailLengthForClinchMm(combinedThicknessMm, size) {
  return combinedThicknessMm + minClinchAllowanceMm(size);
}

/**
 * S1 rule 5 — required penetration for an unclinched joint.
 *
 *   "Tenpenny and smaller nails should penetrate into the piece for a distance
 *    equal to about 2 to 2½ times the thickness of the piece holding the
 *    nailhead. Twelvepenny and larger nails should penetrate at least 1½ inches
 *    into the piece that holds the point."
 *
 * @param {string} size penny size
 * @param {number} headMemberThicknessMm thickness of the piece holding the head
 * @returns {{minMm: number, maxMm: number|null, clause: string}}
 */
export function requiredPenetrationMm(size, headMemberThicknessMm) {
  if (pennyIndex(size) <= pennyIndex('10d')) {
    return {
      minMm: 2.0 * headMemberThicknessMm,
      maxMm: 2.5 * headMemberThicknessMm,
      clause: 'S1 rule 5, 10d and smaller: 2 to 2.5 x head-member thickness',
    };
  }
  return {
    minMm: inchToMm(1.5),
    maxMm: null,
    clause: 'S1 rule 5, 12d and larger: at least 1.5 in',
  };
}

/**
 * S1 rule 7 — "Nails generally should be driven no closer to the edge of a
 * piece than one-half its thickness and no closer to the end than the thickness
 * of the piece."
 */
export function minEdgeDistanceMm(pieceThicknessMm) {
  return 0.5 * pieceThicknessMm;
}
export function minEndDistanceMm(pieceThicknessMm) {
  return pieceThicknessMm;
}

/**
 * S1 rule 11 — "the number of rows of nails is usually determined by the width
 * of the surface in contact. One row of nails is used for widths of 2 inches
 * and less, two rows for widths over 2 inches and less than 6 inches, and three
 * rows for widths 6 inches and over."
 */
export function rowsForContactWidth(contactWidthMm) {
  if (contactWidthMm <= inchToMm(2)) return 1;
  if (contactWidthMm < inchToMm(6)) return 2;
  return 3;
}

/**
 * S1 rule 10 — plywood to struts: "nails should be spaced not more than 3
 * inches on center and staggered in rows not less than ¾ inch apart."
 * Carried for completeness; V1 uses lumber sheathing, not plywood.
 */
export const PLYWOOD_TO_STRUT = Object.freeze({
  source: 'S1',
  maxSpacingMm: inchToMm(3),
  minRowSeparationMm: inchToMm(0.75),
});

/**
 * S1 rule 15 — "In fabrication of lumber-sheathed crate panels, at least two
 * nails should be driven through each sheathing board into each member it
 * crosses. In assembly, also, at least two nails should be used to fasten each
 * sheathing board to each fastening member, including skids."
 */
export const MIN_NAILS_PER_SHEATHING_CROSSING = 2;

/**
 * S1 rule 8 — "To decrease splitting, nails should be driven in two or more
 * rows whenever possible, or staggered slightly within the row when one row is
 * used." Expressed as the stagger offset applied to alternate nails.
 */
export const SINGLE_ROW_STAGGER = Object.freeze({
  source: 'S1',
  rule: 8,
  /** Offset applied to alternate nails in a single row, mm. */
  offsetMm: inchToMm(0.25),
  origin: 'original',
  offsetWhy: 'S1 rule 8 says "staggered slightly" without a number. 6.35 mm chosen.',
});

/**
 * S1 rule 6 — "predrilling is recommended for twentypenny nails and larger."
 */
export function needsLeadHole(size) {
  return pennyIndex(size) >= pennyIndex('20d');
}

/**
 * S1 rule 3 — "Whenever possible, nails should be driven through the thinner
 * piece into the thicker."
 */
export function driveDirectionIsCorrect(headMemberThicknessMm, pointMemberThicknessMm) {
  return headMemberThicknessMm <= pointMemberThicknessMm;
}

/**
 * Evaluate a complete nailed joint against the rules. This is the function the
 * validator calls for every joint in the bill of materials, and it is the
 * reason a fastener choice in this project can be checked rather than trusted.
 *
 * @param {object} joint
 * @param {number} joint.headMemberThicknessMm  piece the head sits in
 * @param {number} joint.pointMemberThicknessMm piece the point ends in
 * @param {number} [joint.throughThicknessMm]   total the nail crosses before the point member
 * @param {object} joint.nailSpec               a resolved nail from nails.js
 * @param {'flatwise'|'face-to-edge'} [joint.manner]
 * @param {boolean} [joint.clinched]            what the BOM claims
 * @returns {{ok: boolean, findings: string[], computed: object}}
 */
export function evaluateJoint(joint) {
  const {
    headMemberThicknessMm,
    pointMemberThicknessMm,
    throughThicknessMm = headMemberThicknessMm,
    nailSpec,
    manner = 'flatwise',
    clinched,
  } = joint;

  const findings = [];
  const combined = throughThicknessMm + pointMemberThicknessMm;
  const wantsClinch = shouldClinch(combined, manner);
  const protrusion = nailSpec.lengthMm - combined;
  const penetration = nailSpec.lengthMm - throughThicknessMm;

  if (clinched !== undefined && clinched !== wantsClinch) {
    findings.push(
      `BOM says clinched=${clinched} but S1 rule 4/5 gives ${wantsClinch} ` +
        `for a ${combined.toFixed(1)} mm ${manner} joint`
    );
  }

  if (wantsClinch) {
    const need = minClinchAllowanceMm(nailSpec.size);
    if (protrusion < need) {
      findings.push(
        `clinch allowance ${protrusion.toFixed(2)} mm is below the ` +
          `${need.toFixed(2)} mm S1 rule 4 requires for ${nailSpec.size}`
      );
    }
  } else {
    const req = requiredPenetrationMm(nailSpec.size, headMemberThicknessMm);
    if (penetration < req.minMm) {
      findings.push(
        `penetration ${penetration.toFixed(2)} mm is below the ` +
          `${req.minMm.toFixed(2)} mm minimum (${req.clause})`
      );
    }
    if (req.maxMm !== null && penetration > req.maxMm) {
      findings.push(
        `penetration ${penetration.toFixed(2)} mm exceeds the ` +
          `${req.maxMm.toFixed(2)} mm maximum (${req.clause})`
      );
    }
    // V1-TEST F44: it must not protrude through the far face unless intended.
    if (protrusion > 0) {
      findings.push(
        `unclinched nail protrudes ${protrusion.toFixed(2)} mm through the far face`
      );
    }
  }

  if (!driveDirectionIsCorrect(headMemberThicknessMm, pointMemberThicknessMm)) {
    findings.push(
      `S1 rule 3: driven through the thicker piece (${headMemberThicknessMm} mm) ` +
        `into the thinner (${pointMemberThicknessMm} mm)`
    );
  }

  return {
    ok: findings.length === 0,
    findings,
    computed: {
      combinedMm: +combined.toFixed(3),
      penetrationMm: +penetration.toFixed(3),
      protrusionMm: +protrusion.toFixed(3),
      clinched: wantsClinch,
      minEdgeDistanceMm: +minEdgeDistanceMm(headMemberThicknessMm).toFixed(3),
      minEndDistanceMm: +minEndDistanceMm(headMemberThicknessMm).toFixed(3),
      needsLeadHole: needsLeadHole(nailSpec.size),
    },
  };
}

/**
 * Choose the shortest nail from a table that satisfies the rules for a joint.
 * The bill of materials calls this rather than naming a nail directly, so that
 * a change to a board thickness reselects the fastener instead of silently
 * invalidating it.
 *
 * @param {Array} table resolved nails, ascending by length
 * @returns {object} the chosen nail
 */
export function selectNail(table, joint) {
  for (const nailSpec of table) {
    const result = evaluateJoint({ ...joint, nailSpec, clinched: undefined });
    if (result.ok) return nailSpec;
  }
  throw new Error(
    `No nail in the supplied table satisfies S1 for a joint of ` +
      `${joint.throughThicknessMm ?? joint.headMemberThicknessMm} mm into ` +
      `${joint.pointMemberThicknessMm} mm`
  );
}
