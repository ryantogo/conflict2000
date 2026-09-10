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
  partnerById,
} from '../data/coalition2000';
import { CABINET_EVENTS, cabinetEventById } from '../data/cabinet2000';
import type { CabinetEffect, CabinetEvent } from '../data/cabinet2000';

/** The axes a partner has opinions about. */
export type PolicyAxis = 'territorial' | 'hawkish' | 'welfare' | 'religious';

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
    out[p.id] = { satisfaction: OPENING_SATISFACTION[p.id] ?? 50, inCoalition: !p.courtable };
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
  courtable: boolean;
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
    courtable: !!p.courtable,
  }));
}

// ---------------------------------------------------------------------------
// Before the cabinet
// ---------------------------------------------------------------------------

/** Apply one of the cabinet's effects: parties, axes, and the country. */
export function applyEffect(s: GameState, e: CabinetEffect): void {
  if (e.axis) {
    for (const [axis, m] of Object.entries(e.axis)) coalitionReact(s, axis as PolicyAxis, m ?? 0);
  }
  if (e.party) {
    for (const [id, delta] of Object.entries(e.party)) {
      const st = s.israel.coalition[id];
      if (st) st.satisfaction = clamp(st.satisfaction + delta, 0, 100);
    }
  }
  for (const id of e.join ?? []) {
    const st = s.israel.coalition[id];
    if (st) {
      st.inCoalition = true;
      st.satisfaction = Math.max(st.satisfaction, 55);
    }
  }
  const isr = s.israel;
  if (e.popularity) isr.popularity = clamp(isr.popularity + e.popularity, 0, 100);
  if (e.funds) isr.funds = Math.max(0, isr.funds + e.funds);
  if (e.prestige) isr.prestige = clamp(isr.prestige + e.prestige, 0, 100);
  // Inline rather than through `adjustRelations`, which lives in a module
  // that already imports this one.
  if (e.usa) isr.powers.usa.relations = clamp(isr.powers.usa.relations + e.usa, 0, 100);
  if (e.unrest) s.palestine.unrest = clamp(s.palestine.unrest + e.unrest, 0, 10);
  if (e.tension) s.tension = clamp(s.tension + e.tension, 0, 100);
}

/** The question in front of the cabinet this month, if there is one. */
export function pendingCabinetEvent(s: GameState): CabinetEvent | null {
  return s.cabinet.pending ? (cabinetEventById(s.cabinet.pending) ?? null) : null;
}

/** Months between one demand and the next. A coalition takes a breath. */
const CABINET_GAP = 2;
/** The monthly chance of a new demand once the gap has passed. */
const CABINET_CHANCE = 0.3;
/** What it costs to be seen not deciding. */
const INDECISION = 1;

/**
 * Put a new question to the cabinet. Runs after the calendar turns, so the
 * question is in front of the premier when the month's planning begins.
 */
export function raiseCabinetEvent(s: GameState, rng: Rng): CoalitionEvent[] {
  if (s.cabinet.pending || s.turn - s.cabinet.lastTurn < CABINET_GAP) return [];
  if (!rng.chance(CABINET_CHANCE)) return [];
  const eligible = CABINET_EVENTS.filter(
    (e) => (!e.once || !s.firedEvents.includes(`cabinet:${e.id}`)) && e.when(s),
  );
  if (eligible.length === 0) return [];
  const ev = rng.pick(eligible);
  s.cabinet.pending = ev.id;
  if (ev.once) s.firedEvents.push(`cabinet:${ev.id}`);
  return [{ text: ev.title, category: 'domestic', weight: 1 }];
}

export type AppeaseAction = 'earmark' | 'ministry' | 'security' | 'concession' | 'court';

export interface AppeaseOption {
  id: AppeaseAction;
  label: string;
  detail?: string;
  disabledReason?: string;
}

const EARMARK = 40;
const COURTSHIP = 20;
/** Months before the same favour can be done for the same party again. */
const COOLDOWN: Record<AppeaseAction, number> = {
  earmark: 3,
  ministry: 12,
  security: 6,
  concession: 4,
  court: 2,
};

