/**
 * Arms procurement.
 *
 * Suppliers remember. Loyalty rises when you buy and decays when you don't,
 * it gates the catalogue, and Washington in particular watches where else you
 * shop. Everything is delivered late, which is the point: you have to buy
 * before you know you need it.
 */

import type { GameState, PurchaseOrder, SupplierId } from './types';
import { SUPPLIER_IDS } from './types';
import { clamp } from './ladders';
import { CATALOGUE, catalogueFor, itemById } from '../data/arms2000';
import { addUnits, countOf } from './fleet';
import type { Origin } from '../data/equipment';
import type { ArmsItem } from '../data/arms2000';
import { EMBARGO_READINESS, POWER_IDS, POWER_NAMES, adjustRelations, relationsWith } from './powers';
import type { PowerId } from './powers';

export interface DealerGreeting {
  mood: string;
  line: string;
  canTrade: boolean;
  reason?: string;
}

export function greet(s: GameState, supplier: SupplierId): DealerGreeting {
  const st = s.israel.suppliers[supplier];

  if (st.embargoed) {
    return {
      mood: 'The dealer will not meet your eye:',
      line: 'Due to the official arms embargo on Israel, I have been instructed to make no sales.',
      canTrade: false,
      reason: 'embargo',
    };
  }
  if (s.israel.funds < 20) {
    return {
      mood: 'The dealer glances at your accounts:',
      line: 'Due to your current lack of funds, we feel unable to do business.',
      canTrade: false,
      reason: 'funds',
    };
  }

  if (st.loyalty >= 70) {
    return {
      mood: 'The smooth talking salesman smiles:',
      line: '<Your outstanding purchasing loyalty has been noted.>',
      canTrade: true,
    };
  }
  if (st.loyalty >= 40) {
    return {
      mood: 'The salesman spreads out his catalogue:',
      line: '<We are ready to sell you any arms required.>',
      canTrade: true,
    };
  }
  if (st.loyalty >= 20) {
    return {
      mood: 'The arms dealer looks nervous:',
      line: '<We will try to meet the needs of your limited exchequer.>',
      canTrade: true,
    };
  }
  return {
    mood: 'The shifty arms trader removes his shades:',
    line: '<I am advised only to offer you a limited selection of arms.>',
    canTrade: true,
  };
}

export function availableFrom(s: GameState, supplier: SupplierId): ArmsItem[] {
  const st = s.israel.suppliers[supplier];
  if (st.embargoed) return [];
  return catalogueFor(supplier, st.loyalty);
}

/** Place an order. Returns null on success, or a refusal string. */
export function placeOrder(
  s: GameState,
  supplier: SupplierId,
  itemId: string,
  quantity: number,
): string | null {
  const item = itemById(itemId);
  if (!item) return 'Unknown item.';
  const st = s.israel.suppliers[supplier];
  if (st.embargoed) return 'That supplier is observing the embargo.';
  if (st.loyalty < item.minLoyalty) return 'That system is not on offer to you.';
  if (quantity < 1) return 'Order at least one unit.';

  const cost = item.cost * quantity;
  if (cost > s.israel.funds) return 'Insufficient funds.';

  s.israel.funds -= cost;
  st.spent += cost;
  st.loyalty = clamp(st.loyalty + Math.min(12, Math.round(cost / 25)), 0, 100);
  s.stats.armsAgreements++;
  s.stats.armsExpenditure += cost;

  const order: PurchaseOrder = {
    supplier,
    itemId,
    quantity,
    unitCost: item.cost,
    arrivesOnTurn: s.turn + item.leadTime,
  };
  s.pending.push(order);
  s.directives.purchases.push(order);

  // Washington notices when you shop on the grey market.
  if (supplier === 'dealer') {
    s.israel.suppliers.usa.loyalty = clamp(s.israel.suppliers.usa.loyalty - 4, 0, 100);
    adjustRelations(s, 'usa', -2);
  }
  return null;
}

/** Land any orders that are due, and decay unused supplier relationships. */
export function resolveDeliveries(s: GameState): string[] {
  const notes: string[] = [];
  const arrived = s.pending.filter((o) => o.arrivesOnTurn <= s.turn);
  s.pending = s.pending.filter((o) => o.arrivesOnTurn > s.turn);

  for (const o of arrived) {
    const item = itemById(o.itemId);
    if (!item) continue;
    // A delivery lands as the type it actually is, not as a generic pool.
    addUnits(s.israel.stockpile.equipment, item.id, o.quantity);
    notes.push(`Delivered: ${o.quantity} x ${item.name}.`);
  }

  // Loyalty decays where we could have bought and did not. A supplier who is
  // refusing to sell is not being neglected by us, and bleeding that
  // relationship dry would punish the same offence twice.
  for (const id of SUPPLIER_IDS) {
    const st = s.israel.suppliers[id];
    if (st.embargoed) continue;

    // Commercial goodwill follows the political relationship, slowly. A sales
    // department does not stay warm toward a government its own capital has
    // fallen out with — these two used to be entirely independent, so an
    // ambassador could be recalled while the arms fair carried on regardless.
    const political = POWER_IDS.includes(id as PowerId) ? relationsWith(s, id as PowerId) : null;
    const pull = political === null ? 0 : (political - st.loyalty) * 0.05;

    st.loyalty = clamp(st.loyalty + pull - 1, 0, 100);
  }

  return notes;
}

