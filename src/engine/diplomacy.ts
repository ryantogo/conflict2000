/**
 * Diplomacy.
 *
 * Relations are stored as a -100..+100 point pool and shown to the player only
 * as one of ten words. Movement is deliberately slow: the manual's warning
 * that "diplomatic relations need to be constantly worked on" is enforced by
 * making a single month's conciliation worth a few points, while one artificial
 * incident is worth a great many.
 */

import type { DiplomaticDirective, GameState, NationId } from './types';
import { FRONTS } from './types';
import { clamp, pointsToRelations } from './ladders';
import type { Rng } from './rng';

export interface DiplomaticOption {
  id: DiplomaticDirective;
  label: string;
  /** Absent when the option is selectable. */
  disabledReason?: string;
}

/**
 * Which diplomatic moves are legal against a nation right now. The original
 * swapped the whole menu depending on the state of the relationship, and the
 * refusals it printed were themselves informative.
 */
export function diplomaticOptions(s: GameState, id: NationId): DiplomaticOption[] {
  const n = s.nations[id];
  const front = n.isFront ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'] : null;
  const atWar = n.atWarWith.includes('israel');
  const opts: DiplomaticOption[] = [];

  if (atWar) {
    opts.push({ id: 'ceasefire', label: 'Open negotiations for a ceasefire' });
    opts.push({ id: 'maintain', label: 'Keep diplomatic relations closed' });
    return opts;
  }

  if (n.collapsed) {
    return [
      {
        id: 'maintain',
        label: 'Maintain present relations',
        disabledReason: `There are no formal channels open to ${n.name} at present.`,
      },
    ];
  }

  // Hostile troops on the border block any warming — straight from the manual.
  const hostileOnBorder = !!front && front.enemyActivity >= 2;
  const improveBlock = hostileOnBorder
    ? 'Relations cannot be improved while hostile troops are stationed on the border.'
    : n.israeliPosture === 'supporting_opposition'
      ? 'We are probably too friendly with opposing factions to improve relations.'
      : n.relations >= 9
        ? 'Given the state of relations at present, improvements seem highly unlikely.'
        : undefined;

  if (n.relations >= 4) {
    opts.push({
      id: 'improve',
      label: 'Improve relations by beneficial trade',
      ...(improveBlock ? { disabledReason: improveBlock } : {}),
    });
  } else {
    opts.push({
      id: 'improve',
      label: 'Improve relations with conciliatory actions',
      ...(improveBlock ? { disabledReason: improveBlock } : {}),
    });
  }

  if (n.pactWith.includes('israel')) {
    opts.push({ id: 'break_pact', label: 'Break pact' });
    opts.push({ id: 'maintain', label: 'Maintain present agreement' });
  } else if (n.relations >= 8) {
    opts.push({ id: 'sign_pact', label: 'Sign military pact' });
    opts.push({ id: 'reduce', label: 'Reduce relations' });
    opts.push({ id: 'maintain', label: 'Maintain present relations' });
  } else {
    opts.push({
      id: 'spoil',
      label: 'Spoil relations by creating an accidental incident',
    });
    opts.push({ id: 'maintain', label: 'Maintain present relations' });
  }

  return opts;
}

