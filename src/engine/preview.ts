/**
 * What you have just ordered, before you find out.
 *
 * The newspaper is the interface to consequence and should stay that way —
 * this is not a forecast of what will *happen*. It is a statement of what has
 * been *committed*: money that is already spent, promises that will bind, and
 * which half of the coalition is about to be told something it will not like.
 * All of it is knowable to a cabinet before the month begins, and all of it was
 * previously discoverable only afterwards.
 *
 * Everything here is read-only over `GameState`. Nothing in this file may
 * mutate anything: it runs on every render.
 */

import type { GameState } from './types';
import { FRONTS, NATION_IDS, REMOTE_IDS } from './types';
import { REACH } from './military';
import { MOSSAD_CAPACITY, OP_FUNDS, committedCapacity } from './intelligence';
import { LOBBY_COST, POWER_IDS, POWER_NAMES, RESTRAINT_MONTHS } from './powers';
import { industrySpend } from './industry';
import { coalitionSeats, electionOutlook, pendingCabinetEvent } from './coalition';
import { MAJORITY, PARTNERS } from '../data/coalition2000';
import { factionSeedById } from '../data/factions2000';
import { responseById } from '../data/responses2000';
import { INCIDENT_TITLE } from './factions';

/** What funding the bomb costs for a month. */
const NUCLEAR_MONTHLY = 55;

/** What arming a faction costs for a month. */
const FACTION_BACKING = 25;

export interface QueuedEffect {
  /** Groups the list, and tells the player which screen it came from. */
  area: string;
  text: string;
  tone?: 'warn' | 'bad';
}

/**
 * Everything committed this month, in the order a chief of staff would raise
 * it: what it costs, who it upsets, and what it stops us doing.
 */
