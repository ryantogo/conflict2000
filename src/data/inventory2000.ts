/**
 * What is already in service in June 2000, as opposed to what is for sale.
 *
 * Nobody starts the game with an empty motor pool, and most of what is parked
 * in it was never on a supplier's page — it is old, it is captured, or it was
 * built at home. Those types live here.
 *
 * This file is deliberately the only place the opening order of battle is
 * written down, so that changing what a country actually fields is a
 * one-file edit and never a change to the engine.
 */

import type { Fleet } from '../engine/types';
import type { Equipment } from './equipment';

/**
 * Provisional: one representative type per category, at exactly the reference
 * power for that category, so that an inventory of these is worth precisely
 * what the old flat-count model said the same number of units was worth.
 * Real types replace these; the engine does not care which it is holding.
 */
export const IN_SERVICE: Equipment[] = [
  { id: 'line_tank', name: 'Main battle tank', category: 'tank', power: 8 },
  { id: 'line_aircraft', name: 'Combat aircraft', category: 'aircraft', power: 20 },
  { id: 'line_helicopter', name: 'Attack helicopter', category: 'helicopter', power: 20 },
  { id: 'line_awacs', name: 'Early warning aircraft', category: 'surveillance', power: 20 },
  { id: 'line_sam', name: 'Surface-to-air missile battery', category: 'sam', power: 10 },
];

export interface OrderOfBattle {
  tanks?: number;
  aircraft?: number;
  helicopters?: number;
  awacs?: number;
  sam?: number;
}

/** Build an opening inventory from the headline counts of an order of battle. */
export function orderOfBattle(o: OrderOfBattle): Fleet {
  const fleet: Fleet = {};
  if (o.tanks) fleet.line_tank = o.tanks;
  if (o.aircraft) fleet.line_aircraft = o.aircraft;
  if (o.helicopters) fleet.line_helicopter = o.helicopters;
  if (o.awacs) fleet.line_awacs = o.awacs;
  if (o.sam) fleet.line_sam = o.sam;
  return fleet;
}
