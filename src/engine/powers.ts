/**
 * The capitals that are not in the region.
 *
 * Washington was never an actor. It was a single scalar, `israel.usRelations`,
 * moved by twenty-odd things and readable by anyone, with no menu, no demands
 * and nobody on the other end of it. That is why an arms embargo had no lever:
 * there was nothing to negotiate *with*.
 *
 * Powers are deliberately not `NationId`s. They have no border, no stability,
 * no opposition to fund and no army you can mass on. What they have is a
 * relationship, a price, and a memory — and, unlike the neighbours, they will
 * tell you what they want.
 */

import type { GameState } from './types';
import { clamp } from './ladders';

export type PowerId = 'usa' | 'britain' | 'france';

export const POWER_IDS: PowerId[] = ['usa', 'britain', 'france'];

export interface PowerState {
  /** 0..100 standing with this capital. */
  relations: number;
  /**
   * How much patience this capital has left for being asked. Lobbying works
   * and works less well each time, so a premier cannot simply ask every month
   * until the answer changes.
   */
  patience: number;
}

export const POWER_NAMES: Record<PowerId, string> = {
  usa: 'United States',
  britain: 'Britain',
  france: 'France',
};

/**
 * Opening positions, June 2000. Barak is Washington's man and the aid pipeline
 * is open; London is correct; Paris has been the least friendly of the three
 * since 1967 and has never entirely stopped enjoying it.
 */
const OPENING: Record<PowerId, number> = {
  usa: 74,
  britain: 48,
  // Far enough above its own embargo line to be selling in June 2000 — the
  // Mirage 2000-5 is on the catalogue — and close enough to it that Paris is
  // reliably the first capital to stop.
  france: 45,
};

export function createPowers(): Record<PowerId, PowerState> {
  const out = {} as Record<PowerId, PowerState>;
  for (const id of POWER_IDS) out[id] = { relations: OPENING[id], patience: 100 };
  return out;
}

export function relationsWith(s: GameState, id: PowerId): number {
  return s.israel.powers[id].relations;
}

/**
 * Move a relationship. Every caller used to write the same clamp by hand,
 * which is how `usRelations` ended up being adjusted in twenty-five places
 * with the bounds restated at each one.
 */
export function adjustRelations(s: GameState, id: PowerId, delta: number): void {
  const p = s.israel.powers[id];
  p.relations = clamp(p.relations + delta, 0, 100);
}

export function setRelations(s: GameState, id: PowerId, value: number): void {
  s.israel.powers[id].relations = clamp(value, 0, 100);
}

/**
 * How readily each capital reaches for an embargo, as a multiplier on the
 * thresholds Washington uses. Higher means quicker to act.
 *
 * London is narrow and reliable and does not much want the argument. Paris
 * embargoed Israel unilaterally in 1967, kept it in place for a decade, and
 * has never entirely stopped enjoying having done it — it is the least
 * reliable of the three and does not need Washington's permission.
 */
export const EMBARGO_READINESS: Record<PowerId, number> = {
  usa: 1.0,
  britain: 0.8,
  france: 1.3,
};

/**
 * An act the whole West notices. Washington leads, and the other two care
 * about it less — they are allies of Israel's ally rather than of Israel.
 */
export function adjustWest(s: GameState, delta: number): void {
  adjustRelations(s, 'usa', delta);
  adjustRelations(s, 'britain', delta * 0.6);
  adjustRelations(s, 'france', delta * 0.4);
}