/** Apply one month of the player's diplomatic directives. Returns log lines. */
export function resolveDiplomacy(s: GameState, rng: Rng): string[] {
  const notes: string[] = [];

  for (const [key, directive] of Object.entries(s.directives.diplomatic)) {
    const id = key as NationId;
    const n = s.nations[id];
    if (!directive || n.collapsed) continue;

    switch (directive) {
      case 'improve': {
        const front = n.isFront
          ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria']
          : null;
        if (front && front.enemyActivity >= 2) {
          notes.push(
            `Approaches to ${n.name} went nowhere while their forces stand on our border.`,
          );
          break;
        }
        // Warming is slow and gets slower the friendlier you already are.
        const resistance = 1 + n.relations * 0.18;
        const gain = Math.round((rng.int(6, 12) / resistance) * 1.0);
        n.relationsPoints = clamp(n.relationsPoints + gain, -100, 100);
        notes.push(`We are working on improving relations with ${n.name}.`);
        break;
      }

      case 'spoil': {
        n.relationsPoints = clamp(n.relationsPoints - rng.int(14, 24), -100, 100);
        s.tension = clamp(s.tension + rng.int(1, 3), 0, 100);
        // Manufacturing incidents is cheap, but not free: Washington can read
        // a pattern as easily as anyone else.
        s.israel.usRelations = clamp(s.israel.usRelations - 3, 0, 100);
        notes.push(`A border dispute between Israel and ${n.name} has aggravated relations.`);
        break;
      }

      case 'reduce': {
        n.relationsPoints = clamp(n.relationsPoints - rng.int(18, 30), -100, 100);
        s.tension = clamp(s.tension + rng.int(2, 4), 0, 100);
        s.israel.usRelations = clamp(s.israel.usRelations - 5, 0, 100);
        s.israel.prestige = clamp(s.israel.prestige - 2, 0, 100);
        notes.push(`Israeli-${n.adjective} relations have been noticeably soured.`);
        break;
      }

      case 'sign_pact': {
        if (n.relations >= 8 && !n.pactWith.includes('israel')) {
          n.pactWith.push('israel');
          n.relationsPoints = clamp(n.relationsPoints + 8, -100, 100);
          s.israel.prestige = clamp(s.israel.prestige + 3, 0, 100);
          notes.push(`A military pact has been signed between Israel and ${n.name}.`);
        } else {
          notes.push(`${n.name}'s generals were not ready to sign after all.`);
        }
        break;
      }

      case 'break_pact': {
        n.pactWith = n.pactWith.filter((p) => p !== 'israel');
        n.relationsPoints = clamp(n.relationsPoints - 30, -100, 100);
        s.israel.prestige = clamp(s.israel.prestige - 4, 0, 100);
        s.tension = clamp(s.tension + 4, 0, 100);
        notes.push(`Israel has torn up its pact with ${n.name}.`);
        break;
      }

      case 'ceasefire': {
        // The other side has to want it too; a losing enemy wants it more.
        const front = n.isFront
          ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria']
          : null;
        const theirPain = front ? clamp(front.warProgress / 100, -1, 1) : 0;
        const willing = rng.next() < 0.25 + theirPain * 0.45;
        if (willing && front) {
          endWar(s, id, notes);
        } else {
          notes.push(`The ${n.adjective}s do not seem to have responded to our previous offer.`);
        }
        break;
      }

      case 'maintain':
        break;
    }
  }

  // Recompute the visible ladder position for everyone.
  for (const n of Object.values(s.nations)) {
    n.relations = pointsToRelations(n.relationsPoints);
  }

  return notes;
}

/** Settle a war on one front, U.N.-brokered or bilateral. */
export function endWar(s: GameState, id: NationId, notes: string[]): void {
  const n = s.nations[id];
  if (!n.isFront) return;
  const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];

  front.atWar = false;
  front.warMonths = 0;
  front.warProgress = 0;
  front.demilitarised = true;
  front.demilitarisedMonths = DEMILITARISED_MONTHS;
  n.atWarWith = n.atWarWith.filter((w) => w !== 'israel');
  // A ceasefire is not a friendship, but it reopens the channel.
  n.relationsPoints = clamp(n.relationsPoints + 15, -100, 100);
  n.relations = pointsToRelations(n.relationsPoints);
  s.tension = clamp(s.tension - 8, 0, 100);

  notes.push(
    `Israel and ${n.name} have accepted an immediate ceasefire preceding the ` +
      `total withdrawal of combat forces. Any territory gains made by either ` +
      `side may be kept for the present time.`,
  );
}

/** How long a U.N. military-free zone stands before the mandate runs out. */
export const DEMILITARISED_MONTHS = 36;

export interface MandateEvent {
  text: string;
  category: 'diplomacy';
  weight: number;
}

/** Run down the U.N. mandates, and report any that lapse this month. */
export function expireMandates(s: GameState): MandateEvent[] {
  const out: MandateEvent[] = [];
  for (const id of FRONTS) {
    const front = s.fronts[id];
    if (!front.demilitarised) continue;
    front.demilitarisedMonths = Math.max(0, front.demilitarisedMonths - 1);
    if (front.demilitarisedMonths > 0) continue;
    front.demilitarised = false;
    out.push({
      text: `U.N. mandate on the ${s.nations[id].adjective} border expires`,
      category: 'diplomacy',
      weight: 1,
    });
  }
  return out;
}

/** Can Israel plausibly invade this nation? Good relations forbid it. */
export function canInvade(s: GameState, id: NationId): { ok: boolean; reason?: string } {
  const n = s.nations[id];
  if (!n.isFront) return { ok: false, reason: 'No shared border.' };
  if (n.collapsed) return { ok: false, reason: 'That government has already fallen.' };
  const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
  if (front.demilitarised) {
    return {
      ok: false,
      reason:
        'Since the recent conflict, the U.N. have made this a military free zone.',
    };
  }
  if (n.relations > 3) {
    return {
      ok: false,
      reason:
        'Your generals would refuse to mobilise against so friendly a country, ' +
        'and the Foreign Office would rebel.',
    };
  }
  if (front.deployed.brigades < 2) {
    return { ok: false, reason: 'Insufficient forces are deployed on that border.' };
  }
  return { ok: true };
}
