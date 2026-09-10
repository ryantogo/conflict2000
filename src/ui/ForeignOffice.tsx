import { useState } from 'react';
import type {
  DiplomaticDirective,
  GameState,
  IntelDirective,
  MediatorId,
  NationId,
  ObligationAnswer,
  PowerDirective,
  PowerId,
  RegionalWarDirective,
} from '../engine';
import {
  MOSSAD_CAPACITY,
  NATION_IDS,
  committedCapacity,
  diplomaticOptions,
  groundHeld,
  intelOptions,
  jointOptions,
  jointPartners,
  mediatorOptions,
  obligationOptions,
  occupationLabel,
  oppositionLabel,
  regionalWarOptions,
  relationsLabel,
  stabilityLabel,
  warKey,
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
import { Bar, Choices, Panel, Row, SubTabs, Tip, WarBar } from './bits';
import { HINTS } from '../data/hints';

type ForeignView = 'relations' | 'intelligence' | 'alliances' | 'powers';

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
    id: 'alliances',
    label: 'Wars & alliances',
    legend:
      'Treaties called in, offensives proposed to friends, and the wars the other states are fighting.',
  },
  {
    id: 'powers',
    label: 'The powers',
    legend: 'Washington, London and Paris. No borders, no armies — a relationship and a price.',
  },
];

export interface AllianceHandlers {
  setJoint: (partner: NationId, target: NationId) => void;
  setMediation: (enemy: NationId, m: MediatorId) => void;
  setRegional: (key: string, d: RegionalWarDirective) => void;
  setObligation: (id: string, a: ObligationAnswer) => void;
}

/**
 * Treaties, offensives, and other people's wars. A treaty is a promise to be
 * on somebody's side, and this is the screen where the promise is called in.
 */
function Alliances({ s, h }: { s: GameState; h: AllianceHandlers }) {
  const partners = jointPartners(s);
  const [picked, setPicked] = useState<NationId | null>(null);
  const partner = picked && partners.includes(picked) ? picked : (partners[0] ?? null);
  const d = s.directives;

  return (
    <>
      {s.obligations.map((o) => (
        <Panel key={o.id} title={`Treaty obligation — ${s.nations[o.partner].name}`}>
          <p className="small dim" style={{ marginTop: 0 }}>
            {s.nations[o.aggressor].name} has attacked {s.nations[o.partner].name}, and our treaty
            says we answer. If we say nothing, the treaty dies — and every other government
            that has one with us will draw its own conclusions.
          </p>
          <Choices
            options={obligationOptions(s, o)}
            selected={d.obligations[o.id]}
            onSelect={(a) => h.setObligation(o.id, a)}
          />
        </Panel>
      ))}

      <Panel title="Joint offensive">
        {partners.length === 0 || !partner ? (
          <p className="small faint" style={{ margin: 0 }}>
            No government in the region is close enough to us to fight beside us. It takes
            relations of Beneficial, or a defence treaty.
          </p>
        ) : (
          <>
            <div className="choices" style={{ marginBottom: 10 }}>
              {partners.map((id) => (
                <button
                  key={id}
                  className={`choice${partner === id ? ' selected' : ''}`}
                  onClick={() => setPicked(id)}
                >
                  <span className="tick">{partner === id ? '▸' : ''}</span>
                  <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <span>
                      {s.nations[id].name}
                      {s.nations[id].pactWith.includes('israel') ? (
                        <span className="pill pact"> treaty</span>
                      ) : null}
                    </span>
                    <span className="mono small faint">{relationsLabel(s.nations[id].relations)}</span>
                  </span>
                </button>
              ))}
            </div>
            {jointOptions(s, partner).length === 0 ? (
              <p className="small faint" style={{ margin: 0 }}>
                {s.nations[partner].name} despises nobody enough to go to war over it.
              </p>
            ) : (
              <Choices
                options={jointOptions(s, partner)}
                selected={d.joint?.partner === partner ? d.joint.target : undefined}
                onSelect={(t) => h.setJoint(partner, t)}
              />
            )}
          </>
        )}
      </Panel>

      <Panel title="Wars in the region">
        {s.wars.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            Nobody else is fighting.
          </p>
        ) : (
          s.wars.map((w) => {
            const a = s.nations[w.a];
            const b = s.nations[w.b];
            const aHolds = groundHeld(w, w.a);
            const bHolds = groundHeld(w, w.b);
            return (
              <div key={warKey(w)} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <strong>
                    {a.name} against {b.name}
                  </strong>
                  <span className="mono small faint">month {w.months}</span>
                </div>
                <div style={{ margin: '6px 0' }}>
                  <WarBar progress={w.progress} />
                </div>
                <div className="small dim" style={{ marginBottom: 8 }}>
                  {aHolds > 0.02
                    ? `${a.name} holds ${occupationLabel(aHolds)} of ${b.name}.`
                    : bHolds > 0.02
                      ? `${b.name} holds ${occupationLabel(bHolds)} of ${a.name}.`
                      : 'Neither side has taken any ground worth the name.'}
                  {w.supporters.israel ? ` Our aircraft fly for ${s.nations[w.supporters.israel].name}.` : ''}
                </div>
                <Choices
                  options={regionalWarOptions(s, w)}
                  selected={d.regional[warKey(w)]}
                  onSelect={(x) => h.setRegional(warKey(w), x)}
                />
              </div>
            );
          })
        )}
      </Panel>
    </>
  );
}


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
  alliances,
}: {
  s: GameState;
  setDiplomatic: (id: NationId, d: DiplomaticDirective) => void;
  setIntel: (id: NationId, d: IntelDirective) => void;
  setPower: (id: PowerId, d: PowerDirective) => void;
  alliances: AllianceHandlers;
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
        <SubTabs
          items={FOREIGN_VIEWS.map((v) =>
            v.id === 'alliances' ? { ...v, dot: s.obligations.length > 0 } : v,
          )}
          selected={view}
          onSelect={setView}
        />

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
              <Row label="Defence treaties" value={n.pactWith.join(', ')} tone="teal" />
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

        {view === 'relations' && n.isFront && s.fronts[selected as 'syria'].atWar && (
          <Panel title="Seek mediation">
            <p className="small faint" style={{ marginTop: 0 }}>
              A third party makes a ceasefire likelier than asking them ourselves, and names
              its own price if it works: Washington wants undertakings, a neighbour wants the
              ground handed back.
            </p>
            <Choices
              options={mediatorOptions(s, selected)}
              selected={s.directives.mediation[selected]}
              onSelect={(m) => alliances.setMediation(selected, m)}
            />
          </Panel>
        )}

        {view === 'alliances' && <Alliances s={s} h={alliances} />}

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
