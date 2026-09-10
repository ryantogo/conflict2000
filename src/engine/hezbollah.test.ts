import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { createGame, diplomaticOptions, startGame } from './index';
import type { GameState } from './index';
import {
  provocationChance,
  raiseIncident,
  resolveFactions,
  resolveIncidents,
  responseOptions,
} from './factions';
import { relationsWith } from './powers';

/**
 * Hezbollah used to fire at a rate set by its own strength and settle the
 * border wherever Beirut's relations happened to be. It now fires when Tehran
 * wants it to, and every attack is a question the cabinet has to answer.
 */

function opening(seed = 1): GameState {
  const g = createGame(seed);
  startGame(g);
  return g;
}

function setRel(g: GameState, id: 'iran' | 'lebanon', rel: number): void {
  g.nations[id].relations = rel;
  g.nations[id].relationsPoints = rel * 20 - 90;
}

function raids(g: GameState, months: number, seed: number): number {
  const rng = new Rng(seed);
  let n = 0;
  for (let i = 0; i < months; i++) {
    const before = g.incidents.length;
    resolveFactions(g, rng);
    n += g.incidents.length - before;
    g.incidents = [];
    g.turn++;
  }
  return n;
}

describe('Tehran, not Beirut', () => {
  it('provokes us far more often when Tehran is hostile than when it is warm', () => {
    const hostile = opening();
    const warm = opening();
    setRel(warm, 'iran', 8);
    expect(provocationChance(hostile, hostile.factions.hezbollah)).toBeGreaterThan(
      provocationChance(warm, warm.factions.hezbollah) * 2,
    );
    expect(raids(hostile, 120, 3)).toBeGreaterThan(raids(warm, 120, 3));
  });

  it('keeps provoking us when Beirut is friendly, and humiliates Beirut instead', () => {
    const g = opening();
    setRel(g, 'lebanon', 7);
    const chance = provocationChance(g, g.factions.hezbollah);
    expect(chance).toBeGreaterThan(0.05);

    const stability = g.nations.lebanon.stability;
    const n = raids(g, 60, 9);
    expect(n).toBeGreaterThan(0);
    expect(g.nations.lebanon.stability).toBeLessThan(stability + 1);
    // A friendly Beirut does not mass troops on the border over it.
    expect(g.fronts.lebanon.enemyActivity).toBeLessThanOrEqual(1);
  });

  it('is answered from Lebanon when we bomb Tehran', () => {
    const g = opening();
    const calm = provocationChance(g, g.factions.hezbollah);
    g.lastStruck.iran = g.turn;
    expect(provocationChance(g, g.factions.hezbollah)).toBeGreaterThan(calm);
  });
});

describe('every attack is a question', () => {
  it('treats silence as restraint, and charges for the silence', () => {
    const g = opening();
    raiseIncident(g, 'hezbollah', 'ambush');
    const popularity = g.israel.popularity;
    const deterrence = g.factions.hezbollah.deterrence;
    const us = relationsWith(g, 'usa');
    g.turn++;
    resolveIncidents(g, new Rng(1));
    expect(g.incidents).toHaveLength(0);
    expect(g.factions.hezbollah.deterrence).toBeLessThan(deterrence);
    // Restraint plays in Washington...
    expect(relationsWith(g, 'usa')).toBeGreaterThan(us);
    // ...and silence plays badly at home: restraint's own cost, and the
    // silence on top of it.
    expect(g.israel.popularity).toBeLessThan(popularity - 1);
  });

  it('prices each answer differently at home, in the region and in the West', () => {
    const answer = (r: 'airstrikes' | 'infrastructure' | 'restraint') => {
      const g = opening();
      const inc = raiseIncident(g, 'hezbollah', 'rockets');
      g.directives.incidentResponse[inc.id] = r;
      const before = {
        strength: g.factions.hezbollah.strength,
        lebanon: g.nations.lebanon.relationsPoints,
        us: relationsWith(g, 'usa'),
        france: relationsWith(g, 'france'),
      };
      g.turn++;
      resolveIncidents(g, new Rng(2));
      return {
        strength: g.factions.hezbollah.strength - before.strength,
        lebanon: g.nations.lebanon.relationsPoints - before.lebanon,
        us: relationsWith(g, 'usa') - before.us,
        france: relationsWith(g, 'france') - before.france,
        deterrence: g.factions.hezbollah.deterrence,
      };
    };
    const restraint = answer('restraint');
    const strikes = answer('airstrikes');
    const bridges = answer('infrastructure');

    expect(strikes.strength).toBeLessThan(0);
    expect(strikes.deterrence).toBeGreaterThan(restraint.deterrence);
    expect(strikes.us).toBeLessThan(restraint.us);
    // Punishing Beirut costs Beirut, and Paris, most of all.
    expect(bridges.lebanon).toBeLessThan(strikes.lebanon);
    expect(bridges.france).toBeLessThan(strikes.france);
  });

  it('will not send Mossad after a commander without a network to find him', () => {
    const g = opening();
    const inc = raiseIncident(g, 'hezbollah', 'rockets');
    g.nations.lebanon.network = 20;
    expect(responseOptions(g, inc).find((o) => o.id === 'targeted')?.disabledReason).toBeTruthy();
    g.nations.lebanon.network = 70;
    expect(responseOptions(g, inc).find((o) => o.id === 'targeted')?.disabledReason).toBeUndefined();
  });

  it('can tip into a rocket campaign, which a ceasefire ends', () => {
    let escalated: GameState | null = null;
    for (let seed = 1; seed <= 200 && !escalated; seed++) {
      const g = opening(seed);
      const inc = raiseIncident(g, 'hezbollah', 'rockets');
      g.directives.incidentResponse[inc.id] = 'infrastructure';
      g.turn++;
      resolveIncidents(g, new Rng(seed));
      if (g.factions.hezbollah.escalation > 0) escalated = g;
    }
    expect(escalated).not.toBeNull();
    const g = escalated!;
    const inc = raiseIncident(g, 'hezbollah', 'rockets');
    expect(responseOptions(g, inc).map((o) => o.id)).toContain('ceasefire');
    g.directives.incidentResponse[inc.id] = 'ceasefire';
    g.turn++;
    resolveIncidents(g, new Rng(1));
    expect(g.factions.hezbollah.escalation).toBe(0);
  });
});

describe('the one lever that goes through a government', () => {
  it('lets a friendly Beirut be pressed into policing its own south', () => {
    const g = opening();
    expect(diplomaticOptions(g, 'lebanon').map((o) => o.id)).not.toContain('press_hezbollah');
    setRel(g, 'lebanon', 6);
    expect(diplomaticOptions(g, 'lebanon').map((o) => o.id)).toContain('press_hezbollah');
  });
});
