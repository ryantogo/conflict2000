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
import { CATALOGUE, catalogueFor, itemById, poolFor } from '../data/arms2000';
import type { ArmsItem } from '../data/arms2000';

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
    s.israel.usRelations = clamp(s.israel.usRelations - 2, 0, 100);
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
    const pool = poolFor(item.category);
    if (pool === 'tanks') s.israel.stockpile.tanks += o.quantity;
    else if (pool === 'sam') s.israel.stockpile.sam += o.quantity;
    else s.israel.stockpile.aircraft += o.quantity;
    notes.push(`Delivered: ${o.quantity} x ${item.name}.`);
  }

  for (const id of SUPPLIER_IDS) {
    const st = s.israel.suppliers[id];
    st.loyalty = clamp(st.loyalty - 1, 0, 100);
  }

  return notes;
}

/**
 * Embargo check. The Senate moves against aggression, and Paris and London
 * follow Washington's lead. The private dealer never joins in.
 */
export function updateEmbargoes(s: GameState): string[] {
  const notes: string[] = [];
  const aggressive =
    s.stats.nukesUsed > 0 ||
    s.israel.usRelations < 30 ||
    (s.stats.strikesOrdered > 2 && s.israel.usRelations < 45);

  const usa = s.israel.suppliers.usa;
  if (aggressive && !usa.embargoed) {
    usa.embargoed = true;
    s.israel.suppliers.france.embargoed = true;
    s.israel.suppliers.britain.embargoed = true;
    notes.push('U.S. declares arms embargo on Israel');
  } else if (!aggressive && usa.embargoed && s.israel.usRelations > 48) {
    usa.embargoed = false;
    s.israel.suppliers.france.embargoed = false;
    s.israel.suppliers.britain.embargoed = false;
    notes.push('U.S. lift Israeli arms embargo');
  }
  return notes;
}

/** The procurement office's unsolicited advice, as in the original. */
export function procurementAdvice(s: GameState): string {
  const st = s.israel.stockpile;
  const atWar = Object.values(s.fronts).some((f) => f.atWar);

  const prefix = atWar
    ? 'Due to our conflict situation,'
    : s.tension > 60
      ? 'Due to the possibility of conflict in the near future,'
      : 'For a more balanced attack force,';

  if (st.aircraft < 250) return `${prefix} we may require some Strike Aircraft.`;
  if (st.sam < 60) return `${prefix} the purchase of more SAM systems may be prudent.`;
  if (st.tanks < 2000) return `${prefix} we should obtain more Battlefield Systems.`;
  return 'We advise you to purchase an early warning surveillance craft.';
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
