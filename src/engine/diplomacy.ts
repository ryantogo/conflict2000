/**
 * Diplomacy.
 *
 * Relations are stored as a -100..+100 point pool and shown to the player only
 * as one of ten words. Movement is deliberately slow: the manual's warning
 * that "diplomatic relations need to be constantly worked on" is enforced by
 * making a single month's conciliation worth a few points, while one artificial
 * incident is worth a great many.
 */

import type {
  DiplomaticDirective,
  FrontId,
  GameState,
  MediatorId,
  NationId,
  Obligation,
  ObligationAnswer,
  RegionalWar,
  RegionalWarDirective,
} from './types';
import { FRONTS, NATION_IDS } from './types';
import { clamp, pointsToRelations } from './ladders';
import type { Rng } from './rng';
import {
  POWER_IDS,
  POWER_NAMES,
  TERROR_LIST,
  adjustRelations,
  relationsWith,
  warOnTerror,
} from './powers';
import type { PowerId } from './powers';
import { coalitionReact } from './coalition';
import { endRegionalWar, findWar, openFront, setInterArab, startRegionalWar, warKey } from './wars';
import { borderBetween } from '../data/geography';

export interface DiplomaticOption {
  id: DiplomaticDirective;
  label: string;
  /** Absent when the option is selectable. */
  disabledReason?: string;
}

/**
 * Which diplomatic moves are legal against a nation right now. The original
 * swapped the whole menu depending on the state of the relationship, and the
 * refusals it printed were themselves informative.
 */
export function diplomaticOptions(s: GameState, id: NationId): DiplomaticOption[] {
  const n = s.nations[id];
  const front = n.isFront ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'] : null;
  const atWar = n.atWarWith.includes('israel');
  const opts: DiplomaticOption[] = [];

  if (atWar) {
    opts.push({ id: 'ceasefire', label: 'Open negotiations for a ceasefire' });
    opts.push({ id: 'maintain', label: 'Keep diplomatic relations closed' });
    return opts;
  }

  if (n.collapsed) {
    return [
      {
        id: 'maintain',
        label: 'Maintain present relations',
        disabledReason: `There are no formal channels open to ${n.name} at present.`,
      },
    ];
  }

  // Hostile troops on the border block any warming — straight from the manual.
  const hostileOnBorder = !!front && front.enemyActivity >= 2;
  const improveBlock = hostileOnBorder
    ? 'Relations cannot be improved while hostile troops are stationed on the border.'
    : n.israeliPosture === 'supporting_opposition'
      ? 'We are probably too friendly with opposing factions to improve relations.'
      : n.relations >= 9
        ? 'Given the state of relations at present, improvements seem highly unlikely.'
        : undefined;

  if (n.relations >= 4) {
    opts.push({
      id: 'improve',
      label: 'Improve relations by beneficial trade',
      ...(improveBlock ? { disabledReason: improveBlock } : {}),
    });
  } else {
    opts.push({
      id: 'improve',
      label: 'Improve relations with conciliatory actions',
      ...(improveBlock ? { disabledReason: improveBlock } : {}),
    });
  }

  // A Beirut on speaking terms with us can be asked to police its own south.
  // It is the only lever on Hezbollah that goes through a government.
  if (id === 'lebanon' && s.factions.hezbollah?.active && n.relations >= 5) {
    opts.push({
      id: 'press_hezbollah',
      label: 'Press Beirut to deploy its army to the south',
      ...(n.stability < 35
        ? { disabledReason: 'The Lebanese government is too weak to face Hezbollah down.' }
        : {}),
    });
  }

  if (n.pactWith.includes('israel')) {
    opts.push({ id: 'break_pact', label: 'Tear up the defence treaty' });
    opts.push({ id: 'maintain', label: 'Maintain present agreement' });
  } else if (n.relations >= 8) {
    opts.push({
      id: 'sign_pact',
      label: 'Sign a mutual defence treaty — each goes to war if the other is attacked',
    });
    opts.push({ id: 'reduce', label: 'Reduce relations' });
    opts.push({ id: 'maintain', label: 'Maintain present relations' });
  } else {
    opts.push({
      id: 'spoil',
      label: 'Spoil relations by creating an accidental incident',
    });
    opts.push({ id: 'maintain', label: 'Maintain present relations' });
  }

  return opts;
}

