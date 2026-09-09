import { describe, expect, it } from 'vitest';
import {
  BACKDROP_RINGS,
  CAPITALS,
  COUNTRY_RINGS,
  FRONT_LINES,
  LABEL_ANCHORS,
  LAT0,
  LAT1,
  LON0,
  LON1,
  MAP_H,
  MAP_W,
  projectX,
  projectY,
  toPath,
  viewBoxFor,
  viewScale,
} from './geography';
import type { Pt } from './geography';

const key = ([lon, lat]: Pt) => `${lon.toFixed(4)},${lat.toFixed(4)}`;

/** How many vertices two rings have in common, to the last decimal. */
function shared(a: Pt[], b: Pt[]): number {
  const set = new Set(b.map(key));
  return a.filter((p) => set.has(key(p))).length;
}

const cross = (o: Pt, a: Pt, b: Pt) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Do segments p1-p2 and p3-p4 properly cross (endpoints touching is fine)? */
function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  // Strict signs only: shared endpoints and collinear touches are legal.
  return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

/** First pair of non-adjacent edges that cross, or null if the ring is simple. */
function findSelfIntersection(r: Pt[]): [number, number] | null {
  const n = r.length;
  for (let i = 0; i < n; i++) {
    const a1 = r[i];
    const a2 = r[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // adjacent across the closing edge
      if (segmentsCross(a1, a2, r[j], r[(j + 1) % n])) return [i, j];
    }
  }
  return null;
}

describe('map projection', () => {
  it('maps the window corners onto the canvas corners', () => {
    expect(projectX(LON0)).toBeCloseTo(0, 6);
    expect(projectY(LAT1)).toBeCloseTo(0, 6);
    expect(projectX(LON1)).toBeCloseTo(MAP_W, 0);
    expect(projectY(LAT0)).toBeCloseTo(MAP_H, 0);
  });

  it('is monotonic in both axes', () => {
    expect(projectX(30)).toBeLessThan(projectX(40));
    // Latitude increases northward; y increases downward.
    expect(projectY(30)).toBeGreaterThan(projectY(40));
  });

  it('keeps the region view at unit scale and zooms in for the Levant', () => {
    // MAP_W is rounded to a whole pixel, so this lands just shy of exactly 1.
    expect(viewScale('region')).toBeCloseTo(1, 2);
    expect(viewScale('levant')).toBeLessThan(0.5);
    for (const v of ['region', 'levant'] as const) {
      expect(viewBoxFor(v)).not.toMatch(/NaN/);
    }
  });

  it('keeps both framings at roughly the same aspect ratio', () => {
    const aspect = (v: 'region' | 'levant') => {
      const [, , w, h] = viewBoxFor(v).split(' ').map(Number);
      return w / h;
    };
    // Otherwise the map element changes shape when you switch views.
    expect(Math.abs(aspect('levant') - aspect('region'))).toBeLessThan(0.15);
  });
});

describe('country shapes', () => {
  it('produces finite paths for every shape', () => {
    for (const [id, ring] of Object.entries(COUNTRY_RINGS)) {
      expect(ring.length, id).toBeGreaterThan(3);
      expect(toPath(ring), id).not.toMatch(/NaN|undefined/);
    }
    for (const b of BACKDROP_RINGS) {
      expect(toPath(b.ring), b.id).not.toMatch(/NaN|undefined/);
    }
  });

  /**
   * The real invariant. Rings are assembled from shared border segments, and
   * traversing one in the wrong direction makes the outline double back on
   * itself — which renders as a country spilling into its neighbour. Sharing
   * vertices does not catch it, because a reversed segment shares all of them.
   */
  it('draws every country as a simple, non-self-intersecting outline', () => {
    for (const [id, r] of Object.entries(COUNTRY_RINGS)) {
      const bad = findSelfIntersection(r);
      expect(bad, `${id} self-intersects: edge ${bad?.[0]} crosses edge ${bad?.[1]}`).toBeNull();
    }
    for (const b of BACKDROP_RINGS) {
      expect(findSelfIntersection(b.ring), `${b.id} self-intersects`).toBeNull();
    }
  });

  it('never repeats the closing vertex', () => {
    // toPath emits a Z, so an explicit repeat of the first point would add a
    // zero-length edge and confuse anything that walks the outline.
    const all = [
      ...Object.entries(COUNTRY_RINGS),
      ...BACKDROP_RINGS.map((b) => [b.id, b.ring] as const),
    ];
    for (const [id, r] of all) {
      expect(key(r[0]), id).not.toBe(key(r[r.length - 1]));
    }
  });

  it('has no repeated consecutive vertices', () => {
    for (const [id, ring] of Object.entries(COUNTRY_RINGS)) {
      for (let i = 1; i < ring.length; i++) {
        expect(key(ring[i]), `${id} vertex ${i}`).not.toBe(key(ring[i - 1]));
      }
    }
  });

  /**
   * Neighbours are composed from one shared border definition, so their
   * common frontier must match vertex for vertex. If someone edits a border
   * on one side only, this is what catches the sliver.
   */
  it('shares exact vertices along every common frontier', () => {
    const pairs: [string, string, number][] = [
      ['israel', 'lebanon', 4],
      ['israel', 'syria', 5],
      ['israel', 'jordan', 9],
      ['israel', 'egypt', 4],
      ['lebanon', 'syria', 7],
      ['syria', 'jordan', 5],
      ['syria', 'iraq', 5],
      ['jordan', 'iraq', 2],
      ['iraq', 'iran', 11],
    ];
    for (const [a, b, atLeast] of pairs) {
      expect(shared(COUNTRY_RINGS[a], COUNTRY_RINGS[b]), `${a}/${b}`).toBeGreaterThanOrEqual(
        atLeast,
      );
    }
  });

  it('puts every capital inside the map window', () => {
    for (const [id, p] of Object.entries(CAPITALS)) {
      expect(p.lon, id).toBeGreaterThan(LON0);
      expect(p.lon, id).toBeLessThan(LON1);
      expect(p.lat, id).toBeGreaterThan(LAT0);
      expect(p.lat, id).toBeLessThan(LAT1);
    }
  });

  it('gives every drawn country a label anchor and every front a line', () => {
    for (const id of Object.keys(COUNTRY_RINGS)) {
      expect(LABEL_ANCHORS[id], id).toBeTruthy();
    }
    for (const f of ['egypt', 'jordan', 'lebanon', 'syria']) {
      expect(FRONT_LINES[f], f).toBeTruthy();
      expect(FRONT_LINES[f].length, f).toBeGreaterThan(1);
    }
  });

  it('draws each front along the border it actually holds', () => {
    // The front line must be a subset of both Israel's ring and the
    // neighbour's, or it is drawn somewhere other than that frontier.
    for (const f of ['egypt', 'jordan', 'lebanon', 'syria']) {
      const line = FRONT_LINES[f];
      expect(shared(line, COUNTRY_RINGS.israel), `${f} vs israel`).toBe(line.length);
      expect(shared(line, COUNTRY_RINGS[f]), `${f} vs ${f}`).toBe(line.length);
    }
  });
});
