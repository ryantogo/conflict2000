import { describe, expect, it } from 'vitest';
import { createGame, previewTurn, setProduction, startGame } from './index';
import type { GameState } from './index';

/**
 * The newspaper stays the interface to consequence. This is not a forecast of
 * what will happen — it is a statement of what has already been committed, all
 * of which a cabinet would know before the month began and none of which the
 * player could see before ending the turn.
 */

function opening(): GameState {
  const g = createGame(1);
  startGame(g);
  return g;
}

const textOf = (g: GameState) => previewTurn(g).map((e) => e.text).join(' | ');

describe('before you go', () => {
  it('says nothing when nothing has been ordered', () => {
    expect(previewTurn(opening())).toHaveLength(0);
  });

  it('adds up what the month has been committed to', () => {
    const g = opening();
    g.directives.intel.syria = 'coup';
    g.directives.powers.usa = 'lobby';
    g.directives.fundNuclear = true;
    setProduction(g, 'line_merkava3', true);

    const treasury = previewTurn(g).find((e) => e.area === 'Treasury')!;
    // 90 for the coup, 40 to lobby Washington, 55 for the bomb, 35 for the line.
    expect(treasury.text).toMatch(/\$220 M committed/);
  });

  it('warns when more has been committed than exists', () => {
    const g = opening();
    g.israel.funds = 10;
    g.directives.intel.syria = 'coup';

    const treasury = previewTurn(g).find((e) => e.area === 'Treasury')!;
    expect(treasury.tone).toBe('bad');
    expect(treasury.text).toMatch(/will not be paid for/);
  });

  it('names the partners an order is about to offend', () => {
    const g = opening();
    // Undertakings to a foreign capital are what the right cannot forgive.
    g.directives.powers.usa = 'concede';

    const coalition = previewTurn(g).find((e) => e.area === 'The coalition')!;
    expect(coalition.text).toMatch(/National Religious Party/);
    // And not the ones who want exactly this.
    expect(coalition.text).not.toMatch(/Meretz/);
  });

  it('names the doves instead when the order is a hawkish one', () => {
    const g = opening();
    g.directives.powers.usa = 'defy';

    const coalition = previewTurn(g).find((e) => e.area === 'The coalition')!;
    expect(coalition.text).toMatch(/Meretz/);
    expect(coalition.text).not.toMatch(/National Religious Party/);
  });

  it('says what an undertaking will take off the menu', () => {
    const g = opening();
    g.directives.powers.france = 'concede';
    expect(textOf(g)).toMatch(/airstrikes and the invasion come off the menu/);
  });

  it('flags an overcommitted Mossad', () => {
    const g = opening();
    g.directives.intel.syria = 'coup';
    g.directives.intel.lebanon = 'collect';

    const mossad = previewTurn(g).find((e) => e.area === 'Mossad')!;
    expect(mossad.tone).toBe('bad');
  });

  it('warns harder about a coup run through a thin network', () => {
    const deep = opening();
    const thin = opening();
    deep.nations.syria.network = 80;
    thin.nations.syria.network = 10;
    deep.directives.intel.syria = 'coup';
    thin.directives.intel.syria = 'coup';

    expect(previewTurn(deep).find((e) => e.area === 'Covert action')!.tone).toBe('warn');
    expect(previewTurn(thin).find((e) => e.area === 'Covert action')!.tone).toBe('bad');
  });

  it('never touches the state it is reporting on', () => {
    const g = opening();
    g.directives.intel.syria = 'coup';
    g.directives.powers.usa = 'concede';
    g.directives.strategic.lebanon = 'invade';
    setProduction(g, 'line_merkava3', true);

    const before = JSON.stringify(g);
    previewTurn(g);
    previewTurn(g);
    // It runs on every render. If it mutated anything, the game would drift
    // every time somebody looked at a screen.
    expect(JSON.stringify(g)).toBe(before);
  });
});
