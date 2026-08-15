/**
 * THE conversion. There is exactly one, and it lives here.
 *
 * Millimetres are authoritative everywhere in /knowledge. Three.js world units
 * are metres. Nothing else in the codebase is permitted to multiply or divide a
 * length by a scale factor — if you find yourself writing `* 0.001` anywhere,
 * you are writing a bug.
 *
 * Invariant 4 (AGENTS.md): "Geometry is generated from specifications in
 * /knowledge, in millimetres, through one central conversion."
 */

/** 1 world unit = 1 metre. 1 mm = 0.001 world units. */
export const WORLD_UNITS_PER_MM = 0.001;

/** Inverse, for reading a world-space measurement back as a specification. */
export const MM_PER_WORLD_UNIT = 1000;

/**
 * Millimetres -> world units. The only sanctioned length conversion.
 * @param {number} millimetres
 * @returns {number} world units
 */
export function mm(millimetres) {
  if (typeof millimetres !== 'number' || !Number.isFinite(millimetres)) {
    throw new TypeError(`mm() needs a finite number, got ${millimetres}`);
  }
  return millimetres * WORLD_UNITS_PER_MM;
}

/**
 * World units -> millimetres. Used by the inspector and every validation test,
 * so that a measured world position can be compared against a specification
 * without anyone inventing a second scale factor.
 * @param {number} worldUnits
 * @returns {number} millimetres
 */
export function toMm(worldUnits) {
  if (typeof worldUnits !== 'number' || !Number.isFinite(worldUnits)) {
    throw new TypeError(`toMm() needs a finite number, got ${worldUnits}`);
  }
  return worldUnits * MM_PER_WORLD_UNIT;
}

/**
 * A [x, y, z] triple in millimetres -> world units. Returns a plain array so
 * this module stays free of any Three.js import; callers spread it into
 * `.set(...)` or `new Vector3(...)`.
 * @param {[number, number, number]} v
 * @returns {[number, number, number]}
 */
export function mmVec(v) {
  return [mm(v[0]), mm(v[1]), mm(v[2])];
}

/** Degrees -> radians. Specifications state angles in degrees. */
export function deg(degrees) {
  if (typeof degrees !== 'number' || !Number.isFinite(degrees)) {
    throw new TypeError(`deg() needs a finite number, got ${degrees}`);
  }
  return (degrees * Math.PI) / 180;
}

/** Radians -> degrees, for the inspector. */
export function toDeg(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Volume in mm³ -> world units³. Separate function because the exponent is 3,
 * and getting that wrong silently is exactly the class of error this module
 * exists to prevent.
 */
export function mm3(cubicMillimetres) {
  return cubicMillimetres * WORLD_UNITS_PER_MM ** 3;
}

/**
 * Mass of a wooden part, from its volume in mm³ and the species density in
 * kg/m³. Returned in kilograms. Used for material conservation checks
 * (V1-TEST A8) and for gripper payload checks (V1-TEST D29).
 */
export function massKg(volumeMm3, densityKgPerM3) {
  const volumeM3 = volumeMm3 * 1e-9;
  return volumeM3 * densityKgPerM3;
}

/** Inches -> millimetres. Only for transcribing imperial sources; never in geometry. */
export function inchToMm(inches) {
  return inches * 25.4;
}
