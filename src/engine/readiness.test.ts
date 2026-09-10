import { describe, expect, it } from 'vitest';
import type { Fleet } from './types';
import { createGame, startGame } from './index';
import { fleetReadiness, israeliEquipmentWeight } from './fleet';
import { resolveReadiness } from './arms';
import { equipmentById } from '../data/equipment';

/**
 * An embargo used to be an inconvenience at the shop counter. It now stops
 * the spares, which is what an arms embargo actually does to an air force.
 */

function embargoWest(g: ReturnType<typeof createGame>): void {
  for (const id of ['usa', 'britain', 'france'] as const) {
    g.israel.suppliers[id].embargoed = true;
  }
}

function months(g: ReturnType<typeof createGame>, n: number): void {
  for (let i = 0; i < n; i++) resolveReadiness(g);
}

describe('spares and serviceability', () => {
  it('starts with everything fully serviceable', () => {
    const g = createGame(1);
    startGame(g);
    for (const value of Object.values(g.israel.readiness)) expect(value).toBe(1);
  });

  it('grounds American equipment month by month under embargo', () => {
    const g = createGame(2);
    startGame(g);
    embargoWest(g);

    months(g, 12);
    const oneYear = g.israel.readiness.usa;
    expect(oneYear).toBeLessThan(0.9);

    months(g, 12);
    expect(g.israel.readiness.usa).toBeLessThan(oneYear);
  });

  it('never grounds what we build ourselves, or what came from Moscow', () => {
    const g = createGame(3);
    startGame(g);
    embargoWest(g);
    months(g, 60);

    expect(g.israel.readiness.israel).toBe(1);
    expect(g.israel.readiness.soviet).toBe(1);
    // And the Americans have bottomed out rather than gone to zero: an
    // embargo must hurt for years without being simply fatal.
    expect(g.israel.readiness.usa).toBe(0.55);
  });

  it('costs an American fleet real combat weight and a Merkava fleet none', () => {
    const g = createGame(4);
    startGame(g);
    const american: Fleet = { m1a2: 500, f16cd: 100 };
    const israeli: Fleet = { merkava3: 500, kfir_c7: 100 };

    const americanBefore = israeliEquipmentWeight(american, g.israel.readiness);
    const israeliBefore = israeliEquipmentWeight(israeli, g.israel.readiness);

    embargoWest(g);
    months(g, 36);

    expect(israeliEquipmentWeight(american, g.israel.readiness)).toBeLessThan(americanBefore);
    expect(israeliEquipmentWeight(israeli, g.israel.readiness)).toBe(israeliBefore);
  });

  it('recovers once somebody starts selling parts again', () => {
    const g = createGame(5);
    startGame(g);
    embargoWest(g);
    months(g, 40);
    const grounded = g.israel.readiness.usa;
    expect(grounded).toBeLessThan(0.7);

    for (const id of ['usa', 'britain', 'france'] as const) {
      g.israel.suppliers[id].embargoed = false;
    }
    months(g, 12);

    expect(g.israel.readiness.usa).toBe(1);
  });

  it('reports the crossings rather than narrating every month of drift', () => {
    const g = createGame(6);
    startGame(g);
    embargoWest(g);

    let notes = 0;
    for (let i = 0; i < 40; i++) notes += resolveReadiness(g).length;
    // Three thresholds per Western origin at most, not forty months of noise.
    expect(notes).toBeGreaterThan(0);
    expect(notes).toBeLessThanOrEqual(6);
  });

  it('measures the opening Israeli fleet as mostly American', () => {
    const g = createGame(7);
    startGame(g);
    const stock = g.israel.stockpile.equipment;
    expect(fleetReadiness(stock, g.israel.readiness)).toBe(1);

    embargoWest(g);
    months(g, 36);
    // Enough of the order of battle carries a US badge that grounding it
    // moves the whole fleet's serviceability a long way.
    expect(fleetReadiness(stock, g.israel.readiness)).toBeLessThan(0.8);
    expect(equipmentById('magach7')!.origin).toBe('usa');
    expect(equipmentById('merkava3')!.origin).toBe('israel');
  });
});
