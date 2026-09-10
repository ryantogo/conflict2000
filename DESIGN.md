# Design notes

What was taken from *Conflict: The Middle East Political Simulator* (Virgin
Mastertronic, 1990), what was changed for June 2000, and why.

---

## 1. What the original actually is

Sources: the manual, and the string table of `Conflict.exe` (a Zortech C 4.00
DOS binary whose data segment is entirely in the clear from `0x14700`).
Neither is checked in — both are verbatim Virgin Mastertronic text — but
`tools/` regenerates them from your own copy of the original.

The original is a monthly-turn political simulator. You are the Israeli Prime
Minister from January 1997, and you win by causing the collapse of the four
neighbouring states — by invasion or political destabilisation, and *not
necessarily by your own hand*, since the AI states invade each other too.

Its real structure, recovered from the menus:

```
News:  Egypt / Iran / Iraq / Jordan / Lebanon / Libya / Syria / Make Policy
Policy: Purchase arms / Strategic Action / Review Forces
        Nuclear Club / Palestinian Problem / Next Turn
```

Five things make it work, and all five are reproduced here:

**Everything is a word, never a number.** The player never sees a quantity.
Relations are one of ten words, stability one of seven, tension one of seven,
prestige one of six. Those exact strings are in `src/engine/ladders.ts`,
British spellings and all.

**Aggressive options are absent, not merely unwise.** You cannot invade a
friend — the option is greyed with a reason, because "your generals would
refuse to mobilise". Souring relations first is a deliberate, visible,
multi-month act that everyone can see you performing.

**Everything arrives late.** Arms are shipped "at the start of the following
turn", the private dealer takes two months. You buy before you know you need
it.

**The newspaper is the interface to consequence.** Each turn opens on a front
page. The manual is explicit that it lies: "Distortion, fabrication and
propaganda all creep into the columns."

**The ending judges you.** A six-line report card, a score, and a
`Leadership Style:` label derived from behaviour rather than intent.

### The headline compiler

Headlines are stored with single-character tokens, half substitution and half
*abbreviation* — the latter so a headline fits the column:

| token | expands to        | token | expands to |
| ----- | ----------------- | ----- | ---------- |
| `*`   | subject adjective | `^`   | `ion`      |
| `#`   | subject name      | `{`   | `between`  |
| `&`   | subject capital   | `~`   | `and`      |
| `@`   | object adjective  | `}`   | `troops`   |
| `_`   | object name       | `%`   | `losses`   |
| `+`   | object capital    |       |            |

So `Invas^ !! * } storm into _` becomes *"Invasion !! Syrian troops storm into
Israel"*. This clipped wire-service register is most of the game's voice, so
`src/data/headlines.ts` keeps both the tokens and the expander.

---

## 2. Moving it to June 2000

June 2000 is a better opening position than the original's invented 1997, for
three reasons that cost nothing to exploit:

**The original already has a July summit mechanic.** Camp David convened 11–25
July 2000. Starting in June puts it exactly one turn away, and the game's
existing summit machinery carries it.

**Turn one has a real shock in it.** Hafez al-Assad died on 10 June 2000 after
thirty years in power. Bashar inherits a security state that wobbles — a
free gift of instability on the most dangerous border, before the player has
done anything.

**The consequences are already written.** The IDF left the South Lebanon
security zone on 24 May, three weeks before the game opens. The Second
Intifada begins in September. The player gets to find out whether either was
inevitable.

### The opening position

| | Relations | Stability | Opposition |
| --- | --- | --- | --- |
| Egypt | Workable | Moderately solid | al-Gama'a al-Islamiyya |
| Jordan | Beneficial | Moderately solid | Islamic Action Front |
| Syria | Lamentable | Fragile → succession | Muslim Brotherhood |
| Lebanon | Deplorable | Fragile | Hezbollah |
| Iraq | Non-Existent | Moderately solid | Kurdish Democratic Party |
| Iran | Non-Existent | Fragile | Student Reform Movement |
| Libya | Deplorable | Fragile | Libyan Islamic Fighting Group |

Two peace treaties you can throw away, two borders with nothing on them.

### What changed mechanically

**The bomb.** The original started Israel with no nuclear capability and made
building one the long game. By 2000 that fiction has expired. The ladder is now
*posture*, not possession: `Deliberate ambiguity → Signalled → Declared →
Tested`. Each rung buys deterrence — visibly, in the AI's willingness to attack
— and costs standing with Washington.