export function previewTurn(s: GameState): QueuedEffect[] {
  const out: QueuedEffect[] = [];
  const d = s.directives;

  // --- money ---------------------------------------------------------------
  let spend = industrySpend(s);
  for (const directive of Object.values(d.intel)) {
    if (directive && directive !== 'none') spend += OP_FUNDS[directive];
  }
  for (const directive of Object.values(d.powers)) {
    if (directive === 'lobby') spend += LOBBY_COST;
  }
  for (const directive of Object.values(d.factions)) {
    if (directive === 'back') spend += FACTION_BACKING;
  }
  if (d.fundNuclear) spend += NUCLEAR_MONTHLY;

  if (spend > 0) {
    const over = spend > s.israel.funds;
    out.push({
      area: 'Treasury',
      text: over
        ? `$${spend} M committed against $${Math.round(s.israel.funds)} M on hand. ` +
          'Something will not be paid for.'
        : `$${spend} M committed of $${Math.round(s.israel.funds)} M on hand.`,
      ...(over ? { tone: 'bad' as const } : {}),
    });
  }

  // --- Mossad --------------------------------------------------------------
  const load = committedCapacity(s);
  if (load > MOSSAD_CAPACITY) {
    out.push({
      area: 'Mossad',
      text:
        `${load} operations against a capacity of ${MOSSAD_CAPACITY}. ` +
        'Every one of them will be weaker and likelier to be exposed.',
      tone: 'bad',
    });
  } else if (load > 0) {
    out.push({ area: 'Mossad', text: `${load} of ${MOSSAD_CAPACITY} operations committed.` });
  }

  // --- who this upsets -----------------------------------------------------
  // The coalition is the most opaque mechanism in the game: partners react to
  // the act, not to your polling, and the same act moves them opposite ways.
  const concessions = Object.values(d.powers).filter((x) => x === 'concede').length;
  const defiance = Object.values(d.powers).filter((x) => x === 'defy').length;
  const hardPolicing = d.policing === 'harden';
  const strikes =
    Object.values(d.strategic).filter((x) => x && x.startsWith('strike')).length +
    Object.values(d.remote).filter((x) => x && x !== 'none').length +
    Object.values(d.factions).filter((x) => x === 'strike').length;
  const invasions = Object.values(d.strategic).filter((x) => x === 'invade').length;

  const hawkish =
    defiance * 8 +
    strikes * 4 +
    (hardPolicing ? 2.5 : 0) +
    invasions * 12 -
    concessions * 10;
  if (hawkish !== 0) {
    const upset = PARTNERS.filter(
      (p) => !p.ownParty && p.hawkish * hawkish < 0 && s.israel.coalition[p.id]?.inCoalition,
    );
    if (upset.length > 0) {
      const fragile = upset.filter((p) => (s.israel.coalition[p.id]?.satisfaction ?? 100) < 40);
      out.push({
        area: 'The coalition',
        text:
          `${listOf(upset.map((p) => p.name))} will not like this.` +
          (fragile.length > 0
            ? ` ${listOf(fragile.map((p) => p.name))} ${
                fragile.length === 1 ? 'is' : 'are'
              } already close to walking.`
            : ''),
        ...(fragile.length > 0 ? { tone: 'warn' as const } : {}),
      });
    }
  }

  // --- promises that bind --------------------------------------------------
  if (concessions > 0 && s.israel.restraint === 0) {
    out.push({
      area: 'Undertakings',
      text:
        `Formal undertakings bind us for ${RESTRAINT_MONTHS} months. ` +
        'The airstrikes and the invasion come off the menu for all of it.',
      tone: 'warn',
    });
  }

  // --- the borders ---------------------------------------------------------
  for (const id of FRONTS) {
    const directive = d.strategic[id];
    if (!directive || directive === 'none') continue;
    const name = s.nations[id].name;
    if (directive === 'invade') {
      out.push({
        area: 'The borders',
        text: `Invading ${name} starts a war that only a ceasefire or a collapse ends.`,
        tone: 'bad',
      });
    } else if (directive.startsWith('strike')) {
      out.push({
        area: 'The borders',
        text: `Striking ${name} is roughly even money to start a war outright.`,
        tone: 'warn',
      });
    } else if (directive === 'withdraw') {
      out.push({ area: 'The borders', text: `Everything on the ${name} border comes home.` });
    }
  }

  // --- beyond the borders --------------------------------------------------
  for (const id of REMOTE_IDS) {
    const directive = d.remote[id];
    if (!directive || directive === 'none') continue;
    out.push({
      area: 'Beyond the borders',
      text: `Bombing ${s.nations[id].name} will be answered. ${REACH[id].answer}`,
      tone: 'warn',
    });
  }

  // --- covert --------------------------------------------------------------
  for (const id of NATION_IDS) {
    const directive = d.intel[id];
    if (directive !== 'assassinate' && directive !== 'coup') continue;
    const n = s.nations[id];
    out.push({
      area: 'Covert action',
      text:
        `A ${directive === 'coup' ? 'coup' : 'decapitation'} in ${n.name}. ` +
        (n.network < 40
          ? 'Our network there is thin, and a failure would burn what is left of it.'
          : 'If it fails, the network there is burnt for years.'),
      tone: n.network < 40 ? 'bad' : 'warn',
    });
  }

  // --- alliances -----------------------------------------------------------
  for (const o of s.obligations) {
    const partner = s.nations[o.partner].name;
    const aggressor = s.nations[o.aggressor];
    const answer = d.obligations[o.id];
    if (answer === 'honour') {
      out.push({
        area: 'Treaties',
        text:
          `Honouring the treaty with ${partner} puts Israeli aircraft over ${aggressor.name}` +
          (aggressor.isFront ? `, and opens the ${aggressor.adjective} front.` : '.'),
        tone: 'warn',
      });
    } else {
      out.push({
        area: 'Treaties',
        text:
          `${answer ? 'Staying out' : 'Unanswered, the obligation is a refusal'}: the treaty ` +
          `with ${partner} dies, and every other partner will draw its conclusions.`,
        tone: 'bad',
      });
    }
  }
  if (d.joint) {
    out.push({
      area: 'Alliances',
      text:
        `A joint offensive with ${s.nations[d.joint.partner].name} against ` +
        `${s.nations[d.joint.target].name} is a war of our choosing, if they agree to it.`,
      tone: 'bad',
    });
  }
  for (const [enemy, mediator] of Object.entries(d.mediation)) {
    if (mediator !== 'usa') continue;
    out.push({
      area: 'Alliances',
      text:
        `If Washington brokers peace with ${s.nations[enemy as keyof typeof s.nations].name}, ` +
        'it will want undertakings that bind us for months.',
      tone: 'warn',
    });
  }

  // --- the powers ----------------------------------------------------------
  for (const id of POWER_IDS) {
    if (d.powers[id] !== 'defy') continue;
    out.push({
      area: 'The powers',
      text: `Rejecting ${POWER_NAMES[id]} publicly plays well at home and costs us there.`,
    });
  }

  // --- factions ------------------------------------------------------------
  for (const [key, directive] of Object.entries(d.factions)) {
    if (directive !== 'strike') continue;
    const seed = factionSeedById(key);
    if (!seed) continue;
    out.push({
      area: 'Armed groups',
      text: `Striking ${seed.name} will weaken them and recruit for them at the same time.`,
    });
  }

  // --- the northern border -------------------------------------------------
  for (const incident of s.incidents) {
    const chosen = d.incidentResponse[incident.id];
    const spec = chosen ? responseById(chosen) : null;
    out.push(
      spec
        ? {
            area: 'Northern Command',
            text: `${spec.label}. ${spec.detail}.`,
            ...(spec.escalation && spec.escalation >= 0.1 ? { tone: 'warn' as const } : {}),
          }
        : {
            area: 'Northern Command',
            text:
              `${INCIDENT_TITLE[incident.kind]} has not been answered. Silence reads as ` +
              'restraint abroad and as weakness at home.',
            tone: 'warn',
          },
    );
  }

  // --- the cabinet ---------------------------------------------------------
  const question = pendingCabinetEvent(s);
  if (question) {
    const chosen = question.choices.find((c) => c.id === d.cabinetChoice);
    out.push(
      chosen
        ? { area: 'The cabinet', text: `${chosen.label}: ${chosen.detail}.` }
        : {
            area: 'The cabinet',
            text:
              `Nobody has decided about ${question.title.toLowerCase()}. It will be decided ` +
              'for us, and the country will notice we did not.',
            tone: 'warn',
          },
    );
  }
  if (d.callElection) {
    out.push({
      area: 'The Knesset',
      text: `We go to the country. ${electionOutlook(s)} Losing ends the premiership.`,
      tone: 'bad',
    });
  }

  // --- the House -----------------------------------------------------------
  const seats = coalitionSeats(s);
  if (seats < MAJORITY) {
    out.push({
      area: 'The Knesset',
      text: `Governing without a majority — ${seats} of 120. Every month costs standing.`,
      tone: 'warn',
    });
  }

  return out;
}

function listOf(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
