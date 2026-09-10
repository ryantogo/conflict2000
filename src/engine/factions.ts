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
import { coalitionMood, coalitionReact } from './coalition';
import { adjustRelations, relationsWith, warOnTerror } from './powers';
import { RESPONSES, responseById } from '../data/responses2000';
import type { IncidentResponse } from '../data/responses2000';
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
  /**
   * 0..100: how much they expect to pay for the next attack. Hard answers
   * raise it and restraint spends it, and it fades either way.
   */
  deterrence: number;
  /** Months left of a sustained rocket campaign. Zero is the ordinary border. */
  escalation: number;
  /** Months their host or their patron has been leaned on to hold them back. */
  restrained: number;
}

/** Where deterrence settles when nobody is doing anything to it. */
const DETERRENCE_REST = 25;

export function createFactions(): Record<string, FactionState> {
  const out: Record<string, FactionState> = {};
  for (const f of FACTIONS) {
    out[f.id] = {
      strength: f.strength,
      support: f.support,
      active: true,
      deterrence: 30,
      escalation: 0,
      restrained: 0,
    };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Incidents on the northern border
// ---------------------------------------------------------------------------

export type IncidentKind = 'rockets' | 'ambush' | 'abduction';

export interface Incident {
  id: string;
  faction: string;
  kind: IncidentKind;
  /** 1..3: a salvo, a patrol ambushed, soldiers taken. */
  severity: number;
  /** Raised this turn; answered at the end of the next. */
  turn: number;
}

export const INCIDENT_TITLE: Record<IncidentKind, string> = {
  rockets: 'Katyushas on Kiryat Shmona',
  ambush: 'A patrol ambushed on the Blue Line',
  abduction: 'Soldiers seized on the Blue Line',
};

/** Put an attack in front of the cabinet. It will not answer itself. */
export function raiseIncident(s: GameState, faction: string, kind: IncidentKind): Incident {
  const severity = kind === 'rockets' ? 1 : kind === 'ambush' ? 2 : 3;
  const incident: Incident = {
    id: `${faction}-${kind}-${s.turn}-${s.incidents.length}`,
    faction,
    kind,
    severity,
    turn: s.turn,
  };
  s.incidents.push(incident);
  return incident;
}

/**
 * How hard Tehran is pushing, where 1 is June 2000. Its opinion of us sets
 * the pace, a regime in trouble at home pushes somewhat less, and a raid on
 * Iran is answered from Lebanon.
 *
 * Scaled so that the opening Tehran — no relations with us and moderately
 * solid at home — provokes exactly as often as Hezbollah always did. The first
 * version peaked at one and a quarter at the opening, which with every raid
 * now needing an answer took a passive signer's survival from 33 games in 120
 * without Hezbollah to 21 with it: twice the raids anybody remembers.
 */
export function tehranPressure(s: GameState): number {
  const iran = s.nations.iran;
  if (iran.collapsed) return 0.2;
  const hostility = clamp((9 - iran.relations) / 9, 0.1, 1);
  const grip = 0.7 + iran.stability / 200;
  let p = hostility * grip;
  const struck = s.lastStruck.iran;
  if (struck !== undefined && s.turn - struck < 6) p *= 1.8;
  return p;
}

/**
 * The monthly chance a patron-driven group provokes us. Beirut's feelings do
 * not enter into it: Hezbollah fires when Tehran wants it to, and a Lebanon
 * that is warming to Israel is simply a Lebanon that is embarrassed more often.
 */
export function provocationChance(s: GameState, st: FactionState): number {
  const deterred = 1 - st.deterrence / 160;
  const leashed = st.restrained > 0 ? 0.4 : 1;
  // The divisor is the old flat rate's, so a Tehran as hostile as it is in
  // June 2000 provokes about as often as Hezbollah always did.
  return clamp((st.strength / 700) * tehranPressure(s) * deterred * leashed, 0, 0.3);
}

export interface ResponseOption {
  id: IncidentResponse;
  label: string;
  detail: string;
  disabledReason?: string;
}

const UNDERTAKINGS =
  'Israel has given formal undertakings in the Western capitals. They still bind us.';

/** The answers open to us, and the ones that are not. */
export function responseOptions(s: GameState, incident: Incident): ResponseOption[] {
  const st = s.factions[incident.faction];
  const bound = s.israel.restraint > 0;
  const out: ResponseOption[] = [];
  for (const r of RESPONSES) {
    let reason: string | undefined;
    switch (r.id) {
      case 'airstrikes':
        if (bound) reason = UNDERTAKINGS;
        break;
      case 'infrastructure':
        if (bound) reason = UNDERTAKINGS;
        else if (s.nations.lebanon.collapsed) reason = 'There is no Lebanese state left to punish.';
        break;
      case 'syria':
        if (bound) reason = UNDERTAKINGS;
        else if (s.nations.syria.collapsed) reason = 'There is no Syrian army left in Lebanon.';
        break;
      case 'diplomacy':
        if (s.israel.powers.usa.patience < 30 && s.israel.powers.france.patience < 30) {
          reason = 'Washington and Paris have heard enough from us for now.';
        }
        break;
      case 'targeted':
        if (s.nations.lebanon.network < 50) reason = 'Our network in Lebanon is too thin to find him.';
        else if (s.israel.funds < 30) reason = 'There is nothing in the fund for it.';
        break;
      case 'ceasefire':
        if (!st || st.escalation === 0) continue; // only while the rockets are falling
        if (relationsWith(s, 'usa') < 45 && relationsWith(s, 'france') < 45) {
          reason = 'Nobody with standing will broker it for us.';
        }
        break;
    }
    out.push({
      id: r.id,
      label: r.label,
      detail: r.detail,
      ...(reason ? { disabledReason: reason } : {}),
    });
  }
  return out;
}

function applyResponse(
  s: GameState,
  st: FactionState,
  id: IncidentResponse,
  rng: Rng,
): { text: string; weight: number }[] {
  const r = responseById(id);
  const out: { text: string; weight: number }[] = [];
  const isr = s.israel;
  const nudge = (n: NationId, d: number) => {
    const x = s.nations[n];
    if (!x.collapsed) x.relationsPoints = clamp(x.relationsPoints + d, -100, 100);
  };

  if (r.popularity) isr.popularity = clamp(isr.popularity + r.popularity, 0, 100);
  if (r.hawkish) coalitionReact(s, 'hawkish', r.hawkish);
  if (r.party) {
    for (const [p, d] of Object.entries(r.party)) {
      const c = isr.coalition[p];
      if (c) c.satisfaction = clamp(c.satisfaction + d, 0, 100);
    }
  }
  if (r.lebanon) nudge('lebanon', r.lebanon);
  if (r.lebanonStability) {
    const leb = s.nations.lebanon;
    if (!leb.collapsed) leb.stability = clamp(leb.stability + r.lebanonStability, 0, 100);
  }
  if (r.syria) nudge('syria', r.syria);
  if (r.iran) nudge('iran', r.iran);
  if (r.arab) {
    for (const n of NATION_IDS) if (n !== 'lebanon') nudge(n, r.arab);
  }
  // After September 2001 a strike on Hezbollah is a strike in Washington's war.
  const wot = warOnTerror(s) && r.usa !== undefined && r.usa < 0 ? 0.5 : 1;
  if (r.usa) adjustRelations(s, 'usa', r.usa * wot);
  if (r.britain) adjustRelations(s, 'britain', r.britain);
  if (r.france) adjustRelations(s, 'france', r.france);
  if (r.prestige) isr.prestige = clamp(isr.prestige + r.prestige, 0, 100);
  if (r.tension) s.tension = clamp(s.tension + r.tension, 0, 100);
  if (r.strength) st.strength = clamp(st.strength - rng.int(r.strength[0], r.strength[1]), 0, 100);
  if (r.support) st.support = clamp(st.support + r.support, 0, 100);
  if (r.deterrence) st.deterrence = clamp(st.deterrence + r.deterrence, 0, 100);
  if (r.funds) isr.funds = Math.max(0, isr.funds + r.funds);
  if (r.violence) {
    s.stats.actsOfViolence += r.violence;
    s.stats.strikesOrdered++;
  }
  if (r.syriaActivity) {
    const f = s.fronts.syria;
    f.enemyActivity = Math.min(3, f.enemyActivity + r.syriaActivity);
  }

  switch (id) {
    case 'diplomacy': {
      // Paris is Beirut's oldest friend in the West. If Paris is prepared to
      // lean, Beirut leans on Hezbollah; if not, not for long.
      for (const p of ['usa', 'france'] as const) {
        isr.powers[p].patience = clamp(isr.powers[p].patience - 20, 0, 100);
      }
      st.restrained = relationsWith(s, 'france') >= 50 ? 3 : 1;
      break;
    }
    case 'targeted': {
      if (rng.chance(s.nations.lebanon.network / 100)) {
        st.strength = clamp(st.strength - 10, 0, 100);
        st.deterrence = clamp(st.deterrence + 12, 0, 100);
        isr.popularity = clamp(isr.popularity + 3, 0, 100);
        out.push({ text: 'Senior Hezbollah commander killed in Beirut car bomb', weight: 2 });
      } else {
        isr.popularity = clamp(isr.popularity - 2, 0, 100);
        isr.prestige = clamp(isr.prestige - 3, 0, 100);
        s.nations.lebanon.network = clamp(s.nations.lebanon.network - 15, 0, 100);
        out.push({ text: 'Botched Israeli operation in Beirut exposes agents', weight: 2 });
      }
      // Tehran answers a killing the way it answered 1992: somewhere else.
      if (rng.chance(0.2)) {
        isr.popularity = clamp(isr.popularity - 3, 0, 100);
        s.tension = clamp(s.tension + 4, 0, 100);
        out.push({ text: 'Bomb at Israeli embassy abroad blamed on Iranian agents', weight: 3 });
      }
      break;
    }
    case 'ceasefire':
      st.escalation = 0;
      out.push({ text: 'U.N.-brokered ceasefire silences the northern border', weight: 3 });
      break;
  }

  // A hard answer to a patron that wants a fight can start one.
  if (r.escalation && st.escalation === 0 && s.nations.iran.relations <= 2 && rng.chance(r.escalation)) {
    st.escalation = rng.int(2, 4);
    out.push({ text: 'Hezbollah opens a rocket campaign across the north', weight: 3 });
  }
  return out;
}

/**
 * The cabinet's answers to last month's attacks. Runs before this month's
 * raids are rolled, so an attack is always answered the month after it lands.
 */
export function resolveIncidents(s: GameState, rng: Rng): FactionEvent[] {
  const events: FactionEvent[] = [];
  const due = s.incidents.filter((i) => i.turn < s.turn);
  s.incidents = s.incidents.filter((i) => i.turn >= s.turn);

  for (const incident of due) {
    const st = s.factions[incident.faction];
    if (!st?.active) continue;
    const chosen = s.directives.incidentResponse[incident.id];
    const legal = chosen && responseOptions(s, incident).find((o) => o.id === chosen && !o.disabledReason);
    const answer: IncidentResponse = legal ? chosen : 'restraint';
    if (!legal) {
      // Saying nothing is heard as saying it did not matter. The attack
      // itself was already paid for when it landed; this is only the silence.
      s.israel.popularity = clamp(s.israel.popularity - 1, 0, 100);
    }
    for (const e of applyResponse(s, st, answer, rng)) {
      events.push({ text: e.text, category: 'war', weight: e.weight });
    }
    s.log.unshift(`${INCIDENT_TITLE[incident.kind]} — ${responseById(answer).label}.`);
  }
  return events;
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
  /** Fires when its patron wants it to. */
  patronDriven: boolean;
  deterrence: number;
  escalation: number;
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
      patronDriven: !!seed.patronDriven,
      deterrence: st.deterrence,
      escalation: st.escalation,
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
      // After September 2001 this is Washington's own war, and it says so.
      adjustRelations(s, 'usa', warOnTerror(s) ? -1.5 : -3);
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

    // Deterrence fades toward what the border is used to, and a leash slips.
    st.deterrence = clamp(st.deterrence + (DETERRENCE_REST - st.deterrence) * 0.08, 0, 100);
    if (st.restrained > 0) st.restrained--;

    // --- what they do to us ----------------------------------------------
    if (st.strength < SPENT_THRESHOLD) continue;

    if (seed.method === 'raids') {
      // A rocket campaign is a month of the north in shelters, whatever else.
      if (st.escalation > 0) {
        st.escalation--;
        s.israel.popularity = clamp(s.israel.popularity - 2, 0, 100);
        s.tension = clamp(s.tension + 2, 0, 100);
        coalitionMood(s, -1);
        const front = s.fronts[seed.home as 'lebanon'];
        if (front && host && !host.collapsed) front.enemyActivity = Math.max(front.enemyActivity, 2);
        if (st.escalation === 0) {
          events.push({ text: 'The northern border falls quiet', category: 'war', weight: 2 });
        }
      }

      const chance = seed.patronDriven
        ? st.escalation > 0
          ? 1
          : provocationChance(s, st)
        : clamp(st.strength / 700, 0, 0.16);
      if (rng.chance(chance)) {
        const roll = rng.next();
        const kind: IncidentKind = roll < 0.12 ? 'abduction' : roll < 0.4 ? 'ambush' : 'rockets';
        const severity = kind === 'rockets' ? 1 : kind === 'ambush' ? 2 : 3;
        s.israel.popularity = clamp(s.israel.popularity - severity, 0, 100);
        s.tension = clamp(s.tension + rng.int(1, 3), 0, 100);
        coalitionMood(s, -1);
        if (host && !host.collapsed) {
          if (seed.patronDriven && host.relations >= 5) {
            // A Beirut that is making its peace with us is humiliated, not
            // complicit: the attack is on its government as much as on us.
            host.stability = clamp(host.stability - 2, 0, 100);
          } else {
            // The border does not stay quiet around this.
            const front = s.fronts[seed.home as 'lebanon'];
            if (front) front.enemyActivity = Math.max(front.enemyActivity, 1);
          }
        }
        if (seed.patronDriven) raiseIncident(s, seed.id, kind);
        events.push({
          text:
            kind === 'abduction'
              ? `${seed.name} seizes Israeli soldiers on the frontier`
              : kind === 'ambush'
                ? `${seed.name} raid kills Israeli soldiers on the frontier`
                : `${seed.name} rocket fire across the northern border`,
          category: 'war',
          weight: kind === 'rockets' ? 2 : 3,
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
      deterrence: 0,
      escalation: 0,
      restrained: 0,
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
      patronDriven: false,
      deterrence: st.deterrence,
      escalation: st.escalation,
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