**The Palestinian question.** In the original this was a pressure valve: post a
brigade, lose it from your borders. Here it carries the weight the date
demands. Refusing the Camp David framework very nearly always sets the
territories alight. Signing takes the question off the table — if Arafat signs
too, which at Camp David he does a little under half the time. See §13.

**Mossad has a budget and a capacity.** See below — this was the hardest thing
to get right.

**The arms catalogue.** The 1980s hardware became what an Israeli defence
minister could sign for in 2000: M1A2, F-16I, F-15I, Apache Longbow, Patriot,
Challenger 2, Mirage 2000-5. The private dealer moves ex-Soviet surplus —
period-perfect for 2000, and still never embargoed.

---

## 3. Balance: what the harness found

The engine is pure and seeded, so it can be played by bots. `src/engine/*.test.ts`
runs three reference players every build. Four faults surfaced this way, none
of which were visible by reading the code:

**A do-nothing premier was invaded 70% of the time.** An undefended border
collapsed in two months because nothing auto-mobilised. Fixed with an emergency
reserve commitment when a front is about to break, once per war, drawing only
on forces the player left idle — and losing a country now takes three
consecutive months of a broken line, not one.

**A do-nothing premier *won* 16% of the time.** Regimes had no tendency to
recover, so every state random-walked into collapse and waiting was a strategy.
Fixed with per-nation `baseStability` and mean reversion: pressure has to be
sustained to tell.

**A simple bot won 80 games out of 80, median 8 months, with US relations
*rising* to 76.** Funding four insurgencies simultaneously and then
assassinating four leaders was nearly free and carried no risk. This was the
central mechanic being broken. Fixed with three things at once: a Mossad
capacity ceiling of 4 operation-points per month (support 1, assassinate 3,
coup 4) with a degradation penalty for overreach; per-nation `counterIntel`
that rises while you operate there and decays when you stop, slowing growth and
lowering success; and real exposure consequences, worst on a *failed* extreme
operation, which burns the network and hands the regime a gift.

**Every game ended embargoed.** The US relationship was a one-way ratchet with
only flat `+1`/month recovery. Now it reverts proportionally toward a baseline
that depends on conduct, so a premier who stops can rebuild it over a year and
one who never stops cannot.

Where it landed. Passive players run 120 games each, the strategist 80:

| player | victory | survived decade | invaded | removed or killed |
| --- | --- | --- | --- | --- |
| passive, signs everything | 0% | 43% | 43% | 15% |
| passive, refuses everything | 0% | 0% | 0% | 100% |
| disciplined strategist | 19% | 14% | 5% | 60% |

Signing at Camp David and then doing nothing survives the decade more often
than not, and never wins. Refusing and then doing nothing loses every single
time — not to invasion but to the Knesset, because September arrives and there
is no answer to it. A deliberate campaign wins a bit better than one game in
four, median 25 months, and is removed from office more often than it wins.

**A settled front used to be settled forever.** `endWar` raised a U.N.
military-free zone and nothing ever lowered it again, so one negotiated
ceasefire removed a border from the game permanently, in both directions —
while the screens went on calling it a consequence of "the recent conflict".
The mandate now runs for three years and then lapses, with a headline when it
does. The strategist feels this and nobody else does: victory is unchanged at
27%, but coasting to the ten-year mark on the strength of an old ceasefire no
longer works, so *survived* falls from 14% to 8% and those games are invaded
instead.

Nobody wins by accident, and the safest play is not the winning play. That gap
is the game.

---

## 4. Hardware

The original counted tanks. So did this, at first: `Israel.stockpile` was a bag
of scalars, a delivery did `stockpile.tanks += quantity`, and an M1A2 Abrams and
a T-72M both simply incremented the same number. The catalogue had carried a
`power` field on all nineteen entries since the first commit — Abrams 12,
Challenger 2 11, AMX-30 8, T-72M 7 — and nothing anywhere read it, because
nothing could.

A force is now an inventory of named types. Counting tanks is a question you ask
an inventory rather than a field it stores, because which tanks they are is the
whole point. Two references do two different jobs, and confusing them was the
first thing that went wrong:

- **`COMBAT_REFERENCE`** (tank 8, air 20, sam 10) is the hinge that keeps the
  arithmetic compatible with the flat-count model. A unit of exactly this power
  is worth what any unit of its category used to be worth, so the June 2000
  opening position is unchanged.
