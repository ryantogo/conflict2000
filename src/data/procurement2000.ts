/**
 * What the neighbours can get, and how fast.
 *
 * Until now `Nation.forces` only ever went down — attrition, strikes, nukes,
 * inter-Arab wars — and nothing anywhere put a unit back. A patient premier
 * could win by outlasting everybody, which is precisely the failure the design
 * defines itself against: the safest play must not be the winning play.
 *
 * These armies rebuild. How fast is a political question rather than an
 * economic one, so `rate` folds together patronage, oil, and whether anybody
 * is currently willing to sell to them at all:
 *
 *   Egypt    — Camp David money and an American production line.
 *   Iran     — oil, and a decade of buying quietly from Moscow and Beijing.
 *   Syria    — lost its patron with the USSR and has never replaced it.
 *   Jordan   — small, Western-equipped, and not spending.
 *   Libya    — under sanctions until 2003, and in no hurry.
 *   Lebanon  — no money, and no sovereignty over the question.
 *   Iraq     — ten years into sanctions, cannibalising airframes for spares.
 */

import type { NationId } from '../engine/types';

export interface Rearmament {
  /** Units delivered per month at full stability, across all arms. */
  rate: number;
  /**
   * What this state can actually obtain, best first. Replacements are drawn
   * from the best accessible type of whichever arm is short.
   */
  access: string[];
}

export const REARMAMENT: Record<NationId, Rearmament> = {
  egypt: { rate: 3.2, access: ['m1a1', 'f16_export', 'hawk_export', 'm60a3', 'sa6'] },
  iran: { rate: 1.8, access: ['t72', 'mig29', 'hawk_export', 'su24', 'sa6'] },
  syria: { rate: 1.1, access: ['t72', 'mig29', 'sa6', 't62', 'sa3'] },
  jordan: { rate: 0.7, access: ['m60a3', 'f5e', 'hawk_export'] },
  libya: { rate: 0.6, access: ['t72', 'mig23', 'sa6'] },
  lebanon: { rate: 0.25, access: ['t55', 'sa2'] },
  iraq: { rate: 0.3, access: ['t62', 'mig21', 'sa3'] },
};

/**
 * How far past its 2000 establishment a state will build before it stops.
 * Nobody in this region triples their army inside a decade, and a runaway
 * arms race would be a worse simulation than no arms race at all.
 */
export const ESTABLISHMENT_CEILING = 1.25;
