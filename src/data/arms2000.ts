/**
 * The arms market, updated from the original's 1980s catalogue to what an
 * Israeli defence minister could plausibly sign for in 2000.
 *
 * The four suppliers keep their original personalities. Washington sells the
 * best kit but watches your behaviour; London is reliable and narrow; Paris
 * follows Washington's lead on embargoes; the private dealer does not read
 * the newspapers.
 */

import type { SupplierId } from '../engine/types';

export type ArmsCategory = 'tank' | 'aircraft' | 'sam' | 'helicopter' | 'surveillance';

export interface ArmsItem {
  id: string;
  supplier: SupplierId;
  name: string;
  description: string;
  category: ArmsCategory;
  /** $M per unit. */
  cost: number;
  /** Combat weight added per unit to the relevant force pool. */
  power: number;
  /**
   * Minimum supplier loyalty before this is offered at all. The manual's
   * "they will only offer a wide range of choice if they are sure you have
   * the resources to pay".
   */
  minLoyalty: number;
  /** Months from signature to delivery. */
  leadTime: number;
}

export const SUPPLIERS: Record<
  SupplierId,
  { name: string; flavour: string[]; embargoProne: boolean }
> = {
  usa: {
    name: 'American',
    flavour: [
      'The smooth talking salesman smiles:',
      '<It is an honour to do business with your great country.>',
    ],
    embargoProne: true,
  },
  britain: {
    name: 'British',
    flavour: [
      'The arms dealer looks nervous:',
      '<We are ready to sell you any arms required.>',
    ],
    embargoProne: true,
  },
  france: {
    name: 'French',
    flavour: [
      'The dealer has a definite South African accent:',
      '<We are pleased to be able to equip you.>',
    ],
    embargoProne: true,
  },
  dealer: {
    name: 'private',
    flavour: [
      'The shifty arms trader removes his shades:',
      '<I am advised only to offer you a limited selection of arms.>',
    ],
    embargoProne: false,
  },
};

