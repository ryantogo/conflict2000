import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, startGame } from './index';
import type { GameState } from './index';
import { endWar } from './diplomacy';
import { collapseGovernment } from './intelligence';
import { resolveCombat, resolveRemote, resolveStrategic } from './military';
import { longRangeCount } from './fleet';
import {
  endRegionalWar,
  findWar,
  occupations,
  resolveRegionalWars,
  startRegionalWar,
} from './wars';
import { remoteStrikeOptions } from './military';

function opening(seed = 1): GameState {
  const g = createGame(seed);
  startGame(g);
  return g;
}

describe('wars between the other states have a front line', () => {
  it('keeps the two atWarWith lists in step with the war itself', () => {
    const g = opening();
    const war = startRegionalWar(g, 'iran', 'iraq');
    expect(g.nations.iran.atWarWith).toContain('iraq');
    expect(g.nations.iraq.atWarWith).toContain('iran');
    // Starting it twice is the same war.
    expect(startRegionalWar(g, 'iraq', 'iran')).toBe(war);
    expect(g.wars).toHaveLength(1);

    endRegionalWar(g, war);
    expect(g.nations.iran.atWarWith).not.toContain('iraq');
    expect(g.nations.iraq.atWarWith).not.toContain('iran');
    expect(g.wars).toHaveLength(0);
  });

  it('pushes the stronger army into the weaker country, and reports who holds what', () => {
    let advanced = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = opening(seed);
      // Lebanon has three brigades and three hundred tanks; Syria has ten and 4,500.
      startRegionalWar(g, 'syria', 'lebanon');
      const rng = new Rng(seed);
      for (let m = 0; m < 3 && findWar(g, 'syria', 'lebanon'); m++) resolveRegionalWars(g, rng);
      const war = findWar(g, 'syria', 'lebanon');
      if (war && war.progress > 0) {
        advanced++;
        const held = occupations(g).find((o) => o.held === 'lebanon');
        expect(held?.holder).toBe('syria');
      }
    }
    // Most of the wars that are still running have gone Syria's way.
    expect(advanced).toBeGreaterThan(8);
  });

  it('ends every war a fallen government was fighting', () => {
    const g = opening();
    startRegionalWar(g, 'iran', 'iraq');
    startRegionalWar(g, 'syria', 'iraq');
    collapseGovernment(g, 'iraq', 'invasion');
    expect(g.wars).toHaveLength(0);
    expect(g.nations.iran.atWarWith).not.toContain('iraq');
    expect(g.nations.syria.atWarWith).not.toContain('iraq');
  });
});

describe('ground on our own fronts', () => {
  function atWar(g: GameState, progress: number): void {
    g.directives.strategic.lebanon = 'deploy_all';
    resolveStrategic(g, new Rng(1));
    g.directives.strategic = {};
    g.fronts.lebanon.atWar = true;
    g.nations.lebanon.atWarWith.push('israel');
    g.fronts.lebanon.warProgress = progress;
  }

  it('follows the war while it runs', () => {
    const g = opening();
    atWar(g, 40);
    resolveCombat(g, new Rng(3));
    const f = g.fronts.lebanon;
    expect(f.occupation).toBeCloseTo(Math.max(0, f.warProgress) / 100, 6);
    expect(f.lostGround).toBe(0);
  });

  it('keeps our gains under a ceasefire, hands theirs back, and withdraws with the column', () => {
    const g = opening();
    atWar(g, 40);
    g.fronts.lebanon.occupation = 0.3;
    g.fronts.lebanon.lostGround = 0.1;
    endWar(g, 'lebanon', []);
    expect(g.fronts.lebanon.occupation).toBe(0.3);
    expect(g.fronts.lebanon.lostGround).toBe(0);

    g.directives.strategic.lebanon = 'withdraw';
    resolveStrategic(g, new Rng(4));
    expect(g.fronts.lebanon.occupation).toBe(0);
  });
});

describe('the long reach', () => {
  it('offers Baghdad, Tehran and Tripoli at the opening, and takes them away under undertakings', () => {
    const g = opening();
    for (const id of ['iraq', 'iran', 'libya'] as const) {
      const strike = remoteStrikeOptions(g, id).find((o) => o.id === 'strike_military');
      expect(strike?.disabledReason, id).toBeUndefined();
    }
    g.israel.restraint = 4;
    expect(remoteStrikeOptions(g, 'iran').find((o) => o.id === 'strike_military')?.disabledReason)
      .toMatch(/undertakings/);
  });

  it('needs aircraft that can make the trip, not merely an air force', () => {
    const g = opening();
    for (const id of ['f15i', 'f15_baz', 'f16i']) delete g.israel.stockpile.equipment[id];
    expect(longRangeCount(g.israel.stockpile.equipment)).toBe(0);
    expect(remoteStrikeOptions(g, 'iraq').find((o) => o.id === 'strike_nuclear')?.disabledReason)
      .toMatch(/long-range/);
  });

  it('sets a programme back more often than not, and does not fly an order that is not legal', () => {
    let setBack = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = opening(seed);
      g.nations.iraq.nuclearProgress = 60;
      g.directives.remote.iraq = 'strike_nuclear';
      resolveRemote(g, new Rng(seed));
      if (g.nations.iraq.nuclearProgress < 60) setBack++;
      expect(g.lastStruck.iraq).toBe(g.turn);
    }
    expect(setBack).toBeGreaterThan(10);

    const g = opening();
    g.nations.libya.relationsPoints = 60;
    g.nations.libya.relations = 7;
    g.directives.remote.libya = 'strike_military';
    const strikes = g.stats.strikesOrdered;
    resolveRemote(g, new Rng(1));
    expect(g.stats.strikesOrdered).toBe(strikes);
  });

  it('is answered by Tehran from southern Lebanon', () => {
    const g = opening();
    const before = g.factions.hezbollah.strength;
    g.directives.remote.iran = 'strike_military';
    resolveRemote(g, new Rng(5));
    expect(g.factions.hezbollah.strength).toBeGreaterThan(before);
    expect(g.nations.iran.relationsPoints).toBe(-100);
  });
});
