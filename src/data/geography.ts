/**
 * Map geometry.
 *
 * The 1990 original shipped six EGA maps (`MDLEAST`, `ISRAEL`, `SYRIA`,
 * `IRAQ`, `IRAQ1`, `LIBYA`) as run-length scanline data — flat colour blocks,
 * blocky coastlines, capitals marked with a dot and a monospace label. All six
 * are Levant-scale; none shows the whole roster at once.
 *
 * This is a new map in that idiom rather than a trace of theirs, because the
 * map here has a job the original's did not: it is the control surface you set
 * policy from, so every playable state has to be on it and comfortably
 * clickable. Coordinates are real longitude/latitude, simplified to the
 * handful of vertices that read at this scale, so the geometry can be checked
 * against an atlas instead of eyeballed in pixels.
 *
 * Shared borders are defined exactly once and reused (forwards or reversed) by
 * both neighbours, so no sliver can open up between two countries.
 */

export type Pt = [number, number]; // [lon, lat]

// --- projection ------------------------------------------------------------

/** Window: the Levant and its approaches, from the Nile to the Zagros. */
export const LON0 = 25.5;
export const LON1 = 51.8;
export const LAT0 = 24.5;
export const LAT1 = 38.2;

/** Equirectangular, with longitude squeezed by cos(mid-latitude). */
const KX = Math.cos((((LAT0 + LAT1) / 2) * Math.PI) / 180);
const SCALE = 36;

export const MAP_W = Math.round((LON1 - LON0) * KX * SCALE);
export const MAP_H = Math.round((LAT1 - LAT0) * SCALE);

export function projectX(lon: number): number {
  return (lon - LON0) * KX * SCALE;
}

export function projectY(lat: number): number {
  return (LAT1 - lat) * SCALE;
}

export function toPath(ring: Pt[]): string {
  return (
    ring
      .map(([lon, lat], i) => `${i === 0 ? 'M' : 'L'}${projectX(lon).toFixed(1)},${projectY(lat).toFixed(1)}`)
      .join('') + 'Z'
  );
}

// --- shared anchors --------------------------------------------------------
// Tripoints and coastal landmarks, named so the borders below read as prose.

const RAFAH: Pt = [34.27, 31.22];
const ROSH_HANIKRA: Pt = [35.1, 33.09];
const LEB_SYR_COAST: Pt = [35.98, 34.63];
const SYR_TUR_COAST: Pt = [35.92, 35.92];
const METULA: Pt = [35.62, 33.25];
const YARMOUK: Pt = [35.6, 32.71];
const DEAD_N: Pt = [35.47, 31.75];
const DEAD_S: Pt = [35.4, 31.1];
const ARAVA_S: Pt = [34.99, 29.54]; // Eilat / Aqaba, head of the gulf
const TABA: Pt = [34.9, 29.49];
const RAS_MUHAMMAD: Pt = [34.25, 27.73];
const SUEZ: Pt = [32.55, 29.95];
const TANF: Pt = [38.79, 33.37]; // Syria / Iraq / Jordan
const SYR_IRQ_N: Pt = [42.35, 37.3];
const IRQ_TUR_IRN: Pt = [44.8, 37.15];
const SHATT: Pt = [48.05, 30.02];
const JOR_IRQ_SAU: Pt = [39.15, 32.15];
const IRQ_KUW: Pt = [46.55, 29.2];

// --- border segments -------------------------------------------------------

const coastIsrael: Pt[] = [RAFAH, [34.55, 31.55], [34.75, 32.05], [34.92, 32.55], ROSH_HANIKRA];

const coastLebanon: Pt[] = [
  ROSH_HANIKRA,
  [35.22, 33.55],
  [35.38, 33.9],
  [35.5, 34.3],
  [35.78, 34.45],
  LEB_SYR_COAST,
];

const coastSyria: Pt[] = [LEB_SYR_COAST, [35.88, 35.1], [35.78, 35.55], SYR_TUR_COAST];

const isrLeb: Pt[] = [ROSH_HANIKRA, [35.3, 33.09], [35.5, 33.2], METULA];

/** Israel holds the Golan in 2000, so the line runs east of it. */
const isrSyr: Pt[] = [METULA, [35.8, 33.1], [35.88, 32.9], [35.75, 32.78], YARMOUK];

const isrJor: Pt[] = [
  YARMOUK,
  [35.57, 32.4],
  [35.55, 32.0],
  DEAD_N,
  [35.5, 31.45],
  DEAD_S,
  [35.25, 30.6],
  [35.12, 30.1],
  ARAVA_S,
];

