/**
 * Turn resolution.
 *
 * One call to `resolveTurn` advances the game exactly one month: it applies
 * everything the player queued, lets everybody else move, fights the wars,
 * then builds the newspaper the player will read at the top of the next turn.
 */

import type { FrontId, GameState, Headline, NewspaperIssue } from './types';
import { FRONTS, NATION_IDS } from './types';
import type { NationId } from './types';
import {
  clamp,
  dateLine,
  frontActivityLabel,
  prestigeLabel,
  relationsLabel,
  tensionLabel,
  unrestLabel,
} from './ladders';
import { Rng } from './rng';
import { emptyDirectives, freeBrigades } from './state';
import { endWar, expireMandates, resolveAlliances, resolveDiplomacy } from './diplomacy';
import { driftInternals, resolveIntelligence } from './intelligence';
import { redrawAssessments } from './assessment';
import { INCIDENT_TITLE, resolveFactions, resolveIncidents, resolveSuccessors } from './factions';
import { resolveCombat, resolveRemote, resolveStrategic } from './military';
import { resolveDeliveries, resolveReadiness, updateEmbargoes } from './arms';
import { recomputeOverhead, resolveProduction } from './industry';
import {
  palestinianAcceptance,
  resolveOutbreak,
  resolvePalestine,
  summitKindOf,
} from './palestine';
import { holocaustCheck, resolveNuclear } from './nuclear';
import { runAi } from './ai';
import { runRearmament } from './procurement';
import {
  MAJORITY,
  coalitionReact,
  coalitionSeats,
  pendingCabinetEvent,
  raiseCabinetEvent,
  resolveCabinet,
  resolveCoalition,
} from './coalition';

/**
 * What a Palestinian homeland is worth to each capital in the region, and it
 * is not the same number. A flat +22 to everybody was both too uniform and
 * too generous: Amman has been carrying the refugee question since 1948 and
 * Cairo staked its whole regional position on the peace, while Tehran and
 * Tripoli have no stake in the file at all and merely lose a grievance they
 * were enjoying.
 */
const HOMELAND_GOODWILL: Record<NationId, number> = {
  jordan: 34,
  egypt: 30,
  lebanon: 24,
  syria: 16,
  iraq: 12,
  libya: 8,
  iran: 6,
};

/** Thousands of reservists it takes to stand up two brigades. */
const BRIGADE_MANPOWER = 40;

/** The reserve pool cannot grow past the population that feeds it. */
const RESERVE_CEILING = 460;

/**
 * Share of national product the country will carry without complaint. Israel
 * really was spending around 8.6% in 2000, which is enormous by any other
 * standard and was already a live domestic argument. Past this, the parties
 * that are in government for the welfare budget start counting.
 */
const GNP_TOLERANCE = 10.5;
import { runScripted } from '../data/scripted';
import { FILLER } from '../data/headlines';
import { MASTHEADS } from '../data/nations2000';
import { computeEnding } from './ending';
import {
  POWER_IDS,
  POWER_NAMES,
  RESTRAINT_MONTHS,
  adjustRelations,
  relationsWith,
  resolvePowers,
  warOnTerror,
} from './powers';
import type { PowerId } from './powers';

interface RawEvent {
  text: string;
  category: Headline['category'];
  weight: number;
}

/** Fire the opening month's scripted events and print the first newspaper. */
export function startGame(s: GameState): GameState {
  const rng = new Rng(s.rngSeed);
  const scripted = runScripted(s, rng).map(
    (e): RawEvent => ({ text: e.text, category: 'diplomacy', weight: e.weight }),
  );
  s.rngSeed = rng.seed;
  s.paper = buildNewspaper(s, scripted, rng);
  s.briefing = buildBriefing(s);
  s.phase = 'newspaper';
  return s;
}

