/**
 * The arms market, updated from the original's 1980s catalogue to what an
 * Israeli defence minister could plausibly sign for in 2000.
 *
 * The four original suppliers keep their personalities. Washington sells the
 * best kit but watches your behaviour; London is reliable and narrow; Paris
 * reaches for an embargo first; the private dealer does not read the
 * newspapers.
 *
 * Three more counters opened after the Cold War, and none of them is simply a
 * shop. Moscow sells well and cheaply and is the patron of Damascus and
 * Tehran. Beijing sells cheaply and badly, and every order is read in
 * Washington as a sequel to the Phalcon affair of July 2000. Ankara is the one
 * regional military partner Israel has — and a Muslim electorate watches what
 * Israel does in the territories.
 */

import type { SupplierId } from '../engine/types';
import type { ArmsCategory, Origin } from './equipment';

export type { ArmsCategory };

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
  /**
   * Whose badge is on the engine, when it is not the seller's. A Turkish-built
   * F-16 still flies on American spares, and an American embargo grounds it.
   */
  origin?: Origin;
  /** Not in production for export until this year. */
  fromYear?: number;
  /**
   * Can fly a strike mission to Baghdad, Tehran or Tripoli and come back.
   * Without enough of these, the long-range options are not on the menu.
   */
  longRange?: boolean;
}

export interface SupplierProfile {
  name: string;
  flavour: string[];
  embargoProne: boolean;
  /** What the dealer says when his government has told him to stop. */
  refusal: string;
  /** One line on what dealing with them costs, for the procurement screen. */
  note: string;
}

