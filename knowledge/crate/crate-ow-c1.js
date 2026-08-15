/**
 * Crate OW-C1. Millimetres.
 *
 * A lumber-sheathed, cleated wooden shipping crate. It is geometrically simple
 * on purpose: six flat panels of boards over a frame of struts, on a skid base.
 * The depth of this project is in the manufacturing, not in the shape.
 *
 * The construction pattern is from SOURCES.md S1 (USDA Wood Crate Design
 * Manual): sheathing over a frame, panels fabricated first and assembled after,
 * the side lapping the end at the corner so at least one set of nails is always
 * in lateral resistance. The *dimensions* are original — S1's crates start at
 * 300 lb net load and run to 12 ft, which is far larger than V1 needs.
 *
 * ---------------------------------------------------------------------------
 * Why the frame members are what they are
 *
 * S1 rule 5 requires a 10d-or-smaller nail to penetrate 2 to 2.5 times the
 * thickness of the piece holding its head. Sheathing is 19.0 mm, so every
 * assembly nail needs 38.0 to 47.5 mm of penetration and must not come out the
 * far side. The only standard nail in that window is the 8d common at 63.5 mm,
 * which gives 44.5 mm — and it needs a member at least 44.5 mm deep to land in.
 *
 * That single constraint decides the frame:
 *   - struts and rails are 1×4 **on edge**, presenting 88.9 mm of depth;
 *   - skids and headers are 4×4, because they are nailed into on two
 *     perpendicular axes and a 2×4 only offers 88.9 mm on one of them.
 *
 * Nothing here was sized by eye. Where a number is chosen rather than derived,
 * it says so.
 * ---------------------------------------------------------------------------
 *
 * Coordinate frame: X = length, Y = height, Z = width.
 * Origin at the centre of the footprint, on the ground (y = 0).
 */

import { PROFILES, DEFAULT_SPECIES, pieceVolumeMm3 } from '../material/lumber.js';
import { nail } from '../fastener/nails.js';
import { GROUPS } from '../collision.js';

const P = PROFILES;

/* ------------------------------------------------------------------ *
 * Derived dimensions. Every one of these is arithmetic on the members,
 * not a typed-in number. Change a board width and the crate changes.
 * ------------------------------------------------------------------ */

const SHEATHING = P.BOARD_1X6;   // 19.0 x 139.7
const FRAME = P.BOARD_1X4;       // 19.0 x 88.9, used on edge
const SKID = P.TIMBER_4X4;       // 88.9 x 88.9

/** Boards in a wall, and therefore the wall height. */
export const SHEATHING_COURSES = 4;
/** Boards across the deck, and therefore the crate length. */
export const DECK_BOARDS = 6;

export const DIM = Object.freeze({
  /** X: six deck/lid boards laid side by side. Derived. */
  lengthMm: DECK_BOARDS * SHEATHING.widthMm,                 // 838.2
  /** Z: chosen, then everything else follows from it. */
  widthMm: 800.0,
  widthOrigin: 'original',
  widthWhy:
    'Chosen so the crate sits inside a 1219 x 1016 mm pallet with margin ' +
    'on both axes, and so the end panel is wide enough to need a centre strut.',
  /** Y of the wall panels: four sheathing courses. Derived. */
  wallHeightMm: SHEATHING_COURSES * SHEATHING.widthMm,        // 558.8

  skidHeightMm: SKID.thicknessMm,                             // 88.9
  deckThicknessMm: SHEATHING.thicknessMm,                     // 19.0
  lidThicknessMm: SHEATHING.thicknessMm,                      // 19.0
});

/** Floor deck top surface. Where everything inside the crate rests. */
export const FLOOR_Y_MM = DIM.skidHeightMm + DIM.deckThicknessMm;   // 107.9
/** Overall crate height, lid included. */
export const HEIGHT_MM = DIM.wallHeightMm + DIM.lidThicknessMm;     // 577.8

/** Panel thickness at a strut: sheathing plus the strut standing on edge. */
export const SIDE_PANEL_THICKNESS_MM = SHEATHING.thicknessMm + FRAME.widthMm;  // 107.9
/** Panel thickness at the top rail, which lies with its 19 mm face inward. */
export const TOP_RAIL_THICKNESS_MM = SHEATHING.thicknessMm + FRAME.thicknessMm; // 38.0