function cooling(s: GameState, party: string, action: AppeaseAction): boolean {
  const last = s.cabinet.cooldowns[`${party}:${action}`];
  return last !== undefined && s.turn - last < COOLDOWN[action];
}

/** What the premier can do to keep one party sweet this month. */
export function appeaseOptions(s: GameState, party: string): AppeaseOption[] {
  const p = partnerById(party);
  const st = s.israel.coalition[party];
  if (!p || !st || p.ownParty) return [];
  const opts: AppeaseOption[] = [];
  const recent = 'They were given the same thing recently, and remember it.';

  if (!st.inCoalition) {
    opts.push({
      id: 'court',
      label: `Open talks about ${p.courtable ? 'joining' : 'returning to'} the government — $${COURTSHIP} M`,
      detail: 'Slow, and it only works on a party that is prepared to listen',
      ...(s.israel.funds < COURTSHIP ? { disabledReason: 'There is nothing in the fund for it.' } : cooling(s, party, 'court') ? { disabledReason: recent } : {}),
    });
  }
  opts.push({
    id: 'ministry',
    label: `Offer ${p.name} a ministry`,
    detail: `${p.name} flattered · our own bloc resents giving it away`,
    ...(cooling(s, party, 'ministry') ? { disabledReason: 'We have already reshuffled for them this year.' } : {}),
  });
  opts.push({
    id: 'earmark',
    label: `Earmark money for their institutions — $${EARMARK} M`,
    detail:
      p.welfare > 0.5
        ? `${p.name} counts every shekel of it`
        : `${p.name} will take it, without much gratitude`,
    ...(s.israel.funds < EARMARK ? { disabledReason: 'There is nothing in the fund for it.' } : cooling(s, party, 'earmark') ? { disabledReason: recent } : {}),
  });
  opts.push({
    id: 'security',
    label: 'Bring them into the security cabinet',
    detail:
      p.hawkish > 0.3
        ? `${p.name} wants exactly this`
        : `${p.name} is not much interested in the security file`,
    ...(!st.inCoalition ? { disabledReason: 'Only a party in the government sits in the security cabinet.' } : cooling(s, party, 'security') ? { disabledReason: recent } : {}),
  });
  if (p.pet) {
    opts.push({
      id: 'concession',
      label: p.pet.label,
      detail: p.pet.detail,
      ...(p.pet.effect.funds && s.israel.funds < -p.pet.effect.funds
        ? { disabledReason: 'There is nothing in the fund for it.' }
        : cooling(s, party, 'concession')
          ? { disabledReason: recent }
          : {}),
    });
  }
  return opts;
}

function appease(s: GameState, party: string, action: AppeaseAction): string | null {
  const p = partnerById(party);
  const st = s.israel.coalition[party];
  if (!p || !st) return null;
  const legal = appeaseOptions(s, party).find((o) => o.id === action);
  if (!legal || legal.disabledReason) return null;
  s.cabinet.cooldowns[`${party}:${action}`] = s.turn;
  const own = s.israel.coalition.one_israel;

  switch (action) {
    case 'court':
      s.israel.funds -= COURTSHIP;
      st.satisfaction = clamp(st.satisfaction + 10, 0, 100);
      return `Talks opened with ${p.name}.`;
    case 'ministry':
      st.satisfaction = clamp(st.satisfaction + 20, 0, 100);
      if (own) own.satisfaction = clamp(own.satisfaction - 5, 0, 100);
      return `${p.name} was offered a ministry.`;
    case 'earmark':
      s.israel.funds -= EARMARK;
      st.satisfaction = clamp(st.satisfaction + 6 + 12 * Math.max(0, p.welfare), 0, 100);
      return `Money was earmarked for ${p.name}'s institutions.`;
    case 'security':
      st.satisfaction = clamp(st.satisfaction + 4 + 12 * Math.max(0, p.hawkish), 0, 100);
      return `${p.name} joined the security cabinet.`;
    case 'concession':
      if (p.pet) applyEffect(s, p.pet.effect);
      return `A concession was made to ${p.name}.`;
  }
}

