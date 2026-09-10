import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, israeliStrength, powerOptions, startGame } from './index';
import type { GameState, NationId } from './index';
import { endWar, jointOptions, resolveAlliances, resolveDiplomacy } from './diplomacy';
import { resolvePowers, setRelations } from './powers';
import { callTreatyPartners, findWar, openFront, startRegionalWar, warKey } from './wars';

/**
 * A pact used to lower an enemy's appetite for attacking us and do nothing
 * else. A treaty is now a promise to be on somebody's side, and it is called
 * in — by the people who signed it with us, and against us.
 */

function opening(seed = 1): GameState {
  const g = createGame(seed);
  startGame(g);
  return g;
}

function befriend(g: GameState, id: NationId, treaty = true): void {
  g.nations[id].relationsPoints = 90;
  g.nations[id].relations = 9;
  if (treaty && !g.nations[id].pactWith.includes('israel')) g.nations[id].pactWith.push('israel');
}

describe('a treaty called in against us', () => {
  it('brings a warm partner into the war, or the treaty dies', () => {
    let honoured = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = opening(seed);
      befriend(g, 'jordan');
      openFront(g, 'syria', false, -10);
      callTreatyPartners(g, 'syria', new Rng(seed));
      if (g.fronts.syria.allies.includes('jordan')) {
        honoured++;
        expect(g.nations.jordan.atWarWith).toContain('syria');
        expect(g.nations.syria.atWarWith).toContain('jordan');
      } else {
        expect(g.nations.jordan.pactWith).not.toContain('israel');
      }
    }
    expect(honoured).toBeGreaterThan(18);
  });

  it('counts a partner, and a Western air force, on our side of the line', () => {
    const g = opening();
    openFront(g, 'syria', false, 0);
    const alone = israeliStrength(g, 'syria');
    g.fronts.syria.allies.push('jordan');
    const allied = israeliStrength(g, 'syria');
    expect(allied).toBeGreaterThan(alone);
    g.fronts.syria.westernSupport.push('usa');
    expect(israeliStrength(g, 'syria')).toBeGreaterThan(allied);
  });

  it('stops the partners when we stop, and the West wants undertakings for its help', () => {
    const g = opening();
    openFront(g, 'syria', false, 0);
    g.fronts.syria.allies.push('jordan');
    g.nations.jordan.atWarWith.push('syria');
    g.nations.syria.atWarWith.push('jordan');
    g.fronts.syria.westernSupport.push('britain');

    endWar(g, 'syria', []);
    expect(g.nations.jordan.atWarWith).not.toContain('syria');
    expect(g.fronts.syria.allies).toEqual([]);
    expect(g.israel.restraint).toBeGreaterThan(0);
  });
});

describe('a treaty called in by a partner', () => {
  function attacked(): GameState {
    const g = opening();
    befriend(g, 'egypt');
    startRegionalWar(g, 'libya', 'egypt');
    return g;
  }

  it('puts the question to our cabinet', () => {
    const g = attacked();
    expect(g.obligations).toHaveLength(1);
    expect(g.obligations[0].partner).toBe('egypt');
  });

  it('treats silence as a refusal, and a refusal ends the treaty', () => {
    const g = attacked();
    const prestige = g.israel.prestige;
    g.turn += 1;
    resolveAlliances(g, new Rng(1));
    expect(g.nations.egypt.pactWith).not.toContain('israel');
    expect(g.israel.prestige).toBeLessThan(prestige);
    expect(g.obligations).toHaveLength(0);
  });

  it('flies for the partner when we honour it', () => {
    const g = attacked();
    const id = g.obligations[0].id;
    g.turn += 1;
    g.directives.obligations[id] = 'honour';
    resolveAlliances(g, new Rng(1));
    expect(findWar(g, 'libya', 'egypt')?.supporters.israel).toBe('egypt');
    expect(g.nations.libya.relations).toBe(0);
    expect(g.nations.egypt.pactWith).toContain('israel');
  });

  it('opens a front of our own when the aggressor is a neighbour', () => {
    const g = opening();
    befriend(g, 'jordan');
    startRegionalWar(g, 'syria', 'jordan');
    const id = g.obligations[0].id;
    g.turn += 1;
    g.directives.obligations[id] = 'honour';
    resolveAlliances(g, new Rng(1));
    expect(g.fronts.syria.atWar).toBe(true);
    expect(g.fronts.syria.allies).toContain('jordan');
    // A treaty war is not a war we started.
    expect(g.fronts.syria.startedByUs).toBe(false);
  });
});

