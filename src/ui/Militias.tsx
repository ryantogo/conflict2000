import type { GameState, NationId } from '../engine';
import type { FactionDirective } from '../engine';
import type { FactionHome } from '../data/factions2000';
import { factionOptions, factionsIn, successorOptions, successorsOf } from '../engine';
import { Choices, Panel, Row } from './bits';

/** How dangerous an armed group currently is, as a word. */
function militiaLabel(v: number): string {
  if (v >= 75) return 'A standing army in all but name';
  if (v >= 55) return 'Formidable';
  if (v >= 35) return 'Capable';
  if (v >= 18) return 'Harassing';
  if (v >= 8) return 'Weakened';
  return 'Spent';
}

/**
 * The armed groups operating out of one place. They have no border and no
 * government, so they get a card rather than a place on the map.
 */
export function Militias({
  s,
  home,
  setFaction,
  title,
}: {
  s: GameState;
  home: FactionHome;
  setFaction: (id: string, d: FactionDirective) => void;
  title: string;
}) {
  const groups = factionsIn(s, home);
  if (groups.length === 0) return null;

  return (
    <Panel title={title}>
      {groups.map((f) => (
        <div key={f.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>{f.name}</strong>
            <span className={`mono small ${f.strength >= 55 ? 'red' : 'faint'}`}>
              {militiaLabel(f.strength)}
            </span>
          </div>
          <div className="small dim" style={{ marginBottom: 6 }}>
            {f.character}
            {f.patronName ? ` Funded from ${f.patronName}.` : ''}
          </div>
          <div className="rows">
            <Row label="Popular support" value={supportLabel(f.support)} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Choices
              options={factionOptions(s, f.id)}
              selected={s.directives.factions[f.id]}
              onSelect={(d) => setFaction(f.id, d)}
            />
          </div>
        </div>
      ))}
    </Panel>
  );
}

function supportLabel(v: number): string {
  if (v >= 70) return 'They are the street';
  if (v >= 50) return 'Widely backed';
  if (v >= 30) return 'A real constituency';
  if (v >= 15) return 'A minority';
  return 'Isolated';
}

/**
 * Who is contesting a fallen state. This panel is the answer to a collapse
 * being a dead end: a government that has stopped existing used to offer
 * nothing on any screen except a withdrawal.
 */
export function Succession({
  s,
  nation,
  setFaction,
}: {
  s: GameState;
  nation: NationId;
  setFaction: (id: string, d: FactionDirective) => void;
}) {
  const contenders = successorsOf(s, nation);
  if (contenders.length === 0) return null;

  const backed = contenders.find((c) => s.directives.factions[c.id] === 'back');

  return (
    <Panel title={`The succession in ${s.nations[nation].name}`}>
      <p className="small dim" style={{ marginTop: 0 }}>
        {backed
          ? `We are backing ${backed.name}. Put enough behind them and they will ` +
            'form a government, and it will be ours.'
          : 'The state has come apart. Whoever we arm is who governs next.'}
      </p>

      {contenders.map((c) => (
        <div key={c.id} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <strong>{c.name}</strong>
            <span className={`mono small ${c.readyToGovern ? 'teal' : 'faint'}`}>
              {c.readyToGovern ? 'Could take power' : militiaLabel(c.strength)}
            </span>
          </div>
          <div className="small dim" style={{ marginBottom: 6 }}>
            {c.character}
          </div>
          <div className="rows">
            <Row
              label="Disposition toward us"
              value={dispositionLabel(c.disposition)}
              tone={c.disposition < -0.3 ? 'red' : c.disposition > 0.3 ? 'teal' : ''}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <Choices
              options={successorOptions(s, c.id)}
              selected={s.directives.factions[c.id]}
              onSelect={(d) => setFaction(c.id, d)}
            />
          </div>
        </div>
      ))}
    </Panel>
  );
}

function dispositionLabel(v: number): string {
  if (v >= 0.6) return 'Would work with us openly';
  if (v >= 0.25) return 'Would deal quietly';
  if (v >= -0.25) return 'Indifferent to us';
  if (v >= -0.6) return 'Hostile';
  return 'Would fight us on day one';
}
