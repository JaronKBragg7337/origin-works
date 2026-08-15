/**
 * The specification layer, assembled.
 *
 * Import from here. Nothing outside /knowledge should reach into a sub-module
 * for a number, because that is how a second copy of a number gets made.
 */

export * as units from './units.js';
export { TOLERANCES, within, overlap1d } from './tolerances.js';
export * as collision from './collision.js';

export * as lumber from './material/lumber.js';
export * as nails from './fastener/nails.js';
export * as nailingRules from './fastener/nailing-rules.js';

export { default as SAW } from './saw/crosscut-saw.js';
export * as sawSpec from './saw/crosscut-saw.js';
export { default as ARM } from './robot/arm-6r.js';
export * as armSpec from './robot/arm-6r.js';
export { default as GRIPPER } from './robot/gripper-2f.js';
export * as gripperSpec from './robot/gripper-2f.js';
export { default as GRIPPER_HEAVY } from './robot/gripper-heavy.js';
export * as gripperHeavySpec from './robot/gripper-heavy.js';
export { default as NAILER } from './robot/nailer.js';
export * as nailerSpec from './robot/nailer.js';
export { default as CONVEYOR } from './conveyor/roller-conveyor.js';
export * as conveyorSpec from './conveyor/roller-conveyor.js';
export { default as PALLET } from './pallet/stringer-pallet.js';
export * as palletSpec from './pallet/stringer-pallet.js';
export { default as FORKLIFT } from './vehicle/forklift.js';
export * as forkliftSpec from './vehicle/forklift.js';
export { default as TRUCK } from './vehicle/flatbed-truck.js';
export * as truckSpec from './vehicle/flatbed-truck.js';

export { default as CRATE } from './crate/crate-ow-c1.js';
export * as crateSpec from './crate/crate-ow-c1.js';
export { default as PROCESS } from './process/recipes.js';
export * as processSpec from './process/recipes.js';
export { default as SITE } from './site/layout.js';
export * as siteSpec from './site/layout.js';

/** Every source id that appears in SOURCES.md. Enforced by the validator. */
export const KNOWN_SOURCES = Object.freeze([
  'S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8',
]);

export const SPEC_VERSION = '1.0.0-knowledge';
