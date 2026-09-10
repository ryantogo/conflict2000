import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, startGame } from './index';
import type { GameState } from './index';
import { countOf, powerOf } from './fleet';
import { runRearmament } from './procurement';
import { openingInventory } from '../data/inventory2000';
import { ESTABLISHMENT_CEILING } from '../data/procurement2000';

/**
 * Before this existed, `Nation.forces` only ever went down and a patient
 * premier could win by outlasting everybody. These are the claims that stop
 * being true.
 */

function months(g: GameState, n: number): void {
  const rng = new Rng(99);
  for (let i = 0; i < n; i++) runRearmament(g, rng);
}

describe('the neighbours rebuild', () => {
  it('makes good a mauled army over a couple of years', () => {
    const g = createGame(1);
    startGame(g);
    const syria = g.nations.syria;
    const establishment = countOf(openingInventory('syria'), 'tank');

    // A war has cost them half their armour.
    for (const id of Object.keys(syria.forces.equipment)) {
      syria.forces.equipment[id] = Math.floor(syria.forces.equipment[id] / 2);
    }
    const mauled = countOf(syria.forces.equipment, 'tank');
    expect(mauled).toBeLessThan(establishment * 0.6);

    months(g, 24);

    const recovered = countOf(syria.forces.equipment, 'tank');
    expect(recovered).toBeGreaterThan(mauled);
    // Roughly two thirds of the way back in two years: enough that walking in
    // a year later does not work, not so much that the war was free.
    expect(recovered).toBeGreaterThan(establishment * 0.65);
    expect(recovered).toBeLessThan(establishment);
  });

  it('rebuilds with the best it can get, so the fleet modernises as it heals', () => {
    const g = createGame(2);
    startGame(g);
    const syria = g.nations.syria;

    const gradeBefore = powerOf(syria.forces.equipment, 'tank') / countOf(syria.forces.equipment, 'tank');
    for (const id of Object.keys(syria.forces.equipment)) {
      syria.forces.equipment[id] = Math.floor(syria.forces.equipment[id] / 2);
    }
    months(g, 36);

    const after = syria.forces.equipment;
    const gradeAfter = powerOf(after, 'tank') / countOf(after, 'tank');
    // Damascus replaces losses with T-72s, not with more T-55s.
    expect(gradeAfter).toBeGreaterThan(gradeBefore);
  });

  it('never builds past the establishment ceiling', () => {
    const g = createGame(3);
    startGame(g);
    months(g, 240); // twenty years, far longer than a game

    for (const id of ['egypt', 'syria', 'jordan', 'iraq', 'iran', 'libya'] as const) {
      const cap = countOf(openingInventory(id), 'tank') * ESTABLISHMENT_CEILING;
      expect(countOf(g.nations[id].forces.equipment, 'tank'), id).toBeLessThanOrEqual(
        Math.ceil(cap),
      );
    }
  });

  it('gives a collapsed state no procurement programme at all', () => {
    const g = createGame(4);
    startGame(g);
    const lebanon = g.nations.lebanon;
    lebanon.collapsed = true;
    for (const id of Object.keys(lebanon.forces.equipment)) {
      lebanon.forces.equipment[id] = Math.floor(lebanon.forces.equipment[id] / 2);
    }
    const before = countOf(lebanon.forces.equipment, 'tank');

    months(g, 60);

    expect(countOf(lebanon.forces.equipment, 'tank')).toBe(before);
  });

  it('rebuilds a stable state faster than a disintegrating one', () => {
    const stable = createGame(5);
    startGame(stable);
    const shaky = createGame(5);
    startGame(shaky);

    for (const g of [stable, shaky]) {
      for (const id of Object.keys(g.nations.syria.forces.equipment)) {
        g.nations.syria.forces.equipment[id] = Math.floor(
          g.nations.syria.forces.equipment[id] / 2,
        );
      }
    }
    stable.nations.syria.stability = 90;
    shaky.nations.syria.stability = 15;

    months(stable, 18);
    months(shaky, 18);

    expect(countOf(stable.nations.syria.forces.equipment, 'tank')).toBeGreaterThan(
      countOf(shaky.nations.syria.forces.equipment, 'tank'),
    );
  });
});