export function resolveTurn(s: GameState): GameState {
  const rng = new Rng(s.rngSeed);
  // Whatever was filed since the last paper leads this one.
  const events: RawEvent[] = [...s.wire];
  s.wire = [];

  const push = (
    arr: { text: string; weight: number }[],
    category: Headline['category'],
  ) => {
    for (const e of arr) events.push({ text: e.text, category, weight: e.weight });
  };

  // 1. Arms ordered in earlier months arrive first, so they can be committed.
  push(
    resolveDeliveries(s).map((t) => ({ text: t, weight: 0 })),
    'economy',
  );

  // Our own factories deliver alongside the imports.
  events.push(...resolveProduction(s));
  // Whatever arrived this month may have changed what we can see.
  recomputeOverhead(s);

  // 2. The player's own directives.
  push(
    resolveDiplomacy(s, rng).map((t) => ({ text: t, weight: 0 })),
    'diplomacy',
  );
  events.push(...resolveAlliances(s, rng));
  events.push(...resolveIntelligence(s, rng));
  events.push(...resolvePowers(s, rng));
  events.push(...resolveStrategic(s, rng));
  events.push(...resolveRemote(s, rng));
  push(resolveNuclear(s, rng), 'nuclear');
  events.push(...resolvePalestine(s, rng));
  // The groups nobody governs move after the states do, because most of what
  // they are reacting to is what the states just did. Last month's attacks
  // are answered before this month's are rolled.
  events.push(...resolveIncidents(s, rng));
  events.push(...resolveFactions(s, rng));
  events.push(...resolveSuccessors(s, rng));

  // 3. Everybody else moves.
  events.push(...runAi(s, rng));
  events.push(...runRearmament(s, rng));
  driftInternals(s, rng);

  // 4. Fight.
  events.push(...resolveCombat(s, rng));

  // U.N. mandates run down after the shooting, so a zone that lapses this
  // month is not also fought over in the same month.
  events.push(...expireMandates(s));

  // 5. Consequences.
  push(
    updateEmbargoes(s).map((t) => ({ text: t, weight: 3 })),
    'economy',
  );
  // Spares follow the embargo, so this reads the state the embargo just set.
  push(
    resolveReadiness(s).map((t) => ({ text: t, weight: 1 })),
    'economy',
  );
  // The Knesset gets the last word, after everything that might have
  // offended it has already happened — the cabinet's own business first.
  events.push(...resolveCabinet(s, rng));
  events.push(...resolveCoalition(s, rng));
  updateMeters(s, rng);

  // A month's intelligence picture is settled here and does not move again
  // until next month, so an assessment is a thing the cabinet was given
  // rather than something that changes while it is being read.
  redrawAssessments(s, rng);

  // 6. Advance the calendar.
  s.turn++;
  s.month++;
  if (s.month > 11) {
    s.month = 0;
    s.year++;
  }

  // 7. History, on its own schedule — and the territories, on theirs.
  push(runScripted(s, rng), 'diplomacy');
  events.push(...resolveOutbreak(s, rng));
  // And the coalition, which always has something it wants.
  events.push(...raiseCabinetEvent(s, rng));

  // 8. Endings.
  const ending = checkEndings(s, rng);
  if (ending) {
    s.ending = ending;
    s.phase = 'gameover';
    s.paper = buildNewspaper(s, events, rng);
    s.rngSeed = rng.seed;
    return s;
  }

  // 9. Queue anything that interrupts the normal loop. It waits until the
  //    player has read the papers — and the papers trail it.
  s.phase = 'newspaper';
  if (tabaDue(s)) {
    // The last round. It happens once, whenever the territories are burning
    // and nothing has been signed, and it waits for no calendar.
    s.firedEvents.push('taba');
    s.summitKind = 'taba';
    s.pendingInterstitial = 'summit';
    events.push({ text: summitTrail(s, rng), category: 'diplomacy', weight: 3 });
  } else if (s.month === 6 && shouldHoldSummit(s)) {
    s.summitKind = s.year === 2000 ? 'camp_david' : 'regular';
    s.pendingInterstitial = 'summit';
    events.push({ text: summitTrail(s, rng), category: 'diplomacy', weight: 3 });
  } else if (s.month === 11) {
    s.pendingInterstitial = 'budget';
  } else {
    s.pendingInterstitial = null;
  }

  // 10. Print the paper and clear the desk. Weight-0 items are cabinet notes
  //     rather than news, so they go to the log instead of the front page.
  const dateStamp = dateLine(s.year, s.month);
  for (const e of events) {
    if (e.weight === 0 && e.text.trim()) s.log.unshift(`${dateStamp} — ${e.text}`);
  }
  s.log = s.log.slice(0, 60);
  s.paper = buildNewspaper(s, events, rng);
  s.briefing = buildBriefing(s);
  s.directives = emptyDirectives();

  s.rngSeed = rng.seed;
  return s;
}

/**
 * Leave the newspaper screen. Goes to whatever was queued behind it — a
 * summit or the December budget — and otherwise to the planning desk.
 */
export function advanceFromNewspaper(s: GameState): GameState {
  if (s.pendingInterstitial) {
    s.phase = s.pendingInterstitial;
    s.pendingInterstitial = null;
  } else {
    s.phase = 'planning';
  }
  return s;
}

// ---------------------------------------------------------------------------
// Global meters
// ---------------------------------------------------------------------------

