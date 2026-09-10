import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  applyBudget,
  applySummit,
  budgetOffer,
  createGame,
  diplomaticOptions,
  resolveTurn,
  advanceFromNewspaper,
  startGame,
} from './index';
import type { GameState } from './index';
import { DEMILITARISED_MONTHS, endWar, expireMandates } from './diplomacy';
import { resolveCombat, resolveStrategic } from './military';
import { relationsWith, setRelations } from './powers';

/**
 * The screens make promises. These are the ones the engine used not to keep:
 * an absence that was "noted in every capital that matters" and cost nothing,
 * a U.N. zone imposed after "the recent conflict" that never lifted, a posture
 * that could never be put down, and money that was quietly confiscated.
 */

/** Advance one resolved month, stepping over any interstitial on the way. */
function month(g: GameState): void {
  const until = g.turn + 1;
  for (let i = 0; i < 20 && g.turn < until && g.phase !== 'gameover'; i++) {
    if (g.phase === 'newspaper') advanceFromNewspaper(g);
    else if (g.phase === 'summit') applySummit(g, {});
    else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
    else resolveTurn(g);
  }
}

describe('an empty chair costs something', () => {
  it('charges for staying away, and remembers it was Camp David', () => {
    const g = createGame(3);
    startGame(g);
    const us = relationsWith(g, 'usa');
    const prestige = g.israel.prestige;

    applySummit(g, {}, false);

    expect(relationsWith(g, 'usa')).toBeLessThan(us);
    expect(g.israel.prestige).toBeLessThan(prestige);
    expect(g.firedEvents).toContain('camp-david-refused');
  });

  it('still charges nothing when the delegation attended and found nothing to sign', () => {
    const g = createGame(3);
    startGame(g);
    const us = relationsWith(g, 'usa');

    applySummit(g, {});

    expect(relationsWith(g, 'usa')).toBe(us);
    expect(g.firedEvents).not.toContain('camp-david-refused');
  });
});

describe('one door out of a war', () => {
  it('grants the same goodwill whether the ceasefire is brokered or bilateral', () => {
    const bilateral = createGame(11);
    startGame(bilateral);
    bilateral.fronts.lebanon.atWar = true;
    bilateral.nations.lebanon.atWarWith.push('israel');
    const beforeBilateral = bilateral.nations.lebanon.relationsPoints;
    endWar(bilateral, 'lebanon', []);

    const summit = createGame(11);
    startGame(summit);
    summit.fronts.lebanon.atWar = true;
    summit.nations.lebanon.atWarWith.push('israel');
    const beforeSummit = summit.nations.lebanon.relationsPoints;
    applySummit(summit, { 'ceasefire:lebanon': true });

    expect(bilateral.nations.lebanon.relationsPoints).toBeGreaterThan(beforeBilateral);
    expect(summit.nations.lebanon.relationsPoints - beforeSummit).toBe(
      bilateral.nations.lebanon.relationsPoints - beforeBilateral,
    );
    expect(summit.fronts.lebanon.atWar).toBe(false);
  });
});

describe('the U.N. mandate is a mandate, not a wall', () => {
  it('lifts once its term has run', () => {
    const g = createGame(5);
    startGame(g);
    g.fronts.lebanon.atWar = true;
    g.nations.lebanon.atWarWith.push('israel');
    endWar(g, 'lebanon', []);

    expect(g.fronts.lebanon.demilitarised).toBe(true);
    expect(g.fronts.lebanon.demilitarisedMonths).toBe(DEMILITARISED_MONTHS);

    for (let i = 0; i < DEMILITARISED_MONTHS - 1; i++) expireMandates(g);
    expect(g.fronts.lebanon.demilitarised).toBe(true);

    const events = expireMandates(g);
    expect(g.fronts.lebanon.demilitarised).toBe(false);
    expect(events.some((e) => /mandate/i.test(e.text))).toBe(true);
  });

  it('leaves fronts that were never demilitarised alone', () => {
    const g = createGame(5);
    startGame(g);
    expect(expireMandates(g)).toHaveLength(0);
  });
});

