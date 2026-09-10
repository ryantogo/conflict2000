/**
 * Scripted history.
 *
 * These fire on their real dates, but every one of them is conditional and
 * most can be pre-empted by the player. The point is not to replay 2000-2001
 * on rails — the manual is emphatic that "each game of CONFLICT puts the
 * Middle East in a different condition" — but to make the opening months feel
 * like the ones that actually happened, and then let them diverge.
 */

import type { GameState } from '../engine/types';
import { clamp, pointsToRelations } from '../engine/ladders';
import type { Rng } from '../engine/rng';
import { expand } from './headlines';
import { adjustRelations } from '../engine/powers';

export interface ScriptedEvent {
  id: string;
  /** Year and month (0-indexed) on which it becomes eligible. */
  year: number;
  month: number;
  /** Extra conditions beyond the date. */
  when?: (s: GameState) => boolean;
  /** Returns headlines to print. Mutates state. */
  fire: (s: GameState, rng: Rng) => { text: string; weight: number }[];
}

export const SCRIPTED: ScriptedEvent[] = [
  {
    // 10 June 2000. The single most consequential thing that happens in the
    // opening month, and the player has no say in it whatsoever.
    id: 'assad-dies',
    year: 2000,
    month: 5,
    when: (s) => !s.nations.syria.collapsed,
    fire: (s, rng) => {
      const syria = s.nations.syria;
      syria.leader = 'Bashar al-Assad';
      // A young ophthalmologist inherits his father's security state. The old
      // guard is loyal but watchful; the succession is a real wobble.
      syria.stability = clamp(syria.stability - rng.int(8, 16), 0, 100);
      syria.oppositionStrength = clamp(syria.oppositionStrength + rng.int(4, 10), 0, 100);
      // Damascus is inward-looking for a while.
      syria.relationsPoints = clamp(syria.relationsPoints + 6, -100, 100);
      syria.relations = pointsToRelations(syria.relationsPoints);
      s.tension = clamp(s.tension + 5, 0, 100);
      return [
        { text: 'Hafez al-Assad dies after thirty years in power', weight: 3 },
        { text: 'Damascus moves fast: Bashar al-Assad named successor', weight: 2 },
        { text: 'Syrian constitut^ amended in hours to fit new leader', weight: 1 },
      ];
    },
  },
  {
    // The summit itself is handled by the summit phase; this is the run-up.
    id: 'camp-david-called',
    year: 2000,
    month: 5,
    fire: () => [
      { text: 'Clinton summons Barak and Arafat to Camp David', weight: 3 },
      { text: 'U.S. Foreign Secretary hints at a summit this July', weight: 1 },
    ],
  },
  {
    id: 'lebanon-withdrawal-aftermath',
    year: 2000,
    month: 5,
    fire: (s) => {
      // Hezbollah takes the credit, and the credit is worth something.
      s.nations.lebanon.oppositionStrength = clamp(
        s.nations.lebanon.oppositionStrength + 5,
        0,
        100,
      );
      return [
        { text: 'Hezbollah claims south Lebanon as first Arab victory over Israel', weight: 2 },
        { text: 'U.N. certifies Israeli withdrawal to the Blue Line', weight: 1 },
      ];
    },
  },
  {
    // 28 September 2000. Conditional: a calm West Bank does not ignite.
    id: 'second-intifada',
    year: 2000,
    month: 8,
    // A summit that collapsed over Jerusalem is reason enough on its own;
    // otherwise the territories have to already be restive.
    when: (s) =>
      !s.palestine.homelandCreated &&
      (s.firedEvents.includes('camp-david-refused') || s.palestine.unrest >= 3),
    fire: (s, rng) => {
      s.palestine.intifada = true;
      s.palestine.unrest = clamp(s.palestine.unrest + rng.int(2, 4), 0, 10);
      s.israel.popularity = clamp(s.israel.popularity - 12, 0, 100);
      s.tension = clamp(s.tension + 12, 0, 100);
      for (const n of Object.values(s.nations)) {
        if (!n.collapsed) {
          n.relationsPoints = clamp(n.relationsPoints - 12, -100, 100);
          n.relations = pointsToRelations(n.relationsPoints);
        }
      }
      return [
        { text: 'Temple Mount visit sparks riots across the territories', weight: 3 },
        { text: 'Al-Aqsa Intifada: the streets are gone', weight: 3 },
        { text: 'Arab capitals recall ambassadors from Tel Aviv', weight: 2 },
      ];
    },
  },
  {
    // 7 October 2000.
    id: 'hezbollah-abduction',
    year: 2000,
    month: 9,
    when: (s) => !s.nations.lebanon.collapsed && s.nations.lebanon.oppositionStrength > 45,
    fire: (s) => {
      s.fronts.lebanon.enemyActivity = Math.max(s.fronts.lebanon.enemyActivity, 2);
      s.israel.popularity = clamp(s.israel.popularity - 6, 0, 100);
      s.tension = clamp(s.tension + 7, 0, 100);
      return [
        { text: 'Three soldiers seized on the Blue Line', weight: 3 },
        { text: 'Knesset demands answers as border erupts again', weight: 1 },
      ];
    },
  },
  {
    id: 'uss-cole',
    year: 2000,
    month: 9,
    fire: (s) => {
      // Washington's threat perception shifts, and its patience shortens.
      adjustRelations(s, 'usa', 3);
      return [{ text: 'U.S. destroyer bombed in Aden harbour', weight: 2 }];
    },
  },
  {
    // Clinton leaves; the new administration is less invested in the process.
    id: 'bush-inauguration',
    year: 2001,
    month: 0,
    fire: (s) => {
      adjustRelations(s, 'usa', -5);
      return [
        { text: 'Bush sworn in; White House signals step back from the process', weight: 2 },
      ];
    },
  },
  {
    // The historical answer to a collapsed process and a burning West Bank.
    id: 'election-pressure',
    year: 2001,
    month: 1,
    when: (s) => s.israel.popularity < 35,
    fire: (s) => {
      s.israel.popularity = clamp(s.israel.popularity - 5, 0, 100);
      return [
        { text: 'Knesset moves toward early elect^s', weight: 3 },
        { text: 'Right wing scents blood as premiers coalit^ fractures', weight: 2 },
      ];
    },
  },
];

export function runScripted(s: GameState, rng: Rng): { text: string; weight: number }[] {
  const out: { text: string; weight: number }[] = [];
  for (const ev of SCRIPTED) {
    if (s.firedEvents.includes(ev.id)) continue;
    if (s.year !== ev.year || s.month !== ev.month) continue;
    if (ev.when && !ev.when(s)) {
      // Its moment has passed; do not fire it later out of context.
      s.firedEvents.push(ev.id);
      continue;
    }
    s.firedEvents.push(ev.id);
    // Scripted copy is written in the same clipped house style as the rest of
    // the paper, so it goes through the expander too.
    for (const e of ev.fire(s, rng)) {
      out.push({ text: expand(e.text), weight: e.weight });
    }
  }
  return out;
}
