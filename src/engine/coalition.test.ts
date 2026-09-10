import { describe, expect, it } from 'vitest';
import { Rng } from './rng';
import {
  MAJORITY,
  applySummit,
  coalitionReport,
  coalitionSeats,
  createGame,
  hasMajority,
  startGame,
  summitProposals,
} from './index';
import { coalitionReact, resolveCoalition } from './coalition';

/**
 * `popularity` is what the country thinks of you. It was never the same
 * question as whether you can still pass a budget, and these are the claims
 * that separate the two.
 */

function months(g: ReturnType<typeof createGame>, n: number, seed = 7): void {
  const rng = new Rng(seed);
  for (let i = 0; i < n; i++) resolveCoalition(g, rng);
}

describe('the Knesset', () => {
  it('opens with the real 1999 arithmetic and a narrow majority', () => {
    const g = createGame(1);
    startGame(g);
    expect(coalitionSeats(g)).toBe(75);
    expect(hasMajority(g)).toBe(true);
    // Narrow enough that losing Shas alone very nearly ends it.
    expect(coalitionSeats(g) - 17).toBeLessThan(MAJORITY);
  });

  it('moves the same act in opposite directions for different partners', () => {
    const g = createGame(2);
    startGame(g);
    const before = Object.fromEntries(coalitionReport(g).map((p) => [p.id, p.satisfaction]));

    coalitionReact(g, 'territorial', 30);

    const after = Object.fromEntries(coalitionReport(g).map((p) => [p.id, p.satisfaction]));
    // Meretz wants the concession; the National Religious Party calls it a betrayal.
    expect(after.meretz).toBeGreaterThan(before.meretz);
    expect(after.nrp).toBeLessThan(before.nrp);
  });

  it('loses the religious right when a homeland is conceded', () => {
    const g = createGame(3);
    startGame(g);
    const proposals = summitProposals(g);
    expect(proposals.some((p) => p.id === 'homeland')).toBe(true);

    applySummit(g, { homeland: true }, true);
    months(g, 1);

    const out = coalitionReport(g).filter((p) => !p.inCoalition).map((p) => p.id);
    expect(out).toContain('shas');
    expect(out).toContain('nrp');
    expect(hasMajority(g)).toBe(false);
  });

  it('loses Meretz when one is refused', () => {
    const g = createGame(4);
    startGame(g);
    applySummit(g, { homeland: false }, true);
    months(g, 1);

    const out = coalitionReport(g).filter((p) => !p.inCoalition).map((p) => p.id);
    expect(out).toContain('meretz');
    // But the right stays, so the government survives the vote itself.
    expect(hasMajority(g)).toBe(true);
  });

  it('lets a walked-out partner be courted back', () => {
    const g = createGame(5);
    startGame(g);
    applySummit(g, { homeland: true }, true);
    months(g, 1);
    expect(hasMajority(g)).toBe(false);

    // Left alone, feelings cool and coalitions get renegotiated.
    months(g, 40);
    expect(hasMajority(g)).toBe(true);
  });

  it('never lets the premier’s own bloc walk out on him', () => {
    const g = createGame(6);
    startGame(g);
    g.israel.coalition.one_israel.satisfaction = 0;
    months(g, 12);
    expect(coalitionReport(g).find((p) => p.id === 'one_israel')!.inCoalition).toBe(true);
  });

  it('grinds down a minority government in public rather than ending it outright', () => {
    const g = createGame(7);
    startGame(g);
    for (const id of ['shas', 'nrp', 'yisrael_baaliyah', 'utj']) {
      g.israel.coalition[id].inCoalition = false;
      g.israel.coalition[id].satisfaction = 5;
    }
    expect(hasMajority(g)).toBe(false);

    const before = g.israel.popularity;
    months(g, 6);
    expect(g.israel.popularity).toBeLessThan(before);
  });

  it('costs nothing at all while the majority holds', () => {
    const g = createGame(8);
    startGame(g);
    const before = g.israel.popularity;
    months(g, 24);
    expect(hasMajority(g)).toBe(true);
    expect(g.israel.popularity).toBe(before);
  });

  it('can end a government outright once the arithmetic is hopeless', () => {
    const g = createGame(9);
    startGame(g);
    // Everybody but the premier's own bloc: 26 of 120.
    for (const p of coalitionReport(g)) {
      if (!p.ownParty) {
        g.israel.coalition[p.id].inCoalition = false;
        g.israel.coalition[p.id].satisfaction = 0;
      }
    }
    expect(coalitionSeats(g)).toBe(26);

    let fell = false;
    const rng = new Rng(3);
    for (let i = 0; i < 200 && !fell; i++) {
      resolveCoalition(g, rng);
      fell = g.israel.lostConfidence;
      // Keep them out, so the arithmetic stays hopeless.
      for (const p of coalitionReport(g)) {
        if (!p.ownParty) g.israel.coalition[p.id].inCoalition = false;
      }
    }
    expect(fell).toBe(true);
  });
});
