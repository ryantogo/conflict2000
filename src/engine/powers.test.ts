import { describe, expect, it } from 'vitest';
import {
  NATION_IDS,
  applySummit,
  createGame,
  startGame,
  strategicOptions,
  summitProposals,
} from './index';
import { Rng } from './rng';
import type { GameState } from './index';
import { resolveDeliveries, updateEmbargoes } from './arms';
import {
  LOBBY_COST,
  POWER_IDS,
  adjustRelations,
  demandOf,
  relationsWith,
  resolvePowers,
  setRelations,
} from './powers';

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

describe('having something to negotiate with', () => {
  it('buys goodwill with quiet diplomacy, and charges for it', () => {
    const g = opening();
    const before = relationsWith(g, 'france');
    const funds = g.israel.funds;

    g.directives.powers.france = 'lobby';
    resolvePowers(g, new Rng(2));

    expect(relationsWith(g, 'france')).toBeGreaterThan(before);
    expect(g.israel.funds).toBe(funds - LOBBY_COST);
  });

  it('is heard less well the fourth time than the first', () => {
    const g = opening();
    g.israel.funds = 10000;
    const rng = new Rng(3);

    const gains: number[] = [];
    for (let i = 0; i < 4; i++) {
      const before = relationsWith(g, 'britain');
      g.directives.powers.britain = 'lobby';
      resolvePowers(g, rng);
      gains.push(relationsWith(g, 'britain') - before);
    }

    expect(gains[0]).toBeGreaterThan(0);
    expect(gains[3]).toBeLessThan(gains[0]);
  });

  it('lets a capital recover its patience once we stop asking', () => {
    const g = opening();
    g.israel.funds = 10000;
    const rng = new Rng(4);
    for (let i = 0; i < 3; i++) {
      g.directives.powers.usa = 'lobby';
      resolvePowers(g, rng);
    }
    const worn = g.israel.powers.usa.patience;
    expect(worn).toBeLessThan(50);

    g.directives.powers = {};
    for (let i = 0; i < 12; i++) resolvePowers(g, rng);
    expect(g.israel.powers.usa.patience).toBeGreaterThan(worn);
  });

  it('presses us about the war when there is one', () => {
    const g = opening();
    expect(demandOf(g, 'usa')).not.toBe('settle_the_war');
    g.fronts.syria.atWar = true;
    expect(demandOf(g, 'usa')).toBe('settle_the_war');
  });

  it('takes undertakings off the menu of aggressive options', () => {
    const g = opening();
    g.stats.strikesOrdered = 5;
    g.nations.syria.relationsPoints = -90;
    g.nations.syria.relations = 0;
    expect(demandOf(g, 'usa')).toBe('halt_strikes');

    const before = relationsWith(g, 'usa');
    g.directives.powers.usa = 'concede';
    resolvePowers(g, new Rng(6));

    expect(relationsWith(g, 'usa')).toBeGreaterThan(before);
    expect(g.israel.restraint).toBeGreaterThan(0);

    // And the promise binds: the strikes are gone from the menu, with a reason.
    const strike = strategicOptions(g, 'syria').find((o) => o.id === 'strike_military');
    expect(strike?.disabledReason).toMatch(/undertakings/i);
    const invade = strategicOptions(g, 'syria').find((o) => o.id === 'invade');
    expect(invade?.disabledReason).toMatch(/undertakings/i);
  });

  it('lets a premier tell them where to go, at a price', () => {
    const g = opening();
    g.fronts.syria.atWar = true;
    const before = relationsWith(g, 'usa');
    const pop = g.israel.popularity;

    g.directives.powers.usa = 'defy';
    resolvePowers(g, new Rng(7));

    expect(relationsWith(g, 'usa')).toBeLessThan(before);
    expect(g.israel.popularity).toBeGreaterThan(pop);
  });

  it('offers to lift an embargo at a summit, which it never used to', () => {
    const g = opening();
    expect(summitProposals(g).some((p) => p.id.startsWith('embargo:'))).toBe(false);

    g.israel.suppliers.usa.embargoed = true;
    const offer = summitProposals(g).find((p) => p.id === 'embargo:usa');
    expect(offer).toBeDefined();

    applySummit(g, { 'embargo:usa': true }, true);
    expect(g.israel.suppliers.usa.embargoed).toBe(false);
    expect(g.israel.restraint).toBeGreaterThan(0);
  });

  it('values a Palestinian homeland differently in each capital', () => {
    const g = opening();
    const before = Object.fromEntries(
      NATION_IDS.map((id) => [id, g.nations[id].relationsPoints]),
    );
    applySummit(g, { homeland: true }, true);

    const gain = (id: (typeof NATION_IDS)[number]) =>
      g.nations[id].relationsPoints - before[id];

    // Amman has carried the refugee question since 1948; Tehran has no stake.
    expect(gain('jordan')).toBeGreaterThan(gain('syria'));
    expect(gain('egypt')).toBeGreaterThan(gain('iraq'));
    expect(gain('lebanon')).toBeGreaterThan(gain('iran'));
  });
});
