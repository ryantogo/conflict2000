/**
 * Strategic action: deployment, strike bombing, invasion and border war.
 *
 * The original's key restraint is that the aggressive options simply are not
 * on the menu until relations are already bad — you cannot ambush a friend.
 * Combat itself is a running `warProgress` figure per front, shown to the
 * player only as a bar and a sentence from the front-line commander.
 */

import type { Front, FrontId, GameState, NationId, StrategicDirective } from './types';
import { FRONTS } from './types';
import {
  airCount,
  attrite,
  countOf,
  drawAll,
  drawFraction,
  drawFrom,
  enemyEquipmentWeight,
  israeliEquipmentWeight,
  mergeInto,
  totalUnits,
} from './fleet';
import { clamp } from './ladders';
import { canInvade } from './diplomacy';
import { collapseGovernment } from './intelligence';
import { coalitionMood, coalitionReact } from './coalition';
import { freeBrigades } from './state';
import type { Rng } from './rng';
import {
  STRIKE_CIVILIAN,
  STRIKE_FAILED,
  STRIKE_INDUSTRIAL,
  STRIKE_MILITARY,
  WAR_DECLARED,
  WAR_GAINS,
  WAR_LOSSES,
  expand,
} from '../data/headlines';
import { adjustRelations } from './powers';

export interface StrategicOption {
  id: StrategicDirective;
  label: string;
  disabledReason?: string;
}

/**
 * Below this many thousand reservists the country is visibly scraping the
 * barrel: mobilisation thins out and the political cost of the war doubles.
 */
export const RESERVE_STRAIN = 90;

/**
 * Why the aggressive options are missing. A promise the player can quietly
 * break is not a promise, so the undertaking removes the option outright and
 * says why — the same way the game refuses to let you invade a friend.
 */
const UNDERTAKING_GIVEN =
  'Israel has given formal undertakings in the Western capitals. They still bind us.';

const STRIKE_LABELS: Record<string, string> = {
  strike_industrial: 'Tactical airstrike on industrial target',
  strike_military: 'Tactical airstrike on military target',
  strike_civilian: 'Tactical airstrike on civilian target',
  strike_nuclear: 'Tactical airstrike on nuclear installation',
};

/**
 * Is anything of ours still standing on this border? Equipment can outlive the
 * brigades it came with, so this asks about the whole column, not just troops.
 */
function forcesOnFront(front: Front): boolean {
  return front.deployed.brigades > 0 || totalUnits(front.deployed.equipment) > 0;
}

/**
 * Bringing the column home. Offered wherever there is something to bring home
 * and no battle to lose by leaving — after a war has ended, above all, which
 * is the one case where the rest of the menu has nothing left on it.
 */
function withdrawalOptions(front: Front): StrategicOption[] {
  if (!forcesOnFront(front)) return [];
  const opts: StrategicOption[] = [
    { id: 'withdraw', label: 'Withdraw all forces and return them to reserve' },
  ];
  if (front.deployed.brigades > 1) {
    opts.push({ id: 'withdraw_brigade', label: 'Withdraw single brigade' });
  }
  return opts;
}

