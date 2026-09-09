/**
 * The Nuclear Club.
 *
 * The 1990 original started Israel with no bomb and made building one the
 * long game. By 2000 that fiction has expired, so the ladder here is about
 * *posture* rather than possession: Israel has warheads and says nothing.
 * Each rung up buys deterrence and costs standing with Washington, and the
 * top rung — an actual test — is very hard to walk back.
 */

import type { GameState, NuclearPosture } from './types';
import { clamp } from './ladders';
import type { Rng } from './rng';
import { NUCLEAR, expand } from '../data/headlines';

const ORDER: NuclearPosture[] = ['opacity', 'signalled', 'declared', 'tested'];

export const POSTURE_LABEL: Record<NuclearPosture, string> = {
  opacity: 'Deliberate ambiguity',
  signalled: 'Signalled capability',
  declared: 'Declared nuclear power',
  tested: 'Demonstrated by test',
};

export function postureReport(s: GameState): string[] {
  const { nuclearPosture: p, nuclearProgress: prog, warheads } = s.israel;
  const out: string[] = [];

  out.push(`Current posture: ${POSTURE_LABEL[p]}.`);
  out.push(`Deliverable devices in the Negev: ${warheads}.`);

  if (p === 'tested') {
    out.push('There is nothing further to demonstrate. The world is in no doubt.');
    return out;
  }

  const remaining = Math.ceil((100 - prog) / 25);
  if (prog >= 100) {
    out.push('The programme is ready to take the next step on your word.');
  } else if (remaining <= 1) {
    out.push('The device is almost ready for testing. Next month we should be ready.');
  } else if (remaining === 2) {
    out.push(
      'Further funding is necessary to perfect the triggering mechanism. ' +
        'It is estimated another two months are required.',
    );
  } else {
    out.push(
      `We require further funding before the next step. ` +
        `Another ${remaining} months are required.`,
    );
  }
  return out;
}

export function resolveNuclear(s: GameState, rng: Rng): { text: string; weight: number }[] {
  const events: { text: string; weight: number }[] = [];
  const isr = s.israel;

  if (s.directives.fundNuclear) {
    // Funding is expensive and comes straight out of procurement.
    isr.funds = Math.max(0, isr.funds - 55);
    isr.nuclearProgress = clamp(isr.nuclearProgress + rng.int(18, 30), 0, 100);

    if (isr.nuclearProgress >= 100) {
      const i = ORDER.indexOf(isr.nuclearPosture);
      if (i < ORDER.length - 1) {
        isr.nuclearPosture = ORDER[i + 1];
        isr.nuclearProgress = 0;
        isr.warheads += rng.int(1, 3);

        switch (isr.nuclearPosture) {
          case 'signalled':
            // A leak, a photograph, a minister who says too much.
            s.tension = clamp(s.tension + 6, 0, 100);
            isr.usRelations = clamp(isr.usRelations - 5, 0, 100);
            events.push({ text: 'West concerned by Middle East nuclear situation', weight: 2 });
            break;
          case 'declared':
            s.tension = clamp(s.tension + 14, 0, 100);
            isr.usRelations = clamp(isr.usRelations - 16, 0, 100);
            isr.prestige = clamp(isr.prestige + 8, 0, 100);
            events.push({ text: 'Israel abandons ambiguity: <We are a nuclear power>', weight: 3 });
            break;
          case 'tested':
            s.tension = clamp(s.tension + 22, 0, 100);
            isr.usRelations = clamp(isr.usRelations - 24, 0, 100);
            isr.prestige = clamp(isr.prestige + 12, 0, 100);
            events.push({ text: 'Recent tremor evidence of atomic testing', weight: 3 });
            break;
          case 'opacity':
            break;
        }
      }
    }
  }

  // Everyone else is working too.
  for (const n of Object.values(s.nations)) {
    if (n.collapsed || n.hasNuclear) continue;
    // Rich, stable, motivated states move faster.
    const rate = (n.stability / 100) * (n.atWarWith.length > 0 ? 1.6 : 1.0);
    n.nuclearProgress = clamp(n.nuclearProgress + rng.next() * 2.2 * rate, 0, 100);

    if (n.nuclearProgress >= 100) {
      n.hasNuclear = true;
      s.tension = clamp(s.tension + 18, 0, 100);
      events.push({
        text: expand(rng.pick(NUCLEAR), {
          subjAdj: n.adjective,
          subjName: n.name,
          subjCapital: n.capital,
        }),
        weight: 3,
      });
    } else if (n.nuclearProgress > 70 && rng.chance(0.08)) {
      events.push({
        text: `U.S. satellite has sighted a nuclear installation in ${n.name}`,
        weight: 2,
      });
    }
  }

  return events;
}

/**
 * Whether the region tips into general nuclear exchange. The manual warns
 * that "the probability of nuclear holocaust increases as tension builds".
 */
export function holocaustCheck(s: GameState, rng: Rng): boolean {
  if (s.tension < 85) return false;
  const armed = Object.values(s.nations).filter((n) => n.hasNuclear && !n.collapsed).length;
  if (armed === 0 && s.stats.nukesUsed === 0) return false;
  const p = ((s.tension - 85) / 15) * 0.1 + armed * 0.03 + s.stats.nukesUsed * 0.15;
  return rng.chance(clamp(p, 0, 0.85));
}

/** The most dangerous programme in the region, for the Nuclear Club screen. */
export function mostDangerousThreat(s: GameState): string {
  let worst: { name: string; score: number } | null = null;
  for (const n of Object.values(s.nations)) {
    if (n.collapsed) continue;
    const score = n.nuclearProgress + (n.hasNuclear ? 100 : 0) + (9 - n.relations) * 3;
    if (!worst || score > worst.score) worst = { name: n.name, score };
  }
  return worst ? worst.name : 'None';
}
