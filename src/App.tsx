import { useCallback, useState } from 'react';
import type {
  DiplomaticDirective,
  FrontId,
  GameState,
  IntelDirective,
  NationId,
  PolicingDirective,
  StrategicDirective,
  SupplierId,
} from './engine';
import {
  advanceFromNewspaper,
  applyBudget,
  applySummit,
  createGame,
  dateLine,
  freeBrigades,
  placeOrder,
  setProduction,
  prestigeLabel,
  resolveTurn,
  startGame,
  tensionLabel,
  unrestLabel,
} from './engine';
import { Newspaper } from './ui/Newspaper';
import { Planning } from './ui/Planning';
import { Budget, GameOver, Summit, Title } from './ui/Interstitials';

/**
 * The engine mutates a single state object in place, which keeps turn
 * resolution readable. React is told about changes by bumping a version
 * counter rather than by deep-cloning the world every keystroke.
 */
export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [, bump] = useState(0);
  const touch = useCallback(() => bump((v) => v + 1), []);

  const start = () => {
    const g = createGame();
    startGame(g);
    setGame(g);
  };

  const restart = () => {
    setGame(createGame());
  };

  // Dev-only hook: `__conflict.game` is the live state and `__conflict.touch()`
  // re-renders after you poke it. Handy for jumping to a screen from the
  // console; stripped from production builds.
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__conflict = { game, touch };
  }

  const handlers = {
    setDiplomatic: (id: NationId, d: DiplomaticDirective) => {
      if (game.directives.diplomatic[id] === d) delete game.directives.diplomatic[id];
      else game.directives.diplomatic[id] = d;
      touch();
    },
    setIntel: (id: NationId, d: IntelDirective) => {
      if (game.directives.intel[id] === d) delete game.directives.intel[id];
      else game.directives.intel[id] = d;
      touch();
    },
    setStrategic: (id: FrontId, d: StrategicDirective) => {
      if (game.directives.strategic[id] === d) delete game.directives.strategic[id];
      else game.directives.strategic[id] = d;
      touch();
    },
    setPolicing: (d: PolicingDirective) => {
      game.directives.policing = game.directives.policing === d ? 'none' : d;
      touch();
    },
    setFundNuclear: (v: boolean) => {
      game.directives.fundNuclear = v;
      touch();
    },
    order: (supplier: SupplierId, itemId: string, qty: number) => {
      const err = placeOrder(game, supplier, itemId, qty);
      touch();
      return err;
    },
    // A line is standing policy, not a monthly directive: it stays open until
    // it is closed, or until the Treasury cannot pay for it.
    setProductionLine: (lineId: string, running: boolean) => {
      setProduction(game, lineId, running);
      touch();
    },
    endTurn: () => {
      resolveTurn(game);
      touch();
    },
  };

  const onSummit = (decisions: Record<string, boolean>, attended: boolean) => {
    applySummit(game, decisions, attended);
    touch();
  };

  const onBudget = (spending: 'increase' | 'decrease' | 'maintain', growArmy: boolean) => {
    applyBudget(game, spending, growArmy);
    touch();
  };

  if (game.phase === 'title') {
    return (
      <div className="app">
        <main className="main">
          <Title onStart={start} />
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <TopBar s={game} />
      <main className="main">
        {game.phase === 'newspaper' && (
          <Newspaper
            s={game}
            onContinue={() => {
              advanceFromNewspaper(game);
              touch();
            }}
          />
        )}
        {game.phase === 'planning' && <Planning s={game} h={handlers} />}
        {game.phase === 'summit' && <Summit s={game} onDecide={onSummit} />}
        {game.phase === 'budget' && <Budget s={game} onApply={onBudget} />}
        {game.phase === 'gameover' && <GameOver s={game} onRestart={restart} />}
      </main>
    </div>
  );
}

function TopBar({ s }: { s: GameState }) {
  const wars = Object.values(s.fronts).filter((f) => f.atWar).length;

  return (
    <header className="topbar">
      <span className="brand">Conflict 2000</span>
      <span className="date">{dateLine(s.year, s.month)}</span>

      <div className="meters">
        <Meter k="Prestige" v={prestigeLabel(s.israel.prestige)} />
        <Meter
          k="Tension"
          v={tensionLabel(s.tension)}
          tone={s.tension > 70 ? 'bad' : s.tension > 50 ? 'warn' : ''}
        />
        <Meter
          k="West Bank"
          v={unrestLabel(s.palestine.unrest)}
          tone={s.palestine.unrest >= 7 ? 'bad' : s.palestine.unrest >= 4 ? 'warn' : ''}
        />
        <Meter
          k="U.S."
          v={
            s.israel.suppliers.usa.embargoed
              ? 'EMBARGO'
              : s.israel.usRelations >= 70
                ? 'Excellent'
                : s.israel.usRelations >= 50
                  ? 'Good'
                  : s.israel.usRelations >= 30
                    ? 'Poor'
                    : 'Sour'
          }
          tone={s.israel.suppliers.usa.embargoed || s.israel.usRelations < 30 ? 'bad' : ''}
        />
        <Meter k="Funds" v={`$${Math.round(s.israel.funds)}M`} />
        <Meter k="Free bde" v={`${freeBrigades(s)}/${s.israel.brigades}`} />
        {wars > 0 && <Meter k="Fronts at war" v={String(wars)} tone="bad" />}
      </div>
    </header>
  );
}

function Meter({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div className="meter">
      <span className="k">{k}</span>
      <span className={`v ${tone ?? ''}`}>{v}</span>
    </div>
  );
}
