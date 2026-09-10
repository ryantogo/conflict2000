/**
 * Operations on named-item inventories.
 *
 * The engine never reaches into a `Fleet` directly. It asks how many of a
 * category are present, what they are worth, and moves slices of them between
 * a stockpile and a border. Slices are drawn proportionally: an order to send
 * four hundred tanks forward sends a representative cut of the motor pool, not
 * the four hundred best, because a quartermaster is not a min-maxer.
 */

import type { Fleet } from './types';
import type { ArmsCategory } from '../data/equipment';
import { AIR_CATEGORIES, COMBAT_REFERENCE, equipmentById } from '../data/equipment';
import type { Origin } from '../data/equipment';

export function emptyFleet(): Fleet {
  return {};
}

export function cloneFleet(f: Fleet): Fleet {
  return { ...f };
}

function inCategory(id: string, cats: ArmsCategory[]): boolean {
  const e = equipmentById(id);
  return !!e && cats.includes(e.category);
}

/** How many units of these categories are held. */
export function countOf(f: Fleet, ...cats: ArmsCategory[]): number {
  let n = 0;
  for (const [id, held] of Object.entries(f)) {
    if (held > 0 && inCategory(id, cats)) n += held;
  }
  return n;
}

/** The summed combat power of these categories. */
export function powerOf(f: Fleet, ...cats: ArmsCategory[]): number {
  let p = 0;
  for (const [id, held] of Object.entries(f)) {
    if (held <= 0) continue;
    const e = equipmentById(id);
    if (e && cats.includes(e.category)) p += held * e.power;
  }
  return p;
}

/** Every air arm at once — the question `airUnits` used to answer. */
export function airCount(f: Fleet): number {
  return countOf(f, ...AIR_CATEGORIES);
}

export function airPower(f: Fleet): number {
  return powerOf(f, ...AIR_CATEGORIES);
}

/** Total units of anything. */
export function totalUnits(f: Fleet): number {
  let n = 0;
  for (const held of Object.values(f)) if (held > 0) n += held;
  return n;
}

export function addUnits(f: Fleet, id: string, n: number): void {
  if (n <= 0) return;
  f[id] = (f[id] ?? 0) + n;
}

export function mergeInto(dst: Fleet, src: Fleet): void {
  for (const [id, n] of Object.entries(src)) addUnits(dst, id, n);
}

/**
 * Remove up to `want` units of these categories, spread across what is held,
 * and return what was taken. Largest holdings give up the most; the remainder
 * is walked off one at a time so the count comes out exact.
 */
export function drawFrom(f: Fleet, want: number, ...cats: ArmsCategory[]): Fleet {
  const taken: Fleet = {};
  if (want <= 0) return taken;

  const held = Object.entries(f).filter(([id, n]) => n > 0 && inCategory(id, cats));
  const available = held.reduce((a, [, n]) => a + n, 0);
  if (available === 0) return taken;

  const target = Math.min(want, available);
  let drawn = 0;
  for (const [id, n] of held) {
    const share = Math.floor((n / available) * target);
    if (share > 0) {
      taken[id] = share;
      f[id] = n - share;
      drawn += share;
    }
  }

  // Rounding leaves a few behind. Walk the remainder off the deepest stacks.
  for (const [id] of [...held].sort((a, b) => (f[b[0]] ?? 0) - (f[a[0]] ?? 0))) {
    if (drawn >= target) break;
    if ((f[id] ?? 0) <= 0) continue;
    f[id] -= 1;
    taken[id] = (taken[id] ?? 0) + 1;
    drawn++;
  }

  compact(f);
  return taken;
}

/** Remove a fraction of these categories, rounded down, and return it. */
export function drawFraction(f: Fleet, frac: number, ...cats: ArmsCategory[]): Fleet {
  return drawFrom(f, Math.floor(countOf(f, ...cats) * frac), ...cats);
}

/** Remove everything in these categories and return it. */
export function drawAll(f: Fleet, ...cats: ArmsCategory[]): Fleet {
  return drawFrom(f, countOf(f, ...cats), ...cats);
}

/**
 * Battlefield losses: each holding loses `rate` of its strength, rounded the
 * way the old flat model rounded it. Returns how many units were destroyed.
 */
