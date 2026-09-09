import type { GameState, PolicingDirective } from '../engine';
import {
  POSTURE_LABEL,
  mostDangerousThreat,
  policingOptions,
  postureReport,
  unrestLabel,
} from '../engine';
import { Bar, Choices, Panel, Row } from './bits';

export function Domestic({
  s,
  setPolicing,
  setFundNuclear,
}: {
  s: GameState;
  setPolicing: (d: PolicingDirective) => void;
  setFundNuclear: (v: boolean) => void;
}) {
  const p = s.palestine;

  return (
    <div className="grid2">
      <div>
        <Panel title="West Bank policy">
          <div className="rows">
            <Row
              label="Arab unrest"
              value={unrestLabel(p.unrest)}
              tone={p.unrest >= 7 ? 'red' : p.unrest >= 4 ? 'amber' : ''}
            />
            <Row label="Israeli presence" value={p.presence === 'full' ? 'Full policing.' : 'Low profile.'} />
            <Row label="Tactics" value={p.tactics === 'hard' ? 'HARD.' : 'SOFT.'} />
            <Row label="Brigades committed" value={p.brigadesPosted} />
            {p.intifada && <Row label="Status" value="INTIFADA" tone="red" />}
            {p.homelandCreated && <Row label="Status" value="Homeland agreed" tone="teal" />}
          </div>
          <div style={{ marginTop: 12 }}>
            <Bar value={p.unrest * 10} tone={p.unrest >= 6 ? 'red' : undefined} />
          </div>
        </Panel>

        <Panel title="Policing options">
          <Choices
            options={policingOptions(s)}
            selected={s.directives.policing}
            onSelect={setPolicing}
          />
        </Panel>
      </div>

      <div>
        <Panel title="Israeli nuclear program">
          <div className="rows">
            <Row label="Posture" value={POSTURE_LABEL[s.israel.nuclearPosture]} tone="amber" />
            <Row label="Most dangerous threat" value={mostDangerousThreat(s)} />
            <Row label="Devices" value={s.israel.warheads} />
          </div>
          <div style={{ marginTop: 12 }}>
            <Bar value={s.israel.nuclearProgress} />
          </div>
          <ul className="advice" style={{ marginTop: 12 }}>
            {postureReport(s).map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ul>
        </Panel>

        <Panel title="Nuclear policy">
          <Choices
            options={[
              { id: 'fund' as const, label: 'Continue funding — $55 M this month' },
              { id: 'withhold' as const, label: 'Withhold funding' },
            ]}
            selected={s.directives.fundNuclear ? 'fund' : 'withhold'}
            onSelect={(id) => setFundNuclear(id === 'fund')}
          />
        </Panel>
      </div>
    </div>
  );
}
