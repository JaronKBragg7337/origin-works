/**
 * Lumber stock. Millimetres.
 *
 * Dressed sizes are the minimum dressed **dry** sizes of PS 20, the American
 * Softwood Lumber Standard (SOURCES.md S3). These are the sizes a board
 * actually is, as opposed to the nominal size it is sold by. A "2×4" is
 * 38.1 × 88.9 mm.
 *
 * Divergence from S1 (AH-252): the 1964 crate manual's glossary gives a dressed
 * 2×4 as 1⅝ × 3⅝ in (41.3 × 92.1 mm), which was the standard at the time. The
 * standard changed. We use the current PS 20 sizes and record the difference
 * here rather than silently picking one.
 */

import { inchToMm } from '../units.js';

/** Nominal-to-dressed, PS 20 minimum dressed dry. Source S3. */
export const DRESSED_MM = Object.freeze({
  source: 'S3',
  thickness: Object.freeze({ 1: 19.0, 2: 38.1 }),
  width: Object.freeze({ 2: 38.1, 3: 63.5, 4: 88.9, 6: 139.7, 8: 184.2 }),
  supersedes: Object.freeze({
    note: 'S1 (AH-252, 1964) gives dressed 2×4 as 41.3 × 92.1 mm. Superseded.',
    ah252TwoByFourMm: [inchToMm(1.625), inchToMm(3.625)],
  }),
});

/**
 * The stock profiles this project buys. A profile is a cross-section; a piece
 * of stock is a profile plus a length plus an id.
 *
 * `grain` is +X in the profile's local frame: the long axis. It matters because
 * nail holding power in end grain drops to about half its side-grain value
 * (S1, p. 16), so the process must never present an end-grain face to a
 * fastener that the specification expects to hold.
 */
export const PROFILES = Object.freeze({
  BOARD_1X4: Object.freeze({
    id: 'BOARD_1X4',
    source: 'S3',
    nominal: '1×4',
    thicknessMm: 19.0,
    widthMm: 88.9,
    grainAxis: 'x',
    role: 'cleats, struts, lid battens',
  }),
  BOARD_1X6: Object.freeze({
    id: 'BOARD_1X6',
    source: 'S3',
    nominal: '1×6',
    thicknessMm: 19.0,
    widthMm: 139.7,
    grainAxis: 'x',
    role: 'sheathing, floorboards',
  }),
  BOARD_2X4: Object.freeze({
    id: 'BOARD_2X4',
    source: 'S3',
    nominal: '2×4',
    thicknessMm: 38.1,
    widthMm: 88.9,
    grainAxis: 'x',
    role: 'reserved; not used by crate OW-C1',
  }),
  TIMBER_4X4: Object.freeze({
    id: 'TIMBER_4X4',
    source: 'S3',
    nominal: '4×4',
    thicknessMm: 88.9,
    widthMm: 88.9,
    grainAxis: 'x',
    role: 'skids and headers',
    why:
      'Square section, so it presents 88.9 mm of nailing depth both ' +
      'vertically (floorboards nailed down into it) and horizontally (side ' +
      'sheathing nailed in to it). A 2×4 presents 88.9 mm on one axis only, ' +
      'and S1 rule 5 cannot then be satisfied on the other.',
  }),
});

/**
 * Stock lengths delivered to the cut shop. 8 ft and 10 ft are the commodity
 * lengths; both are carried so the cut planner has a real choice to make and
 * offcut is a real consequence of that choice rather than a fixed number.
 */
export const STOCK_LENGTHS_MM = Object.freeze({
  origin: 'original',
  why: 'Commodity softwood lengths, 8 ft and 10 ft, converted exactly.',
  lengths: Object.freeze([
    Object.freeze({ id: 'L8FT', lengthMm: inchToMm(96), label: '8 ft' }),
    Object.freeze({ id: 'L10FT', lengthMm: inchToMm(120), label: '10 ft' }),
  ]),
});

/**
 * Species. Density drives mass, which drives the gripper payload check and the
 * material-conservation check.
 *
 * Douglas-fir specific gravity and the density relation are from S2 chapter 8's
 * companion chapters; the value used here is the conventional 12 % moisture
 * content density for Douglas-fir (Coast), which S1 also groups with southern
 * yellow pine and western larch for nail holding.
 */
export const SPECIES = Object.freeze({
  DOUGLAS_FIR: Object.freeze({
    id: 'DOUGLAS_FIR',
    source: 'S1',
    label: 'Douglas-fir (Coast)',
    densityKgPerM3: 510,
    densityNote: 'At 12 % moisture content.',
    /** S1 groups this species for nail withdrawal: P = 1,500 D^1.5 lb/in. */
    nailWithdrawalCoefficientLbPerIn: 1500,
    /** Nails hold about half as well in end grain. S1 p. 16. */
    endGrainHoldingFactor: 0.5,
    colorHexDry: 0xc8a878,
    colorHexCut: 0xe4cfa8,
  }),
});

/** The only species V1 uses. Kept as a named export so the process cannot drift. */
export const DEFAULT_SPECIES = SPECIES.DOUGLAS_FIR;

/**
 * Cross-sectional area of a profile, mm². Used for volume, mass and the
 * material balance.
 */
export function profileAreaMm2(profile) {
  return profile.thicknessMm * profile.widthMm;
}

/** Volume of a piece of a given profile at a given length, mm³. */
export function pieceVolumeMm3(profile, lengthMm) {
  return profileAreaMm2(profile) * lengthMm;
}
