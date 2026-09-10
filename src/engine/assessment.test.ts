import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, enemyStrength, startGame } from './index';
import type { GameState } from './index';
import { assess, coverage, redrawAssessments } from './assessment';
import { reach, resolveIntelligence } from './intelligence';
import { recomputeOverhead } from './industry';
import { addUnits } from './fleet';

/**
 * The Strategic screen used to print the defender's exact combat weight — a
 * number computed from a data structure the player has no business reading.
 * There was no such thing as being surprised, and no reason for intelligence
 * to exist except sabotage.
 */

function opening(): GameState {
  const g = createGame(1);
  startGame(g);
  return g;
}

describe('what we think they have', () => {
  it('brackets the truth, and the band is not zero', () => {
    const g = opening();
    const truth = enemyStrength(g, 'syria');
    const view = assess(g, 'syria');

    expect(view.low).toBeLessThan(truth);
    expect(view.high).toBeGreaterThan(truth);
    expect(view.estimate).toBeGreaterThan(0);
  });

  it('is narrower where we have people and wider where we do not', () => {
    const g = opening();
    // Eighteen years in southern Lebanon against whatever is left in Tripoli.
    expect(coverage(g, 'lebanon')).toBeGreaterThan(coverage(g, 'libya'));

    const width = (id: 'lebanon' | 'libya') => {
      const v = assess(g, id);
      return (v.high - v.low) / Math.max(1, enemyStrength(g, id));
    };
    expect(width('lebanon')).toBeLessThan(width('libya'));
  });

  it('does not change while the player is looking at it', () => {
    const g = opening();
    const first = assess(g, 'syria').estimate;
    expect(assess(g, 'syria').estimate).toBe(first);

    // It changes when the month does, and not before.
    redrawAssessments(g, new Rng(5));
    const second = assess(g, 'syria').estimate;
    expect(second).not.toBe(first);
  });

  it('says more about them as the picture improves', () => {
    const g = opening();
    g.nations.libya.network = 5;
    const thin = assess(g, 'libya');
    expect(thin.notes.join(' ')).toMatch(/not have the sources/);

    g.nations.libya.network = 90;
    const good = assess(g, 'libya');
    expect(good.notes.length).toBeGreaterThan(thin.notes.length);
    expect(good.notes.join(' ')).toMatch(/Armour assessed at/);
    expect(good.confidence).not.toBe(thin.confidence);
  });

  it('can be wrong in either direction', () => {
    const g = opening();
    g.nations.syria.network = 0;
    g.israel.overhead = 0;
    const truth = enemyStrength(g, 'syria');

    let over = false;
    let under = false;
    const rng = new Rng(9);
    for (let i = 0; i < 40; i++) {
      redrawAssessments(g, rng);
      const e = assess(g, 'syria').estimate;
      if (e > truth) over = true;
      if (e < truth) under = true;
    }
    expect(over).toBe(true);
    expect(under).toBe(true);
  });
});

describe('overhead reconnaissance', () => {
  it('lifts the fog everywhere at once, which agents cannot', () => {
    const g = opening();
    const before = coverage(g, 'libya');

    addUnits(g.israel.stockpile.equipment, 'ofek', 3);
    recomputeOverhead(g);

    expect(g.israel.overhead).toBeGreaterThan(0);
    expect(coverage(g, 'libya')).toBeGreaterThan(before);
    // Even a country we have no people in at all.
    g.nations.iran.network = 0;
    expect(coverage(g, 'iran')).toBeGreaterThan(0);
  });

  it('is worth nothing in a battle', () => {
    const g = opening();
    const before = enemyStrength(g, 'syria');
    addUnits(g.israel.stockpile.equipment, 'ofek', 5);
    // A satellite is not an aircraft and does not fight.
    expect(enemyStrength(g, 'syria')).toBe(before);
  });
});

describe('running agents', () => {
  it('builds the network it will later be spent through', () => {
    const g = opening();
    const before = g.nations.syria.network;

    const rng = new Rng(3);
    for (let i = 0; i < 5; i++) {
      g.directives.intel.syria = 'collect';
      resolveIntelligence(g, rng);
      g.directives.intel = {};
    }
    expect(g.nations.syria.network).toBeGreaterThan(before);
  });

  it('lets a network nobody is running go cold', () => {
    const g = opening();
    g.nations.egypt.network = 80;
    const rng = new Rng(4);
    for (let i = 0; i < 12; i++) resolveIntelligence(g, rng);
    expect(g.nations.egypt.network).toBeLessThan(80);
  });

  it('carries an operation, so reach rewards the patient', () => {
    expect(reach({ network: 100 })).toBeGreaterThan(reach({ network: 0 }));
    // Never zero: a service with no network is clumsy rather than incapable.
    expect(reach({ network: 0 })).toBeGreaterThan(0.5);
  });

  it('keeps a stable security service watchful longer than a collapsing one', () => {
    const g = opening();
    g.nations.egypt.stability = 95;
    g.nations.syria.stability = 10;
    g.nations.egypt.counterIntel = 60;
    g.nations.syria.counterIntel = 60;

    const rng = new Rng(6);
    for (let i = 0; i < 5; i++) resolveIntelligence(g, rng);

    // Cairo keeps its files open; Damascus has other things on its mind.
    expect(g.nations.egypt.counterIntel).toBeGreaterThan(g.nations.syria.counterIntel);
  });
});
