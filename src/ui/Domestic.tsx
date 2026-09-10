import type { AppeaseAction, FactionDirective, GameState, PolicingDirective } from '../engine';
import {
  MAJORITY,
  standingLabel,
  POSTURE_LABEL,
  FINAL_STATUS_LABEL,
  appeaseOptions,
  coalitionReport,
  coalitionSeats,
  electionAvailable,
  electionOutlook,
  pendingCabinetEvent,
  mostDangerousThreat,
  policingOptions,
  postureReport,
  unrestLabel,
} from '../engine';
import { useState } from 'react';
import type { SubTabItem } from './bits';
import { Bar, Choices, Panel, Row, SubTabs } from './bits';
import { HINTS } from '../data/hints';

type HomeView = 'coalition' | 'territories' | 'nuclear';

const HOME_VIEWS: SubTabItem<HomeView>[] = [
  {
    id: 'coalition',
    label: 'The coalition',
    legend: 'Whether you can still pass anything, which is not the same as whether you are liked.',
  },
  {
    id: 'territories',
    label: 'The territories',
    legend: 'Unrest, the groups driving it, and how hard we police.',
  },
  {
    id: 'nuclear',
    label: 'Nuclear',
    legend: 'The programme, the posture, and what each rung of it costs in Washington.',
  },
];
import { Militias } from './Militias';


export interface CabinetHandlers {
  setCabinetChoice: (id: string) => void;
  setAppease: (party: string, action: AppeaseAction) => void;
  setElection: (v: boolean) => void;
}

/** The question in front of the cabinet this month, if there is one. */
function BeforeTheCabinet({ s, h }: { s: GameState; h: CabinetHandlers }) {
  const ev = pendingCabinetEvent(s);
  if (!ev) return null;
  return (
    <Panel title={`Before the cabinet — ${ev.title}`}>
      <p className="small dim" style={{ marginTop: 0 }}>
        {ev.body}
      </p>
      <Choices
        options={ev.choices.map((c) => ({ id: c.id, label: c.label, detail: c.detail }))}
        selected={s.directives.cabinetChoice ?? undefined}
        onSelect={h.setCabinetChoice}
      />
      <p className="small faint" style={{ marginBottom: 0 }}>
        If the cabinet does not decide, it will be decided for us — and the country will
        notice that we did not.
      </p>
    </Panel>
  );
}

/**
 * Keeping the coalition together is not only a matter of not offending it.
 * One favour a month, for one party, and every favour is noticed by somebody.
 */
function KeepingTheCoalition({ s, h }: { s: GameState; h: CabinetHandlers }) {
  const parties = coalitionReport(s).filter((p) => !p.ownParty);
  const [picked, setPicked] = useState<string>(parties[0]?.id ?? '');
  const party = parties.find((p) => p.id === picked) ?? parties[0];
  const queued = s.directives.appease;

  return (
    <Panel title="Keeping the coalition">
      <div className="choices" style={{ marginBottom: 10 }}>
        {parties.map((p) => (
          <button
            key={p.id}
            className={`choice${party?.id === p.id ? ' selected' : ''}`}
            onClick={() => setPicked(p.id)}
          >
            <span className="tick">{party?.id === p.id ? '▸' : ''}</span>
            <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span>
                {p.name} · {p.seats}
                {!p.inCoalition ? <span className="pill"> {p.courtable ? 'opposition' : 'outside'}</span> : null}
                {queued?.party === p.id ? <span className="amber"> ●</span> : null}
              </span>
              <span className="mono small faint">{standingLabel(p.satisfaction)}</span>
            </span>
          </button>
        ))}
      </div>
      {party && (
        <Choices
          options={appeaseOptions(s, party.id)}
          selected={queued?.party === party.id ? queued.action : undefined}
          onSelect={(a) => h.setAppease(party.id, a)}
        />
      )}
      {electionAvailable(s) && (
        <div style={{ marginTop: 14 }}>
          <div className="kicker">Go to the country</div>
          <Choices
            options={[
              {
                id: 'call' as const,
                label: 'Call early elections',
                detail: `${electionOutlook(s)} Win, and the arithmetic is redone from the result; lose, and it is over.`,
              },
            ]}
            selected={s.directives.callElection ? 'call' : undefined}
            onSelect={() => h.setElection(!s.directives.callElection)}
          />
        </div>
      )}
    </Panel>
  );
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
            hint={HINTS.partnerStanding}
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
  setFaction,
  cabinet,
}: {
  s: GameState;
  setPolicing: (d: PolicingDirective) => void;
  setFundNuclear: (v: boolean) => void;
  setFaction: (id: string, d: FactionDirective) => void;
  cabinet: CabinetHandlers;
}) {
  const p = s.palestine;
  const [view, setView] = useState<HomeView>('coalition');

  return (
    <div>
      <SubTabs
        items={HOME_VIEWS.map((v) =>
          v.id === 'coalition' ? { ...v, dot: !!s.cabinet.pending } : v,
        )}
        selected={view}
        onSelect={setView}
      />

      <div className="grid2">
        {view === 'coalition' && <Coalition s={s} />}
        {view === 'coalition' && (
          <div>
            <BeforeTheCabinet s={s} h={cabinet} />
            <KeepingTheCoalition s={s} h={cabinet} />
          </div>
        )}

        {view === 'territories' && (
          <Militias
            s={s}
            home="territories"
            setFaction={setFaction}
            title="Armed groups in the territories"
          />
        )}

        {view === 'territories' && (
          <Panel title="West Bank policy">
          <div className="rows">
            <Row
              label="Arab unrest"
              value={unrestLabel(p.unrest)}
              hint={HINTS.unrest}
              tone={p.unrest >= 7 ? 'red' : p.unrest >= 4 ? 'amber' : ''}
            />
            <Row label="Israeli presence" value={p.presence === 'full' ? 'Full policing.' : 'Low profile.'} />
            <Row label="Tactics" value={p.tactics === 'hard' ? 'HARD.' : 'SOFT.'} />
            <Row label="Brigades committed" value={p.brigadesPosted} />
            <Row
              label="Final status"
              value={FINAL_STATUS_LABEL[p.finalStatus]}
              tone={p.finalStatus === 'agreed' ? 'teal' : p.finalStatus === 'none' ? '' : 'amber'}
            />
            {p.intifada && <Row label="Status" value="INTIFADA" tone="red" />}
            {p.homelandCreated && <Row label="Status" value="Homeland agreed" tone="teal" />}
          </div>
            <div style={{ marginTop: 12 }}>
              <Bar value={p.unrest * 10} tone={p.unrest >= 6 ? 'red' : undefined} />
            </div>
          </Panel>
        )}

        {view === 'territories' && (
          <Panel title="Policing options">
            <Choices
              options={policingOptions(s)}
              selected={s.directives.policing}
              onSelect={setPolicing}
            />
          </Panel>
        )}

        {view === 'nuclear' && (
          <Panel title="Israeli nuclear program">
          <div className="rows">
            <Row
              label="Posture"
              value={POSTURE_LABEL[s.israel.nuclearPosture]}
              tone="amber"
              hint={HINTS.nuclearPosture}
            />
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
        )}

        {view === 'nuclear' && (
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
        )}
      </div>
    </div>
  );
}
