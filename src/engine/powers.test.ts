import { describe, expect, it } from 'vitest';
import { createGame, startGame } from './index';
import type { GameState } from './index';
import { resolveDeliveries, updateEmbargoes } from './arms';
import { POWER_IDS, adjustRelations, relationsWith, setRelations } from './powers';

/**
 * The three Western capitals used to move as one boolean: Washington
 * embargoed, and Paris and London were assigned the same value on the next
 * line. They now each decide for themselves.
 */

function opening(): GameState {
  const g = createGame(1);
  startGame(g);
  return g;
}

describe('the powers', () => {
  it('opens with every supplier willing to sell', () => {
    const g = opening();
    updateEmbargoes(g);
    for (const id of POWER_IDS) {
      expect(g.israel.suppliers[id].embargoed, id).toBe(false);
    }
    expect(g.israel.suppliers.dealer.embargoed).toBe(false);
  });

  it('opens with Washington closest and Paris furthest away', () => {
    const g = opening();
    expect(relationsWith(g, 'usa')).toBeGreaterThan(relationsWith(g, 'britain'));
    expect(relationsWith(g, 'britain')).toBeGreaterThan(relationsWith(g, 'france'));
  });

  it('lets Paris walk out before Washington does', () => {
    const g = opening();
    // The same slide in every capital.
    for (const id of POWER_IDS) adjustRelations(g, id, -12);
    updateEmbargoes(g);

    expect(g.israel.suppliers.france.embargoed).toBe(true);
    expect(g.israel.suppliers.usa.embargoed).toBe(false);
    expect(g.israel.suppliers.britain.embargoed).toBe(false);
  });

  it('lets London hold on after Washington has gone', () => {
    const g = opening();
    setRelations(g, 'usa', 20);
    setRelations(g, 'britain', 28);
    updateEmbargoes(g);

    expect(g.israel.suppliers.usa.embargoed).toBe(true);
    // 28 is under Washington's line and over London's.
    expect(g.israel.suppliers.britain.embargoed).toBe(false);
  });

  it('leaves the road back from a nuclear strike steep rather than closed', () => {
    const g = opening();
    // What a strike actually does: the deed, and forty-five points of it.
    g.stats.nukesUsed = 1;
    setRelations(g, 'usa', 29);
    updateEmbargoes(g);
    expect(g.israel.suppliers.usa.embargoed).toBe(true);

    // A relationship that would ordinarily be more than enough to lift an
    // embargo does not lift this one.
    setRelations(g, 'usa', 60);
    updateEmbargoes(g);
    expect(g.israel.suppliers.usa.embargoed).toBe(true);

    // But it is a road, not a wall.
    setRelations(g, 'usa', 85);
    updateEmbargoes(g);
    expect(g.israel.suppliers.usa.embargoed).toBe(false);
  });

  it('never embargoes the private dealer, who does not read the newspapers', () => {
    const g = opening();
    for (const id of POWER_IDS) setRelations(g, id, 0);
    g.stats.nukesUsed = 3;
    updateEmbargoes(g);

    expect(g.israel.suppliers.dealer.embargoed).toBe(false);
  });

  it('drags commercial loyalty down with the political relationship', () => {
    const warm = opening();
    const cold = opening();
    setRelations(cold, 'britain', 5);

    // Buy from nobody and let the relationships speak. Supplier decay lives
    // in the delivery pass, which is where the coupling was added.
    for (let i = 0; i < 24; i++) {
      resolveDeliveries(warm);
      resolveDeliveries(cold);
    }

    expect(cold.israel.suppliers.britain.loyalty).toBeLessThan(
      warm.israel.suppliers.britain.loyalty,
    );
  });
});
