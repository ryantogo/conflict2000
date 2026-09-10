/**
 * Before the cabinet.
 *
 * The coalition used to be something that happened to the premier: partners
 * reacted to what he did abroad and walked out when they had had enough. That
 * is half of it. The other half is the stream of demands a coalition makes of
 * its own leader — a school network that has run out of money, a turbine that
 * has to be moved on the Sabbath, a ministry two partners both want — each of
 * which is a choice about who to disappoint.
 *
 * Every dilemma here is real or close to it, 1999–2002. Each has a fallback,
 * which is what happens when the premier does not decide: usually the worst
 * outcome for whoever raised it, plus the cost of having looked indecisive.
 */

import type { GameState } from '../engine/types';

export type CabinetAxis = 'territorial' | 'hawkish' | 'welfare' | 'religious';

export interface CabinetEffect {
  /** Direct moves to named parties' satisfaction. */
  party?: Record<string, number>;
  /** Moves along an axis, which every party reads its own way. */
  axis?: Partial<Record<CabinetAxis, number>>;
  /** Parties brought into the government by this choice. */
  join?: string[];
  popularity?: number;
  funds?: number;
  usa?: number;
  unrest?: number;
  tension?: number;
  prestige?: number;
}

export interface CabinetChoice {
  id: string;
  label: string;
  /** Who is pleased and who is not — in words, never numbers. */
  detail: string;
  effect: CabinetEffect;
}

export interface CabinetEvent {
  id: string;
  title: string;
  body: string;
  when: (s: GameState) => boolean;
  choices: CabinetChoice[];
  /** What happens if nobody decides. */
  fallback: string;
  /** Some questions are only ever asked once. */
  once?: boolean;
}

const inGov = (s: GameState, id: string) => !!s.israel.coalition[id]?.inCoalition;

