/**
 * Core state types.
 *
 * The shape follows the 1990 original closely: a small bag of scalars per
 * nation, a handful of global meters, and per-turn "directives" that are
 * chosen during the turn and applied all at once when the turn resolves.
 */

export type NationId =
  | 'egypt'
  | 'iran'
  | 'iraq'
  | 'jordan'
  | 'lebanon'
  | 'libya'
  | 'syria';

/** The four states Israel shares a land border with — the victory targets. */
export type FrontId = 'egypt' | 'jordan' | 'lebanon' | 'syria';

export const FRONTS: FrontId[] = ['egypt', 'jordan', 'lebanon', 'syria'];

export const NATION_IDS: NationId[] = [
  'egypt',
  'iran',
  'iraq',
  'jordan',
  'lebanon',
  'libya',
  'syria',
];

export type SupplierId = 'usa' | 'britain' | 'france' | 'dealer';

export const SUPPLIER_IDS: SupplierId[] = ['usa', 'britain', 'france', 'dealer'];

// ---------------------------------------------------------------------------
// Directives — what the player queues up during a turn
// ---------------------------------------------------------------------------

export type DiplomaticDirective =
  | 'improve'
  | 'spoil'
  | 'maintain'
  | 'sign_pact'
  | 'break_pact'
  | 'reduce'
  | 'ceasefire'
  | 'restore';

export type IntelDirective =
  | 'support_insurgents'
  | 'disrupt_insurgents'
  | 'assassinate'
  | 'coup'
  | 'none';

export type StrategicDirective =
  | 'none'
  | 'small_deployment'
  | 'full_deployment'
  | 'max_deployment'
  | 'invade'
  | 'withdraw'
  | 'defensive'
  | 'strike_industrial'
  | 'strike_military'
  | 'strike_civilian'
  | 'strike_nuclear'
  | 'deploy_brigade'
  | 'deploy_tanks'
  | 'deploy_sam'
  | 'deploy_air'
  | 'deploy_all'
  | 'withdraw_brigade'
  | 'nuclear_strike';

export type PolicingDirective =
  | 'none'
  | 'post_brigade'
  | 'reduce_presence'
  | 'harden'
  | 'soften';

/** Everything the player has queued this month. Cleared on resolution. */
export interface Directives {
  diplomatic: Partial<Record<NationId, DiplomaticDirective>>;
  intel: Partial<Record<NationId, IntelDirective>>;
  strategic: Partial<Record<FrontId, StrategicDirective>>;
  policing: PolicingDirective;
  fundNuclear: boolean;
  /** Orders placed with suppliers this month; delivered after a lead time. */
  purchases: PurchaseOrder[];
}

export interface PurchaseOrder {
  supplier: SupplierId;
  itemId: string;
  quantity: number;
  unitCost: number;
  /** Turn index on which this order lands in the inventory. */
  arrivesOnTurn: number;
}

// ---------------------------------------------------------------------------
// Nations
// ---------------------------------------------------------------------------

export interface Forces {
  brigades: number;
  tanks: number;
  /** Fixed-wing combat aircraft. */
  aircraft: number;
  /**
   * Attack helicopters. Split out of `aircraft` because the player buys them
   * as their own line in the catalogue and expects to see them counted.
   * Arab air power stays a single aggregate in `aircraft`, so these are 0
   * for every nation.
   */
  helicopters: number;
  /** Airborne early warning and surveillance craft. Same reasoning. */
  awacs: number;
  sam: number;
}

/** Every air arm Israel tracks, as one number. All weigh the same in combat. */
export function airUnits(f: Forces): number {
  return f.aircraft + f.helicopters + f.awacs;
}

export interface Nation {
  id: NationId;
  name: string;
  adjective: string;
  capital: string;
  leader: string;
  /** True once the government has irrecoverably fallen. */
  collapsed: boolean;
  /** How the collapse happened — shown in the end-of-game analysis. */
  collapseCause?: 'invasion' | 'coup' | 'assassination' | 'insurgency' | 'internal';
  /** 0..9 on the original's relations ladder. Relations *with Israel*. */
  relations: number;
  /** Fine-grained relations accumulator; `relations` is derived from this. */
  relationsPoints: number;
  /** 0..100. High is stable. Mapped onto the 7-step stability ladder. */
  stability: number;
  /**
   * The level this regime returns to when left alone. Without it every state
   * random-walks into collapse and a passive player wins by waiting.
   */
  baseStability: number;
  /** Name of the insurgent group Israel can fund inside this state. */
  oppositionGroup: string;
  /** 0..100 strength of that group. */
  oppositionStrength: number;
  /** Whether Israel currently funds the opposition or props up the regime. */
  israeliPosture: 'supporting_opposition' | 'supporting_government' | 'neutral';
  /**
   * 0..100. How hard this state's own security service is looking for Mossad.
   * Rises every month Israel operates there and decays when it stops, so a
   * sustained campaign gets progressively harder and more likely to be seen.
   */
  counterIntel: number;
  forces: Forces;
  /** Relations between this nation and each other nation, 0..9. */
  interArab: Partial<Record<NationId, number>>;
  /** Nations this state is currently at war with (including 'israel'). */
  atWarWith: (NationId | 'israel')[];
  /** Nations this state has a military pact with. */
  pactWith: (NationId | 'israel')[];
  /** 0..100 progress toward a deliverable nuclear device. 100 = armed. */
  nuclearProgress: number;
  hasNuclear: boolean;
  /** Does this state border Israel? */
  isFront: boolean;
}