- **`REGIONAL_NORM`** (tank 6, aircraft 13, …) is what a typical unit *on these
  borders* looks like, and is used only to turn a fleet's mean power into a
  word. Most armour in the region is a T-55 or a Type 59, and it is measuring
  the Merkava against that which makes "modern" mean something. The first
  attempt graded Israel against its own average and reported, inevitably, that
  Israel was average.

The compositions are not flattering to anybody. Syria fields 4,500 tanks to
Israel's 3,900 and a third less weight, because 2,000 of them are T-55s. Egypt
is the only Arab army buying American and grades out well above its neighbours.
Israeli armour runs from Merkava Mk 3 down to captured Tiran 5s.

Three things follow from having types at all, and none of them was possible
before:

**The neighbours rearm.** `Nation.forces` used to move in one direction only —
attrition, strikes, nukes, inter-Arab wars — and nothing ever put a unit back,
so a patient premier could win by outlasting everybody. Reconstitution is driven
by the size of the hole rather than a flat trickle: an army knocked to half
strength is roughly two thirds of the way back inside two years, and it replaces
losses with the best it can get, so a fleet modernises as it heals. Access is
political rather than economic — Cairo has an American production line, Baghdad
is ten years into sanctions cannibalising airframes for spares.

**We build our own.** A production line is the only source of equipment nobody
else has a veto over, which is why it is priced worse per unit than importing.
It is standing policy rather than a monthly order: it bills the Treasury every
month until it is closed, and the Mk 4 programme bills for thirty of them before
the first tank exists.

**An embargo grounds aircraft.** It stops the spares, not the tanks.
Serviceability for the affected origin decays to a floor of 55% and recovers
when parts flow again; grounded airframes stay on the inventory and are worth
nothing at all on the day. The floor is as deliberate as the rate — an embargo
must hurt for years without being simply fatal. The opening Israeli order of
battle is heavily American, so this bites hard, and it is what finally makes the
domestic lines an argument rather than a flourish.

---

## 5. The home front

`Israel.popularity` was doing two jobs badly. What the country thinks of you and
whether you can still pass a budget are different questions, and conflating them
meant a premier could concede a Palestinian homeland, lose fourteen points of
polling, and govern on undisturbed.

The Knesset is now the real 1999 arithmetic — seventy-five of a hundred and
twenty, with sixty-one needed. Partners are not scored on popularity. They are
scored on three things they actually care about, and the same act moves
different ones in opposite directions:

| | territorial | hawkish | welfare |
| --- | --- | --- | --- |
| Meretz | wants concessions | dislikes force | some |
| National Religious Party | calls them betrayal | approves | none |
| Shas | **the pivot** | mild | its school network above all |

There is no position that satisfies a government assembled out of Meretz and the
NRP, which is the point and was Barak's actual problem. Losing your majority is
not death: he governed as a minority from July 2000 until he went to the country
in December, and so can you. The ordinary cost is popularity month on month, and
the House only tables a confidence motion once the arithmetic is hopeless.

**There is no good answer to Camp David, and it is not the answer you would
expect.** Conceding costs Shas, the NRP and Yisrael BaAliyah and hands you a
minority to govern with. Refusing keeps them, loses Meretz, and sets the
territories alight in September. Over eighty games of the same campaign
differing only on that question:

| | victory | government lost |
| --- | --- | --- |
| concedes the homeland | 24 | 35 |
| refuses it | 0 | 66 |

This was written expecting the opposite, on the reasoning that a premier who
spends the decade invading his neighbours should keep the right on side. The
harness said otherwise: the Palestinian track punishes refusal considerably
harder than the coalition punishes concession. The test now records what is
true rather than what was assumed.

Manpower and money stopped being decorative in the same pass. `reserves` was
decremented in combat and gated nothing; it now gates emergency mobilisation,
is *spent* raising brigades rather than created by it — the arrow was
backwards — and refills only in peace, so a decade of war is a decade of
getting smaller. Casualties cost the coalition its patience whether or not the
campaign is going well, because war weariness is about the funerals and not the
map.

`gnpPercent` was written at every budget and read only by two screens. Past
about 10.5% the parties that are in government for the welfare budget start
counting. The penalty saturates rather than growing without limit, and the
distinction matters: the first attempt was linear, and it quietly drowned out
every other input to standing. The reference strategist used to raise the
defence share every December for a decade, reaching a fifth of national product
and losing the House over it. Teaching it to stop at 11% took its victories from
16 to 24 out of 80 — which is the clearest evidence available that the
constraint is a decision rather than a tax.