export const CATALOGUE: ArmsItem[] = [
  // --- United States -------------------------------------------------------
  {
    id: 'm1a2',
    supplier: 'usa',
    name: 'M1A2 Abrams',
    description: 'Heavy armoured battle tank with 120mm smoothbore cannon.',
    category: 'tank',
    cost: 5,
    power: 12,
    minLoyalty: 0,
    leadTime: 1,
  },
  {
    id: 'f16i',
    supplier: 'usa',
    name: 'F-16I Sufa',
    description: 'All weather battlefield strike fighter with conformal tanks.',
    category: 'aircraft',
    cost: 35,
    power: 22,
    minLoyalty: 25,
    leadTime: 2,
  },
  {
    id: 'f15i',
    supplier: 'usa',
    name: 'F-15I Ra’am',
    description: 'Long range strike bomber. Reaches targets Israel cannot admit to.',
    category: 'aircraft',
    cost: 55,
    power: 34,
    minLoyalty: 55,
    leadTime: 3,
  },
  {
    id: 'apache_d',
    supplier: 'usa',
    name: 'AH-64D Apache Longbow',
    description: 'Fitted with Hellfire, radar mast and 30mm cannon.',
    category: 'helicopter',
    cost: 24,
    power: 18,
    minLoyalty: 35,
    leadTime: 2,
  },
  {
    id: 'patriot',
    supplier: 'usa',
    name: 'MIM-104 Patriot PAC-2',
    description: 'Surface to air missile system, effective against air targets.',
    category: 'sam',
    cost: 18,
    power: 16,
    minLoyalty: 20,
    leadTime: 2,
  },
  {
    id: 'hawkeye',
    supplier: 'usa',
    name: 'E-2C Hawkeye',
    description: 'Airborne surveillance and early warning system.',
    category: 'surveillance',
    cost: 60,
    power: 30,
    minLoyalty: 60,
    leadTime: 3,
  },

  // --- Britain -------------------------------------------------------------
  {
    id: 'challenger2',
    supplier: 'britain',
    name: 'Challenger 2',
    description: 'Standard heavy tank with 120mm rifled cannon.',
    category: 'tank',
    cost: 6,
    power: 11,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'tornado',
    supplier: 'britain',
    name: 'MRCA Tornado GR4',
    description: 'Multi-role combat aircraft used as a medium bomber.',
    category: 'aircraft',
    cost: 40,
    power: 24,
    minLoyalty: 40,
    leadTime: 3,
  },
  {
    id: 'nimrod',
    supplier: 'britain',
    name: 'Nimrod R1',
    description: 'Fully functional airborne surveillance system.',
    category: 'surveillance',
    cost: 45,
    power: 22,
    minLoyalty: 50,
    leadTime: 3,
  },
  {
    id: 'rapier',
    supplier: 'britain',
    name: 'Rapier FSC',
    description: 'Battlefield surface to air missile system.',
    category: 'sam',
    cost: 9,
    power: 9,
    minLoyalty: 0,
    leadTime: 2,
  },

  // --- France --------------------------------------------------------------
  {
    id: 'mirage2000',
    supplier: 'france',
    name: 'Mirage 2000-5',
    description: 'Multi-role combat aircraft, single seater.',
    category: 'aircraft',
    cost: 33,
    power: 20,
    minLoyalty: 30,
    leadTime: 2,
  },
  {
    id: 'amx30b2',
    supplier: 'france',
    name: 'AMX-30 B2',
    description: 'Standard medium tank for frontline combat action.',
    category: 'tank',
    cost: 4,
    power: 8,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'crotale',
    supplier: 'france',
    name: 'Crotale NG',
    description: 'Short range surface to air missile system.',
    category: 'sam',
    cost: 11,
    power: 10,
    minLoyalty: 20,
    leadTime: 2,
  },
  {
    id: 'gazelle',
    supplier: 'france',
    name: 'SA-342 Gazelle',
    description: 'Fitted with anti-tank rockets and 20mm cannon.',
    category: 'helicopter',
    cost: 12,
    power: 9,
    minLoyalty: 0,
    leadTime: 2,
  },

  // --- The private dealer --------------------------------------------------
  // Ex-Soviet surplus, moving out of the former bloc at speed and without
  // paperwork. Never embargoed, always late.
  {
    id: 't72',
    supplier: 'dealer',
    name: 'T-72M Main Battle Tank',
    description: 'Standard heavy tank for frontline action. Provenance unclear.',
    category: 'tank',
    cost: 3,
    power: 7,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'mig29',
    supplier: 'dealer',
    name: 'MiG-29 Fulcrum',
    description: 'Multi-role combat aircraft, single seat fighter.',
    category: 'aircraft',
    cost: 22,
    power: 15,
    minLoyalty: 15,
    leadTime: 2,
  },
  {
    id: 'sa8',
    supplier: 'dealer',
    name: 'SA-8B Gecko',
    description: 'Battlefield surface to air missile system.',
    category: 'sam',
    cost: 6,
    power: 7,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'mi24',
    supplier: 'dealer',
    name: 'Mi-24 Hind',
    description: 'Fitted with fixed 23mm cannon, but no stereo system.',
    category: 'helicopter',
    cost: 10,
    power: 8,
    minLoyalty: 0,
    leadTime: 2,
  },
];

export function catalogueFor(supplier: SupplierId, loyalty: number): ArmsItem[] {
  return CATALOGUE.filter((i) => i.supplier === supplier && loyalty >= i.minLoyalty);
}

export function itemById(id: string): ArmsItem | undefined {
  return CATALOGUE.find((i) => i.id === id);
}

/** Which force pool an item lands in when it is delivered. */
export function poolFor(cat: ArmsCategory): 'tanks' | 'aircraft' | 'sam' {
  switch (cat) {
    case 'tank':
      return 'tanks';
    case 'sam':
      return 'sam';
    case 'aircraft':
    case 'helicopter':
    case 'surveillance':
      return 'aircraft';
  }
}
