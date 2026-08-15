/**
 * Crosscut saw OW-S1. Millimetres.
 *
 * An up-cut crosscut saw: the stock lies on a table against a fence, a clamp
 * comes down, and the blade rises through a slot in the table, crosses the
 * stock, and retracts. This arrangement is chosen because the cut plane is
 * unambiguous — it is the plane of the blade — which is what V1-TEST C20 and
 * C22 need to be checkable.
 *
 * Blade dimensions are from SOURCES.md S6 (a real 350 mm industrial blade).
 * Everything else is original and marked so.
 */

import { GROUPS, OPERATIONS } from '../collision.js';

export const BLADE = Object.freeze({
  source: 'S6',
  diameterMm: 350.0,
  /** The number that governs material accounting. V1-TEST A5. */
  kerfMm: 3.5,
  plateThicknessMm: 2.5,
  teeth: 84,
  boreMm: 30.0,
  /** Carbide tip projects past the plate; this is what makes kerf > plate. */
  tipProjectionPerSideMm: 0.5,
});

export const SPINDLE = Object.freeze({
  origin: 'original',
  why:
    'Rim speed for carbide-tipped blades in softwood runs 50-80 m/s. ' +
    '3000 rpm on a 350 mm blade gives pi*0.35*3000/60 = 55.0 m/s, inside ' +
    'that band. The rpm is chosen to land there; the arithmetic is checked ' +
    'by the validator.',
  rpm: 3000,
  rotationAxis: 'z',
  spinUpMs: 900,
  spinDownMs: 1400,
  /** V1-TEST C21: the blade rotates while cutting. This is the threshold. */
  minRpmToCut: 2700,
});

/** Rim speed, m/s. Derived, never stored. */
export function rimSpeedMs() {
  return (Math.PI * (BLADE.diameterMm / 1000) * SPINDLE.rpm) / 60;
}

export const TABLE = Object.freeze({
  origin: 'original',
  why: 'Table height set to standard bench working height; slot sized to clear the blade.',
  heightMm: 900.0,
  widthMm: 800.0,
  lengthMm: 3400.0,
  bladeSlotWidthMm: 12.0,
  /** Fence is the datum for every cut. A cut length is measured from here. */
  fenceOffsetFromSlotMm: 0.0,
  fenceHeightMm: 120.0,
  fenceFaceAxis: 'z',
});

/**
 * Blade travel. The blade rises from fully housed to fully through and back.
 * `throughClearanceMm` is what makes V1-TEST C20 answerable: at full stroke the
 * blade top is above the top of the thickest stock by this margin.
 */
export const STROKE = Object.freeze({
  origin: 'original',
  housedCentreYMm: 900.0 - 175.0 - 40.0, // blade fully below the table
  throughCentreYMm: 900.0 + 40.0,
  throughClearanceMm: 25.0,
  feedRateMmPerS: 120.0,
  retractRateMmPerS: 260.0,
  feedWhy:
    'Original. 120 mm/s through a 139.7 mm board is 1.16 s of contact, which ' +
    'is a plausible production rate and long enough to be visibly a cut ' +
    'rather than a flash.',
});

/**
 * Work-holding. V1-TEST C24: "Stock is supported or fixtured during the cut,
 * not floating." These are the objects that must be in contact for a cut to be
 * legal to start.
 */
export const FIXTURING = Object.freeze({
  origin: 'original',
  supports: Object.freeze([
    Object.freeze({ id: 'TABLE_INFEED', xMm: -900, spanMm: 1400, topYMm: 900.0 }),
    Object.freeze({ id: 'TABLE_OUTFEED', xMm: 900, spanMm: 1400, topYMm: 900.0 }),
  ]),
  clamp: Object.freeze({
    id: 'CLAMP_1',
    /** Comes down onto the stock this far from the cut plane, infeed side. */
    offsetFromCutPlaneMm: 180.0,
    padWidthMm: 90.0,
    padLengthMm: 60.0,
    openYMm: 1180.0,
    closeForceN: 800.0,
    travelMmPerS: 200.0,
    /** Clamp must be closed on the stock before the blade may rise. */
    requiredBeforeCut: true,
  }),
  /** Offcut catcher. V1-TEST A6: offcut is a real object, not a deletion. */
  offcutBin: Object.freeze({
    id: 'OFFCUT_BIN',
    positionMm: [1500, 0, -600],
    innerMm: [900, 500, 700],
  }),
});

/**
 * Guarding. Invariant 6: if it looks functional, it works. The guard is
 * interlocked — it physically moves, and the cut cannot start while it is open.
 */
