/**
 * What is already in service in June 2000, as opposed to what is for sale.
 *
 * Nobody starts the game with an empty motor pool, and most of what is parked
 * in it was never on a supplier's page — it is old, it is captured, or it was
 * built at home. Those types live here, with the opening order of battle.
 *
 * The headline totals are unchanged from the flat-count model: Israel fields
 * 3,900 tanks and 450 airframes, Syria 4,500 tanks, Egypt 3,500. What is new
 * is the composition, and the composition is the point. Israeli armour is a
 * spread from Merkava Mk 3 down to captured T-54s; Syrian armour is mostly
 * T-55s and T-62s that were obsolete when they arrived. The two fleets are
 * the same size and are not remotely the same weight.
 *
 * `power` is per unit, on the same scale as the purchase catalogue, where the
 * reference for its category (tank 8, air 20, sam 10) is a typical regional
 * unit. Anything above that is better than the norm and anything below is
 * worse; see `equipment.ts`.
 *
 * This file is deliberately the only place the opening order of battle is
 * written down, so changing what a country fields is never an engine change.
 */

import type { Fleet, NationId } from '../engine/types';
import type { EquipmentSpec } from './equipment';

export const IN_SERVICE: EquipmentSpec[] = [
  // --- Israeli armour ------------------------------------------------------
  { id: 'merkava3', name: 'Merkava Mk 3', category: 'tank', power: 13, origin: 'israel' },
  { id: 'merkava2', name: 'Merkava Mk 2', category: 'tank', power: 10, origin: 'israel' },
  { id: 'merkava1', name: 'Merkava Mk 1', category: 'tank', power: 8, origin: 'israel' },
  { id: 'magach7', name: 'Magach 7', category: 'tank', power: 9, origin: 'usa' },
  { id: 'magach6', name: 'Magach 6', category: 'tank', power: 7, origin: 'usa' },
  { id: 'shot_kal', name: 'Sho’t Kal', category: 'tank', power: 6, origin: 'britain' },
  { id: 'tiran', name: 'Tiran 5', category: 'tank', power: 5, origin: 'soviet' },

  // --- Israeli air ---------------------------------------------------------
  { id: 'f15_baz', name: 'F-15 Baz', category: 'aircraft', power: 26, origin: 'usa' },
  { id: 'f16cd', name: 'F-16C/D Barak', category: 'aircraft', power: 22, origin: 'usa' },
  { id: 'f16ab', name: 'F-16A/B Netz', category: 'aircraft', power: 18, origin: 'usa' },
  { id: 'f4_2000', name: 'F-4 Phantom 2000', category: 'aircraft', power: 16, origin: 'usa' },
  { id: 'kfir_c7', name: 'Kfir C7', category: 'aircraft', power: 12, origin: 'israel' },
  { id: 'ah64a', name: 'AH-64A Peten', category: 'helicopter', power: 16, origin: 'usa' },
  { id: 'ah1_tzefa', name: 'AH-1 Tzefa', category: 'helicopter', power: 11, origin: 'usa' },
  { id: 'md500', name: 'MD 500 Lahatut', category: 'helicopter', power: 8, origin: 'usa' },
  { id: 'e2c', name: 'E-2C Hawkeye', category: 'surveillance', power: 30, origin: 'usa' },
  { id: 'hawk', name: 'MIM-23 Hawk', category: 'sam', power: 10, origin: 'usa' },
  { id: 'chaparral', name: 'MIM-72 Chaparral', category: 'sam', power: 6, origin: 'usa' },

  // --- Soviet and Warsaw Pact armour, the backbone of the region -----------
  { id: 't72', name: 'T-72', category: 'tank', power: 7, origin: 'soviet' },
  { id: 't62', name: 'T-62', category: 'tank', power: 5, origin: 'soviet' },
  { id: 't55', name: 'T-55', category: 'tank', power: 4, origin: 'soviet' },
  { id: 'type59', name: 'Type 59', category: 'tank', power: 4, origin: 'other' },
  { id: 'm60a3', name: 'M60A3 Patton', category: 'tank', power: 9, origin: 'usa' },
  { id: 'm1a1', name: 'M1A1 Abrams', category: 'tank', power: 11, origin: 'usa' },
  { id: 'chieftain', name: 'Chieftain Mk 5', category: 'tank', power: 7, origin: 'britain' },

  // --- Regional air --------------------------------------------------------
  { id: 'mig29', name: 'MiG-29 Fulcrum', category: 'aircraft', power: 15, origin: 'soviet' },
  { id: 'mig25', name: 'MiG-25 Foxbat', category: 'aircraft', power: 13, origin: 'soviet' },
  { id: 'mig23', name: 'MiG-23 Flogger', category: 'aircraft', power: 11, origin: 'soviet' },
  { id: 'mig21', name: 'MiG-21 Fishbed', category: 'aircraft', power: 8, origin: 'soviet' },
  { id: 'su24', name: 'Su-24 Fencer', category: 'aircraft', power: 16, origin: 'soviet' },
  { id: 'su22', name: 'Su-22 Fitter', category: 'aircraft', power: 10, origin: 'soviet' },
  { id: 'f16_export', name: 'F-16A/B', category: 'aircraft', power: 20, origin: 'usa' },
  { id: 'mirage2000_export', name: 'Mirage 2000', category: 'aircraft', power: 20, origin: 'france' },
  { id: 'mirage5', name: 'Mirage 5', category: 'aircraft', power: 12, origin: 'france' },
  { id: 'mirage_f1', name: 'Mirage F1', category: 'aircraft', power: 13, origin: 'france' },
  { id: 'f4e', name: 'F-4E Phantom II', category: 'aircraft', power: 16, origin: 'usa' },
  { id: 'f5e', name: 'F-5E Tiger II', category: 'aircraft', power: 10, origin: 'usa' },
  { id: 'alphajet', name: 'Alpha Jet', category: 'aircraft', power: 8, origin: 'france' },
  { id: 'f7', name: 'Chengdu F-7', category: 'aircraft', power: 9, origin: 'other' },
  { id: 'mi24', name: 'Mi-24 Hind', category: 'helicopter', power: 8, origin: 'soviet' },
  { id: 'mi8', name: 'Mi-8 Hip', category: 'helicopter', power: 5, origin: 'soviet' },
  { id: 'gazelle_at', name: 'SA-342 Gazelle', category: 'helicopter', power: 9, origin: 'france' },
  { id: 'ah64_export', name: 'AH-64A Apache', category: 'helicopter', power: 16, origin: 'usa' },
  { id: 'e2c_export', name: 'E-2C Hawkeye', category: 'surveillance', power: 30, origin: 'usa' },

  // --- Regional air defence ------------------------------------------------
  { id: 'sa5', name: 'S-200 (SA-5 Gammon)', category: 'sam', power: 12, origin: 'soviet' },
  { id: 'sa6', name: '2K12 Kub (SA-6 Gainful)', category: 'sam', power: 8, origin: 'soviet' },
  { id: 'sa3', name: 'S-125 (SA-3 Goa)', category: 'sam', power: 6, origin: 'soviet' },
  { id: 'sa2', name: 'S-75 (SA-2 Guideline)', category: 'sam', power: 5, origin: 'soviet' },
  { id: 'sa8_ins', name: '9K33 Osa (SA-8 Gecko)', category: 'sam', power: 7, origin: 'soviet' },
  { id: 'hawk_export', name: 'MIM-23 Hawk', category: 'sam', power: 10, origin: 'usa' },
  { id: 'crotale_ins', name: 'Crotale', category: 'sam', power: 9, origin: 'france' },
];