// ---------------------------------------------------------------------------
// Fronts
// ---------------------------------------------------------------------------

export interface Front {
  id: FrontId;
  /** Israeli forces committed to this border. */
  deployed: Forces;
  /** 0 = peaceful, 1 = some activity, 2 = large scale, 3 = full deployment. */
  enemyActivity: number;
  atWar: boolean;
  /** Months the current war has been running. */
  warMonths: number;
  /**
   * -100..+100. The manual's bottom-left readout: "the further it moves to the
   * right, the better you are doing in a border war".
   */
  warProgress: number;
  /** True once Israeli forces hold ground inside the other state. */
  territoryHeld: boolean;
  /** The reserve has already been thrown at this war; it only happens once. */
  mobilised: boolean;
  /** Consecutive months the line has been on the point of breaking. */
  collapseMonths: number;
  /** U.N. has declared this a military-free zone after a settled war. */
  demilitarised: boolean;
}

// ---------------------------------------------------------------------------
// Israel
// ---------------------------------------------------------------------------

export type NuclearPosture = 'opacity' | 'signalled' | 'declared' | 'tested';

export interface Israel {
  leader: string;
  /** 0..100 → MODERATE .. UNRIVALLED */
  prestige: number;
  /** Standing with Washington, 0..100. Drives aid and embargo risk. */
  usRelations: number;
  /** $M per month. */
  defenceBudget: number;
  /** Funds on hand for arms purchases, $M. */
  funds: number;
  gnpPercent: number;
  /** Total brigades raised. 7 at start, as in the original. */
  brigades: number;
  /** Reserve manpower, in thousands. */
  reserves: number;
  /** Undeployed equipment pool. */
  stockpile: Forces;
  /** 0..100 domestic standing. Falls to zero and the Knesset removes you. */
  popularity: number;
  nuclearPosture: NuclearPosture;
  /** 0..100 toward the next posture step. */
  nuclearProgress: number;
  warheads: number;
  /** Per-supplier loyalty 0..100 and embargo state. */
  suppliers: Record<SupplierId, SupplierState>;
}

export interface SupplierState {
  loyalty: number;
  embargoed: boolean;
  /** Total spent with this supplier, $M — the original tracked buying record. */
  spent: number;
}

// ---------------------------------------------------------------------------
// The Palestinian question
// ---------------------------------------------------------------------------

export interface Palestine {
  /** 0..10 on the original's 11-step unrest ladder. */
  unrest: number;
  /** Brigades committed to policing. */
  brigadesPosted: number;
  presence: 'full' | 'low';
  tactics: 'soft' | 'hard';
  /** True once a homeland has been conceded at a summit. */
  homelandCreated: boolean;
  /** Set when the Second Intifada has been triggered. */
  intifada: boolean;
}

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export type NewsCategory =
  | 'war'
  | 'diplomacy'
  | 'intelligence'
  | 'palestine'
  | 'nuclear'
  | 'domestic'
  | 'economy'
  | 'filler';

export interface Headline {
  text: string;
  category: NewsCategory;
  /** 0 = filler, 3 = front page lead. Drives layout in the newspaper screen. */
  weight: number;
}

export interface NewspaperIssue {
  masthead: string;
  dateLine: string;
  headlines: Headline[];
}

// ---------------------------------------------------------------------------
// Game
// ---------------------------------------------------------------------------

export type GamePhase =
  | 'title'
  | 'newspaper'
  | 'briefing'
  | 'planning'
  | 'summit'
  | 'budget'
  | 'gameover';

export type EndingKind =
  | 'victory'
  | 'removed_by_knesset'
  | 'assassinated'
  | 'invaded'
  | 'holocaust'
  | 'holocaust_bystander'
  | 'survived';

export interface Ending {
  kind: EndingKind;
  headline: string;
  body: string;
  score: number;
  analysis: string[];
  style: string;
}

export interface GameState {
  /** Months elapsed since the start. Turn 0 is June 2000. */
  turn: number;
  year: number;
  /** 0 = January. Turn 0 is month 5 (June). */
  month: number;
  phase: GamePhase;
  rngSeed: number;
  israel: Israel;
  nations: Record<NationId, Nation>;
  fronts: Record<FrontId, Front>;
  palestine: Palestine;
  /** 0..100 regional tension. Drives summits and holocaust risk. */
  tension: number;
  /** Arms orders in transit. */
  pending: PurchaseOrder[];
  directives: Directives;
  /** Issue shown at the top of the current turn (reporting last turn). */
  paper: NewspaperIssue | null;
  /** Advisor lines for the briefing screen. */
  briefing: string[];
  /**
   * A summit or budget meeting waiting behind this month's newspaper. The
   * papers always come first — that is the shape of the turn.
   */
  pendingInterstitial: 'summit' | 'budget' | null;
  /** Set once the game is over. */
  ending: Ending | null;
  /** Running tallies used by the end-of-game analysis. */
  stats: {
    actsOfViolence: number;
    warsStarted: number;
    strikesOrdered: number;
    nukesUsed: number;
    assassinationsOrdered: number;
    coupsOrdered: number;
    armsAgreements: number;
    armsExpenditure: number;
  };
  /** Ids of scripted events that have already fired. */
  firedEvents: string[];
  /** Free-text log of everything that happened, newest first. */
  log: string[];
}
