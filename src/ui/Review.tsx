import type { GameState } from '../engine';
import type { ArmsCategory, Fleet } from '../engine';
import {
  FRONTS,
  REGIONAL_NORM,
  breakdown,
  countOf,
  emptyFleet,
  freeBrigades,
  frontActivityLabel,
  frontReport,
  grade,
  mergeInto,
  qualityLabel,
} from '../engine';
import { Panel, Row, WarBar } from './bits';

/** One arm of a force: what it is, how much of it, and how good it is. */
function Arm({ title, fleet, cat }: { title: string; fleet: Fleet; cat: ArmsCategory }) {
  const types = breakdown(fleet, cat);
  const total = countOf(fleet, cat);

  return (
    <>
      <div className="kicker" style={{ marginTop: 16 }}>
        {title} — {total.toLocaleString()}
        {total > 0 ? ` · ${qualityLabel(grade(fleet, cat), REGIONAL_NORM[cat])}` : ''}
      </div>
      {types.length === 0 ? (
        <p className="small faint" style={{ margin: '6px 0 0' }}>
          None held.
        </p>
      ) : (
        <div className="rows">
          {types.map((t) => (
            <Row key={t.id} label={t.name} value={t.count.toLocaleString()} />
          ))}
        </div>
      )}
    </>
  );
}

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
          <Row label="Nuclear devices" value={isr.warheads} tone="amber" />
        </div>

        <Arm title="Armour in reserve" fleet={stock} cat="tank" />
        <Arm title="Combat aircraft in reserve" fleet={stock} cat="aircraft" />
        <Arm title="Attack helicopters in reserve" fleet={stock} cat="helicopter" />
        <Arm title="Early warning aircraft" fleet={stock} cat="surveillance" />
        <Arm title="Air defence in reserve" fleet={stock} cat="sam" />

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