/**
 * Israel, June 2000. Roughly 3,900 tanks, 357 combat aircraft, 90 attack
 * helicopters, 3 early warning craft and 110 batteries — the same totals the
 * game has always used, now with the Merkava at the top of the list and
 * captured Tirans at the bottom.
 */
export function israeliOpeningStock(): Fleet {
  return {
    merkava3: 400,
    merkava2: 580,
    merkava1: 320,
    magach7: 900,
    magach6: 850,
    shot_kal: 450,
    tiran: 400,

    f15i: 25,
    f15_baz: 38,
    f16cd: 130,
    f16ab: 110,
    f4_2000: 32,
    kfir_c7: 22,

    ah64a: 30,
    ah1_tzefa: 40,
    md500: 20,

    e2c: 3,

    patriot: 20,
    hawk: 60,
    chaparral: 30,
  };
}

/**
 * The neighbours. Totals match the order of battle the game has always used;
 * only the composition is new, and it is not flattering. Damascus fields more
 * tanks than Israel does and most of them were built in the 1960s.
 */
const OPENING: Record<NationId, Fleet> = {
  // 3,500 tanks, 570 airframes, 90 batteries. The best-equipped Arab army,
  // and the only one buying American.
  egypt: {
    m1a1: 555,
    m60a3: 1300,
    t62: 600,
    t55: 1045,

    f16_export: 170,
    mirage2000_export: 18,
    f7: 130,
    f4e: 29,
    mirage5: 80,
    alphajet: 73,

    ah64_export: 35,
    gazelle_at: 30,

    e2c_export: 5,

    hawk_export: 12,
    sa6: 40,
    sa2: 38,
  },

  // 4,500 tanks, 480 airframes, 130 batteries. Numerically the heaviest army
  // on any Israeli border and qualitatively the most obsolete.
  syria: {
    t72: 1500,
    t62: 1000,
    t55: 2000,

    mig29: 40,
    mig23: 140,
    mig21: 170,
    su24: 20,
    su22: 50,

    mi24: 50,
    gazelle_at: 10,

    sa5: 8,
    sa6: 42,
    sa3: 40,
    sa2: 40,
  },

  // 1,200 tanks, 100 airframes, 30 batteries. Small, Western-equipped, and
  // the only neighbour with no interest at all in using it.
  jordan: {
    chieftain: 390,
    m60a3: 280,
    type59: 530,

    mirage_f1: 15,
    f5e: 45,

    ah1_tzefa: 25,
    mi8: 15,

    hawk_export: 14,
    sa8_ins: 16,
  },

  // 300 tanks, no air force, 10 batteries. The weakest power in the game,
  // exactly as the manual promised.
  lebanon: {
    t55: 200,
    m60a3: 100,

    sa2: 10,
  },

  // 2,200 tanks, 300 airframes, 70 batteries, all of it a decade into
  // sanctions and cannibalised for spares.
  iraq: {
    t72: 500,
    t62: 700,
    type59: 1000,

    mig29: 12,
    mig25: 15,
    mig23: 80,
    mig21: 110,
    su22: 43,

    mi24: 30,
    mi8: 10,

    sa6: 20,
    sa3: 25,
    sa2: 25,
  },

  // 1,500 tanks, 300 airframes, 60 batteries. A revolutionary air force still
  // flying what the Shah bought.
  iran: {
    t72: 480,
    chieftain: 220,
    t55: 800,

    mig29: 30,
    f4e: 55,
    f5e: 60,
    su24: 30,
    f7: 65,

    mi24: 40,
    ah1_tzefa: 20,

    hawk_export: 25,
    sa2: 35,
  },

  // 2,200 tanks, 400 airframes, 40 batteries. Bought lavishly in the 1970s
  // and flown rarely since.
  libya: {
    t72: 350,
    t62: 950,
    t55: 900,

    mig23: 130,
    mig21: 110,
    mig25: 60,
    su22: 40,
    mirage_f1: 20,

    mi24: 30,
    mi8: 10,

    sa5: 6,
    sa6: 14,
    sa3: 12,
    sa2: 8,
  },
};

export function openingInventory(id: NationId): Fleet {
  return { ...OPENING[id] };
}
