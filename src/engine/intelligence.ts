/**
 * Mossad.
 *
 * Funding insurgents is slow, cheap and deniable. Assassination and coups are
 * fast, expensive and — when they fail — extremely loud. The original gated
 * the extreme options behind an already-strong opposition group, which is what
 * makes the patient route worth taking.
 */

import type { GameState, IntelDirective, NationId } from './types';
import { clamp } from './ladders';
import type { Rng } from './rng';
import {
  ASSASSINATION_FAIL,
  ASSASSINATION_SUCCESS,
  COUP_FAIL,
  COUP_SUCCESS,
  expand,
} from '../data/headlines';
import { adjustRelations } from './powers';

export interface IntelOption {
  id: IntelDirective;
  label: string;
  disabledReason?: string;
}

/** Extreme measures unlock once the opposition is a real force. */
export const EXTREME_THRESHOLD = 70;

/**
 * Mossad is large but not infinite. Every operation costs capacity points,
 * and running more than this in one month degrades all of them and gets
 * people caught. This is what stops the player from quietly dismantling four
 * governments in parallel.
 */
export const MOSSAD_CAPACITY = 4;

const OP_COST: Record<IntelDirective, number> = {
  support_insurgents: 1,
  disrupt_insurgents: 1,
  assassinate: 3,
  coup: 4,
  none: 0,
};

const OP_FUNDS: Record<IntelDirective, number> = {
  support_insurgents: 18,
  disrupt_insurgents: 14,
  assassinate: 60,
  coup: 90,
  none: 0,
};

/** Capacity committed by the directives currently queued. */
export function committedCapacity(s: GameState): number {
  let total = 0;
  for (const d of Object.values(s.directives.intel)) {
    if (d) total += OP_COST[d];
  }
  return total;
}

/** Only one decapitation may be attempted in any one month. */
export function extremeOpQueued(s: GameState, except?: NationId): boolean {
  for (const [id, d] of Object.entries(s.directives.intel)) {
    if (id === except) continue;
    if (d === 'assassinate' || d === 'coup') return true;
  }
  return false;
}

/** "$60 M" — the price tag the nuclear programme has always shown and this never did. */
function price(d: IntelDirective): string {
  return ` — $${OP_FUNDS[d]} M`;
}

export function intelOptions(s: GameState, id: NationId): IntelOption[] {
  const n = s.nations[id];
  if (n.collapsed) {
    return [{ id: 'none', label: 'Take no action', disabledReason: `${n.name} is in an anarchic state.` }];
  }

  const opts: IntelOption[] = [];

  if (n.oppositionStrength < 8) {
    opts.push({
      id: 'support_insurgents',
      label: `Attempt to start serious anti-government group${price('support_insurgents')}`,
    });
    opts.push({ id: 'none', label: 'Make no attempt to destabilize government' });
    return opts;
  }

  opts.push({
    id: 'support_insurgents',
    label: `Support current activities of insurgents${price('support_insurgents')}`,
  });
  opts.push({
    id: 'disrupt_insurgents',
    label: `Disrupt insurgent group thereby helping government${price('disrupt_insurgents')}`,
  });

  if (n.oppositionStrength >= EXTREME_THRESHOLD) {
    const busy = extremeOpQueued(s, id)
      ? 'Mossad can only mount one operation of this kind in a month.'
      : undefined;
    opts.push({
      id: 'assassinate',
      label: `Assassinate leader${price('assassinate')}`,
      ...(busy ? { disabledReason: busy } : {}),
    });
    opts.push({
      id: 'coup',
      label: `Start coup${price('coup')}`,
      ...(busy ? { disabledReason: busy } : {}),
    });
  } else {
    opts.push({
      id: 'assassinate',
      label: 'Consider extreme measures',
      disabledReason:
        'The opposition inside that country is not yet strong enough to act through.',
    });
  }

  opts.push({ id: 'none', label: 'Take no action' });
  return opts;
}

export interface IntelEvent {
  text: string;
  category: 'intelligence';
  weight: number;
}