export function attrite(f: Fleet, rate: number, ...cats: ArmsCategory[]): number {
  if (rate <= 0) return 0;
  let lost = 0;
  for (const [id, n] of Object.entries(f)) {
    if (n <= 0 || !inCategory(id, cats)) continue;
    const left = Math.max(0, Math.floor(n * (1 - rate)));
    lost += n - left;
    f[id] = left;
  }
  compact(f);
  return lost;
}

/** Drop empty holdings so a fleet does not accumulate zeroes forever. */
export function compact(f: Fleet): void {
  for (const [id, n] of Object.entries(f)) {
    if (n <= 0) delete f[id];
  }
}

/** What is actually parked here, heaviest type first, for the review screens. */
export function breakdown(
  f: Fleet,
  ...cats: ArmsCategory[]
): { id: string; name: string; count: number; power: number }[] {
  const out: { id: string; name: string; count: number; power: number }[] = [];
  for (const [id, held] of Object.entries(f)) {
    if (held <= 0) continue;
    const e = equipmentById(id);
    if (!e || !cats.includes(e.category)) continue;
    out.push({ id, name: e.name, count: held, power: e.power });
  }
  return out.sort((a, b) => b.power - a.power || b.count - a.count);
}

/** Mean power per unit: how good the kit is, regardless of how much there is. */
export function grade(f: Fleet, ...cats: ArmsCategory[]): number {
  const n = countOf(f, ...cats);
  return n === 0 ? 0 : powerOf(f, ...cats) / n;
}

// ---------------------------------------------------------------------------
// Combat weight
// ---------------------------------------------------------------------------

/**
 * Per-unit weights, expressed against a reference-quality unit so that the
 * arithmetic is identical to the flat-count model it replaces. A tank of
 * reference power is still worth 0.09 to us and 0.06 to them.
 */
const OUR_WEIGHT = {
  tank: 0.09 / COMBAT_REFERENCE.tank,
  air: 0.5 / COMBAT_REFERENCE.air,
  sam: 1.2 / COMBAT_REFERENCE.sam,
};

const THEIR_WEIGHT = {
  tank: 0.06 / COMBAT_REFERENCE.tank,
  air: 0.35 / COMBAT_REFERENCE.air,
  sam: 1.0 / COMBAT_REFERENCE.sam,
};

/**
 * Power in a category, with each unit discounted by how serviceable its
 * origin's equipment currently is. A grounded F-16 is still an F-16 on the
 * inventory and worth nothing at all on the day.
 */
function servicedPower(
  f: Fleet,
  readiness: Record<string, number> | undefined,
  cats: ArmsCategory[],
): number {
  let p = 0;
  for (const [id, held] of Object.entries(f)) {
    if (held <= 0) continue;
    const e = equipmentById(id);
    if (!e || !cats.includes(e.category)) continue;
    p += held * e.power * (readiness?.[e.origin] ?? 1);
  }
  return p;
}

/**
 * What this inventory is worth on an Israeli front. `readiness` is optional
 * so that anything only interested in raw tonnage can leave it out.
 */
export function israeliEquipmentWeight(f: Fleet, readiness?: Record<string, number>): number {
  return (
    servicedPower(f, readiness, ['tank']) * OUR_WEIGHT.tank +
    servicedPower(f, readiness, AIR_CATEGORIES) * OUR_WEIGHT.air +
    servicedPower(f, readiness, ['sam']) * OUR_WEIGHT.sam
  );
}

/** Mean serviceability across everything held, for the review screens. */
export function fleetReadiness(f: Fleet, readiness: Record<string, number>): number {
  let held = 0;
  let serviced = 0;
  for (const [id, n] of Object.entries(f)) {
    if (n <= 0) continue;
    const e = equipmentById(id);
    if (!e) continue;
    held += n;
    serviced += n * (readiness[e.origin] ?? 1);
  }
  return held === 0 ? 1 : serviced / held;
}

/** How much of this fleet comes from each source. */
export function byOrigin(f: Fleet): Record<Origin, number> {
  const out = {} as Record<Origin, number>;
  for (const [id, n] of Object.entries(f)) {
    if (n <= 0) continue;
    const e = equipmentById(id);
    if (!e) continue;
    out[e.origin] = (out[e.origin] ?? 0) + n;
  }
  return out;
}

/** What it is worth to the other side. */
export function enemyEquipmentWeight(f: Fleet): number {
  return (
    powerOf(f, 'tank') * THEIR_WEIGHT.tank +
    airPower(f) * THEIR_WEIGHT.air +
    powerOf(f, 'sam') * THEIR_WEIGHT.sam
  );
}
