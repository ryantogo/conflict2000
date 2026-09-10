import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  advanceFromNewspaper,
  applyBudget,
  budgetOffer,
  coalitionReport,
  createGame,
  resolveTurn,
  startGame,
} from './index';
import type { GameState } from './index';
import { resolveCombat } from './military';

/**
 * Manpower and money. Both were decorative: `reserves` was decremented in
 * combat and gated nothing, and `gnpPercent` was written at the budget and
 * read only by two screens.
 */

/** Put a real war on the Syrian border and fight it. */
function warOnSyria(g: GameState): void {
  g.fronts.syria.atWar = true;
  g.nations.syria.atWarWith.push('israel');
  g.fronts.syria.deployed.brigades = 3;
  g.israel.brigades = 7;
}

describe('the reserve pool', () => {
  it('refills in peacetime, and only in peacetime', () => {
    const g = createGame(1);
    startGame(g);
    g.israel.reserves = 300;

    for (let i = 0; i < 6 && g.phase !== 'gameover'; i++) {
      if (g.phase === 'newspaper') advanceFromNewspaper(g);
      else resolveTurn(g);
    }
    expect(g.israel.reserves).toBeGreaterThan(300);
  });

  it('is spent raising brigades rather than created by it', () => {
    const g = createGame(2);
    startGame(g);
    const before = g.israel.reserves;
    const brigades = g.israel.brigades;

    applyBudget(g, 'maintain', true);

    expect(g.israel.brigades).toBe(brigades + 2);
    // Standing formations are made out of reservists, not conjured beside them.
    expect(g.israel.reserves).toBe(before - 40);
  });

  it('refuses to raise brigades there is nobody left to fill', () => {
    const g = createGame(3);
    startGame(g);
    g.israel.reserves = 20;

    const offer = budgetOffer(g);
    expect(offer.noManpower).toBe(true);
    expect(offer.canGrowArmy).toBe(false);

    const brigades = g.israel.brigades;
    const notes = applyBudget(g, 'maintain', true);
    expect(g.israel.brigades).toBe(brigades);
    expect(notes.some((n) => /reserve pool is exhausted/.test(n))).toBe(true);
  });

  it('thins out an emergency mobilisation when the barrel is empty', () => {
    const deep = createGame(4);
    const empty = createGame(4);
    for (const g of [deep, empty]) {
      startGame(g);
      warOnSyria(g);
      g.fronts.syria.warProgress = -40; // the line is about to break
    }
    deep.israel.reserves = 400;
    empty.israel.reserves = 30;

    resolveCombat(deep, new Rng(11));
    resolveCombat(empty, new Rng(11));

    expect(deep.fronts.syria.deployed.brigades).toBeGreaterThan(
      empty.fronts.syria.deployed.brigades,
    );
  });
});

describe('war weariness', () => {
  it('costs the coalition its patience as the casualties come in', () => {
    const g = createGame(5);
    startGame(g);
    warOnSyria(g);
    const before = coalitionReport(g).reduce((a, p) => a + p.satisfaction, 0);

    const rng = new Rng(5);
    for (let i = 0; i < 8; i++) resolveCombat(g, rng);

    const after = coalitionReport(g).reduce((a, p) => a + p.satisfaction, 0);
    expect(after).toBeLessThan(before);
    expect(g.israel.reserves).toBeLessThan(430);
  });

  it('leaves the coalition alone when nobody is fighting', () => {
    const g = createGame(6);
    startGame(g);
    const before = coalitionReport(g).map((p) => p.satisfaction);

    const rng = new Rng(6);
    for (let i = 0; i < 8; i++) resolveCombat(g, rng);

    expect(coalitionReport(g).map((p) => p.satisfaction)).toEqual(before);
  });
});

describe('guns and butter', () => {
  it('costs nothing while the defence share is one the economy can carry', () => {
    const g = createGame(7);
    startGame(g);
    expect(g.israel.gnpPercent).toBeLessThan(10.5);

    const pop = g.israel.popularity;
    resolveTurn(g);
    // Popularity still moves for other reasons; it must not move for this one.
    expect(g.israel.popularity).toBeGreaterThanOrEqual(pop - 1);
  });

  it('is felt every month once the share outruns the economy', () => {
    const modest = createGame(8);
    const bloated = createGame(8);
    for (const g of [modest, bloated]) startGame(g);
    modest.israel.gnpPercent = 8.6;
    bloated.israel.gnpPercent = 16;

    for (let i = 0; i < 6; i++) {
      for (const g of [modest, bloated]) {
        if (g.phase === 'newspaper') advanceFromNewspaper(g);
        else if (g.phase !== 'gameover') resolveTurn(g);
      }
    }

    expect(bloated.israel.popularity).toBeLessThan(modest.israel.popularity);
    // And the parties that are in government for the welfare budget notice.
    const welfare = (g: GameState) =>
      coalitionReport(g).find((p) => p.id === 'shas')!.satisfaction;
    expect(welfare(bloated)).toBeLessThan(welfare(modest));
  });
});
