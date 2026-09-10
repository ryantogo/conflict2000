import { useState } from 'react';
import type { FrontId, GameState, NationId, RemoteId } from '../engine';
import {
  MOSSAD_CAPACITY,
  NATION_IDS,
  occupationLabel,
  occupations,
  REACH,
  REMOTE_IDS,
  remoteStrikeOptions,
  committedCapacity,
  diplomaticOptions,
  frontActivityLabel,
  intelOptions,
  oppositionLabel,
  policingOptions,
  relationsLabel,
  stabilityLabel,
  strategicOptions,
  unrestLabel,
} from '../engine';
import { OFF_MAP } from '../data/geography';
import type { ViewId } from '../data/geography';
import { Choices, Panel, Row, WarBar } from './bits';
import { RegionalMap } from './RegionalMap';
import type { MapMode } from './RegionalMap';
import type { PlanningHandlers } from './Planning';

const MODES: { id: MapMode; label: string; legend: string }[] = [
  { id: 'relations', label: 'Relations', legend: 'Hostile → friendly, on the ten-step ladder.' },
  { id: 'stability', label: 'Stability', legend: 'How firmly each government holds its own state.' },
  { id: 'military', label: 'Forces', legend: 'Standing army, relative to the largest in the region.' },
];

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'region', label: 'Region' },
  { id: 'levant', label: 'Levant' },
];

const FRONT_IDS: FrontId[] = ['egypt', 'jordan', 'lebanon', 'syria'];

function isFront(id: NationId | 'israel'): id is FrontId {
  return (FRONT_IDS as string[]).includes(id);
}

function isRemote(id: NationId | 'israel'): id is RemoteId {
  return (REMOTE_IDS as string[]).includes(id);
}

