/**
 * What the readouts actually mean.
 *
 * Five phases of mechanism went in and almost none of it announces itself. A
 * player can see that Shas is "Restless" and that an option is available, but
 * not that the framework in front of them is what turns Restless into a
 * walkout, nor that the walkout is what ends the government.
 *
 * These explain **the rule**, never the number behind it. DESIGN.md's first
 * principle is that the player never sees a quantity, and a tooltip that reads
 * "satisfaction 34/100" would be a way of breaking that rule quietly. Say what
 * moves a thing and what happens at the end of it; say it in words.
 *
 * Kept here rather than at forty call sites so the writing can be read as
 * writing.
 */

export const HINTS = {
  // --- the home front ------------------------------------------------------
  coalition:
    'A government needs 61 of the 120 seats. Partners are not scored on your ' +
    'popularity — they each care about the map, the use of force, and the ' +
    'welfare budget, and the same act moves different ones opposite ways.',
  partnerStanding:
    'Push a partner far enough and it walks out. Partners cool back toward ' +
    'indifference faster than they leave, because Israeli coalitions get ' +
    'renegotiated rather than dissolved.',
  popularity:
    'What the country thinks of you. Reaching nothing at all ends your ' +
    'premiership — but losing the House will usually get there first.',
  reserves:
    'Trained manpower, in thousands. Spent raising brigades, spent again by ' +
    'casualties, and refilled only in peacetime. A decade of war is a decade ' +
    'of getting smaller.',
  freeBrigades:
    'Brigades committed to neither a border nor to policing. Emergency ' +
    'mobilisation draws on these, so an army with none has no reserve to call.',
  gnp:
    'Defence as a share of national product. Past about a tenth of it, the ' +
    'parties that are in government for the welfare budget start counting.',

  // --- the borders ---------------------------------------------------------
  combatWeight:
    'Everything standing here, weighted by what it actually is. Better ' +
    'equipment is worth more per unit, and equipment nobody can get spares ' +
    'for is worth less.',
  assessedWeight:
    'What we believe they have, not what they have. The band narrows as our ' +
    'coverage of that country improves, and with no sources at all it is wide ' +
    'enough to walk into a war believing the wrong thing.',
  armourCondition:
    'Measured against a typical regional unit, not against ourselves. Most ' +
    'armour on these borders was built in the 1960s.',
  warProgress:
    'The front-line commander’s read. Far enough right and the government ' +
    'opposite falls; three months hard against the left and the war is lost.',

  // --- intelligence --------------------------------------------------------
  network:
    'People on the ground: agents run, officials turned, telephones listened ' +
    'to. Built slowly, lost quickly, and what every operation is carried by. ' +
    'A failed coup burns it for years.',
  counterIntel:
    'How hard their security service is looking for us. It rises every month ' +
    'we work there, and a stable, competent regime keeps its files open long ' +
    'after a disintegrating one has forgotten us.',
  coverage:
    'How much of the picture we have. Agents give depth in one country; ' +
    'satellites and reconnaissance aircraft give a floor in all of them at ' +
    'once, and cannot be arrested.',
  mossadCapacity:
    'Four operations a month is what the service can run properly. Past that ' +
    'every one of them is weaker and likelier to be exposed — nothing stops ' +
    'you ordering them anyway.',
  opposition:
    'The internal political opposition, which is not the same thing as an ' +
    'armed group. Assassination and coups need one strong enough to act ' +
    'through.',

  // --- the powers ----------------------------------------------------------
  powerStanding:
    'Each capital decides its own arms embargo on its own relationship. Paris ' +
    'is reliably the first to stop selling and does not need anybody’s ' +
    'permission.',
  patience:
    'Quiet diplomacy works, and works less well each time it is tried. A ' +
    'capital that has heard the argument four times running is not hearing it ' +
    'a fifth.',
  restraint:
    'Formal undertakings bind us in public. While they run, the airstrikes ' +
    'and the invasion are off the menu — a promise you can quietly break is ' +
    'not a promise.',
  serviceability:
    'An embargo does not take the aircraft away. It stops the spares, and ' +
    'they go unserviceable a few at a time. What we build ourselves is ' +
    'unaffected.',
  loyalty:
    'A supplier’s commercial goodwill, which follows the political ' +
    'relationship and rises when we buy. It decides how much of the catalogue ' +
    'we are shown.',

  // --- armed groups --------------------------------------------------------
  militiaStrength:
    'An armed group is not a government and not a border. Hitting them works ' +
    'and recruits for them, and their strength settles at whatever their ' +
    'patron, their constituency and their host can sustain.',
  succession:
    'A fallen state comes apart into the people who were holding it together. ' +
    'Arm one of them far enough and they form a government — and the ' +
    'government you get is the one you armed.',
  disposition:
    'How this faction would treat us in power. Backing the ones who despise ' +
    'us is a way of arming our enemies at our own expense.',

  // --- the territories -----------------------------------------------------
  unrest:
    'Occupation generates it and brigades suppress it. A hard hand suppresses ' +
    'more and radicalises as it goes. Conceding a homeland removes the ' +
    'question from the game entirely.',
  nuclearPosture:
    'Ambiguity, signalled, declared, tested. Each rung buys deterrence and ' +
    'costs Washington, and there is no way back down the ladder.',
} as const;