/** Apply one month of the player's diplomatic directives. Returns log lines. */
export function resolveDiplomacy(s: GameState, rng: Rng): string[] {
  const notes: string[] = [];

  for (const [key, directive] of Object.entries(s.directives.diplomatic)) {
    const id = key as NationId;
    const n = s.nations[id];
    if (!directive || n.collapsed) continue;

    switch (directive) {
      case 'improve': {
        const front = n.isFront
          ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria']
          : null;
        if (front && front.enemyActivity >= 2) {
          notes.push(
            `Approaches to ${n.name} went nowhere while their forces stand on our border.`,
          );
          break;
        }
        // Warming is slow and gets slower the friendlier you already are.
        const resistance = 1 + n.relations * 0.18;
        const gain = Math.round((rng.int(6, 12) / resistance) * 1.0);
        n.relationsPoints = clamp(n.relationsPoints + gain, -100, 100);
        notes.push(`We are working on improving relations with ${n.name}.`);
        break;
      }

      case 'spoil': {
        n.relationsPoints = clamp(n.relationsPoints - rng.int(14, 24), -100, 100);
        s.tension = clamp(s.tension + rng.int(1, 3), 0, 100);
        // Manufacturing incidents is cheap, but not free: Washington can read
        // a pattern as easily as anyone else.
        adjustRelations(s, 'usa', -3);
        notes.push(`A border dispute between Israel and ${n.name} has aggravated relations.`);
        break;
      }

      case 'reduce': {
        n.relationsPoints = clamp(n.relationsPoints - rng.int(18, 30), -100, 100);
        s.tension = clamp(s.tension + rng.int(2, 4), 0, 100);
        adjustRelations(s, 'usa', -5);
        s.israel.prestige = clamp(s.israel.prestige - 2, 0, 100);
        notes.push(`Israeli-${n.adjective} relations have been noticeably soured.`);
        break;
      }

      case 'sign_pact': {
        if (n.relations >= 8 && !n.pactWith.includes('israel')) {
          n.pactWith.push('israel');
          n.relationsPoints = clamp(n.relationsPoints + 8, -100, 100);
          s.israel.prestige = clamp(s.israel.prestige + 3, 0, 100);
          notes.push(`A mutual defence treaty has been signed between Israel and ${n.name}.`);
        } else {
          notes.push(`${n.name}'s generals were not ready to sign after all.`);
        }
        break;
      }

      case 'break_pact': {
        n.pactWith = n.pactWith.filter((p) => p !== 'israel');
        n.relationsPoints = clamp(n.relationsPoints - 30, -100, 100);
        s.israel.prestige = clamp(s.israel.prestige - 4, 0, 100);
        s.tension = clamp(s.tension + 4, 0, 100);
        notes.push(`Israel has torn up its pact with ${n.name}.`);
        break;
      }

      case 'ceasefire': {
        // The other side has to want it too; a losing enemy wants it more.
        const front = n.isFront
          ? s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria']
          : null;
        const theirPain = front ? clamp(front.warProgress / 100, -1, 1) : 0;
        const willing = rng.next() < 0.25 + theirPain * 0.45;
        if (willing && front) {
          endWar(s, id, notes);
        } else {
          notes.push(`The ${n.adjective}s do not seem to have responded to our previous offer.`);
        }
        break;
      }

      case 'press_hezbollah': {
        const hez = s.factions.hezbollah;
        if (!hez?.active || n.relations < 5 || n.stability < 35) break;
        // Beirut does it, resentfully, and Tehran notices who asked.
        hez.restrained = Math.max(hez.restrained, 2);
        hez.support = clamp(hez.support - 4, 0, 100);
        hez.strength = clamp(hez.strength - 2, 0, 100);
        n.relationsPoints = clamp(n.relationsPoints - 3, -100, 100);
        setInterArab(s, 'lebanon', 'iran', (n.interArab.iran ?? 4) - 1);
        notes.push('The Lebanese army has moved units south, under protest.');
        break;
      }

      case 'maintain':
        break;
    }
  }

  // Recompute the visible ladder position for everyone.
  for (const n of Object.values(s.nations)) {
    n.relations = pointsToRelations(n.relationsPoints);
  }

  return notes;
}

