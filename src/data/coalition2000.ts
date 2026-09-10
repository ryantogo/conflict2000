/**
 * The Knesset, June 2000.
 *
 * `Israel.popularity` measures what the country thinks of you. It is not the
 * same question as whether you can still pass a budget, and conflating the two
 * was the single largest simplification in the domestic model: a premier could
 * concede a Palestinian homeland, lose fourteen points of polling, and govern
 * on undisturbed.
 *
 * Barak's real coalition held about 75 of 120 seats and was already coming
 * apart. Meretz walked out on 23 June 2000 over the religious affairs
 * ministry; Shas, the National Religious Party and Yisrael BaAliyah all quit
 * on 9 July, on the eve of Camp David, leaving him governing as a minority
 * for the rest of his term. That is turn one and turn two of this game.
 *
 * Partners are not scored on your popularity. They are scored on the specific
 * things they care about, which is why the same act can hold your coalition
 * together and destroy it depending on who is in it.
 */

/**
 * Something a single party wants badly enough to be bought with, and which
 * somebody else will mind. Effects are in the cabinet's own vocabulary; see
 * `CabinetEffect` in `cabinet2000.ts`.
 */
export interface PetConcession {
  label: string;
  /** Who is pleased and who is not, in words, for the choice line. */
  detail: string;
  effect: {
    party?: Record<string, number>;
    funds?: number;
    usa?: number;
    unrest?: number;
  };
}

export interface Partner {
  id: string;
  name: string;
  /** Of 120. A government needs 61. */
  seats: number;
  /** Short line for the domestic screen. */
  character: string;
  /**
   * How they respond to concessions to the Palestinians. Positive wants them,
   * negative regards them as a betrayal.
   */
  territorial: number;
  /** How they respond to the use of force. Positive approves. */
  hawkish: number;
  /**
   * How they respond to defence spending crowding out everything else.
   * Positive means they notice and mind.
   */
  welfare: number;
  /**
   * Religion and state: the draft exemption, the Sabbath, civil marriage, the
   * rabbinate. Positive wants more of it. This is the axis on which Shas and
   * Shinui cannot both be satisfied, and on which most Israeli coalitions of
   * the period actually broke.
   */
  religious: number;
  /** True for the premier's own bloc, which cannot walk out on itself. */
  ownParty?: boolean;
  /**
   * Outside the government at the start and not waiting to come back: they
   * settle toward `resting` rather than toward indifference, and have to be
   * brought in on purpose.
   */
  courtable?: boolean;
  resting?: number;
  /** The concession that buys them, and what it costs elsewhere. */
  pet?: PetConcession;
}

/** A government needs a simple majority of the 120 seats. */
export const MAJORITY = 61;

/** Below this, a partner leaves the government. */
export const WALKOUT_THRESHOLD = 25;

/**
 * Above this, a partner that walked out can be brought back in. Israeli
 * coalitions are renegotiated, not dissolved — a party out of government is a
 * party being courted back into it.
 */
export const RETURN_THRESHOLD = 48;