export function MapRoom({ s, h }: { s: GameState; h: PlanningHandlers }) {
  const [mode, setMode] = useState<MapMode>('relations');
  const [view, setView] = useState<ViewId>('region');
  const [selected, setSelected] = useState<NationId | 'israel'>('syria');

  return (
    <div className="maproom">
      <div className="mapcol">
        <div className="map-modes" role="tablist">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={`tab${mode === m.id ? ' active' : ''}`}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          {/* Two switchers in one toolbar used to use two different idioms —
              a tab strip for the mode and filled buttons for the scope. */}
          <span className="map-scope" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                role="tab"
                aria-selected={view === v.id}
                className={`tab${view === v.id ? ' active' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </span>
        </div>

        <p className="map-legend">{MODES.find((m) => m.id === mode)!.legend}</p>

        <RegionalMap s={s} mode={mode} view={view} selected={selected} onSelect={setSelected} />

        <div className="map-offmap">
          <span className="kicker" style={{ margin: 0 }}>Off map</span>
          {OFF_MAP.map((id) => {
            const n = s.nations[id];
            return (
              <button
                key={id}
                className={`choice${selected === id ? ' selected' : ''}`}
                onClick={() => setSelected(id)}
                style={{ flex: 1 }}
              >
                <span className="tick">{selected === id ? '▸' : ''}</span>
                <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{n.name}</span>
                  <span className="mono small faint">
                    {n.collapsed ? 'collapsed' : relationsLabel(n.relations)}
                  </span>
                </span>
              </button>
            );
          })}
          <span className="small faint">
            Libya sits west of the frame. It has no border with Israel, but it can still be
            worked on.
          </span>
        </div>
      </div>

      <div className="mapside">
        {selected === 'israel' ? (
          <IsraelPanel s={s} h={h} />
        ) : (
          <NationPanel s={s} h={h} id={selected} />
        )}
      </div>
    </div>
  );
}

/** Ground this country has lost, and ground it has taken, in words. */
function GroundRows({ s, id }: { s: GameState; id: NationId | 'israel' }) {
  const name = (x: NationId | 'israel') => (x === 'israel' ? 'Israel' : s.nations[x].name);
  const all = occupations(s);
  return (
    <>
      {all
        .filter((o) => o.held === id)
        .map((o) => (
          <Row
            key={`lost-${o.holder}`}
            label="Territory lost"
            value={`${name(o.holder)} holds ${occupationLabel(o.share)}`}
            tone={id === 'israel' ? 'red' : 'amber'}
          />
        ))}
      {all
        .filter((o) => o.holder === id)
        .map((o) => (
          <Row
            key={`held-${o.held}`}
            label="Territory taken"
            value={`${occupationLabel(o.share)} of ${name(o.held)}`}
            tone={id === 'israel' ? 'teal' : ''}
          />
        ))}
    </>
  );
}

function NationPanel({
  s,
  h,
  id,
}: {
  s: GameState;
  h: PlanningHandlers;
  id: NationId;
}) {
  const n = s.nations[id];
  const front = isFront(id) ? s.fronts[id] : null;

  return (
    <>
      <Panel
        title={`${n.name} — official news`}
        right={
          <span className="mono small">
            Mossad {committedCapacity(s)}/{MOSSAD_CAPACITY}
          </span>
        }
      >
        <div className="rows">
          <Row label="Leader" value={n.collapsed ? '— none —' : n.leader} />
          <Row
            label="Diplomatic relations"
            value={n.collapsed ? 'No formal channels' : relationsLabel(n.relations)}
          />
          <Row
            label="Internal stability"
            value={n.collapsed ? 'State has collapsed' : stabilityLabel(n.stability)}
            tone={!n.collapsed && n.stability < 30 ? 'amber' : ''}
          />
          <Row label="Pressure group" value={n.oppositionGroup} />
          <Row
            label="Opposition strength"
            value={n.collapsed ? '—' : oppositionLabel(n.oppositionStrength)}
          />
          {front && (
            <Row
              label="Our border"
              value={frontActivityLabel(front.enemyActivity).replace(/^(is|has) /, '').replace(/\.$/, '')}
              tone={front.enemyActivity >= 2 ? 'red' : ''}
            />
          )}
          {front && front.deployed.brigades > 0 && (
            <Row label="Brigades deployed" value={front.deployed.brigades} />
          )}
          {n.atWarWith.length > 0 && (
            <Row label="At war with" value={n.atWarWith.join(', ')} tone="red" />
          )}
          {n.pactWith.length > 0 && (
            <Row label="Military pacts" value={n.pactWith.join(', ')} tone="teal" />
          )}
          <GroundRows s={s} id={id} />
        </div>

        {front?.atWar && (
          <div style={{ marginTop: 12 }}>
            <div className="kicker">Fortunes of war — month {front.warMonths}</div>
            <WarBar progress={front.warProgress} />
          </div>
        )}
      </Panel>

      <Panel title="Diplomatic affairs">
        <Choices
          options={diplomaticOptions(s, id)}
          selected={s.directives.diplomatic[id]}
          onSelect={(d) => h.setDiplomatic(id, d)}
        />
      </Panel>

      <Panel title="Psychopolitical warfare unit">
        <Choices
          options={intelOptions(s, id)}
          selected={s.directives.intel[id]}
          onSelect={(d) => h.setIntel(id, d)}
        />
      </Panel>

      {front && (
        <Panel title="Strategic action">
          <Choices
            options={strategicOptions(s, id as FrontId)}
            selected={s.directives.strategic[id as FrontId]}
            onSelect={(d) => h.setStrategic(id as FrontId, d)}
          />
        </Panel>
      )}

      {isRemote(id) && (
        <Panel title="Long-range strike">
          <p className="small faint" style={{ marginTop: 0 }}>
            {REACH[id].answer}
          </p>
          <Choices
            options={remoteStrikeOptions(s, id)}
            selected={s.directives.remote[id]}
            onSelect={(d) => h.setRemote(id, d)}
          />
        </Panel>
      )}
    </>
  );
}

function IsraelPanel({ s, h }: { s: GameState; h: PlanningHandlers }) {
  return (
    <>
      <Panel title="Israel">
        <div className="rows">
          <Row label="Prime Minister" value={s.israel.leader} />
          <Row
            label="West Bank and Gaza"
            value={unrestLabel(s.palestine.unrest)}
            tone={s.palestine.unrest >= 7 ? 'red' : s.palestine.unrest >= 4 ? 'amber' : ''}
          />
          <Row label="Brigades policing" value={s.palestine.brigadesPosted} />
          <Row label="Tactics" value={s.palestine.tactics === 'hard' ? 'HARD' : 'SOFT'} />
          <Row label="Standing army" value={`${s.israel.brigades} brigades`} />
          <GroundRows s={s} id="israel" />
          <Row
            label="Neighbours still standing"
            value={NATION_IDS.filter((id) => s.nations[id].isFront && !s.nations[id].collapsed).length}
          />
        </div>
      </Panel>

      <Panel title="Policing options">
        <Choices
          options={policingOptions(s)}
          selected={s.directives.policing}
          onSelect={h.setPolicing}
        />
      </Panel>
    </>
  );
}