/** Settle a war on one front, U.N.-brokered or bilateral. */
export function endWar(s: GameState, id: NationId, notes: string[]): void {
  const n = s.nations[id];
  if (!n.isFront) return;
  const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];

  front.atWar = false;
  front.warMonths = 0;
  front.warProgress = 0;
  // Our gains may be kept, as the text below says. Theirs are handed back:
  // no Israeli cabinet signs a ceasefire that leaves a Syrian army in Galilee.
  front.lostGround = 0;
  // Our treaty partners stop when we stop.
  for (const ally of front.allies) {
    const a = s.nations[ally];
    a.atWarWith = a.atWarWith.filter((x) => x !== id);
    n.atWarWith = n.atWarWith.filter((x) => x !== ally);
  }
  front.allies = [];
  // The capitals that flew with us want something for it.
  if (front.westernSupport.length > 0) {
    s.israel.restraint = Math.max(s.israel.restraint, WESTERN_UNDERTAKING);
    notes.push('The capitals that flew with us want undertakings in return, and have them.');
  }
  front.westernSupport = [];
  front.demilitarised = true;
  front.demilitarisedMonths = DEMILITARISED_MONTHS;
  n.atWarWith = n.atWarWith.filter((w) => w !== 'israel');
  // A ceasefire is not a friendship, but it reopens the channel.
  n.relationsPoints = clamp(n.relationsPoints + 15, -100, 100);
  n.relations = pointsToRelations(n.relationsPoints);
  s.tension = clamp(s.tension - 8, 0, 100);

  notes.push(
    `Israel and ${n.name} have accepted an immediate ceasefire preceding the ` +
      `total withdrawal of combat forces. Any territory gains made by either ` +
      `side may be kept for the present time.`,
  );
}

/** How long a U.N. military-free zone stands before the mandate runs out. */
export const DEMILITARISED_MONTHS = 36;

export interface MandateEvent {
  text: string;
  category: 'diplomacy';
  weight: number;
}

