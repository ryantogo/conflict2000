import { useState } from 'react';
import type {
  DiplomaticDirective,
  FrontId,
  GameState,
  IntelDirective,
  NationId,
  PolicingDirective,
  FactionDirective,
  PowerDirective,
  PowerId,
  RemoteDirective,
  RemoteId,
  StrategicDirective,
  SupplierId,
} from '../engine';
import { officialReport, prestigeLabel, previewTurn, tensionLabel } from '../engine';
import { factionSeedById } from '../data/factions2000';
import { Bar, Panel, Row } from './bits';
import { ForeignOffice } from './ForeignOffice';
import { Strategic } from './Strategic';
import { Procurement } from './Procurement';
import { Review } from './Review';
import { Domestic } from './Domestic';
import { MapRoom } from './MapRoom';

type Tab = 'map' | 'briefing' | 'foreign' | 'strategic' | 'arms' | 'review' | 'domestic';

const TABS: { id: Tab; label: string }[] = [
  { id: 'map', label: 'Situation Map' },
  { id: 'briefing', label: 'Briefing' },
  { id: 'foreign', label: 'Foreign Office' },
  { id: 'strategic', label: 'Strategic Action' },
  { id: 'arms', label: 'Procurement' },
  { id: 'review', label: 'Review Forces' },
  { id: 'domestic', label: 'Home & Nuclear' },
];

export interface PlanningHandlers {
  setDiplomatic: (id: NationId, d: DiplomaticDirective) => void;
  setIntel: (id: NationId, d: IntelDirective) => void;
  setPower: (id: PowerId, d: PowerDirective) => void;
  setFaction: (id: string, d: FactionDirective) => void;
  setStrategic: (id: FrontId, d: StrategicDirective) => void;
  setRemote: (id: RemoteId, d: RemoteDirective) => void;
  setPolicing: (d: PolicingDirective) => void;
  setFundNuclear: (v: boolean) => void;
  order: (supplier: SupplierId, itemId: string, qty: number) => string | null;
  setProductionLine: (lineId: string, running: boolean) => void;
  endTurn: () => void;
}

export function Planning({ s, h }: { s: GameState; h: PlanningHandlers }) {
  const [tab, setTab] = useState<Tab>('map');

  const d = s.directives;

  // Which screens are carrying an order this month. The tab badge has been
  // styled since the first commit and never rendered.
  // Groups in the territories are ordered from the domestic screen; everything
  // else — border militias and the successors of a fallen state — from
  // Strategic Action.
  const factionKeys = Object.keys(d.factions);
  const territoryOrders = factionKeys.filter(
    (k) => factionSeedById(k)?.home === 'territories',
  ).length;

  const pending: Record<Tab, number> = {
    map: 0,
    briefing: 0,
    foreign:
      Object.keys(d.diplomatic).length +
      Object.keys(d.intel).length +
      Object.keys(d.powers).length,
    strategic:
      Object.keys(d.strategic).length +
      Object.keys(d.remote).length +
      (factionKeys.length - territoryOrders),
    arms: d.purchases.length,
    review: 0,
    domestic: (d.policing !== 'none' ? 1 : 0) + (d.fundNuclear ? 1 : 0) + territoryOrders,
  };

  const queued = Object.values(pending).reduce((a, b) => a + b, 0);
  const effects = previewTurn(s);

  return (
    <div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {pending[t.id] > 0 ? <span className="dot" /> : null}
          </button>
        ))}
      </div>

      {tab === 'map' && <MapRoom s={s} h={h} />}
      {tab === 'briefing' && <Briefing s={s} />}
      {tab === 'foreign' && (
        <ForeignOffice
          s={s}
          setDiplomatic={h.setDiplomatic}
          setIntel={h.setIntel}
          setPower={h.setPower}
        />
      )}
      {tab === 'strategic' && (
        <Strategic
          s={s}
          setStrategic={h.setStrategic}
          setRemote={h.setRemote}
          setFaction={h.setFaction}
        />
      )}
      {tab === 'arms' && (
        <Procurement s={s} onOrder={h.order} onProduction={h.setProductionLine} />
      )}
      {tab === 'review' && <Review s={s} />}
      {tab === 'domestic' && (
        <Domestic
          s={s}
          setPolicing={h.setPolicing}
          setFundNuclear={h.setFundNuclear}
          setFaction={h.setFaction}
        />
      )}

      {effects.length > 0 && (
        <Panel title="Before you go">
          <ul className="advice">
            {effects.map((e, i) => (
              <li key={i} className="small">
                <span
                  className={`mono ${
                    e.tone === 'bad' ? 'red' : e.tone === 'warn' ? 'amber' : 'faint'
                  }`}
                >
                  {e.area}
                </span>{' '}
                — {e.text}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <div className="btn-row end" style={{ marginTop: 22 }}>
        <span className="small faint">
          {queued === 0
            ? 'No directives issued this month.'
            : `${queued} directive${queued === 1 ? '' : 's'} ready.`}
        </span>
        <button className="btn primary" onClick={h.endTurn}>
          Next Turn →
        </button>
      </div>
    </div>
  );
}

function Briefing({ s }: { s: GameState }) {
  return (
    <div className="grid2">
      <Panel title="Foreign Office">
        <ul className="advice">
          {s.briefing.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>

        <div className="kicker" style={{ marginTop: 20 }}>
          Prestige — {prestigeLabel(s.israel.prestige)}
        </div>
        <Bar value={s.israel.prestige} tone="teal" />

        <div className="kicker" style={{ marginTop: 14 }}>
          Middle East tension — {tensionLabel(s.tension)}
        </div>
        <Bar value={s.tension} tone={s.tension > 70 ? 'red' : undefined} />

        <div className="kicker" style={{ marginTop: 14 }}>
          Standing in the Knesset
        </div>
        <Bar
          value={s.israel.popularity}
          tone={s.israel.popularity < 30 ? 'red' : undefined}
        />
      </Panel>

      <div>
        <Panel title="National Security Office">
          <div className="rows">
            {officialReport(s).map((line, i) => {
              const [head, ...tail] = line.split(':');
              return <Row key={i} label={head} value={tail.join(':').trim()} />;
            })}
          </div>
        </Panel>

        {s.log.length > 0 && (
          <Panel title="Cabinet notes">
            <ul className="advice">
              {s.log.slice(0, 10).map((line, i) => (
                <li key={i} className="small">
                  {line}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </div>
  );
}