export function resolveIntelligence(s: GameState, rng: Rng): IntelEvent[] {
  const events: IntelEvent[] = [];

  // Overload penalty: every point of capacity past the ceiling degrades every
  // operation this month and makes exposure more likely.
  const load = committedCapacity(s);
  const overload = Math.max(0, load - MOSSAD_CAPACITY);
  const strain = 1 / (1 + overload * 0.45);

  // Counter-intelligence cools off wherever we are not currently working.
  const worked = new Set(
    Object.entries(s.directives.intel)
      .filter(([, d]) => d && d !== 'none')
      .map(([id]) => id),
  );
  for (const n of Object.values(s.nations)) {
    if (worked.has(n.id)) continue;
    n.counterIntel = clamp(n.counterIntel - 6, 0, 100);
    // Our posture is what we are doing now, not what we once did. Leaving it
    // set marked a country for the rest of the game and quietly blocked every
    // future attempt to improve relations with it.
    n.israeliPosture = 'neutral';
  }

  /** A failed or noisy operation gets noticed, and being noticed costs. */
  const expose = (n: (typeof s.nations)[NationId], severity: number) => {
    adjustRelations(s, 'usa', -severity * 2);
    s.israel.prestige = clamp(s.israel.prestige - severity, 0, 100);
    s.tension = clamp(s.tension + severity, 0, 100);
    n.counterIntel = clamp(n.counterIntel + severity * 4, 0, 100);
    n.relationsPoints = clamp(n.relationsPoints - severity * 3, -100, 100);
  };

  for (const [key, directive] of Object.entries(s.directives.intel)) {
    const id = key as NationId;
    const n = s.nations[id];
    if (!directive || directive === 'none' || n.collapsed) continue;

    // Everything costs money, and simultaneous operations cost more each.
    s.israel.funds = Math.max(
      0,
      s.israel.funds - Math.round(OP_FUNDS[directive] * (1 + overload * 0.3)),
    );

    const ctx = {
      subjAdj: n.adjective,
      subjName: n.name,
      subjCapital: n.capital,
      objAdj: 'Israeli',
      objName: 'Israel',
      objCapital: 'Jerusalem',
    };

    switch (directive) {
      case 'support_insurgents': {
        n.israeliPosture = 'supporting_opposition';
        n.counterIntel = clamp(n.counterIntel + rng.int(5, 10), 0, 100);
        // Harder to grow an opposition inside a solid, watchful state.
        const resistance = 0.4 + (n.stability / 100) * 1.2 + (n.counterIntel / 100) * 1.4;
        const growth = Math.round((rng.int(5, 11) / resistance) * strain);
        n.oppositionStrength = clamp(n.oppositionStrength + growth, 0, 100);
        n.stability = clamp(n.stability - Math.round(growth * 0.45), 0, 100);
        // The longer you fund them, the likelier somebody talks.
        if (rng.chance(0.06 + n.counterIntel / 260 + overload * 0.05)) {
          expose(n, 3);
          events.push({
            text: expand('Israel condemned for planning terrorist act^ in #.', ctx),
            category: 'intelligence',
            weight: 2,
          });
        }
        break;
      }

      case 'disrupt_insurgents': {
        n.israeliPosture = 'supporting_government';
        n.counterIntel = clamp(n.counterIntel + rng.int(2, 5), 0, 100);
        const cut = Math.round(rng.int(6, 13) * strain);
        n.oppositionStrength = clamp(n.oppositionStrength - cut, 0, 100);
        n.stability = clamp(n.stability + Math.round(cut * 0.4), 0, 100);
        n.relationsPoints = clamp(n.relationsPoints + 3, -100, 100);
        break;
      }

      case 'assassinate': {
        if (n.oppositionStrength < EXTREME_THRESHOLD) break;
        s.stats.assassinationsOrdered++;
        s.stats.actsOfViolence++;
        n.counterIntel = clamp(n.counterIntel + rng.int(14, 24), 0, 100);
        // Weak, unstable, unsuspecting states are easier to decapitate.
        const p =
          (0.12 + (n.oppositionStrength / 100) * 0.34 + (1 - n.stability / 100) * 0.22) *
          (1 - n.counterIntel / 170) *
          strain;
        if (rng.chance(p)) {
          collapseGovernment(s, id, 'assassination');
          // Even a success is attributed, and the region draws conclusions.
          expose(n, 4);
          events.push({
            text: expand(rng.pick(ASSASSINATION_SUCCESS), ctx),
            category: 'intelligence',
            weight: 3,
          });
        } else {
          // A failed attempt hands the regime a gift and burns the network.
          n.stability = clamp(n.stability + 10, 0, 100);
          n.oppositionStrength = clamp(n.oppositionStrength - rng.int(20, 35), 0, 100);
          expose(n, 8);
          events.push({
            text: expand(rng.pick(ASSASSINATION_FAIL), ctx),
            category: 'intelligence',
            weight: 3,
          });
        }
        break;
      }

      case 'coup': {
        if (n.oppositionStrength < EXTREME_THRESHOLD) break;
        s.stats.coupsOrdered++;
        s.stats.actsOfViolence++;
        n.counterIntel = clamp(n.counterIntel + rng.int(18, 30), 0, 100);
        const p =
          (0.1 + (n.oppositionStrength / 100) * 0.42 + (1 - n.stability / 100) * 0.26) *
          (1 - n.counterIntel / 170) *
          strain;
        if (rng.chance(p)) {
          collapseGovernment(s, id, 'coup');
          expose(n, 5);
          events.push({
            text: expand(rng.pick(COUP_SUCCESS), ctx),
            category: 'intelligence',
            weight: 3,
          });
        } else {
          n.stability = clamp(n.stability + 14, 0, 100);
          n.oppositionStrength = clamp(n.oppositionStrength - rng.int(30, 50), 0, 100);
          expose(n, 10);
          events.push({
            text: expand(rng.pick(COUP_FAIL), ctx),
            category: 'intelligence',
            weight: 3,
          });
        }
        break;
      }
    }
  }

  return events;
}

