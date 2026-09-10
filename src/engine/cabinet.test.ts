import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import { coalitionReport, coalitionSeats, createGame, hasMajority, startGame } from './index';
import type { GameState } from './index';
import {
  appeaseOptions,
  coalitionReact,
  raiseCabinetEvent,
  resolveCabinet,
  resolveCoalition,
} from './coalition';
import { CABINET_EVENTS } from '../data/cabinet2000';

/**
 * The coalition used to be something that happened to the premier. It now
 * asks things of him, and he can do things for it.
 */

function opening(seed = 1): GameState {
  const g = createGame(seed);
  startGame(g);
  return g;
}

function sat(g: GameState, id: string): number {
  return g.israel.coalition[id].satisfaction;
}

describe('the opposition', () => {
  it('leaves Likud and Shinui outside, and does not let them wander in', () => {
    const g = opening();
    expect(coalitionSeats(g)).toBe(75);
    const rng = new Rng(3);
    for (let i = 0; i < 60; i++) resolveCoalition(g, rng);
    const out = coalitionReport(g).filter((p) => !p.inCoalition).map((p) => p.id);
    expect(out).toContain('likud');
    expect(out).toContain('shinui');
  });

  it('can be brought into the government on purpose', () => {
    const g = opening();
    g.israel.funds = 1000;
    const rng = new Rng(4);
    // A ministry, then talks, then a concession: three months of courting.
    for (const action of ['ministry', 'court', 'concession'] as const) {
      g.directives.appease = { party: 'likud', action };
      resolveCabinet(g, rng);
      resolveCoalition(g, rng);
      g.turn++;
    }
    expect(g.israel.coalition.likud.inCoalition).toBe(true);
    expect(coalitionSeats(g)).toBe(94);
  });
});

describe('religion and state', () => {
  it('moves Shas and Shinui in opposite directions', () => {
    const g = opening();
    const shas = sat(g, 'shas');
    const shinui = sat(g, 'shinui');
    coalitionReact(g, 'religious', 20);
    expect(sat(g, 'shas')).toBeGreaterThan(shas);
    expect(sat(g, 'shinui')).toBeLessThan(shinui);
  });
});

describe('before the cabinet', () => {
  it('puts a question to the cabinet every so often, and never two at once', () => {
    const g = opening();
    const rng = new Rng(5);
    let raised = 0;
    for (let i = 0; i < 40; i++) {
      g.turn++;
      if (raiseCabinetEvent(g, rng).length > 0) raised++;
      if (g.cabinet.pending) {
        expect(raiseCabinetEvent(g, rng)).toHaveLength(0);
        resolveCabinet(g, rng);
      }
    }
    expect(raised).toBeGreaterThan(4);
    expect(raised).toBeLessThan(20);
  });

  it('applies the answer we gave', () => {
    const g = opening();
    g.cabinet.pending = 'shas_schools';
    g.directives.cabinetChoice = 'pay';
    const funds = g.israel.funds;
    const shas = sat(g, 'shas');
    resolveCabinet(g, new Rng(1));
    expect(g.israel.funds).toBe(funds - 60);
    expect(sat(g, 'shas')).toBeGreaterThan(shas);
    expect(g.cabinet.pending).toBeNull();
  });

  it('decides for us when we do not, and charges for it', () => {
    const g = opening();
    g.cabinet.pending = 'shas_schools';
    const shas = sat(g, 'shas');
    const popularity = g.israel.popularity;
    resolveCabinet(g, new Rng(1));
    // The fallback is a refusal, and the country saw us dither.
    expect(sat(g, 'shas')).toBeLessThan(shas);
    expect(g.israel.popularity).toBeLessThan(popularity);
  });

  it('has a real fallback for every question it can ask', () => {
    for (const ev of CABINET_EVENTS) {
      expect(ev.choices.map((c) => c.id), ev.id).toContain(ev.fallback);
      expect(ev.choices.length, ev.id).toBeGreaterThan(1);
    }
  });

  it('lets Likud into a unity government during an intifada', () => {
    const g = opening();
    g.palestine.intifada = true;
    g.cabinet.pending = 'unity';
    g.directives.cabinetChoice = 'accept';
    resolveCabinet(g, new Rng(1));
    expect(g.israel.coalition.likud.inCoalition).toBe(true);
  });
});

describe('keeping the coalition', () => {
  it('buys a welfare party with money and costs the fund', () => {
    const g = opening();
    const funds = g.israel.funds;
    const shas = sat(g, 'shas');
    g.directives.appease = { party: 'shas', action: 'earmark' };
    resolveCabinet(g, new Rng(1));
    expect(g.israel.funds).toBeLessThan(funds);
    expect(sat(g, 'shas')).toBeGreaterThan(shas);
  });

  it('will not do the same favour twice in a row', () => {
    const g = opening();
    g.directives.appease = { party: 'shas', action: 'ministry' };
    resolveCabinet(g, new Rng(1));
    g.turn++;
    const again = appeaseOptions(g, 'shas').find((o) => o.id === 'ministry');
    expect(again?.disabledReason).toBeTruthy();
  });

  it('never offers the premier’s own bloc a favour', () => {
    expect(appeaseOptions(opening(), 'one_israel')).toHaveLength(0);
  });
});

describe('going to the country', () => {
  function minority(g: GameState): void {
    for (const id of ['shas', 'nrp', 'yisrael_baaliyah', 'utj']) {
      g.israel.coalition[id].inCoalition = false;
      g.israel.coalition[id].satisfaction = 30;
    }
    expect(hasMajority(g)).toBe(false);
  }

  it('usually returns a popular premier with a new arithmetic', () => {
    let won = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = opening(seed);
      minority(g);
      g.israel.popularity = 80;
      g.directives.callElection = true;
      resolveCabinet(g, new Rng(seed));
      if (!g.israel.electionLost) won++;
    }
    expect(won).toBeGreaterThan(15);
  });

  it('usually ends an unpopular one', () => {
    let lost = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const g = opening(seed);
      minority(g);
      g.israel.popularity = 12;
      g.directives.callElection = true;
      resolveCabinet(g, new Rng(seed));
      if (g.israel.electionLost) lost++;
    }
    expect(lost).toBeGreaterThan(15);
  });
});
