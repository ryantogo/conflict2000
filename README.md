# Conflict 2000

A spiritual successor to *Conflict: The Middle East Political Simulator*
(Virgin Mastertronic, 1990), moved from the original's invented 1997 to
**June 2000**.

You are Prime Minister of Israel. The security zone in Lebanon was abandoned
three weeks ago. Hafez al-Assad is dying. The Americans want everyone at Camp
David in July. Each turn is one month, and it opens with the papers.

Your objective, as in the original, is the collapse of the four neighbouring
states — by invasion or political destabilisation, and not necessarily by your
own hand. Whether that is worth doing is left to you; the game will have an
opinion about it at the end.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

| command | |
| --- | --- |
| `npm run dev` | dev server with hot reload |
| `npm run build` | production build to `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | engine tests, including the balance harness |

Requires Node 18+. No other setup.

## How a turn goes

1. **The papers.** A front page reporting last month. The manual is explicit
   that it lies to you: "Distortion, fabrication and propaganda all creep into
   the columns of newspapers."
2. **Situation Map.** The whole region, and the place most turns get played
   from — see below.
3. **Briefing.** What the Foreign Office and the National Security Office
   actually think, plus prestige, tension and your standing in the Knesset.
4. **Foreign Office.** Per country: one diplomatic directive and one
   intelligence directive. Warming relations is slow; souring them is fast and
   visible.
5. **Strategic Action.** Deployment, strike bombing, invasion, and the running
   of any war. The aggressive options are simply absent until relations are
   already bad — you cannot ambush a friend.
6. **Procurement.** Four suppliers with memories. Everything arrives late.
7. **Review Forces** and **Home & Nuclear**: the West Bank, and the bomb.
8. **Next Turn.**

## The situation map

Click any state to select it; every directive you could issue from the Foreign
Office or Strategic Action screens is there beside it, so a whole turn can be
played from the map. Three colour modes — **Relations**, **Stability**,
**Forces** — and two framings:

- **Region** spans the Nile to the Zagros: everyone who matters, at a glance.
- **Levant** zooms to the theatre, where the four borders are far enough apart
  to read. (Israel is about twenty-five pixels wide at regional scale, which is
  why the original shipped a separate Israel-scale screen.)

Live state is drawn on it rather than described: brigades thicken the frontier
they are holding, a war dashes it red, the West Bank and Gaza hatch in
proportion to unrest, and a collapsed government goes grey and struck through.
Type and markers stay the same size on screen at either zoom.

Every value is shown as a word rather than a number, as in the original —
relations run `Non-Existent → Excellent` across ten rungs, and you are never
told which one you are on numerically.

## Things worth knowing

- **You cannot invade a friend.** Souring relations enough to make it possible
  takes months and Washington notices.
- **Mossad has a capacity of 4 operation-points a month.** Funding an
  insurgency costs 1, an assassination 3, a coup 4. Exceed it and every
  operation that month is weaker and likelier to be exposed. Only one
  decapitation can be attempted per month.
- **Counter-intelligence accumulates** wherever you operate, and decays when
  you stop. A sustained campaign in one country gets progressively harder.
  A *failed* coup is far worse than no coup: it burns the network and
  strengthens the regime.
- **The American relationship is repairable.** Wars and exposed operations
  drive it down; quiet months pull it back. An embargo lifts if you stop.
- **Camp David is the pivot.** Sign the framework and the Palestinian question
  is settled, at the cost of your coalition. Refuse, and September happens.

## Layout

```
src/
  engine/          pure simulation, no UI imports
    types.ts       state shape
    ladders.ts     the descriptive scales, verbatim from the 1990 binary
    rng.ts         seeded PRNG — a game is reproducible from its seed
    diplomacy.ts   intelligence.ts  military.ts
    arms.ts        palestine.ts     nuclear.ts    ai.ts
    turn.ts        resolveTurn: one month, start to finish
    ending.ts      the Leadership Analysis screen
    *.test.ts      engine, balance and strategy harnesses
  data/
    nations2000.ts opening position, June 2000
    arms2000.ts    the catalogue
    headlines.ts   templates + the token expander
    scripted.ts    history, on its real dates and conditional
    geography.ts   map projection, borders, capitals
  ui/              React screens
    RegionalMap.tsx  the SVG map
    MapRoom.tsx      map plus its policy panel
tools/             decoders for the original's asset formats
```

The engine imports nothing from `ui/` and never touches the DOM, which is what
lets the test suite play thousands of games a second.

## Documentation

- **[DESIGN.md](DESIGN.md)** — what was taken from the original, what changed
  for 2000, and what the balance harness found (including the three separate
  ways the game was broken before it was tuned).
- **[tools/README.md](tools/README.md)** — the original's file formats.

## Credit and legal

*Conflict: The Middle East Political Simulator* was published by Virgin
Mastertronic in 1990. This project is an unaffiliated reimplementation, not a
port or a re-release:

- **No original code, artwork, audio or data files are included or required.**
  Everything here was written from scratch; the game runs on its own.
- The descriptive vocabulary and the newspaper's clipped house style are
  deliberately preserved, and short phrases are quoted in source comments and
  `DESIGN.md` where they explain a design decision.
- The extracted manual text and executable string dump used as research
  material are **not** distributed here. `tools/` regenerates them from your
  own copy of the original, if you have one.

Nothing in this repository lets you play the 1990 game, and it is not a
substitute for owning it.
