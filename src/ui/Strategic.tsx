import { useState } from 'react';
import type {
  FactionDirective,
  FrontId,
  GameState,
  IncidentResponse,
  RemoteDirective,
  RemoteId,
  StrategicDirective,
} from '../engine';
import {
  FRONTS,
  INCIDENT_TITLE,
  responseOptions,
  REACH,
  REGIONAL_NORM,
  REMOTE_IDS,
  assess,
  countOf,
  freeBrigades,
  grade,
  longRangeCount,
  qualityLabel,
  frontActivityLabel,
  frontReport,
  israeliStrength,
  relationsLabel,
  remoteStrikeOptions,
  strategicOptions,
} from '../engine';
import type { SubTabItem } from './bits';
import { Choices, Panel, Row, SubTabs, WarBar } from './bits';
import { Militias, Succession } from './Militias';
import { HINTS } from '../data/hints';

type FrontView = 'forces' | 'intelligence';

const FRONT_VIEWS: SubTabItem<FrontView>[] = [
  {
    id: 'forces',
    label: 'Our forces',
    legend: 'What is standing on this border, and what condition it is in.',
  },
  {
    id: 'intelligence',
    label: 'Assessment',
    legend: 'What we believe is on the other side, and how much of it we can actually see.',
  },
];

const INCIDENT_BODY: Record<string, string> = {
  rockets:
    'A salvo of Katyushas on the Galilee panhandle. Nobody killed this time. Beirut says it ' +
    'knew nothing about it, and very probably did not.',
  ambush:
    'An IDF patrol hit by a roadside bomb and small-arms fire on the Blue Line. There are ' +
    'dead, and the families are already on the radio.',
  abduction:
    'Soldiers taken across the border in a raid. Hezbollah wants prisoners for them, and ' +
    'the country wants them home.',
};

/**
 * An attack on the northern border, waiting on the cabinet. Every answer is
 * paid for at home, in the region and in the West, never in the same coin.
 */
function Incidents({
  s,
  setResponse,
}: {
  s: GameState;
  setResponse: (id: string, r: IncidentResponse) => void;
}) {
  if (s.incidents.length === 0) return null;
  return (
    <>
      {s.incidents.map((incident) => (
        <Panel key={incident.id} title={`Incident on the northern border — ${INCIDENT_TITLE[incident.kind]}`}>
          <p className="small dim" style={{ marginTop: 0 }}>
            {INCIDENT_BODY[incident.kind]} Tehran’s hand is on it. The cabinet has to answer, and
            saying nothing is an answer the country will hear.
          </p>
          <Choices
            options={responseOptions(s, incident)}
            selected={s.directives.incidentResponse[incident.id]}
            onSelect={(r) => setResponse(incident.id, r)}
          />
        </Panel>
      ))}
    </>
  );
}

/**
 * Iraq, Iran and Libya. No border, no army to mass against, and nothing on
 * the menu except what an air force with enough range can do.
 */
function BeyondTheBorders({
  s,
  setRemote,
}: {
  s: GameState;
  setRemote: (id: RemoteId, d: RemoteDirective) => void;
}) {
  const [selected, setSelected] = useState<RemoteId>('iraq');
  const n = s.nations[selected];

  return (
    <Panel
      title="Beyond our borders"
      right={
        <span className="mono small">
          {longRangeCount(s.israel.stockpile.equipment)} long-range aircraft
        </span>
      }
    >
      <div className="choices">
        {REMOTE_IDS.map((id) => {
          const target = s.nations[id];
          return (
            <button
              key={id}
              className={`choice${selected === id ? ' selected' : ''}`}
              onClick={() => setSelected(id)}
            >
              <span className="tick">{selected === id ? '▸' : ''}</span>
              <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>{target.name}</span>
                <span className="mono small faint">
                  {target.collapsed ? 'collapsed' : relationsLabel(target.relations)}
                  {s.directives.remote[id] ? <span className="amber"> ●</span> : null}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="small faint" style={{ margin: '10px 0' }}>
        A raid on {n.capital} needs {REACH[selected].need} long-range strike aircraft and
        crosses {s.nations[REACH[selected].overflight].name}’s airspace. {REACH[selected].answer}
      </p>
      <Choices
        options={remoteStrikeOptions(s, selected)}
        selected={s.directives.remote[selected]}
        onSelect={(d) => setRemote(selected, d)}
      />
    </Panel>
  );
}

export function Strategic({
  s,
  setStrategic,
  setRemote,
  setFaction,
  setIncidentResponse,
}: {
  s: GameState;
  setStrategic: (id: FrontId, d: StrategicDirective) => void;
  setRemote: (id: RemoteId, d: RemoteDirective) => void;
  setFaction: (id: string, d: FactionDirective) => void;
  setIncidentResponse: (id: string, r: IncidentResponse) => void;
}) {
  const [selected, setSelected] = useState<FrontId>('lebanon');
  const [view, setView] = useState<FrontView>('forces');
  const front = s.fronts[selected];
  const nation = s.nations[selected];
  // What we believe, not what is true. The difference is the phase.
  const assessment = assess(s, selected);

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

        <SubTabs items={FRONT_VIEWS} selected={view} onSelect={setView} />

        {view === 'forces' && (
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
                hint={HINTS.armourCondition}
                value={qualityLabel(grade(front.deployed.equipment, 'tank'), REGIONAL_NORM.tank)}
              />
            )}
            <Row
              label="Our combat weight"
              value={Math.round(israeliStrength(s, selected)).toLocaleString()}
              hint={HINTS.combatWeight}
            />
            <Row
              label="Assessed opposing weight"
              hint={HINTS.assessedWeight}
              value={
                nation.collapsed
                  ? '—'
                  : `${Math.round(assessment.low).toLocaleString()} – ${Math.round(
                      assessment.high,
                    ).toLocaleString()}`
              }
              tone={
                !nation.collapsed && assessment.estimate > israeliStrength(s, selected) ? 'red' : 'teal'
              }
              />
            </div>
          </Panel>
        )}

        {view === 'intelligence' && !nation.collapsed && (
          <Panel
            title="Intelligence assessment"
            right={<span className="mono small faint">{assessment.confidence}</span>}
          >
            <ul className="advice">
              {assessment.notes.map((note, i) => (
                <li key={i} className="small">
                  {note}
                </li>
              ))}
            </ul>
            {assessment.coverage < 0.45 && (
              <p className="small faint" style={{ marginBottom: 0 }}>
                Running agents in {nation.name} would narrow this considerably.
              </p>
            )}
          </Panel>
        )}
      </div>

      <div>
        <Incidents s={s} setResponse={setIncidentResponse} />

        <Succession s={s} nation={selected} setFaction={setFaction} />

        <Militias
          s={s}
          home={selected}
          setFaction={setFaction}
          title="Armed groups on this border"
        />

        <Panel title="Strategic action">
          <Choices
            options={strategicOptions(s, selected)}
            selected={s.directives.strategic[selected]}
            onSelect={(d) => setStrategic(selected, d)}
          />
        </Panel>

        <BeyondTheBorders s={s} setRemote={setRemote} />
      </div>
    </div>
  );
}
