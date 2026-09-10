/**
 * The other side rearms.
 *
 * Every month a state that still has a government converts a little of its
 * stability into equipment. Losses are made good first, from the best type it
 * can actually get, and once an arm is back to its 2000 establishment the
 * money goes into modernisation instead — which is how a Syrian tank park
 * full of T-55s slowly becomes a Syrian tank park with more T-72s in it,
 * without anybody's order of battle doubling.
 *
 * A war accelerates this. Being ground down and rebuilding with better kit is
 * the whole story of every army on these borders since 1948.
 */

import type { GameState, Nation } from './types';
import { NATION_IDS } from './types';
import type { ArmsCategory } from '../data/equipment';
import { equipmentById } from '../data/equipment';
import { addUnits, countOf } from './fleet';
import { openingInventory } from '../data/inventory2000';
import { ESTABLISHMENT_CEILING, REARMAMENT } from '../data/procurement2000';
import type { Rng } from './rng';

export interface RearmamentEvent {
  text: string;
  category: 'economy';
  weight: number;
}

const ARMS: ArmsCategory[] = ['tank', 'aircraft', 'sam'];

/** The best type this state can get in a given arm, or nothing. */
function bestAccessible(n: Nation, cat: ArmsCategory): string | undefined {
  for (const id of REARMAMENT[n.id].access) {
    const e = equipmentById(id);
    if (e && e.category === cat) return id;
  }
  return undefined;
}

/**
 * How much of the monthly deficit is made good. At 5%, an army knocked to
 * half strength is around two thirds of the way back inside two years — fast
 * enough that grinding a neighbour down and strolling in a year later does
 * not work, slow enough that a war still costs them something lasting.
 */
const RECONSTITUTION_RATE = 0.05;

/** The arm furthest below its 2000 establishment, and by how many units. */
function worstDeficit(
  n: Nation,
  establishment: Record<ArmsCategory, number>,
): { cat: ArmsCategory; deficit: number } | undefined {
  let worst: { cat: ArmsCategory; deficit: number } | undefined;
  for (const cat of ARMS) {
    const target = establishment[cat];
    if (target === 0 || !bestAccessible(n, cat)) continue;
    const deficit = target - countOf(n.forces.equipment, cat);
    if (deficit <= 0) continue;
    if (!worst || deficit > worst.deficit) worst = { cat, deficit };
  }
  return worst;
}

/** Once everything is up to strength, the arm with the most room to grow. */
function roomiestArm(
  n: Nation,
  establishment: Record<ArmsCategory, number>,
): ArmsCategory | undefined {
  let best: ArmsCategory | undefined;
  let bestRatio = Infinity;
  for (const cat of ARMS) {
    const target = establishment[cat];
    if (target === 0 || !bestAccessible(n, cat)) continue;
    const ratio = countOf(n.forces.equipment, cat) / target;
    if (ratio >= ESTABLISHMENT_CEILING) continue;
    if (ratio < bestRatio) {
      bestRatio = ratio;
      best = cat;
    }
  }
  return best;
}

export function runRearmament(s: GameState, rng: Rng): RearmamentEvent[] {
  const events: RearmamentEvent[] = [];

  for (const id of NATION_IDS) {
    const n = s.nations[id];
    if (n.collapsed) continue;

    const plan = REARMAMENT[id];
    // A state that cannot govern itself cannot run a procurement programme,
    // and one that is being invaded runs it in a hurry.
    const capacity = (n.stability / 100) * (n.atWarWith.length > 0 ? 1.5 : 1);
    if (capacity <= 0) continue;

    const establishment = {} as Record<ArmsCategory, number>;
    const opening = openingInventory(id);
    for (const cat of ARMS) establishment[cat] = countOf(opening, cat);

    // --- Reconstitution: making good what was lost ------------------------
    // Driven by the size of the hole, not a flat trickle. An army that has
    // just been halved replaces armour quickly, because that is what being
    // halved does to a defence ministry's priorities; one that is at strength
    // is not buying tanks in a panic. Self-limiting, since the deficit
    // shrinks as it is filled.
    const shortest = worstDeficit(n, establishment);
    if (shortest) {
      const { cat, deficit } = shortest;
      const type = bestAccessible(n, cat);
      if (type) {
        const delivered = Math.max(1, Math.round(deficit * RECONSTITUTION_RATE * capacity));
        addUnits(n.forces.equipment, type, Math.min(delivered, deficit));
        const name = equipmentById(type)?.name ?? type;
        // A visible rebuild is news. Routine deliveries are a cabinet note.
        const notable = delivered >= 25 && rng.chance(0.35);
        events.push({
          text: notable
            ? `${n.name} rearms: ${name} deliveries reported at ${n.capital}`
            : `${n.name} takes delivery of ${delivered} x ${name}.`,
          category: 'economy',
          weight: notable ? 1 : 0,
        });
        continue;
      }
    }

    // --- Modernisation: slow growth once everything is up to strength -----
    n.rearmPoints += plan.rate * capacity;
    if (n.rearmPoints < 1) continue;

    const cat = roomiestArm(n, establishment);
    if (!cat) {
      // Nothing left worth building. Don't let credit pile up for ever.
      n.rearmPoints = Math.min(n.rearmPoints, 1);
      continue;
    }
    const type = bestAccessible(n, cat);
    if (!type) continue;

    const room = Math.max(
      0,
      Math.floor(establishment[cat] * ESTABLISHMENT_CEILING) - countOf(n.forces.equipment, cat),
    );
    const delivered = Math.min(Math.floor(n.rearmPoints), room);
    if (delivered <= 0) continue;

    addUnits(n.forces.equipment, type, delivered);
    n.rearmPoints -= delivered;
    events.push({
      text: `${n.name} takes delivery of ${delivered} x ${equipmentById(type)?.name ?? type}.`,
      category: 'economy',
      weight: 0,
    });
  }

  return events;
}