export const CABINET_EVENTS: CabinetEvent[] = [
  {
    id: 'shas_schools',
    title: 'The Shas school network is out of money',
    body:
      'El HaMaayan cannot pay its teachers past the end of the month. Shas wants the ' +
      'shortfall covered from the budget reserve, and has made clear what happens if it is not.',
    when: (s) => inGov(s, 'shas'),
    choices: [
      {
        id: 'pay',
        label: 'Cover the shortfall from the reserve — $60 M',
        detail: 'Shas and United Torah Judaism grateful · Meretz and Shinui object',
        effect: { funds: -60, party: { shas: 16, utj: 5, meretz: -6, shinui: -6 } },
      },
      {
        id: 'half',
        label: 'Offer half, and an audit — $25 M',
        detail: 'Shas unhappy but still at the table',
        effect: { funds: -25, party: { shas: 4, meretz: -2 } },
      },
      {
        id: 'refuse',
        label: 'Refuse — the budget is the budget',
        detail: 'Shas furious · the secular parties approve',
        effect: { party: { shas: -14, meretz: 3, shinui: 4 } },
      },
    ],
    fallback: 'refuse',
  },
  {
    id: 'tal_law',
    title: 'The Tal Committee reports on the draft',
    body:
      'The committee proposes to write the yeshiva students’ exemption from military ' +
      'service into law. The haredi parties want it passed as it stands; half the ' +
      'country regards it as the end of the people’s army.',
    when: (s) => s.year <= 2002,
    once: true,
    choices: [
      {
        id: 'enact',
        label: 'Put the Tal Law to the Knesset',
        detail: 'The religious parties delighted · Shinui, Meretz and Yisrael BaAliyah outraged',
        effect: { axis: { religious: 12 }, popularity: -2 },
      },
      {
        id: 'shelve',
        label: 'Shelve the report',
        detail: 'Shas and United Torah Judaism betrayed · the secular parties relieved',
        effect: { axis: { religious: -10 } },
      },
    ],
    fallback: 'shelve',
  },
  {
    id: 'turbine',
    title: 'A turbine has to be moved on the Sabbath',
    body:
      'The Electric Corporation says the new generator can only travel when the roads are ' +
      'empty. United Torah Judaism brought down a government over exactly this in 1999.',
    when: (s) => inGov(s, 'utj'),
    once: true,
    choices: [
      {
        id: 'move',
        label: 'Move it on the Sabbath — the grid comes first',
        detail: 'United Torah Judaism may walk · Shinui and Yisrael BaAliyah approve',
        effect: { party: { utj: -20, shas: -6, shinui: 5, yisrael_baaliyah: 4 } },
      },
      {
        id: 'wait',
        label: 'Wait for a weekday and pay the penalty clauses — $30 M',
        detail: 'The haredi parties mollified · the Treasury is not',
        effect: { funds: -30, party: { utj: 6, shas: 3, shinui: -4 } },
      },
    ],
    fallback: 'move',
  },
  {
    id: 'outposts',
    title: 'Settlers have put up new outposts',
    body:
      'Caravans on hilltops east of the fence, with no permit and a great deal of support in ' +
      'the NRP. The Americans have noticed; so has Meretz.',
    when: (s) => !s.palestine.homelandCreated,
    choices: [
      {
        id: 'legalise',
        label: 'Legalise them after the fact',
        detail: 'The right pleased · Meretz outraged · Washington angry · the territories notice',
        effect: { axis: { territorial: -10 }, usa: -4, unrest: 0.5 },
      },
      {
        id: 'remove',
        label: 'Send the army to take them down',
        detail: 'Meretz and Washington approve · the NRP and Yisrael BaAliyah bitter · ugly pictures',
        effect: { axis: { territorial: 10 }, usa: 3, popularity: -2 },
      },
    ],
    fallback: 'legalise',
  },
  {
    id: 'settlement_freeze',
    title: 'Meretz demands a settlement freeze',
    body:
      'Sarid says his party cannot sit in a government that is building while it negotiates, ' +
      'and would like an answer before the faction meets on Sunday.',
    when: (s) => inGov(s, 'meretz') && !s.palestine.homelandCreated,
    choices: [
      {
        id: 'freeze',
        label: 'Announce a freeze',
        detail: 'Meretz stays · the NRP and Yisrael BaAliyah furious · Washington pleased',
        effect: { party: { meretz: 15, nrp: -15, yisrael_baaliyah: -6, likud: -5 }, usa: 4 },
      },
      {
        id: 'refuse',
        label: 'Refuse — natural growth continues',
        detail: 'Meretz on the way out · the right relieved',
        effect: { party: { meretz: -12, nrp: 4 } },
      },
    ],
    fallback: 'refuse',
  },
  {
    id: 'interior',
    title: 'Two partners want the Interior Ministry',
    body:
      'Shas holds it and uses it to run conversions and registration. Yisrael BaAliyah says ' +
      'its voters — a million immigrants — are being registered by people who doubt they ' +
      'are Jewish.',
    when: (s) => inGov(s, 'shas') && inGov(s, 'yisrael_baaliyah'),
    once: true,
    choices: [
      {
        id: 'to_yba',
        label: 'Give the ministry to Yisrael BaAliyah',
        detail: 'The immigrants’ party delighted · Shas humiliated',
        effect: { party: { yisrael_baaliyah: 16, shas: -14, shinui: 3 } },
      },
      {
        id: 'to_shas',
        label: 'Leave it with Shas',
        detail: 'Shas keeps its prize · Yisrael BaAliyah resentful',
        effect: { party: { shas: 4, yisrael_baaliyah: -10 } },
      },
    ],
    fallback: 'to_shas',
  },
  {
    id: 'civil_marriage',
    title: 'A civil marriage bill reaches its first reading',
    body:
      'Couples the rabbinate will not marry fly to Cyprus. Meretz and Shinui want that to ' +
      'stop, Yisrael BaAliyah’s voters need it to, and the religious parties will not ' +
      'sit in a government that allows it.',
    when: (s) => s.year >= 2001,
    once: true,
    choices: [
      {
        id: 'support',
        label: 'Back the bill',
        detail: 'The secular parties delighted · Shas and United Torah Judaism may walk',
        effect: { axis: { religious: -12 }, popularity: 1 },
      },
      {
        id: 'block',
        label: 'Let it die in committee',
        detail: 'The religious parties relieved · Shinui and Meretz contemptuous',
        effect: { axis: { religious: 8 } },
      },
    ],
    fallback: 'block',
  },
  {
    id: 'budget_cuts',
    title: 'The Treasury wants cuts',
    body:
      'The deficit is over target and the Governor of the Bank of Israel is saying so in ' +
      'public. The Finance Ministry has two lists, and every party has read both.',
    when: (s) => s.israel.gnpPercent > 9.5 || s.palestine.intifada,
    choices: [
      {
        id: 'welfare',
        label: 'Cut child allowances and yeshiva budgets',
        detail: 'The Treasury satisfied · the welfare parties furious',
        effect: { axis: { welfare: -12 }, funds: 80 },
      },
      {
        id: 'defence',
        label: 'Cut the defence reserve',
        detail: 'The generals and the hawks object · everyone else relieved',
        effect: { axis: { hawkish: -6 }, funds: -40 },
      },
      {
        id: 'borrow',
        label: 'Borrow, and say nothing',
        detail: 'Nobody pleased · nobody walks out',
        effect: { popularity: -2 },
      },
    ],
    fallback: 'borrow',
  },
  {
    id: 'inquiry',
    title: 'Families of the fallen want an inquiry',
    body:
      'Bereaved parents are camped outside the Prime Minister’s office. They want a state ' +
      'commission into how the war was run, and the Centre Party’s generals agree with them.',
    when: (s) => s.stats.warsStarted > 0 && s.israel.reserves < 400,
    once: true,
    choices: [
      {
        id: 'appoint',
        label: 'Appoint a state commission of inquiry',
        detail: 'The country respects it · the Centre approves · the generals do not',
        effect: { popularity: 4, party: { centre: 8, meretz: 4 }, axis: { hawkish: -3 } },
      },
      {
        id: 'refuse',
        label: 'Refuse — not while the army is still fighting',
        detail: 'The protest grows · the Centre and Meretz disgusted',
        effect: { popularity: -4, party: { centre: -8, meretz: -6 } },
      },
    ],
    fallback: 'refuse',
  },
  {
    id: 'temple_mount',
    title: 'The right wants a statement on the Temple Mount',
    body:
      'After the failure at the summit, the NRP and Likud want the government to declare ' +
      'that Israeli sovereignty over the Mount is not negotiable, in so many words.',
    when: (s) =>
      ['palestinians_refused', 'israel_refused', 'absent'].includes(s.palestine.finalStatus),
    once: true,
    choices: [
      {
        id: 'assert',
        label: 'Make the statement',
        detail: 'The right cheers · Meretz walks toward the door · the street in the territories hears it',
        effect: { axis: { territorial: -12 }, unrest: 1, tension: 4, popularity: 3 },
      },
      {
        id: 'silent',
        label: 'Say nothing that cannot be unsaid',
        detail: 'Meretz relieved · the right calls it weakness',
        effect: { axis: { territorial: 4 }, popularity: -1 },
      },
    ],
    fallback: 'silent',
  },
  {
    id: 'unity',
    title: 'Likud offers a national unity government',
    body:
      'Sharon will bring nineteen seats into the government for the duration of the ' +
      'emergency, a veto on the peace file, and the Defence Ministry. Meretz will not ' +
      'sit at the same table.',
    when: (s) =>
      s.palestine.intifada && !inGov(s, 'likud') && s.israel.coalition.likud !== undefined,
    once: true,
    choices: [
      {
        id: 'accept',
        label: 'Accept — form a unity government',
        detail: 'Likud joins · Meretz leaves · the country relieved · the peace file frozen',
        effect: { join: ['likud'], party: { likud: 30, meretz: -30 }, popularity: 5, axis: { territorial: -6 } },
      },
      {
        id: 'decline',
        label: 'Decline — we govern with the partners we have',
        detail: 'Likud contemptuous · Meretz grateful',
        effect: { party: { likud: -10, meretz: 5 }, popularity: -2 },
      },
    ],
    fallback: 'decline',
  },
  {
    id: 'reservists',
    title: 'Reservists protest the burden of call-ups',
    body:
      'Men who have done forty days this year are being called for forty more, while the ' +
      'yeshivas are exempt. They are marching on the Knesset in uniform.',
    when: (s) => Object.values(s.fronts).some((f) => f.atWar) || s.palestine.intifada,
    choices: [
      {
        id: 'benefits',
        label: 'A reservists’ benefits package — $40 M',
        detail: 'The reservists placated · the country approves',
        effect: { funds: -40, popularity: 3, party: { yisrael_baaliyah: 3, centre: 3 } },
      },
      {
        id: 'share',
        label: 'Promise to share the burden — end the yeshiva exemption',
        detail: 'The secular parties cheer · the religious parties threaten to walk',
        effect: { axis: { religious: -8 }, popularity: 2 },
      },
      {
        id: 'ignore',
        label: 'Say it is a matter for the army',
        detail: 'The march grows',
        effect: { popularity: -3 },
      },
    ],
    fallback: 'ignore',
  },
];

export function cabinetEventById(id: string): CabinetEvent | undefined {
  return CABINET_EVENTS.find((e) => e.id === id);
}
