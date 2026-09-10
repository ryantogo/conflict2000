import type {
  Directives,
  Front,
  FrontId,
  GameState,
  Israel,
  SupplierId,
} from './types';
import { FRONTS } from './types';
import { createNations } from '../data/nations2000';
import { israeliOpeningStock } from '../data/inventory2000';

export function emptyDirectives(): Directives {
  return {
    diplomatic: {},
    intel: {},
    strategic: {},
    policing: 'none',
    fundNuclear: false,
    purchases: [],
  };
}

function createFront(id: FrontId): Front {
  return {
    id,
    deployed: { brigades: 0, equipment: {} },
    enemyActivity: 0,
    atWar: false,
    warMonths: 0,
    warProgress: 0,
    territoryHeld: false,
    mobilised: false,
    collapseMonths: 0,
    demilitarised: false,
    demilitarisedMonths: 0,
  };
}

function createIsrael(): Israel {
  const suppliers = {} as Israel['suppliers'];
  const start: Record<SupplierId, number> = {
    // Barak is Washington's man in June 2000 and the aid pipeline is open.
    usa: 70,
    britain: 35,
    france: 25,
    dealer: 10,
  };
  for (const id of Object.keys(start) as SupplierId[]) {
    suppliers[id] = { loyalty: start[id], embargoed: false, spent: 0 };
  }

  return {
    leader: 'Ehud Barak',
    prestige: 44,
    usRelations: 74,
    // Roughly $9bn/yr of Israeli defence spending, expressed monthly.
    defenceBudget: 760,
    funds: 760,
    gnpPercent: 8.6,
    brigades: 7,
    reserves: 430,
    // The 450-strong air arm of the original, broken out the way the player
    // buys it: roughly the June 2000 IAF — combat aircraft, an attack
    // helicopter force, and a handful of early warning craft.
    stockpile: { brigades: 0, equipment: israeliOpeningStock() },
    // A narrow coalition that historically fell apart before Camp David.
    popularity: 47,
    nuclearPosture: 'opacity',
    nuclearProgress: 40,
    warheads: 4,
    suppliers,
  };
}

export function createGame(seed = Date.now() & 0x7fffffff): GameState {
  const fronts = {} as Record<FrontId, Front>;
  for (const f of FRONTS) fronts[f] = createFront(f);

  // Three weeks after the withdrawal, the Lebanese border is not quiet.
  fronts.lebanon.enemyActivity = 1;

  return {
    turn: 0,
    year: 2000,
    month: 5, // June
    phase: 'title',
    rngSeed: seed,
    israel: createIsrael(),
    nations: createNations(),
    fronts,
    palestine: {
      unrest: 2,
      brigadesPosted: 1,
      presence: 'full',
      tactics: 'soft',
      homelandCreated: false,
      intifada: false,
    },
    tension: 34,
    pending: [],
    directives: emptyDirectives(),
    paper: null,
    briefing: [],
    pendingInterstitial: null,
    ending: null,
    stats: {
      actsOfViolence: 0,
      warsStarted: 0,
      strikesOrdered: 0,
      nukesUsed: 0,
      assassinationsOrdered: 0,
      coupsOrdered: 0,
      armsAgreements: 0,
      armsExpenditure: 0,
    },
    firedEvents: [],
    log: [],
  };
}

/** Brigades not committed to a border or to policing duty. */
export function freeBrigades(s: GameState): number {
  let used = s.palestine.brigadesPosted;
  for (const f of FRONTS) used += s.fronts[f].deployed.brigades;
  return Math.max(0, s.israel.brigades - used);
}

export function activeWars(s: GameState): FrontId[] {
  return FRONTS.filter((f) => s.fronts[f].atWar);
}
