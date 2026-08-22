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
npm run dev                 dev server (backed, if .env is set)
npm run dev:gates           dev server forced into local mode, for the gates
npm run build               typecheck + production build
npm test                    scoring unit tests
npm run verify              the whole gate: tests, build, and every check below
npm run check:backend       the live backend: sign-in, sync, realtime, offline
npm run shot -- <route> <out> [--viewport 390x844] [--dpr 3] [--scroll N] [--set k=v]
node scripts/validate-tokens.mjs   computed-style tokens, contrast, OKLab separation
node scripts/check-material.mjs    material statistics against the concept art
node scripts/check-motion.mjs      asserts only transform/opacity animate
node scripts/check-dod.mjs         layout, tap targets, reduced motion
node scripts/check-console.mjs     every route mounts with no warning or error
node scripts/check-acceptance.mjs  the spec's acceptance criteria, in a browser
node scripts/check-commit-flow.mjs award, undo, and the log stays append-only
node scripts/drag-shot.mjs         lever stroke frames
```

Every gate that opens a browser needs a dev server already running on `:5173`.
Use `npm run dev:gates` for all of them except `check:backend`, which needs the
real thing.

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
   because someone seeded them. Edit the `VALUES` list in
   `supabase/add-users.sql` and run it in the SQL editor.

   Re-running it is safe: an existing username keeps its id (so its past awards
   stay attributed) and has its password, name and role updated.

   There is also `scripts/seed-users.mjs`, which does the same through the Auth
   admin API with a service-role key from the environment. Prefer the SQL file:
   Supabase's email validator rejects the `@junkyard.camp` domain on at least
   some projects, and the SQL path sidesteps it. Either way the **service-role
   key must never reach the repo or the client bundle**.

   Roles: every active account awards all six categories and Golden Keys, for
   today and for any day already past — a missed award is put right by
   reopening that day, behind a warning naming its date. A `director`
   additionally reaches days the camp has not got to yet. Want everyone equal?
   Make every role `director`.

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
director: scores stay on the device and nothing syncs. Add `?as=helper` to any
URL in local mode to see the app as a helper sees it.

**Running the gates once a backend is configured.** Every screenshot gate scores
against seeded local data and never signs in, so a real `.env` sends them all to
`/signin`. Start the server with `npm run dev:gates` instead of `npm run dev` —
`.env.gates` blanks the two variables for that run.

**Checking the backend itself** needs credentials, so it is a separate gate and
takes them from the environment:

```sh
JR_DIRECTOR=ilya:<password> JR_HELPER=helper:<password> npm run check:backend
```

It signs in through the real screen, proves an award reaches Postgres, times how
long realtime takes to reach a second open screen, and runs the airplane-mode
round trip — offline award, reconnect, exactly one row, and a second flush that
does nothing. It tags everything it writes with `device_id = 'backend-gate'` and
prints how many rows to sweep afterwards:

```sql
delete from score_events where device_id = 'backend-gate';
```

**Offline tolerance.** The UI always reads a local mirror, so every screen
works with the network down. Awards made offline queue locally (the board
footer shows the pending count), sync automatically when the network returns,
and can't double-award — retries reuse the same client-generated event id.
Other leaders' awards arrive live over a realtime subscription.

**When sync fails anyway** — `#/sync`, reachable from the menu and from the
corner badge. A phone with signal can still be unable to write: an expired
session, an award recorded under a different account, a day the server has
closed. Postgres fails a whole statement over one bad row, so a batch that
comes back refused is re-sent one award at a time — the good ones land, and
only the row the server objects to is held back, with the reason it gave.
The sync screen reads that reason out, says what to do about it, and forces a
full retry (held awards included) on demand.

Almost every refusal that is not about the award itself comes down to
`actor_id` — RLS is `actor_id = auth.uid()`, so an award recorded under
another account, or before anyone signed in, is refused for good. Rather than
strand a point a team earned, **force sync re-sends a still-refused award
credited to whoever pressed the button**, and marks it recovered in the note
so the audit log shows the swap. Only that one field is ever rewritten; the
day, team, category, value, id and timestamp are untouched, and the honest row
is always tried first. `reversesEventId` is never rewritten — `liveEvents`
reads it in both directions, so stripping it to dodge a foreign key would turn
an undo into a live event and re-award the category it was undoing.

A held award is never discarded: it stays in the outbox and keeps counting on
that phone's board until the server takes it.

See `CLAUDE.md` for the design system and the full data model.
