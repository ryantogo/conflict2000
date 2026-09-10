/**
 * The armed groups that are not governments.
 *
 * DESIGN.md has called this the most conspicuous simplification since the
 * first commit: "Hezbollah and the PLO exist as an opposition-strength number
 * and a scripted event, not as entities with their own goals." In June 2000,
 * three weeks after the withdrawal from the security zone, that is a strange
 * thing for a game about this region to be missing.
 *
 * A faction is deliberately *not* the same thing as `Nation.oppositionStrength`.
 * That is the internal political opposition — the people a foreign service
 * funds into a coup, which is a question about the regime. A faction is an
 * armed organisation with a patron, a constituency and a programme, which
 * frequently wants its own government gone rather less than it wants Israel
 * gone. Conflating them is how Hezbollah ends up modelled as a Lebanese
 * election result.
 *
 * They have no borders, so they get a card and no geometry — the same
 * treatment Libya has always had. Carving faction territory out of the map
 * would break the shared-vertex assertions in `geography.test.ts`, and a
 * militia does not hold a frontier anyway.
 */

import type { NationId } from '../engine/types';

/** Where a faction operates. The territories are not a nation in this game. */
export type FactionHome = NationId | 'territories';

export interface FactionSeed {
  id: string;
  name: string;
  home: FactionHome;
  /** Who pays. Not always the state it operates in, and often its rival. */
  patron: NationId | null;
  /** 0..100 fighting capacity. */
  strength: number;
  /** 0..100 standing with the population it lives among. */
  support: number;
  /** How it fights, which decides what it costs us. */
  method: 'raids' | 'unrest';
  character: string;
}

export const FACTIONS: FactionSeed[] = [
  {
    id: 'hezbollah',
    name: 'Hezbollah',
    home: 'lebanon',
    patron: 'iran',
    // The strongest non-state army in the region, and it has just watched
    // Israel leave southern Lebanon, which it is calling a victory.
    strength: 58,
    support: 62,
    method: 'raids',
    character: 'Tehran pays, Damascus permits, and the withdrawal made it famous.',
  },
  {
    id: 'hamas',
    name: 'Hamas',
    home: 'territories',
    patron: null,
    strength: 38,
    support: 34,
    method: 'unrest',
    character: 'Rejects the process entirely, and grows every month the process fails.',
  },
  {
    id: 'pij',
    name: 'Islamic Jihad',
    home: 'territories',
    patron: 'syria',
    strength: 20,
    support: 18,
    method: 'unrest',
    character: 'Small, deniable and useful to Damascus.',
  },
];

/**
 * How much of a faction's strength a patron's own stability sustains. A
 * patron in trouble at home is a patron whose cheques get smaller.
 */
export const PATRON_SUPPORT = 0.035;

/** Below this a faction stops being able to mount operations at all. */
export const SPENT_THRESHOLD = 8;

export function factionSeedById(id: string): FactionSeed | undefined {
  return FACTIONS.find((f) => f.id === id);
}

// ---------------------------------------------------------------------------
// What is left when a government stops existing
// ---------------------------------------------------------------------------

/**
 * A collapsed state used to be inert: no diplomacy, no intelligence, no army,
 * nothing on the strategic menu but a withdrawal. That is a strange way to
 * model the most consequential thing that can happen in this game, and it is
 * the dead end that stranded a player's forces on the Lebanese border.
 *
 * States do not vanish. They come apart into the people who were holding them
 * together, and those people start fighting each other — which is an
 * opportunity, a threat, and a decision, in that order.
 */
export interface SuccessorSeed {
  /** Suffix; the real id is `${nation}_${suffix}`. */
  suffix: string;
  name: string;
  /** Share of the fallen state's cohesion this faction inherits. */
  share: number;
  /** How it regards Israel, −1 hostile to +1 willing to deal. */
  disposition: number;
  character: string;
}

