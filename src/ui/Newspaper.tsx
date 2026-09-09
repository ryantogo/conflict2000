import type { GameState } from '../engine';

export function Newspaper({ s, onContinue }: { s: GameState; onContinue: () => void }) {
  const paper = s.paper;
  if (!paper) return null;

  const stories = paper.headlines.filter((h) => h.weight > 0);
  const filler = paper.headlines.filter((h) => h.weight === 0);
  const [lead, ...rest] = stories;

  return (
    <div className="stack">
      <div className="paper">
        <div className="masthead">{paper.masthead}</div>
        <div className="dateline">
          <span>{paper.dateLine}</span>
          <span>Jerusalem Edition</span>
          <span>Price 4 Shekels</span>
        </div>

        {lead ? (
          <>
            <h1 className="lead">{lead.text}</h1>
            <div className="rule" />
          </>
        ) : (
          <>
            <h1 className="lead">Quiet month across the region</h1>
            <div className="rule" />
          </>
        )}

        {rest.length > 0 && (
          <div className="cols">
            {rest.map((h, i) => (
              <p key={i} className={`story${h.weight < 2 ? ' minor' : ''}`}>
                {h.text}
              </p>
            ))}
          </div>
        )}

        {filler.length > 0 && (
          <div className="briefly">Briefly — {filler.map((f) => f.text).join(' · ')}</div>
        )}
      </div>

      <div className="btn-row end" style={{ maxWidth: 820, margin: '0 auto', width: '100%' }}>
        <button className="btn primary" onClick={onContinue}>
          Good morning, Prime Minister →
        </button>
      </div>
    </div>
  );
}
