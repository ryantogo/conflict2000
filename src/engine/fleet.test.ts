import { describe, expect, it } from 'vitest';
import type { Fleet } from './types';
import {
  addUnits,
  airCount,
  attrite,
  countOf,
  drawAll,
  drawFraction,
  drawFrom,
  israeliEquipmentWeight,
  mergeInto,
  powerOf,
  totalUnits,
} from './fleet';
import { equipmentById } from '../data/equipment';

/**
 * Inventories are the foundation everything else in this phase stands on, so
 * they are tested directly rather than only through a bot.
 */

const mixed = (): Fleet => ({ m1a2: 100, t72: 300, challenger2: 100, f16i: 40, patriot: 10 });

describe('counting and weighing an inventory', () => {
  it('counts by category and ignores everything else', () => {
    const f = mixed();
    expect(countOf(f, 'tank')).toBe(500);
    expect(countOf(f, 'aircraft')).toBe(40);
    expect(countOf(f, 'sam')).toBe(10);
    expect(totalUnits(f)).toBe(550);
    expect(airCount(f)).toBe(40);
  });

  it('weighs each type at its own power', () => {
    // 100 Abrams at 12, 300 T-72M at 7, 100 Challenger 2 at 11.
    expect(powerOf(mixed(), 'tank')).toBe(100 * 12 + 300 * 7 + 100 * 11);
  });

  it('is worth more when the same number of tanks are better tanks', () => {
    const abrams: Fleet = { m1a2: 500 };
    const surplus: Fleet = { t72: 500 };
    expect(equipmentById('m1a2')!.power).toBeGreaterThan(equipmentById('t72')!.power);
    expect(israeliEquipmentWeight(abrams)).toBeGreaterThan(israeliEquipmentWeight(surplus));
  });
});

describe('moving units between inventories', () => {
  it('draws an exact count, spread across what is held', () => {
    const f = mixed();
    const taken = drawFrom(f, 250, 'tank');
    expect(countOf(taken, 'tank')).toBe(250);
    expect(countOf(f, 'tank')).toBe(250);
    // Representative, not cherry-picked: every type contributed.
    expect(Object.keys(taken).sort()).toEqual(['challenger2', 'm1a2', 't72']);
    // And the aircraft were not touched.
    expect(countOf(f, 'aircraft')).toBe(40);
  });

  it('never draws more than is held', () => {
    const f: Fleet = { m1a2: 5 };
    const taken = drawFrom(f, 500, 'tank');
    expect(countOf(taken, 'tank')).toBe(5);
    expect(countOf(f, 'tank')).toBe(0);
  });

  it('conserves units across a draw and a merge', () => {
    const f = mixed();
    const before = totalUnits(f);
    const away = drawFraction(f, 0.34, 'tank');
    mergeInto(f, away);
    expect(totalUnits(f)).toBe(before);
    expect(countOf(f, 'tank')).toBe(500);
  });

  it('empties a category with drawAll and leaves no zero entries behind', () => {
    const f = mixed();
    const taken = drawAll(f, 'tank');
    expect(countOf(taken, 'tank')).toBe(500);
    expect(countOf(f, 'tank')).toBe(0);
    expect(Object.keys(f).sort()).toEqual(['f16i', 'patriot']);
  });

  it('adds units under their own name', () => {
    const f: Fleet = {};
    addUnits(f, 'merkava3', 4);
    addUnits(f, 'merkava3', 6);
    expect(f.merkava3).toBe(10);
    addUnits(f, 'merkava3', 0);
    expect(f.merkava3).toBe(10);
  });
});

describe('battlefield losses', () => {
  it('takes a proportion of each holding and reports the total', () => {
    const f: Fleet = { m1a2: 100, t72: 200 };
    const lost = attrite(f, 0.1, 'tank');
    expect(f.m1a2).toBe(90);
    expect(f.t72).toBe(180);
    expect(lost).toBe(30);
  });

  it('leaves other categories alone', () => {
    const f = mixed();
    attrite(f, 0.5, 'tank');
    expect(countOf(f, 'aircraft')).toBe(40);
    expect(countOf(f, 'sam')).toBe(10);
  });

  it('does nothing at a zero rate', () => {
    const f = mixed();
    expect(attrite(f, 0, 'tank')).toBe(0);
    expect(countOf(f, 'tank')).toBe(500);
  });
});

describe('every id the game can hold is a known type', () => {
  it('resolves each catalogue and in-service id to real equipment', () => {
    for (const id of Object.keys(mixed())) {
      expect(equipmentById(id), id).toBeDefined();
    }
  });
});
