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
demands. Refusing the Camp David framework sets the territories alight in
September, deterministically. Signing takes the question off the table for the
rest of the game, at the price of your coalition.

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
| passive, signs everything | 0% | 57% | 42% | 2% |
| passive, refuses everything | 0% | 0% | 0% | 100% |
| disciplined strategist | 27% | 8% | 19% | 46% |

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

## 4. The map

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

## 5. Deliberate omissions

- **The original pixel art is not used.** The decoders work and the assets are
  fully recoverable (`tools/decode_assets.py`). The map borrows the original's
  visual grammar rather than its pixels; the 160×200 unit sprites are still
  unused and are one decision away.
- **`.FNT` files are not decoded.** Not needed without the pixel art.
- **Save games are not compatible** with the original's 7372-byte `CONF*.SAV`,
  and there is no save at all yet — the most obvious next thing to build.
- **Non-state actors are not first-class.** Hezbollah and the PLO exist as an
  opposition-strength number and a scripted event, not as entities with their
  own goals. For 2000 that is the most conspicuous simplification, and the
  natural direction for a second pass.