const isrEgy: Pt[] = [TABA, [34.75, 30.15], [34.5, 30.7], RAFAH];

const lebSyr: Pt[] = [
  LEB_SYR_COAST,
  [36.3, 34.6],
  [36.42, 34.2],
  [36.28, 33.9],
  [36.05, 33.6],
  [35.9, 33.45],
  METULA,
];

const syrTur: Pt[] = [
  SYR_TUR_COAST,
  [36.15, 36.2],
  [36.65, 36.25],
  [37.1, 36.66],
  [38.2, 36.9],
  [39.3, 36.7],
  [40.7, 37.1],
  [41.5, 37.1],
  SYR_IRQ_N,
];

const syrIrq: Pt[] = [SYR_IRQ_N, [41.3, 35.6], [40.4, 34.6], [39.3, 33.7], TANF];

const syrJor: Pt[] = [TANF, [37.6, 32.9], [36.85, 32.31], [36.2, 32.32], YARMOUK];

const jorIrq: Pt[] = [TANF, JOR_IRQ_SAU];

const jorSau: Pt[] = [
  JOR_IRQ_SAU,
  [38.4, 31.4],
  [37.4, 30.5],
  [37.1, 29.99],
  [36.0, 29.7],
  ARAVA_S,
];

const irqTur: Pt[] = [SYR_IRQ_N, [42.8, 37.35], [43.5, 37.25], [44.2, 37.3], IRQ_TUR_IRN];

const irqIrn: Pt[] = [
  IRQ_TUR_IRN,
  [45.42, 35.98],
  [46.15, 35.1],
  [45.9, 34.3],
  [46.1, 33.6],
  [47.35, 33.5],
  [47.7, 32.6],
  [47.85, 31.8],
  [47.65, 31.0],
  [48.02, 30.45],
  SHATT,
];

const irqKuw: Pt[] = [SHATT, [47.7, 30.1], [47.2, 30.35], IRQ_KUW];

const irqSau: Pt[] = [IRQ_KUW, [44.7, 29.2], [42.1, 30.5], [40.4, 31.4], JOR_IRQ_SAU];

// --- ring assembly ---------------------------------------------------------

function rev(seg: Pt[]): Pt[] {
  return seg.slice().reverse();
}

/**
 * Join segments end to end, dropping the joint vertices each pair shares.
 * The last segment normally arrives back at the first vertex, which is also
 * dropped: `toPath` emits a Z, so keeping it would add a zero-length edge.
 */
function ring(...parts: Pt[][]): Pt[] {
  const out: Pt[] = [];
  for (const part of parts) {
    for (const p of part) {
      const last = out[out.length - 1];
      if (last && last[0] === p[0] && last[1] === p[1]) continue;
      out.push(p);
    }
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && first[0] === last[0] && first[1] === last[1]) out.pop();
  return out;
}

// --- countries -------------------------------------------------------------

// Each ring walks its frontier as one continuous loop: every segment has to
// start where the previous one finished, which is why several are reversed.
// Get a direction wrong and the outline doubles back on itself, which shows
// up as one country apparently spilling into its neighbour.

// Rafah -> up the coast -> Lebanon -> the Golan -> the Jordan valley -> Sinai.
export const ISRAEL_RING = ring(coastIsrael, isrLeb, isrSyr, isrJor, [TABA], isrEgy);

// Up the coast from Rosh Hanikra, down the Anti-Lebanon, back along the north.
export const LEBANON_RING = ring(coastLebanon, lebSyr, rev(isrLeb));

// Latakia -> Turkey -> Iraq -> Jordan -> the Golan -> the Lebanese border.
export const SYRIA_RING = ring(coastSyria, syrTur, syrIrq, syrJor, rev(isrSyr), rev(lebSyr));

// The Yarmouk east to al-Tanf, then south and west back up the Arava.
export const JORDAN_RING = ring(rev(syrJor), jorIrq, jorSau, rev(isrJor));

export const IRAQ_RING = ring(rev(syrIrq), irqTur, irqIrn, irqKuw, irqSau, rev(jorIrq));

/** Only the western third of Iran is in frame; SVG clips the rest. */
export const IRAN_RING = ring(
  [IRQ_TUR_IRN, [44.6, 39.6], [53.5, 39.6], [53.5, 26.2]],
  [[52.0, 27.4], [51.0, 28.8], [50.0, 29.5], [49.0, 30.1], [48.6, 30.05]],
  rev(irqIrn),
);