---

## 6. The powers

Washington was never an actor. It was a single scalar, `israel.usRelations`,
moved by twenty-odd callers each restating the same clamp by hand, with no
menu, no demands, and nobody on the other end of it. That is the whole reason
an arms embargo had no lever: there was nothing to negotiate *with*. The
summit trail had been printing "U.S. embargo on Israel might be scrapped at
summit" since the first commit, and no such proposal existed.

The three Western capitals are deliberately not `NationId`s. They have no
border, no stability, no opposition to fund and no army you can mass on. What
they have is a relationship, a price, and a memory — and, unlike the
neighbours, they will tell you what they want.

**They stopped agreeing with each other.** An embargo used to be one boolean:
Washington declared, and Paris and London were assigned the same value on the
next line. Each now decides on its own relationship and its own appetite for
the row. London is narrow and reliable and does not want the argument; Paris
embargoed Israel unilaterally in 1967, kept it for a decade, and has never
entirely stopped enjoying having done it. Paris is reliably the first capital
to stop selling, and does not need anybody's permission.

**There are now three things to do about it.** Quiet diplomacy costs $40 M and
works, and works less well each time — a capital that has heard the argument
four times running is not hearing it a fifth, which is what `patience` is for
and why there is no strategy of simply buying the relationship back a month at
a time. Formal undertakings buy a great deal of goodwill and *bind*: for eight
months the strikes and the invasion are off the menu, with the reason shown,
because a promise the player can quietly break is not a promise. Or you can
tell them where to go, which costs the relationship and plays well at home.

A nuclear strike no longer closes the road permanently. The deed does not
declare the embargo — the forty-five points it costs the relationship do that.
What it does is raise the bar afterwards from thirty to seventy: steep, and
survivable.

Camp David is no longer worth the same everywhere. A flat `+22` to all seven
capitals was both too uniform and too generous. Amman has carried the refugee
question since 1948 and Cairo staked its regional position on the peace;
Tehran and Tripoli have no stake in the file and merely lose a grievance they
were enjoying.

| Jordan | Egypt | Lebanon | Syria | Iraq | Libya | Iran |
| --- | --- | --- | --- | --- | --- | --- |
| +34 | +30 | +24 | +16 | +12 | +8 | +6 |

Two bugs here were found by tests rather than by reasoning, both invisible to
every balance measure because every bot in the harness buys only from
Washington. Paris opened at 36 relations against its own embargo line of 39,
so France was embargoed from month one. And the nuclear clause triggered on
relations *above* seventy rather than raising the bar for lifting, so it never
fired at all.

---

## 7. Intelligence

The Strategic Action screen used to print the defender's exact combat weight:
a number the engine computes out of a data structure the player has no
business being able to read. Knowing the enemy order of battle to the tank is
not a small convenience — it is the reason intelligence had nothing to do
except sabotage. There was no such thing as being surprised.

An assessment is now the truth seen through whatever coverage we have of that
country, and coverage is something you build and lose. With no sources the
band runs to plus or minus 55%, which is wide enough to walk into a war
believing the wrong thing. The error is redrawn once a month and stored, so a
picture that is wrong is wrong consistently until somebody goes and looks —
an assessment is a thing the cabinet was given, not something that changes
while it is being read.

Two ways to see, and they are not substitutes. **Agents** are cheap, specific
and perishable: a network is built a few points a month, goes cold when
nobody runs it, and is what an operation is actually carried by. **Overhead**
— the Heron, and the Ofek satellite programme the hardware phase deliberately
left out until there was a fog for it to lift — gives a floor everywhere at
once, including countries with no network at all, and no security service can
arrest a satellite. An Ofek is worth nothing whatever in a battle, which is
the point of it.

Counter-surveillance stopped being a flat −6 a month regardless of who was
hunting. A competent, stable security service keeps its files open for years;
one whose government is disintegrating forgets us quickly.

**Tuning this took five measurements and four of them were wrong.** The first
attempt cost the strategist thirteen of its twenty victories, so the two
changes were separated and run against a neutral build:

| | victories of 80 |
| --- | --- |
| neither change | 19 |
| dynamic counter-surveillance only | 25 |
| network reach only | 12 |

