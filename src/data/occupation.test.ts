import { describe, expect, it } from 'vitest';
import {
  COUNTRY_RINGS,
  SHARED_BORDERS,
  borderBetween,
  occupationPolygon,
  projectX,
  projectY,
} from './geography';
import type { Pt, XY } from './geography';

/**
 * Occupied ground is drawn as a band running inward from the frontier it was
 * taken across. These pin the geometry that makes "a quarter of Iraq" mean a
 * quarter of the way from the Iranian border to the far side of Iraq.
 */

const project = ([lon, lat]: Pt): XY => [projectX(lon), projectY(lat)];

/** Signed distance of each point along the band's inward normal. */
function inwardDepths(border: Pt[], defender: Pt[], poly: XY[]) {
  const P = border.map(project);
  const R = defender.map(project);
  const first = P[0];
  const last = P[P.length - 1];
  const len = Math.hypot(last[0] - first[0], last[1] - first[1]);
  const [ux, uy] = [(last[0] - first[0]) / len, (last[1] - first[1]) / len];
  const mid: XY = [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
  const centre: XY = [R.reduce((a, p) => a + p[0], 0) / R.length, R.reduce((a, p) => a + p[1], 0) / R.length];
  let [nx, ny] = [-uy, ux];
  if ((centre[0] - mid[0]) * nx + (centre[1] - mid[1]) * ny < 0) [nx, ny] = [-nx, -ny];
  const along = (p: XY) => (p[0] - mid[0]) * nx + (p[1] - mid[1]) * ny;
  return { ring: R.map(along), band: poly.map(along), border: P.map(along) };
}

describe('occupied ground', () => {
  it('draws nothing when no ground has changed hands', () => {
    expect(occupationPolygon(borderBetween('iraq', 'iran')!, COUNTRY_RINGS.iraq, 0)).toEqual([]);
  });

  it('knows a border from either side and admits there is none between Iran and Syria', () => {
    expect(borderBetween('iran', 'iraq')).toBe(borderBetween('iraq', 'iran'));
    expect(borderBetween('iran', 'syria')).toBeNull();
  });

  it('stays on the defender’s side of the frontier', () => {
    const border = borderBetween('iraq', 'iran')!;
    const poly = occupationPolygon(border, COUNTRY_RINGS.iraq, 0.25);
    const { band, border: line } = inwardDepths(border, COUNTRY_RINGS.iraq, poly);
    // The band is the frontier moved inward, so its near edge follows the
    // frontier's own bends and sits a hair behind the deepest of them.
    expect(Math.min(...band)).toBeGreaterThanOrEqual(Math.min(...line) - 2.01);
  });

  it('reaches a quarter of the way across at a quarter, and all the way at one', () => {
    const border = borderBetween('iraq', 'iran')!;
    const quarter = occupationPolygon(border, COUNTRY_RINGS.iraq, 0.25);
    const whole = occupationPolygon(border, COUNTRY_RINGS.iraq, 1);
    const q = inwardDepths(border, COUNTRY_RINGS.iraq, quarter);
    const w = inwardDepths(border, COUNTRY_RINGS.iraq, whole);
    const depth = Math.max(...q.ring);

    // The frontier moved a quarter of the country's depth inward.
    expect(Math.max(...q.band)).toBeCloseTo(Math.max(...q.border) + depth * 0.25, 5);
    // At one, every vertex of the country is inside the band's depth.
    expect(Math.max(...w.band)).toBeGreaterThanOrEqual(Math.max(...w.ring) - 1e-6);
  });

  it('builds every shared frontier out of vertices both countries actually have', () => {
    const has = (ring: Pt[], p: Pt) => ring.some((q) => q[0] === p[0] && q[1] === p[1]);
    for (const b of SHARED_BORDERS) {
      const ra = COUNTRY_RINGS[b.a];
      const rb = COUNTRY_RINGS[b.b];
      // Libya is off the edge of the frame and has no outline to check.
      if (!ra || !rb) continue;
      for (const p of b.line) {
        expect(has(ra, p), `${b.a} lacks ${p}`).toBe(true);
        expect(has(rb, p), `${b.b} lacks ${p}`).toBe(true);
      }
    }
  });
});