/**
 * Who is left standing in each capital. Deliberately specific rather than
 * generic — "the Alawite officer corps" is a different problem from "faction
 * B", and the player should be able to tell which one they just armed.
 */
export const SUCCESSORS: Record<NationId, SuccessorSeed[]> = {
  syria: [
    {
      suffix: 'officers',
      name: 'The officer corps',
      share: 0.45,
      disposition: -0.2,
      character: 'What is left of the army, holding the coast and the capital.',
    },
    {
      suffix: 'brotherhood',
      name: 'The Muslim Brotherhood',
      share: 0.35,
      disposition: -0.8,
      character: 'Hama has been waiting eighteen years for this.',
    },
    {
      suffix: 'notables',
      name: 'The Damascus notables',
      share: 0.2,
      disposition: 0.5,
      character: 'Merchants and old families who would rather trade than fight.',
    },
  ],
  lebanon: [
    {
      suffix: 'christian',
      name: 'The Christian militias',
      share: 0.35,
      disposition: 0.6,
      character: 'Old allies from the security zone, and they remember being left.',
    },
    {
      suffix: 'sunni',
      name: 'The Sunni establishment',
      share: 0.3,
      disposition: 0.1,
      character: 'Beirut money, looking for whoever will restore order.',
    },
    {
      suffix: 'druze',
      name: 'The Druze of the Chouf',
      share: 0.35,
      disposition: 0.2,
      character: 'Small, disciplined, and has outlived every other faction here.',
    },
  ],
  egypt: [
    {
      suffix: 'army',
      name: 'The Supreme Council',
      share: 0.55,
      disposition: 0.3,
      character: 'The army has governed Egypt since 1952 and intends to continue.',
    },
    {
      suffix: 'islamists',
      name: 'The Islamist front',
      share: 0.45,
      disposition: -0.9,
      character: 'Underground for thirty years and no longer underground.',
    },
  ],
  jordan: [
    {
      suffix: 'hashemite',
      name: 'Hashemite loyalists',
      share: 0.5,
      disposition: 0.7,
      character: 'The Bedouin regiments and the palace, still fighting for the throne.',
    },
    {
      suffix: 'palestinian',
      name: 'The Palestinian majority',
      share: 0.5,
      disposition: -0.6,
      character: 'More than half the country, and it has been told so for fifty years.',
    },
  ],
  iraq: [
    {
      suffix: 'sunni',
      name: 'The Sunni officer class',
      share: 0.35,
      disposition: -0.4,
      character: 'Baghdad and the west, and the men who ran the old state.',
    },
    {
      suffix: 'shia',
      name: 'The Shia south',
      share: 0.4,
      disposition: -0.7,
      character: 'Rising in the south, and looking east for help.',
    },
    {
      suffix: 'kurds',
      name: 'The Kurdish north',
      share: 0.25,
      disposition: 0.8,
      character: 'Autonomous since 1991, and an old friend of this service.',
    },
  ],
  iran: [
    {
      suffix: 'guard',
      name: 'The Revolutionary Guard',
      share: 0.5,
      disposition: -0.9,
      character: 'The revolution armed, and it does not need the clerics to continue.',
    },
    {
      suffix: 'reformists',
      name: 'The reform movement',
      share: 0.5,
      disposition: 0.4,
      character: 'The February majority, finally holding something.',
    },
  ],
  libya: [
    {
      suffix: 'tripolitania',
      name: 'Tripolitania',
      share: 0.5,
      disposition: 0.0,
      character: 'The west, the capital, and whoever holds the ministries.',
    },
    {
      suffix: 'cyrenaica',
      name: 'Cyrenaica',
      share: 0.5,
      disposition: 0.2,
      character: 'The east, the oil, and a long memory of being ruled from Tripoli.',
    },
  ],
};

/** Strength at which a backed faction can be installed as a government. */
export const RESTORATION_THRESHOLD = 72;