The decay change was *helping* — the strategist targets unstable states, and
those now forget it faster. The entire cost was `reach`, which at a starting
network of twenty amounted to a permanent nineteen per cent penalty on every
operation: a gate dressed as a reward. Three attempts to teach the reference
bot to compensate all made it worse, one of them because collecting on four
countries at a point of capacity each consumed the whole of Mossad's budget
and left nothing to run the coup with.

The fix was not in the bot. Israel has had people in these places for decades,
and the standing network should reflect it — eighteen years in southern
Lebanon and a liaison relationship with Amman are not the same kind of access
as whatever is left in Tripoli:

| Lebanon | Jordan | Egypt | Syria | Iraq | Iran | Libya |
| --- | --- | --- | --- | --- | --- | --- |
| 70 | 65 | 60 | 55 | 42 | 32 | 30 |

Which makes the opening roughly neutral, running agents a real improvement,
and a network burnt by a failed coup — it drops to a fifth — a disaster you
have to spend years repairing. That is the shape the mechanic wanted all
along, and no amount of adjusting the bot would have found it.

---

## 8. The groups nobody governs

This section closes the omission the last one on this list used to describe:
Hezbollah and the PLO as an opposition-strength number and a scripted event,
in a game that opens three weeks after the withdrawal from southern Lebanon.

A faction is deliberately **not** `Nation.oppositionStrength`. That is the
internal political opposition — the people a foreign service funds into a
coup, which is a question about the regime. A faction is an armed
organisation with a patron, a constituency and a programme, and it frequently
wants its own government gone rather less than it wants Israel gone.
Conflating the two is how Hezbollah ends up modelled as a Lebanese election
result. They coexist; they are different problems.

They have no borders, so they get a card and no geometry — the same treatment
Libya has always had. Carving faction territory out of the map would break the
shared-vertex assertions in `geography.test.ts`, and a militia does not hold a
frontier anyway.

Strength converges toward what a group's circumstances sustain — its patron's
stability, its constituency, and how much space its host gives it — rather
than accumulating. The first version accumulated, everything reached a hundred,
and a passive premier survived the decade 32% of the time instead of 53%.
Hitting them works and recruits for them, which is the whole problem with
them and is meant to feel like it.

**And a collapse stops being a dead end.** A fallen state used to offer
nothing on any screen but a withdrawal — which is the bug that stranded a
player's forces on the Lebanese border and started this whole roadmap. States
do not vanish; they come apart into the people who were holding them together.
Syria fragments into the officer corps, the Muslim Brotherhood and the
Damascus notables. Iraq into the Sunni officer class, the Shia south, and the
Kurds, who are an old friend of this service. Arm one far enough and they form
a government — and the government you get is the one you armed, disposition
and all. Backing the Islamist front in Cairo will install the Islamist front
in Cairo.

Restoring a state also un-collapses it, which forfeits it as a victory
condition. Putting a friendly government in Damascus and winning the game by
destroying Damascus are alternatives, and the player has to pick one.

---

## 9. The map

The original shipped six EGA maps as run-length scanline data. Decoding them
took three goes: the records are five bytes (colour, x16, y16), each starting a
horizontal span that runs to the next record on that scanline — and the
scanlines are stored **bottom-up**, so the first correct-looking render came
out mirrored with the place names upside down. `tools/decode_assets.py` does it
properly, and all six are recoverable as PNGs.

They could not be used directly. All six are Levant-scale, and none shows the
whole roster: `MDLEAST` is centred on Jordan, `ISRAEL` on Israel, and Iraq,
Iran and Libya get separate screens. The map here has a job theirs did not —
it is the surface you set policy from — so every playable state has to be on
it, and clickable.

So it is a new map in the original's idiom: flat colour blocks, monospace
capitals with a dot, spaced-out country names. The geometry is real
longitude/latitude simplified to the vertices that read at this scale, which
means it can be checked against an atlas rather than eyeballed in pixels.

Two decisions worth recording:

**Shared borders are defined once.** Each frontier is a named segment, and both
neighbours are composed from it — forwards for one, reversed for the other. No
sliver can open between two countries, and `geography.test.ts` asserts that
every common frontier still matches vertex for vertex, so a one-sided edit
fails the build rather than leaving a hairline gap.

