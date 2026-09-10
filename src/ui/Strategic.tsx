import { useState } from 'react';
import type { FrontId, GameState, StrategicDirective } from '../engine';
import {
  FRONTS,
  REGIONAL_NORM,
  assess,
  countOf,
  freeBrigades,
  grade,
  qualityLabel,
  frontActivityLabel,
  frontReport,
  israeliStrength,
  strategicOptions,
} from '../engine';
import { Choices, Panel, Row, WarBar } from './bits';

export function Strategic({
  s,
  setStrategic,
}: {
  s: GameState;
  setStrategic: (id: FrontId, d: StrategicDirective) => void;
}) {
  const [selected, setSelected] = useState<FrontId>('lebanon');
  const front = s.fronts[selected];
  const nation = s.nations[selected];
  // What we believe, not what is true. The difference is the phase.
  const view = assess(s, selected);

  return (
    <div className="grid2">
      <div>
        <Panel
          title="National Command Headquarters"
          right={<span className="mono small">{freeBrigades(s)} brigades free</span>}
        >
          <div className="rows">
            {FRONTS.map((id) => {
              const f = s.fronts[id];
              const n = s.nations[id];
              const queued = s.directives.strategic[id];
              return (
                <button
                  key={id}
                  className={`choice${selected === id ? ' selected' : ''}`}
                  onClick={() => setSelected(id)}
                  style={{ marginBottom: 4 }}
                >
                  <span className="tick">{selected === id ? '▸' : ''}</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <span>
                        {n.name} front
                        {f.atWar ? <span className="pill war"> war m{f.warMonths}</span> : null}
                        {f.demilitarised ? <span className="pill"> U.N. zone</span> : null}
                      </span>
                      <span className="mono small faint">
                        {f.deployed.brigades} bde
                        {queued ? <span className="amber"> ●</span> : null}
                      </span>
                    </span>
                    <span className="why" style={{ fontStyle: 'normal' }}>
                      {f.atWar ? frontReport(f.warProgress) : `The border ${frontActivityLabel(f.enemyActivity)}`}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Panel>

        <Panel title={`${nation.name} border command report`}>
          {front.atWar && (
            <div style={{ marginBottom: 14 }}>
              <div className="kicker">Fortunes of war</div>
              <WarBar progress={front.warProgress} />
              <div className="small dim" style={{ marginTop: 6 }}>
                {frontReport(front.warProgress)}
              </div>
            </div>
          )}
          <div className="rows">
            <Row label="Brigades deployed" value={front.deployed.brigades} />
            <Row
              label="Tanks deployed"
              value={countOf(front.deployed.equipment, 'tank').toLocaleString()}
            />
            <Row
              label="Combat aircraft on station"
              value={countOf(front.deployed.equipment, 'aircraft')}
            />
            <Row
              label="Attack helicopters on station"
              value={countOf(front.deployed.equipment, 'helicopter')}
            />
            <Row
              label="Early warning aircraft on station"
              value={countOf(front.deployed.equipment, 'surveillance')}
            />
            <Row label="SAM batteries" value={countOf(front.deployed.equipment, 'sam')} />
            {countOf(front.deployed.equipment, 'tank') > 0 && (
              <Row
                label="Condition of our armour"
                value={qualityLabel(grade(front.deployed.equipment, 'tank'), REGIONAL_NORM.tank)}
              />
            )}
            <Row
              label="Our combat weight"
              value={Math.round(israeliStrength(s, selected)).toLocaleString()}
            />
            <Row
              label="Assessed opposing weight"
              value={
                nation.collapsed
                  ? '—'
                  : `${Math.round(view.low).toLocaleString()} – ${Math.round(
                      view.high,
                    ).toLocaleString()}`
              }
              tone={
                !nation.collapsed && view.estimate > israeliStrength(s, selected) ? 'red' : 'teal'
              }
            />
          </div>
        </Panel>

        {!nation.collapsed && (
          <Panel
            title="Intelligence assessment"
            right={<span className="mono small faint">{view.confidence}</span>}
          >
            <ul className="advice">
              {view.notes.map((note, i) => (
                <li key={i} className="small">
                  {note}
                </li>
              ))}
            </ul>
            {view.coverage < 0.45 && (
              <p className="small faint" style={{ marginBottom: 0 }}>
                Running agents in {nation.name} would narrow this considerably.
              </p>
            )}
          </Panel>
        )}
      </div>

      <Panel title="Strategic action">
        <Choices
          options={strategicOptions(s, selected)}
          selected={s.directives.strategic[selected]}
          onSelect={(d) => setStrategic(selected, d)}
        />
      </Panel>
    </div>
  );
}
