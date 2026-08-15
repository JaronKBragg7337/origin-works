/**
 * Nails. Millimetres.
 *
 * A fastener in this project is a real component with a diameter, a length, a
 * head and an axis (V1-TEST F40). It is never a texture and never a decal.
 * These tables are what give it its dimensions.
 *
 * Tables 8-1 and 8-2 are transcribed complete from SOURCES.md S2, the Wood
 * Handbook FPL-GTR-190 chapter 8. That source publishes the values in
 * millimetres directly, so no conversion was performed and no rounding was
 * introduced. The inch values are carried alongside only so the transcription
 * can be checked against the printed table.
 */

/** S2 Table 8-1. Sizes of bright common wire nails. */
export const COMMON_NAILS = Object.freeze([
  Object.freeze({ size: '6d', gauge: '11-1/2', lengthMm: 50.8, diameterMm: 2.87, lengthIn: 2, diameterIn: 0.113 }),
  Object.freeze({ size: '8d', gauge: '10-1/4', lengthMm: 63.5, diameterMm: 3.33, lengthIn: 2.5, diameterIn: 0.131 }),
  Object.freeze({ size: '10d', gauge: '9', lengthMm: 76.2, diameterMm: 3.76, lengthIn: 3, diameterIn: 0.148 }),
  Object.freeze({ size: '12d', gauge: '9', lengthMm: 82.6, diameterMm: 3.76, lengthIn: 3.25, diameterIn: 0.148 }),
  Object.freeze({ size: '16d', gauge: '8', lengthMm: 88.9, diameterMm: 4.11, lengthIn: 3.5, diameterIn: 0.162 }),
  Object.freeze({ size: '20d', gauge: '6', lengthMm: 101.6, diameterMm: 4.88, lengthIn: 4, diameterIn: 0.192 }),
  Object.freeze({ size: '30d', gauge: '5', lengthMm: 114.3, diameterMm: 5.26, lengthIn: 4.5, diameterIn: 0.207 }),
  Object.freeze({ size: '40d', gauge: '4', lengthMm: 127.0, diameterMm: 5.72, lengthIn: 5, diameterIn: 0.225 }),
  Object.freeze({ size: '50d', gauge: '3', lengthMm: 139.7, diameterMm: 6.20, lengthIn: 5.5, diameterIn: 0.244 }),
  Object.freeze({ size: '60d', gauge: '2', lengthMm: 152.4, diameterMm: 6.65, lengthIn: 6, diameterIn: 0.262 }),
]);

/** S2 Table 8-2. Sizes of smooth box nails. */
export const BOX_NAILS = Object.freeze([
  Object.freeze({ size: '3d', gauge: '14-1/2', lengthMm: 31.8, diameterMm: 1.93, lengthIn: 1.25, diameterIn: 0.076 }),
  Object.freeze({ size: '4d', gauge: '14', lengthMm: 38.1, diameterMm: 2.03, lengthIn: 1.5, diameterIn: 0.080 }),
  Object.freeze({ size: '5d', gauge: '14', lengthMm: 44.5, diameterMm: 2.03, lengthIn: 1.75, diameterIn: 0.080 }),
  Object.freeze({ size: '6d', gauge: '12-1/2', lengthMm: 50.8, diameterMm: 2.49, lengthIn: 2, diameterIn: 0.099 }),
  Object.freeze({ size: '7d', gauge: '12-1/2', lengthMm: 57.2, diameterMm: 2.49, lengthIn: 2.25, diameterIn: 0.099 }),
  Object.freeze({ size: '8d', gauge: '11-1/2', lengthMm: 63.5, diameterMm: 2.87, lengthIn: 2.5, diameterIn: 0.113 }),
  Object.freeze({ size: '10d', gauge: '10-1/2', lengthMm: 76.2, diameterMm: 3.25, lengthIn: 3, diameterIn: 0.128 }),
  Object.freeze({ size: '16d', gauge: '10', lengthMm: 88.9, diameterMm: 3.43, lengthIn: 3.5, diameterIn: 0.135 }),
  Object.freeze({ size: '20d', gauge: '9', lengthMm: 101.6, diameterMm: 3.76, lengthIn: 4, diameterIn: 0.148 }),
]);

