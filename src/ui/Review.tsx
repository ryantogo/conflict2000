import type { GameState } from '../engine';
import { FRONTS, freeBrigades, frontActivityLabel, frontReport } from '../engine';
import { Panel, Row, WarBar } from './bits';

export function Review({ s }: { s: GameState }) {
  const isr = s.israel;

  return (
    <div className="grid2">
      <Panel title="Battlefield forces undeployed">
        <div className="rows">
          <Row label="Brigades free" value={`${freeBrigades(s)} of ${isr.brigades}`} />
          <Row label="Reserves" value={`${isr.reserves} thousand`} tone={isr.reserves < 100 ? 'red' : ''} />
          <Row label="Tanks in reserve" value={isr.stockpile.tanks.toLocaleString()} />
          <Row label="Aircraft in reserve" value={isr.stockpile.aircraft.toLocaleString()} />
          <Row label="SAM batteries in reserve" value={isr.stockpile.sam} />
          <Row label="Nuclear devices" value={isr.warheads} tone="amber" />
        </div>

        <div className="kicker" style={{ marginTop: 18 }}>
          Arms deals
        </div>
        <div className="rows">
          <Row label="Agreements signed" value={s.stats.armsAgreements} />
          <Row
            label="Total expenditure"
            value={`$${s.stats.armsExpenditure.toLocaleString()} M`}
          />
        </div>
      </Panel>

      <Panel title="Front line">
        <div className="stack">
          {FRONTS.map((id) => {
            const f = s.fronts[id];
            const n = s.nations[id];
            return (
              <div key={id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>{n.name}</strong>
                  <span className="mono small faint">
                    {f.deployed.brigades} bde · {f.deployed.tanks.toLocaleString()} tk ·{' '}
                    {f.deployed.aircraft} ac
                  </span>
                </div>
                <div className="small dim" style={{ marginBottom: 6 }}>
                  {f.atWar
                    ? `At war — month ${f.warMonths}. ${frontReport(f.warProgress)}`
                    : `The border ${frontActivityLabel(f.enemyActivity)}`}
                </div>
                {f.atWar && <WarBar progress={f.warProgress} />}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
