/**
 * The Israeli defence industry.
 *
 * Everything else in the arms model is somebody else's decision: a supplier
 * decides whether to sell, Washington decides whether to embargo, and the
 * delivery arrives when it arrives. A production line is the one source of
 * equipment nobody else has a veto over — which is the entire strategic point
 * of having one, and the reason it is worse value per shekel than importing.
 *
 * A line is a standing commitment rather than a monthly order. You open it,
 * the Treasury pays for it every month until you close it, and it delivers
 * into the stockpile like any other arrival. Development projects pay for
 * years before they deliver anything at all — the Mk 4 was in development in
 * 2000 and did not reach a unit until 2004.
 */

import type { EquipmentSpec } from './equipment';

/** Types that exist only because Israel builds them. */
export const DOMESTIC_EQUIPMENT: EquipmentSpec[] = [
  { id: 'merkava4', name: 'Merkava Mk 4', category: 'tank', power: 15, origin: 'israel' },
  { id: 'arrow2', name: 'Arrow 2 (Homa)', category: 'sam', power: 22, origin: 'israel' },
  { id: 'heron', name: 'IAI Heron', category: 'surveillance', power: 18, origin: 'israel' },
  { id: 'ofek', name: 'Ofek reconnaissance satellite', category: 'satellite', power: 0, origin: 'israel' },
];

export interface ProductionLine {
  /** The line's own id, and the equipment id it delivers. */
  id: string;
  builds: string;
  name: string;
  description: string;
  /** Units delivered per month while the line is running. */
  rate: number;
  /** $M per month to keep the line open. */
  cost: number;
  /** Months of development before the line can open at all. */
  development: number;
  /** $M per month while it is still in development. */
  developmentCost: number;
}

/**
 * Per unit these are dearer than the equivalent import — an M1A2 is $5 M and
 * a Merkava off this line is nearer $7 M. You are paying for the fact that no
 * ambassador can stop it.
 */
export const PRODUCTION_LINES: ProductionLine[] = [
  {
    id: 'line_ofek',
    builds: 'ofek',
    name: 'Ofek satellite programme',
    description:
      'Reconnaissance from orbit. Sees every capital in the region at once, and ' +
      'no security service can arrest a satellite.',
    rate: 1,
    cost: 55,
    development: 18,
    developmentCost: 75,
  },
  {
    id: 'line_merkava3',
    builds: 'merkava3',
    name: 'Merkava Mk 3 line',
    description:
      'The Baz production line at Tel HaShomer. In full production and entirely ours.',
    rate: 5,
    cost: 35,
    development: 0,
    developmentCost: 0,
  },
  {
    id: 'line_merkava4',
    builds: 'merkava4',
    name: 'Merkava Mk 4 programme',
    description:
      'A new hull, a new turret and a 1,500hp powerpack. Years of money before a single tank.',
    rate: 4,
    cost: 48,
    development: 30,
    developmentCost: 60,
  },
  {
    id: 'line_arrow2',
    builds: 'arrow2',
    name: 'Arrow 2 batteries',
    description:
      'The Homa anti-ballistic system. The first battery went operational in March.',
    rate: 1,
    cost: 30,
    development: 0,
    developmentCost: 0,
  },
  {
    id: 'line_heron',
    builds: 'heron',
    name: 'Heron reconnaissance line',
    description:
      'Long-endurance unmanned surveillance. Sees a great deal and costs nobody a pilot.',
    rate: 2,
    cost: 18,
    development: 6,
    developmentCost: 20,
  },
];

/**
 * How much of the fog each overhead asset lifts, everywhere at once. A Heron
 * watches a border; a satellite watches a country, and there is no network to
 * roll up and nobody to arrest.
 */
export const OVERHEAD_VALUE: Record<string, number> = {
  heron: 0.02,
  ofek: 0.16,
};

export function lineById(id: string): ProductionLine | undefined {
  return PRODUCTION_LINES.find((l) => l.id === id);
}