/**
 * Head diameter is not tabulated in S2. The conventional relation for a bright
 * common wire nail head is a little over twice the shank diameter; we take
 * 2.2 × shank and mark it original. It affects only the head geometry and the
 * "does the head pull through" check, never a penetration depth.
 */
export const HEAD = Object.freeze({
  origin: 'original',
  diameterRatio: 2.2,
  thicknessRatio: 0.35,
  why: 'S2 tabulates length and shank diameter only. Head is proportioned, not sourced.',
});

/**
 * Point geometry. A diamond point is conventionally about 1.5 shank diameters
 * long. S1 rule 6 refers to blunting diamond points to reduce splitting, which
 * confirms the point type but not its length.
 */
export const POINT = Object.freeze({
  origin: 'original',
  lengthRatio: 1.5,
  type: 'diamond',
  why: 'Point type from S1 rule 6; length proportioned.',
});

/**
 * Lead-hole diameter as a fraction of shank diameter. S2: "Nails driven into
 * lead holes with a diameter slightly smaller (approximately 90%) than the nail
 * shank have somewhat greater withdrawal resistance."
 *
 * S1 says prebored holes "should be about the same diameter as the nail shank"
 * and recommends predrilling for 20d and larger. The two agree on when, and
 * differ slightly on how much; we take S2's 90 % because it is the more recent
 * publication and the more specific number.
 */
export const LEAD_HOLE = Object.freeze({
  source: 'S2',
  diameterRatio: 0.9,
  requiredFromSize: '20d',
  requiredFromSizeSource: 'S1',
});

const BY_TYPE = { common: COMMON_NAILS, box: BOX_NAILS };

/**
 * Look up a nail. Throws rather than returning undefined, because a missing
 * fastener must fail loudly at spec load, not silently at assembly time.
 * @param {'common'|'box'} type
 * @param {string} size e.g. '8d'
 */
export function nail(type, size) {
  const table = BY_TYPE[type];
  if (!table) throw new Error(`Unknown nail type "${type}"`);
  const found = table.find((n) => n.size === size);
  if (!found) throw new Error(`No ${type} nail of size ${size} in S2 tables`);
  return Object.freeze({
    ...found,
    type,
    id: `NAIL_${type.toUpperCase()}_${size.toUpperCase()}`,
    headDiameterMm: +(found.diameterMm * HEAD.diameterRatio).toFixed(3),
    headThicknessMm: +(found.diameterMm * HEAD.thicknessRatio).toFixed(3),
    pointLengthMm: +(found.diameterMm * POINT.lengthRatio).toFixed(3),
    leadHoleDiameterMm: +(found.diameterMm * LEAD_HOLE.diameterRatio).toFixed(3),
    source: 'S2',
  });
}

/** Every nail this project can use, resolved. Used by the validator. */
export function allNails() {
  return [
    ...COMMON_NAILS.map((n) => nail('common', n.size)),
    ...BOX_NAILS.map((n) => nail('box', n.size)),
  ];
}

/** Steel, for nail mass. Affects assembly mass, not geometry. */
export const STEEL = Object.freeze({
  origin: 'original',
  densityKgPerM3: 7850,
  colorHex: 0x8a8f96,
});

/** Volume of a nail shank plus head, mm³. Point taper is ignored: under 1 %. */
export function nailVolumeMm3(n) {
  const shank = Math.PI * (n.diameterMm / 2) ** 2 * n.lengthMm;
  const head = Math.PI * (n.headDiameterMm / 2) ** 2 * n.headThicknessMm;
  return shank + head;
}
