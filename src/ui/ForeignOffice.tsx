import { useState } from 'react';
import type {
  DiplomaticDirective,
  GameState,
  IntelDirective,
  NationId,
  PowerDirective,
  PowerId,
} from '../engine';
import {
  MOSSAD_CAPACITY,
  NATION_IDS,
  committedCapacity,
  diplomaticOptions,
  intelOptions,
  oppositionLabel,
  relationsLabel,
  stabilityLabel,
} from '../engine';
import {
  alertLabel,
  networkLabel,
  powerOptions,
  powerReport,
  patienceLabel,
  powerStandingLabel,
} from '../engine';
import type { SubTabItem } from './bits';
import { Bar, Choices, Panel, Row, SubTabs, Tip } from './bits';
import { HINTS } from '../data/hints';

type ForeignView = 'relations' | 'intelligence' | 'powers';

const FOREIGN_VIEWS: SubTabItem<ForeignView>[] = [
  {
    id: 'relations',
    label: 'Relations',
    legend: 'Where we stand with the selected capital, and what to do about it.',
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    legend: 'What Mossad has in place there, and who is looking for it.',
  },
  {
    id: 'powers',
    label: 'The powers',
    legend: 'Washington, London and Paris. No borders, no armies — a relationship and a price.',
  },
];


/**
 * The capitals that are not in the region. They have no border and no army,
 * so they get a card rather than a place on the map — the same treatment
 * Libya has always had.
 */
