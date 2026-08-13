# Junkyard Redemption — SOL Kids Camp scoreboard

Team points scoreboard, mobile web app. Volunteers award points to campers; points
credit camper + team. Big screen shows live standings. Phase 0: UI-complete, mock
data, no auth, localStorage, GitHub Pages. Phase 1 (later) swaps the DataProvider
for Azure — never put storage calls in components.

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

--team-turquoise #2FD9D0
--team-crimson   #D9433F
--team-sunburst  #E0A33C
--team-lime      #7FB93F
--team-violet    #9B6DD1
--team-cobalt    #3D7ED9
```

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
- Escalation by screen: idle flicker on award-rest → full discharge on award-pulled →
  medallion crackle on confirmation → leading row only on standings → leading column
  only on big screen. Arcs everywhere flattens the hierarchy.

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

## Data model — append-only event log

Totals are always derived, never stored as primary state.

- `award_events` carry client-generated UUIDs (offline-retry idempotency).
- Corrections are compensating events (`reversesEventId` + negative points),
  never edits or deletes.
- All data access goes through the `DataProvider` interface
  (`src/data/DataProvider.ts`); Phase 0 implementation is localStorage.
  **Zero storage calls in components.**

## Project layout

- `src/theme.css` — Tailwind v4 `@theme` tokens (the only place colors are defined)
- `src/data/` — types, DataProvider, LocalStorageDataProvider, seed, React store
- `src/fx/` — Arc system (`Arc.tsx`, path generation)
- `src/components/` — Lever, panels, crests, shared chrome
- `src/screens/` — TeamSelect, Award, Confirmation, Standings, BigScreen
- Routes (HashRouter): `/` team select, `/award/:teamId`, `/confirm/:eventId`,
  `/standings`, `/display` (16:9 big screen)

## Commands

- `npm run dev` — dev server
- `npm run build` — typecheck + production build (base `/junkyard-camp/`)
- `npm run shot -- <route> <outfile> [--viewport 390x844] [--dpr 3]` — Playwright
  screenshot; waits for fonts to load first
