/**
 * Keeping a government.
 *
 * Partners are not scored on your popularity — they are scored on the three
 * things they actually care about, and the same act moves different ones in
 * opposite directions. Conceding a homeland delights Meretz and destroys the
 * National Religious Party. Hard policing does the reverse. There is no
 * position that satisfies a coalition assembled out of both.
 *
 * Losing your majority is not death. Barak governed as a minority from July
 * 2000 until he resigned in December, and so can you — but every month you do
 * it, the Knesset gets another chance to end it.
 */

import type { GameState } from './types';
import { clamp } from './ladders';
import type { Rng } from './rng';
import {
  MAJORITY,
  OPENING_SATISFACTION,
  PARTNERS,
  RETURN_THRESHOLD,
  WALKOUT_THRESHOLD,
} from '../data/coalition2000';

/** The axes a partner has opinions about. */
export type PolicyAxis = 'territorial' | 'hawkish' | 'welfare';

export { MAJORITY };

/**
 * Below this the arithmetic is hopeless enough that the House will actually
 * table a confidence motion rather than simply making life impossible.
 */
const COLLAPSE_SEATS = 50;

export interface CoalitionEvent {
  text: string;
  category: 'domestic';
  weight: number;
}

export function createCoalition(): GameState['israel']['coalition'] {
  const out: GameState['israel']['coalition'] = {};
  for (const p of PARTNERS) {
    out[p.id] = { satisfaction: OPENING_SATISFACTION[p.id] ?? 50, inCoalition: true };
  }
  return out;
}

/** Seats currently supporting the government. */
export function coalitionSeats(s: GameState): number {
  let seats = 0;
  for (const p of PARTNERS) {
    if (s.israel.coalition[p.id]?.inCoalition) seats += p.seats;
  }
  return seats;
}

export function hasMajority(s: GameState): boolean {
  return coalitionSeats(s) >= MAJORITY;
}

/**
 * Something happened that partners have a view about. `magnitude` is the size
 * of the act; each partner's own coefficient decides the sign and the scale of
 * their reaction to it.
 */
export function coalitionReact(s: GameState, axis: PolicyAxis, magnitude: number): void {
  for (const p of PARTNERS) {
    const st = s.israel.coalition[p.id];
    if (!st) continue;
    st.satisfaction = clamp(st.satisfaction + p[axis] * magnitude, 0, 100);
  }
}

/** A flat move for everyone — a war going badly, a prestige that speaks for itself. */
export function coalitionMood(s: GameState, delta: number): void {
  for (const p of PARTNERS) {
    const st = s.israel.coalition[p.id];
    if (st) st.satisfaction = clamp(st.satisfaction + delta, 0, 100);
  }
}

export interface PartnerStatus {
  id: string;
  name: string;
  character: string;
  seats: number;
  satisfaction: number;
  inCoalition: boolean;
  ownParty: boolean;
}

export function coalitionReport(s: GameState): PartnerStatus[] {
  return PARTNERS.map((p) => ({
    id: p.id,
    name: p.name,
    character: p.character,
    seats: p.seats,
    satisfaction: s.israel.coalition[p.id]?.satisfaction ?? 0,
    inCoalition: !!s.israel.coalition[p.id]?.inCoalition,
    ownParty: !!p.ownParty,
  }));
}

/**
 * Walkouts, returns, and the confidence of the House. Runs once a month after
 * everything that might have offended anybody.
 */
export function resolveCoalition(s: GameState, rng: Rng): CoalitionEvent[] {
  const events: CoalitionEvent[] = [];

  for (const p of PARTNERS) {
    const st = s.israel.coalition[p.id];
    if (!st) continue;

    // Walking out is a reaction to what has just happened, so it is judged on
    // where this month's events left them — before the slow cooling below,
    // which would otherwise rescue anybody pushed just under the line.
    if (!p.ownParty) {
      if (st.inCoalition && st.satisfaction < WALKOUT_THRESHOLD) {
        st.inCoalition = false;
        events.push({
          text: `${p.name} quits the coalition — ${p.seats} seats`,
          category: 'domestic',
          weight: 3,
        });
      } else if (!st.inCoalition && st.satisfaction > RETURN_THRESHOLD) {
        st.inCoalition = true;
        events.push({
          text: `${p.name} rejoins the government`,
          category: 'domestic',
          weight: 2,
        });
      }
    }

    // Feelings cool toward indifference on their own. Nobody stays furious
    // about last year's budget for ever, and a party out of government is a
    // party being courted — so the way back is faster than the way out.
    const drift = st.satisfaction < 50 ? 2.5 : -0.5;
    st.satisfaction = clamp(st.satisfaction + drift, 0, 100);
  }

  const seats = coalitionSeats(s);
  if (seats >= MAJORITY) return events;

  // A minority government is survivable and precarious. Mostly it grinds you
  // down in public rather than ending you outright — Barak governed without a
  // majority for five months and went to the country rather than being thrown
  // out of the chamber. So the ordinary cost is popularity, and the House only
  // reaches for a confidence motion when the arithmetic is truly hopeless.
  const shortfall = (MAJORITY - seats) / MAJORITY;
  s.israel.popularity = clamp(s.israel.popularity - (0.5 + shortfall * 1.5), 0, 100);

  if (seats < COLLAPSE_SEATS) {
    const chance = clamp((COLLAPSE_SEATS - seats) / 500, 0, 0.08);
    if (rng.chance(chance)) {
      s.israel.lostConfidence = true;
      events.push({
        text: 'Government falls: the Knesset carries a motion of no confidence',
        category: 'domestic',
        weight: 3,
      });
      return events;
    }
  }

  if (rng.chance(0.25)) {
    events.push({
      text: `Minority government survives another month — ${seats} of 120`,
      category: 'domestic',
      weight: 1,
    });
  }

  return events;
}
