/**
 * The Palestinian question.
 *
 * In the original this was a pressure valve: unrest rises, you post a brigade
 * to hold it down, and that brigade is then not available for the borders.
 * Set in 2000 the same mechanism carries a great deal more weight, because
 * the historical answer to "what happens in September" is the Second Intifada.
 *
 * Hard tactics suppress unrest quickly and cost prestige, world opinion and
 * standing with Washington. Soft tactics cost time.
 */

import type { GameState, Palestine, PolicingDirective } from './types';
import { clamp, pointsToRelations } from './ladders';
import { freeBrigades } from './state';
import { coalitionReact } from './coalition';
import type { Rng } from './rng';
import { PALESTINE, expand } from '../data/headlines';
import { adjustRelations } from './powers';

export interface PolicingOption {
  id: PolicingDirective;
  label: string;
  disabledReason?: string;
}

export function policingOptions(s: GameState): PolicingOption[] {
  const p = s.palestine;

  if (p.brigadesPosted === 0) {
    const free = freeBrigades(s);
    return [
      {
        id: 'post_brigade',
        label: 'Post a brigade for policing duty in the West Bank',
        ...(free < 1
          ? { disabledReason: 'There are no brigades available for policing duties' }
          : {}),
      },
      { id: 'none', label: 'Leave alone' },
    ];
  }

  const opts: PolicingOption[] = [
    { id: 'reduce_presence', label: 'Reduce presence in the West Bank' },
  ];
  if (p.tactics === 'soft') {
    opts.push({ id: 'harden', label: 'Allow troops to physically engage protesters' });
  } else {
    opts.push({ id: 'soften', label: 'Change to soft tactics' });
  }
  if (freeBrigades(s) > 0) {
    opts.push({ id: 'post_brigade', label: 'Post a further brigade for policing duty' });
  }
  opts.push({ id: 'none', label: 'Take no action' });
  return opts;
}

export interface PalestineEvent {
  text: string;
  category: 'palestine';
  weight: number;
}

export function resolvePalestine(s: GameState, rng: Rng): PalestineEvent[] {
  const p = s.palestine;
  const events: PalestineEvent[] = [];

  switch (s.directives.policing) {
    case 'post_brigade':
      if (freeBrigades(s) > 0) p.brigadesPosted++;
      p.presence = 'full';
      break;
    case 'reduce_presence':
      p.brigadesPosted = Math.max(0, p.brigadesPosted - 1);
      p.presence = 'low';
      break;
    case 'harden':
      p.tactics = 'hard';
      break;
    case 'soften':
      p.tactics = 'soft';
      break;
    case 'none':
      break;
  }

  // --- pressure -----------------------------------------------------------
  let delta = 0;

  // Occupation generates its own unrest, month after month.
  delta += 0.55;

  // Troops on the ground suppress it, hard tactics more so.
  delta -= p.brigadesPosted * (p.tactics === 'hard' ? 0.85 : 0.5);

  // A homeland ends the problem outright, as it did in the original.
  if (p.homelandCreated) delta -= 3;

  // Regional temperature bleeds in.
  delta += (s.tension - 50) / 90;

  // An intifada feeds itself.
  if (p.intifada) delta += 0.7;

  // Hard tactics are effective and expensive.
  if (p.tactics === 'hard' && p.brigadesPosted > 0) {
    s.israel.prestige = clamp(s.israel.prestige - 1, 0, 100);
    adjustRelations(s, 'usa', -1);
    // The right approves of a firm hand and the left does not, month on month.
    coalitionReact(s, 'hawkish', 2.5);
    // And they radicalise: suppression now, worse later.
    if (rng.chance(0.3)) delta += 0.6;
  }

  p.unrest = clamp(p.unrest + delta + rng.next() * 0.5 - 0.25, 0, 10);

  // --- consequences -------------------------------------------------------
  if (p.unrest >= 7) {
    s.israel.popularity = clamp(s.israel.popularity - 3, 0, 100);
    s.israel.prestige = clamp(s.israel.prestige - 1, 0, 100);
    s.tension = clamp(s.tension + 2, 0, 100);
    // The Arab world reacts to what it sees on television.
    for (const n of Object.values(s.nations)) {
      if (!n.collapsed) n.relationsPoints = clamp(n.relationsPoints - 2, -100, 100);
    }
  } else if (p.unrest >= 4) {
    s.israel.popularity = clamp(s.israel.popularity - 1, 0, 100);
  } else if (p.unrest <= 1) {
    s.israel.popularity = clamp(s.israel.popularity + 1, 0, 100);
  }

  // An intifada is not permanent. Four months of real calm and it is over —
  // which is rare while nothing has been agreed, and quick once something has.
  if (p.intifada) {
    p.quietMonths = p.unrest < 3 ? p.quietMonths + 1 : 0;
    if (p.quietMonths >= 4) {
      p.intifada = false;
      p.quietMonths = 0;
      events.push({ text: 'The intifada subsides; checkpoints reopen', category: 'palestine', weight: 2 });
    }
  }

  if (p.unrest >= 3 && rng.chance(0.55)) {
    events.push({
      text: expand(rng.pick(PALESTINE), {
        subjAdj: 'Israeli',
        subjName: 'Israel',
        subjCapital: 'Jerusalem',
        objCapital: 'Jerusalem',
      }),
      category: 'palestine',
      weight: p.unrest >= 7 ? 3 : 1,
    });
  }

  return events;
}

// ---------------------------------------------------------------------------
// Final status, and what happens when it fails
// ---------------------------------------------------------------------------