export const EGYPT_RING = ring(
  [
    [23.0, 31.3],
    [25.0, 31.5],
    [27.0, 31.2],
    [29.0, 31.0],
    [30.5, 31.45],
    [31.6, 31.55],
    [32.3, 31.2],
    [33.4, 31.1],
  ],
  [RAFAH],
  rev(isrEgy),
  // South down Sinai's Gulf of Aqaba shore to Ras Muhammad, then back north
  // up its Gulf of Suez shore. The gulf is an inlet, so the peninsula's west
  // coast must stay *east* of the African coast that follows.
  [
    [34.75, 28.9],
    [34.55, 28.35],
    RAS_MUHAMMAD,
    [33.95, 27.9],
    [33.55, 28.35],
    [33.2, 28.75],
    [32.95, 29.2],
    [32.75, 29.6],
    SUEZ,
  ],
  // Then south again down the African shore of the Red Sea.
  [
    [32.4, 29.6],
    [32.65, 28.9],
    [33.15, 28.1],
    [33.7, 27.3],
    [34.25, 26.4],
    [34.8, 25.5],
    [35.5, 24.3],
    [36.2, 23.0],
    [36.9, 21.5],
    [23.0, 21.5],
  ],
);

// --- backdrop --------------------------------------------------------------
// Not playable, drawn muted, purely so the region reads as a region.

export const SAUDI_RING = ring(
  [ARAVA_S],
  rev(jorSau),
  rev(irqSau),
  [
    [48.1, 29.1],
    [48.5, 28.5],
    [50.2, 26.3],
    [50.8, 24.7],
    [51.5, 24.2],
    [53.5, 22.0],
    [36.0, 21.0],
    [36.0, 25.5],
    [35.5, 27.0],
    [35.15, 28.0],
    [34.98, 28.9],
  ],
);

export const TURKEY_RING = ring([
  SYR_TUR_COAST,
  [35.55, 36.6],
  [34.0, 36.3],
  [32.8, 36.1],
  [31.0, 36.3],
  [30.0, 36.9],
  [28.5, 36.7],
  [26.5, 37.0],
  [26.5, 40.0],
  [46.5, 40.0],
  IRQ_TUR_IRN,
  ...rev(irqTur).slice(1),
  ...rev(syrTur).slice(1),
]);

export const KUWAIT_RING: Pt[] = [
  IRQ_KUW,
  [47.2, 30.35],
  [48.1, 29.55],
  [48.4, 28.55],
  [47.7, 28.5],
];

export const CYPRUS_RING: Pt[] = [
  [32.3, 34.65],
  [33.9, 34.6],
  [34.55, 35.55],
  [33.6, 35.35],
  [32.9, 35.4],
];

// --- the territories -------------------------------------------------------

export const WEST_BANK_RING: Pt[] = [
  [35.0, 32.5],
  [35.55, 32.38],
  [35.55, 31.9],
  DEAD_N,
  [35.2, 31.35],
  [34.95, 31.55],
  [35.0, 32.1],
];

export const GAZA_RING: Pt[] = [
  [34.21, 31.32],
  [34.56, 31.55],
  [34.48, 31.61],
];

// --- points of interest ----------------------------------------------------

export interface Place {
  name: string;
  lon: number;
  lat: number;
  /** Nudge the label off the dot, in projected units. */
  dx?: number;
  dy?: number;
}

export const CAPITALS: Record<string, Place> = {
  // Jerusalem and Amman are 70km apart, so one label goes west over the sea
  // and the other east into Jordan, or they collide at every scale.
  israel: { name: 'JERUSALEM', lon: 35.21, lat: 31.77, dx: -64, dy: -5 },
  egypt: { name: 'CAIRO', lon: 31.24, lat: 30.05, dx: -8, dy: 13 },
  lebanon: { name: 'BEIRUT', lon: 35.5, lat: 33.89, dx: -47, dy: 3 },
  syria: { name: 'DAMASCUS', lon: 36.3, lat: 33.51, dx: 7, dy: 9 },
  jordan: { name: 'AMMAN', lon: 35.93, lat: 31.95, dx: 7, dy: -3 },
  iraq: { name: 'BAGHDAD', lon: 44.36, lat: 33.31, dx: 7, dy: 3 },
  iran: { name: 'TEHRAN', lon: 51.39, lat: 35.69, dx: -52, dy: -5 },
};

/**
 * Where each country's name is printed. Explicit rather than derived from a
 * centroid: Israel's centroid falls in the Negev, Lebanon's is a sliver, and
 * Iran's is off the edge of the frame.
 */
