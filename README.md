# Junkyard Redemption

Team points scoreboard for SOL Kids Camp. Leadership awards points to eight
teams across six categories per day; a big screen shows live standings at the
evening gathering.

**Live:** https://ilyakarakotov.github.io/junkyard-camp/

## Scoring

Six categories, ceiling **6.0 per day**. Teams only — there is no camper-level
scoring.

| Category | Kind | Value |
|---|---|---|
| Cleanliness | binary | 0 or 1.0 |
| Punctuality | 7-step track | 0.1 per check-in, but all seven jumps to **1.0** |
| Memory Verse | binary | 0 or 1.0 |
| Good Deed | binary | 0 or 1.0 |
| Lesson Knowledge | binary | 0 or 1.0 |
| Behavior | binary | 0 or 1.0 |

Missing the seventh check-in costs **0.4**, not 0.1 — the UI previews
`0.6 → 1.0` at 6/7 so the cliff is visible before you fall off it.

**Golden keys are 1.0 each and uncapped.** Every other category is capped, so
disciplined teams converge at 5.5–6.0 and the camp is decided on keys.

Every score is stored as an **integer number of tenths**. Floats never enter
the scoring path.

## Camp

Arrival is Wed 19 Aug and does not score. Day 1 (20 Aug) through Day 4
(23 Aug) each carry seven punctuality check-ins. Roll call auto-selects the
activity nearest the current clock time.

## Routes

`HashRouter`, served from `/junkyard-camp/`.

| Route | Screen |
|---|---|
| `/` | Board — the day at a glance, read-and-navigate only |
| `/#/call/:categoryId` | Roll call — toggle eight teams, pull once to commit |
| `/#/team/:teamId` | Team sheet — corrections, `base + keys = total` |
| `/#/key/:teamId` | Golden key ceremony (director mode only) |
| `/#/standings` | Cumulative, base and key points separated |
| `/#/display` | Big screen, 16:9 |
| `/#/lab` | Component bench |

## Commands

```
npm run dev                 dev server
npm run build               typecheck + production build
npm test                    scoring unit tests
npm run shot -- <route> <out> [--viewport 390x844] [--dpr 3] [--scroll N] [--set k=v]
node scripts/validate-tokens.mjs   computed-style tokens, contrast, OKLab separation
node scripts/check-motion.mjs      asserts only transform/opacity animate
node scripts/check-dod.mjs         layout, tap targets, reduced motion
node scripts/drag-shot.mjs         lever stroke frames
```

## Architecture

Phase 0 is UI-complete on mock data in localStorage. Phase 1 swaps the
`DataProvider` for a shared backend so several leaders can score at once.

- Totals are **always derived** from an append-only event log; nothing computed
  is stored.
- Corrections are compensating events (`reversesEventId` + negative delta) —
  never an edit, never a delete.
- Event ids are client-generated UUIDs, so an offline retry is idempotent.
- All storage goes through `src/data/DataProvider.ts`. **Zero storage calls in
  components.**

See `CLAUDE.md` for the design system and the full data model.