export const SUPPLIERS: Record<SupplierId, SupplierProfile> = {
  usa: {
    name: 'American',
    flavour: [
      'The smooth talking salesman smiles:',
      '<It is an honour to do business with your great country.>',
    ],
    embargoProne: true,
    refusal: 'Due to the official arms embargo on Israel, I have been instructed to make no sales.',
    note: 'The best equipment there is, and Washington reads every order.',
  },
  britain: {
    name: 'British',
    flavour: [
      'The arms dealer looks nervous:',
      '<We are ready to sell you any arms required.>',
    ],
    embargoProne: true,
    refusal: 'Due to the official arms embargo on Israel, I have been instructed to make no sales.',
    note: 'Narrow, reliable, and slow to take offence.',
  },
  france: {
    name: 'French',
    flavour: [
      'The dealer has a definite South African accent:',
      '<We are pleased to be able to equip you.>',
    ],
    embargoProne: true,
    refusal: 'Due to the official arms embargo on Israel, I have been instructed to make no sales.',
    note: 'The first capital to stop selling, and it needs nobody’s permission.',
  },
  dealer: {
    name: 'private',
    flavour: [
      'The shifty arms trader removes his shades:',
      '<I am advised only to offer you a limited selection of arms.>',
    ],
    embargoProne: false,
    refusal: 'I am not in a position to help you at present.',
    note: 'Ex-Soviet surplus. Never embargoed, always late, and Washington notices.',
  },
  russia: {
    name: 'Russian',
    flavour: [
      'The man from Rosoboronexport pours two glasses:',
      '<Our clients in Damascus need never know.>',
    ],
    embargoProne: true,
    refusal:
      'Moscow does not sell to a government at war with its friends. Come back when the guns are quiet.',
    note: 'Good and cheap. Moscow arms Damascus and Tehran, and Washington hates every order.',
  },
  china: {
    name: 'Chinese',
    flavour: [
      'The CATIC delegation bows politely:',
      '<We remember the Phalcon, and we are prepared to forget it.>',
    ],
    embargoProne: true,
    refusal:
      'Beijing has other friends in this region. The delegation has been recalled for consultations.',
    note: 'Cheapest on the market. Washington treats every order as a sequel to the Phalcon affair.',
  },
  turkey: {
    name: 'Turkish',
    flavour: [
      'The general from Ankara shakes your hand warmly:',
      '<Between allies, the paperwork is a formality.>',
    ],
    embargoProne: true,
    refusal:
      'Ankara cannot be seen arming Israel while this goes on. The Turkish street is watching.',
    note: 'Israel’s one regional partner. American-built, so an American embargo grounds it too.',
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
    id: 'm60a3',
    supplier: 'usa',
    name: 'M60A3 Patton (surplus)',
    description: 'Ex-U.S. Army stock, rebuilt at Anniston. Old, cheap and quick to arrive.',
    category: 'tank',
    cost: 2,
    power: 9,
    minLoyalty: 0,
    leadTime: 1,
  },
  {
    id: 'f16ab',
    supplier: 'usa',
    name: 'F-16A/B Netz (surplus)',
    description: 'Ex-USAF airframes out of the desert at Davis-Monthan. The IAF already flies them.',
    category: 'aircraft',
    cost: 15,
    power: 18,
    minLoyalty: 10,
    leadTime: 1,
  },
  {
    id: 'f16cd',
    supplier: 'usa',
    name: 'F-16C/D Barak',
    description: 'The backbone of the air force. More of what already works.',
    category: 'aircraft',
    cost: 28,
    power: 22,
    minLoyalty: 20,
    leadTime: 2,
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
    longRange: true,
  },
  {
    id: 'f15_baz',
    supplier: 'usa',
    name: 'F-15C/D Baz',
    description: 'Air superiority fighter. Escorted the raid on Osirak and could do it again.',
    category: 'aircraft',
    cost: 42,
    power: 26,
    minLoyalty: 40,
    leadTime: 2,
    longRange: true,
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
    longRange: true,
  },
  {
    id: 'ah1_tzefa',
    supplier: 'usa',
    name: 'AH-1F Cobra (Tzefa)',
    description: 'TOW-armed attack helicopter. Twenty years old and still in every border fight.',
    category: 'helicopter',
    cost: 9,
    power: 11,
    minLoyalty: 0,
    leadTime: 1,
  },
  {
    id: 'ah64a',
    supplier: 'usa',
    name: 'AH-64A Peten',
    description: 'The Apache the IAF already flies, without the Longbow radar.',
    category: 'helicopter',
    cost: 17,
    power: 16,
    minLoyalty: 20,
    leadTime: 2,
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
    id: 'challenger1',
    supplier: 'britain',
    name: 'Challenger 1 (surplus)',
    description: 'Retired from the Rhine as the Challenger 2 arrives. Heavy, slow, well armoured.',
    category: 'tank',
    cost: 3.5,
    power: 9,
    minLoyalty: 0,
    leadTime: 2,
  },
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
    id: 'hawk200',
    supplier: 'britain',
    name: 'BAe Hawk 200',
    description: 'Single seat light fighter. Cheap to buy and cheap to fly.',
    category: 'aircraft',
    cost: 14,
    power: 11,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'jaguar',
    supplier: 'britain',
    name: 'SEPECAT Jaguar GR3',
    description: 'Low level ground attack aircraft, proven over Iraq in 1991.',
    category: 'aircraft',
    cost: 18,
    power: 14,
    minLoyalty: 15,
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
    longRange: true,
  },
  {
    id: 'lynx',
    supplier: 'britain',
    name: 'Westland Lynx AH.7',
    description: 'Fast battlefield helicopter fitted with TOW missiles.',
    category: 'helicopter',
    cost: 10,
    power: 10,
    minLoyalty: 10,
    leadTime: 2,
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
  {
    id: 'starstreak',
    supplier: 'britain',
    name: 'Starstreak HVM',
    description: 'Hypervelocity short range missile. Very little gets under it.',
    category: 'sam',
    cost: 7,
    power: 8,
    minLoyalty: 10,
    leadTime: 2,
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
    id: 'sentry',
    supplier: 'britain',
    name: 'E-3D Sentry AEW.1',
    description: 'A flying radar station. London sells one only to friends it trusts.',
    category: 'surveillance',
    cost: 90,
    power: 36,
    minLoyalty: 65,
    leadTime: 4,
  },

  // --- France --------------------------------------------------------------
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
    id: 'leclerc',
    supplier: 'france',
    name: 'Leclerc',
    description: 'Autoloaded 120mm main battle tank. Superb and very expensive.',
    category: 'tank',
    cost: 7,
    power: 12,
    minLoyalty: 45,
    leadTime: 3,
  },
  {
    id: 'mirage_f1',
    supplier: 'france',
    name: 'Mirage F1CT (surplus)',
    description: 'Ex-Armée de l’Air fighter rebuilt for ground attack.',
    category: 'aircraft',
    cost: 14,
    power: 13,
    minLoyalty: 10,
    leadTime: 2,
  },
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
    id: 'rafale',
    supplier: 'france',
    name: 'Rafale B/C',
    description: 'Omnirole fighter, entering French service. Paris will not rush the export line.',
    category: 'aircraft',
    cost: 60,
    power: 30,
    minLoyalty: 55,
    leadTime: 3,
    fromYear: 2002,
    longRange: true,
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
  {
    id: 'tigre',
    supplier: 'france',
    name: 'Tigre HAP',
    description: 'Franco-German attack helicopter, first deliveries due in 2003.',
    category: 'helicopter',
    cost: 26,
    power: 18,
    minLoyalty: 45,
    leadTime: 3,
    fromYear: 2003,
  },
  {
    id: 'mistral',
    supplier: 'france',
    name: 'Mistral',
    description: 'Infantry surface to air missile, fired from a tripod.',
    category: 'sam',
    cost: 5,
    power: 6,
    minLoyalty: 0,
    leadTime: 1,
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
    id: 't80u',
    supplier: 'dealer',
    name: 'T-80U',
    description: 'Gas turbine tank out of a Ukrainian depot. The serial numbers have been filed off.',
    category: 'tank',
    cost: 4,
    power: 9,
    minLoyalty: 20,
    leadTime: 3,
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
    id: 'su27',
    supplier: 'dealer',
    name: 'Su-27 Flanker',
    description: 'Long legged air superiority fighter. Belarus has several it no longer needs.',
    category: 'aircraft',
    cost: 30,
    power: 24,
    minLoyalty: 35,
    leadTime: 3,
    longRange: true,
  },
  {
    id: 'mi8',
    supplier: 'dealer',
    name: 'Mi-8 Hip',
    description: 'Armed transport helicopter. There are thousands of them and nobody counts.',
    category: 'helicopter',
    cost: 4,
    power: 5,
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
    id: 'tunguska',
    supplier: 'dealer',
    name: '2S6 Tunguska',
    description: 'Tracked gun and missile air defence. Arrives with a Russian-language manual.',
    category: 'sam',
    cost: 8,
    power: 8,
    minLoyalty: 10,
    leadTime: 2,
  },
  {
    id: 'buk',
    supplier: 'dealer',
    name: 'SA-11 Gadfly (Buk)',
    description: 'Medium range mobile surface to air missile system.',
    category: 'sam',
    cost: 12,
    power: 12,
    minLoyalty: 30,
    leadTime: 3,
  },

  // --- Russia --------------------------------------------------------------
  // New production, sold openly by the state export agency. The same factories
  // that equip Damascus and Tehran. Moscow has never sold to us, so the first
  // order has to be something it would sell to anybody.
  {
    id: 'mi17',
    supplier: 'russia',
    name: 'Mi-17 Hip-H',
    description: 'Armed transport helicopter, new from Kazan. Moscow sells these to anyone.',
    category: 'helicopter',
    cost: 5,
    power: 6,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'igla',
    supplier: 'russia',
    name: '9K38 Igla',
    description: 'Shoulder-launched surface to air missile. A first order, and a test of the paperwork.',
    category: 'sam',
    cost: 3,
    power: 6,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 't90s',
    supplier: 'russia',
    name: 'T-90S',
    description: 'The newest Russian export tank. Delhi has just signed for three hundred.',
    category: 'tank',
    cost: 5,
    power: 11,
    minLoyalty: 15,
    leadTime: 3,
    fromYear: 2001,
  },
  {
    id: 'su30mk',
    supplier: 'russia',
    name: 'Su-30MK',
    description: 'Two seat strike fighter with the range to reach anywhere in the region.',
    category: 'aircraft',
    cost: 38,
    power: 28,
    minLoyalty: 30,
    leadTime: 3,
    longRange: true,
  },
  {
    id: 'ka50',
    supplier: 'russia',
    name: 'Ka-50 Black Shark',
    description: 'Single seat coaxial attack helicopter.',
    category: 'helicopter',
    cost: 16,
    power: 15,
    minLoyalty: 20,
    leadTime: 3,
  },
  {
    id: 'mi28',
    supplier: 'russia',
    name: 'Mi-28N Havoc',
    description: 'Night attack helicopter, finally in production.',
    category: 'helicopter',
    cost: 18,
    power: 16,
    minLoyalty: 25,
    leadTime: 3,
    fromYear: 2003,
  },
  {
    id: 's300',
    supplier: 'russia',
    name: 'S-300PMU-1',
    description: 'Long range air defence. The system every air force in the region fears.',
    category: 'sam',
    cost: 30,
    power: 20,
    minLoyalty: 40,
    leadTime: 4,
  },

  // --- China ---------------------------------------------------------------
  {
    id: 'type98',
    supplier: 'china',
    name: 'Type 98',
    description: 'The PLA’s new tank. Beijing is keen to show it to a customer.',
    category: 'tank',
    cost: 3.5,
    power: 9,
    minLoyalty: 10,
    leadTime: 3,
    fromYear: 2001,
  },
  {
    id: 'f7mg',
    supplier: 'china',
    name: 'Chengdu F-7MG',
    description: 'A MiG-21 with a new wing and a Western radar. Cheap in every sense.',
    category: 'aircraft',
    cost: 6,
    power: 10,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'q5',
    supplier: 'china',
    name: 'Nanchang Q-5',
    description: 'Ground attack aircraft derived from the MiG-19.',
    category: 'aircraft',
    cost: 5,
    power: 8,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'z9',
    supplier: 'china',
    name: 'Harbin Z-9W',
    description: 'A licence-built Dauphin with anti-tank missiles bolted on.',
    category: 'helicopter',
    cost: 5,
    power: 7,
    minLoyalty: 0,
    leadTime: 2,
  },
  {
    id: 'hq7',
    supplier: 'china',
    name: 'HQ-7 (FM-80)',
    description: 'A copy of the Crotale, at a third of the price.',
    category: 'sam',
    cost: 6,
    power: 8,
    minLoyalty: 0,
    leadTime: 2,
  },

  // --- Turkey --------------------------------------------------------------
  // Licence-built and refurbished American equipment. The engines are
  // American, and so are the spares.
  {
    id: 'm60a1_tr',
    supplier: 'turkey',
    name: 'M60A1 (MKEK rebuilt)',
    description: 'Refurbished at Kayseri. Ankara has hundreds more than it needs.',
    category: 'tank',
    cost: 2.5,
    power: 8,
    minLoyalty: 0,
    leadTime: 2,
    origin: 'usa',
  },
  {
    id: 'f16c_tai',
    supplier: 'turkey',
    name: 'F-16C Block 40 (TAI)',
    description: 'Built under licence at Mürted. An American fighter without the American queue.',
    category: 'aircraft',
    cost: 30,
    power: 22,
    minLoyalty: 30,
    leadTime: 3,
    origin: 'usa',
  },
  {
    id: 'ah1w_tr',
    supplier: 'turkey',
    name: 'AH-1W SuperCobra',
    description: 'Twin engine attack helicopter from the Turkish army’s own stock.',
    category: 'helicopter',
    cost: 11,
    power: 12,
    minLoyalty: 25,
    leadTime: 2,
    origin: 'usa',
  },
  {
    id: 'stinger_tr',
    supplier: 'turkey',
    name: 'Stinger (licence-built)',
    description: 'Shoulder-launched missiles off the European Stinger production line.',
    category: 'sam',
    cost: 3,
    power: 5,
    minLoyalty: 0,
    leadTime: 1,
    origin: 'usa',
  },
];

/** What a supplier will show a customer of this loyalty, in this year. */
export function catalogueFor(supplier: SupplierId, loyalty: number, year = 9999): ArmsItem[] {
  return CATALOGUE.filter(
    (i) => i.supplier === supplier && loyalty >= i.minLoyalty && year >= (i.fromYear ?? 0),
  );
}

/** Items this supplier would sell us, but which are not in production yet. */
export function forthcomingFor(supplier: SupplierId, loyalty: number, year: number): ArmsItem[] {
  return CATALOGUE.filter(
    (i) => i.supplier === supplier && loyalty >= i.minLoyalty && year < (i.fromYear ?? 0),
  );
}

export function itemById(id: string): ArmsItem | undefined {
  return CATALOGUE.find((i) => i.id === id);
}
