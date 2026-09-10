/**
 * Opening position: June 2000.
 *
 * Israel has just completed its withdrawal from the South Lebanon security
 * zone (24 May). Hafez al-Assad is gravely ill and will not see July. Barak
 * is holding a narrow coalition together and the Americans are assembling a
 * summit at Camp David. Nothing has gone wrong yet.
 */

import type { Nation, NationId } from '../engine/types';

type NationSeed = Omit<Nation, 'relationsPoints' | 'baseStability' | 'counterIntel'>;

const seeds: NationSeed[] = [
  {
    id: 'egypt',
    name: 'Egypt',
    adjective: 'Egyptian',
    capital: 'Cairo',
    leader: 'Hosni Mubarak',
    collapsed: false,
    // Cold peace since 1979: correct but joyless.
    relations: 5,
    stability: 78,
    oppositionGroup: "al-Gama'a al-Islamiyya",
    oppositionStrength: 22,
    israeliPosture: 'neutral',
    // Roughly twice the Israeli order of battle, as in the original manual.
    forces: { brigades: 14, tanks: 3500, aircraft: 570, helicopters: 0, awacs: 0, sam: 90 },
    interArab: { jordan: 6, syria: 4, iraq: 2, libya: 1, lebanon: 4, iran: 3 },
    atWarWith: [],
    pactWith: [],
    // Cairo has no interest in a race it is already winning conventionally.
    nuclearProgress: 5,
    hasNuclear: false,
    isFront: true,
  },
  {
    id: 'syria',
    name: 'Syria',
    adjective: 'Syrian',
    capital: 'Damascus',
    leader: 'Hafez al-Assad',
    collapsed: false,
    // Shepherdstown collapsed in January, Geneva in March.
    relations: 2,
    // The succession is the whole story this month.
    stability: 55,
    oppositionGroup: 'Muslim Brotherhood',
    oppositionStrength: 30,
    israeliPosture: 'neutral',
    forces: { brigades: 10, tanks: 4500, aircraft: 480, helicopters: 0, awacs: 0, sam: 130 },
    interArab: { egypt: 4, jordan: 3, iraq: 1, lebanon: 8, libya: 4, iran: 6 },
    atWarWith: [],
    pactWith: ['lebanon'],
    nuclearProgress: 8,
    hasNuclear: false,
    isFront: true,
  },
  {
    id: 'jordan',
    name: 'Jordan',
    adjective: 'Jordanian',
    capital: 'Amman',
    leader: 'King Abdullah II',
    collapsed: false,
    // Wadi Araba holds, and the new king is invested in it.
    relations: 7,
    stability: 68,
    oppositionGroup: 'Islamic Action Front',
    oppositionStrength: 26,
    israeliPosture: 'neutral',
    forces: { brigades: 5, tanks: 1200, aircraft: 100, helicopters: 0, awacs: 0, sam: 30 },
    interArab: { egypt: 6, syria: 3, iraq: 5, lebanon: 4, libya: 3, iran: 2 },
    atWarWith: [],
    pactWith: [],
    nuclearProgress: 0,
    hasNuclear: false,
    isFront: true,
  },
  {
    id: 'lebanon',
    name: 'Lebanon',
    adjective: 'Lebanese',
    capital: 'Beirut',
    leader: 'Émile Lahoud',
    collapsed: false,
    // No formal relations, and the security zone is three weeks gone.
    relations: 1,
    // The weakest power in the game, exactly as the manual promised.
    stability: 40,
    oppositionGroup: 'Hezbollah',
    oppositionStrength: 55,
    israeliPosture: 'neutral',
    forces: { brigades: 3, tanks: 300, aircraft: 0, helicopters: 0, awacs: 0, sam: 10 },
    interArab: { syria: 8, egypt: 4, jordan: 4, iraq: 2, libya: 2, iran: 7 },
    atWarWith: [],
    pactWith: ['syria'],
    nuclearProgress: 0,
    hasNuclear: false,
    isFront: true,
  },
  {
    id: 'iraq',
    name: 'Iraq',
    adjective: 'Iraqi',
    capital: 'Baghdad',
    leader: 'Saddam Hussein',
    collapsed: false,
    relations: 0,
    // Ruthless internal security, but a decade of sanctions underneath it.
    stability: 62,
    oppositionGroup: 'Kurdish Democratic Party',
    oppositionStrength: 34,
    israeliPosture: 'neutral',
    forces: { brigades: 12, tanks: 2200, aircraft: 300, helicopters: 0, awacs: 0, sam: 70 },
    interArab: { iran: 1, jordan: 5, syria: 1, egypt: 2, libya: 4, lebanon: 2 },
    atWarWith: [],
    pactWith: [],
    // Osirak and UNSCOM between them set this back a long way.
    nuclearProgress: 12,
    hasNuclear: false,
    isFront: false,
  },
  {
    id: 'iran',
    name: 'Iran',
    adjective: 'Iranian',
    capital: 'Tehran',
    leader: 'Mohammad Khatami',
    collapsed: false,
    relations: 0,
    // Reformists took the Majlis in February; the hardliners still hold the guns.
    stability: 58,
    oppositionGroup: 'Student Reform Movement',
    oppositionStrength: 38,
    israeliPosture: 'neutral',
    forces: { brigades: 16, tanks: 1500, aircraft: 300, helicopters: 0, awacs: 0, sam: 60 },
    interArab: { iraq: 1, syria: 6, lebanon: 7, egypt: 3, jordan: 2, libya: 4 },
    atWarWith: [],
    pactWith: ['syria'],
    nuclearProgress: 18,
    hasNuclear: false,
    isFront: false,
  },
  {
    id: 'libya',
    name: 'Libya',
    adjective: 'Libyan',
    capital: 'Tripoli',
    leader: 'Muammar Gaddafi',
    collapsed: false,
    relations: 1,
    stability: 60,
    oppositionGroup: 'Libyan Islamic Fighting Group',
    oppositionStrength: 32,
    israeliPosture: 'neutral',
    forces: { brigades: 4, tanks: 2200, aircraft: 400, helicopters: 0, awacs: 0, sam: 40 },
    interArab: { egypt: 1, syria: 4, iraq: 4, jordan: 3, lebanon: 2, iran: 4 },
    atWarWith: [],
    pactWith: [],
    // Tripoli is shopping, and will keep shopping until late 2003.
    nuclearProgress: 15,
    hasNuclear: false,
    isFront: false,
  },
];

export function createNations(): Record<NationId, Nation> {
  const out = {} as Record<NationId, Nation>;
  for (const s of seeds) {
    out[s.id] = {
      ...s,
      // Deep-copy every mutable field. A shallow spread would share these
      // objects with the module-level seeds, and one game's wars would then
      // leak into the next.
      forces: { ...s.forces },
      interArab: { ...s.interArab },
      atWarWith: [...s.atWarWith],
      pactWith: [...s.pactWith],
      // Left alone, a regime returns to roughly the strength it started with.
      baseStability: s.stability,
      // Nobody is looking for us yet.
      counterIntel: 0,
      // Centre each nation in the middle of its starting relations band.
      relationsPoints: s.relations * 20 - 90,
    };
  }
  return out;
}

/** Newspaper mastheads, carried over from the original. */
export const MASTHEADS = [
  'THE INDEPENDENCE',
  'THE ARAB WORLD',
  'MIDDLE EAST TODAY',
  'THE INTERNATIONAL',
  'THE ARAB CHRONICLE',
  'HERALD TRIBUNE',
  'THE SUNSET TIMES',
  'ISLAMIC AGE',
  'EASTERN EYE',
];
