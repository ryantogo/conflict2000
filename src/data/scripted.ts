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

/** The chance the September 2001 plot is broken up before it is carried out. */
export const NINE_ELEVEN_FOILED = 0.15;

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
  // The Second Intifada used to be here, on rails for 28 September 2000. It is
  // now a monthly hazard in `palestine.ts`, shaped by how Camp David ended.
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
    // 11 September 2001. Nineteen men, and a plot that very nearly came apart
    // more than once — the Moussaoui arrest, the Phoenix memo — so it does not
    // always happen.
    id: 'nine-eleven',
    year: 2001,
    month: 8,
    fire: (s, rng) => {
      if (rng.chance(NINE_ELEVEN_FOILED)) {
        s.world.nineEleven = 'foiled';
        adjustRelations(s, 'usa', 3);
        return [
          { text: 'FBI arrests hijacking cell days before planned attacks', weight: 3 },
          { text: 'Israeli intelligence credited with tip-off', weight: 1 },
        ];
      }
      s.world.nineEleven = 'happened';
      s.world.nineElevenTurn = s.turn;
      // Washington's threat perception changes overnight, and so does what it
      // is prepared to sell, pay for and look away from.
      adjustRelations(s, 'usa', 8);
      s.israel.suppliers.usa.loyalty = clamp(s.israel.suppliers.usa.loyalty + 10, 0, 100);
      s.tension = clamp(s.tension + 6, 0, 100);
      return [
        { text: 'Terror attacks on New York and Washington', weight: 3 },
        { text: 'Bush declares war on terror: <Either you are with us, or with the terrorists>', weight: 3 },
        { text: 'Washington asks Israel to hold fire while it builds a coalition', weight: 2 },
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