**Direction matters, and sharing vertices does not prove it.** Five of the
rings were assembled with a shared segment traversed the wrong way round, so
the outline doubled back on itself — which renders as Jordan spilling into
Syria and Lebanon into Syria. The original shared-vertex test sailed straight
past it, because a reversed segment shares every one of its vertices. The
invariant that actually catches it is that each ring must be a *simple*
polygon, so `geography.test.ts` now checks every pair of non-adjacent edges
for a proper crossing. That immediately turned up a sixth bug nobody had
noticed: Egypt's Gulf of Suez had the African shore drawn east of the Sinai
shore, so the peninsula was inside out.

**Two framings, one projection.** At regional scale Israel is twenty-five
pixels wide and its four borders are indistinguishable. Rather than a second
map, the Levant view is the same SVG with a different `viewBox`. That magnifies
type and stroke weights along with the geography, so a scale factor is passed
down as a CSS variable and every label and marker is multiplied by it — which
is why the two views look like the same map at two distances rather than one
map blown up.

Live state is drawn rather than described: brigade counts thicken the frontier
they hold, wars dash it red, the territories hatch in proportion to unrest, and
collapsed governments go grey and struck through.

## 10. The wider market

Washington would not sell the IAF more of the aircraft it already flew. The
catalogue offered the F-16I and the F-15I and not one more F-16C, and the
Apache on sale was the Longbow the IAF had not yet bought rather than the
Peten it had. The Baz, the Barak, the Netz and the Peten are now on the
American page, and they reuse their in-service ids, so a delivery lands in the
same inventory line as the squadrons already flying them. The registry merge
had to learn this: the in-service entry names the aircraft on the review
screens, and the catalogue entry keeps its reach.

London, Paris and the dealer each carry twice what they did. Three counters are
new, and none of them is simply a shop:

| | refuses while | Washington's disapproval per order |
| --- | --- | --- |
| the dealer | never | small |
| Moscow | we are at war with, or have lately bombed, Damascus or Tehran | more |
| Beijing | we have used the bomb, or lately bombed Tehran | most — the Phalcon affair was July 2000 |
| Ankara | we have used the bomb, or police an intifada hard | none |

They have no relationship ladder and no demands, because they are not
capitals with a view of Israel; they are sellers with clients and electorates,
and their refusals lapse when the reason does. Turkish kit is licence-built
American kit, so it carries an American badge and an American embargo grounds
it. New Russian and Chinese production needs its makers' spares; Cold War
Soviet stock does not, because nobody alive can refuse them.

Things that did not exist yet are on the page greyed, with a year — the Rafale
from 2002, the Tigre from 2003 — because a defence minister plans around the
next aircraft before anyone can deliver one.

## 11. The long reach

Iraq, Iran and Libya had armies, nuclear programmes and no border, and so
nothing on any menu but diplomacy and Mossad. Osirak is the most famous thing
the Israeli Air Force ever did, and the game could not do it.

A raid now needs aircraft that can make the trip — eight for Baghdad, twelve
for Tripoli, sixteen for Tehran, counted from the types that carry the range —
rather than an air force of a certain size. Every route crosses somebody's
airspace, and they are asked about it afterwards. Each capital answers in its
own way and none of them from where it was hit: Baghdad with Scuds on Tel Aviv,
Tripoli with a bomb somewhere else, and Tehran from southern Lebanon. Osirak
was one building; Tehran learned from it, and a strike on its programme sets
it back by less.

`lastStruck` records who we bombed and when. Moscow and Beijing read it.

## 12. Ground

A war between two other states used to be a coin toss each month about who
had lost it. There was no ground, so there was nothing to draw: Baghdad and
Tehran were either fighting or not. A war now has a front line, the same
centre-anchored figure the Israeli fronts have always had, and the map shades
the land that has changed hands.

"A quarter of Iraq" is measured as depth, not area: the band is the frontier
moved inward by a quarter of the distance to the far side of the country, and
clipped to its outline. That is how a front line moves and how a newspaper
draws one, and it keeps the shading on the border it was taken across. Two
states with no common frontier — Iran and Syria — have nothing to draw and are
described in words instead.

Our gains are kept under a ceasefire, as the ceasefire text has always said,
and go home with the column; theirs are handed back. Tidying the wars of a
fallen government moved into `collapseGovernment` along the way — the victor's
list used to be cleaned by whichever caller remembered to.

Rewriting the inter-state wars moved the passive signer from 51 to 53
survivals of 120, and invasions from 51 to 44.

## 13. Two signatures