export function strategicOptions(s: GameState, id: FrontId): StrategicOption[] {
  const n = s.nations[id];
  const front = s.fronts[id];
  const free = freeBrigades(s);
  const opts: StrategicOption[] = [];

  if (front.atWar) {
    // Once fighting starts the menu narrows to feeding the battle.
    opts.push({
      id: 'deploy_brigade',
      label: 'Deploy extra troop brigade',
      ...(free < 1 ? { disabledReason: 'No brigades are free.' } : {}),
    });
    opts.push({
      id: 'deploy_tanks',
      label: 'Deploy extra tank battalion',
      ...(countOf(s.israel.stockpile.equipment, 'tank') < 200
        ? { disabledReason: 'The armoured reserve is exhausted.' }
        : {}),
    });
    opts.push({
      id: 'deploy_sam',
      label: 'Deploy extra SAM battery',
      ...(countOf(s.israel.stockpile.equipment, 'sam') < 5
        ? { disabledReason: 'No batteries in reserve.' }
        : {}),
    });
    opts.push({
      id: 'deploy_air',
      label: 'Increase air cover',
      ...(airCount(s.israel.stockpile.equipment) < 20
        ? { disabledReason: 'No squadrons can be spared.' }
        : {}),
    });
    opts.push({ id: 'deploy_all', label: 'Deploy all extra forces' });
    opts.push({ id: 'withdraw_brigade', label: 'Withdraw single brigade' });
    if (s.israel.warheads > 0) {
      opts.push({ id: 'nuclear_strike', label: 'Launch thermonuclear attack' });
    }
    opts.push({ id: 'none', label: 'Continue campaign' });
    return opts;
  }

  // There is no state left to act against, but our army is still sitting on
  // its border. Getting it home is the only order that still means anything.
  if (n.collapsed) {
    const home = withdrawalOptions(front);
    if (home.length === 0) {
      return [
        { id: 'none', label: 'Take no action', disabledReason: `${n.name} has no government.` },
      ];
    }
    return [...home, { id: 'none', label: 'Hold the present positions' }];
  }

  if (front.demilitarised) {
    const home = withdrawalOptions(front);
    return [
      ...home,
      {
        id: 'none',
        label: 'Take no action',
        disabledReason:
          'Since the recent conflict, the U.N. have made this a military free zone.',
      },
    ];
  }

  opts.push({
    id: 'small_deployment',
    label: 'Increase presence with small scale deployment',
    ...(free < 1 ? { disabledReason: 'No brigades are free.' } : {}),
  });

  // A full deployment is the first move the world can read as intent.
  if (n.relations <= 5) {
    opts.push({
      id: 'full_deployment',
      label: 'Full scale immediate deployment',
      ...(free < 2 ? { disabledReason: 'At least two free brigades are required.' } : {}),
    });
  }
  if (n.relations <= 4) {
    opts.push({
      id: 'max_deployment',
      label: 'Maximum further deployment',
      ...(free < 3 ? { disabledReason: 'At least three free brigades are required.' } : {}),
    });
  }

  // Strike bombing needs poor relations and aircraft to fly.
  if (n.relations <= 3) {
    const bound = s.israel.restraint > 0;
    const noAir = countOf(s.israel.stockpile.equipment, 'aircraft') < 30;
    for (const k of ['strike_military', 'strike_industrial', 'strike_civilian'] as const) {
      opts.push({
        id: k,
        label: STRIKE_LABELS[k],
        ...(bound
          ? { disabledReason: UNDERTAKING_GIVEN }
          : noAir
            ? { disabledReason: 'Insufficient aircraft available.' }
            : {}),
      });
    }
    if (n.nuclearProgress > 20) {
      opts.push({
        id: 'strike_nuclear',
        label: STRIKE_LABELS.strike_nuclear,
        ...(bound
          ? { disabledReason: UNDERTAKING_GIVEN }
          : noAir
            ? { disabledReason: 'Insufficient aircraft available.' }
            : {}),
      });
    }
  }

  const inv = canInvade(s, id);
  opts.push({
    id: 'invade',
    label: 'Invade',
    ...(s.israel.restraint > 0
      ? { disabledReason: UNDERTAKING_GIVEN }
      : inv.ok
        ? {}
        : { disabledReason: inv.reason ?? 'Not possible.' }),
  });

  // Keyed on the whole column, not just brigades: a front that has lost its
  // infantry can still be holding tanks, aircraft and batteries.
  if (forcesOnFront(front)) {
    opts.push({ id: 'withdraw', label: 'Immediate withdrawal of forces' });
    opts.push({ id: 'defensive', label: 'Hold position and deploy for defensive campaign' });
  }
  opts.push({ id: 'none', label: 'Take no action' });
  return opts;
}

export interface MilitaryEvent {
  text: string;
  category: 'war' | 'nuclear';
  weight: number;
}

function ctxFor(s: GameState, id: NationId, israelIsSubject: boolean) {
  const n = s.nations[id];
  return israelIsSubject
    ? {
        subjAdj: 'Israeli',
        subjName: 'Israel',
        subjCapital: 'Jerusalem',
        objAdj: n.adjective,
        objName: n.name,
        objCapital: n.capital,
      }
    : {
        subjAdj: n.adjective,
        subjName: n.name,
        subjCapital: n.capital,
        objAdj: 'Israeli',
        objName: 'Israel',
        objCapital: 'Jerusalem',
      };
}

