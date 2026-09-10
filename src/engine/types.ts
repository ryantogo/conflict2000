/**
 * Core state types.
 *
 * The shape follows the 1990 original closely: a small bag of scalars per
 * nation, a handful of global meters, and per-turn "directives" that are
 * chosen during the turn and applied all at once when the turn resolves.
 */

import type { PowerDirective, PowerId, PowerState } from './powers';
import type { FactionDirective, FactionState } from './factions';

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
  | 'ceasefire';

export type IntelDirective =
  | 'collect'
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
  /** Approaches to the capitals that are not in the region. */
  powers: Partial<Record<PowerId, PowerDirective>>;
  /** What to do about the armed groups that are not governments. */
  factions: Record<string, FactionDirective>;
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

/**
 * A named-item inventory: how many of each equipment id are held here.
 *
 * Everything material is one of these. A count of "tanks" is a question you
 * ask a fleet, not a field it stores, because which tanks they are is the
 * whole point.
 */
export type Fleet = Record<string, number>;

export interface Forces {
  /** Manpower formations. Not equipment, and not interchangeable with it. */
  brigades: number;
  /** Everything with a serial number. */
  equipment: Fleet;
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
  /**
   * 0..100 Israeli penetration of this country: agents run, officials turned,
   * telephones listened to. Built slowly, lost quickly, and the thing that
   * decides whether the assessment of their army is worth reading.
   */
  network: number;
  /**
   * −1..1, redrawn each month. Which way our estimate of them is wrong this
   * month. Stored rather than rolled on demand so that a screen refresh does
   * not produce a different assessment.
   */
  estimateBias: number;
  /** Whether Israel currently funds the opposition or props up the regime. */
  israeliPosture: 'supporting_opposition' | 'supporting_government' | 'neutral';
  /**
   * 0..100. How hard this state's own security service is looking for Mossad.
   * Rises every month Israel operates there and decays when it stops, so a
   * sustained campaign gets progressively harder and more likely to be seen.
   */
  counterIntel: number;
  forces: Forces;
  /**
   * Fractional equipment deliveries carried between months, so a state that
   * can afford two thirds of a tank a month eventually gets a tank.
   */
  rearmPoints: number;
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
  /**
   * Months the mandate still has to run. The screens have always called this
   * a consequence of "the recent conflict"; a zone that never lapsed quietly
   * removed a whole front from the game in both directions, for good.
   */
  demilitarisedMonths: number;
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
  powers: Record<PowerId, PowerState>;
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
  /**
   * 0..100 public standing. What the country thinks of you, which is not the
   * same question as whether you can still pass a budget — see `coalition`.
   */
  popularity: number;
  /** Where each Knesset party stands, keyed by partner id. */
  coalition: Record<string, { satisfaction: number; inCoalition: boolean }>;
  /** Set the month a no-confidence motion carries. Ends the game. */
  lostConfidence: boolean;
  /**
   * Months an undertaking given to a Western capital still binds us. While it
   * runs, the aggressive options are off the menu — with the reason shown,
   * because a promise you can quietly break is not a promise.
   */
  restraint: number;
  /**
   * 0..1 floor on how well we see every country at once, from satellites and
   * long-endurance reconnaissance. Bought rather than recruited, which is the
   * whole argument for building either.
   */
  overhead: number;
  nuclearPosture: NuclearPosture;
  /** 0..100 toward the next posture step. */
  nuclearProgress: number;
  warheads: number;
  /** Per-supplier loyalty 0..100 and embargo state. */
  suppliers: Record<SupplierId, SupplierState>;
  /** Our own factories, keyed by production line id. */
  production: Record<string, ProductionState>;
  /**
   * Serviceability of each origin's equipment, 0..1. An embargo does not
   * confiscate aircraft, it stops the spares; airframes go unserviceable a
   * few at a time until somebody starts selling parts again.
   */
  readiness: Record<string, number>;
}

/** A standing production line, funded until you stop funding it. */
export interface ProductionState {
  /** Months of development still to run before the line can open. */
  development: number;
  /** Whether the Treasury is currently paying for it. */
  running: boolean;
  /** Units delivered to date, for the review screens. */
  delivered: number;
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
  /** Armed non-state groups, keyed by faction id. */
  factions: Record<string, FactionState>;
  /** Ids of scripted events that have already fired. */
  firedEvents: string[];
  /** Free-text log of everything that happened, newest first. */
  log: string[];
}