function updateMeters(s: GameState, rng: Rng): void {
  const isr = s.israel;

  // Tension bleeds off slowly when nothing is happening.
  const warCount = FRONTS.filter((f) => s.fronts[f].atWar).length;
  s.tension = clamp(s.tension - 2 + warCount * 4, 0, 100);

  // Prestige tracks strength that the world can see.
  const collapsed = NATION_IDS.filter((id) => s.nations[id].collapsed).length;
  const target = 30 + collapsed * 9 + (relationsWith(s, 'usa') - 50) * 0.2 - s.palestine.unrest * 1.5;
  isr.prestige = clamp(isr.prestige + Math.sign(target - isr.prestige) * 1.5, 0, 100);

  // Washington has a memory but not a grudge. A quiet month pulls the
  // relationship back toward workable, proportionally — so a premier who
  // stops can rebuild it over a year, and one who never stops cannot.
  if (warCount === 0) {
    const baseline = s.stats.nukesUsed > 0 ? 25 : 62;
    adjustRelations(s, 'usa', (baseline - relationsWith(s, 'usa')) * 0.08);
  } else {
    adjustRelations(s, 'usa', -2);
  }

  // Guns and butter. A defence share the economy cannot carry is felt every
  // month, not only in the December when it was voted through.
  if (isr.gnpPercent > GNP_TOLERANCE) {
    // Saturating rather than linear. A country can be visibly overspending on
    // defence without that fact getting monotonically worse for ever, and an
    // unbounded penalty here simply drowns out every other input to standing.
    const strain = Math.min(6, isr.gnpPercent - GNP_TOLERANCE);
    isr.popularity = clamp(isr.popularity - strain * 0.2, 0, 100);
    coalitionReact(s, 'welfare', -strain * 0.25);
  }

  // Conscript classes come of age and the wounded return to their units. The
  // pool refills slowly and only in peace, so a decade of war is a decade of
  // getting smaller.
  if (warCount === 0) {
    isr.reserves = Math.min(RESERVE_CEILING, isr.reserves + 3);
  }

  // Domestic standing.
  let pop = isr.popularity;
  if (warCount === 0 && s.palestine.unrest < 4) pop += 1;
  if (s.palestine.unrest > 7) pop -= 2;
  if (isr.prestige > 70) pop += 1;
  if (freeBrigades(s) === 0) pop -= 1; // border communities feel exposed
  isr.popularity = clamp(pop + rng.int(-1, 1), 0, 100);

  // The monthly budget tops the war chest back up, but never past four months'
  // worth. Money already banked above that line — an American aid package,
  // say — is left alone rather than confiscated; it simply attracts no more.
  if (isr.funds < isr.defenceBudget * 4) {
    isr.funds = Math.min(isr.funds + isr.defenceBudget, isr.defenceBudget * 4);
  }

  reconcileBrigades(s);
}

/**
 * Safety net: brigades can be destroyed in combat and raised at the budget,
 * so make certain the sum of everything committed never exceeds the total.
 * Surplus commitments are pulled off the quietest fronts first.
 */
function reconcileBrigades(s: GameState): void {
  const committed = () =>
    s.palestine.brigadesPosted +
    FRONTS.reduce((acc, f) => acc + s.fronts[f].deployed.brigades, 0);

  let excess = committed() - s.israel.brigades;
  if (excess <= 0) return;

  const order = [...FRONTS].sort(
    (a, b) => Number(s.fronts[a].atWar) - Number(s.fronts[b].atWar),
  );
  for (const f of order) {
    while (excess > 0 && s.fronts[f].deployed.brigades > 0) {
      s.fronts[f].deployed.brigades--;
      excess--;
    }
  }
  while (excess > 0 && s.palestine.brigadesPosted > 0) {
    s.palestine.brigadesPosted--;
    excess--;
  }
}

// ---------------------------------------------------------------------------
// Newspaper
// ---------------------------------------------------------------------------

function buildNewspaper(s: GameState, events: RawEvent[], rng: Rng): NewspaperIssue {
  // Anything with weight 0 is an internal note, not news.
  const printable = events.filter((e) => e.weight > 0 && e.text.trim().length > 0);
  printable.sort((a, b) => b.weight - a.weight);

  const headlines: Headline[] = printable.slice(0, 8).map((e) => ({
    text: e.text,
    category: e.category,
    weight: e.weight,
  }));

  // Pad the page out with wire copy so it always looks like a newspaper.
  // Shuffle rather than sample, so the same story never runs twice.
  const wanted = headlines.length < 4 ? 5 - headlines.length : 2;
  for (const text of rng.shuffle(FILLER).slice(0, wanted)) {
    headlines.push({ text, category: 'filler', weight: 0 });
  }

  return {
    masthead: rng.pick(MASTHEADS),
    dateLine: dateLine(s.year, s.month),
    headlines,
  };
}

// ---------------------------------------------------------------------------
// Briefing — the advisor lines behind the newspaper
// ---------------------------------------------------------------------------