/** An order to send forces forward, in headline counts per category. */
interface Movement {
  brigades?: number;
  tanks?: number;
  aircraft?: number;
  helicopters?: number;
  awacs?: number;
  sam?: number;
  /** Send every last thing in the category, whatever it is. */
  everything?: boolean;
}

function moveFromStockpile(s: GameState, front: FrontId, want: Movement): void {
  const st = s.israel.stockpile.equipment;
  const dep = s.fronts[front].deployed;

  if (want.brigades) {
    dep.brigades += Math.min(want.brigades, freeBrigades(s));
  }
  if (want.everything) {
    mergeInto(dep.equipment, drawAll(st, 'tank', 'aircraft', 'helicopter', 'surveillance', 'sam'));
    return;
  }
  if (want.tanks) mergeInto(dep.equipment, drawFrom(st, want.tanks, 'tank'));
  if (want.aircraft) mergeInto(dep.equipment, drawFrom(st, want.aircraft, 'aircraft'));
  if (want.helicopters) mergeInto(dep.equipment, drawFrom(st, want.helicopters, 'helicopter'));
  if (want.awacs) mergeInto(dep.equipment, drawFrom(st, want.awacs, 'surveillance'));
  if (want.sam) mergeInto(dep.equipment, drawFrom(st, want.sam, 'sam'));
}

function returnToStockpile(s: GameState, front: FrontId, all: boolean): void {
  const st = s.israel.stockpile.equipment;
  const dep = s.fronts[front].deployed;
  const cats = ['tank', 'aircraft', 'helicopter', 'surveillance', 'sam'] as const;

  dep.brigades -= all ? dep.brigades : Math.min(1, dep.brigades);
  for (const cat of cats) {
    // Each category comes home in its own proportion, as it always did.
    mergeInto(st, all ? drawAll(dep.equipment, cat) : drawFraction(dep.equipment, 0.34, cat));
  }
}

export function resolveStrategic(s: GameState, rng: Rng): MilitaryEvent[] {
  const events: MilitaryEvent[] = [];

  for (const id of FRONTS) {
    const directive = s.directives.strategic[id];
    if (!directive || directive === 'none') continue;
    const n = s.nations[id];
    const front = s.fronts[id];
    const ctx = ctxFor(s, id, true);

    switch (directive) {
      case 'small_deployment':
        moveFromStockpile(s, id, { brigades: 1, tanks: 150, sam: 4 });
        // Small movements "can be explained away with excuses".
        n.relationsPoints = clamp(n.relationsPoints - 4, -100, 100);
        break;

      case 'full_deployment':
        moveFromStockpile(s, id, { brigades: 2, tanks: 400, aircraft: 32, helicopters: 8, sam: 10 });
        n.relationsPoints = clamp(n.relationsPoints - 14, -100, 100);
        s.tension = clamp(s.tension + 4, 0, 100);
        break;

      case 'max_deployment':
        moveFromStockpile(s, id, { brigades: 3, tanks: 700, aircraft: 64, helicopters: 16, sam: 16 });
        n.relationsPoints = clamp(n.relationsPoints - 20, -100, 100);
        s.tension = clamp(s.tension + 7, 0, 100);
        break;

      case 'withdraw': {
        const wasHolding = forcesOnFront(front);
        returnToStockpile(s, id, true);
        front.territoryHeld = false;
        // A gesture only reads as one if there is a government left to read it.
        if (!n.collapsed) {
          n.relationsPoints = clamp(n.relationsPoints + 8, -100, 100);
        }
        s.tension = clamp(s.tension - 3, 0, 100);
        if (wasHolding) {
          events.push({
            text: `Israeli forces withdraw from the ${n.adjective} border`,
            category: 'war',
            weight: 1,
          });
        }
        break;
      }

      case 'defensive':
        front.warProgress = clamp(front.warProgress + 4, -100, 100);
        break;

      case 'strike_military':
      case 'strike_industrial':
      case 'strike_civilian':
      case 'strike_nuclear': {
        events.push(...resolveStrike(s, id, directive, rng));
        break;
      }

      case 'invade': {
        const inv = canInvade(s, id);
        if (!inv.ok) break;
        s.stats.warsStarted++;
        s.stats.actsOfViolence += 2;
        front.atWar = true;
        front.warMonths = 0;
        front.warProgress = 12; // surprise weight on the first month
        n.atWarWith.push('israel');
        n.relationsPoints = -100;
        n.relations = 0;
        s.tension = clamp(s.tension + 18, 0, 100);
        s.israel.prestige = clamp(s.israel.prestige + 2, 0, 100);
        adjustRelations(s, 'usa', -12);
        coalitionReact(s, 'hawkish', 12);
        events.push({
          text: expand(rng.pick(WAR_DECLARED), ctx),
          category: 'war',
          weight: 3,
        });
        break;
      }

      case 'deploy_brigade':
        moveFromStockpile(s, id, { brigades: 1 });
        break;
      case 'deploy_tanks':
        moveFromStockpile(s, id, { tanks: 200 });
        break;
      case 'deploy_sam':
        moveFromStockpile(s, id, { sam: 5 });
        break;
      case 'deploy_air':
        moveFromStockpile(s, id, { aircraft: 16, helicopters: 4 });
        break;
      case 'deploy_all':
        moveFromStockpile(s, id, { brigades: freeBrigades(s), everything: true });
        break;
      case 'withdraw_brigade':
        returnToStockpile(s, id, false);
        break;

      case 'nuclear_strike':
        events.push(...resolveNuclearStrike(s, id, rng));
        break;
    }
  }

  return events;
}