Signing at Camp David used to end the Palestinian question. It is now an
offer, and the other side has to sign as well. Arafat's willingness starts
a little under even at Camp David, falls with unrest and with a strong Hamas,
and rises when Cairo and Amman stand behind the deal.

When we sign and he does not, Washington, London and Paris all give us credit
for going further than anybody had; the country rallies to the premier who
offered everything ("there is no partner" is a popular thing to be able to
say); and the right still punishes the offer, if less than a deal it would
have had to live with.

The intifada is no longer a scripted event on 28 September. It is a monthly
hazard from September 2000, set by how the talks ended — high after our
refusal, somewhat lower after his, small after an agreement but never zero,
since somebody always rejects the deal — and scaled by the street and by
Hamas. It can burn out after four quiet months. And if the territories are
burning with nothing signed, Taba follows: once, three months on, with better
terms, more unrest-tolerant odds of a Palestinian signature, and a heavier
price for a minority government that signs under fire.

**This is the one change in this pass that was allowed through the harness
floor.** A do-nothing premier has never been able to outlast an intifada — the
refuse-everything bot survives none of its 120 games — so every Arafat refusal
routes a passive signer onto a track that was always fatal to passivity. The
first version charged the offer at full price and then the intifada on top,
and a passive signer who was refused survived two games in fifty-eight.
Shared blame and the "no partner" rally took most of the cruelty out of it
without changing the odds, and what is left was a decision: keep Arafat's
refusal at the rate history suggests, and let the game be harder.

| passive, signs everything | survived | invaded | removed | assassinated |
| --- | --- | --- | --- | --- |
| before this pass | 51 | 51 | 16 | 2 |
| after | 35 | 33 | 43 | 9 |

The strategist feels it more than anybody, because it concedes at Camp David
by design: victories fell from 15 of 80 to 5, and the median game from
thirty-six months to thirteen. Refusing is still worse — no victories at all —
so there is still no good answer to Camp David; there is now a less good one.

Over forty seeds: refusal led to an intifada 38 times; Arafat refused 15 of 40
signings; and of the 25 genuine agreements, 5 saw a rejectionist uprising.

## 14. September 2001

It usually happens. About one time in seven the cell is broken up first, and
the world goes on as it was.

When it happens, Washington's threat perception changes overnight and so does
what it will pay for, sell, and look away from: December aid is a quarter
larger and there is a one-off emergency grant; the American catalogue opens a
rung earlier and delivers a month sooner; and strikes on the armed groups and
on the State Department's list cost half as much in Washington, which also
stops pressing us about strikes on anybody who is not a government. For the
first three months, though, it is assembling a coalition that needs Arab
capitals in the room, and an Israeli raid on a state costs twice as much.

## 15. Alliances

A pact used to lower an enemy's appetite for attacking us and do nothing else.
A treaty is now a promise to be on somebody's side, and it is called in from
both directions.

When we are attacked, every state with a defence treaty with Israel finds out
what it signed: the warm ones march, and their armies count on our side of
the line the way the enemy's allies always counted on theirs; the lukewarm
ones find a reason not to, and a treaty nobody honours is not a treaty any
more. When a partner is attacked, the question comes to our cabinet — once,
for a month — and silence is an answer. Staying out kills the treaty, costs
prestige, and every other government with a treaty draws its conclusions.
Honouring it puts Israeli aircraft over the aggressor, and if the aggressor
is a neighbour, opens a front of our own. The other states' treaties work the
same way among themselves, except that they send help rather than declare war.

A **joint offensive** is only offered against an enemy the partner already
despises: nobody in Cairo invades Libya because Jerusalem asked, only because
Cairo was halfway there already. Against a neighbour it is our invasion with
the partner beside us; against a far capital it is the partner's war, with
our air force over it. It costs the partner its standing in the Arab world.

**Mediation** makes a ceasefire likelier than asking for one ourselves, and
the mediator names its price if it works: Washington wants undertakings, and
a neighbour wants the ground handed back. Israel can offer to mediate other
people's wars when both sides will have us in the room, and Cairo and Amman
sometimes do it without being asked. **A Western air force** will fly against
a state on the State Department's list, in a war we did not start — unless
Washington has since decided it is fighting the same war — and wants
undertakings afterwards.

Every Israeli war now begins through one door, `openFront`, whoever opens it.

## 16. Before the cabinet