/**
 * How fast equipment goes unserviceable without spares, and how fast it comes
 * back once the parts flow again. The floor matters as much as the rate: an
 * embargo should hurt for years without ever being simply fatal, because a
 * grounded air force that can never be recovered is not a game, it is an
 * ending.
 */
const WEAR_RATE = 0.015;
const REPAIR_RATE = 0.04;
const READINESS_FLOOR = 0.55;

/** Which supplier's goodwill keeps each origin's equipment in the air. */
const ORIGIN_SUPPLIER: Partial<Record<Origin, SupplierId>> = {
  usa: 'usa',
  britain: 'britain',
  france: 'france',
};

/**
 * Spares. An embargo does not take the F-16s away; it stops the parts, and
 * the squadrons go unserviceable a few airframes at a time. Equipment we
 * build ourselves, and Soviet kit nobody in Washington has a say over, is
 * unaffected — which is the whole argument for a domestic industry.
 */
export function resolveReadiness(s: GameState): string[] {
  const notes: string[] = [];
  const isr = s.israel;

  for (const [origin, supplier] of Object.entries(ORIGIN_SUPPLIER) as [Origin, SupplierId][]) {
    const cut = isr.suppliers[supplier].embargoed;
    const before = isr.readiness[origin] ?? 1;
    const after = cut
      ? Math.max(READINESS_FLOOR, before - WEAR_RATE)
      : Math.min(1, before + REPAIR_RATE);
    isr.readiness[origin] = after;

    // Report the crossings, not the drift, or the log is nothing else.
    if (before > 0.9 && after <= 0.9) {
      notes.push(`Spares shortages are beginning to tell on our ${origin.toUpperCase()} equipment.`);
    } else if (before > 0.7 && after <= 0.7) {
      notes.push(`A third of our ${origin.toUpperCase()}-supplied equipment is now unserviceable.`);
    } else if (before < 1 && after >= 1) {
      notes.push(`Spares are flowing again; our ${origin.toUpperCase()} equipment is fully serviceable.`);
    }
  }

  return notes;
}

/**
 * Would this capital refuse to sell to us today? Each decides for itself, on
 * its own relationship and its own appetite for the argument. They used to
 * move as one bloc: Washington embargoed and Paris and London were simply
 * assigned the same boolean.
 */
function wouldEmbargo(s: GameState, id: PowerId): boolean {
  const rel = relationsWith(s, id);
  const readiness = EMBARGO_READINESS[id];

  // Using a weapon nobody admits to having does not itself declare the
  // embargo — the forty-five points it costs the relationship do that. What
  // it does is raise the bar for ever afterwards, so the road back is steep
  // rather than closed. Ordinarily thirty; after a strike, seventy.
  const floor = s.stats.nukesUsed > 0 ? 70 : 30;

  if (rel < floor * readiness) return true;
  if (s.stats.strikesOrdered > 2 && rel < 45 * readiness) return true;
  return false;
}

/**
 * Embargo check, taken one capital at a time. The private dealer never joins
 * in, because the private dealer does not read the newspapers.
 */
export function updateEmbargoes(s: GameState): string[] {
  const notes: string[] = [];

  for (const id of POWER_IDS) {
    const supplier = s.israel.suppliers[id];
    const wants = wouldEmbargo(s, id);

    if (wants && !supplier.embargoed) {
      supplier.embargoed = true;
      notes.push(`${POWER_NAMES[id]} declares an arms embargo on Israel`);
    } else if (!wants && supplier.embargoed && relationsWith(s, id) > 48 * EMBARGO_READINESS[id]) {
      supplier.embargoed = false;
      notes.push(`${POWER_NAMES[id]} lifts its arms embargo on Israel`);
    }
  }

  return notes;
}

/** The procurement office's unsolicited advice, as in the original. */
export function procurementAdvice(s: GameState): string {
  const st = s.israel.stockpile.equipment;
  const atWar = Object.values(s.fronts).some((f) => f.atWar);

  const prefix = atWar
    ? 'Due to our conflict situation,'
    : s.tension > 60
      ? 'Due to the possibility of conflict in the near future,'
      : 'For a more balanced attack force,';

  if (countOf(st, 'aircraft') < 200) return `${prefix} we may require some Strike Aircraft.`;
  if (countOf(st, 'sam') < 60)
    return `${prefix} the purchase of more SAM systems may be prudent.`;
  if (countOf(st, 'tank') < 2000)
    return `${prefix} we should obtain more Battlefield Systems.`;
  if (countOf(st, 'helicopter') < 60)
    return `${prefix} the ground forces want more attack helicopters over them.`;
  if (countOf(st, 'surveillance') < 3)
    return 'We advise you to purchase an early warning surveillance craft.';
  return 'The order of battle is balanced. We have nothing pressing to ask for.';
}

/** Everything currently in transit, for the Review screen. */
export function inTransit(s: GameState): { name: string; quantity: number; cost: number; eta: number }[] {
  return s.pending.map((o) => {
    const item = CATALOGUE.find((i) => i.id === o.itemId);
    return {
      name: item ? item.name : o.itemId,
      quantity: o.quantity,
      cost: o.unitCost * o.quantity,
      eta: o.arrivesOnTurn - s.turn,
    };
  });
}
