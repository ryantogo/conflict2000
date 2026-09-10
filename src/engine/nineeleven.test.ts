import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { applyBudget, budgetOffer, createGame, startGame } from './index';
import type { GameState } from './index';
import { availableFrom, leadTimeFor } from './arms';
import { demandOf } from './powers';
import { SCRIPTED } from '../data/scripted';
import { itemById } from '../data/arms2000';

/**
 * September 2001 changes what Washington will sell, pay for, and look away
 * from — unless somebody stops it first.
 */

function opening(seed = 1): GameState {
  const g = createGame(seed);
  startGame(g);
  return g;
}

const nineEleven = SCRIPTED.find((e) => e.id === 'nine-eleven')!;

describe('September 2001', () => {
  it('is stopped before it happens between one time in ten and one in five', () => {
    const rng = new Rng(2001);
    let foiled = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const g = opening(i + 1);
      nineEleven.fire(g, rng);
      if (g.world.nineEleven === 'foiled') foiled++;
      else expect(g.world.nineEleven).toBe('happened');
    }
    expect(foiled / N).toBeGreaterThanOrEqual(0.1);
    expect(foiled / N).toBeLessThanOrEqual(0.2);
  });

  it('makes the December aid larger, and adds a grant voted once', () => {
    const g = opening();
    const before = budgetOffer(g);
    expect(before.grant).toBe(0);

    g.world.nineEleven = 'happened';
    g.world.nineElevenTurn = g.turn;
    const after = budgetOffer(g);
    expect(after.aid).toBeGreaterThan(before.aid);
    expect(after.grant).toBeGreaterThan(0);

    applyBudget(g, 'maintain', false);
    expect(budgetOffer(g).grant).toBe(0);
  });

  it('opens the better American catalogue sooner and delivers it faster', () => {
    const g = opening();
    g.israel.suppliers.usa.loyalty = 50;
    expect(availableFrom(g, 'usa').map((i) => i.id)).not.toContain('f15i');
    const ra_am = itemById('f15i')!;
    const slow = leadTimeFor(g, ra_am);

    g.world.nineEleven = 'happened';
    expect(availableFrom(g, 'usa').map((i) => i.id)).toContain('f15i');
    expect(leadTimeFor(g, ra_am)).toBe(slow - 1);
  });

  it('stops pressing us about strikes on the armed groups, but not on governments', () => {
    const g = opening();
    g.stats.strikesOrdered = 5;
    expect(demandOf(g, 'usa')).toBe('halt_strikes');

    g.world.nineEleven = 'happened';
    g.world.nineElevenTurn = g.turn - 6;
    expect(demandOf(g, 'usa')).not.toBe('halt_strikes');

    g.lastStruck.syria = g.turn;
    expect(demandOf(g, 'usa')).toBe('halt_strikes');
  });

  it('changes nothing if the plot was foiled', () => {
    const g = opening();
    const before = budgetOffer(g);
    g.world.nineEleven = 'foiled';
    expect(budgetOffer(g).aid).toBe(before.aid);
    expect(budgetOffer(g).grant).toBe(0);
  });
});