export const GUARDING = Object.freeze({
  origin: 'original',
  why: 'Machine guarding is standard on production saws; modelled as operable.',
  hood: Object.freeze({
    id: 'BLADE_HOOD',
    closedRotationDeg: 0,
    openRotationDeg: 62,
    travelMs: 500,
    interlocked: true,
  }),
  lightCurtain: Object.freeze({
    id: 'LIGHT_CURTAIN',
    planeXMm: -350.0,
    heightMm: 1400.0,
    stopsCycleWhenBroken: true,
  }),
});

/**
 * Controls. Invariant 6 again: these are modelled as operable, so they operate.
 * Positions are on the machine's local frame.
 */
export const CONTROLS = Object.freeze({
  origin: 'original',
  items: Object.freeze([
    Object.freeze({ id: 'BTN_CYCLE_START', kind: 'momentary', positionMm: [-420, 1050, 430], diameterMm: 30, colorHex: 0x2e9e4f, action: 'startCycle' }),
    Object.freeze({ id: 'BTN_ESTOP', kind: 'latching', positionMm: [-360, 1050, 430], diameterMm: 40, colorHex: 0xcc2222, action: 'emergencyStop' }),
    Object.freeze({ id: 'SEL_MODE', kind: 'selector', positionMm: [-300, 1050, 430], positions: ['manual', 'auto'], action: 'setMode' }),
    Object.freeze({ id: 'LAMP_RUN', kind: 'lamp', positionMm: [-420, 1110, 430], diameterMm: 22, colorHex: 0xffc040, boundTo: 'spindleRunning' }),
  ]),
});

/** Interaction points: the precise regions that mean something. */
export const INTERACTION = Object.freeze({
  origin: 'original',
  points: Object.freeze([
    Object.freeze({ id: 'INFEED_PRESENT', kind: 'work-surface', positionMm: [-700, 900, 0], normal: [0, 1, 0], acceptsGroup: GROUPS.STOCK }),
    Object.freeze({ id: 'CUT_DATUM', kind: 'datum', positionMm: [0, 900, 0], normal: [1, 0, 0], note: 'Cut plane. Lengths are measured from the fence stop to here.' }),
    Object.freeze({ id: 'OUTFEED_PICK', kind: 'grasp-presentation', positionMm: [700, 900, 0], normal: [0, 1, 0], note: 'Where the robot may take the finished piece.' }),
  ]),
});

/** Collision representation: boxes, not the visual mesh. */
export const COLLISION = Object.freeze({
  group: GROUPS.MACHINE,
  boxes: Object.freeze([
    Object.freeze({ id: 'BODY', centreMm: [0, 450, 0], sizeMm: [1200, 900, 800] }),
    Object.freeze({ id: 'TABLE', centreMm: [0, 880, 0], sizeMm: [3400, 40, 800] }),
    Object.freeze({ id: 'FENCE', centreMm: [0, 960, 390], sizeMm: [3400, 120, 20] }),
    Object.freeze({ id: 'COLUMN', centreMm: [0, 1300, 460], sizeMm: [420, 800, 260] }),
  ]),
  /** The blade is a TOOL, not part of the machine body. */
  tool: Object.freeze({
    id: 'BLADE',
    group: GROUPS.TOOL,
    shape: 'cylinder',
    diameterMm: BLADE.diameterMm,
    thicknessMm: BLADE.kerfMm,
    axis: 'z',
    permittedOperation: OPERATIONS.CUT.id,
  }),
});

/**
 * The kerf region: the only volume the blade may occupy inside the stock, and
 * the volume removed from the material balance. A slab of kerf thickness on the
 * cut plane, spanning the blade's engagement.
 */
export function kerfRegion(cutPlaneXMm, stockWidthMm, stockThicknessMm) {
  return Object.freeze({
    kind: 'kerf-slab',
    centreMm: [cutPlaneXMm, TABLE.heightMm + stockThicknessMm / 2, 0],
    sizeMm: [BLADE.kerfMm, stockThicknessMm, stockWidthMm],
  });
}

/** Volume of material a cut destroys, mm³. This is what A5 and A7 account for. */
export function kerfVolumeMm3(sectionAreaMm2) {
  return sectionAreaMm2 * BLADE.kerfMm;
}

export const SAW = Object.freeze({
  id: 'OW-S1',
  label: 'Crosscut saw',
  BLADE, SPINDLE, TABLE, STROKE, FIXTURING, GUARDING, CONTROLS, INTERACTION, COLLISION,
});
export default SAW;
