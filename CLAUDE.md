# Junkyard Redemption — SOL Kids Camp scoreboard

Team points scoreboard, mobile web app. Leadership awards points to eight teams
across six named categories per day. A big screen shows live standings at the
evening gathering. Phase 0: UI-complete, mock data, no auth, localStorage,
GitHub Pages. Phase 1 (later) swaps the DataProvider for a shared backend so
several leaders can score at once — never put storage calls in components.

Aesthetic bar: AAA console game UI (Destiny 2 / Diablo IV register). Warm brown
industrial salvage with electrical arcs. Reference PNGs in `design/reference/`
are a taste target, not a pixel target.

## Design system

### Tokens

```
--bg            #16110D   warm near-black brown
--panel         #241C16   dark warm brown gunmetal
--panel-raised  #2E241C
--bevel         #4A3B2E   bevel highlight, catches key light
--brass         #C08A3E
--rust          #8A5230
--accent        #2FD9D0   teal — the only cool color on screen
--accent-hot    #FFFFFF   arc core
--text          #EDE3D2   cream
--text-dim      #8A7A68

--team-warriors  #FF5FB8   Pink Junkyard Warriors
--team-precious  #B14DFF   Precious Pieces
--team-gems      #3D9BFF   Hidden Gems
--team-pearls    #96F5B4   God's Pearls
--team-knights   #FF4438   Fire Knights
--team-innocent  #FFD84D   Innocent
--team-forged    #78D62E   Forged
--team-rustco    #FF9440   Rust Revival Co.

--key           #FFC63D   golden key emission
--key-hot       #FFF4D0   key arc core
```

Team colours are machine-verified: all clear 4.5:1 on `#16110D`, minimum
pairwise separation 0.145 OKLab, none collides with brass, arc-teal or body
text. **Do not adjust them by eye** — re-run `scripts/validate-tokens.mjs`.

Replace the Tailwind default palette entirely — no default Tailwind color should
be reachable.

The interface reads **warm and brown** — aged brass and oxidized steel. Nothing
cool except teal and the team colors. **If a screenshot reads blue-grey, it is
wrong.**

### Material rules

- Panels are brown-tinted brushed steel: horizontal anisotropic highlight, fine grain.
- Every raised panel has a **2px chamfered bevel lit from the top left** plus a soft
  contact shadow. **One consistent light direction on every screen.** Inconsistent
  light direction is the single biggest tell that something was AI-generated rather
  than designed.
- Recesses get true inner shadow. Raised edges get crisp warm specular.
- Three to four readable depth layers per screen.
- Rust patina in crevices and along lower edges only — never an overall texture wash.
- Detail language: hairline rules, corner brackets, engraved ticks, tiny monospaced
  technical labels, micro rivets at panel corners.
- Subtle warm vignette toward screen edges.

### Glow rule

**Glow must be motivated.** Every glowing thing is an emitting source — a lit tube,
an emissive gauge fill, a backlit chip — spilling light onto surrounding metal with
tight physical falloff. Never apply glow as decoration to a non-emitting surface.
This is what separates premium game UI from AI slop.

### Arcs

- **Every arc has two visible brass contact posts as endpoints.** An arc terminating
  on nothing reads as decoration; an arc jumping a gap between two posts reads as
  current. Non-negotiable.
- Two layers: thin white-hot core path + thicker teal glow beneath.
- Arcs cast teal light onto the brown metal and brass they cross.
- Fine controlled branching, never chaotic scribble.
- Pre-generate 4–6 path variants per arc and cycle them. Flicker at 8–12fps, never 60.
- Escalation by screen: idle flicker on roll call → full discharge on commit →
  surge on the seventh check-in → leading row only on standings → leading column
  only on the big screen. Arcs everywhere flattens the hierarchy.

### The one gold exception

The golden key ceremony (`/key/:teamId`) is the single deliberate exception to
the colour rule: **no teal at all**. Its arcs are gold-white, its light is warm
gold. Breaking the rule exactly once is what makes the rare thing feel rare — so
hold the rule everywhere else, and never let gold act as an arc colour on any
other screen.

### Typography

Heavy condensed uppercase display for headers and numerals (`font-display`:
Oswald). Clean condensed sans for body and names (`font-body`: Barlow Condensed).
Tiny technical labels in `font-mono` (JetBrains Mono). Tabular numerals,
right-aligned, sharing a column edge. **Ban Inter. Ban system-ui defaults.**

### Layout discipline

Strict 8px grid. Uniform radii. Even gutters. Shared baselines. Identical row
heights in any list. The richness sits on rigorous alignment — that rigor is why
it reads expensive.

### Motion

- `transform` and `opacity` only. No layout-triggering properties. 60fps target.
- Drag tracks finger 1:1, no easing. Spring-back `cubic-bezier(0.34, 1.56, 0.64, 1)` 400ms.
- Honor `prefers-reduced-motion`: keep state changes and tube ignition, drop arcs
  and token flight.

### Forbidden

Purple gradients. Glassmorphism. Generic card grids. Emoji icons. Tailwind
defaults. Ornamental filigree. Depth-of-field blur. Lens flare. Atmospheric haze
in the interface plane. Floating particles.

## The scoring model

Six categories, ceiling **6.0 per day**. Teams only — there is no camper-level
scoring anywhere in this app.

| Category | Kind | Value |
|---|---|---|
| Cleanliness | binary | 0 or 1.0 |
| Punctuality | 7-step track | see below |
| Memory Verse | binary | 0 or 1.0 |
| Good Deed | binary | 0 or 1.0 |
| Lesson Knowledge | binary | 0 or 1.0 |
| Behavior | binary | 0 or 1.0 |

### Punctuality