function buildBriefing(s: GameState): string[] {
  const out: string[] = [];
  const isr = s.israel;

  out.push(`Our international prestige is ${prestigeLabel(isr.prestige)}.`);
  out.push(`Middle East tension is ${tensionLabel(s.tension)}.`);
  out.push(`Current defence budget $${Math.round(isr.defenceBudget)} million.`);

  if (relationsWith(s, 'usa') < 35) out.push('Our relationship with the West is becoming strained.');
  if (s.tension > 65) out.push('Tension in the Middle East is now concerning the West.');
  if (s.palestine.unrest > 6)
    out.push('The Palestinian problem is affecting this government’s popularity.');
  if (s.palestine.unrest > 8) out.push('The Palestinian problem may force you out of office.');
  if (freeBrigades(s) === 0)
    out.push('Our border communities are feeling a lack of army presence.');
  if (isr.popularity < 30)
    out.push('The Israeli people have little confidence in your abilities.');
  if (isr.popularity < 18) out.push('The Knesset is trying to remove you.');
  const seats = coalitionSeats(s);
  if (seats < 61) {
    out.push(
      `You are governing without a majority — ${seats} of 120. ` +
        'Every month is a motion of no confidence waiting to be tabled.',
    );
  } else if (seats < 68) {
    out.push(`The coalition holds ${seats} of 120. It would not survive many more walkouts.`);
  }
  if (isr.suppliers.usa.embargoed)
    out.push('The U.S. have officially stopped arms trade with us.');
  else if (relationsWith(s, 'usa') < 45)
    out.push('The U.S Senate is trying to make arms trade with Israel difficult.');
  if (isr.reserves < 100)
    out.push('We now have less than 100,000 people to call up.');
  if (warOnTerror(s) && s.world.nineElevenTurn !== null && s.turn - s.world.nineElevenTurn < 12) {
    out.push(
      s.turn - s.world.nineElevenTurn < 3
        ? 'Washington is assembling its coalition and wants us to hold very still.'
        : 'Washington is fighting a war on terror. It forgives strikes on the armed groups, ' +
            'and on the states that sponsor them, far more readily than it used to.',
    );
  }

  const wars = FRONTS.filter((f) => s.fronts[f].atWar);
  if (wars.length === 1)
    out.push(`The Knesset are worried about the present war against ${s.nations[wars[0]].name}.`);
  if (wars.length >= 2)
    out.push('At the present we have conflict on two fronts. This could over stretch our defences.');
  if (wars.length >= 3)
    out.push('We are now surrounded by enemy attack. This could be serious...');

  for (const incident of s.incidents) {
    out.push(
      `Northern Command: ${INCIDENT_TITLE[incident.kind].toLowerCase()}. ` +
        'The cabinet must decide how to answer, and silence is an answer.',
    );
  }

  const cabinet = pendingCabinetEvent(s);
  if (cabinet) {
    out.push(`Before the cabinet: ${cabinet.title.toLowerCase()}. It needs an answer this month.`);
  }

  for (const o of s.obligations) {
    out.push(
      `${s.nations[o.aggressor].name} has attacked ${s.nations[o.partner].name}. ` +
        'The treaty obliges us to answer this month, and silence is an answer.',
    );
  }

  // Opportunities worth flagging.
  for (const id of NATION_IDS) {
    const n = s.nations[id];
    if (n.collapsed) continue;
    if (n.stability < 20)
      out.push(`The ${n.name} government is close to falling. It should be given a push.`);
    if (n.isFront) {
      const f = s.fronts[id as FrontId];
      if (f.enemyActivity >= 2 && !f.atWar)
        out.push(`Surveillance warning: enemy mobilisation on the ${n.name} border.`);
    }
  }

  if (out.length < 4) out.push('Always keep the security of Israel in mind.');
  return out;
}

/** The SHIFT-B report: one line per neighbour. */
export function officialReport(s: GameState): string[] {
  const out: string[] = [];
  for (const id of NATION_IDS) {
    const n = s.nations[id];
    if (n.collapsed) {
      out.push(`${n.name}: no government. The state is in an anarchic condition.`);
      continue;
    }
    const bits = [`relations ${relationsLabel(n.relations)}`];
    if (n.isFront) {
      const f = s.fronts[id as FrontId];
      // The ladder entries are written as full sentences ("is peaceful."), so
      // trim both ends before folding them into a semicolon-joined line.
      const activity = frontActivityLabel(f.enemyActivity)
        .replace(/^(is|has) /, '')
        .replace(/\.$/, '');
      bits.push(`border ${activity}`);
    }
    if (n.atWarWith.length) bits.push(`at war with ${n.atWarWith.join(', ')}`);
    out.push(`${n.name}: ${bits.join('; ')}.`);
  }
  out.push(`West Bank and Gaza: ${unrestLabel(s.palestine.unrest)}.`);
  return out;
}

// ---------------------------------------------------------------------------
// Summit
// ---------------------------------------------------------------------------

/**
 * Taba: January 2001, after an intifada has had three months to show what
 * the failure at Camp David cost. Queued once, when the territories are
 * burning and nothing has been agreed.
 */
function tabaDue(s: GameState): boolean {
  const p = s.palestine;
  if (s.firedEvents.includes('taba')) return false;
  if (!p.intifada || p.homelandCreated || p.finalStatus === 'agreed') return false;
  if (p.intifadaStartTurn === null) return false;
  return s.year >= 2001 && s.turn - p.intifadaStartTurn >= 3;
}

