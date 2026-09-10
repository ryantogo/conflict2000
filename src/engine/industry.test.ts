import { describe, expect, it } from 'vitest';
import { createGame, industryReport, industrySpend, setProduction, startGame } from './index';
import { countOf } from './fleet';
import { resolveProduction } from './industry';

/**
 * A production line is the one source of equipment nobody else can switch off.
 * These are the claims that make it worth its price.
 */

describe('the defence industry', () => {
  it('starts with every line idle — opening one is a decision', () => {
    const g = createGame(1);
    startGame(g);
    expect(industryReport(g).every((l) => !l.running)).toBe(true);
    expect(industrySpend(g)).toBe(0);
  });

  it('delivers into the stockpile every month it is funded', () => {
    const g = createGame(2);
    startGame(g);
    const before = countOf(g.israel.stockpile.equipment, 'tank');

    setProduction(g, 'line_merkava3', true);
    for (let i = 0; i < 6; i++) resolveProduction(g);

    // Five Merkavas a month, and they arrive as Merkavas.
    expect(g.israel.stockpile.equipment.merkava3).toBe(400 + 30);
    expect(countOf(g.israel.stockpile.equipment, 'tank')).toBe(before + 30);
  });

  it('bills the Treasury every month, unlike a one-off purchase', () => {
    const g = createGame(3);
    startGame(g);
    setProduction(g, 'line_merkava3', true);
    expect(industrySpend(g)).toBe(35);

    const funds = g.israel.funds;
    resolveProduction(g);
    expect(g.israel.funds).toBe(funds - 35);
  });

  it('pays for years before a development programme delivers anything', () => {
    const g = createGame(4);
    startGame(g);
    g.israel.funds = 100000;
    setProduction(g, 'line_merkava4', true);

    // Thirty months of development money, and not one tank.
    for (let i = 0; i < 30; i++) resolveProduction(g);
    expect(g.israel.stockpile.equipment.merkava4).toBeUndefined();
    expect(industryReport(g).find((l) => l.id === 'line_merkava4')!.development).toBe(0);

    resolveProduction(g);
    expect(g.israel.stockpile.equipment.merkava4).toBe(4);
  });

  it('suspends a line the Treasury cannot pay for, keeping banked development', () => {
    const g = createGame(5);
    startGame(g);
    setProduction(g, 'line_merkava4', true);
    g.israel.funds = 100000;
    for (let i = 0; i < 10; i++) resolveProduction(g);
    const banked = industryReport(g).find((l) => l.id === 'line_merkava4')!.development;

    g.israel.funds = 1;
    const events = resolveProduction(g);

    expect(events.some((e) => /suspended/.test(e.text))).toBe(true);
    expect(industryReport(g).find((l) => l.id === 'line_merkava4')!.running).toBe(false);
    // The years already paid for are not thrown away.
    expect(industryReport(g).find((l) => l.id === 'line_merkava4')!.development).toBe(banked);
  });

  it('keeps delivering while every foreign supplier is embargoed', () => {
    const g = createGame(6);
    startGame(g);
    for (const id of ['usa', 'britain', 'france', 'dealer'] as const) {
      g.israel.suppliers[id].embargoed = true;
    }
    setProduction(g, 'line_arrow2', true);
    for (let i = 0; i < 12; i++) resolveProduction(g);

    // Twelve Arrow batteries, with the whole world refusing to sell.
    expect(g.israel.stockpile.equipment.arrow2).toBe(12);
  });

  it('reports plainly what each line is doing', () => {
    const g = createGame(7);
    startGame(g);
    const idle = industryReport(g).find((l) => l.id === 'line_merkava3')!;
    expect(idle.status).toBe('Line idle');

    setProduction(g, 'line_merkava3', true);
    expect(industryReport(g).find((l) => l.id === 'line_merkava3')!.status).toMatch(
      /In production/,
    );

    const unstarted = industryReport(g).find((l) => l.id === 'line_heron')!;
    expect(unstarted.status).toMatch(/Not begun — 6 months of development required/);

    setProduction(g, 'line_heron', true);
    expect(industryReport(g).find((l) => l.id === 'line_heron')!.status).toMatch(
      /In development — 6 months remaining/,
    );
  });
});
