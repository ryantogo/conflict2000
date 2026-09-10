/**
 * The hardware registry.
 *
 * Every piece of kit in the game — bought from a supplier, built at home, or
 * already in somebody's order of battle in June 2000 — is an `Equipment` with
 * an id, a category and a combat `power`. Forces are inventories of these ids
 * rather than counts of an abstract "tank", which is what lets an Abrams beat
 * a T-72 instead of merely costing more.
 *
 * `power` is per unit and relative. The reference values below are the hinge:
 * a unit of exactly reference power contributes what a unit of that category
 * always contributed, so the opening position is unchanged and everything
 * better or worse than the regional norm moves from there.
 */

import { CATALOGUE } from './arms2000';
import { IN_SERVICE } from './inventory2000';
import { DOMESTIC_EQUIPMENT } from './domestic2000';

export type ArmsCategory = 'tank' | 'aircraft' | 'sam' | 'helicopter' | 'surveillance';

/** Everything that flies. These share a combat weight; only power separates them. */
export const AIR_CATEGORIES: ArmsCategory[] = ['aircraft', 'helicopter', 'surveillance'];

/**
 * Who built it, and therefore who can stop the spares. An embargo does not
 * take tanks away; it grounds them a few at a time, month after month, and
 * whose badge is on the engine decides which ones.
 */
export type Origin = 'usa' | 'britain' | 'france' | 'israel' | 'soviet' | 'other';

export const ORIGINS: Origin[] = ['usa', 'britain', 'france', 'israel', 'soviet', 'other'];

export interface Equipment {
  id: string;
  name: string;
  category: ArmsCategory;
  /** Combat weight per unit, relative to `COMBAT_REFERENCE` for its category. */
  power: number;
  origin: Origin;
}

/** Registry entries may omit an origin the source can derive. */
export type EquipmentSpec = Omit<Equipment, 'origin'> & { origin?: Origin };

/**
 * The hinge that keeps the arithmetic compatible with the flat-count model
 * this replaced: a unit of exactly this power is worth what any unit of its
 * category used to be worth. Changing these rescales every combat weight in
 * the game, so don't, unless that is precisely what you mean to do.
 */
export const COMBAT_REFERENCE: Record<'tank' | 'air' | 'sam', number> = {
  tank: 8,
  air: 20,
  sam: 10,
};

/**
 * What a typical unit of this kind looks like *in this region in 2000*, used
 * only to turn a fleet's mean power into a word. Deliberately not the combat
 * reference: most armour on these borders is a T-55 or a Type 59, and it is
 * measuring the Merkava against that which makes "modern" mean anything.
 * Measured against Israel's own average, Israel is by definition average.
 */
export const REGIONAL_NORM: Record<ArmsCategory, number> = {
  tank: 6,
  aircraft: 13,
  helicopter: 10,
  surveillance: 25,
  sam: 7,
};

const REGISTRY: Record<string, Equipment> = {};

/** The private dealer's stock is ex-Soviet, whatever the paperwork says. */
const SUPPLIER_ORIGIN: Record<string, Origin> = {
  usa: 'usa',
  britain: 'britain',
  france: 'france',
  dealer: 'soviet',
};

for (const item of CATALOGUE) {
  REGISTRY[item.id] = {
    id: item.id,
    name: item.name,
    category: item.category,
    power: item.power,
    // What you buy from a supplier is by definition made by them.
    origin: SUPPLIER_ORIGIN[item.supplier] ?? 'other',
  };
}

for (const item of [...IN_SERVICE, ...DOMESTIC_EQUIPMENT]) {
  REGISTRY[item.id] = {
    id: item.id,
    name: item.name,
    category: item.category,
    power: item.power,
    origin: item.origin ?? 'other',
  };
}

export function equipmentById(id: string): Equipment | undefined {
  return REGISTRY[id];
}

/** Every id known to the game, for tests and for iterating a catalogue. */
export function allEquipment(): Equipment[] {
  return Object.values(REGISTRY);
}