describe('a government falls the same way however it fell', () => {
  it('clears the loser’s pacts when the collapse came by conquest', () => {
    const g = createGame(9);
    startGame(g);
    // Lebanon opens the game in a pact with Syria.
    expect(g.nations.lebanon.pactWith).toContain('syria');

    g.directives.strategic.lebanon = 'deploy_all';
    resolveStrategic(g, new Rng(1));
    g.directives.strategic = {};
    g.fronts.lebanon.atWar = true;
    g.nations.lebanon.atWarWith.push('israel');
    g.fronts.lebanon.warProgress = 99;

    resolveCombat(g, new Rng(2));

    expect(g.nations.lebanon.collapsed).toBe(true);
    expect(g.nations.lebanon.collapseCause).toBe('invasion');
    // These three were the ones the inlined copy used to miss.
    expect(g.nations.lebanon.pactWith).toEqual([]);
    expect(g.fronts.lebanon.enemyActivity).toBe(0);
    expect(g.log.some((l) => /Lebanon: government collapsed/.test(l))).toBe(true);
  });
});

describe('our posture is what we are doing now', () => {
  it('reverts to neutral once we stop, reopening the diplomatic channel', () => {
    const g = createGame(13);
    startGame(g);
    advanceFromNewspaper(g);

    g.directives.intel.syria = 'support_insurgents';
    month(g);
    expect(g.nations.syria.israeliPosture).toBe('supporting_opposition');

    // A month with no operation in Damascus.
    month(g);
    expect(g.nations.syria.israeliPosture).toBe('neutral');
  });

  it('blocks improving relations only while we are actually funding them', () => {
    const g = createGame(17);
    startGame(g);
    g.nations.syria.israeliPosture = 'supporting_opposition';
    const blocked = diplomaticOptions(g, 'syria').find((o) => o.id === 'improve');
    expect(blocked?.disabledReason).toBeTruthy();

    g.nations.syria.israeliPosture = 'neutral';
    const open = diplomaticOptions(g, 'syria').find((o) => o.id === 'improve');
    expect(open?.disabledReason).toBeUndefined();
  });
});

describe('money we were given is money we keep', () => {
  it('does not confiscate an American aid package at the month boundary', () => {
    const g = createGame(21);
    startGame(g);
    setRelations(g, 'usa', 90);
    // A premier who has been saving for a big order, and then gets a package.
    g.israel.funds = g.israel.defenceBudget * 3;
    const offer = budgetOffer(g);
    expect(offer.aidRefused).toBe(false);
    expect(offer.aid).toBeGreaterThan(0);

    applyBudget(g, 'maintain', false);
    const banked = g.israel.funds;
    expect(banked).toBeGreaterThan(g.israel.defenceBudget * 4);

    month(g);
    // The stipend stops topping up above the ceiling; it does not claw back.
    expect(g.israel.funds).toBeGreaterThanOrEqual(banked);
  });
});

describe('an embargo punishes us once, not twice', () => {
  it('does not bleed loyalty from a supplier who is refusing to sell', () => {
    const g = createGame(23);
    startGame(g);
    advanceFromNewspaper(g);
    g.israel.suppliers.usa.embargoed = true;
    const embargoed = g.israel.suppliers.usa.loyalty;
    const trading = g.israel.suppliers.dealer.loyalty;

    month(g);

    expect(g.israel.suppliers.usa.loyalty).toBe(embargoed);
    expect(g.israel.suppliers.dealer.loyalty).toBeLessThan(trading);
  });
});

describe('the bomb programme keeps working after the last rung', () => {
  it('turns further funding into devices rather than nothing', () => {
    const g = createGame(29);
    startGame(g);
    advanceFromNewspaper(g);
    g.israel.nuclearPosture = 'tested';
    g.israel.nuclearProgress = 95;
    const warheads = g.israel.warheads;

    g.directives.fundNuclear = true;
    month(g);

    expect(g.israel.warheads).toBe(warheads + 1);
    expect(g.israel.nuclearPosture).toBe('tested');
  });
});
