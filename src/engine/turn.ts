/**
 * Turn resolution.
 *
 * One call to `resolveTurn` advances the game exactly one month: it applies
 * everything the player queued, lets everybody else move, fights the wars,
 * then builds the newspaper the player will read at the top of the next turn.
 */

import type { FrontId, GameState, Headline, NewspaperIssue } from './types';
import { FRONTS, NATION_IDS } from './types';
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
import { endWar, expireMandates, resolveDiplomacy } from './diplomacy';
import { driftInternals, resolveIntelligence } from './intelligence';
import { resolveCombat, resolveStrategic } from './military';
import { resolveDeliveries, resolveReadiness, updateEmbargoes } from './arms';
import { resolveProduction } from './industry';
import { resolvePalestine } from './palestine';
import { holocaustCheck, resolveNuclear } from './nuclear';
import { runAi } from './ai';
import { runRearmament } from './procurement';
import { runScripted } from '../data/scripted';
import { FILLER } from '../data/headlines';
import { MASTHEADS } from '../data/nations2000';
import { computeEnding } from './ending';

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
  const events: RawEvent[] = [];

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

  // 2. The player's own directives.
  push(
    resolveDiplomacy(s, rng).map((t) => ({ text: t, weight: 0 })),
    'diplomacy',
  );
  events.push(...resolveIntelligence(s, rng));
  events.push(...resolveStrategic(s, rng));
  push(resolveNuclear(s, rng), 'nuclear');
  events.push(...resolvePalestine(s, rng));

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
  updateMeters(s, rng);

  // 6. Advance the calendar.
  s.turn++;
  s.month++;
  if (s.month > 11) {
    s.month = 0;
    s.year++;
  }

  // 7. History, on its own schedule.
  push(runScripted(s, rng), 'diplomacy');

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
  if (s.month === 6 && shouldHoldSummit(s)) {
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
  const target = 30 + collapsed * 9 + (isr.usRelations - 50) * 0.2 - s.palestine.unrest * 1.5;
  isr.prestige = clamp(isr.prestige + Math.sign(target - isr.prestige) * 1.5, 0, 100);

  // Washington has a memory but not a grudge. A quiet month pulls the
  // relationship back toward workable, proportionally — so a premier who
  // stops can rebuild it over a year, and one who never stops cannot.
  if (warCount === 0) {
    const baseline = s.stats.nukesUsed > 0 ? 25 : 62;
    isr.usRelations = clamp(isr.usRelations + (baseline - isr.usRelations) * 0.08, 0, 100);
  } else {
    isr.usRelations = clamp(isr.usRelations - 2, 0, 100);
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

  if (isr.usRelations < 35) out.push('Our relationship with the West is becoming strained.');
  if (s.tension > 65) out.push('Tension in the Middle East is now concerning the West.');
  if (s.palestine.unrest > 6)
    out.push('The Palestinian problem is affecting this government’s popularity.');
  if (s.palestine.unrest > 8) out.push('The Palestinian problem may force you out of office.');
  if (freeBrigades(s) === 0)
    out.push('Our border communities are feeling a lack of army presence.');
  if (isr.popularity < 30)
    out.push('The Israeli people have little confidence in your abilities.');
  if (isr.popularity < 18) out.push('The Knesset is trying to remove you.');
  if (isr.suppliers.usa.embargoed)
    out.push('The U.S. have officially stopped arms trade with us.');
  else if (isr.usRelations < 45)
    out.push('The U.S Senate is trying to make arms trade with Israel difficult.');
  if (isr.reserves < 100)
    out.push('We now have less than 100,000 people to call up.');

  const wars = FRONTS.filter((f) => s.fronts[f].atWar);
  if (wars.length === 1)
    out.push(`The Knesset are worried about the present war against ${s.nations[wars[0]].name}.`);
  if (wars.length >= 2)
    out.push('At the present we have conflict on two fronts. This could over stretch our defences.');
  if (wars.length >= 3)
    out.push('We are now surrounded by enemy attack. This could be serious...');

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

/** The front page on the morning the delegations arrive. */
function summitTrail(s: GameState, rng: Rng): string {
  if (s.year === 2000) {
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

  // Camp David is convened precisely to settle this, so in July 2000 it is on
  // the table whatever the state of the territories. Later summits only raise
  // it once there is visible trouble.
  const homelandOnTable = s.year === 2000 || s.palestine.unrest >= 3;
  if (!s.palestine.homelandCreated && homelandOnTable) {
    if (s.year === 2000) {
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
          'Signing ends the Palestinian problem and buys you Washington and the world. ' +
          'It also splits your coalition, and the Knesset will not forgive the ' +
          'division of Jerusalem.',
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

  if (s.tension > 50) {
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

  if (!attended) {
    // The absence is noted in every capital that matters — which is what the
    // screen has always told the player, without the game ever meaning it.
    s.israel.usRelations = clamp(s.israel.usRelations - 12, 0, 100);
    s.israel.prestige = clamp(s.israel.prestige - 5, 0, 100);
    s.tension = clamp(s.tension + 5, 0, 100);
    // Refusing to be in the room is at least as final as refusing the terms.
    if (s.year === 2000 && !s.firedEvents.includes('camp-david-refused')) {
      s.firedEvents.push('camp-david-refused');
    }
    notes.push('Israel did not attend the summit. The chair stayed empty.');
    for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} - ${n}`);
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
        s.israel.usRelations = clamp(s.israel.usRelations + 8, 0, 100);
        notes.push(`The ${s.nations[front].name} war has been settled amicably by both sides.`);
      } else {
        s.israel.usRelations = clamp(s.israel.usRelations - 10, 0, 100);
        s.israel.prestige = clamp(s.israel.prestige - 3, 0, 100);
        notes.push('Israel walked away from the ceasefire proposal.');
      }
    }

    if (id === 'homeland') {
      if (accepted) {
        s.palestine.homelandCreated = true;
        s.palestine.unrest = 0;
        s.palestine.intifada = false;
        s.palestine.brigadesPosted = 0;
        s.israel.prestige = clamp(s.israel.prestige + 14, 0, 100);
        s.israel.usRelations = clamp(s.israel.usRelations + 18, 0, 100);
        s.tension = clamp(s.tension - 15, 0, 100);
        // The right will never forgive it.
        s.israel.popularity = clamp(s.israel.popularity - 14, 0, 100);
        for (const n of Object.values(s.nations)) {
          if (!n.collapsed) n.relationsPoints = clamp(n.relationsPoints + 22, -100, 100);
        }
        notes.push('A Palestinian homeland has been agreed. The PLO stands down.');
      } else {
        s.israel.usRelations = clamp(s.israel.usRelations - 8, 0, 100);
        s.palestine.unrest = clamp(s.palestine.unrest + 1.5, 0, 10);
        // At home, refusing plays well.
        s.israel.popularity = clamp(s.israel.popularity + 6, 0, 100);
        // A collapsed final-status summit is what the autumn was made of.
        // Remember it, so September has a reason to catch fire.
        if (s.year === 2000 && !s.firedEvents.includes('camp-david-refused')) {
          s.firedEvents.push('camp-david-refused');
        }
        notes.push('Israel rejected the homeland proposal. The talks broke up without agreement.');
      }
    }

    if (id === 'armscap') {
      if (accepted) {
        s.firedEvents.push(`armscap-${s.year}`);
        s.tension = clamp(s.tension - 10, 0, 100);
        s.israel.usRelations = clamp(s.israel.usRelations + 10, 0, 100);
        notes.push('Israel has undertaken not to expand its operational army this year.');
      } else {
        s.tension = clamp(s.tension + 4, 0, 100);
        notes.push('Israel refused to cap the size of its army.');
      }
    }
  }

  for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} - ${n}`);
  s.phase = 'planning';
  return notes;
}

// ---------------------------------------------------------------------------
// December budget
// ---------------------------------------------------------------------------

export interface BudgetOffer {
  aid: number;
  aidRefused: boolean;
  canGrowArmy: boolean;
  armyCapped: boolean;
}

export function budgetOffer(s: GameState): BudgetOffer {
  // "the more aggressive Israel appears to be, the less aid you are offered."
  const aggression =
    s.stats.warsStarted * 8 + s.stats.strikesOrdered * 3 + s.stats.nukesUsed * 40;
  const base = (s.israel.usRelations / 100) * 1800;
  const aid = Math.max(0, Math.round(base - aggression * 6));
  return {
    aid,
    aidRefused: aid <= 0 || s.israel.suppliers.usa.embargoed,
    canGrowArmy: !s.firedEvents.includes(`armscap-${s.year}`),
    armyCapped: s.firedEvents.includes(`armscap-${s.year}`),
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

  if (spending === 'increase') {
    s.israel.defenceBudget = Math.round(s.israel.defenceBudget * 1.2);
    s.israel.gnpPercent = Math.round((s.israel.gnpPercent + 1.4) * 10) / 10;
    // Guns crowd out butter.
    s.israel.popularity = clamp(s.israel.popularity - 4, 0, 100);
    notes.push('Defence spending increased. The economy will feel it.');
  } else if (spending === 'decrease') {
    s.israel.defenceBudget = Math.round(s.israel.defenceBudget * 0.85);
    s.israel.gnpPercent = Math.max(1, Math.round((s.israel.gnpPercent - 1.2) * 10) / 10);
    s.israel.popularity = clamp(s.israel.popularity + 3, 0, 100);
    notes.push('Defence spending reduced.');
  }

  if (growArmy && offer.canGrowArmy) {
    s.israel.brigades += 2;
    s.israel.reserves += 40;
    s.israel.usRelations = clamp(s.israel.usRelations - 6, 0, 100);
    s.tension = clamp(s.tension + 4, 0, 100);
    notes.push('Two further brigades — 40,000 combat soldiers — have been raised.');
  }

  for (const n of notes) s.log.unshift(`${dateLine(s.year, s.month)} - ${n}`);
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

  // Removed from office.
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