/**
 * A government falls. Per the manual, "once a government has collapsed, it
 * cannot recover again within the time span of the game".
 */
export function collapseGovernment(
  s: GameState,
  id: NationId,
  cause: NonNullable<GameState['nations'][NationId]['collapseCause']>,
): void {
  const n = s.nations[id];
  if (n.collapsed) return;
  n.collapsed = true;
  n.collapseCause = cause;
  n.stability = 0;
  n.atWarWith = [];
  n.pactWith = [];
  s.tension = clamp(s.tension + 5, 0, 100);
  // Any front against them goes quiet — there is nobody left to command it.
  if (n.isFront) {
    const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
    front.atWar = false;
    front.enemyActivity = 0;
    front.warMonths = 0;
  }
  s.log.unshift(`${n.name}: government collapsed (${cause}).`);
}

/** Natural drift in opposition strength and regime stability, absent Israel. */
export function driftInternals(s: GameState, rng: Rng): void {
  for (const n of Object.values(s.nations)) {
    if (n.collapsed) continue;

    // Regimes recover. A security state that is not being worked on drifts
    // back toward its natural level, so pressure has to be sustained to tell.
    n.stability = clamp(n.stability + (n.baseStability - n.stability) * 0.14, 0, 100);

    // A genuinely powerful opposition erodes the state under its own momentum.
    if (n.oppositionStrength > 55) {
      n.stability = clamp(n.stability - rng.int(0, 3), 0, 100);
    }
    // A solid regime grinds a weak opposition down.
    if (n.stability > 65 && n.israeliPosture !== 'supporting_opposition') {
      n.oppositionStrength = clamp(n.oppositionStrength - rng.int(0, 2), 0, 100);
    }
    // War is corrosive.
    if (n.atWarWith.length > 0) {
      n.stability = clamp(n.stability - rng.int(1, 4), 0, 100);
    }
    // Small random walk so no two games read the same.
    n.stability = clamp(n.stability + rng.int(-1, 1), 0, 100);

    // A state can simply fall apart. Lebanon, per the manual, "could collapse
    // in its own time of its own accord". Whether the history books call it an
    // insurgency or simply rot depends on whether anybody was standing ready
    // to take over — which is the one thing Israel can have arranged.
    if (n.stability <= 4 && rng.chance(0.5)) {
      const cause = n.oppositionStrength >= EXTREME_THRESHOLD ? 'insurgency' : 'internal';
      collapseGovernment(s, n.id, cause);
    }
  }
}
