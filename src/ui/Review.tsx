import type { GameState } from '../engine';
import {
  FRONTS,
  countOf,
  emptyFleet,
  freeBrigades,
  frontActivityLabel,
  frontReport,
  mergeInto,
} from '../engine';
import { Panel, Row, WarBar } from './bits';

export function Review({ s }: { s: GameState }) {
  const isr = s.israel;

  // What is standing on the borders, added up across all four fronts.
  const forwardBrigades = FRONTS.reduce((a, id) => a + s.fronts[id].deployed.brigades, 0);
  const forward = emptyFleet();
  for (const id of FRONTS) mergeInto(forward, s.fronts[id].deployed.equipment);
  const stock = isr.stockpile.equipment;

  return (
    <div className="grid2">
      <Panel title="Battlefield forces undeployed">
        <div className="rows">
          <Row label="Brigades free" value={`${freeBrigades(s)} of ${isr.brigades}`} />
          <Row label="Reserves" value={`${isr.reserves} thousand`} tone={isr.reserves < 100 ? 'red' : ''} />
          <Row label="Tanks in reserve" value={countOf(stock, 'tank').toLocaleString()} />
          <Row
            label="Combat aircraft in reserve"
            value={countOf(stock, 'aircraft').toLocaleString()}
          />
          <Row
            label="Attack helicopters in reserve"
            value={countOf(stock, 'helicopter').toLocaleString()}
          />
          <Row label="Early warning aircraft" value={countOf(stock, 'surveillance')} />
          <Row label="SAM batteries in reserve" value={countOf(stock, 'sam')} />
          <Row label="Nuclear devices" value={isr.warheads} tone="amber" />
        </div>

        <div className="kicker" style={{ marginTop: 18 }}>
          Committed to the borders
        </div>
        <div className="rows">
          <Row label="Brigades deployed" value={forwardBrigades} />
          <Row label="Tanks deployed" value={countOf(forward, 'tank').toLocaleString()} />
          <Row
            label="Combat aircraft on station"
            value={countOf(forward, 'aircraft').toLocaleString()}
          />
          <Row
            label="Attack helicopters on station"
            value={countOf(forward, 'helicopter').toLocaleString()}
          />
          <Row label="Early warning aircraft on station" value={countOf(forward, 'surveillance')} />
          <Row label="SAM batteries deployed" value={countOf(forward, 'sam')} />
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
                    {f.deployed.brigades} bde ·{' '}
                    {countOf(f.deployed.equipment, 'tank').toLocaleString()} tk ·{' '}
                    {countOf(f.deployed.equipment, 'aircraft')} ac ·{' '}
                    {countOf(f.deployed.equipment, 'helicopter')} hel ·{' '}
                    {countOf(f.deployed.equipment, 'surveillance')} awc ·{' '}
                    {countOf(f.deployed.equipment, 'sam')} sam
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
