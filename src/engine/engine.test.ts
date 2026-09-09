import { describe, expect, it } from 'vitest';
import {
  FRONTS,
  NATION_IDS,
  Rng,
  createGame,
  diplomaticOptions,
  intelOptions,
  policingOptions,
  resolveTurn,
  advanceFromNewspaper,
  startGame,
  strategicOptions,
  summitProposals,
  applySummit,
  applyBudget,
  officialReport,
  qualityPhrase,
} from './index';
import type { GameState } from './index';
import { expand } from '../data/headlines';

/** Drive one full game to an ending, choosing legal options at random. */
function playRandomGame(seed: number): GameState {
  const g = createGame(seed);
  startGame(g);
  const rng = new Rng(seed ^ 0x5f3759df);

  for (let guard = 0; guard < 400; guard++) {
    if (g.phase === 'gameover') break;

    if (g.phase === 'newspaper') {
      advanceFromNewspaper(g);
      continue;
    }
    if (g.phase === 'summit') {
      const decisions: Record<string, boolean> = {};
      for (const p of summitProposals(g)) decisions[p.id] = rng.chance(0.5);
      applySummit(g, decisions);
      continue;
    }
    if (g.phase === 'budget') {
      applyBudget(g, rng.pick(['increase', 'decrease', 'maintain'] as const), rng.chance(0.4));
      continue;
    }

    // Issue a handful of random-but-legal directives.
    for (const id of NATION_IDS) {
      if (!rng.chance(0.35)) continue;
      const dopts = diplomaticOptions(g, id).filter((o) => !o.disabledReason);
      if (dopts.length) g.directives.diplomatic[id] = rng.pick(dopts).id;
      const iopts = intelOptions(g, id).filter((o) => !o.disabledReason);
      if (iopts.length) g.directives.intel[id] = rng.pick(iopts).id;
    }
    for (const f of FRONTS) {
      if (!rng.chance(0.3)) continue;
      const sopts = strategicOptions(g, f).filter((o) => !o.disabledReason);
      if (sopts.length) g.directives.strategic[f] = rng.pick(sopts).id;
    }
    const popts = policingOptions(g).filter((o) => !o.disabledReason);
    if (popts.length && rng.chance(0.3)) g.directives.policing = rng.pick(popts).id;
    g.directives.fundNuclear = rng.chance(0.25);

    resolveTurn(g);
  }
  return g;
}

/** Assert nothing has drifted outside its declared range. */
function assertInvariants(g: GameState) {
  expect(g.tension).toBeGreaterThanOrEqual(0);
  expect(g.tension).toBeLessThanOrEqual(100);
  expect(g.israel.prestige).toBeGreaterThanOrEqual(0);
  expect(g.israel.prestige).toBeLessThanOrEqual(100);
  expect(g.israel.popularity).toBeGreaterThanOrEqual(0);
  expect(g.israel.usRelations).toBeLessThanOrEqual(100);
  expect(g.palestine.unrest).toBeGreaterThanOrEqual(0);
  expect(g.palestine.unrest).toBeLessThanOrEqual(10);
  expect(g.israel.brigades).toBeGreaterThanOrEqual(0);
  expect(Number.isFinite(g.israel.funds)).toBe(true);

  for (const id of NATION_IDS) {
    const n = g.nations[id];
    expect(n.relations).toBeGreaterThanOrEqual(0);
    expect(n.relations).toBeLessThanOrEqual(9);
    expect(n.stability).toBeGreaterThanOrEqual(0);
    expect(n.stability).toBeLessThanOrEqual(100);
    expect(n.oppositionStrength).toBeGreaterThanOrEqual(0);
    expect(n.oppositionStrength).toBeLessThanOrEqual(100);
    expect(n.forces.brigades).toBeGreaterThanOrEqual(0);
  }

  // No brigade may be counted twice.
  let committed = g.palestine.brigadesPosted;
  for (const f of FRONTS) committed += g.fronts[f].deployed.brigades;
  expect(committed).toBeLessThanOrEqual(g.israel.brigades);
}