function resolveStrike(
  s: GameState,
  id: FrontId,
  kind: StrategicDirective,
  rng: Rng,
): MilitaryEvent[] {
  const n = s.nations[id];
  const ctx = ctxFor(s, id, true);
  const out: MilitaryEvent[] = [];

  s.stats.strikesOrdered++;
  s.stats.actsOfViolence++;

  // Enemy air defence gets a say.
  const defence =
    countOf(n.forces.equipment, 'sam') * 0.004 +
    countOf(n.forces.equipment, 'aircraft') * 0.0004;
  const success = rng.next() > clamp(defence, 0.05, 0.6);

  drawFrom(s.israel.stockpile.equipment, rng.int(0, 4), 'aircraft');
  s.tension = clamp(s.tension + 8, 0, 100);
  n.relationsPoints = clamp(n.relationsPoints - 35, -100, 100);

  if (!success) {
    drawFrom(s.israel.stockpile.equipment, rng.int(2, 6), 'aircraft');
    s.israel.prestige = clamp(s.israel.prestige - 4, 0, 100);
    out.push({ text: expand(rng.pick(STRIKE_FAILED), ctx), category: 'war', weight: 3 });
    return out;
  }

  switch (kind) {
    case 'strike_military':
      drawFrom(n.forces.equipment, rng.int(60, 200), 'tank');
      drawFrom(n.forces.equipment, rng.int(5, 25), 'aircraft');
      adjustRelations(s, 'usa', -5);
      out.push({ text: expand(rng.pick(STRIKE_MILITARY), ctx), category: 'war', weight: 2 });
      break;

    case 'strike_industrial':
      n.stability = clamp(n.stability - rng.int(3, 8), 0, 100);
      adjustRelations(s, 'usa', -8);
      out.push({ text: expand(rng.pick(STRIKE_INDUSTRIAL), ctx), category: 'war', weight: 2 });
      break;

    case 'strike_civilian':
      // Effective and indefensible.
      n.stability = clamp(n.stability - rng.int(6, 14), 0, 100);
      s.stats.actsOfViolence += 2;
      adjustRelations(s, 'usa', -18);
      s.israel.prestige = clamp(s.israel.prestige - 6, 0, 100);
      s.tension = clamp(s.tension + 6, 0, 100);
      out.push({ text: expand(rng.pick(STRIKE_CIVILIAN), ctx), category: 'war', weight: 3 });
      break;

    case 'strike_nuclear':
      n.nuclearProgress = Math.max(0, n.nuclearProgress - rng.int(40, 70));
      adjustRelations(s, 'usa', -10);
      out.push({
        text: expand('*s destroy @ nuclear reactor in strike', ctx),
        category: 'war',
        weight: 3,
      });
      break;
  }

  // A strike is very often the thing that starts the shooting.
  const front = s.fronts[id];
  if (!front.atWar && rng.chance(0.45)) {
    front.atWar = true;
    front.warMonths = 0;
    n.atWarWith.push('israel');
    s.stats.warsStarted++;
    out.push({
      text: expand('* strike bombing of _ starts war', ctx),
      category: 'war',
      weight: 3,
    });
  }

  return out;
}