export const LABEL_ANCHORS: Record<string, Pt> = {
  israel: [34.85, 30.5],
  egypt: [29.3, 28.0],
  // Lebanon is narrower than its own name at any scale, so the label sits
  // offshore and points back at the country with a leader line.
  lebanon: [34.15, 34.45],
  syria: [38.9, 35.1],
  jordan: [37.2, 31.0],
  iraq: [42.6, 32.6],
  iran: [49.3, 32.6],
};

/** Lebanon is too narrow to letter, so its label sits outside on a leader. */
export const LABEL_LEADERS: Record<string, Pt> = {
  lebanon: [35.45, 34.15],
};

export const SEA_LABELS: Place[] = [
  { name: 'MEDITERRANEAN SEA', lon: 30.2, lat: 34.2 },
  { name: 'RED SEA', lon: 36.0, lat: 25.6 },
  { name: 'THE GULF', lon: 50.0, lat: 27.4 },
];

/**
 * The four borders, as polylines. Israeli strength on a front is drawn
 * directly along the frontier it is holding — pips scattered near the Golan
 * and the Lebanese border are unreadable at this scale, and a thickened line
 * says the same thing without ambiguity about whose side it is on.
 */
export const FRONT_LINES: Record<string, Pt[]> = {
  lebanon: isrLeb,
  syria: isrSyr,
  jordan: isrJor,
  egypt: isrEgy,
};

/** Midpoint of each front, for the brigade count. */
export const FRONT_LABELS: Record<string, Pt> = {
  lebanon: [35.36, 33.16],
  syria: [35.95, 32.95],
  jordan: [35.62, 31.5],
  egypt: [34.48, 30.45],
};

/** Libya is off the west edge; it gets a margin card instead of a shape. */
export const OFF_MAP = ['libya'] as const;

/**
 * Two framings of the same projection.
 *
 * At regional scale Israel is about twenty-five pixels wide, and four borders
 * cannot be told apart inside that. The original had the same problem and
 * solved it with a separate Israel-scale screen; here it is one SVG and a
 * different viewBox, so nothing has to be re-projected.
 */
export type ViewId = 'region' | 'levant';

/**
 * Both framings keep roughly the region view's aspect ratio, so the map
 * element never changes shape and nothing is letterboxed.
 */
const VIEW_BOUNDS: Record<ViewId, { lon0: number; lat0: number; lon1: number; lat1: number }> = {
  region: { lon0: LON0, lat0: LAT0, lon1: LON1, lat1: LAT1 },
  levant: { lon0: 30.6, lat0: 29.1, lon1: 41.0, lat1: 34.6 },
};

export function viewBoxFor(view: ViewId): string {
  const b = VIEW_BOUNDS[view];
  const x = projectX(b.lon0);
  const y = projectY(b.lat1);
  return `${x.toFixed(1)} ${y.toFixed(1)} ${(projectX(b.lon1) - x).toFixed(1)} ${(
    projectY(b.lat0) - y
  ).toFixed(1)}`;
}

/**
 * How many user units the view spans relative to the full region, i.e. the
 * reciprocal of the zoom. Text and marker sizes are multiplied by it so they
 * stay the same size on screen at either framing.
 */
export function viewScale(view: ViewId): number {
  const b = VIEW_BOUNDS[view];
  return (projectX(b.lon1) - projectX(b.lon0)) / MAP_W;
}

/** Labels that fall outside the close framing get moved, not clipped. */
export const LEVANT_LABEL_OVERRIDES: Record<string, Pt | null> = {
  egypt: [33.75, 29.5],
  syria: [37.7, 34.0],
  iraq: [38.95, 32.9],
  iran: null,
};

export const COUNTRY_RINGS: Record<string, Pt[]> = {
  israel: ISRAEL_RING,
  egypt: EGYPT_RING,
  lebanon: LEBANON_RING,
  syria: SYRIA_RING,
  jordan: JORDAN_RING,
  iraq: IRAQ_RING,
  iran: IRAN_RING,
};

export const BACKDROP_RINGS: { id: string; name: string; ring: Pt[] }[] = [
  { id: 'saudi', name: 'SAUDI ARABIA', ring: SAUDI_RING },
  { id: 'turkey', name: 'TURKEY', ring: TURKEY_RING },
  { id: 'kuwait', name: '', ring: KUWAIT_RING },
  { id: 'cyprus', name: '', ring: CYPRUS_RING },
];

export const BACKDROP_LABELS: Place[] = [
  { name: 'SAUDI ARABIA', lon: 43.5, lat: 26.4 },
  { name: 'TURKEY', lon: 38.0, lat: 37.6 },
];