/** The front page on the morning the delegations arrive. */
function summitTrail(s: GameState, rng: Rng): string {
  if (s.summitKind === 'taba') {
    return rng.pick([
      'Negotiators meet at Taba as the intifada burns',
      'Taba: one last attempt before the clock runs out',
    ]);
  }
  if (s.summitKind === 'camp_david') {
    return rng.pick([
      'Camp David: Clinton gambles everything on sixteen days',
      'Barak and Arafat fly to Maryland as talks begin',
      'Everything on the table at Camp David, say U.S. officials',
    ]);
  }
  if (s.israel.suppliers.usa.embargoed) {
    return 'U.S. embargo on Israel might be scrapped at summit';
  }
  if (FRONTS.some((f) => s.fronts[f].atWar)) {
    return 'Middle Eastern turmoil enters summit month';
  }
  if (s.tension > 70) {
    return rng.pick([
      'U.S. anger over Israeli actions as summit nears',
      'Middle Eastern turmoil enters summit month',
    ]);
  }
  return rng.pick([
    'Middle East in relative peace as summit approaches',
    'U.S. chaired summit gives high hopes for peace',
  ]);
}

function shouldHoldSummit(s: GameState): boolean {
  // Camp David is called regardless. After that, only when things are hot.
  if (s.year === 2000) return true;
  return s.tension > 55 || FRONTS.some((f) => s.fronts[f].atWar);
}

export interface SummitProposal {
  id: string;
  title: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
}

export function summitProposals(s: GameState): SummitProposal[] {
  const out: SummitProposal[] = [];

  const wars = FRONTS.filter((f) => s.fronts[f].atWar);
  for (const f of wars) {
    const n = s.nations[f];
    out.push({
      id: `ceasefire:${f}`,
      title: 'SUMMIT PEACE AGREEMENT',
      body:
        `The U.N. have persuaded ${n.name} to accept an immediate ceasefire ` +
        `preceding the total withdrawal of combat forces. The current territory ` +
        `gains made by Israel may be kept for the present time.`,
      acceptLabel: 'Ratify agreement',
      rejectLabel: 'Ignore proposal',
    });
  }

  // Camp David and Taba are convened precisely to settle this, so there it is
  // on the table whatever the state of the territories. Later summits only
  // raise it once there is visible trouble.
  const kind = summitKindOf(s);
  const homelandOnTable = kind !== 'regular' || s.palestine.unrest >= 3;
  if (!s.palestine.homelandCreated && homelandOnTable) {
    if (kind === 'taba') {
      out.push({
        id: 'homeland',
        title: 'TABA — THE CLINTON PARAMETERS',
        body:
          'The negotiators have gone further than at Camp David: a state on nearly all ' +
          'of the West Bank and Gaza, the Arab neighbourhoods of Jerusalem to the ' +
          'Palestinians and the Jewish ones to us, and a formula on refugees neither ' +
          'side will say aloud. Clinton leaves office within days and the election ' +
          'after that. Signing may end the intifada — if Arafat signs too. The right ' +
          'will say you are negotiating without a mandate, and they will be right.',
        acceptLabel: 'Sign at Taba',
        rejectLabel: 'Refuse — not under fire, and not now',
      });
    } else if (kind === 'camp_david') {
      // The real thing: statehood, borders, and the question nobody solved.
      out.push({
        id: 'homeland',
        title: 'CAMP DAVID — THE FINAL STATUS OFFER',
        body:
          'The Americans have put a package on the table. A Palestinian state on ' +
          'the Gaza Strip and the great majority of the West Bank, with land swaps ' +
          'for the settlement blocs; Palestinian sovereignty over the Arab quarters ' +
          'of Jerusalem; no right of return, but an international fund. Clinton wants ' +
          'an answer before the delegations leave Maryland. ' +
          'If both sides sign, it ends the Palestinian problem and buys you Washington ' +
          'and the world. Arafat has said he is not ready, and your signature does not ' +
          'bind his. Either way, offering it splits your coalition, and the Knesset ' +
          'will not forgive the division of Jerusalem.',
        acceptLabel: 'Sign the framework',
        rejectLabel: 'Refuse — no deal is better than this deal',
      });
    } else {
      const host = s.nations.jordan.collapsed ? s.nations.egypt : s.nations.jordan;
      out.push({
        id: 'homeland',
        title: 'SUMMIT PROPOSAL',
        body:
          `In order to settle the Palestinian problem, the U.N. would like to see ` +
          `the creation of a Palestinian homeland. ${host.name} has offered to take ` +
          `control of the problem. The homeland will be created out of some of their ` +
          `land and the rearranging of Israeli land on the ${host.name} border. ` +
          `This would involve a territorial loss, but a prestige gain — as well as no more PLO.`,
        acceptLabel: 'Agree to create Palestinian homeland',
        rejectLabel: 'Reject proposal',
      });
    }
  }

  // The summit trail has always promised that an embargo "might be scrapped
  // at summit". Until now no such proposal existed and the line was a lie.
  for (const id of POWER_IDS) {
    if (!s.israel.suppliers[id].embargoed) continue;
    const name = POWER_NAMES[id];
    out.push({
      id: `embargo:${id}`,
      title: `${name.toUpperCase()} — THE ARMS EMBARGO`,
      body:
        `${name} will lift the embargo, at a price: formal undertakings on our ` +
        `conduct, given in public and binding for as long as anybody remembers ` +
        `them. The generals will regard it as being told what to do, and they ` +
        `will be right. Refusing keeps our hands free and the catalogue shut.`,
      acceptLabel: 'Give the undertakings and end the embargo',
      rejectLabel: 'Refuse — we will buy elsewhere',
    });
  }

  if (s.tension > 50 && kind !== 'taba') {
    out.push({
      id: 'armscap',
      title: 'SUMMIT PROPOSAL',
      body:
        `In order to reduce tension in the Middle East, the U.N. is asking Israel ` +
        `to undertake an agreement not to increase the size of its operational army. ` +
        `This agreement could be reversed next year.`,
      acceptLabel: 'Agree to give undertaking',
      rejectLabel: 'Refuse such guarantee',
    });
  }

  return out;
}

