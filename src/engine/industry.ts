/**
 * Our own factories.
 *
 * A production line is the only source of equipment in the game that nobody
 * else can switch off. Suppliers embargo, Washington sulks, and the private
 * dealer is always late — but a line at Tel HaShomer delivers as long as the
 * Treasury keeps paying, which is exactly why it is worse value per shekel
 * than importing the same tonnage.
 *
 * Unlike a purchase, a line is a standing commitment. It bills every month
 * until it is closed, and a development programme bills for years before it
 * delivers anything at all.
 */

import type { GameState } from './types';
import { addUnits } from './fleet';
import { equipmentById } from '../data/equipment';
import { PRODUCTION_LINES, lineById } from '../data/domestic2000';

export interface IndustryEvent {
  text: string;
  category: 'economy';
  weight: number;
}

export interface LineStatus {
  id: string;
  name: string;
  description: string;
  running: boolean;
  /** Months of development left; 0 once the line can deliver. */
  development: number;
  /** What it costs this month, given where it is in its life. */
  cost: number;
  /** Units per month once open. */
  rate: number;
  delivered: number;
  /** Plain-language state for the procurement screen. */
  status: string;
}

/** Everything the defence industry could be doing, and what it is doing. */
export function industryReport(s: GameState): LineStatus[] {
  return PRODUCTION_LINES.map((line) => {
    const st = s.israel.production[line.id];
    const developing = st.development > 0;
    const cost = developing ? line.developmentCost : line.cost;

    const months = `${st.development} month${st.development === 1 ? '' : 's'}`;

    let status: string;
    if (developing && st.running) {
      status = `In development — ${months} remaining`;
    } else if (developing && st.development === line.development) {
      // Never started, as opposed to started and halted. The distinction
      // matters: one of them has already cost the Treasury something.
      status = `Not begun — ${months} of development required`;
    } else if (developing) {
      status = `Development suspended — ${months} of work remaining`;
    } else if (st.running) {
      status = `In production — ${line.rate} per month`;
    } else {
      status = 'Line idle';
    }

    return {
      id: line.id,
      name: line.name,
      description: line.description,
      running: st.running,
      development: st.development,
      cost,
      rate: line.rate,
      delivered: st.delivered,
      status,
    };
  });
}

/** Open or close a line. Standing policy, not a monthly directive. */
export function setProduction(s: GameState, lineId: string, running: boolean): void {
  const st = s.israel.production[lineId];
  if (st) st.running = running;
}

/** What every running line is costing us this month. */
export function industrySpend(s: GameState): number {
  let total = 0;
  for (const line of PRODUCTION_LINES) {
    const st = s.israel.production[line.id];
    if (!st?.running) continue;
    total += st.development > 0 ? line.developmentCost : line.cost;
  }
  return total;
}

/**
 * Run the factories for a month. A line that cannot be paid for stops — the
 * Treasury does not extend credit, and a stalled programme keeps whatever
 * development it has already banked.
 */
export function resolveProduction(s: GameState): IndustryEvent[] {
  const events: IndustryEvent[] = [];
  const isr = s.israel;

  for (const lineId of Object.keys(isr.production)) {
    const st = isr.production[lineId];
    const line = lineById(lineId);
    if (!line || !st.running) continue;

    const due = st.development > 0 ? line.developmentCost : line.cost;
    if (isr.funds < due) {
      st.running = false;
      events.push({
        text: `${line.name} suspended — the Treasury cannot fund it this month.`,
        category: 'economy',
        weight: 1,
      });
      continue;
    }
    isr.funds -= due;

    if (st.development > 0) {
      st.development--;
      if (st.development === 0) {
        events.push({
          text: `${line.name} completes development and opens for production`,
          category: 'economy',
          weight: 2,
        });
      }
      continue;
    }

    addUnits(isr.stockpile.equipment, line.builds, line.rate);
    st.delivered += line.rate;
    events.push({
      text: `Delivered from our own industry: ${line.rate} x ${
        equipmentById(line.builds)?.name ?? line.builds
      }.`,
      category: 'economy',
      weight: 0,
    });
  }

  return events;
}
