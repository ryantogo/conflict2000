/**
 * Armed groups with goals of their own.
 *
 * They are not a border you can mass on and not a government you can talk to,
 * which is precisely what makes them a different problem from everything else
 * in the game. Hitting them works and radicalises the people they live among;
 * ignoring them lets them grow; and the only durable answer to any of them is
 * political rather than military, which the player is entitled to find
 * annoying.
 */

import type { GameState, NationId } from './types';
import { NATION_IDS } from './types';
import { clamp, pointsToRelations } from './ladders';
import type { Rng } from './rng';
import { coalitionMood } from './coalition';
import { adjustRelations } from './powers';
import {
  FACTIONS,
  PATRON_SUPPORT,
  RESTORATION_THRESHOLD,
  SPENT_THRESHOLD,
  SUCCESSORS,
  factionSeedById,
} from '../data/factions2000';
import type { FactionHome } from '../data/factions2000';

export type FactionDirective = 'none' | 'strike' | 'back';

export interface FactionState {
  strength: number;
  support: number;
  /** False once a faction has been destroyed or has folded into a state. */
  active: boolean;
  /** Set when a faction was born out of a state falling apart. */
  successorTo?: NationId;
}

export function createFactions(): Record<string, FactionState> {
  const out: Record<string, FactionState> = {};
  for (const f of FACTIONS) {
    out[f.id] = { strength: f.strength, support: f.support, active: true };
  }
  return out;
}

export interface FactionStatus {
  id: string;
  name: string;
  home: FactionHome;
  patron: NationId | null;
  patronName: string | null;
  method: 'raids' | 'unrest';
  character: string;
  strength: number;
  support: number;
  spent: boolean;
}

/** Everything currently operating out of one place. */
export function factionsIn(s: GameState, home: FactionHome): FactionStatus[] {
  const out: FactionStatus[] = [];
  for (const seed of FACTIONS) {
    if (seed.home !== home) continue;
    const st = s.factions[seed.id];
    if (!st?.active) continue;
    out.push({
      id: seed.id,
      name: seed.name,
      home: seed.home,
      patron: seed.patron,
      patronName: seed.patron ? s.nations[seed.patron].name : null,
      method: seed.method,
      character: seed.character,
      strength: st.strength,
      support: st.support,
      spent: st.strength < SPENT_THRESHOLD,
    });
  }
  return out;
}

export interface FactionOption {
  id: FactionDirective;
  label: string;
  disabledReason?: string;
}

export function factionOptions(s: GameState, id: string): FactionOption[] {
  const seed = factionSeedById(id);
  const st = s.factions[id];
  const opts: FactionOption[] = [];
  if (!seed || !st) return opts;

  opts.push({
    id: 'strike',
    label: 'Strike their positions',
    ...(s.israel.restraint > 0
      ? {
          disabledReason:
            'Israel has given formal undertakings in the Western capitals. They still bind us.',
        }
      : st.strength < SPENT_THRESHOLD
        ? { disabledReason: 'There is nothing left of them worth bombing.' }
        : {}),
  });

  // Backing an armed group inside a state we are already fighting is an old
  // habit of the region's. Backing one inside a state we are at peace with is
  // not something any Israeli cabinet would sign.
  const host = seed.home === 'territories' ? null : s.nations[seed.home];
  opts.push({
    id: 'back',
    label: 'Arm and fund them against their own government',
    ...(host === null
      ? { disabledReason: 'They are not fighting a government. They are fighting us.' }
      : host.collapsed
        ? {}
        : host.relations > 3
          ? { disabledReason: `We are not at odds enough with ${host.name} to arm anybody there.` }
          : {}),
  });

  opts.push({ id: 'none', label: 'Take no action' });
  return opts;
}

export interface FactionEvent {
  text: string;
  category: 'war' | 'palestine' | 'intelligence';
  weight: number;
}

/**
 * A month of the groups nobody governs. Growth first, then whatever the
 * player ordered, then what they do to us.
 */