export function applySummit(
  s: GameState,
  decisions: Record<string, boolean>,
  /**
   * Whether Israel turned up. An empty `decisions` record from a delegation
   * that attended and found nothing to sign is not the same act as an empty
   * chair, and the second one used to be free.
   */
  attended = true,
): string[] {
  const notes: string[] = [];
  // Summits are resolved outside a month's turn, so they carry their own
  // stream of chance and hand it back when they are done.
  const rng = new Rng(s.rngSeed);

  if (!attended) {
    // The absence is noted in every capital that matters — which is what the
    // screen has always told the player, without the game ever meaning it.
    adjustRelations(s, 'usa', -12);
    s.israel.prestige = clamp(s.israel.prestige - 5, 0, 100);
    s.tension = clamp(s.tension + 5, 0, 100);
    // Refusing to be in the room is at least as final as refusing the terms.
    if (s.year === 2000 && !s.firedEvents.includes('camp-david-refused')) {
      s.firedEvents.push('camp-david-refused');
    }
    if (s.year === 2000 || s.summitKind !== 'regular') s.palestine.finalStatus = 'absent';
    notes.push('Israel did not attend the summit. The chair stayed empty.');
    for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} — ${n}`);
    s.phase = 'planning';
    return notes;
  }

  for (const [id, accepted] of Object.entries(decisions)) {
    if (id.startsWith('ceasefire:')) {
      const front = id.split(':')[1] as FrontId;
      if (accepted) {
        // One door out of a war, whether it is brokered here or bilaterally.
        // This path used to duplicate `endWar` and quietly omit the goodwill.
        endWar(s, front, notes);
        s.tension = clamp(s.tension - 4, 0, 100);
        adjustRelations(s, 'usa', 8);
        notes.push(`The ${s.nations[front].name} war has been settled amicably by both sides.`);
      } else {
        adjustRelations(s, 'usa', -10);
        s.israel.prestige = clamp(s.israel.prestige - 3, 0, 100);
        notes.push('Israel walked away from the ceasefire proposal.');
      }
    }

    if (id === 'homeland') {
      if (!accepted) refuseHomeland(s, notes);
      else if (rng.chance(palestinianAcceptance(s))) agreeHomeland(s, notes);
      else palestiniansRefuse(s, notes);
    }

    if (id.startsWith('embargo:')) {
      const power = id.split(':')[1] as PowerId;
      const name = POWER_NAMES[power];
      if (accepted) {
        s.israel.suppliers[power].embargoed = false;
        adjustRelations(s, power, 25);
        s.israel.restraint = RESTRAINT_MONTHS;
        s.israel.prestige = clamp(s.israel.prestige - 5, 0, 100);
        coalitionReact(s, 'hawkish', -12);
        notes.push(`${name} has lifted its arms embargo. Israel gave undertakings for it.`);
      } else {
        adjustRelations(s, power, -6);
        s.israel.popularity = clamp(s.israel.popularity + 3, 0, 100);
        coalitionReact(s, 'hawkish', 6);
        notes.push(`Israel refused ${name} terms for lifting the embargo.`);
      }
    }

    if (id === 'armscap') {
      if (accepted) {
        s.firedEvents.push(`armscap-${s.year}`);
        s.tension = clamp(s.tension - 10, 0, 100);
        adjustRelations(s, 'usa', 10);
        notes.push('Israel has undertaken not to expand its operational army this year.');
      } else {
        s.tension = clamp(s.tension + 4, 0, 100);
        notes.push('Israel refused to cap the size of its army.');
      }
    }
  }

  for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} — ${n}`);
  // The outcome matters too much to leave in the cabinet notes alone.
  s.briefing = [...notes, ...s.briefing];
  s.rngSeed = rng.seed;
  s.phase = 'planning';
  return notes;
}