Seven scored check-ins per day, each worth 0.1 — **except that all seven jumps to
1.0.** Resets each day; nothing carries over.

| Check-ins | 0 | 1 | 2 | 3 | 4 | 5 | 6 | **7** |
|---|---|---|---|---|---|---|---|---|
| Points | 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | **1.0** |

Missing the seventh costs **0.4**, not 0.1. Surface that tension: at 6/7 the
seventh socket is rimmed and pulsing and the readout previews `0.6 → 1.0`.

### Golden keys

**1.0 each, unlimited per day.** Every other category is capped, so every
disciplined team lands at 5.5–6.0 by Day 2 and the camp is decided on keys.
Treat the key as the most important object in the app, not a seventh cell.

**Keys are whole numbers and are never rendered as a multiplier.** No `×2`, and
under no circumstances `×1.5`. The count is read by counting lit keys; above
three, render three keys and a `+2` in tabular numerals. **There is no `×`
symbol anywhere in this app.**

### Integer tenths, always

Every score is an **integer number of tenths**. `0.1 + 0.2 === 0.30000000000000004`;
a big screen reading `5.6000000000000005` in front of the camp director ends the
project. Divide by 10 only when rendering, through `formatDeci` (integer math,
no float). `src/data/scoring.ts` holds the ladder and is unit-tested.

```ts
const PUNCTUALITY_DECI = [0, 1, 2, 3, 4, 5, 6, 10] as const // index = check-ins
```

## The roster

Eight teams, one pool, one champion. `shortName` is what appears on the board —
the full names don't fit at 390px.

| Full name | shortName | Token |
|---|---|---|
| Pink Junkyard Warriors | WARRIORS | `--color-team-warriors` |
| Precious Pieces | PRECIOUS | `--color-team-precious` |
| Hidden Gems | GEMS | `--color-team-gems` |
| God's Pearls | PEARLS | `--color-team-pearls` |
| Fire Knights | KNIGHTS | `--color-team-knights` |
| Innocent | INNOCENT | `--color-team-innocent` |
| Forged | FORGED | `--color-team-forged` |
| Rust Revival Co. | RUST CO. | `--color-team-rustco` |

## The five days

| index | name | date | theme |
|---|---|---|---|
| 0 | Arrival | 2026-08-19 | Creation — God's Perfect World Breaks |
| 1 | Day 1 | 2026-08-20 | Nation — God Makes Eternal Promises |
| 2 | Day 2 | 2026-08-21 | Kingdom — God Promises a Perfect Ruler |
| 3 | Day 3 | 2026-08-22 | Savior — God Sends His Perfect Sacrifice |
| 4 | Day 4 | 2026-08-23 | Redemption — God Promises a New Earth |

**Arrival does not score** — it is travel and settling in. It appears on the day
rail as a non-scoring day and contributes nothing to standings.

Each scoring day carries seven activities for punctuality:
`Morning exercise 8:30 · Breakfast 9:00 · Morning line up 9:45 · Lesson 10:15 ·
Lunch 13:00 · Dinner 17:30 · Evening service 19:30`

Roll call **auto-selects the activity nearest the current clock time**. Opening
it at 9:47 should already have "Morning line up · 9:45" chosen.

## Data model — append-only event log

Totals are always derived, never stored as primary state.

```
days        (id, index, name, theme, date, scored)
teams       (id, name, shortName, colorToken, order)
categories  (id, key, label, glyph, kind: 'binary'|'track'|'key', order)
activities  (id, dayId, time, label, scoresPunctuality)
score_events(id UUID, occurredAt, dayId, teamId, categoryId,
             deltaDeci INT, activityId?, note, actorId, deviceId,
             reversesEventId NULL, syncedAt)
```

- `id` is a **client-generated UUID** — offline retry is idempotent. Duplicate
  submission is a no-op, not a double award.
- Binary toggle off = append a compensating event (`reversesEventId` +
  `deltaDeci: -10`). **Never edit, never delete.**
- Punctuality check-in = append `deltaDeci: +1`. The day's punctuality value is a
  **pure function of the tick count** for that (day, team) —
  `PUNCTUALITY_DECI[min(ticks, 7)]`. Never store the computed value; if you do,
  the 0.6 → 1.0 jump becomes a special case instead of falling out for free.
- Golden key = append `deltaDeci: +10` against `golden_key`. Count keys by
  counting events.
- Undo and the activity feed are both views over the log.
- All data access goes through the `DataProvider` interface
  (`src/data/DataProvider.ts`); Phase 0 implementation is localStorage.
  **Zero storage calls in components.**

## Project layout

- `src/theme.css` — Tailwind v4 `@theme` tokens (the only place colors are defined)
- `src/data/` — types, `scoring.ts` (the integer-tenths core), DataProvider,
  LocalStorageDataProvider, derive, seed, React store
- `src/fx/` — Arc system (`Arc.tsx`, path generation)
- `src/components/` — award mechanics (Breaker, ChargeTrack, KeyRail), Lever,
  crests, shared chrome
- `src/screens/` — Board, RollCall, TeamSheet, KeyCeremony, Standings, BigScreen
- Routes (HashRouter): `/` board, `/call/:categoryId` roll call,
  `/team/:teamId` team sheet, `/key/:teamId` key ceremony, `/standings`,
  `/display` (16:9 big screen), `/lab` component bench

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck + production build (base `/junkyard-camp/`)
- `npm test` — unit tests (scoring ladder, totals, compensating events)
- `npm run shot -- <route> <outfile> [--viewport 390x844] [--dpr 3]` — Playwright
  screenshot; waits for fonts to load first
- `node scripts/validate-tokens.mjs` — computed-style token validation
