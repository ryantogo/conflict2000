import { describe, expect, it } from 'vitest';
import { SUPPLIER_IDS, createGame, startGame } from './index';
import type { GameState } from './index';
import { availableFrom, forthcomingFrom, placeOrder, resolveDeliveries, updateEmbargoes } from './arms';
import { longRangeCount } from './fleet';
import { relationsWith } from './powers';
import { CATALOGUE } from '../data/arms2000';
import { equipmentById } from '../data/equipment';

/**
 * The catalogue used to be nineteen items from four counters, and Washington
 * would not sell an air force more of the aircraft it already flew. These are
 * the claims the wider market makes.
 */

function opening(): GameState {
  const g = createGame(1);
  startGame(g);
  g.israel.funds = 5000;
  return g;
}

describe('the catalogue', () => {
  it('resolves every catalogue item to registered equipment with the same category', () => {
    for (const item of CATALOGUE) {
      const e = equipmentById(item.id);
      expect(e, item.id).toBeDefined();
      expect(e!.category, item.id).toBe(item.category);
    }
  });

  it('never lists the same item twice at one counter', () => {
    const seen = new Set<string>();
    for (const item of CATALOGUE) {
      const key = `${item.supplier}:${item.id}`;
      expect(seen.has(key), key).toBe(false);
      seen.add(key);
    }
  });

  it('gives every supplier something to sell at the opening', () => {
    const g = opening();
    for (const id of SUPPLIER_IDS) {
      g.israel.suppliers[id].loyalty = 100;
      expect(availableFrom(g, id).length, id).toBeGreaterThan(0);
    }
  });

  it('lets every counter make a first sale at the loyalty we open with', () => {
    // Loyalty is earned by buying. A supplier with nothing on offer at the
    // opening can never be bought from, and Moscow shipped that way.
    const g = opening();
    for (const id of SUPPLIER_IDS) {
      expect(availableFrom(g, id).length, id).toBeGreaterThan(0);
    }
  });

  it('sells more of what the IAF already flies, into the same inventory line', () => {
    const g = opening();
    g.israel.suppliers.usa.loyalty = 100;
    const ids = availableFrom(g, 'usa').map((i) => i.id);
    for (const want of ['f15_baz', 'f16cd', 'f16ab', 'ah64a']) expect(ids).toContain(want);

    const before = g.israel.stockpile.equipment.f15_baz;
    expect(placeOrder(g, 'usa', 'f15_baz', 4)).toBeNull();
    g.turn += 3;
    resolveDeliveries(g);
    expect(g.israel.stockpile.equipment.f15_baz).toBe(before + 4);
    // The in-service entry keeps its reach.
    expect(equipmentById('f15_baz')!.longRange).toBe(true);
  });

  it('opens with enough long-range airframes to reach the far capitals', () => {
    const g = opening();
    expect(longRangeCount(g.israel.stockpile.equipment)).toBeGreaterThanOrEqual(16);
  });
});

describe('what is not built yet cannot be bought', () => {
  it('shows the Rafale as forthcoming in 2000 and sells it in 2002', () => {
    const g = opening();
    g.israel.suppliers.france.loyalty = 100;
    expect(availableFrom(g, 'france').map((i) => i.id)).not.toContain('rafale');
    expect(forthcomingFrom(g, 'france').map((i) => i.id)).toContain('rafale');
    expect(placeOrder(g, 'france', 'rafale', 1)).toMatch(/2002/);

    g.year = 2002;
    expect(availableFrom(g, 'france').map((i) => i.id)).toContain('rafale');
    expect(placeOrder(g, 'france', 'rafale', 1)).toBeNull();
  });
});

describe('the new counters have politics of their own', () => {
  it('lets Washington mind a Chinese order more than a grey-market one', () => {
    const dealer = opening();
    const china = opening();
    const before = relationsWith(dealer, 'usa');
    placeOrder(dealer, 'dealer', 'mi24', 1);
    placeOrder(china, 'china', 'z9', 1);
    expect(relationsWith(china, 'usa')).toBeLessThan(relationsWith(dealer, 'usa'));
    expect(relationsWith(dealer, 'usa')).toBeLessThan(before);
  });

  it('closes Moscow while we bomb its client, and reopens it when the grievance lapses', () => {
    const g = opening();
    updateEmbargoes(g);
    expect(g.israel.suppliers.russia.embargoed).toBe(false);

    g.lastStruck.syria = g.turn;
    updateEmbargoes(g);
    expect(g.israel.suppliers.russia.embargoed).toBe(true);

    g.turn += 12;
    updateEmbargoes(g);
    expect(g.israel.suppliers.russia.embargoed).toBe(false);
  });

  it('makes a Turkish F-16 an American aircraft for the purposes of spares', () => {
    expect(equipmentById('f16c_tai')!.origin).toBe('usa');
    expect(equipmentById('su30mk')!.origin).toBe('russia');
    // Cold War stock from the dealer is still nobody's to ground.
    expect(equipmentById('mig29')!.origin).toBe('soviet');
  });

  it('stops Ankara selling while the territories are policed hard during an intifada', () => {
    const g = opening();
    g.palestine.intifada = true;
    g.palestine.tactics = 'hard';
    g.palestine.brigadesPosted = 2;
    updateEmbargoes(g);
    expect(g.israel.suppliers.turkey.embargoed).toBe(true);

    g.palestine.tactics = 'soft';
    updateEmbargoes(g);
    expect(g.israel.suppliers.turkey.embargoed).toBe(false);
  });
});