/** Run down the U.N. mandates, and report any that lapse this month. */
export function expireMandates(s: GameState): MandateEvent[] {
  const out: MandateEvent[] = [];
  for (const id of FRONTS) {
    const front = s.fronts[id];
    if (!front.demilitarised) continue;
    front.demilitarisedMonths = Math.max(0, front.demilitarisedMonths - 1);
    if (front.demilitarisedMonths > 0) continue;
    front.demilitarised = false;
    out.push({
      text: `U.N. mandate on the ${s.nations[id].adjective} border expires`,
      category: 'diplomacy',
      weight: 1,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Alliances
// ---------------------------------------------------------------------------

/** Months of undertakings a Western capital asks for after a war it flew in. */
const WESTERN_UNDERTAKING = 6;

const UNDERTAKING_GIVEN =
  'Israel has given formal undertakings in the Western capitals. They still bind us.';

export interface AllianceOption<T extends string> {
  id: T;
  label: string;
  disabledReason?: string;
}

export interface AllianceEvent {
  text: string;
  category: 'war' | 'diplomacy';
  weight: number;
}

/** Governments close enough to us to be asked to fight beside us. */
export function jointPartners(s: GameState): NationId[] {
  return NATION_IDS.filter((id) => {
    const n = s.nations[id];
    if (n.collapsed || n.atWarWith.includes('israel')) return false;
    return n.pactWith.includes('israel') || n.relations >= 7;
  });
}

/**
 * The enemies a partner might attack alongside us. Only states the partner
 * already despises are on the list at all: nobody in Cairo invades Libya
 * because Jerusalem asked, only because Cairo was halfway there already.
 */
export function jointOptions(s: GameState, partner: NationId): AllianceOption<NationId>[] {
  const p = s.nations[partner];
  const out: AllianceOption<NationId>[] = [];
  for (const id of NATION_IDS) {
    if (id === partner) continue;
    const t = s.nations[id];
    if (t.collapsed || (p.interArab[id] ?? 4) > 2) continue;

    let reason: string | undefined;
    if (s.israel.restraint > 0) reason = UNDERTAKING_GIVEN;
    else if (t.relations > 2) reason = `Relations with ${t.name} are not bad enough to go to war over.`;
    else if (t.isFront) {
      const inv = canInvade(s, id);
      if (!inv.ok) reason = inv.reason;
    } else if (!borderBetween(partner, id)) {
      reason = `${p.name} has no border with ${t.name} to attack across.`;
    }

    out.push({
      id,
      label: `Joint offensive with ${p.name} against ${t.name}`,
      ...(reason ? { disabledReason: reason } : {}),
    });
  }
  return out;
}

/** Who could broker a ceasefire in our war with `enemy`, and why not. */
export function mediatorOptions(s: GameState, enemy: NationId): AllianceOption<MediatorId>[] {
  const out: AllianceOption<MediatorId>[] = [];
  for (const id of POWER_IDS) {
    out.push({
      id,
      label: `Ask ${POWER_NAMES[id]} to broker a ceasefire`,
      ...(relationsWith(s, id) < 45
        ? { disabledReason: `${POWER_NAMES[id]} will not put its name to it on our present terms.` }
        : id === 'usa'
          ? {}
          : {}),
    });
  }
  for (const id of NATION_IDS) {
    if (id === enemy) continue;
    const m = s.nations[id];
    if (m.collapsed || m.atWarWith.includes('israel') || m.atWarWith.includes(enemy)) continue;
    const reason =
      m.relations < 5
        ? `${m.name} is not on good enough terms with us to carry our messages.`
        : (m.interArab[enemy] ?? 4) < 4
          ? `${m.name} has no standing in ${s.nations[enemy].capital}.`
          : undefined;
    out.push({
      id,
      label: `Ask ${m.name} to mediate`,
      ...(reason ? { disabledReason: reason } : {}),
    });
  }
  return out;
}

/** What we might do about a war between two other states. */
export function regionalWarOptions(
  s: GameState,
  war: RegionalWar,
): AllianceOption<RegionalWarDirective>[] {
  const a = s.nations[war.a];
  const b = s.nations[war.b];
  const opts: AllianceOption<RegionalWarDirective>[] = [];

  opts.push({
    id: 'mediate',
    label: `Offer to mediate between ${a.name} and ${b.name}`,
    ...(Math.min(a.relations, b.relations) < 4
      ? { disabledReason: 'At least one side would not accept Israel in the room.' }
      : {}),
  });

  if (war.supporters.israel) {
    opts.push({ id: 'withdraw_support', label: 'Bring our aircraft home' });
  } else {
    for (const [id, side, other] of [
      ['support_a', a, b],
      ['support_b', b, a],
    ] as const) {
      const reason =
        s.israel.restraint > 0
          ? UNDERTAKING_GIVEN
          : side.relations < 6
            ? `We are not close enough to ${side.name} to fight for it.`
            : other.relations > 3
              ? `We have no quarrel with ${other.name} worth a war.`
              : undefined;
      opts.push({
        id,
        label: `Fly for ${side.name} against ${other.name}`,
        ...(reason ? { disabledReason: reason } : {}),
      });
    }
  }
  opts.push({ id: 'none', label: 'Stay out of it' });
  return opts;
}

export function obligationOptions(s: GameState, o: Obligation): AllianceOption<ObligationAnswer>[] {
  const partner = s.nations[o.partner];
  const aggressor = s.nations[o.aggressor];
  return [
    {
      id: 'honour',
      label: `Honour the treaty — go to war with ${aggressor.name}`,
      ...(s.israel.restraint > 0 ? { disabledReason: UNDERTAKING_GIVEN } : {}),
    },
    { id: 'renege', label: `Stay out, and let the treaty with ${partner.name} die` },
  ];
}

/**
 * Israel takes a side in somebody else's war. For a treaty it costs little
 * abroad and buys a great deal at home; by choice it costs more.
 */
function joinWar(
  s: GameState,
  war: RegionalWar,
  side: NationId,
  why: 'treaty' | 'choice',
): AllianceEvent[] {
  const enemyId = side === war.a ? war.b : war.a;
  const enemy = s.nations[enemyId];
  const friend = s.nations[side];

  war.supporters.israel = side;
  enemy.relationsPoints = -100;
  enemy.relations = 0;
  friend.relationsPoints = clamp(friend.relationsPoints + (why === 'treaty' ? 15 : 8), -100, 100);
  s.tension = clamp(s.tension + 6, 0, 100);
  coalitionReact(s, 'hawkish', 6);
  const soft = warOnTerror(s) && TERROR_LIST.includes(enemyId);
  adjustRelations(s, 'usa', -(soft ? 1 : why === 'treaty' ? 2 : 5));
  if (why === 'treaty') s.israel.prestige = clamp(s.israel.prestige + 4, 0, 100);

  const events: AllianceEvent[] = [
    { text: `Israeli jets join the ${friend.adjective} war against ${enemy.name}`, category: 'war', weight: 3 },
  ];

  // A war against a neighbour is a front of our own.
  if (enemy.isFront && !enemy.collapsed && !s.fronts[enemyId as FrontId].atWar) {
    openFront(s, enemyId as FrontId, why !== 'treaty', 0);
    s.fronts[enemyId as FrontId].allies.push(side);
    if (why !== 'treaty') s.stats.warsStarted++;
    events.push({ text: `War on the ${enemy.adjective} border`, category: 'war', weight: 3 });
  }
  return events;
}

/** We did not come. Everybody who has a treaty with us now knows what it is worth. */
function renege(s: GameState, partnerId: NationId): AllianceEvent[] {
  const p = s.nations[partnerId];
  p.pactWith = p.pactWith.filter((x) => x !== 'israel');
  p.relationsPoints = clamp(p.relationsPoints - 40, -100, 100);
  s.israel.prestige = clamp(s.israel.prestige - 6, 0, 100);
  for (const other of Object.values(s.nations)) {
    if (other.id !== partnerId && other.pactWith.includes('israel')) {
      other.relationsPoints = clamp(other.relationsPoints - 10, -100, 100);
    }
  }
  return [{ text: `Israel abandons its treaty with ${p.name}`, category: 'diplomacy', weight: 3 }];
}

/**
 * Treaties called in, joint offensives, mediation, and our part in other
 * people's wars. Runs with the rest of the player's diplomacy, before anybody
 * else moves, so an obligation raised this month is answered next month.
 */
export function resolveAlliances(s: GameState, rng: Rng): AllianceEvent[] {
  const events: AllianceEvent[] = [];
  const d = s.directives;

  // --- treaties called in ------------------------------------------------
  const due = s.obligations.filter((o) => o.turn < s.turn);
  s.obligations = s.obligations.filter((o) => o.turn >= s.turn);
  for (const o of due) {
    const partner = s.nations[o.partner];
    const war = findWar(s, o.partner, o.aggressor);
    // The war ended before we had to choose, or the treaty is already gone.
    if (!war || partner.collapsed || !partner.pactWith.includes('israel')) continue;
    // Silence is an answer, and it is the wrong one.
    const answer = d.obligations[o.id] ?? 'renege';
    if (answer === 'honour' && s.israel.restraint === 0) {
      events.push(...joinWar(s, war, o.partner, 'treaty'));
    } else {
      events.push(...renege(s, o.partner));
    }
  }

  // --- a joint offensive -------------------------------------------------
  if (d.joint && jointPartners(s).includes(d.joint.partner)) {
    const { partner, target } = d.joint;
    const legal = jointOptions(s, partner).find((o) => o.id === target);
    if (legal && !legal.disabledReason) {
      const p = s.nations[partner];
      const t = s.nations[target];
      const chance = clamp(
        0.2 +
          (p.relations - 7) * 0.15 +
          (p.pactWith.includes('israel') ? 0.2 : 0) +
          (2 - (p.interArab[target] ?? 4)) * 0.1,
        0.05,
        0.85,
      );
      if (rng.chance(chance)) {
        s.stats.warsStarted++;
        s.stats.actsOfViolence += 2;
        adjustRelations(s, 'usa', -(warOnTerror(s) && TERROR_LIST.includes(target) ? 4 : 8));
        s.tension = clamp(s.tension + 10, 0, 100);
        coalitionReact(s, 'hawkish', 8);
        // Fighting beside Israel costs a partner its standing in the Arab world.
        for (const other of NATION_IDS) {
          if (other === partner || other === target || s.nations[other].collapsed) continue;
          setInterArab(s, partner, other, (p.interArab[other] ?? 4) - 2);
        }
        t.relationsPoints = -100;
        t.relations = 0;
        if (t.isFront) {
          openFront(s, target as FrontId, true, 12);
          s.fronts[target as FrontId].allies.push(partner);
          if (!p.atWarWith.includes(target)) p.atWarWith.push(target);
          if (!t.atWarWith.includes(partner)) t.atWarWith.push(partner);
        } else {
          startRegionalWar(s, partner, target).supporters.israel = partner;
        }
        events.push({
          text: `${p.name} and Israel launch joint offensive against ${t.name}`,
          category: 'war',
          weight: 3,
        });
      } else {
        p.relationsPoints = clamp(p.relationsPoints - 5, -100, 100);
        events.push({
          text: `${p.name} declined to join an offensive against ${t.name}.`,
          category: 'diplomacy',
          weight: 0,
        });
      }
    }
  }

  // --- somebody else brokers our ceasefire -------------------------------
  for (const [key, mediator] of Object.entries(d.mediation)) {
    const enemy = key as NationId;
    const n = s.nations[enemy];
    if (!mediator || !n.isFront || !s.fronts[enemy as FrontId].atWar) continue;
    const legal = mediatorOptions(s, enemy).find((o) => o.id === mediator);
    if (!legal || legal.disabledReason) continue;

    const front = s.fronts[enemy as FrontId];
    const isPower = (POWER_IDS as string[]).includes(mediator);
    const name = isPower ? POWER_NAMES[mediator as PowerId] : s.nations[mediator as NationId].name;
    const pain = clamp(front.warProgress / 100, -1, 1);
    const chance = clamp(0.25 + pain * 0.45 + (isPower ? 0.25 : 0.2), 0.05, 0.95);

    if (rng.chance(chance)) {
      const notes: string[] = [];
      endWar(s, enemy, notes);
      if (mediator === 'usa') {
        // Washington's name on a ceasefire comes with Washington's terms.
        s.israel.restraint = Math.max(s.israel.restraint, WESTERN_UNDERTAKING);
        adjustRelations(s, 'usa', 5);
      } else if (isPower) {
        adjustRelations(s, mediator as PowerId, 4);
      } else {
        // A neighbour's price is the ground: land for quiet.
        const m = s.nations[mediator as NationId];
        m.relationsPoints = clamp(m.relationsPoints + 10, -100, 100);
        s.israel.prestige = clamp(s.israel.prestige + 2, 0, 100);
        front.occupation = 0;
        front.territoryHeld = false;
      }
      events.push({
        text: `${name} brokers a ceasefire between Israel and ${n.name}`,
        category: 'diplomacy',
        weight: 3,
      });
      for (const note of notes) events.push({ text: note, category: 'diplomacy', weight: 0 });
    } else {
      if (isPower) {
        const p = s.israel.powers[mediator as PowerId];
        p.patience = clamp(p.patience - 10, 0, 100);
      }
      events.push({
        text: `${name}’s mediation fails to stop the ${n.adjective} war`,
        category: 'diplomacy',
        weight: 1,
      });
    }
  }

  // --- other people's wars ------------------------------------------------
  for (const [key, directive] of Object.entries(d.regional)) {
    const war = s.wars.find((w) => warKey(w) === key);
    if (!war || !directive || directive === 'none') continue;
    const legal = regionalWarOptions(s, war).find((o) => o.id === directive);
    if (!legal || legal.disabledReason) continue;
    const a = s.nations[war.a];
    const b = s.nations[war.b];

    switch (directive) {
      case 'mediate': {
        const chance = clamp(
          0.3 + (Math.min(a.relations, b.relations) - 4) * 0.05 + war.months * 0.01,
          0.1,
          0.7,
        );
        if (rng.chance(chance)) {
          endRegionalWar(s, war);
          setInterArab(s, war.a, war.b, 3);
          a.relationsPoints = clamp(a.relationsPoints + 8, -100, 100);
          b.relationsPoints = clamp(b.relationsPoints + 8, -100, 100);
          s.israel.prestige = clamp(s.israel.prestige + 4, 0, 100);
          adjustRelations(s, 'usa', 3);
          events.push({
            text: `Israeli mediation ends the ${a.adjective}-${b.adjective} war`,
            category: 'diplomacy',
            weight: 3,
          });
        } else {
          events.push({
            text: `Our mediation between ${a.name} and ${b.name} came to nothing.`,
            category: 'diplomacy',
            weight: 0,
          });
        }
        break;
      }
      case 'support_a':
        events.push(...joinWar(s, war, war.a, 'choice'));
        break;
      case 'support_b':
        events.push(...joinWar(s, war, war.b, 'choice'));
        break;
      case 'withdraw_support':
        delete war.supporters.israel;
        events.push({ text: 'Israeli aircraft return from a war that was not ours.', category: 'war', weight: 0 });
        break;
    }
  }

  for (const n of Object.values(s.nations)) n.relations = pointsToRelations(n.relationsPoints);
  return events;
}

/** Can Israel plausibly invade this nation? Good relations forbid it. */
export function canInvade(s: GameState, id: NationId): { ok: boolean; reason?: string } {
  const n = s.nations[id];
  if (!n.isFront) return { ok: false, reason: 'No shared border.' };
  if (n.collapsed) return { ok: false, reason: 'That government has already fallen.' };
  const front = s.fronts[id as 'egypt' | 'jordan' | 'lebanon' | 'syria'];
  if (front.demilitarised) {
    return {
      ok: false,
      reason:
        'Since the recent conflict, the U.N. have made this a military free zone.',
    };
  }
  if (n.relations > 3) {
    return {
      ok: false,
      reason:
        'Your generals would refuse to mobilise against so friendly a country, ' +
        'and the Foreign Office would rebel.',
    };
  }
  if (front.deployed.brigades < 2) {
    return { ok: false, reason: 'Insufficient forces are deployed on that border.' };
  }
  return { ok: true };
}
