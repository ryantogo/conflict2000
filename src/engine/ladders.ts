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
/**
 * Which rung of the stability ladder a figure sits on, 0 (solid) to 6.
 *
 * The map needs the rung, not the word. It used to get there by matching
 * `stabilityLabel`'s output against its own hard-coded copy of the `STABILITY`
 * array, so renaming a single rung silently coloured every country as
 * "Very weak".
 */
export function stabilityRung(stability: number): number {
  if (stability >= 80) return 0;
  if (stability >= 62) return 1;
  if (stability >= 40) return 2;
  if (stability >= 28) return 3;
  if (stability >= 18) return 4;
  if (stability >= 8) return 5;
  return 6;
}

export function stabilityLabel(stability: number): string {
  return STABILITY[stabilityRung(stability)];
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

/** How well placed we are inside a country, as a word. */
export function networkLabel(v: number): string {
  if (v >= 78) return 'Deeply placed';
  if (v >= 58) return 'Well placed';
  if (v >= 38) return 'Some sources';
  if (v >= 18) return 'Thin';
  return 'Blown';
}

/**
 * Ladders that grew up in the UI.
 *
 * These five were written where they were first needed — inside
 * `ForeignOffice`, `Domestic` and `Militias` — and two more were inlined
 * directly into JSX. A word ladder is engine vocabulary, not screen furniture:
 * it is the game's way of refusing to show a number, which makes this file the
 * only place any of them should live.
 */

/** How hard a foreign security service is currently looking for us. */
export function alertLabel(v: number): string {
  if (v < 12) return 'No sign of counter-surveillance';
  if (v < 30) return 'Routine security interest';
  if (v < 50) return 'Our people are being watched';
  if (v < 70) return 'Networks under active investigation';
  return 'Hostile service is hunting us';
}

/** Where a coalition partner stands with the premier. */
export function standingLabel(v: number): string {
  if (v >= 70) return 'Solid';
  if (v >= 50) return 'Content';
  if (v >= 38) return 'Restless';
  if (v >= 25) return 'On the brink';
  return 'Gone in all but name';
}

/** How dangerous an armed group currently is. */
export function militiaLabel(v: number): string {
  if (v >= 75) return 'A standing army in all but name';
  if (v >= 55) return 'Formidable';
  if (v >= 35) return 'Capable';
  if (v >= 18) return 'Harassing';
  if (v >= 8) return 'Weakened';
  return 'Spent';
}

/** How much of the street a group speaks for. */
export function supportLabel(v: number): string {
  if (v >= 70) return 'They are the street';
  if (v >= 50) return 'Widely backed';
  if (v >= 30) return 'A real constituency';
  if (v >= 15) return 'A minority';
  return 'Isolated';
}

/** How a successor faction regards Israel. −1..1. */
export function dispositionLabel(v: number): string {
  if (v >= 0.6) return 'Would work with us openly';
  if (v >= 0.25) return 'Would deal quietly';
  if (v >= -0.25) return 'Indifferent to us';
  if (v >= -0.6) return 'Hostile';
  return 'Would fight us on day one';
}

/** Whether a capital is still willing to hear the argument. */
export function patienceLabel(v: number): string {
  if (v >= 70) return 'Willing to listen';
  if (v >= 35) return 'Tiring of us';
  return 'Has heard enough';
}

/** The American relationship, for the top bar. */
export function usRelationsLabel(v: number): string {
  if (v >= 70) return 'Excellent';
  if (v >= 50) return 'Good';
  if (v >= 30) return 'Poor';
  return 'Sour';
}

/** A supplier's commercial goodwill. The one bare 0..100 the UI used to print. */
export function loyaltyLabel(v: number): string {
  if (v >= 70) return 'Preferred customer';
  if (v >= 40) return 'Valued';
  if (v >= 20) return 'Tolerated';
  return 'Barely worth the paperwork';
}

/** How much an armed group expects to pay for its next attack. */
export function deterrenceLabel(v: number): string {
  if (v >= 70) return 'They think twice';
  if (v >= 45) return 'Wary of us';
  if (v >= 25) return 'Testing us';
  return 'Undeterred';
}

/**
 * How hard a patron is pushing its proxy, as Northern Command reads it. One
 * is Tehran as it stood in June 2000; it only goes past that after we have
 * given it a reason.
 */
export function patronPressureLabel(p: number): string {
  if (p >= 1.4) return 'Tehran wants blood';
  if (p >= 0.85) return 'Tehran is pushing them hard';
  if (p >= 0.45) return 'Tehran keeps them busy';
  return 'Tehran is holding them back';
}

/** How much of a country an army holds, as a newspaper would put it. */
export function occupationLabel(share: number): string {
  if (share < 0.06) return 'a foothold';
  if (share < 0.18) return 'about a tenth';
  if (share < 0.35) return 'about a quarter';
  if (share < 0.6) return 'about half';
  if (share < 0.85) return 'most';
  return 'nearly all';
}

export function pointsToRelations(points: number): number {
  return clamp(Math.floor((points + 100) / 20.1), 0, 9);
}

export function dateLine(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}
