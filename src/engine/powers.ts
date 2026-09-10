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
import type { Rng } from './rng';
import { coalitionReact } from './coalition';

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

// ---------------------------------------------------------------------------
// What they want, and what we can do about it
// ---------------------------------------------------------------------------

/**
 * The one thing this capital is currently pressing us about. Derived from our
 * own conduct rather than stored, so it always describes the present.
 */
export type Demand =
  | 'halt_strikes'
  | 'settle_the_war'
  | 'ease_policing'
  | 'nuclear_restraint'
  | 'stop_the_dealer'
  | null;

export const DEMAND_TEXT: Record<NonNullable<Demand>, string> = {
  halt_strikes: 'an end to the air strikes',
  settle_the_war: 'a ceasefire on the border',
  ease_policing: 'an easing of the policing of the territories',
  nuclear_restraint: 'no further nuclear announcements',
  stop_the_dealer: 'an end to our purchases on the grey market',
};

export function demandOf(s: GameState, id: PowerId): Demand {
  // Ordered by how loudly it is being said. A capital presses one thing.
  if (Object.values(s.fronts).some((f) => f.atWar)) return 'settle_the_war';
  if (s.stats.strikesOrdered > 2) return 'halt_strikes';
  if (s.israel.nuclearPosture !== 'opacity') return 'nuclear_restraint';
  if (s.palestine.tactics === 'hard' && s.palestine.brigadesPosted > 0) return 'ease_policing';
  // Paris and London mind the grey market rather less than Washington does.
  if (id === 'usa' && s.israel.suppliers.dealer.spent > 200) return 'stop_the_dealer';
  return null;
}

export type PowerDirective = 'none' | 'lobby' | 'concede' | 'defy';

export interface PowerOption {
  id: PowerDirective;
  label: string;
  disabledReason?: string;
}

/** What a month of quiet diplomacy costs. */
export const LOBBY_COST = 40;

/** Months of good behaviour a formal undertaking buys them. */
export const RESTRAINT_MONTHS = 8;

export function powerOptions(s: GameState, id: PowerId): PowerOption[] {
  const opts: PowerOption[] = [];
  const demand = demandOf(s, id);
  const rel = relationsWith(s, id);

  opts.push({
    id: 'lobby',
    label: `Quiet diplomacy in ${POWER_NAMES[id] === 'United States' ? 'Washington' : POWER_NAMES[id]} — $${LOBBY_COST} M`,
    ...(s.israel.funds < LOBBY_COST
      ? { disabledReason: 'There is nothing in the fund for it this month.' }
      : rel >= 96
        ? { disabledReason: 'The relationship could hardly be better than it is.' }
        : {}),
  });

  opts.push({
    id: 'concede',
    label: demand
      ? `Give formal undertakings on ${DEMAND_TEXT[demand]}`
      : 'Give formal undertakings',
    ...(demand
      ? s.israel.restraint > 0
        ? { disabledReason: 'We have already given undertakings that still bind us.' }
        : {}
      : { disabledReason: 'They are pressing us about nothing in particular.' }),
  });

  opts.push({
    id: 'defy',
    label: 'Reject their demands publicly',
    ...(demand ? {} : { disabledReason: 'There is nothing on the table to reject.' }),
  });

  opts.push({ id: 'none', label: 'Take no action' });
  return opts;
}

export interface PowerEvent {
  text: string;
  category: 'diplomacy';
  weight: number;
}

/**
 * A month of dealing with the capitals that are not in the region.
 *
 * Lobbying works, and works less well each time it is tried — a capital that
 * has heard the argument four times running is not hearing it a fifth. That
 * is what `patience` is for, and it is why there is no strategy of simply
 * buying the relationship back a month at a time.
 */
export function resolvePowers(s: GameState, rng: Rng): PowerEvent[] {
  const events: PowerEvent[] = [];

  for (const id of POWER_IDS) {
    const directive = s.directives.powers[id];
    const power = s.israel.powers[id];

    // Patience returns while we are not asking for anything.
    if (!directive || directive === 'none') {
      power.patience = clamp(power.patience + 4, 0, 100);
      continue;
    }

    const demand = demandOf(s, id);
    const name = POWER_NAMES[id];

    switch (directive) {
      case 'lobby': {
        if (s.israel.funds < LOBBY_COST) break;
        s.israel.funds -= LOBBY_COST;
        // Worth the most when they have not heard it recently.
        const gain = Math.round(rng.int(3, 7) * (power.patience / 100));
        adjustRelations(s, id, gain);
        power.patience = clamp(power.patience - 30, 0, 100);
        events.push({
          text:
            gain >= 4
              ? `Israeli delegation well received in ${name}`
              : `Israeli approaches to ${name} make little impression`,
          category: 'diplomacy',
          weight: 0,
        });
        break;
      }

      case 'concede': {
        if (!demand || s.israel.restraint > 0) break;
        adjustRelations(s, id, rng.int(12, 18));
        // The other two notice, less.
        for (const other of POWER_IDS) {
          if (other !== id) adjustRelations(s, other, rng.int(2, 5));
        }
        s.israel.restraint = RESTRAINT_MONTHS;
        s.israel.prestige = clamp(s.israel.prestige - 4, 0, 100);
        // Undertakings given to foreigners play badly with the right.
        coalitionReact(s, 'hawkish', -10);
        events.push({
          text: `Israel gives ${name} formal undertakings on ${DEMAND_TEXT[demand]}`,
          category: 'diplomacy',
          weight: 2,
        });
        break;
      }

      case 'defy': {
        if (!demand) break;
        adjustRelations(s, id, -rng.int(7, 12));
        s.israel.popularity = clamp(s.israel.popularity + 3, 0, 100);
        coalitionReact(s, 'hawkish', 8);
        events.push({
          text: `Israel rejects ${name} demands for ${DEMAND_TEXT[demand]}`,
          category: 'diplomacy',
          weight: 2,
        });
        break;
      }
    }
  }

  // An undertaking runs down whether or not anybody is watching.
  if (s.israel.restraint > 0) {
    s.israel.restraint--;
    if (s.israel.restraint === 0) {
      events.push({
        text: 'The undertakings given to the Western capitals have run their course.',
        category: 'diplomacy',
        weight: 0,
      });
    }
  }

  return events;
}

export interface PowerStatus {
  id: PowerId;
  name: string;
  relations: number;
  patience: number;
  embargoed: boolean;
  loyalty: number;
  demand: Demand;
  demandText: string | null;
}

export function powerReport(s: GameState): PowerStatus[] {
  return POWER_IDS.map((id) => {
    const demand = demandOf(s, id);
    return {
      id,
      name: POWER_NAMES[id],
      relations: relationsWith(s, id),
      patience: s.israel.powers[id].patience,
      embargoed: s.israel.suppliers[id].embargoed,
      loyalty: s.israel.suppliers[id].loyalty,
      demand,
      demandText: demand ? DEMAND_TEXT[demand] : null,
    };
  });
}
