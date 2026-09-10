import type { GameState, PolicingDirective } from '../engine';
import {
  MAJORITY,
  POSTURE_LABEL,
  coalitionReport,
  coalitionSeats,
  mostDangerousThreat,
  policingOptions,
  postureReport,
  unrestLabel,
} from '../engine';
import { Bar, Choices, Panel, Row } from './bits';

/** Where a partner stands, as a word. */
function standingLabel(v: number): string {
  if (v >= 70) return 'Solid';
  if (v >= 50) return 'Content';
  if (v >= 38) return 'Restless';
  if (v >= 25) return 'On the brink';
  return 'Gone in all but name';
}

/**
 * The arithmetic of staying in office. Popularity is what the country thinks;
 * this is whether you can still pass anything.
 */
function Coalition({ s }: { s: GameState }) {
  const partners = coalitionReport(s);
  const seats = coalitionSeats(s);
  const majority = seats >= MAJORITY;
  const inGovernment = partners.filter((p) => p.inCoalition);
  const outside = partners.filter((p) => !p.inCoalition);

  return (
    <Panel
      title="The coalition"
      right={
        <span className={`mono small ${majority ? '' : 'red'}`}>
          {seats} of 120
        </span>
      }
    >
      <p className="small dim" style={{ marginTop: 0 }}>
        {majority
          ? `A majority of ${seats}. ${MAJORITY} seats are needed to govern.`
          : `No majority. ${MAJORITY - seats} seats short, and every month is a ` +
            'motion of no confidence waiting to be tabled.'}
      </p>

      <div className="rows">
        {inGovernment.map((p) => (
          <Row
            key={p.id}
            label={`${p.name} · ${p.seats}`}
            value={standingLabel(p.satisfaction)}
            tone={p.satisfaction < 32 ? 'red' : p.satisfaction < 45 ? 'amber' : ''}
          />
        ))}
      </div>

      {outside.length > 0 && (
        <>
          <div className="kicker" style={{ marginTop: 16 }}>
            Out of government
          </div>
          <div className="rows">
            {outside.map((p) => (
              <Row
                key={p.id}
                label={`${p.name} · ${p.seats}`}
                value={standingLabel(p.satisfaction)}
                tone="amber"
              />
            ))}
          </div>
        </>
      )}

      <ul className="advice" style={{ marginTop: 14 }}>
        {partners
          .filter((p) => p.inCoalition && p.satisfaction < 38 && !p.ownParty)
          .map((p) => (
            <li key={p.id} className="small">
              {p.name}: {p.character}
            </li>
          ))}
      </ul>
    </Panel>
  );
}

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
        <Coalition s={s} />

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
