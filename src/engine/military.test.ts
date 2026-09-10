import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  airUnits,
  applyBudget,
  applySummit,
  createGame,
  placeOrder,
  resolveTurn,
  advanceFromNewspaper,
  startGame,
  strategicOptions,
} from './index';
import type { GameState } from './index';
import { resolveStrategic } from './military';

/** Put a full column on the Lebanese border and hand it back. */
function massOnLebanon(g: GameState): void {
  g.directives.strategic.lebanon = 'deploy_all';
  resolveStrategic(g, new Rng(1));
  g.directives.strategic = {};
}

describe('getting the army home again', () => {
  it('offers a withdrawal once the other government has collapsed', () => {
    const g = createGame(5);
    startGame(g);
    massOnLebanon(g);
    expect(g.fronts.lebanon.deployed.brigades).toBeGreaterThan(0);

    // The war is over: Beirut has no government left to negotiate with.
    g.nations.lebanon.collapsed = true;
    g.nations.lebanon.collapseCause = 'invasion';

    const opts = strategicOptions(g, 'lebanon').filter((o) => !o.disabledReason);
    expect(opts.map((o) => o.id)).toContain('withdraw');
  });

  it('returns every last tank and aircraft to the reserve', () => {
    const g = createGame(6);
    startGame(g);
    const before = { ...g.israel.stockpile };
    massOnLebanon(g);
    g.nations.lebanon.collapsed = true;

    g.directives.strategic.lebanon = 'withdraw';
    resolveStrategic(g, new Rng(2));

    const dep = g.fronts.lebanon.deployed;
    expect(dep.brigades).toBe(0);
    expect(dep.tanks).toBe(0);
    expect(airUnits(dep)).toBe(0);
    expect(dep.sam).toBe(0);
    // Nothing may be lost in the paperwork.
    expect(g.israel.stockpile).toEqual(before);
  });

  it('leaves a collapsed border alone when nothing is standing on it', () => {
    const g = createGame(7);
    startGame(g);
    g.nations.lebanon.collapsed = true;

    const opts = strategicOptions(g, 'lebanon');
    expect(opts.every((o) => o.disabledReason)).toBe(true);
  });

  it('lets a front that has lost its infantry still recall its equipment', () => {
    const g = createGame(8);
    startGame(g);
    massOnLebanon(g);
    // Every brigade is gone, but the armour and the batteries are not.
    g.israel.brigades -= g.fronts.lebanon.deployed.brigades;
    g.fronts.lebanon.deployed.brigades = 0;

    const opts = strategicOptions(g, 'lebanon').filter((o) => !o.disabledReason);
    expect(opts.map((o) => o.id)).toContain('withdraw');
  });
});

describe('the air arm', () => {
  it('counts helicopters and early warning craft in their own pools', () => {
    const g = createGame(9);
    startGame(g);
    const st = g.israel.stockpile;
    expect(st.helicopters).toBeGreaterThan(0);
    expect(st.awacs).toBeGreaterThan(0);

    const heli = st.helicopters;
    const awacs = st.awacs;
    const jets = st.aircraft;

    g.israel.funds = 5000;
    g.israel.suppliers.usa.loyalty = 100;
    expect(placeOrder(g, 'usa', 'apache_d', 2)).toBeNull();
    expect(placeOrder(g, 'usa', 'hawkeye', 1)).toBeNull();

    // Fly the orders through their lead time. Count resolved months, not
    // loop iterations — the newspaper and Camp David are not months.
    const until = g.turn + 4;
    for (let i = 0; i < 40 && g.turn < until && g.phase !== 'gameover'; i++) {
      if (g.phase === 'newspaper') advanceFromNewspaper(g);
      else if (g.phase === 'summit') applySummit(g, {});
      else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
      else resolveTurn(g);
    }

    expect(g.israel.stockpile.helicopters).toBe(heli + 2);
    expect(g.israel.stockpile.awacs).toBe(awacs + 1);
    // And they must not have been double counted as strike aircraft.
    expect(g.israel.stockpile.aircraft).toBe(jets);
  });

  it('sends helicopters and early warning craft forward with the rest', () => {
    const g = createGame(10);
    startGame(g);
    massOnLebanon(g);
    const dep = g.fronts.lebanon.deployed;
    expect(dep.helicopters).toBeGreaterThan(0);
    expect(dep.awacs).toBeGreaterThan(0);
  });
});
