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
| `/#/signin` | Sign in — username and password, once per camp |
| `/` | Board — the day at a glance, read-and-navigate only |
| `/#/menu` | Menu hub — everything below, plus sign out |
| `/#/call/:categoryId` | Roll call — toggle eight teams, pull once to commit |
| `/#/team/:teamId` | Team sheet — corrections, `base + keys = total` |
| `/#/key/:teamId` | Golden key ceremony (director mode only) |
| `/#/standings` | Cumulative, base and key points separated |
| `/#/display` | Big screen, 16:9 |
| `/#/exports` | Excel workbook, raw CSV, and four charts |
| `/#/audit` | Who awarded what, when, reversals struck through |
| `/#/lab` | Component bench |

## Commands

```
npm run dev                 dev server
npm run build               typecheck + production build
npm test                    scoring unit tests
npm run verify                 the whole gate: tests, build, and every check below
npm run shot -- <route> <out> [--viewport 390x844] [--dpr 3] [--scroll N] [--set k=v]
node scripts/validate-tokens.mjs   computed-style tokens, contrast, OKLab separation
node scripts/check-material.mjs    material statistics against the concept art
node scripts/check-motion.mjs      asserts only transform/opacity animate
node scripts/check-dod.mjs         layout, tap targets, reduced motion
node scripts/check-acceptance.mjs  the spec's acceptance criteria, in a browser
node scripts/check-commit-flow.mjs award, undo, and the log stays append-only
node scripts/drag-shot.mjs         lever stroke frames
```

Every gate that opens a browser needs `npm run dev` already running on `:5173`.

## Architecture

Every screen runs against a shared Supabase backend (offline-tolerant, with a
localStorage mirror and an outbox). With no backend configured the app runs
local-only — same code path, no sync.

- Totals are **always derived** from an append-only event log; nothing computed
  is stored.
- Corrections are compensating events (`reversesEventId` + negative delta) —
  never an edit, never a delete.
- Event ids are client-generated UUIDs, so an offline retry is idempotent.
- Awards land in an **IndexedDB outbox** first (`src/data/outbox.ts`) and the UI
  updates optimistically, so a dead zone at morning line-up never blocks a
  helper or loses a point.
- All storage goes through `src/data/DataProvider.ts`. **Zero storage calls in
  components.** `src/data/provider.ts` picks the backend.
- Who may do what lives in `src/data/auth.tsx`, and is enforced again in RLS —
  the UI gating is a courtesy, the policy is the boundary.

## Backend (Supabase)

Five tables: `teams`, `days`, `categories` (fixed camp data, seeded by the
schema), `app_users` (who may score, and as what), and the append-only
`score_events` log. Everything else is derived.

Setup, start to finish — four steps, about ten minutes:

1. Create a free project at [supabase.com](https://supabase.com).
2. In its SQL editor, run `supabase/schema.sql`. One file: tables, row-level
   security, the realtime publication, and the roster/day/category seed rows.
3. **Create the accounts.** There is no sign-up screen — accounts exist only
   because this script ran:

   ```sh
   cp users.example.json users.json      # then fill in real names/passwords
   SUPABASE_URL=https://<project>.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key> \
     node scripts/seed-users.mjs
   ```

   `users.json` is git-ignored. The **service-role key is used here only**, on
   your machine, from the environment — it bypasses row-level security and must
   never reach the repo or the client bundle.

   Roles: `helper` awards the six normal categories for today; `director` also
   awards Golden Keys and can unlock a past day. Want everyone equal? Seed every
   user as `director`.

4. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
   Copy `.env.example` to `.env` for local dev; for the Pages build set the same
   two names under repo **Settings → Secrets and variables → Actions** (URL as a
   variable, anon key as a secret). The deploy workflow bakes them in at build
   time.

Team leaders never sign in — a leader scoring their own team is the one real
integrity hole, so only helpers and directors get accounts.

The anon key is safe to ship in the client: RLS allows reading and appending
events, and nothing else — no updates, no deletes, and only a director may
append a Golden Key.

Without these variables the app builds and runs in local-only mode as a local
director: scores stay on the device and nothing syncs. That is the mode every
screenshot gate runs in. Add `?as=helper` to any URL in local mode to see the
app as a helper sees it.

**Offline tolerance.** The UI always reads a local mirror, so every screen
works with the network down. Awards made offline queue locally (the board
footer shows the pending count), sync automatically when the network returns,
and can't double-award — retries reuse the same client-generated event id.
Other leaders' awards arrive live over a realtime subscription.

See `CLAUDE.md` for the design system and the full data model.