function ThePowers({
  s,
  setPower,
}: {
  s: GameState;
  setPower: (id: PowerId, d: PowerDirective) => void;
}) {
  const [selected, setSelected] = useState<PowerId>('usa');
  const powers = powerReport(s);
  const chosen = powers.find((p) => p.id === selected)!;

  return (
    <Panel title="The Western capitals">
      <div className="rows">
        {powers.map((p) => (
          <button
            key={p.id}
            className={`choice${selected === p.id ? ' selected' : ''}`}
            onClick={() => setSelected(p.id)}
            style={{ marginBottom: 4 }}
          >
            <span className="tick">{selected === p.id ? '▸' : ''}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>
                  {p.name}
                  {p.embargoed ? <span className="pill war"> embargo</span> : null}
                  {s.directives.powers[p.id] ? <span className="amber"> ●</span> : null}
                </span>
                <span className="mono small faint">{powerStandingLabel(p.relations)}</span>
              </span>
              {p.demandText && (
                <span className="why" style={{ fontStyle: 'normal' }}>
                  Pressing us for {p.demandText}.
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="kicker" style={{ marginTop: 16 }}>
        {chosen.name}
      </div>
      <div className="rows">
        <Row label="Standing" value={powerStandingLabel(chosen.relations)} />
        <Row
          label="Willing to hear us"
          value={patienceLabel(chosen.patience)}
          tone={chosen.patience < 35 ? 'amber' : ''}
        />
        <Row
          label="Arms sales"
          value={chosen.embargoed ? 'Embargoed' : 'Open'}
          tone={chosen.embargoed ? 'red' : ''}
        />
        <Row label="Their demand" value={chosen.demandText ?? 'Nothing in particular'} />
        {s.israel.restraint > 0 && (
          <Row
            label="Undertakings given"
            value={`${s.israel.restraint} month${s.israel.restraint === 1 ? '' : 's'} to run`}
            tone="amber"
          />
        )}
      </div>

      <div style={{ marginTop: 12 }}>
        <Choices
          options={powerOptions(s, selected)}
          selected={s.directives.powers[selected]}
          onSelect={(d) => setPower(selected, d)}
        />
      </div>
    </Panel>
  );
}

export function ForeignOffice({
  s,
  setDiplomatic,
  setIntel,
  setPower,
}: {
  s: GameState;
  setDiplomatic: (id: NationId, d: DiplomaticDirective) => void;
  setIntel: (id: NationId, d: IntelDirective) => void;
  setPower: (id: PowerId, d: PowerDirective) => void;
}) {
  const [selected, setSelected] = useState<NationId>('syria');
  const [view, setView] = useState<ForeignView>('relations');
  const n = s.nations[selected];

  return (
    <div className="grid2">
      <Panel title="The neighbourhood">
        <div className="rows">
          {NATION_IDS.map((id) => {
            const nation = s.nations[id];
            const queued = s.directives.diplomatic[id] || s.directives.intel[id];
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
                      {nation.name}
                      {nation.collapsed ? <span className="pill gone"> collapsed</span> : null}
                      {nation.atWarWith.includes('israel') ? (
                        <span className="pill war"> at war</span>
                      ) : null}
                      {nation.pactWith.includes('israel') ? (
                        <span className="pill pact"> pact</span>
                      ) : null}
                    </span>
                    <span className="mono small faint">
                      {nation.collapsed ? '—' : relationsLabel(nation.relations)}
                      {queued ? <span className="amber"> ●</span> : null}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      <div>
        <SubTabs items={FOREIGN_VIEWS} selected={view} onSelect={setView} />

        {view === 'relations' && (
          <Panel title={`${n.name} — official news`}>
          <div className="rows">
            <Row label="Leader" value={n.collapsed ? '— none —' : n.leader} />
            <Row label="Capital" value={n.capital} />
            <Row
              label="Diplomatic relations"
              value={n.collapsed ? 'No formal channels' : relationsLabel(n.relations)}
            />
            <Row
              label="Internal stability"
              value={n.collapsed ? 'State has collapsed' : stabilityLabel(n.stability)}
              tone={!n.collapsed && n.stability < 30 ? 'amber' : ''}
            />
            <Row label="Supported pressure group" value={n.oppositionGroup} />
            <Row
              label="State of opposition group"
              value={n.collapsed ? '—' : oppositionLabel(n.oppositionStrength)}
            />
            <Row
              label="Our posture"
              value={
                n.israeliPosture === 'supporting_opposition'
                  ? 'Funding insurgents'
                  : n.israeliPosture === 'supporting_government'
                    ? 'Propping up the regime'
                    : 'No covert involvement'
              }
            />
            {n.atWarWith.length > 0 && (
              <Row label="At war with" value={n.atWarWith.join(', ')} tone="red" />
            )}
            {n.pactWith.length > 0 && (
              <Row label="Military pacts" value={n.pactWith.join(', ')} tone="teal" />
            )}
            {n.hasNuclear && <Row label="Nuclear" value="ARMED" tone="red" />}
            </div>
          </Panel>
        )}

        {view === 'relations' && (
          <Panel title="Diplomatic affairs">
            <Choices
              options={diplomaticOptions(s, selected)}
              selected={s.directives.diplomatic[selected]}
              onSelect={(d) => setDiplomatic(selected, d)}
            />
          </Panel>
        )}

        {view === 'intelligence' && (
          <Panel
            title="Psychopolitical warfare intelligence unit"
            right={
              <Tip text={HINTS.mossadCapacity}>
                <span className="mono small">
                  Mossad {committedCapacity(s)}/{MOSSAD_CAPACITY}
                </span>
              </Tip>
            }
          >
          {/* A fallen state has no security service left to read. */}
          {!n.collapsed && (
            <>
              <div className="rows" style={{ marginBottom: 12 }}>
                <Row
                  label="Our network there"
                  value={networkLabel(n.network)}
                  tone={n.network < 25 ? 'red' : n.network < 40 ? 'amber' : ''}
                  hint={HINTS.network}
                />
                <Row
                  label="Their counter-intelligence"
                  value={alertLabel(n.counterIntel)}
                  tone={n.counterIntel >= 50 ? 'red' : n.counterIntel >= 30 ? 'amber' : ''}
                  hint={HINTS.counterIntel}
                />
              </div>
              <Bar value={n.counterIntel} tone={n.counterIntel >= 50 ? 'red' : undefined} />
            </>
          )}

          <div style={{ marginTop: 14 }}>
            <Choices
              options={intelOptions(s, selected)}
              selected={s.directives.intel[selected]}
              onSelect={(d) => setIntel(selected, d)}
            />
          </div>

            {committedCapacity(s) > MOSSAD_CAPACITY && (
              <p className="small red" style={{ marginBottom: 0 }}>
                Mossad is overcommitted. Every operation this month will be weaker and
                more likely to be exposed.
              </p>
            )}
          </Panel>
        )}

        {view === 'powers' && <ThePowers s={s} setPower={setPower} />}
      </div>
    </div>
  );
}
