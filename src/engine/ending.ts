/**
 * The Leadership Analysis screen.
 *
 * The original closed every game with the same six-line report card and a
 * score, and it is the part people remember: it tells you what kind of prime
 * minister you turned out to be, which is not always what you intended.
 */

import type { Ending, EndingKind, GameState } from './types';
import { FRONTS } from './types';
import { prestigeLabel } from './ladders';
import { relationsWith } from './powers';

const QUALITY = [
  'a complete joke.',
  'a total failure.',
  'quite inept.',
  'not memorable.',
  'not impressive.',
  'quite impressive.',
  'very impressive.',
  'inspired !',
  'superb !',
  'amazing !!',
];

const ENDING_TEXT: Record<EndingKind, { headline: string; body: string }> = {
  victory: {
    headline: 'Israeli premier retires in glory!',
    body:
      'You have achieved your political objectives. Perhaps you were a bit rough ' +
      'in the process, but you may retire in peace.',
  },
  removed_by_knesset: {
    headline: 'The Israeli premier has resigned',
    body:
      'As Israel erupts into civil strife, you wonder if you could have done any better.',
  },
  defeated_at_polls: {
    headline: 'Premier concedes defeat as the country votes him out',
    body:
      'You went to the country and the country answered. It is the most honourable way ' +
      'to lose office in this region, and you wonder whether you should have waited.',
  },
  assassinated: {
    headline: 'The Israeli premier has been assassinated',
    body: 'As the soldiers come to take you away, you wonder if you could have done any better.',
  },
  invaded: {
    headline: 'Israel invaded! Premier hanged',
    body: 'As the soldiers come to take you away, you wonder if you could have done any better.',
  },
  holocaust: {
    headline: 'U.S. president makes goodbye speech from bunker',
    body:
      'As the world is drawn into a Nuclear Holocaust by your actions, you wonder ' +
      'if you could have served mankind any better.',
  },
  holocaust_bystander: {
    headline: '<The End Of The World Is Nigh> says B.B.C.',
    body:
      'Although you did not push the button, a Nuclear Holocaust has destroyed Earth. ' +
      'Could you have prevented it?',
  },
  survived: {
    headline: 'Israelis cheer great premier!',
    body: 'A decade in office. Whatever else they say of you, you lasted.',
  },
};

function survivalLine(months: number): string {
  if (months < 12) return `-You survived only ${months} months.`;
  if (months < 24) return `-You survived one year and ${months - 12} months.`;
  if (months < 60) return `-You survived ${months} months in office.`;
  return '-You hung on to power for a long time!';
}

function controlLine(count: number): string {
  switch (count) {
    case 0:
      return '-There are no states under Israeli control.';
    case 1:
      return '-There is only one state under Israeli control.';
    case 2:
      return '-There are two states under Israeli control.';
    case 3:
      return '-There are three states under Israeli control.';
    default:
      return '-All border states under Israeli control.';
  }
}

function violenceLine(acts: number): string {
  if (acts === 0) return '-You committed no acts of violence.';
  if (acts < 5) return '-You committed few acts of violence.';
  if (acts < 15) return '-You committed numerous acts of violence.';
  return '-You committed copious acts of violence.';
}

function usLine(rel: number): string {
  if (rel >= 70) return '-Relations with the U.S. are excellent.';
  if (rel >= 50) return '-Relations with the U.S. are good.';
  if (rel >= 30) return '-Relations with the U.S. are poor.';
  return '-Relations with the U.S. are sour.';
}

/**
 * The style label is derived from behaviour, not intent — which is the joke.
 * Take four neighbours by force and the game will call you a Fascist however
 * carefully you managed the newspapers.
 */
function leadershipStyle(s: GameState): string {
  const v = s.stats.actsOfViolence;
  const covert = s.stats.assassinationsOrdered + s.stats.coupsOrdered;

  if (s.stats.nukesUsed > 0) return 'Extreme';
  if (v >= 15) return 'Fascist';
  if (v >= 6) return 'Violent';
  if (covert >= 3) return 'Extreme';
  if (s.palestine.homelandCreated && v <= 2) return 'Liberal';
  if (s.israel.popularity >= 65) return 'Popular';
  return 'Diplomatic';
}

export function computeEnding(s: GameState, kind: EndingKind): Ending {
  const collapsed = FRONTS.filter((f) => s.nations[f].collapsed).length;

  // Score rewards durability, results and standing — and punishes catastrophe.
  let score = 0;
  score += s.turn * 2;
  score += collapsed * 70;
  score += Math.round(s.israel.prestige * 1.2);
  score += Math.round(relationsWith(s, 'usa') * 0.5);
  score += s.palestine.homelandCreated ? 60 : 0;
  score -= Math.round(s.palestine.unrest * 8);
  score -= s.stats.nukesUsed * 150;
  if (kind === 'victory') score += 200;
  if (kind === 'survived') score += 60;
  if (kind === 'invaded' || kind === 'assassinated') score -= 120;
  if (kind === 'removed_by_knesset') score -= 80;
  // Losing a vote you called is a better end than being thrown out by the House.
  if (kind === 'defeated_at_polls') score -= 40;
  if (kind === 'holocaust') score = Math.min(score, -200);
  if (kind === 'holocaust_bystander') score = Math.min(score, 0);
  score = Math.round(score);

  const text = ENDING_TEXT[kind];

  return {
    kind,
    headline: text.headline,
    body: text.body,
    score,
    style: leadershipStyle(s),
    analysis: [
      survivalLine(s.turn),
      controlLine(collapsed),
      violenceLine(s.stats.actsOfViolence),
      usLine(relationsWith(s, 'usa')),
      `-Our Prestige ended as ${prestigeLabel(s.israel.prestige)}.`,
      `-Leadership Style: ${leadershipStyle(s)}.`,
    ],
  };
}

/**
 * Score-to-verdict thresholds, calibrated against the original: a surviving
 * screenshot of the 1990 game shows an Analysis Score of 338 described as
 * "superb !", with "amazing !!" reserved for something better still.
 */
const QUALITY_CUTS = [-100, 0, 60, 120, 180, 240, 290, 330, 400];

export function qualityPhrase(score: number): string {
  let i = 0;
  while (i < QUALITY_CUTS.length && score >= QUALITY_CUTS[i]) i++;
  return QUALITY[i];
}