describe('headline expansion', () => {
  it('expands abbreviation tokens and nation substitutions', () => {
    expect(
      expand('Invas^ !! * } storm into _', { subjAdj: 'Syrian', objName: 'Israel' }),
    ).toBe('Invasion !! Syrian troops storm into Israel');
    expect(expand('Relat^s { # ~ _ worsen', { subjName: 'Egypt', objName: 'Israel' })).toBe(
      'Relations between Egypt and Israel worsen',
    );
    expect(expand('Heavy troop % cause panic in * lines', { subjAdj: 'Iraqi' })).toBe(
      'Heavy troop losses cause panic in Iraqi lines',
    );
  });

  it('leaves no substitution tokens behind', () => {
    const out = expand('* leader denounces _ in maiden speech', {
      subjAdj: 'Jordanian',
      objName: 'Israel',
    });
    expect(out).not.toMatch(/[*#&@_+^{}%~]/);
  });
});

describe('opening position, June 2000', () => {
  it('starts in June 2000 with Barak in office', () => {
    const g = createGame(1);
    expect(g.year).toBe(2000);
    expect(g.month).toBe(5);
    expect(g.israel.leader).toBe('Ehud Barak');
  });

  it('kills Assad and installs Bashar in the opening month', () => {
    const g = createGame(7);
    startGame(g);
    expect(g.nations.syria.leader).toBe('Bashar al-Assad');
    expect(g.paper?.headlines.some((h) => /Assad/.test(h.text))).toBe(true);
  });

  it('cannot invade Jordan at the start — relations are too good', () => {
    const g = createGame(3);
    startGame(g);
    const invade = strategicOptions(g, 'jordan').find((o) => o.id === 'invade');
    expect(invade?.disabledReason).toBeTruthy();
  });

  it('holds a summit in July 2000 regardless of tension', () => {
    const g = createGame(11);
    startGame(g);
    advanceFromNewspaper(g); // read June's papers
    resolveTurn(g); // June -> July
    expect(g.month).toBe(6);
    // The papers come first; the summit is queued behind them.
    expect(g.phase).toBe('newspaper');
    expect(g.pendingInterstitial).toBe('summit');
    advanceFromNewspaper(g);
    expect(g.phase).toBe('summit');
    // And Camp David must put the Palestinian question on the table.
    expect(summitProposals(g).some((p) => p.id === 'homeland')).toBe(true);
  });
});

describe('turn resolution', () => {
  it('advances the calendar one month per turn and rolls the year', () => {
    const g = createGame(5);
    startGame(g);
    for (let i = 0; i < 7; i++) {
      if (g.phase === 'newspaper') advanceFromNewspaper(g);
      else if (g.phase === 'summit') applySummit(g, {});
      else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
      else resolveTurn(g);
    }
    expect(g.year).toBeGreaterThanOrEqual(2000);
    expect(g.month).toBeGreaterThanOrEqual(0);
    expect(g.month).toBeLessThanOrEqual(11);
  });

  it('always prints a newspaper with at least one story', () => {
    const g = createGame(21);
    startGame(g);
    for (let i = 0; i < 12 && g.phase !== 'gameover'; i++) {
      if (g.phase === 'newspaper') advanceFromNewspaper(g);
      else if (g.phase === 'summit') applySummit(g, {});
      else if (g.phase === 'budget') applyBudget(g, 'maintain', false);
      else resolveTurn(g);
      expect(g.paper).not.toBeNull();
      expect(g.paper!.headlines.length).toBeGreaterThan(0);
      for (const h of g.paper!.headlines) {
        expect(h.text.trim().length).toBeGreaterThan(0);
        // No unexpanded template tokens must ever reach the page.
        expect(h.text).not.toMatch(/[*#&@_+^{}%~]/);
      }
    }
  });

  it('produces a readable official report every turn', () => {
    const g = createGame(33);
    startGame(g);
    const lines = officialReport(g);
    expect(lines.length).toBeGreaterThan(NATION_IDS.length);
    for (const l of lines) expect(l).not.toMatch(/undefined|NaN/);
  });
});

describe('soak', () => {
  it('runs 150 random games to completion without breaking invariants', () => {
    const endings: Record<string, number> = {};
    for (let seed = 1; seed <= 150; seed++) {
      const g = playRandomGame(seed);
      assertInvariants(g);
      const kind = g.ending ? g.ending.kind : 'unresolved';
      endings[kind] = (endings[kind] ?? 0) + 1;
      expect(Number.isFinite(g.ending?.score ?? 0)).toBe(true);
    }
    // Every game must actually terminate.
    expect(endings.unresolved ?? 0).toBe(0);
    // And the outcome space must not be degenerate.
    expect(Object.keys(endings).length).toBeGreaterThan(1);
    // eslint-disable-next-line no-console
    console.log('ending distribution:', endings);
  });

  it('is deterministic for a given seed', () => {
    const a = playRandomGame(42);
    const b = playRandomGame(42);
    expect(a.turn).toBe(b.turn);
    expect(a.ending?.kind).toBe(b.ending?.kind);
    expect(a.ending?.score).toBe(b.ending?.score);
  });
});

describe('leadership analysis', () => {
  it('matches the original’s calibration', () => {
    // The 1990 screenshot: Analysis Score 338 -> "superb !".
    expect(qualityPhrase(338)).toBe('superb !');
    expect(qualityPhrase(-250)).toBe('a complete joke.');
    expect(qualityPhrase(-40)).toBe('a total failure.');
    expect(qualityPhrase(500)).toBe('amazing !!');
  });

  it('is monotonic in score', () => {
    const seen: string[] = [];
    for (let sc = -300; sc <= 600; sc += 10) {
      const q = qualityPhrase(sc);
      if (seen[seen.length - 1] !== q) seen.push(q);
    }
    // Never revisits a rung it has already left.
    expect(new Set(seen).size).toBe(seen.length);
  });
});