/** Both signatures. The question comes off the table. */
function agreeHomeland(s: GameState, notes: string[]): void {
  const kind = summitKindOf(s);
  const p = s.palestine;
  p.homelandCreated = true;
  p.finalStatus = 'agreed';
  p.unrest = 0;
  p.intifada = false;
  p.quietMonths = 0;
  p.brigadesPosted = 0;
  if (kind === 'camp_david') s.firedEvents.push('camp-david-agreed');
  s.israel.prestige = clamp(s.israel.prestige + 14, 0, 100);
  adjustRelations(s, 'usa', 18);
  s.tension = clamp(s.tension - 15, 0, 100);
  // The right will never forgive it, and this is where a government
  // assembled out of Meretz and the NRP discovers it cannot hold both.
  s.israel.popularity = clamp(s.israel.popularity - 14, 0, 100);
  coalitionReact(s, 'territorial', 40);
  // At Taba it is worse for a government without a majority: signing under
  // fire, weeks before an election, with no mandate to do it.
  if (kind === 'taba' && coalitionSeats(s) < MAJORITY) {
    s.israel.popularity = clamp(s.israel.popularity - 6, 0, 100);
  }
  for (const n of Object.values(s.nations)) {
    if (!n.collapsed) {
      n.relationsPoints = clamp(n.relationsPoints + HOMELAND_GOODWILL[n.id], -100, 100);
    }
  }
  notes.push('Both sides have signed. A Palestinian state will be created, and the PLO stands down.');
  s.wire.push({
    text:
      kind === 'camp_david'
        ? 'Camp David: Barak and Arafat sign the framework'
        : kind === 'taba'
          ? 'Taba: a Palestinian state agreed at the eleventh hour'
          : 'Summit agrees a Palestinian homeland',
    category: 'palestine',
    weight: 3,
  });
}

/**
 * We signed and they did not. The world gives us credit for going further
 * than anybody had, and the country rallies to the premier who offered
 * everything and was turned down — "there is no partner" is a popular thing
 * to be able to say. The right still punishes the offer, though less than a
 * deal it would have had to live with; and the territories are left with a
 * failed summit and nothing to show for it.
 *
 * The first version charged the offer at full price and then the intifada on
 * top, and a passive premier who signed and was refused survived two games
 * in fifty-eight. That was historically defensible and made the one choice
 * the game presents as statesmanlike a coin flip on death.
 */
function palestiniansRefuse(s: GameState, notes: string[]): void {
  const kind = summitKindOf(s);
  const p = s.palestine;
  p.finalStatus = 'palestinians_refused';
  adjustRelations(s, 'usa', 12);
  adjustRelations(s, 'britain', 6);
  adjustRelations(s, 'france', 5);
  s.israel.prestige = clamp(s.israel.prestige + 6, 0, 100);
  s.israel.popularity = clamp(s.israel.popularity + 4, 0, 100);
  coalitionReact(s, 'territorial', kind === 'taba' ? 12 : 20);
  p.unrest = clamp(p.unrest + 1, 0, 10);
  s.tension = clamp(s.tension + 3, 0, 100);
  notes.push('Israel signed. Arafat did not, and the talks broke up without agreement.');
  s.wire.push({
    text:
      kind === 'camp_david'
        ? 'Arafat walks out of Camp David'
        : kind === 'taba'
          ? 'Taba talks collapse as Arafat holds out'
          : 'Palestinians reject the homeland offer',
    category: 'palestine',
    weight: 3,
  });
}

/** We said no. */
function refuseHomeland(s: GameState, notes: string[]): void {
  const kind = summitKindOf(s);
  s.palestine.finalStatus = 'israel_refused';
  adjustRelations(s, 'usa', kind === 'taba' ? -5 : -8);
  s.palestine.unrest = clamp(s.palestine.unrest + 1.5, 0, 10);
  // At home, refusing plays well — with exactly half the government.
  s.israel.popularity = clamp(s.israel.popularity + (kind === 'taba' ? 3 : 6), 0, 100);
  coalitionReact(s, 'territorial', kind === 'taba' ? -8 : -12);
  if (kind === 'taba') coalitionReact(s, 'hawkish', 4);
  // A collapsed final-status summit is what the autumn was made of.
  if (s.year === 2000 && !s.firedEvents.includes('camp-david-refused')) {
    s.firedEvents.push('camp-david-refused');
  }
  notes.push('Israel rejected the proposal. The talks broke up without agreement.');
  s.wire.push({
    text:
      kind === 'camp_david'
        ? 'Camp David collapses: Israel will not divide Jerusalem'
        : kind === 'taba'
          ? 'Israel walks away from Taba'
          : 'Israel rejects summit homeland plan',
    category: 'palestine',
    weight: 3,
  });
}

// ---------------------------------------------------------------------------
// December budget
// ---------------------------------------------------------------------------

/** The emergency security grant voted after September 2001, $M. Once. */
const EMERGENCY_GRANT = 400;

export interface BudgetOffer {
  aid: number;
  aidRefused: boolean;
  /** A one-off emergency grant on top of the aid, or zero. */
  grant: number;
  canGrowArmy: boolean;
  armyCapped: boolean;
  /** The reserve pool is too thin to stand up two more brigades. */
  noManpower: boolean;
}