function resolveNuclearStrike(s: GameState, id: FrontId, rng: Rng): MilitaryEvent[] {
  const n = s.nations[id];
  const ctx = ctxFor(s, id, true);
  s.israel.warheads = Math.max(0, s.israel.warheads - 1);
  s.stats.nukesUsed++;
  s.stats.actsOfViolence += 10;
  s.tension = clamp(s.tension + 45, 0, 100);
  adjustRelations(s, 'usa', -45);
  s.israel.prestige = clamp(s.israel.prestige + 10, 0, 100);
  n.forces.brigades = Math.max(0, n.forces.brigades - 5);
  attrite(n.forces.equipment, 0.6, 'tank');
  n.stability = 0;

  return [
    {
      text: expand(
        rng.pick(['World is shaken as # nukes _', '# destroys & with nuclear devastat^']),
        ctx,
      ),
      category: 'nuclear',
      weight: 3,
    },
  ];
}

// ---------------------------------------------------------------------------
// Border war resolution
// ---------------------------------------------------------------------------

/** Total combat weight Israel has on one front. */
export function israeliStrength(s: GameState, id: FrontId): number {
  const d = s.fronts[id].deployed;
  return d.brigades * 100 + israeliEquipmentWeight(d.equipment, s.israel.readiness);
}

/** Total combat weight the defender can bring to that front. */
export function enemyStrength(s: GameState, id: FrontId): number {
  const n = s.nations[id];
  let base = n.forces.brigades * 78 + enemyEquipmentWeight(n.forces.equipment);
  // A regime falling apart cannot fight well.
  base *= 0.5 + (n.stability / 100) * 0.7;
  // Allies who have a pact with the defender pile in.
  for (const other of Object.values(s.nations)) {
    if (other.id === id || other.collapsed) continue;
    if (other.pactWith.includes(n.id)) base += other.forces.brigades * 22;
  }
  return base;
}

