/**
 * Descriptive scales.
 *
 * Every string here is lifted verbatim from the 1990 executable's data
 * segment, including its British spellings. The original never showed the
 * player a number — only a word off one of these ladders — and keeping that
 * habit is most of what makes the game feel like itself.
 */

/** Relations ladder, 0..9. Original also carried an "illegal" guard entry. */
export const RELATIONS = [
  'Non-Existent',
  'Deplorable',
  'Lamentable',
  'Indifferent',
  'Satisfactory',
  'Workable',
  'Favourable',
  'Beneficial',
  'Profitable',
  'Excellent',
] as const;

/** Internal stability ladder, index 0 = strongest. */
export const STABILITY = [
  'Very solid',
  'Moderately solid',
  'Fragile',
  'Very weak',
  'Dangerously weak',
  'Close to revolution',
  'State in turmoil',
] as const;

/** Strength of an insurgent group Israel is funding. */
export const OPPOSITION = [
  'Feeble',
  'Disorganised rabble',
  'Ineffective',
  'Strengthening',
  'Guerilla Force',
  'Ready for action!',
] as const;

/** Regional tension, ascending. */
export const TENSION = [
  'very low',
  'steady',
  'turbulent',
  'dangerously high',
  'explosive',
  'very dire',
  'very very dire',
] as const;

/** Israeli international prestige, ascending. */
export const PRESTIGE = [
  'MODERATE',
  'RISING',
  'VERY HIGH',
  'DYNAMIC',
  'DOMINANT',
  'UNRIVALLED',
] as const;

/** Unrest in the West Bank and Gaza, ascending. */
export const UNREST = [
  'Completely under control',
  'Under control',
  'Minor incidents',
  'Confined to stone throwing youths',
  'Unruly demonstrations',
  'Small scale public disruption',
  'Major incidents',
  'Serious incidents',
  'Uncontrollable chaos',
  'Terrorist actions',
  'State of emergency',
] as const;

/** How busy a border looks from the Israeli side. */
export const FRONT_ACTIVITY = [
  'is peaceful.',
  'has some troop activity.',
  'has large scale enemy activity.',
  'has full scale deployment.',
] as const;

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

function pick<T extends readonly string[]>(scale: T, ratio: number): T[number] {
  const i = Math.round(clamp01(ratio) * (scale.length - 1));
  return scale[i];
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function relationsLabel(level: number): string {
  return RELATIONS[clamp(Math.round(level), 0, RELATIONS.length - 1)];
}

/**
 * Stability is stored 0..100 with 100 = rock solid. Like prestige, the rungs
 * are spaced by hand: a state at the halfway mark is Fragile, not Very weak.
 */
export function stabilityLabel(stability: number): string {
  if (stability >= 80) return STABILITY[0]; // Very solid
  if (stability >= 62) return STABILITY[1]; // Moderately solid
  if (stability >= 40) return STABILITY[2]; // Fragile
  if (stability >= 28) return STABILITY[3]; // Very weak
  if (stability >= 18) return STABILITY[4]; // Dangerously weak
  if (stability >= 8) return STABILITY[5]; // Close to revolution
  return STABILITY[6]; // State in turmoil
}

export function oppositionLabel(strength: number): string {
  return pick(OPPOSITION, strength / 100);
}

export function tensionLabel(tension: number): string {
  return pick(TENSION, tension / 100);
}

/**
 * Prestige rungs are deliberately not evenly spaced. Every word on this ladder
 * is flattering, so a linear mapping would have a middling Israel described as
 * DYNAMIC on day one. UNRIVALLED has to be earned.
 */
export function prestigeLabel(prestige: number): string {
  if (prestige < 36) return PRESTIGE[0]; // MODERATE
  if (prestige < 52) return PRESTIGE[1]; // RISING
  if (prestige < 66) return PRESTIGE[2]; // VERY HIGH
  if (prestige < 79) return PRESTIGE[3]; // DYNAMIC
  if (prestige < 91) return PRESTIGE[4]; // DOMINANT
  return PRESTIGE[5]; // UNRIVALLED
}

export function unrestLabel(unrest: number): string {
  return UNREST[clamp(Math.round(unrest), 0, UNREST.length - 1)];
}

export function frontActivityLabel(activity: number): string {
  return FRONT_ACTIVITY[clamp(Math.round(activity), 0, FRONT_ACTIVITY.length - 1)];
}

/** Relations 0..9 are stored as a -100..+100 point pool underneath. */
/**
 * How good a fleet is, as a word. Materiel may be shown as a number in this
 * game where politics may not, but "our armour is obsolescent" is worth more
 * to a defence minister than a mean power of 6.2.
 */
export function qualityLabel(mean: number, reference: number): string {
  const r = mean / reference;
  if (r >= 1.45) return 'Cutting edge';
  if (r >= 1.15) return 'Modern';
  if (r >= 0.95) return 'Adequate';
  if (r >= 0.78) return 'Ageing';
  if (r >= 0.6) return 'Obsolescent';
  return 'Obsolete';
}

/** How much of a force can actually be flown or driven today, as a word. */
export function serviceabilityLabel(ratio: number): string {
  if (ratio >= 0.98) return 'Fully serviceable';
  if (ratio >= 0.88) return 'Minor shortages';
  if (ratio >= 0.75) return 'Spares running short';
  if (ratio >= 0.62) return 'Squadrons grounded';
  return 'Crippled by shortages';
}

/** Standing with a capital outside the region, as a word. */
export function powerStandingLabel(v: number): string {
  if (v >= 82) return 'Warm';
  if (v >= 64) return 'Cordial';
  if (v >= 46) return 'Correct';
  if (v >= 30) return 'Cool';
  if (v >= 15) return 'Estranged';
  return 'Hostile';
}

export function pointsToRelations(points: number): number {
  return clamp(Math.floor((points + 100) / 20.1), 0, 9);
}

export function dateLine(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}