export function resolveFactions(s: GameState, rng: Rng): FactionEvent[] {
  const events: FactionEvent[] = [];

  for (const seed of FACTIONS) {
    const st = s.factions[seed.id];
    if (!st?.active) continue;

    const directive = s.directives.factions[seed.id] ?? 'none';
    const host = seed.home === 'territories' ? null : s.nations[seed.home];

    // --- what keeps them going ------------------------------------------
    // Convergence toward what their circumstances can actually sustain,
    // rather than growth without a ceiling. An organisation is as large as
    // its patron, its constituency and the space it is given to operate in,
    // and the first version of this simply accumulated until everything was
    // at a hundred and the decade was unsurvivable.
    let target = 25;
    if (seed.patron) {
      const patron = s.nations[seed.patron];
      // A patron in trouble at home writes smaller cheques.
      if (!patron.collapsed) target += (patron.stability / 100) * PATRON_SUPPORT * 340;
    }
    // A group living among people who agree with it recruits without trying.
    target += st.support * 0.5;
    // And a host that cannot govern its own territory is a host that hosts.
    if (host && (host.collapsed || host.stability < 35)) target += 12;

    st.strength = clamp(st.strength + (target - st.strength) * 0.06, 0, 100);
    // Support drifts back toward the ground truth of how they are doing.
    st.support = clamp(st.support + (st.strength - st.support) * 0.04, 0, 100);

    // --- what we ordered --------------------------------------------------
    if (directive === 'strike' && st.strength >= SPENT_THRESHOLD && s.israel.restraint === 0) {
      s.stats.strikesOrdered++;
      s.stats.actsOfViolence++;
      const hurt = rng.int(6, 14);
      st.strength = clamp(st.strength - hurt, 0, 100);
      // And this is the whole problem with hitting them: it works, and it
      // recruits for them. Nobody has ever solved this militarily.
      st.support = clamp(st.support + rng.int(3, 8), 0, 100);
      s.tension = clamp(s.tension + 3, 0, 100);
      adjustRelations(s, 'usa', -3);
      if (host && !host.collapsed) {
        host.relationsPoints = clamp(host.relationsPoints - 6, -100, 100);
      }
      events.push({
        text: `Israeli strikes on ${seed.name} positions in ${
          host ? host.name : 'the territories'
        }`,
        category: seed.method === 'raids' ? 'war' : 'palestine',
        weight: 2,
      });
    }

    if (directive === 'back' && host) {
      st.strength = clamp(st.strength + rng.int(4, 9), 0, 100);
      host.stability = clamp(host.stability - rng.int(1, 4), 0, 100);
      s.israel.funds = Math.max(0, s.israel.funds - 25);
      // Arming somebody else's insurgency is not a secret anybody keeps.
      if (rng.chance(0.12)) {
        adjustRelations(s, 'usa', -6);
        s.israel.prestige = clamp(s.israel.prestige - 3, 0, 100);
        events.push({
          text: `Israeli weapons found in ${seed.name} hands`,
          category: 'intelligence',
          weight: 2,
        });
      }
    }

    // --- what they do to us ----------------------------------------------
    if (st.strength < SPENT_THRESHOLD) continue;

    if (seed.method === 'raids') {
      const chance = clamp(st.strength / 700, 0, 0.16);
      if (rng.chance(chance)) {
        s.israel.popularity = clamp(s.israel.popularity - rng.int(1, 3), 0, 100);
        s.tension = clamp(s.tension + rng.int(1, 3), 0, 100);
        coalitionMood(s, -1);
        // The border does not stay quiet around this.
        if (host && !host.collapsed) {
          const front = s.fronts[seed.home as 'lebanon'];
          if (front) front.enemyActivity = Math.max(front.enemyActivity, 1);
        }
        events.push({
          text: rng.pick([
            `${seed.name} rocket fire across the northern border`,
            `${seed.name} raid kills Israeli soldiers on the frontier`,
            `Roadside bomb attributed to ${seed.name}`,
          ]),
          category: 'war',
          weight: 2,
        });
      }
    } else {
      // Groups in the territories work on the street rather than the border.
      const pressure = (st.strength / 100) * (1 + s.palestine.unrest / 10) * 0.05;
      s.palestine.unrest = clamp(s.palestine.unrest + pressure, 0, 10);
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Successors
// ---------------------------------------------------------------------------

/**
 * A state comes apart. Called the month a government falls, and the reason a
 * collapsed nation is no longer a dead end on every screen in the game.
 */
export function spawnSuccessors(s: GameState, id: NationId): FactionEvent[] {
  const seeds = SUCCESSORS[id];
  if (!seeds) return [];
  // Idempotent: a state cannot fall twice.
  if (Object.keys(s.factions).some((k) => s.factions[k].successorTo === id)) return [];

  const n = s.nations[id];
  for (const seed of seeds) {
    s.factions[`${id}_${seed.suffix}`] = {
      // What is left of a state's cohesion, divided among the people who were
      // holding it together.
      strength: clamp(20 + seed.share * 55, 0, 100),
      support: clamp(seed.share * 90, 0, 100),
      active: true,
      successorTo: id,
    };
  }

  return [
    {
      text: `${n.name} fragments: rival factions contest the succession`,
      category: 'intelligence',
      weight: 3,
    },
  ];
}

export interface SuccessorStatus extends FactionStatus {
  disposition: number;
  /** Strong enough to be installed as a government, if we are backing them. */
  readyToGovern: boolean;
}

/** Who is contesting a fallen state. */
export function successorsOf(s: GameState, id: NationId): SuccessorStatus[] {
  const seeds = SUCCESSORS[id] ?? [];
  const out: SuccessorStatus[] = [];
  for (const seed of seeds) {
    const key = `${id}_${seed.suffix}`;
    const st = s.factions[key];
    if (!st?.active) continue;
    out.push({
      id: key,
      name: seed.name,
      home: id,
      patron: null,
      patronName: null,
      method: 'raids',
      character: seed.character,
      strength: st.strength,
      support: st.support,
      spent: st.strength < SPENT_THRESHOLD,
      disposition: seed.disposition,
      readyToGovern: st.strength >= RESTORATION_THRESHOLD,
    });
  }
  return out;
}

export function successorOptions(s: GameState, key: string): FactionOption[] {
  const st = s.factions[key];
  if (!st?.successorTo) return [];
  const ready = st.strength >= RESTORATION_THRESHOLD;

  return [
    {
      id: 'back',
      label: ready ? 'Back them, and put them in the palace' : 'Arm and fund them',
      ...(s.israel.funds < 25 ? { disabledReason: 'There is nothing in the fund for it.' } : {}),
    },
    {
      id: 'strike',
      label: 'Strike them',
      ...(st.strength < SPENT_THRESHOLD
        ? { disabledReason: 'There is nothing left of them worth bombing.' }
        : s.israel.restraint > 0
          ? {
              disabledReason:
                'Israel has given formal undertakings in the Western capitals. They still bind us.',
            }
          : {}),
    },
    { id: 'none', label: 'Let them fight it out' },
  ];
}

/**
 * A month of civil war, and — if we have backed somebody far enough — the end
 * of one. Restoring a government is the only way a collapsed state comes back,
 * and the state that comes back is the one we armed.
 */
export function resolveSuccessors(s: GameState, rng: Rng): FactionEvent[] {
  const events: FactionEvent[] = [];

  for (const id of NATION_IDS) {
    const contenders = successorsOf(s, id);
    if (contenders.length === 0) continue;
    const n = s.nations[id];

    for (const c of contenders) {
      const st = s.factions[c.id];
      const directive = s.directives.factions[c.id] ?? 'none';

      if (directive === 'back' && s.israel.funds >= 25) {
        s.israel.funds -= 25;
        st.strength = clamp(st.strength + rng.int(3, 7), 0, 100);
        st.support = clamp(st.support + rng.int(1, 3), 0, 100);
        // Backing a faction that despises us is a way of arming our enemies.
        if (c.disposition < -0.3 && rng.chance(0.15)) {
          s.israel.prestige = clamp(s.israel.prestige - 3, 0, 100);
          events.push({
            text: `Weapons sent to ${c.name} are turned on Israeli positions`,
            category: 'intelligence',
            weight: 2,
          });
        }
      } else if (directive === 'strike' && st.strength >= SPENT_THRESHOLD && s.israel.restraint === 0) {
        s.stats.strikesOrdered++;
        s.stats.actsOfViolence++;
        st.strength = clamp(st.strength - rng.int(5, 12), 0, 100);
        st.support = clamp(st.support + rng.int(2, 6), 0, 100);
        adjustRelations(s, 'usa', -2);
      }

      // The war itself. Everybody grinds everybody down.
      st.strength = clamp(st.strength - rng.next() * 1.5, 0, 100);
    }

    // --- does anybody win? ------------------------------------------------
    const strongest = successorsOf(s, id).sort((a, b) => b.strength - a.strength)[0];
    if (!strongest || strongest.strength < RESTORATION_THRESHOLD) continue;
    if ((s.directives.factions[strongest.id] ?? 'none') !== 'back') continue;

    // A government again, and one that owes us. This is the only route out of
    // a collapse, and the state that comes back is the one we armed.
    n.collapsed = false;
    n.collapseCause = undefined;
    n.leader = strongest.name;
    n.stability = 32;
    n.baseStability = 42;
    n.oppositionStrength = 30;
    n.relationsPoints = clamp(Math.round(strongest.disposition * 70), -100, 100);
    n.relations = pointsToRelations(n.relationsPoints);
    n.network = clamp(n.network + 20, 0, 100);
    for (const c of successorsOf(s, id)) s.factions[c.id].active = false;

    s.tension = clamp(s.tension - 6, 0, 100);
    events.push({
      text: `${strongest.name} form a government in ${n.capital}`,
      category: 'intelligence',
      weight: 3,
    });
  }

  return events;
}