/**
 * The end panel fits between the inner faces of the side panels' *sheathing*,
 * not between their struts. That is the S1 corner: the side sheathing laps the
 * end panel's corner strut, so the corner nails act in lateral resistance.
 */
export const END_PANEL_WIDTH_MM = DIM.widthMm - 2 * SHEATHING.thicknessMm;  // 762.0

/** Vertical struts run from the floor deck to the underside of the top rail. */
export const STRUT_HEIGHT_MM = DIM.wallHeightMm - FRAME.widthMm - FLOOR_Y_MM; // 362.0

/** The clear opening the lid cleats drop into, between the side top rails. */
export const LID_OPENING_Z_MM = DIM.widthMm - 2 * TOP_RAIL_THICKNESS_MM;   // 724.0
/** Lid cleat length, sized to leave a real clearance in that opening. */
export const LID_CLEAT_LENGTH_MM = LID_OPENING_Z_MM - 10.0;                // 714.0

/** Headers span between the skids. */
export const HEADER_LENGTH_MM = DIM.widthMm - 2 * SKID.widthMm;            // 622.2

/* ------------------------------------------------------------------ *
 * Bill of materials. 48 wooden parts.
 * `qty` x `lengthMm` of `profile`, in the sub-assembly named by `panel`.
 * ------------------------------------------------------------------ */

export const BOM = Object.freeze([
  // --- base ---------------------------------------------------------
  Object.freeze({ id: 'BASE_SKID', panel: 'BASE', role: 'skid', profile: SKID, qty: 2, lengthMm: DIM.lengthMm, axis: 'x' }),
  Object.freeze({ id: 'BASE_HEADER', panel: 'BASE', role: 'header', profile: SKID, qty: 2, lengthMm: HEADER_LENGTH_MM, axis: 'z' }),
  Object.freeze({ id: 'BASE_FLOOR', panel: 'BASE', role: 'floorboard', profile: SHEATHING, qty: DECK_BOARDS, lengthMm: DIM.widthMm, axis: 'z' }),

  // --- side panels (2 off, 7 parts each) ----------------------------
  Object.freeze({ id: 'SIDE_SHEATH', panel: 'SIDE', role: 'sheathing', profile: SHEATHING, qty: SHEATHING_COURSES * 2, lengthMm: DIM.lengthMm, axis: 'x' }),
  Object.freeze({ id: 'SIDE_RAIL', panel: 'SIDE', role: 'top rail', profile: FRAME, qty: 2, lengthMm: DIM.lengthMm, axis: 'x', onEdge: false }),
  Object.freeze({ id: 'SIDE_STRUT', panel: 'SIDE', role: 'intermediate strut', profile: FRAME, qty: 4, lengthMm: STRUT_HEIGHT_MM, axis: 'y', onEdge: true }),

  // --- end panels (2 off, 8 parts each) -----------------------------
  Object.freeze({ id: 'END_SHEATH', panel: 'END', role: 'sheathing', profile: SHEATHING, qty: SHEATHING_COURSES * 2, lengthMm: END_PANEL_WIDTH_MM, axis: 'z' }),
  Object.freeze({ id: 'END_RAIL', panel: 'END', role: 'top rail', profile: FRAME, qty: 2, lengthMm: END_PANEL_WIDTH_MM, axis: 'z', onEdge: false }),
  Object.freeze({ id: 'END_CORNER_STRUT', panel: 'END', role: 'corner strut', profile: FRAME, qty: 4, lengthMm: STRUT_HEIGHT_MM, axis: 'y', onEdge: true }),
  Object.freeze({ id: 'END_CENTRE_STRUT', panel: 'END', role: 'centre strut', profile: FRAME, qty: 2, lengthMm: STRUT_HEIGHT_MM, axis: 'y', onEdge: true }),

  // --- lid (8 parts) ------------------------------------------------
  Object.freeze({ id: 'LID_SHEATH', panel: 'LID', role: 'sheathing', profile: SHEATHING, qty: DECK_BOARDS, lengthMm: DIM.widthMm, axis: 'z' }),
  Object.freeze({ id: 'LID_CLEAT', panel: 'LID', role: 'locating cleat', profile: FRAME, qty: 2, lengthMm: LID_CLEAT_LENGTH_MM, axis: 'z', onEdge: true }),
]);

