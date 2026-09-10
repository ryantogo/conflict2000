/**
 * What to do when Hezbollah fires across the border.
 *
 * Every answer is paid for three times over — at home, in the region, and in
 * the West — and never in the same coin. Restraint plays well in Washington
 * and badly in Kiryat Shmona; punishing Beirut plays well in Kiryat Shmona and
 * costs the Arab world; hitting Syrian positions reins Hezbollah in and risks
 * Damascus. There is no answer that is free, which was the whole problem.
 *
 * Effects are written as plain numbers here because this is the data, not the
 * screen. The screen shows the `detail` line, in words.
 */

export type IncidentResponse =
  | 'restraint'
  | 'artillery'
  | 'airstrikes'
  | 'infrastructure'
  | 'syria'
  | 'diplomacy'
  | 'targeted'
  | 'ceasefire';

export interface ResponseSpec {
  id: IncidentResponse;
  label: string;
  /** Home · Region · West, in words. */
  detail: string;
  popularity?: number;
  /** Along the coalition's hawkish axis. */
  hawkish?: number;
  /** Direct moves to named parties. */
  party?: Record<string, number>;
  lebanon?: number;
  lebanonStability?: number;
  syria?: number;
  iran?: number;
  /** Every other Arab capital. */
  arab?: number;
  usa?: number;
  britain?: number;
  france?: number;
  prestige?: number;
  tension?: number;
  /** Damage to the group, a range. */
  strength?: [number, number];
  support?: number;
  deterrence?: number;
  /** Chance this answer tips a hostile Tehran into a rocket campaign. */
  escalation?: number;
  /** Raises activity on the Syrian border. */
  syriaActivity?: number;
  funds?: number;
  violence?: number;
}

export const RESPONSES: ResponseSpec[] = [
  {
    id: 'restraint',
    label: 'Complain to the U.N. Security Council',
    detail: 'Home: seen as weak · Region: unmoved · West: approves',
    popularity: -1,
    // The right grumbles; it does not walk out over a letter to the U.N. At
    // three times this, a year of complaints pushed the NRP and Yisrael
    // BaAliyah out of a government they open the game close to leaving.
    hawkish: -1.5,
    usa: 3,
    britain: 3,
    france: 3,
    prestige: 1,
    support: 1,
    deterrence: -6,
  },
  {
    id: 'artillery',
    label: 'Return fire on the launch sites',
    detail: 'Home: expected · Region: Beirut protests · West: silent',
    popularity: 1,
    hawkish: 2,
    lebanon: -3,
    strength: [2, 4],
    deterrence: 4,
    escalation: 0.03,
  },
  {
    id: 'airstrikes',
    label: 'Air strikes on Hezbollah positions',
    detail: 'Home: approves · Region: Beirut and Tehran furious · West: uneasy',
    popularity: 3,
    hawkish: 6,
    lebanon: -6,
    iran: -5,
    usa: -3,
    britain: -3,
    france: -4,
    tension: 3,
    strength: [8, 14],
    support: 5,
    deterrence: 10,
    escalation: 0.1,
    violence: 1,
  },
  {
    id: 'infrastructure',
    label: 'Strike Lebanese power stations and bridges',
    detail: 'Home: the right cheers, Meretz appalled · Region: the Arab world outraged · West: condemns',
    popularity: 4,
    hawkish: 8,
    party: { meretz: -8 },
    lebanon: -15,
    lebanonStability: -4,
    arab: -4,
    usa: -5,
    britain: -6,
    france: -8,
    prestige: -3,
    tension: 5,
    // The Lebanese blame the people who brought it on them, a little.
    support: -2,
    deterrence: 15,
    escalation: 0.15,
    violence: 2,
  },
  {
    id: 'syria',
    label: 'Hit Syrian positions in Lebanon — Damascus permits all this',
    detail: 'Home: approves · Region: Damascus may answer · West: alarmed',
    popularity: 2,
    hawkish: 5,
    syria: -20,
    usa: -4,
    tension: 8,
    strength: [3, 5],
    deterrence: 12,
    escalation: 0.05,
    syriaActivity: 1,
    violence: 1,
  },
  {
    id: 'diplomacy',
    label: 'Ask Washington and Paris to lean on Beirut and Damascus',
    detail: 'Home: seen as weak · Region: Beirut under pressure · West: engaged',
    popularity: -1,
    usa: 1,
  },
  {
    id: 'targeted',
    label: 'Mossad kills the commander responsible — $30 M',
    detail: 'Home: approves if it works · Region: Tehran vows revenge · West: looks away',
    iran: -5,
    funds: -30,
  },
  {
    id: 'ceasefire',
    label: 'Accept a U.N.-brokered ceasefire on the northern border',
    detail: 'Home: the north exhales, the right calls it surrender · Region: Hezbollah claims victory · West: relieved',
    popularity: -2,
    hawkish: -4,
    usa: 3,
    france: 3,
    support: 4,
  },
];

export function responseById(id: IncidentResponse): ResponseSpec {
  return RESPONSES.find((r) => r.id === id)!;
}
