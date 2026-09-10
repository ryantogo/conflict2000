import type { FrontId, GameState, NationId } from '../engine';
import type { ViewId } from '../data/geography';
import { FRONTS, countOf, relationsLabel, stabilityLabel, unrestLabel } from '../engine';
import {
  BACKDROP_LABELS,
  BACKDROP_RINGS,
  CAPITALS,
  COUNTRY_RINGS,
  FRONT_LABELS,
  FRONT_LINES,
  GAZA_RING,
  LABEL_ANCHORS,
  LABEL_LEADERS,
  LEVANT_LABEL_OVERRIDES,
  MAP_H,
  MAP_W,
  SEA_LABELS,
  WEST_BANK_RING,
  viewBoxFor,
  viewScale,
  projectX,
  projectY,
  toPath,
} from '../data/geography';

export type MapMode = 'relations' | 'stability' | 'military';

/**
 * The situation map.
 *
 * Flat colour blocks and monospace capitals, in the original's idiom — but
 * every playable state is a target you can click, and the fill carries live
 * state rather than decoration. The mode switch changes what the colour means.
 */
export function RegionalMap({
  s,
  mode,
  view,
  selected,
  onSelect,
}: {
  s: GameState;
  mode: MapMode;
  view: ViewId;
  selected: NationId | 'israel' | null;
  onSelect: (id: NationId | 'israel') => void;
}) {
  // Everything that should stay a constant size on screen — type, capital
  // markers, stroke weights — is multiplied by this.
  const mz = viewScale(view);
  return (
    <svg
      className="map"
      viewBox={viewBoxFor(view)}
      style={{ ['--mz' as string]: mz }}
      role="img"
      aria-label="Regional situation map"
    >
      <defs>
        <pattern id="collapsed" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="var(--ink-600)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-400)" strokeWidth="2" />
        </pattern>
        <pattern id="unrest" width="5" height="5" patternTransform="rotate(-45)" patternUnits="userSpaceOnUse">
          <line x1="0" y1="0" x2="0" y2="5" stroke="var(--amber)" strokeWidth="1.4" />
        </pattern>
      </defs>

      {/* sea */}
      <rect x="0" y="0" width={MAP_W} height={MAP_H} fill="var(--sea)" />

      {/* neighbours who are not in the game */}
      {BACKDROP_RINGS.map((b) => (
        <path key={b.id} d={toPath(b.ring)} className="map-backdrop" />
      ))}
      {BACKDROP_LABELS.map((p) => (
        <text key={p.name} className="map-backdrop-label" x={projectX(p.lon)} y={projectY(p.lat)}>
          {p.name}
        </text>
      ))}

      {/* the players */}
      {Object.entries(COUNTRY_RINGS).map(([id, ring]) => {
        const key = id as NationId | 'israel';
        const isIsrael = key === 'israel';
        const n = isIsrael ? null : s.nations[key as NationId];
        const atWar = !!n && n.atWarWith.includes('israel');
        return (
          <path
            key={id}
            d={toPath(ring)}
            className={
              'map-country' +
              (selected === key ? ' selected' : '') +
              (atWar ? ' at-war' : '') +
              (n?.collapsed ? ' collapsed' : '')
            }
            fill={fillFor(s, key, mode)}
            onClick={() => onSelect(key)}
            tabIndex={0}
            role="button"
            aria-label={labelFor(s, key, mode)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(key);
              }
            }}
          >
            <title>{labelFor(s, key, mode)}</title>
          </path>
        );
      })}

      {/* Sea names go on last of the water features, so no coastline
          overdraws them. */}
      {SEA_LABELS.map((p) => (
        <text key={p.name} className="map-sea-label" x={projectX(p.lon)} y={projectY(p.lat)}>
          {p.name}
        </text>
      ))}

      {/* West Bank and Gaza, hatched in proportion to unrest */}
      {!s.palestine.homelandCreated && (
        <g className="map-territories" pointerEvents="none">
          <path d={toPath(WEST_BANK_RING)} opacity={0.25 + s.palestine.unrest * 0.06} />
          <path d={toPath(GAZA_RING)} opacity={0.25 + s.palestine.unrest * 0.06} />
        </g>
      )}

      {/* Israeli forces on each border */}
      {FRONTS.map((f) => (
        <Deployment key={f} s={s} front={f} mz={mz} />
      ))}

      {/* capitals */}
      {Object.entries(CAPITALS).map(([id, p]) => {
        const n = id === 'israel' ? null : s.nations[id as NationId];
        if (n?.collapsed) return null;
        return (
          <g key={id} className="map-capital" pointerEvents="none">
            <rect
              x={projectX(p.lon) - 2.5 * mz}
              y={projectY(p.lat) - 2.5 * mz}
              width={5 * mz}
              height={5 * mz}
            />
            <text
              x={projectX(p.lon) + (p.dx ?? 6) * mz}
              y={projectY(p.lat) + (p.dy ?? 3) * mz}
            >
              {p.name}
            </text>
          </g>
        );
      })}

      {/* country names */}
      {Object.keys(COUNTRY_RINGS).map((id) => {
        const key = id as NationId | 'israel';
        const override = view === 'levant' ? LEVANT_LABEL_OVERRIDES[id] : undefined;
        if (override === null) return null;
        const anchor = override ?? LABEL_ANCHORS[id];
        if (!anchor) return null;
        const n = key === 'israel' ? null : s.nations[key as NationId];
        const leader = LABEL_LEADERS[id];
        const x = projectX(anchor[0]);
        const y = projectY(anchor[1]);
        return (
          <g key={id} pointerEvents="none">
            {leader && (
              <line
                className="map-leader"
                x1={projectX(leader[0])}
                y1={projectY(leader[1])}
                x2={x + 22 * mz}
                y2={y - 3 * mz}
              />
            )}
            <text className={'map-name' + (n?.collapsed ? ' collapsed' : '')} x={x} y={y}>
              {(key === 'israel' ? 'ISRAEL' : s.nations[key as NationId].name).toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Israeli strength on a border, drawn along the frontier itself. */
function Deployment({ s, front, mz }: { s: GameState; front: FrontId; mz: number }) {
  const f = s.fronts[front];
  if (f.deployed.brigades === 0 && !f.atWar) return null;

  const line = FRONT_LINES[front];
  const d = line
    .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${projectX(lon).toFixed(1)},${projectY(lat).toFixed(1)}`)
    .join('');

  const [llon, llat] = FRONT_LABELS[front];
  const width = (2 + Math.min(f.deployed.brigades, 6) * 1.6) * mz;

  return (
    <g className="map-front" pointerEvents="none">
      <path d={d} className="map-front-line" strokeWidth={width} />
      {f.atWar && <path d={d} className="map-front-war" strokeWidth={width + 4 * mz} />}
      {f.deployed.brigades > 0 && (
        <text className="map-front-count" x={projectX(llon)} y={projectY(llat)}>
          {f.deployed.brigades}
        </text>
      )}
      {f.atWar && (
        <text className="map-front-war-flag" x={projectX(llon)} y={projectY(llat) + 11 * mz}>
          WAR
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------

/** Diverging scale: hostile through indifferent to friendly. */
const RELATION_FILL = [
  '#9a3a32',
  '#a8483a',
  '#b25a41',
  '#9c7248',
  '#77776a',
  '#5f7a70',
  '#4d8378',
  '#3f8d80',
  '#329788',
  '#26a191',
];

const STABILITY_FILL = ['#2b9070', '#3a8465', '#6a7c49', '#95723c', '#a85e33', '#a94435', '#93312c'];

/** Army size, banded: 1-3, 4-6, 7-9, 10-12, 13-15, 16+ brigades. */
const MILITARY_FILL = ['#3f4a57', '#55606b', '#77705f', '#9a7d4c', '#bd8636', '#d99423'];

function fillFor(s: GameState, id: NationId | 'israel', mode: MapMode): string {
  if (id === 'israel') return 'var(--israel)';
  const n = s.nations[id];
  if (n.collapsed) return 'url(#collapsed)';

  if (mode === 'relations') return RELATION_FILL[Math.max(0, Math.min(9, n.relations))];

  if (mode === 'stability') {
    const label = stabilityLabel(n.stability);
    const i = [
      'Very solid',
      'Moderately solid',
      'Fragile',
      'Very weak',
      'Dangerously weak',
      'Close to revolution',
      'State in turmoil',
    ].indexOf(label);
    return STABILITY_FILL[i < 0 ? 3 : i];
  }

  // Army size, in bands rather than a continuous ramp — a smooth gradient
  // over six armies of similar size just reads as one colour.
  const b = n.forces.brigades;
  const band = b <= 3 ? 0 : b <= 6 ? 1 : b <= 9 ? 2 : b <= 12 ? 3 : b <= 15 ? 4 : 5;
  return MILITARY_FILL[band];
}

function labelFor(s: GameState, id: NationId | 'israel', mode: MapMode): string {
  if (id === 'israel') {
    return `Israel — West Bank and Gaza: ${unrestLabel(s.palestine.unrest)}`;
  }
  const n = s.nations[id];
  if (n.collapsed) return `${n.name} — government collapsed`;
  const bits = [n.name];
  if (mode === 'relations') bits.push(`relations ${relationsLabel(n.relations)}`);
  else if (mode === 'stability') bits.push(stabilityLabel(n.stability));
  else
    bits.push(
      `${n.forces.brigades} brigades, ` +
        `${countOf(n.forces.equipment, 'tank').toLocaleString()} tanks`,
    );
  if (n.atWarWith.includes('israel')) bits.push('AT WAR WITH ISRAEL');
  return bits.join(' — ');
}