export const FINAL_STATUS_LABEL: Record<Palestine['finalStatus'], string> = {
  none: 'Not yet negotiated',
  agreed: 'Agreed by both sides',
  israel_refused: 'We refused the framework',
  palestinians_refused: 'Arafat refused the framework',
  absent: 'We stayed away',
};

/**
 * Which summit this is. A summit convened in 2000 is Camp David whichever
 * screen asked — the interstitial sets the kind when it is queued, but the
 * proposals can be asked for before then.
 */
export function summitKindOf(s: GameState): GameState['summitKind'] {
  return s.summitKind === 'regular' && s.year === 2000 ? 'camp_david' : s.summitKind;
}

/**
 * Whether the Palestinian side signs what we have just signed. Arafat went to
 * Camp David saying he was not ready and left without signing, and Taba ran
 * out of time; a deal is two signatures, and the second is not ours to give.
 */
export function palestinianAcceptance(s: GameState): number {
  const p = s.palestine;
  const kind = summitKindOf(s);
  let chance = kind === 'camp_david' ? 0.45 : kind === 'taba' ? 0.55 : 0.6;
  // The rejectionists have a veto of sorts: nobody signs in front of a crowd
  // that will call it treason the next morning.
  const hamas = s.factions.hamas;
  if (hamas?.active && hamas.strength > 45) chance -= 0.1;
  // Nobody signs in the middle of a riot — except at Taba, which was only
  // convened because of one, and where the unrest is the reason for coming.
  const unrestPenalty = Math.max(0, p.unrest - 2) * 0.05;
  chance -= kind === 'taba' ? Math.min(0.1, unrestPenalty) : unrestPenalty;
  // Cairo and Amman standing behind the deal is cover Arafat needs.
  const { egypt, jordan } = s.nations;
  if (!egypt.collapsed && !jordan.collapsed && egypt.relations >= 5 && jordan.relations >= 5) {
    chance += 0.1;
  }
  return clamp(chance, 0.25, 0.75);
}

/**
 * The monthly chance of the territories igniting, from September 2000 on.
 *
 * This used to be one scripted event, certain to fire in the September after
 * a refusal and never otherwise. Now how the talks ended sets the odds, the
 * street and the rejectionists scale them, and an agreement makes an uprising
 * far less likely without making it impossible — somebody always rejects the
 * deal, and in the first two years they are loudest.
 */
export function intifadaChance(s: GameState): number {
  const p = s.palestine;
  if (p.intifada) return 0;
  if (s.year < 2000 || (s.year === 2000 && s.month < 8)) return 0;
  const september2000 = s.year === 2000 && s.month === 8;

  let base: number;
  switch (p.finalStatus) {
    case 'agreed': {
      const since = p.intifadaStartTurn === null ? s.turn : s.turn - p.intifadaStartTurn;
      base = since < 24 ? 0.006 : 0.0015;
      break;
    }
    case 'palestinians_refused':
      base = september2000 ? 0.45 : 0.15;
      break;
    case 'israel_refused':
    case 'absent':
      base = september2000 ? 0.6 : 0.2;
      break;
    case 'none':
      // Nothing has been negotiated, so nothing has failed: as in the
      // original, only a territory that is already restive ignites.
      base = p.unrest < 3 ? 0 : september2000 ? 0.3 : 0.08;
      break;
  }

  const hamas = s.factions.hamas?.active ? s.factions.hamas.strength : 0;
  const scale = (0.5 + p.unrest / 6) * (0.6 + hamas / 95);
  return clamp(base * scale, 0, 0.9);
}

/** Roll for an outbreak. Runs once a month, after the calendar turns. */
export function resolveOutbreak(s: GameState, rng: Rng): PalestineEvent[] {
  const chance = intifadaChance(s);
  if (chance <= 0 || !rng.chance(chance)) return [];

  const p = s.palestine;
  const first = !s.firedEvents.includes('intifada-began');
  p.intifada = true;
  p.intifadaStartTurn = s.turn;
  p.quietMonths = 0;
  if (first) s.firedEvents.push('intifada-began');

  // Against an agreement, the uprising is the rejectionists' and not the
  // street's: smaller, shorter, and nobody in Cairo recalls an ambassador.
  if (p.homelandCreated) {
    p.unrest = clamp(p.unrest + rng.int(2, 3), 0, 10);
    s.israel.popularity = clamp(s.israel.popularity - 5, 0, 100);
    s.tension = clamp(s.tension + 5, 0, 100);
    return [
      { text: 'Hamas launches uprising against the agreement', category: 'palestine', weight: 3 },
    ];
  }

  // After an offer Arafat turned down, the blame is shared: the Arab capitals
  // still recall their ambassadors, but more quietly, and the country at home
  // blames the man who walked out rather than the one who stayed.
  const shared = p.finalStatus === 'palestinians_refused';
  p.unrest = clamp(p.unrest + rng.int(2, 4), 0, 10);
  s.israel.popularity = clamp(s.israel.popularity - (shared ? 8 : 12), 0, 100);
  s.tension = clamp(s.tension + 12, 0, 100);
  for (const n of Object.values(s.nations)) {
    if (!n.collapsed) {
      n.relationsPoints = clamp(n.relationsPoints - (shared ? 6 : 12), -100, 100);
      n.relations = pointsToRelations(n.relationsPoints);
    }
  }
  const september2000 = s.year === 2000 && s.month === 8;
  return [
    {
      text: september2000
        ? 'Temple Mount visit sparks riots across the territories'
        : 'Uprising in the territories: the streets are gone',
      category: 'palestine',
      weight: 3,
    },
    { text: first ? 'Al-Aqsa Intifada declared' : 'A new intifada begins', category: 'palestine', weight: 3 },
    { text: 'Arab capitals recall ambassadors from Tel Aviv', category: 'palestine', weight: 2 },
  ];
}