describe('a joint offensive', () => {
  it('only offers enemies the partner already despises', () => {
    const g = opening();
    befriend(g, 'egypt');
    const targets = jointOptions(g, 'egypt').map((o) => o.id);
    // Cairo opens the game despising Tripoli and on terms with Amman.
    expect(targets).toContain('libya');
    expect(targets).not.toContain('jordan');
  });

  it('starts a war with Israel flying for the partner, when the partner agrees', () => {
    let agreed = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = opening(seed);
      befriend(g, 'egypt');
      g.directives.joint = { partner: 'egypt', target: 'libya' };
      const started = g.stats.warsStarted;
      resolveAlliances(g, new Rng(seed));
      const war = findWar(g, 'egypt', 'libya');
      if (war) {
        agreed++;
        expect(war.supporters.israel).toBe('egypt');
        expect(g.stats.warsStarted).toBe(started + 1);
      }
    }
    expect(agreed).toBeGreaterThan(8);
  });
});

describe('mediation', () => {
  it('ends our wars more often than asking them ourselves', () => {
    let bilateral = 0;
    let mediated = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const a = opening(seed);
      openFront(a, 'syria', false, 0);
      a.directives.diplomatic.syria = 'ceasefire';
      resolveDiplomacy(a, new Rng(seed));
      if (!a.fronts.syria.atWar) bilateral++;

      const b = opening(seed);
      openFront(b, 'syria', false, 0);
      b.directives.mediation.syria = 'usa';
      resolveAlliances(b, new Rng(seed));
      if (!b.fronts.syria.atWar) {
        mediated++;
        // Washington's name on it comes with Washington's terms.
        expect(b.israel.restraint).toBeGreaterThan(0);
      }
    }
    expect(mediated).toBeGreaterThan(bilateral);
  });

  it('lets a neighbour broker it, at the price of the ground', () => {
    let brokered = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = opening(seed);
      openFront(g, 'syria', false, 30);
      g.fronts.syria.occupation = 0.3;
      g.nations.egypt.interArab.syria = 6;
      g.directives.mediation.syria = 'egypt';
      resolveAlliances(g, new Rng(seed));
      if (!g.fronts.syria.atWar) {
        brokered++;
        expect(g.fronts.syria.occupation).toBe(0);
      }
    }
    expect(brokered).toBeGreaterThan(0);
  });

  it('lets Israel end other people’s wars, when both sides will have us in the room', () => {
    let ended = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = opening(seed);
      const war = startRegionalWar(g, 'iran', 'iraq');
      g.nations.iran.relations = 5;
      g.nations.iran.relationsPoints = 20;
      g.nations.iraq.relations = 5;
      g.nations.iraq.relationsPoints = 20;
      g.directives.regional[warKey(war)] = 'mediate';
      resolveAlliances(g, new Rng(seed));
      if (!findWar(g, 'iran', 'iraq')) ended++;
    }
    expect(ended).toBeGreaterThan(3);
  });
});

describe('Western air forces', () => {
  it('will fly against a state on the list, in a war we did not start, for a warm enough capital', () => {
    const g = opening();
    const cold = powerOptions(g, 'usa').find((o) => o.id === 'request_support');
    expect(cold?.disabledReason).toMatch(/not fighting/);

    openFront(g, 'syria', false, 0);
    setRelations(g, 'usa', 40);
    expect(powerOptions(g, 'usa').find((o) => o.id === 'request_support')?.disabledReason).toMatch(
      /will not be drawn/,
    );

    setRelations(g, 'usa', 80);
    expect(powerOptions(g, 'usa').find((o) => o.id === 'request_support')?.disabledReason).toBeUndefined();

    let joined = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const x = opening(seed);
      openFront(x, 'syria', false, 0);
      setRelations(x, 'usa', 80);
      x.directives.powers.usa = 'request_support';
      resolvePowers(x, new Rng(seed));
      if (x.fronts.syria.westernSupport.includes('usa')) joined++;
    }
    expect(joined).toBeGreaterThan(4);
  });

  it('will not join a war we started, until Washington is fighting the same one', () => {
    const g = opening();
    openFront(g, 'syria', true, 0);
    setRelations(g, 'usa', 90);
    expect(powerOptions(g, 'usa').find((o) => o.id === 'request_support')?.disabledReason).toBeTruthy();
    g.world.nineEleven = 'happened';
    expect(powerOptions(g, 'usa').find((o) => o.id === 'request_support')?.disabledReason).toBeUndefined();
  });
});