export const PART_COUNT = BOM.reduce((n, b) => n + b.qty, 0);

/* ------------------------------------------------------------------ *
 * Joints. Each declares the members it connects, which S1 rule justifies
 * its fastener, and how many fasteners it uses. The validator recomputes
 * every one of these against fastener/nailing-rules.js.
 * ------------------------------------------------------------------ */

/**
 * Spacing for a run of nails along two members whose grain is parallel.
 * S1 rule 10 gives 76.2 mm for plywood to struts; S1 rules 12-13 give 406.4 mm
 * for laminating 1-inch and 2-inch members. Lumber sheathing to a frame sits
 * between the two. 150 mm is chosen; it is not from a source.
 */
export const PARALLEL_RUN_SPACING_MM = 150.0;
export const PARALLEL_RUN_SPACING_ORIGIN = 'original';

export const JOINTS = Object.freeze([
  Object.freeze({
    id: 'J1_SHEATH_TO_STRUT',
    phase: 'fabrication',
    label: 'sheathing to strut',
    headMemberThicknessMm: SHEATHING.thicknessMm,   // 19.0
    throughThicknessMm: SHEATHING.thicknessMm,      // 19.0
    pointMemberThicknessMm: FRAME.widthMm,          // 88.9, strut on edge
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 rule 5 (penetration) + rule 15 (two nails per crossing)',
    nailsPerCrossing: 2,
    crossings: SHEATHING_COURSES * 2 * 2 + SHEATHING_COURSES * 3 * 2, // sides: 4x2 struts x2 panels; ends: 4x3 struts x2 panels
    crossingsNote: 'sides 4 courses x 2 struts x 2 panels = 16; ends 4 x 3 x 2 = 24',
  }),

  Object.freeze({
    id: 'J2_SHEATH_TO_RAIL',
    phase: 'fabrication',
    label: 'top sheathing course to top rail, clinched',
    headMemberThicknessMm: SHEATHING.thicknessMm,   // 19.0
    throughThicknessMm: SHEATHING.thicknessMm,      // 19.0
    pointMemberThicknessMm: FRAME.thicknessMm,      // 19.0, rail laid flat
    manner: 'flatwise',
    nail: nail('box', '5d'),
    rule: 'S1 rule 4 (clinch, combined 38.0 mm <= 76.2 mm) + rule 11 (one row, contact 19.0 mm <= 50.8 mm)',
    clinched: true,
    rows: 1,
    runLengthsMm: [DIM.lengthMm, DIM.lengthMm, END_PANEL_WIDTH_MM, END_PANEL_WIDTH_MM],
    spacingMm: PARALLEL_RUN_SPACING_MM,
  }),

  Object.freeze({
    id: 'J3_BASE_FLOOR_TO_SKID',
    phase: 'fabrication',
    label: 'floorboard down into skid and header',
    headMemberThicknessMm: SHEATHING.thicknessMm,   // 19.0
    throughThicknessMm: SHEATHING.thicknessMm,      // 19.0
    pointMemberThicknessMm: SKID.thicknessMm,       // 88.9
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 rule 5 + rule 11 (two rows, contact 88.9 mm)',
    rows: 2,
    runLengthsMm: [DIM.lengthMm, DIM.lengthMm, HEADER_LENGTH_MM, HEADER_LENGTH_MM],
    spacingMm: PARALLEL_RUN_SPACING_MM,
  }),

  Object.freeze({
    id: 'J4_LID_SHEATH_TO_CLEAT',
    phase: 'fabrication',
    label: 'lid sheathing to locating cleat',
    headMemberThicknessMm: SHEATHING.thicknessMm,
    throughThicknessMm: SHEATHING.thicknessMm,
    pointMemberThicknessMm: FRAME.widthMm,          // 88.9, cleat on edge
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 rule 5 + rule 15',
    nailsPerCrossing: 2,
    crossings: DECK_BOARDS * 2,                     // 6 boards x 2 cleats
  }),

  Object.freeze({
    id: 'J5_WALL_TO_BASE',
    phase: 'assembly',
    label: 'side and end sheathing into skid and header',
    headMemberThicknessMm: SHEATHING.thicknessMm,
    throughThicknessMm: SHEATHING.thicknessMm,
    pointMemberThicknessMm: SKID.widthMm,           // 88.9 on the horizontal axis
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 rule 5 + rule 11 (two rows, contact 88.9 mm)',
    rows: 2,
    runLengthsMm: [DIM.lengthMm, DIM.lengthMm, HEADER_LENGTH_MM, HEADER_LENGTH_MM],
    spacingMm: PARALLEL_RUN_SPACING_MM,
    note:
      'The sheathing runs down past the floor deck to y = 0, covering the ' +
      'skid, which is what gives this joint a face to nail into. S1: "the ' +
      'bottom projection of the sheathing corresponds with the depth of skids".',
  }),

  Object.freeze({
    id: 'J6_SIDE_TO_END_CORNER',
    phase: 'assembly',
    label: 'side sheathing into the end panel corner strut',
    headMemberThicknessMm: SHEATHING.thicknessMm,
    throughThicknessMm: SHEATHING.thicknessMm,
    pointMemberThicknessMm: FRAME.widthMm,          // 88.9, corner strut on edge
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 p.44 corner detail + rule 5 + rule 11 (one row, contact 19.0 mm)',
    rows: 1,
    runLengthsMm: [STRUT_HEIGHT_MM, STRUT_HEIGHT_MM, STRUT_HEIGHT_MM, STRUT_HEIGHT_MM],
    spacingMm: PARALLEL_RUN_SPACING_MM,
    note:
      'Four corners, one strut each. This is the joint S1 describes as ' +
      'putting at least one set of nails in lateral resistance.',
  }),

  Object.freeze({
    id: 'J7_LID_TO_WALLS',
    phase: 'assembly',
    label: 'lid sheathing down into the wall top rails',
    headMemberThicknessMm: SHEATHING.thicknessMm,
    throughThicknessMm: SHEATHING.thicknessMm,
    pointMemberThicknessMm: FRAME.widthMm,          // 88.9, rail depth in Y
    manner: 'flatwise',
    nail: nail('common', '8d'),
    rule: 'S1 rule 5 + rule 11 (one row, contact 19.0 mm)',
    rows: 1,
    runLengthsMm: [DIM.lengthMm, DIM.lengthMm, END_PANEL_WIDTH_MM, END_PANEL_WIDTH_MM],
    spacingMm: PARALLEL_RUN_SPACING_MM,
    note: 'The last joint made. Nothing is fastened to it afterwards.',
  }),
]);

