/**
 * Headline templates.
 *
 * The 1990 original stored headlines with single-character substitution
 * tokens, partly to fill in nation names and partly to abbreviate common
 * words so a headline fit the column: "Invas^ !! * } storm into _" expands to
 * "Invasion !! Syrian troops storm into Israel". Both kinds of token are
 * reproduced here, because the clipped house style is half the flavour.
 *
 *   *  subject adjective     "Syrian"
 *   #  subject name          "Syria"
 *   &  subject capital       "Damascus"
 *   @  object adjective      "Israeli"
 *   _  object name           "Israel"
 *   +  object capital        "Jerusalem"
 *   ^  -> "ion"        }  -> "troops"      {  -> "between"
 *   ~  -> "and"        %  -> "losses"
 */

export interface HeadlineContext {
  subjAdj?: string;
  subjName?: string;
  subjCapital?: string;
  objAdj?: string;
  objName?: string;
  objCapital?: string;
}

export function expand(template: string, ctx: HeadlineContext = {}): string {
  let s = template;
  // Word abbreviations first — they never contain nation tokens.
  s = s.split('^').join('ion');
  s = s.split('{').join('between');
  s = s.split('~').join('and');
  s = s.split('}').join('troops');
  s = s.split('%').join('losses');
  // Then the substitutions.
  s = s.split('*').join(ctx.subjAdj ?? '');
  s = s.split('#').join(ctx.subjName ?? '');
  s = s.split('&').join(ctx.subjCapital ?? '');
  s = s.split('@').join(ctx.objAdj ?? '');
  s = s.split('_').join(ctx.objName ?? '');
  s = s.split('+').join(ctx.objCapital ?? '');
  return s.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Template banks
// ---------------------------------------------------------------------------

export const RELATIONS_WORSEN = [
  '* leader denounces _ in maiden speech',
  'New leader impairs *-@ relat^s',
  '* leader publicly denounces @ regime',
  'Hostility towards _ ups Middle East tens^',
  '# inspires Arab disapproval of @ regime',
  'Middle East tens^ mounts as harmony undermined',
  '* ~ @ youths clash causing outcry',
  '* border towns fear @ army presence',
  '* sources say @ leader is <totally mad>',
  '*-@ relat^s sour as } gather',
  'Rapport { # ~ _ wanes',
  'U.N. try to patch up *-@ relat^s',
  'Relat^s { # ~ _ worsen',
  'Negotiat^s fail as # prepares for war',
  '@ embassy stormed by protest in +',
  '*-@ relat^s deteriorate rapidly',
];

export const RELATIONS_IMPROVE = [
  '* diplomats are engaged in talks in &.',
  'Trade talks have started { # ~ _.',
  '* ministers have met the @ president in view of improving relat^s.',
  'A *-@ joint arms agreement has been signed in &.',
  'A military pact has been signed { # ~ _.',
  '# ~ _ declare military pact',
  '* leader claims <New era of peace> with _',
  'Trade barriers { # ~ _ removed',
  '# ~ _ sign non-aggress^ pact',
];

export const WAR_DECLARED = [
  'Invas^ !! * } storm into _',
  'War imminent as 100 die in * border clash',
  'Trigger happy } start war',
  '<We have no choice> as # declare war on _',
  'Shells aimed at @ villages causes mass panic',
  'Mass mobilisat^ ordered for * forces.',
  '<Elements in _ must be destroyed> say #',
  'Raving * leader screams for war against _',
  '# joins in attack against _',
];

export const WAR_LOSSES = [
  'Heavy troop % cause panic in * lines',
  'Bad troop loss under fire batters * morale',
  '* morale collapses under @ attack',
  'Serious troop % start panic in * army',
  'Big troop % for *s in @ war',
  'Heavy front line % for *s in @ war',
  '* human waves mean serious front line %',
  'Severe front line % hit # in @ war',
  'Large % for *s in war against _',
];

export const WAR_GAINS = [
  '_ gains territory under * retreat',
  '* posit^s driven back by @ tanks',
  '@ tanks find no opposit^',
  '* } lose ground to @ advances',
  '@ forces move deeper into #',
];

export const STRIKE_MILITARY = [
  '@ military claim air space violat^ by #',
  'Selective @ targets destroyed by #',
  'Light military damage by *s on _',
  '@ government castigates * strike attack.',
];

export const STRIKE_INDUSTRIAL = [
  'Industrial targets damaged by * bombers',
  '* bombing takes out small @ factory',
  'Light industrial targets hit by * bombers',
  '@ industrial targets bombed by #',
  '* bombers hit @ oil refineries',
  '@ oil fields targeted by * bombers',
];

export const STRIKE_CIVILIAN = [
  'Outraged & citizens denounce city bombing',
  'The U.S. rebuke * bombing of &',
  'BOOM! Airstrike on & shocks _',
  'Bombing of & condemned by the Soviets',
  'Heavy bombing of & by * jets: many dead',
  '& bombing outrage condemned by world',
  '& left in rubble after * bombing raid',
  '# condemned for vicious attack on &.',
];

export const STRIKE_FAILED = [
  '_ claims destruct^ of 3 * bombers',
  'Bungled air raid leaves # fewer pilots',
  'Bombers heading for & were intercepted',
  'Failed air attack by # leaves _ fuming',
  'Jubilant & gunners hit * bombers!',
  'Aborted air attack ends in disaster',
  'Attempted strike on _ <Did not find target>',
  '_ complains to U.N. of unprovoked attacks',
];

export const COUP_SUCCESS = [
  'Rebel leaders claim control in #',
  'A successful coup has brought down * government.',
  'Puppet government has been installed.',
];

export const COUP_FAIL = [
  'Failed coup leaders arrested in +',
  'Attempted coup failed to change * government.',
  'Half baked coup attempt in # fails.',
  'Rebel forces destroyed in * crackdown',
];

export const ASSASSINATION_SUCCESS = [
  '* leader assassinated ! Government falls',
  'Government collapses after * leader shot dead.',
  '* premier assassinated',
  '* premier dies in bomb blast',
];

export const ASSASSINATION_FAIL = [
  'Attempted assasinat^ of * leader fails',
  'The * leader is recovering in hospital after assassinat^ attempt.',
  '@ hit squad arrested in +.',
  'Israel condemned for planning terrorist act^ in #.',
];

export const INSURGENCY = [
  '* Islamic fundamentalists spread violence',
  'Islamic dissent is voiced all over #',
  'Mass demonstrat^s in + show Islamic power',
  '* government rocked by extremist protest',
  '@ terrorists arrested in +',
];

export const PALESTINE = [
  'Palestinian protest gets itself heard',
  'Unrest in West Bank ends in peaceful protest',
  'PLO representatives approach U.S. senate',
  '* government fails to quell Palestinian voices',
  'Palestinians stage one day strike in Gaza Strip',
  'Stone throwing Arabs arrested in +',
  'PLO demonstrat^ in the West Bank turns violent',
  'PLO protest mounts as two soldiers die on TV',
  'Knesset arguments mount over Palestinian problem',
  'PLO claim responsibility for car bombing',
  'PLO involved in recent terrorist act^s',
  'Panic in Tel Aviv as PLO hijacks a bus',
  'More PLO outrages provoke Jewish react^',
  'Public pressure on * government intolerable',
];

export const DOMESTIC = [
  'Present war reducing confidence of *s',
  'Public quest^ * leadership',
  '*s do not feel secure',
  '* demonstrat^s on & streets',
  'Knesset doubts wisdom of * premier',
  '* internal frustrat^ reaches new heights',
  'Popularity of * premier declines',
  'Knesset split by leadership troubles',
  'Mass rallies call for premiers resignat^',
  '# no longer unified say critics',
  '# on the verge of removing premier',
];

export const NUCLEAR = [
  'Recent tremor evidence of atomic testing',
  'West concerned by Middle East nuclear situat^',
  'Western leaders admit that Arab states have bomb',
  'Earth tremor attributed to atomic testing',
  '<We now have the Sword of Islam> claim Libya',
];

export const NUCLEAR_STRIKE = [
  'World is shaken as # nukes _',
  'Atomic bomb stops _ and horrifies world',
  '*s dare to use nuclear bomb',
  'At last it happens: *s use nuke',
  '& dissolves in nuclear fireball',
  '# universally condemned for nuking',
  '# destroys & with nuclear devastat^',
];

export const VICTORY = [
  '# and allies celebrate victory over _!',
  '# celebrate victory as _ is defeated!!',
  '@ army has been defeated.',
  '* army celebrates victory against _.',
  '@ uncondit^al surrender declared',
  '* army claim control of _!',
  '# rejoice at @ defeat.',
];

export const COLLAPSE = [
  'General anarchy as * government collapses',
  '_ is in an anarchic state.',
  'New government in format^.',
  'New * premier takes over',
];

/** Weightless colour, printed at the foot of the page. Period-appropriate. */
export const FILLER = [
  'Inflation is rising',
  'OPEC to lower crude',
  'Oil tanker explodes',
  'Saudis revenue up',
  'Bad weather today',
  'Oil prices collapse',
  'Oil prices sustained',
  'Kuwait discovers more oil',
  'Very bad weather tomorrow',
  'Dot-com shares slide on Nasdaq',
  'Concorde grounded for checks',
  'Sydney readies for the Olympics',
  'Millennium Bridge sways, closes',
  'Putin consolidates in Moscow',
  'Neasden F.C. lose 1-0 at home',
  'U.S. election too close to call',
  'Mobile phone sales double',
  'Euro slides against the dollar',
];
