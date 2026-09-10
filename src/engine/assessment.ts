/**
 * What we think they have, as opposed to what they have.
 *
 * The Strategic Action screen used to print the defender's exact combat weight
 * — a number the engine computes from a data structure the player has no
 * business being able to read. Knowing the enemy order of battle to the tank
 * is not a small convenience; it is the reason intelligence had nothing to do
 * except sabotage. There was no such thing as being surprised.
 *
 * An assessment is now the truth seen through whatever coverage we have of
 * that country, and coverage is something you build and lose.
 */

import type { GameState, NationId } from './types';
import { clamp } from './ladders';
import { enemyStrength } from './military';
import { countOf, grade } from './fleet';
import { REGIONAL_NORM } from '../data/equipment';
import { qualityLabel } from './ladders';

/**
 * How well we see a country. Agents on the ground do most of it; overhead
 * reconnaissance gives a floor everywhere at once, which is exactly why a
 * state builds satellites.
 */
export function coverage(s: GameState, id: NationId): number {
  const n = s.nations[id];
  const human = n.network / 100;
  return clamp(Math.max(human, s.israel.overhead), 0, 1);
}

export interface Assessment {
  /** Mid-point of what we believe, which is not what is true. */
  estimate: number;
  /** The band we would defend in front of the cabinet. */
  low: number;
  high: number;
  /** 0..1. */
  coverage: number;
  confidence: string;
  /** What we can say about the kit itself, if we can say anything. */
  notes: string[];
}

export function confidenceLabel(c: number): string {
  if (c >= 0.85) return 'Assessed with confidence';
  if (c >= 0.65) return 'Reasonably well established';
  if (c >= 0.45) return 'Partial picture';
  if (c >= 0.25) return 'Fragmentary';
  return 'Little better than guesswork';
}

/**
 * The band is wide when we are not looking and narrows as we do. Error runs
 * to plus or minus 55% with no coverage at all, which is enough to walk into
 * a war believing the wrong thing.
 */
function errorBand(c: number): number {
  return 0.55 * (1 - c);
}

export function assess(s: GameState, id: NationId): Assessment {
  const n = s.nations[id];
  const truth = enemyStrength(s, id);
  const c = coverage(s, id);
  const band = errorBand(c);

  // `estimateBias` is redrawn once a month and stored, so the assessment does
  // not change every time the player looks at the screen.
  const estimate = Math.max(0, truth * (1 + n.estimateBias * band));

  const notes: string[] = [];
  if (c >= 0.45) {
    const tanks = countOf(n.forces.equipment, 'tank');
    notes.push(`Armour assessed at ${tanks.toLocaleString()} vehicles.`);
    notes.push(
      `Their armour is ${qualityLabel(
        grade(n.forces.equipment, 'tank'),
        REGIONAL_NORM.tank,
      ).toLowerCase()} by regional standards.`,
    );
  }
  if (c >= 0.65) {
    const air = countOf(n.forces.equipment, 'aircraft');
    notes.push(`Air force assessed at ${air.toLocaleString()} combat aircraft.`);
  }
  if (c >= 0.8 && n.nuclearProgress > 20) {
    notes.push('There is a weapons programme, and it is further on than they admit.');
  }
  if (c < 0.45) {
    notes.push('We do not have the sources to say more than this.');
  }

  return {
    estimate,
    low: Math.max(0, truth * (1 - band)),
    high: truth * (1 + band),
    coverage: c,
    confidence: confidenceLabel(c),
    notes,
  };
}

/**
 * Redraw every assessment's error for the month. Called once per turn, so a
 * picture that is wrong is wrong consistently until somebody goes and looks.
 */
export function redrawAssessments(s: GameState, rng: { next(): number }): void {
  for (const n of Object.values(s.nations)) {
    n.estimateBias = rng.next() * 2 - 1;
  }
}