/** Nails in a joint. Derived from the geometry, never typed in. */
export function nailCount(joint) {
  if (joint.crossings !== undefined) {
    return joint.crossings * joint.nailsPerCrossing;
  }
  const perRun = (lengthMm) => Math.floor(lengthMm / joint.spacingMm) + 1;
  return joint.runLengthsMm.reduce((n, l) => n + perRun(l) * joint.rows, 0);
}

export const TOTAL_NAILS = JOINTS.reduce((n, j) => n + nailCount(j), 0);

/* ------------------------------------------------------------------ *
 * Assembly order. V1-TEST G52: nothing is fastened to something not yet
 * present. Each step names its prerequisites, and the validator walks
 * the list checking that every prerequisite appears earlier.
 * ------------------------------------------------------------------ */

export const ASSEMBLY_ORDER = Object.freeze([
  Object.freeze({ step: 1, produces: 'BASE', consumes: ['BASE_SKID', 'BASE_HEADER', 'BASE_FLOOR'], joints: ['J3_BASE_FLOOR_TO_SKID'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 2, produces: 'SIDE_A', consumes: ['SIDE_SHEATH', 'SIDE_RAIL', 'SIDE_STRUT'], joints: ['J1_SHEATH_TO_STRUT', 'J2_SHEATH_TO_RAIL'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 3, produces: 'SIDE_B', consumes: ['SIDE_SHEATH', 'SIDE_RAIL', 'SIDE_STRUT'], joints: ['J1_SHEATH_TO_STRUT', 'J2_SHEATH_TO_RAIL'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 4, produces: 'END_A', consumes: ['END_SHEATH', 'END_RAIL', 'END_CORNER_STRUT', 'END_CENTRE_STRUT'], joints: ['J1_SHEATH_TO_STRUT', 'J2_SHEATH_TO_RAIL'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 5, produces: 'END_B', consumes: ['END_SHEATH', 'END_RAIL', 'END_CORNER_STRUT', 'END_CENTRE_STRUT'], joints: ['J1_SHEATH_TO_STRUT', 'J2_SHEATH_TO_RAIL'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 6, produces: 'LID', consumes: ['LID_SHEATH', 'LID_CLEAT'], joints: ['J4_LID_SHEATH_TO_CLEAT'], stage: 'PANEL_SHOP' }),
  Object.freeze({ step: 7, produces: 'CRATE_OPEN', consumes: ['BASE', 'END_A', 'END_B'], joints: ['J5_WALL_TO_BASE'], stage: 'CRATE_SHOP', why: 'Ends go on first: the sides lap them, so they must already stand.' }),
  Object.freeze({ step: 8, produces: 'CRATE_WALLED', consumes: ['CRATE_OPEN', 'SIDE_A', 'SIDE_B'], joints: ['J5_WALL_TO_BASE', 'J6_SIDE_TO_END_CORNER'], stage: 'CRATE_SHOP' }),
  Object.freeze({ step: 9, produces: 'CRATE_CLOSED', consumes: ['CRATE_WALLED', 'LID'], joints: ['J7_LID_TO_WALLS'], stage: 'CRATE_SHOP' }),
]);

/* ------------------------------------------------------------------ *
 * Mass, volume, and the things that get checked against the world.
 * ------------------------------------------------------------------ */

export function woodVolumeMm3() {
  return BOM.reduce((v, b) => v + b.qty * pieceVolumeMm3(b.profile, b.lengthMm), 0);
}

export function totalCutLengthMm() {
  return BOM.reduce((l, b) => l + b.qty * b.lengthMm, 0);
}

/** Footprint, for the pallet and truck-bed checks. */
export const FOOTPRINT_MM = Object.freeze({
  lengthMm: DIM.lengthMm,
  widthMm: DIM.widthMm,
  heightMm: HEIGHT_MM,
});

/** Clear internal volume, ignoring the struts that intrude at intervals. */
export const INTERNAL_MM = Object.freeze({
  lengthMm: DIM.lengthMm - 2 * TOP_RAIL_THICKNESS_MM,
  widthMm: DIM.widthMm - 2 * SIDE_PANEL_THICKNESS_MM,
  heightMm: DIM.wallHeightMm - FLOOR_Y_MM,
  note: 'Width is measured at the struts, which are the tightest point.',
});

export const COLLISION = Object.freeze({
  group: GROUPS.ASSEMBLY,
  representation: 'per-part-boxes',
  representationWhy:
    'Invariant 3: the hierarchy survives. A single crate-shaped box would ' +
    'make every component un-addressable, which is the failure this project ' +
    'exists to avoid. The crate has a bounding box for broad-phase, and every ' +
    'part keeps its own box for everything else.',
  broadPhaseBoxMm: [DIM.lengthMm, HEIGHT_MM, DIM.widthMm],
});

export const INTERACTION = Object.freeze({
  points: Object.freeze([
    Object.freeze({ id: 'LIFT_UNDER_SKID_A', kind: 'fork-pocket', note: 'Between skid and floor deck; forks go under the whole pallet, not the crate.' }),
    Object.freeze({ id: 'LID_SEAT', kind: 'insertion-fit', clearancePerSideMm: (LID_OPENING_Z_MM - LID_CLEAT_LENGTH_MM) / 2 }),
    Object.freeze({ id: 'MARKING_FACE', kind: 'surface', note: 'S1: at least one surface dressed and placed outside to receive marking.' }),
  ]),
});

export const CRATE = Object.freeze({
  id: 'OW-C1',
  label: 'Lumber-sheathed cleated crate',
  species: DEFAULT_SPECIES,
  source: 'S1',
  sourceNote: 'Construction pattern from S1. Dimensions original.',
  DIM, BOM, JOINTS, ASSEMBLY_ORDER, FOOTPRINT_MM, INTERNAL_MM, COLLISION, INTERACTION,
  PART_COUNT, TOTAL_NAILS, HEIGHT_MM, FLOOR_Y_MM,
});
export default CRATE;