The coalition was something that happened to the premier: partners reacted
to what he did abroad and walked out when they had had enough. That is half of
it. The other half is what a coalition asks of its own leader — a school
network that has run out of money, a turbine that has to be moved on the
Sabbath, a ministry two partners both want. A dozen such questions come before
the cabinet, each worded as who is pleased and who is not, each with a
fallback that happens if nobody decides, and a small price for being seen not
to.

A fourth axis, religion and state, is where Shas and Shinui cannot both be
satisfied, and where most coalitions of the period actually broke. Likud and
Shinui sit outside the government. They settle toward their own opinion of
us rather than toward indifference — left to drift like everybody else, Likud
joined a Barak government on its own inside a year — so they have to be
brought in on purpose, or offered a unity government during an intifada.

One favour a month, for one party: money for its institutions, a ministry,
a seat in the security cabinet, or the thing it wants most, which somebody
else will mind. A government that has lost its majority can go to the country;
the polls decide it, mostly, and losing is a new ending.

## 17. Tehran's proxy

Hezbollah fired at a rate set by its own strength, and the border's temper
followed Beirut's relations with us. Both were wrong in the same way: the
group answers to Tehran. It now provokes us as often as Tehran wants — at the
June 2000 rate while Iran is as hostile as it was then, far less as Tehran
warms, and much more for six months after we bomb Iran. A Beirut that is
making its peace with us is humiliated by an attack rather than blamed for
it, and can be pressed to put its army between Hezbollah and the border,
which is the only lever on the group that goes through a government.

Every attack is a question the cabinet must answer, and every answer is paid
for three times — at home, in the region and in the West — never in the same
coin. Restraint plays in Washington and not in Kiryat Shmona; punishing Beirut
plays in Kiryat Shmona and costs the Arab world and Paris; hitting Syrian
positions reins Hezbollah in and risks Damascus; a killing in Beirut is
answered, sometimes, at an embassy somewhere else. Silence counts as
restraint, with the cost of having said nothing. A hard answer to a patron
that wants a fight can open a rocket campaign, which only a brokered
ceasefire ends.

**This was the second change allowed through the floor, and the first
version was wrong twice.** Tehran's pressure started at one and a quarter
rather than one, which with every raid now needing an answer meant nearly two
a year; and restraint's cost with the right, at three times its present
size, pushed the NRP and Yisrael BaAliyah — who open close to leaving — out
of the government after a year of letters to the U.N. With both corrected:

| 120 passive signers | survived |
| --- | --- |
| no Hezbollah at all | 33 |
| as built, never answering | 22 |
| answering every attack with restraint | 24 |
| answering every attack by returning fire | 21 |

The answers barely matter to a premier who does nothing else; the questions
existing is what costs. That was the point of asking them, so the floor moved
from 20% to 15% by decision rather than the questions being made free.

Where the whole pass landed:

| | survived | invaded | removed | assassinated | victory |
| --- | --- | --- | --- | --- | --- |
| passive, signs everything | 22 | 33 | 53 | 12 | 0 |
| passive, refuses everything | 0 | 0 | 88 | 32 | 0 |
| strategist (of 80) | 1 | 0 | 55 | 21 | 3 |

The strategist — which answers no cabinet question, no treaty and no attack —
still wins, just, and still beats passivity. Refusing Camp David still wins
nothing.

## 18. Deliberate omissions

- **The original pixel art is not used.** The decoders work and the assets are
  fully recoverable (`tools/decode_assets.py`). The map borrows the original's
  visual grammar rather than its pixels; the 160×200 unit sprites are still
  unused and are one decision away.
- **`.FNT` files are not decoded.** Not needed without the pixel art.
- **Save games are not compatible** with the original's 7372-byte `CONF*.SAV`,
  and there is no save at all yet — the most obvious next thing to build.
- **Factions have no territory.** They are entities with patrons, goals and
  their own arithmetic, but they hold no ground on the map — the geometry
  asserts a fixed table of shared border vertices and a militia is a poor
  reason to break it. A civil war is currently something you read about and
  fund rather than something you watch move.
- **The reference bots do not use half of what has been built.** They never
  run agents, open a production line, lobby a capital, back a successor, fly
  a long-range raid, shop anywhere but Washington, or answer a cabinet
  question, a treaty or an attack on the northern border, so
  every balance figure in this document is what happens to a player who
  ignores five phases of mechanics. The real ceiling is higher and nobody has
  measured it.
