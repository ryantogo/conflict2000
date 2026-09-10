/**
 * The other seven capitals.
 *
 * The original's central conceit is that you are not the only actor: states
 * court each other, fall out, and invade each other whether or not Israel is
 * involved, and a rival can collapse without you having lifted a finger. This
 * module runs one month of everybody else's foreign policy.
 */

import type { GameState, Nation, NationId } from './types';
import { NATION_IDS } from './types';
import { clamp, pointsToRelations } from './ladders';
import type { Rng } from './rng';
import {
  COLLAPSE,
  RELATIONS_IMPROVE,
  RELATIONS_WORSEN,
  WAR_DECLARED,
  expand,
} from '../data/headlines';
import { resolveRegionalWars, setInterArab, startRegionalWar } from './wars';

export interface AiEvent {
  text: string;
  category: 'diplomacy' | 'war' | 'intelligence';
  weight: number;
}

function pairCtx(a: Nation, b: Nation) {
  return {
    subjAdj: a.adjective,
    subjName: a.name,
    subjCapital: a.capital,
    objAdj: b.adjective,
    objName: b.name,
    objCapital: b.capital,
  };
}

function rel(a: Nation, b: NationId): number {
  return a.interArab[b] ?? 4;
}

const setRel = setInterArab;

/** How much this state wants to move against Israel this month. */
function hostilityToIsrael(s: GameState, n: Nation): number {
  let h = (9 - n.relations) * 6;
  // A shaky regime looks for an external enemy.
  h += (100 - n.stability) * 0.25;
  // Israeli forces massed on the border are read as intent.
  if (n.isFront) {
    const front = s.fronts[n.id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
    h += front.deployed.brigades * 7;
  }
  h += s.palestine.unrest * 2.5;
  h += (s.tension - 50) * 0.3;
  // Nobody attacks a nuclear power lightly.
  if (s.israel.nuclearPosture !== 'opacity') h -= 22;
  if (n.pactWith.includes('israel')) h -= 60;
  return h;
}

export function runAi(s: GameState, rng: Rng): AiEvent[] {
  const events: AiEvent[] = [];
  const living = NATION_IDS.filter((id) => !s.nations[id].collapsed);

  // --- inter-Arab diplomacy ------------------------------------------------
  for (const a of rng.shuffle(living)) {
    if (!rng.chance(0.35)) continue;
    const others = living.filter((o) => o !== a);
    if (others.length === 0) continue;
    const b = rng.pick(others);
    const na = s.nations[a];
    const nb = s.nations[b];
    const current = rel(na, b);

    // States drift toward or away from each other; shared enemies pull them
    // together, shared borders push them apart.
    const bothHostileToIsrael = na.relations <= 2 && nb.relations <= 2;
    const drift = bothHostileToIsrael ? rng.int(0, 2) : rng.int(-1, 1);
    setRel(s, a, b, current + drift);

    if (drift > 0 && current + drift >= 8 && rng.chance(0.3)) {
      if (!na.pactWith.includes(b)) {
        na.pactWith.push(b);
        nb.pactWith.push(a);
        events.push({
          text: expand(rng.pick(RELATIONS_IMPROVE), pairCtx(na, nb)),
          category: 'diplomacy',
          weight: 2,
        });
        // Two of your neighbours getting along is rarely good news.
        if (bothHostileToIsrael) s.tension = clamp(s.tension + 4, 0, 100);
      }
    } else if (drift < 0 && current + drift <= 2 && rng.chance(0.25)) {
      events.push({
        text: expand(rng.pick(RELATIONS_WORSEN), pairCtx(na, nb)),
        category: 'diplomacy',
        weight: 1,
      });
    }
  }

  // --- wars between the other states --------------------------------------
  for (const a of rng.shuffle(living)) {
    const na = s.nations[a];
    if (na.collapsed || na.atWarWith.length > 0) continue;
    const targets = living.filter(
      (o) => o !== a && rel(na, o) <= 1 && !s.nations[o].collapsed,
    );
    if (targets.length === 0) continue;
    const b = rng.pick(targets);
    const nb = s.nations[b];

    // Strong states attack weak neighbours they already despise.
    const advantage = na.forces.brigades / Math.max(1, nb.forces.brigades);
    const p = clamp((advantage - 1) * 0.06 + (1 - nb.stability / 100) * 0.05, 0, 0.14);
    if (!rng.chance(p)) continue;

    startRegionalWar(s, a, b);
    s.tension = clamp(s.tension + 10, 0, 100);
    events.push({
      text: expand(rng.pick(WAR_DECLARED), pairCtx(na, nb)),
      category: 'war',
      weight: 3,
    });
  }

  // --- resolve wars that do not involve Israel -----------------------------
  events.push(...resolveRegionalWars(s, rng));

  // --- moves against Israel ------------------------------------------------
  for (const id of rng.shuffle(living)) {
    const n = s.nations[id];
    if (!n.isFront || n.atWarWith.includes('israel')) continue;
    const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
    if (front.demilitarised) continue;

    const h = hostilityToIsrael(s, n);

    // Build-up first, invasion later.
    if (h > 45 && front.enemyActivity < 3 && rng.chance(0.3)) {
      front.enemyActivity++;
      s.tension = clamp(s.tension + 3, 0, 100);
      if (front.enemyActivity >= 2) {
        events.push({
          text: expand('*-@ relat^s sour as } gather', {
            subjAdj: n.adjective,
            subjName: n.name,
            subjCapital: n.capital,
            objAdj: 'Israeli',
            objName: 'Israel',
            objCapital: 'Jerusalem',
          }),
          category: 'diplomacy',
          weight: 2,
        });
      }
    } else if (h < 25 && front.enemyActivity > 0 && rng.chance(0.35)) {
      front.enemyActivity--;
    }

    // The actual decision to attack.
    if (front.enemyActivity >= 3 && n.relations <= 2) {
      const alliesJoining = Object.values(s.nations).filter(
        (o) => !o.collapsed && o.id !== n.id && o.pactWith.includes(n.id) && o.relations <= 3,
      );
      const p = clamp((h - 60) / 320 + alliesJoining.length * 0.03, 0, 0.3);
      if (rng.chance(p)) {
        front.atWar = true;
        front.warMonths = 0;
        front.warProgress = -10;
        n.atWarWith.push('israel');
        s.tension = clamp(s.tension + 16, 0, 100);
        events.push({
          text: expand(rng.pick(WAR_DECLARED), {
            subjAdj: n.adjective,
            subjName: n.name,
            subjCapital: n.capital,
            objAdj: 'Israeli',
            objName: 'Israel',
            objCapital: 'Jerusalem',
          }),
          category: 'war',
          weight: 3,
        });

        for (const ally of alliesJoining) {
          if (ally.isFront && !ally.atWarWith.includes('israel')) {
            ally.atWarWith.push('israel');
            const af = s.fronts[ally.id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
            af.atWar = true;
            af.warProgress = -10;
            events.push({
              text: expand('# joins in attack against _', {
                subjName: ally.name,
                objName: 'Israel',
              }),
              category: 'war',
              weight: 3,
            });
          }
        }
      }
    }
  }

  // --- collapse notices ----------------------------------------------------
  for (const id of NATION_IDS) {
    const n = s.nations[id];
    if (n.collapsed && !s.firedEvents.includes(`collapse-${id}`)) {
      s.firedEvents.push(`collapse-${id}`);
      events.push({
        text: expand(rng.pick(COLLAPSE), {
          subjAdj: n.adjective,
          subjName: n.name,
          subjCapital: n.capital,
          objName: n.name,
        }),
        category: 'intelligence',
        weight: 3,
      });
    }
  }

  // Keep the visible ladder in step with the point pools.
  for (const n of Object.values(s.nations)) {
    n.relations = pointsToRelations(n.relationsPoints);
  }

  return events;
}
