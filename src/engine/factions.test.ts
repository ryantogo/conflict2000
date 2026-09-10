import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, factionOptions, factionsIn, startGame, successorsOf } from './index';
import type { GameState } from './index';
import { resolveFactions, resolveSuccessors, spawnSuccessors } from './factions';
import { collapseGovernment } from './intelligence';
import { RESTORATION_THRESHOLD } from '../data/factions2000';

/**
 * DESIGN.md called this the most conspicuous simplification in the game:
 * Hezbollah and the PLO as an opposition-strength number and a scripted event,
 * rather than entities with goals of their own.
 */

function opening(): GameState {
  const g = createGame(1);
  startGame(g);
  return g;
}

function months(g: GameState, n: number, seed = 4): void {
  const rng = new Rng(seed);
  for (let i = 0; i < n; i++) {
    resolveFactions(g, rng);
    resolveSuccessors(g, rng);
  }
}

describe('the groups nobody governs', () => {
  it('puts Hezbollah on the Lebanese border from turn one', () => {
    const g = opening();
    const groups = factionsIn(g, 'lebanon');
    expect(groups.map((f) => f.id)).toContain('hezbollah');
    const hez = groups.find((f) => f.id === 'hezbollah')!;
    expect(hez.patronName).toBe('Iran');
    expect(hez.strength).toBeGreaterThan(50);
  });

  it('keeps them distinct from the political opposition they are not', () => {
    const g = opening();
    // Funding a coup in Beirut and fighting Hezbollah are different problems.
    const before = g.nations.lebanon.oppositionStrength;
    months(g, 12);
    expect(g.nations.lebanon.oppositionStrength).toBe(before);
    expect(g.factions.hezbollah.strength).not.toBe(58);
  });

  it('grows toward what its circumstances sustain rather than without limit', () => {
    const g = opening();
    months(g, 240);
    // Twenty years. The first version accumulated to a hundred and made the
    // decade unsurvivable.
    expect(g.factions.hezbollah.strength).toBeLessThan(90);
    expect(g.factions.hezbollah.strength).toBeGreaterThan(20);
  });

  it('shrinks when its patron stops being able to pay', () => {
    const rich = opening();
    const broke = opening();
    broke.nations.iran.stability = 5;

    months(rich, 36);
    months(broke, 36);

    expect(broke.factions.hezbollah.strength).toBeLessThan(rich.factions.hezbollah.strength);
  });

  it('hurts to hit, and recruits for them', () => {
    const g = opening();
    const before = g.factions.hezbollah;
    const strength = before.strength;
    const support = before.support;

    g.directives.factions.hezbollah = 'strike';
    resolveFactions(g, new Rng(2));

    expect(g.factions.hezbollah.strength).toBeLessThan(strength);
    // Nobody has ever solved one of these militarily.
    expect(g.factions.hezbollah.support).toBeGreaterThan(support);
  });

  it('will not let us strike while undertakings bind us', () => {
    const g = opening();
    g.israel.restraint = 4;
    const strike = factionOptions(g, 'hezbollah').find((o) => o.id === 'strike');
    expect(strike?.disabledReason).toMatch(/undertakings/i);
  });

  it('refuses to arm a group inside a country we are at peace with', () => {
    const g = opening();
    g.nations.lebanon.relations = 8;
    const back = factionOptions(g, 'hezbollah').find((o) => o.id === 'back');
    expect(back?.disabledReason).toBeTruthy();
  });

  it('drives unrest in the territories without touching the border', () => {
    const quiet = opening();
    const loud = opening();
    loud.factions.hamas.strength = 95;
    loud.factions.pij.strength = 95;

    months(quiet, 24);
    months(loud, 24);

    expect(loud.palestine.unrest).toBeGreaterThan(quiet.palestine.unrest);
  });
});

describe('when a state comes apart', () => {
  it('leaves rival factions behind instead of an inert country', () => {
    const g = opening();
    expect(successorsOf(g, 'syria')).toHaveLength(0);

    collapseGovernment(g, 'syria', 'coup');

    const contenders = successorsOf(g, 'syria');
    expect(contenders.length).toBeGreaterThan(1);
    expect(contenders.map((c) => c.name)).toContain('The Muslim Brotherhood');
  });

  it('does not fragment the same state twice', () => {
    const g = opening();
    collapseGovernment(g, 'syria', 'coup');
    const first = successorsOf(g, 'syria').length;
    expect(spawnSuccessors(g, 'syria')).toHaveLength(0);
    expect(successorsOf(g, 'syria')).toHaveLength(first);
  });

  it('offers real choices about who governs next', () => {
    const g = opening();
    collapseGovernment(g, 'iraq', 'invasion');
    const contenders = successorsOf(g, 'iraq');

    const kurds = contenders.find((c) => c.name === 'The Kurdish north')!;
    const shia = contenders.find((c) => c.name === 'The Shia south')!;
    // An old friend of this service, and a movement looking east for help.
    expect(kurds.disposition).toBeGreaterThan(0);
    expect(shia.disposition).toBeLessThan(0);
  });

  it('puts the faction we armed into the palace, and it owes us', () => {
    const g = opening();
    collapseGovernment(g, 'syria', 'coup');
    const friendly = successorsOf(g, 'syria').find((c) => c.disposition > 0)!;

    g.israel.funds = 100000;
    g.factions[friendly.id].strength = RESTORATION_THRESHOLD + 2;
    g.directives.factions[friendly.id] = 'back';

    resolveSuccessors(g, new Rng(8));

    expect(g.nations.syria.collapsed).toBe(false);
    expect(g.nations.syria.leader).toBe(friendly.name);
    // A government that owes us is a government with better relations.
    expect(g.nations.syria.relationsPoints).toBeGreaterThan(0);
    // And the civil war is over.
    expect(successorsOf(g, 'syria')).toHaveLength(0);
  });

  it('will not restore a faction we are not backing, however strong', () => {
    const g = opening();
    collapseGovernment(g, 'jordan', 'internal');
    for (const c of successorsOf(g, 'jordan')) {
      g.factions[c.id].strength = 95;
    }

    resolveSuccessors(g, new Rng(9));

    expect(g.nations.jordan.collapsed).toBe(true);
  });

  it('hands a hostile faction the country if that is who we armed', () => {
    const g = opening();
    collapseGovernment(g, 'egypt', 'coup');
    const hostile = successorsOf(g, 'egypt').find((c) => c.disposition < -0.5)!;

    g.israel.funds = 100000;
    g.factions[hostile.id].strength = RESTORATION_THRESHOLD + 2;
    g.directives.factions[hostile.id] = 'back';

    resolveSuccessors(g, new Rng(10));

    expect(g.nations.egypt.collapsed).toBe(false);
    // We put them there, and they still despise us.
    expect(g.nations.egypt.relationsPoints).toBeLessThan(0);
  });
});
