/**
 * Wars that do not involve Israel.
 *
 * These used to be an entry in each side's `atWarWith` list and a coin toss
 * every month about who had lost it. There was no notion of ground, so a war
 * between Baghdad and Tehran could not be drawn and could not be measured: it
 * was either happening or not. A war now has a front line — `progress` is how
 * far the first side has pushed into the second — which is what lets the map
 * shade the land that has changed hands.
 *
 * `atWarWith` is still what the rest of the engine reads, so everything that
 * starts or ends a war goes through here and keeps the two in step.
 */

import type { GameState, Nation, NationId, RegionalWar } from './types';
import { FRONTS } from './types';
import { clamp } from './ladders';
import { attrite, countOf } from './fleet';
import { collapseGovernment } from './intelligence';
import type { Rng } from './rng';
import { VICTORY, expand } from '../data/headlines';

export interface WarEvent {
  text: string;
  category: 'war' | 'diplomacy';
  weight: number;
}

function pairCtx(a: Nation, b: Nation) {
  return {
    subjAdj: a.adjective,
    subjName: a.name,
    subjCapital: a.capital,
    objAdj: b.adjective,
    objName: b.name,
    objCapital: b.capital,
  };
}

/** Relations between two other states, kept symmetric. */
export function setInterArab(s: GameState, a: NationId, b: NationId, v: number): void {
  const clamped = clamp(Math.round(v), 0, 9);
  s.nations[a].interArab[b] = clamped;
  s.nations[b].interArab[a] = clamped;
}

export function findWar(s: GameState, x: NationId, y: NationId): RegionalWar | undefined {
  return s.wars.find((w) => (w.a === x && w.b === y) || (w.a === y && w.b === x));
}

/** `a` attacks `b`. Returns the war, which may already have been running. */
export function startRegionalWar(s: GameState, a: NationId, b: NationId): RegionalWar {
  const existing = findWar(s, a, b);
  if (existing) return existing;
  const war: RegionalWar = { a, b, progress: 0, months: 0, supporters: { powers: {} } };
  s.wars.push(war);
  if (!s.nations[a].atWarWith.includes(b)) s.nations[a].atWarWith.push(b);
  if (!s.nations[b].atWarWith.includes(a)) s.nations[b].atWarWith.push(a);
  return war;
}

export function endRegionalWar(s: GameState, war: RegionalWar): void {
  s.wars = s.wars.filter((w) => w !== war);
  const na = s.nations[war.a];
  const nb = s.nations[war.b];
  na.atWarWith = na.atWarWith.filter((x) => x !== war.b);
  nb.atWarWith = nb.atWarWith.filter((x) => x !== war.a);
}

/** The same yardstick the other capitals have always used to size each other up. */
export function fightingWeight(n: Nation): number {
  return n.forces.brigades * 100 + countOf(n.forces.equipment, 'tank') * 0.05 + n.stability;
}

/** What outside help is worth to one side, in the same units. */
const POWER_SUPPORT = 250;
const ISRAELI_SUPPORT = 400;

export function supportFor(war: RegionalWar, side: NationId): number {
  let w = 0;
  for (const backed of Object.values(war.supporters.powers)) {
    if (backed === side) w += POWER_SUPPORT;
  }
  if (war.supporters.israel === side) w += ISRAELI_SUPPORT;
  return w;
}

/** Share of `held` that `holder` has taken in this war, 0..1. */
export function groundHeld(war: RegionalWar, holder: NationId): number {
  const p = holder === war.a ? war.progress : -war.progress;
  return Math.max(0, p) / 100;
}

/** A month of every war the other capitals are fighting among themselves. */
export function resolveRegionalWars(s: GameState, rng: Rng): WarEvent[] {
  const events: WarEvent[] = [];

  for (const war of [...s.wars]) {
    // A collapse elsewhere this month may already have ended it.
    if (!s.wars.includes(war)) continue;
    const na = s.nations[war.a];
    const nb = s.nations[war.b];
    if (na.collapsed || nb.collapsed) {
      endRegionalWar(s, war);
      continue;
    }
    war.months++;

    const sa = fightingWeight(na) + supportFor(war, war.a);
    const sb = fightingWeight(nb) + supportFor(war, war.b);
    // Centred on an even match, as the Israeli fronts are, with more friction:
    // armies of this quality do not advance in straight lines.
    const swing = (sa / (sa + sb) - 0.5) * 40 + rng.int(-10, 10);
    war.progress = clamp(war.progress + swing, -100, 100);

    const winner = swing >= 0 ? na : nb;
    const loser = swing >= 0 ? nb : na;
    attrite(loser.forces.equipment, 0.1, 'tank');
    loser.stability = clamp(loser.stability - rng.int(3, 9), 0, 100);
    attrite(winner.forces.equipment, 0.04, 'tank');

    // A regime that has lost most of its country is losing its grip on the rest.
    const behind = war.progress >= 0 ? nb : na;
    const lost = Math.abs(war.progress) / 100;
    if (lost > 0.5) behind.stability = clamp(behind.stability - 2, 0, 100);

    // Someone eventually breaks: the side that lost this month's fighting if
    // it has nothing left, or the side that has lost nearly all its ground.
    const breaking =
      loser.stability <= 12 && rng.chance(0.35) ? loser : lost >= 0.9 ? behind : null;
    if (breaking) {
      const victor = breaking === na ? nb : na;
      collapseGovernment(s, breaking.id, 'invasion');
      events.push({
        text: expand(rng.pick(VICTORY), pairCtx(victor, breaking)),
        category: 'war',
        weight: 3,
      });
      continue;
    }

    // Or they simply stop.
    if (rng.chance(0.18)) {
      endRegionalWar(s, war);
      setInterArab(s, war.a, war.b, 3);
      events.push({
        text: expand('Ceasefire agreed { _ ~ #', pairCtx(na, nb)),
        category: 'diplomacy',
        weight: 2,
      });
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Ground that has changed hands
// ---------------------------------------------------------------------------

export interface Occupation {
  holder: NationId | 'israel';
  held: NationId | 'israel';
  /** 0..1 of the held country, measured inward from the shared border. */
  share: number;
}

/** Below this, a front line has not moved far enough to draw. */
const VISIBLE = 0.02;

/** Every piece of land held by somebody it does not belong to. */
export function occupations(s: GameState): Occupation[] {
  const out: Occupation[] = [];
  for (const id of FRONTS) {
    const f = s.fronts[id];
    if (f.occupation > VISIBLE) out.push({ holder: 'israel', held: id, share: f.occupation });
    if (f.lostGround > VISIBLE) out.push({ holder: id, held: 'israel', share: f.lostGround });
  }
  for (const w of s.wars) {
    if (groundHeld(w, w.a) > VISIBLE) out.push({ holder: w.a, held: w.b, share: groundHeld(w, w.a) });
    if (groundHeld(w, w.b) > VISIBLE) out.push({ holder: w.b, held: w.a, share: groundHeld(w, w.b) });
  }
  return out;
}