export const PARTNERS: Partner[] = [
  {
    id: 'one_israel',
    name: 'One Israel',
    seats: 26,
    character: 'Your own bloc. Labour, Gesher and Meimad.',
    territorial: 0.6,
    hawkish: -0.2,
    welfare: 0.4,
    religious: -0.2,
    ownParty: true,
  },
  {
    id: 'shas',
    name: 'Shas',
    seats: 17,
    character: 'Sephardi religious. Cares about its school network above all.',
    // The pivot. Seventeen seats, and it walked out over exactly this on the
    // eve of Camp David — no Israeli premier gets to ignore where Shas is.
    territorial: -0.55,
    hawkish: 0.2,
    welfare: 1.0,
    religious: 1.0,
    pet: {
      label: 'Restore the yeshiva stipends — $30 M',
      detail: 'Shas delighted · Shinui and Meretz appalled',
      effect: { funds: -30, party: { shas: 15, shinui: -8, meretz: -4 } },
    },
  },
  {
    id: 'meretz',
    name: 'Meretz',
    seats: 10,
    character: 'Secular left. Wants the concessions and dislikes the methods.',
    territorial: 1.0,
    hawkish: -0.8,
    welfare: 0.6,
    religious: -0.9,
    pet: {
      label: 'Freeze new settlement tenders',
      detail: 'Meretz reassured · the National Religious Party and Likud furious · Washington pleased',
      effect: { party: { meretz: 15, nrp: -10, likud: -6 }, usa: 3 },
    },
  },
  {
    id: 'centre',
    name: 'The Centre Party',
    seats: 6,
    character: 'Generals in retirement. Pragmatic about most things.',
    territorial: 0.2,
    hawkish: 0.3,
    welfare: 0.0,
    religious: -0.3,
    pet: {
      label: 'Give the generals a seat in the peace negotiations',
      detail: 'The Centre flattered · Meretz a little uneasy',
      effect: { party: { centre: 14, meretz: -3 } },
    },
  },
  {
    id: 'yisrael_baaliyah',
    name: 'Yisrael BaAliyah',
    seats: 6,
    character: 'The Russian immigration. Security first, and suspicious of talks.',
    territorial: -0.5,
    hawkish: 0.6,
    welfare: 0.5,
    religious: -0.6,
    pet: {
      label: 'An immigrant absorption package — $30 M',
      detail: 'Yisrael BaAliyah grateful · nobody else much minds',
      effect: { funds: -30, party: { yisrael_baaliyah: 15 } },
    },
  },
  {
    id: 'nrp',
    name: 'National Religious Party',
    seats: 5,
    character: 'The settlements. Regards a territorial concession as a betrayal.',
    territorial: -1.0,
    hawkish: 0.8,
    welfare: -0.2,
    religious: 0.6,
    pet: {
      label: 'Approve new housing in the settlements',
      detail: 'The NRP satisfied · Meretz furious · Washington displeased · the territories notice',
      effect: { party: { nrp: 16, meretz: -12 }, usa: -4, unrest: 0.4 },
    },
  },
  {
    id: 'utj',
    name: 'United Torah Judaism',
    seats: 5,
    character: 'Ashkenazi haredi. Interested in the budget, not the map.',
    territorial: -0.4,
    hawkish: 0.0,
    welfare: 0.9,
    religious: 1.0,
    pet: {
      label: 'Widen the Torah-study draft deferrals',
      detail: 'United Torah Judaism content · Shinui, Yisrael BaAliyah and Meretz angry',
      effect: { party: { utj: 15, shinui: -10, yisrael_baaliyah: -6, meretz: -5 } },
    },
  },

  // --- outside the government in June 2000, and not waiting to come back ---
  {
    id: 'likud',
    name: 'Likud',
    seats: 19,
    character: 'The opposition. Sharon leads it, and would join a unity government on his terms.',
    territorial: -0.9,
    hawkish: 0.8,
    welfare: 0.1,
    religious: 0.1,
    courtable: true,
    resting: 22,
    pet: {
      label: 'Take a hard line on Jerusalem in public',
      detail: 'Likud warms to us · Meretz furious · Washington uneasy',
      effect: { party: { likud: 14, meretz: -10 }, usa: -3 },
    },
  },
  {
    id: 'shinui',
    name: 'Shinui',
    seats: 6,
    character: 'Secular and middle class. Against the haredi parties before anything else.',
    territorial: 0.3,
    hawkish: 0.0,
    welfare: -0.3,
    religious: -1.0,
    courtable: true,
    resting: 30,
    pet: {
      label: 'Table a secular core-curriculum bill',
      detail: 'Shinui interested · Shas and United Torah Judaism outraged',
      effect: { party: { shinui: 15, shas: -8, utj: -8 } },
    },
  },
];

/**
 * Opening satisfaction. Deliberately uneven and deliberately narrow — this is
 * a government that historically had weeks left, and the player inherits it
 * mid-collapse rather than at full strength.
 */
export const OPENING_SATISFACTION: Record<string, number> = {
  one_israel: 68,
  shas: 40,
  meretz: 36,
  centre: 55,
  yisrael_baaliyah: 42,
  nrp: 34,
  utj: 40,
  likud: 22,
  shinui: 30,
};

export function partnerById(id: string): Partner | undefined {
  return PARTNERS.find((p) => p.id === id);
}