/**
 * Whether the premier can go to the country, and what the odds look like, in
 * words. Only a government that has lost its majority has any reason to.
 */
export function electionAvailable(s: GameState): boolean {
  return coalitionSeats(s) < MAJORITY;
}

/** Popularity decides it, and only mostly. */
function electionOdds(s: GameState): number {
  return clamp((s.israel.popularity - 25) / 40, 0.05, 0.95);
}

export function electionOutlook(s: GameState): string {
  const p = electionOdds(s);
  if (p >= 0.8) return 'The polls say we would win comfortably.';
  if (p >= 0.55) return 'The polls give us the edge, not the election.';
  if (p >= 0.35) return 'The polls say it is anybody’s.';
  if (p >= 0.15) return 'The polls say we would probably lose.';
  return 'The polls say we would be destroyed.';
}

/**
 * The month's business before the cabinet: the pending question, whatever
 * favour was done for a partner, and an election if one was called.
 */
export function resolveCabinet(s: GameState, rng: Rng): CoalitionEvent[] {
  const events: CoalitionEvent[] = [];
  const d = s.directives;

  const ev = pendingCabinetEvent(s);
  if (ev) {
    const chosen = ev.choices.find((c) => c.id === d.cabinetChoice);
    const choice = chosen ?? ev.choices.find((c) => c.id === ev.fallback)!;
    applyEffect(s, choice.effect);
    if (!chosen) {
      s.israel.popularity = clamp(s.israel.popularity - INDECISION, 0, 100);
      events.push({ text: `Cabinet dithers: ${ev.title.toLowerCase()}`, category: 'domestic', weight: 1 });
    }
    s.log.unshift(`${ev.title} — ${choice.label}.`);
    s.cabinet.pending = null;
    s.cabinet.lastTurn = s.turn;
  }

  if (d.appease) {
    const note = appease(s, d.appease.party, d.appease.action);
    if (note) events.push({ text: note, category: 'domestic', weight: 0 });
  }

  if (d.callElection && electionAvailable(s)) {
    if (rng.chance(electionOdds(s))) {
      // A new mandate. Every party comes back to the table having heard the
      // country, and the arithmetic is redone from the result.
      s.israel.popularity = clamp(s.israel.popularity + 6, 0, 100);
      for (const p of PARTNERS) {
        const st = s.israel.coalition[p.id];
        if (!st || p.ownParty) continue;
        st.satisfaction = clamp((st.satisfaction + 58) / 2, 0, 100);
        st.inCoalition = p.courtable ? st.satisfaction > RETURN_THRESHOLD : st.satisfaction >= 40;
      }
      events.push({
        text: 'Premier returned with a new mandate after snap election',
        category: 'domestic',
        weight: 3,
      });
    } else {
      s.israel.electionLost = true;
      events.push({ text: 'Premier swept from office at the polls', category: 'domestic', weight: 3 });
    }
  }

  return events;
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
          text: `${p.name} ${p.courtable ? 'joins' : 'rejoins'} the government`,
          category: 'domestic',
          weight: 2,
        });
      }
    }

    // Feelings cool toward indifference on their own. Nobody stays furious
    // about last year's budget for ever, and a party out of government is a
    // party being courted — so the way back is faster than the way out.
    //
    // Except the opposition proper, which is not waiting to be asked back.
    // Likud settles toward its own opinion of us, and has to be brought in on
    // purpose; if it drifted up like everybody else, it would join a Barak
    // government on its own inside a year.
    if (p.courtable && !st.inCoalition) {
      const gap = (p.resting ?? 30) - st.satisfaction;
      st.satisfaction = clamp(st.satisfaction + Math.sign(gap) * Math.min(1.5, Math.abs(gap)), 0, 100);
    } else {
      const drift = st.satisfaction < 50 ? 2.5 : -0.5;
      st.satisfaction = clamp(st.satisfaction + drift, 0, 100);
    }
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
