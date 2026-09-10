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

export type ArmsCategory = 'tank' | 'aircraft' | 'sam' | 'helicopter' | 'surveillance';

/** Everything that flies. These share a combat weight; only power separates them. */
export const AIR_CATEGORIES: ArmsCategory[] = ['aircraft', 'helicopter', 'surveillance'];

export interface Equipment {
  id: string;
  name: string;
  category: ArmsCategory;
  /** Combat weight per unit, relative to `REFERENCE_POWER` for its category. */
  power: number;
}

/**
 * The quality of a typical regional unit. A fleet averaging these numbers is
 * worth exactly what the old flat-count model said it was worth.
 */
export const REFERENCE_POWER: Record<'tank' | 'air' | 'sam', number> = {
  tank: 8,
  air: 20,
  sam: 10,
};

const REGISTRY: Record<string, Equipment> = {};

for (const item of [...CATALOGUE, ...IN_SERVICE]) {
  REGISTRY[item.id] = {
    id: item.id,
    name: item.name,
    category: item.category,
    power: item.power,
  };
}

export function equipmentById(id: string): Equipment | undefined {
  return REGISTRY[id];
}

/** Every id known to the game, for tests and for iterating a catalogue. */
export function allEquipment(): Equipment[] {
  return Object.values(REGISTRY);
}
