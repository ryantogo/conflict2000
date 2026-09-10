import { useState } from 'react';
import type { GameState } from '../engine';
import { budgetOffer, qualityPhrase, summitProposals } from '../engine';
import { Panel, Row } from './bits';

// ---------------------------------------------------------------------- title

export function Title({ onStart }: { onStart: () => void }) {
  return (
    <div className="title-screen">
      <div className="kicker">Virgin Mastertronic, 1990 — after a fashion</div>
      <h1>CONFLICT</h1>
      <p className="sub">The Middle East Political Simulator · June 2000</p>

      <blockquote className="epigraph">
        History has proven to be a predictable round of cycles or pendula: economic
        growth, decline, stagnation, war, recovery, growth … Idealists dream that man
        can change, and break from this vortex; that war may be abolished simply by
        goodwill.
      </blockquote>

      <p className="small faint" style={{ maxWidth: 560 }}>
        You are Prime Minister of Israel. The security zone in Lebanon was abandoned
        three weeks ago. Hafez al-Assad is dying. The Americans want everyone at Camp
        David in July. Each turn is one month.
      </p>

      <button className="btn primary" onClick={onStart}>
        Take office
      </button>
    </div>
  );
}

// --------------------------------------------------------------------- summit

export function Summit({
  s,
  onDecide,
}: {
  s: GameState;
  onDecide: (decisions: Record<string, boolean>, attended: boolean) => void;
}) {
  const proposals = summitProposals(s);
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [attending, setAttending] = useState<boolean | null>(null);

  const isCampDavid = s.year === 2000;

  if (attending === null) {
    return (
      <div className="stack" style={{ maxWidth: 700, margin: '0 auto' }}>
        <Panel title={isCampDavid ? 'Camp David' : 'Middle Eastern summit'}>
          <p className="dim">
            {isCampDavid
              ? 'The President has convened a summit at Camp David. Sixteen days have ' +
                'been set aside. Arafat has said he is not ready. The Americans are ' +
                'insisting anyway.'
              : 'Called by the United Nations Security Council in response to the state ' +
                'of the region.'}
          </p>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn primary" onClick={() => setAttending(true)}>
              Israel shall attend
            </button>
            <button className="btn" onClick={() => setAttending(false)}>
              Israel shall not attend
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  if (!attending) {
    return (
      <div className="stack" style={{ maxWidth: 700, margin: '0 auto' }}>
        <Panel title="Summit — Israel absent">
          <p className="dim">
            The delegations met without you. Nothing was agreed, and the absence was
            noted in every capital that matters.
          </p>
          <div className="btn-row end">
            <button className="btn primary" onClick={() => onDecide({}, false)}>
              Continue
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="stack" style={{ maxWidth: 700, margin: '0 auto' }}>
        <Panel title="Summit">
          <p className="dim">
            The summit produced photographs and a communiqué. There was nothing on the
            table that required an Israeli signature.
          </p>
          <div className="btn-row end">
            <button className="btn primary" onClick={() => onDecide({}, true)}>
              Continue
            </button>
          </div>
        </Panel>
      </div>
    );
  }

  const allAnswered = proposals.every((p) => p.id in decisions);

  return (
    <div className="stack" style={{ maxWidth: 760, margin: '0 auto' }}>
      {proposals.map((p) => (
        <Panel key={p.id} title={p.title}>
          <p className="dim" style={{ marginTop: 0 }}>
            {p.body}
          </p>
          <div className="btn-row">
            <button
              className={`btn${decisions[p.id] === true ? ' primary' : ''}`}
              onClick={() => setDecisions({ ...decisions, [p.id]: true })}
            >
              {p.acceptLabel}
            </button>
            <button
              className={`btn${decisions[p.id] === false ? ' danger' : ''}`}
              onClick={() => setDecisions({ ...decisions, [p.id]: false })}
            >
              {p.rejectLabel}
            </button>
          </div>
        </Panel>
      ))}

      <div className="btn-row end">
        <button className="btn primary" disabled={!allAnswered} onClick={() => onDecide(decisions, true)}>
          Conclude summit →
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------- budget

export function Budget({
  s,
  onApply,
}: {
  s: GameState;
  onApply: (spending: 'increase' | 'decrease' | 'maintain', growArmy: boolean) => void;
}) {
  const offer = budgetOffer(s);
  const [spending, setSpending] = useState<'increase' | 'decrease' | 'maintain'>('maintain');
  const [growArmy, setGrowArmy] = useState(false);

  return (
    <div className="stack" style={{ maxWidth: 720, margin: '0 auto' }}>
      <Panel title="Defense budget meeting">
        <p className="dim" style={{ marginTop: 0 }}>
          {offer.aidRefused
            ? 'The U.S. have refused to give us any financial aid.'
            : `The U.S. have given a financial aid package worth $${offer.aid} million.`}
        </p>
        <div className="rows">
          <Row label="Present defense budget" value={`$${s.israel.defenceBudget} million`} />
          <Row label="Percentage of G.N.P. on defense" value={`${s.israel.gnpPercent}%`} />
        </div>
      </Panel>

      <Panel title="Spending increase">
        <p className="small faint" style={{ marginTop: 0 }}>
          The defense budget may be changed by 20%, but an increase may put a strain on
          the economy.
        </p>
        <div className="choices">
          {(
            [
              ['increase', 'Increase defence spending'],
              ['decrease', 'Decrease defence spending'],
              ['maintain', 'Maintain current level'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              className={`choice${spending === id ? ' selected' : ''}`}
              onClick={() => setSpending(id)}
            >
              <span className="tick">{spending === id ? '▸' : ''}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title="Army size">
        <p className="small faint" style={{ marginTop: 0 }}>
          We are able to build our army size by 2 brigades — or 40,000 combat soldiers.
          This may be viewed as aggressive by the U.S.
        </p>
        {offer.armyCapped ? (
          <p className="small red">
            Israel gave an undertaking at the summit not to expand the army this year.
          </p>
        ) : (
          <div className="choices">
            <button
              className={`choice${growArmy ? ' selected' : ''}`}
              onClick={() => setGrowArmy(true)}
            >
              <span className="tick">{growArmy ? '▸' : ''}</span>
              <span>Increase size of army</span>
            </button>
            <button
              className={`choice${!growArmy ? ' selected' : ''}`}
              onClick={() => setGrowArmy(false)}
            >
              <span className="tick">{!growArmy ? '▸' : ''}</span>
              <span>Maintain current size</span>
            </button>
          </div>
        )}
      </Panel>

      <div className="btn-row end">
        <button
          className="btn primary"
          onClick={() => onApply(spending, growArmy && offer.canGrowArmy)}
        >
          Approve budget →
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------- gameover

export function GameOver({ s, onRestart }: { s: GameState; onRestart: () => void }) {
  const e = s.ending;
  if (!e) return null;

  return (
    <div className="analysis center">
      <div className="kicker">{e.kind === 'victory' ? 'Well done, Prime Minister' : 'Game over'}</div>
      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 30, margin: '6px 0 20px' }}>
        {e.headline}
      </h2>

      <Panel title="Leadership analysis">
        <p style={{ marginTop: 0 }}>
          Your leadership was <strong className="amber">{qualityPhrase(e.score)}</strong>
        </p>
        <div className="score">{e.score}</div>
        <div className="kicker">Analysis score</div>

        <ul>
          {e.analysis.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="The end of the game...">
        <p style={{ fontFamily: 'var(--serif)', fontSize: 17, margin: 0 }}>{e.body}</p>
      </Panel>

      <div className="btn-row" style={{ justifyContent: 'center', marginTop: 22 }}>
        <button className="btn primary" onClick={onRestart}>
          New Conflict
        </button>
      </div>
    </div>
  );
}