export function budgetOffer(s: GameState): BudgetOffer {
  // "the more aggressive Israel appears to be, the less aid you are offered."
  const aggression =
    s.stats.warsStarted * 8 + s.stats.strikesOrdered * 3 + s.stats.nukesUsed * 40;
  const base = (relationsWith(s, 'usa') / 100) * 1800;
  // After September 2001 Washington pays for the front line of its own war.
  const wartime = warOnTerror(s) ? 1.25 : 1;
  const aid = Math.max(0, Math.round((base - aggression * 6) * wartime));
  const capped = s.firedEvents.includes(`armscap-${s.year}`);
  const manpower = s.israel.reserves >= BRIGADE_MANPOWER;
  const embargoed = s.israel.suppliers.usa.embargoed;
  return {
    aid,
    aidRefused: aid <= 0 || embargoed,
    grant: warOnTerror(s) && !s.world.grantPaid && !embargoed ? EMERGENCY_GRANT : 0,
    canGrowArmy: !capped && manpower,
    armyCapped: capped,
    /** Distinct from the arms cap: nobody forbade it, there is simply nobody left. */
    noManpower: !manpower,
  };
}

export function applyBudget(
  s: GameState,
  spending: 'increase' | 'decrease' | 'maintain',
  growArmy: boolean,
): string[] {
  const notes: string[] = [];
  const offer = budgetOffer(s);

  if (!offer.aidRefused) {
    s.israel.funds += offer.aid;
    notes.push(`The U.S. have given a financial aid package worth $${offer.aid} million.`);
  } else {
    notes.push('The U.S. have refused to give us any financial aid.');
  }
  if (offer.grant > 0) {
    s.israel.funds += offer.grant;
    s.world.grantPaid = true;
    notes.push(`Congress has voted an emergency security grant of $${offer.grant} million.`);
  }

  if (spending === 'increase') {
    s.israel.defenceBudget = Math.round(s.israel.defenceBudget * 1.2);
    s.israel.gnpPercent = Math.round((s.israel.gnpPercent + 1.4) * 10) / 10;
    // Guns crowd out butter, and Shas is in this government for the butter.
    // The higher the share already is, the louder they are about it.
    s.israel.popularity = clamp(s.israel.popularity - 4, 0, 100);
    coalitionReact(s, 'welfare', -14 - Math.max(0, s.israel.gnpPercent - GNP_TOLERANCE) * 2);
    notes.push('Defence spending increased. The economy will feel it.');
  } else if (spending === 'decrease') {
    s.israel.defenceBudget = Math.round(s.israel.defenceBudget * 0.85);
    s.israel.gnpPercent = Math.max(1, Math.round((s.israel.gnpPercent - 1.2) * 10) / 10);
    s.israel.popularity = clamp(s.israel.popularity + 3, 0, 100);
    coalitionReact(s, 'welfare', 10);
    notes.push('Defence spending reduced.');
  }

  // An order that cannot be carried out is answered, not silently dropped.
  if (growArmy) {
    if (offer.armyCapped) {
      notes.push('The undertaking given at the summit forbids expanding the army this year.');
    } else if (offer.noManpower) {
      // The men have to come from somewhere, and there is nowhere left.
      notes.push(
        'The General Staff cannot raise further brigades: the reserve pool is exhausted.',
      );
    } else {
      s.israel.brigades += 2;
      // Standing formations are made out of reservists, not conjured beside
      // them. This used to *add* to the pool, which had the arrow backwards.
      s.israel.reserves -= BRIGADE_MANPOWER;
      adjustRelations(s, 'usa', -6);
      s.tension = clamp(s.tension + 4, 0, 100);
      notes.push('Two further brigades — 40,000 combat soldiers — have been raised.');
    }
  }

  for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} — ${n}`);
  s.phase = 'planning';
  return notes;
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

function checkEndings(s: GameState, rng: Rng) {
  // Nuclear holocaust trumps everything.
  if (holocaustCheck(s, rng)) {
    return computeEnding(s, s.stats.nukesUsed > 0 ? 'holocaust' : 'holocaust_bystander');
  }

  // All four neighbours brought down — the stated objective.
  const fronts = FRONTS.map((f) => s.nations[f]);
  if (fronts.every((n) => n.collapsed)) {
    return computeEnding(s, 'victory');
  }

  // Overrun. A front has to stay broken for three months running.
  const overrun = FRONTS.some((f) => s.fronts[f].atWar && s.fronts[f].collapseMonths >= 3);
  if (overrun || s.israel.brigades <= 0) {
    return computeEnding(s, 'invaded');
  }

  // Removed from office — by the House, or by the country.
  if (s.israel.lostConfidence) {
    return computeEnding(s, 'removed_by_knesset');
  }
  if (s.israel.electionLost) {
    return computeEnding(s, 'defeated_at_polls');
  }
  if (s.israel.popularity <= 0) {
    return computeEnding(s, rng.chance(0.25) ? 'assassinated' : 'removed_by_knesset');
  }

  // A decade is long enough for anyone.
  if (s.turn >= 120) {
    return computeEnding(s, 'survived');
  }

  return null;
}

/** Convenience for the UI: the headline text for a front's status line. */
export function frontStatusLine(s: GameState, id: FrontId): string {
  const f = s.fronts[id];
  const n = s.nations[id];
  if (f.atWar) return `The ${n.name} front is at war — month ${f.warMonths}.`;
  return `The ${n.name} front ${frontActivityLabel(f.enemyActivity)}`;
}
