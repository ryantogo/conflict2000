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

import type { GameState, PolicingDirective } from './types';
import { clamp } from './ladders';
import { freeBrigades } from './state';
import { coalitionReact } from './coalition';
import type { Rng } from './rng';
import { PALESTINE, expand } from '../data/headlines';

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
    s.israel.usRelations = clamp(s.israel.usRelations - 1, 0, 100);
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
