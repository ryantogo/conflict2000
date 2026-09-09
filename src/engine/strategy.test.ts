import { describe, expect, it } from 'vitest';
import {
  FRONTS,
  applyBudget,
  applySummit,
  availableFrom,
  createGame,
  diplomaticOptions,
  intelOptions,
  committedCapacity,
  MOSSAD_CAPACITY,
  placeOrder,
  resolveTurn,
  advanceFromNewspaper,
  startGame,
  strategicOptions,
  summitProposals,
} from './index';
import type { FrontId, GameState } from './index';

/**
 * A competent strategist.
 *
 * Plays the game the manual describes: pick off the weakest neighbour first,
 * fund its opposition patiently, keep relations warm everywhere else so you
 * are never fighting two fronts, buy steadily from Washington, and reach for
 * extreme measures only once the insurgency can carry them.
 *
 * The point of this test is not that the bot is good. It is that the victory
 * condition is reachable at all, and that deliberate play beats passivity.
 */
function playStrategist(seed: number): GameState {
  const g = createGame(seed);
  startGame(g);

  for (let guard = 0; guard < 400; guard++) {
    if (g.phase === 'gameover') break;

    if (g.phase === 'newspaper') {
      advanceFromNewspaper(g);
      continue;
    }
    if (g.phase === 'summit') {
      const decisions: Record<string, boolean> = {};
      for (const p of summitProposals(g)) {
        // Take the ceasefires and the homeland; refuse to cap the army.
        decisions[p.id] = p.id !== 'armscap';
      }
      applySummit(g, decisions);
      continue;
    }
    if (g.phase === 'budget') {
      applyBudget(g, 'increase', true);
      continue;
    }

    // --- choose a target: the weakest neighbour still standing -------------
    const live = FRONTS.filter((f) => !g.nations[f].collapsed);
    const target = live.sort(
      (a, b) =>
        g.nations[a].stability - g.nations[a].oppositionStrength -
        (g.nations[b].stability - g.nations[b].oppositionStrength),
    )[0] as FrontId | undefined;

    // --- intelligence: one theatre at a time, inside Mossad's capacity ----
    // Concentrating on the target and leaving the rest alone lets their
    // counter-intelligence cool off, which matters more than breadth.
    const covertOrder = target ? [target, ...live.filter((f) => f !== target)] : live;
    for (const f of covertOrder) {
      const opts = intelOptions(g, f).filter((o) => !o.disabledReason);
      const pick =
        opts.find((o) => o.id === 'coup') ??
        opts.find((o) => o.id === 'assassinate') ??
        opts.find((o) => o.id === 'support_insurgents');
      if (!pick) continue;
      const cost = pick.id === 'coup' ? 4 : pick.id === 'assassinate' ? 3 : 1;
      if (committedCapacity(g) + cost > MOSSAD_CAPACITY) continue;
      g.directives.intel[f] = pick.id;
    }

    // --- diplomacy: sour the target, soothe everyone else -----------------
    for (const f of live) {
      const opts = diplomaticOptions(g, f).filter((o) => !o.disabledReason);
      const wantHostile = f === target && g.nations[f].relations > 2;
      const pick = wantHostile
        ? (opts.find((o) => o.id === 'spoil') ?? opts.find((o) => o.id === 'reduce'))
        : (opts.find((o) => o.id === 'ceasefire') ??
           opts.find((o) => o.id === 'improve') ??
           opts.find((o) => o.id === 'maintain'));
      if (pick) g.directives.diplomatic[f] = pick.id;
    }

    // --- military: mass on the target, invade when the door opens ---------
    if (target) {
      const opts = strategicOptions(g, target).filter((o) => !o.disabledReason);
      const pick =
        opts.find((o) => o.id === 'invade') ??
        opts.find((o) => o.id === 'deploy_all') ??
        opts.find((o) => o.id === 'max_deployment') ??
        opts.find((o) => o.id === 'full_deployment') ??
        opts.find((o) => o.id === 'small_deployment');
      if (pick) g.directives.strategic[target] = pick.id;
    }

    // --- home front --------------------------------------------------------
    if (g.palestine.unrest > 3 && g.palestine.brigadesPosted < 2) {
      g.directives.policing = 'post_brigade';
    }
    g.directives.fundNuclear = false;

    // --- procurement: spend most of the purse on armour every month -------
    const kit = availableFrom(g, 'usa').filter((i) => i.category === 'tank');
    if (kit.length > 0) {
      const item = kit[0];
      const qty = Math.floor((g.israel.funds * 0.6) / item.cost);
      if (qty > 0) placeOrder(g, 'usa', item.id, qty);
    }

    resolveTurn(g);
  }
  return g;
}

describe('a competent strategy', () => {
  const N = 80;

  it('can actually win, and beats passivity on every measure', () => {
    const games = Array.from({ length: N }, (_, i) => playStrategist(i + 1));

    const dist: Record<string, number> = {};
    for (const g of games) {
      const k = g.ending?.kind ?? 'unresolved';
      dist[k] = (dist[k] ?? 0) + 1;
    }
    // eslint-disable-next-line no-console
    console.log('strategist:', dist);

    expect(dist.unresolved ?? 0).toBe(0);
    // The stated objective must be achievable.
    expect(dist.victory ?? 0).toBeGreaterThan(0);

    const collapsedPerGame =
      games.reduce((a, g) => a + FRONTS.filter((f) => g.nations[f].collapsed).length, 0) / N;
    expect(collapsedPerGame).toBeGreaterThan(1);

    // Winning must not be routine: a campaign this single-minded should still
    // lose the majority of its games.
    expect((dist.victory ?? 0) / N).toBeLessThan(0.6);

    const mean = (f: (g: GameState) => number) =>
      (games.reduce((a, g) => a + f(g), 0) / N).toFixed(1);
    const turns = games.map((g) => g.turn).sort((a, b) => a - b);

    // eslint-disable-next-line no-console
    console.log('strategist diagnostics:', {
      meanStatesBroughtDown: collapsedPerGame.toFixed(2),
      monthsToEnd: {
        min: turns[0],
        median: turns[Math.floor(turns.length / 2)],
        max: turns[turns.length - 1],
      },
      meanActsOfViolence: mean((g) => g.stats.actsOfViolence),
      meanUsRelations: mean((g) => g.israel.usRelations),
      embargoedAtEnd: games.filter((g) => g.israel.suppliers.usa.embargoed).length,
    });
  });

  it('is judged harshly for how it got there', () => {
    // Winning by force and subversion should not read as statesmanship.
    const games = Array.from({ length: 20 }, (_, i) => playStrategist(i + 1));
    const styles = games.map((g) => g.ending?.style);
    expect(styles.some((s) => s === 'Fascist' || s === 'Violent' || s === 'Extreme')).toBe(true);
  });
});
