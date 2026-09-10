import { describe, expect, it } from 'vitest';
import {
  applyBudget,
  applySummit,
  createGame,
  resolveTurn,
  advanceFromNewspaper,
  startGame,
  summitProposals,
  FRONTS,
} from './index';
import type { GameState } from './index';
import { setRelations } from './powers';

/**
 * Balance harness.
 *
 * The reference player here is a do-nothing caretaker: attends every summit,
 * accepts every proposal, never deploys, never funds anybody. That prime
 * minister should mostly survive. If passivity is fatal, the aggression the
 * game is actually about has nowhere to sit.
 */
function playPassive(seed: number, accept: boolean): GameState {
  const g = createGame(seed);
  startGame(g);
  for (let guard = 0; guard < 400; guard++) {
    if (g.phase === 'gameover') break;
    if (g.phase === 'newspaper') {
      advanceFromNewspaper(g);
    } else if (g.phase === 'summit') {
      const decisions: Record<string, boolean> = {};
      for (const p of summitProposals(g)) decisions[p.id] = accept;
      applySummit(g, decisions);
    } else if (g.phase === 'budget') {
      applyBudget(g, 'maintain', false);
    } else {
      resolveTurn(g);
    }
  }
  return g;
}

function distribution(games: GameState[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const g of games) {
    const k = g.ending?.kind ?? 'unresolved';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

describe('balance', () => {
  const N = 120;

  it('a passive premier who signs everything can still survive the decade', () => {
    const games = Array.from({ length: N }, (_, i) => playPassive(i + 1, true));
    const dist = distribution(games);
    // eslint-disable-next-line no-console
    console.log('passive / accepts everything:', dist);

    expect(dist.unresolved ?? 0).toBe(0);
    const survived = dist.survived ?? 0;
    // This used to read "usually survives", and it used to be true: 57% at the
    // point the harness was written. Five phases of deepening have taken it to
    // roughly 43% — an enemy that rearms, a coalition that walks out, an
    // embargo that grounds aircraft, an assessment that can be wrong, and now
    // Hezbollah. Survival is still the single likeliest outcome and doing
    // nothing is still not fatal, which is what this floor is guarding. The
    // floor has deliberately not been moved to make room; if a later phase
    // pushes through it, that is a finding rather than a number to adjust.
    expect(survived / N).toBeGreaterThan(0.4);
    // Doing nothing must not be a winning strategy either.
    expect((dist.victory ?? 0) / N).toBeLessThan(0.1);
  });

  it('a passive premier who refuses everything fares measurably worse', () => {
    const accepts = Array.from({ length: N }, (_, i) => playPassive(i + 1, true));
    const refuses = Array.from({ length: N }, (_, i) => playPassive(i + 1, false));
    // eslint-disable-next-line no-console
    console.log('passive / refuses everything:', distribution(refuses));

    const meanScore = (gs: GameState[]) =>
      gs.reduce((a, g) => a + (g.ending?.score ?? 0), 0) / gs.length;

    expect(meanScore(accepts)).toBeGreaterThan(meanScore(refuses));
  });

  it('never lets committed brigades exceed the army', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = playPassive(seed, seed % 2 === 0);
      const committed =
        g.palestine.brigadesPosted +
        FRONTS.reduce((a, f) => a + g.fronts[f].deployed.brigades, 0);
      expect(committed).toBeLessThanOrEqual(g.israel.brigades);
    }
  });

  it('lets a premier who stops rebuild the American relationship', () => {
    let lifted = 0;
    let peacefulRuns = 0;
    let peacefulLifted = 0;

    for (let seed = 60; seed < 90; seed++) {
      const g = createGame(seed);
      startGame(g);
      // Burn it down.
      setRelations(g, 'usa', 4);
      for (const id of ['usa', 'britain', 'france'] as const) {
        g.israel.suppliers[id].embargoed = true;
      }

      // Then behave for two years: no directives at all. Count resolved
      // months, not loop iterations - the newspaper screen is not a month.
      const until = g.turn + 24;
      for (let i = 0; i < 200 && g.turn < until && g.phase !== 'gameover'; i++) {
        if (g.phase === 'newspaper') advanceFromNewspaper(g);
        else if (g.phase === 'summit') applySummit(g, {});
        else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
        else resolveTurn(g);
      }

      const sawWar = FRONTS.some((f) => g.fronts[f].atWar || g.fronts[f].demilitarised);
      if (!g.israel.suppliers.usa.embargoed) lifted++;
      if (!sawWar) {
        peacefulRuns++;
        if (!g.israel.suppliers.usa.embargoed) peacefulLifted++;
      }
    }

    // eslint-disable-next-line no-console
    console.log(`embargo lifted in ${lifted}/30 runs; ${peacefulLifted}/${peacefulRuns} peaceful`);

    // The relationship must be repairable, and reliably so when at peace.
    expect(lifted).toBeGreaterThan(0);
    if (peacefulRuns > 0) expect(peacefulLifted).toBe(peacefulRuns);
  });

  it('keeps the embargo on while the aggression continues', () => {
    const g = createGame(78);
    startGame(g);
    setRelations(g, 'usa', 4);
    g.israel.suppliers.usa.embargoed = true;

    // Nuking somebody is not something Washington gets over.
    g.stats.nukesUsed = 1;
    const until = g.turn + 24;
    for (let i = 0; i < 200 && g.turn < until && g.phase !== 'gameover'; i++) {
      if (g.phase === 'newspaper') advanceFromNewspaper(g);
      else if (g.phase === 'summit') applySummit(g, {});
      else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
      else resolveTurn(g);
    }
    expect(g.israel.suppliers.usa.embargoed).toBe(true);
  });

  it('gives the Camp David decision real weight in both directions', () => {
    // Accepting the homeland should reliably calm the territories.
    const accepted = playPassive(4, true);
    const refused = playPassive(4, false);
    expect(accepted.palestine.unrest).toBeLessThan(refused.palestine.unrest);
  });

  it('sets the territories alight when Camp David collapses', () => {
    let refusedIntifadas = 0;
    let acceptedIntifadas = 0;

    for (let seed = 1; seed <= 20; seed++) {
      const refused = playPassive(seed, false);
      const accepted = playPassive(seed, true);
      // `firedEvents` also records events whose moment passed unfired, so the
      // only honest witness is the state the event actually sets.
      if (refused.palestine.intifada) refusedIntifadas++;
      if (accepted.palestine.intifada) acceptedIntifadas++;
    }

    // Walking away from the framework leads to September, every time.
    expect(refusedIntifadas).toBe(20);
    // Signing it takes the question off the table entirely.
    expect(acceptedIntifadas).toBe(0);
  });
});