export function resolveCombat(s: GameState, rng: Rng): MilitaryEvent[] {
  const events: MilitaryEvent[] = [];

  for (const id of FRONTS) {
    const front = s.fronts[id];
    if (!front.atWar) continue;
    const n = s.nations[id];
    front.warMonths++;

    // Emergency mobilisation. When the line is about to break, the generals
    // do not wait for a directive — the uncommitted reserve goes to the front
    // that is being overrun. It happens once per war, and only draws on
    // forces the player had left idle.
    if (!front.mobilised && front.warProgress < -20) {
      front.mobilised = true;
      const st = s.israel.stockpile.equipment;
      // You cannot mobilise a reserve you have already spent. A country
      // scraping the barrel calls up one brigade where it would have called two.
      const canCall = s.israel.reserves < RESERVE_STRAIN ? 1 : 2;
      const brigades = Math.min(canCall, freeBrigades(s));
      const cats = ['tank', 'aircraft', 'helicopter', 'surveillance', 'sam'] as const;
      const called: typeof st = {};
      for (const cat of cats) mergeInto(called, drawFraction(st, 0.35, cat));
      if (brigades > 0 || totalUnits(called) > 0) {
        front.deployed.brigades += brigades;
        mergeInto(front.deployed.equipment, called);
        events.push({
          text: `Reserve mobilised as ${n.adjective} forces press the border`,
          category: 'war',
          weight: 2,
        });
      }
    }

    const us = israeliStrength(s, id);
    const them = enemyStrength(s, id);
    const ratio = us / Math.max(1, us + them);
    // Centre on 0.5 so an even match drifts nowhere, then add friction.
    const swing = (ratio - 0.5) * 60 + rng.int(-8, 8);
    front.warProgress = clamp(front.warProgress + swing, -100, 100);

    // Attrition on both sides, scaled by how badly it is going.
    const ourLossRate = clamp(0.1 - front.warProgress / 900, 0.02, 0.22);
    const theirLossRate = clamp(0.1 + front.warProgress / 900, 0.02, 0.22);

    attrite(front.deployed.equipment, ourLossRate, 'tank');
    attrite(front.deployed.equipment, ourLossRate * 0.5, 'aircraft', 'helicopter');
    // Early warning craft orbit well behind the line and are not shot down.
    attrite(n.forces.equipment, theirLossRate, 'tank');
    attrite(n.forces.equipment, theirLossRate * 0.5, 'aircraft');

    // Manpower comes out of the reserve pool, and the pool is a population
    // rather than a number: a country of six million notices its casualties.
    const casualties = Math.round(ourLossRate * 60);
    s.israel.reserves = Math.max(0, s.israel.reserves - casualties);
    if (casualties > 0) {
      // War weariness is about the funerals, not the map. A campaign going
      // well still costs you the House if it costs enough reservists.
      coalitionMood(s, -casualties / 12);
      if (s.israel.reserves < RESERVE_STRAIN) {
        s.israel.popularity = clamp(s.israel.popularity - 2, 0, 100);
      }
    }
    // A brigade can only be destroyed if one is actually standing here, or the
    // national total would fall below what is committed elsewhere.
    if (front.deployed.brigades > 0 && rng.chance(ourLossRate)) {
      front.deployed.brigades--;
      s.israel.brigades = Math.max(0, s.israel.brigades - 1);
    }
    if (rng.chance(theirLossRate)) {
      n.forces.brigades = Math.max(0, n.forces.brigades - 1);
    }

    // War is unpopular at home the longer it runs and the worse it goes.
    s.israel.popularity = clamp(
      s.israel.popularity + (front.warProgress > 40 ? 1 : -2) - Math.floor(front.warMonths / 6),
      0,
      100,
    );
    s.tension = clamp(s.tension + 2, 0, 100);

    const ctx = ctxFor(s, id, false);
    if (front.warProgress < -25) {
      events.push({ text: expand(rng.pick(WAR_LOSSES), ctx), category: 'war', weight: 2 });
    } else if (front.warProgress > 35) {
      events.push({
        text: expand(rng.pick(WAR_GAINS), ctxFor(s, id, true)),
        category: 'war',
        weight: 2,
      });
    }
    if (front.warMonths === 6) {
      events.push({
        text: expand('*-@ war enters sixth month', ctxFor(s, id, true)),
        category: 'war',
        weight: 1,
      });
    }

    // Decisive outcomes.
    if (front.warProgress >= 92) {
      front.territoryHeld = true;
      events.push({
        text: expand('* army claim control of _!', ctxFor(s, id, true)),
        category: 'war',
        weight: 3,
      });
      // The defeated state's government does not survive occupation. This is
      // the same event as a coup or an assassination succeeding, so it goes
      // through the same door — an inlined copy here used to drift out of step.
      collapseGovernment(s, id, 'invasion');
      s.israel.prestige = clamp(s.israel.prestige + 12, 0, 100);
    } else if (front.warProgress <= -85) {
      // The line is breaking, but a country is not lost in a single month.
      // Three consecutive months here is what actually ends the game.
      front.collapseMonths++;
      events.push({
        text: expand('@ forces move deeper into #', ctxFor(s, id, false)),
        category: 'war',
        weight: 3,
      });
      s.israel.popularity = clamp(s.israel.popularity - 12, 0, 100);
      s.israel.prestige = clamp(s.israel.prestige - 8, 0, 100);
      // A line about to break unites the House against the man who let it.
      coalitionMood(s, -6);
    } else {
      front.collapseMonths = 0;
    }
  }

  return events;
}

/** Front-line commander's read on how it is going, for the Review screen. */
export function frontReport(progress: number): string {
  if (progress <= -70) return 'Our army is no match for the enemy.';
  if (progress <= -45) return 'We suffered appalling losses.';
  if (progress <= -25) return 'Our lines have been decimated.';
  if (progress <= -10) return 'We suffered major troop losses.';
  if (progress < 10) return 'We suffered minor troop losses.';
  if (progress < 30) return 'The enemy has suffered slight losses.';
  if (progress < 55) return 'Our forces have the upper hand.';
  if (progress < 80) return 'We inflicted severe damage.';
  return 'We are romping through enemy lines.';
}
