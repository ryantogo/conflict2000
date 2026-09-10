import { useState } from 'react';
import type {
  DiplomaticDirective,
  FrontId,
  GameState,
  IntelDirective,
  NationId,
  PolicingDirective,
  PowerDirective,
  PowerId,
  StrategicDirective,
  SupplierId,
} from '../engine';
import { officialReport, prestigeLabel, tensionLabel } from '../engine';
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
  setStrategic: (id: FrontId, d: StrategicDirective) => void;
  setPolicing: (d: PolicingDirective) => void;
  setFundNuclear: (v: boolean) => void;
  order: (supplier: SupplierId, itemId: string, qty: number) => string | null;
  setProductionLine: (lineId: string, running: boolean) => void;
  endTurn: () => void;
}

export function Planning({ s, h }: { s: GameState; h: PlanningHandlers }) {
  const [tab, setTab] = useState<Tab>('map');

  const queued =
    Object.keys(s.directives.diplomatic).length +
    Object.keys(s.directives.intel).length +
    Object.keys(s.directives.strategic).length +
    (s.directives.policing !== 'none' ? 1 : 0) +
    (s.directives.fundNuclear ? 1 : 0) +
    s.directives.purchases.length;

  return (
    <div>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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
      {tab === 'strategic' && <Strategic s={s} setStrategic={h.setStrategic} />}
      {tab === 'arms' && (
        <Procurement s={s} onOrder={h.order} onProduction={h.setProductionLine} />
      )}
      {tab === 'review' && <Review s={s} />}
      {tab === 'domestic' && (
        <Domestic s={s} setPolicing={h.setPolicing} setFundNuclear={h.setFundNuclear} />
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
