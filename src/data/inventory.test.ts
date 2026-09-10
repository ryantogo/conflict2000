import { describe, expect, it } from 'vitest';
import { NATION_IDS } from '../engine/types';
import { airCount, countOf, powerOf, totalUnits } from '../engine/fleet';
import { REGIONAL_NORM, equipmentById } from './equipment';
import { israeliOpeningStock, openingInventory } from './inventory2000';

/**
 * The opening order of battle is data, and data rots. These lock the headline
 * totals the game has always used, so that changing a composition stays a
 * deliberate act rather than an arithmetic slip.
 */

const HEADLINE: Record<string, { tanks: number; air: number; sam: number }> = {
  israel: { tanks: 3900, air: 450, sam: 110 },
  egypt: { tanks: 3500, air: 570, sam: 90 },
  syria: { tanks: 4500, air: 480, sam: 130 },
  jordan: { tanks: 1200, air: 100, sam: 30 },
  lebanon: { tanks: 300, air: 0, sam: 10 },
  iraq: { tanks: 2200, air: 300, sam: 70 },
  iran: { tanks: 1500, air: 300, sam: 60 },
  libya: { tanks: 2200, air: 400, sam: 40 },
};

describe('the opening order of battle', () => {
  it('fields the totals the game has always used', () => {
    for (const [who, want] of Object.entries(HEADLINE)) {
      const fleet =
        who === 'israel' ? israeliOpeningStock() : openingInventory(who as never);
      expect(countOf(fleet, 'tank'), `${who} tanks`).toBe(want.tanks);
      expect(airCount(fleet), `${who} airframes`).toBe(want.air);
      expect(countOf(fleet, 'sam'), `${who} batteries`).toBe(want.sam);
      // Nothing uncounted: every unit belongs to one of the three arms.
      expect(totalUnits(fleet), `${who} total`).toBe(want.tanks + want.air + want.sam);
    }
  });

  it('gives every nation an inventory', () => {
    for (const id of NATION_IDS) {
      expect(totalUnits(openingInventory(id)), id).toBeGreaterThan(0);
    }
  });

  it('holds only equipment the registry knows about', () => {
    const fleets = [israeliOpeningStock(), ...NATION_IDS.map(openingInventory)];
    for (const fleet of fleets) {
      for (const id of Object.keys(fleet)) {
        expect(equipmentById(id), id).toBeDefined();
      }
    }
  });
});

describe('quality, not just quantity', () => {
  /** Mean power per unit — how good the kit is, independent of how much there is. */
  const grade = (fleet: ReturnType<typeof israeliOpeningStock>, cat: 'tank' | 'sam') =>
    powerOf(fleet, cat) / Math.max(1, countOf(fleet, cat));

  it('gives Israel the better tank fleet despite Syria having more tanks', () => {
    const isr = israeliOpeningStock();
    const syr = openingInventory('syria');
    expect(countOf(syr, 'tank')).toBeGreaterThan(countOf(isr, 'tank'));
    expect(grade(isr, 'tank')).toBeGreaterThan(grade(syr, 'tank'));
    // And the better fleet is worth more in total, outnumbered or not.
    expect(powerOf(isr, 'tank')).toBeGreaterThan(powerOf(syr, 'tank'));
  });

  it('rates Israeli armour above the regional norm and Syrian armour below it', () => {
    expect(grade(israeliOpeningStock(), 'tank')).toBeGreaterThan(REGIONAL_NORM.tank);
    expect(grade(openingInventory('syria'), 'tank')).toBeLessThan(REGIONAL_NORM.tank);
  });

  it('makes Egypt the best-equipped Arab army and Lebanon the weakest', () => {
    const arab = ['egypt', 'syria', 'jordan', 'lebanon', 'iraq', 'libya'] as const;
    const byWeight = [...arab].sort(
      (a, b) => powerOf(openingInventory(b), 'tank') - powerOf(openingInventory(a), 'tank'),
    );
    expect(byWeight[0]).toBe('egypt');
    expect(byWeight[byWeight.length - 1]).toBe('lebanon');
  });
});
