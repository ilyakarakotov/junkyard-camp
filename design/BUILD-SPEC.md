# Junkyard Redemption — Full Build Spec

> Recovered from the Kimi Code session's user history on 2026-08-17. This is
> the spec Phases 1–8 were built against; `§10` is the acceptance checklist
> and `§11` the final-report contract. Kept in the repo because it existed
> only in a terminal scrollback before this.


**Target model:** Kimi Code K3 Max
**Repo:** `https://github.com/ilyakarakotov/junkyard-camp` — branch from `claude/new-session-k83dh8` as `v2-app`
**Goal:** every screen built and working against a real Supabase backend, offline-tolerant, deployable to GitHub Pages as-is.

---
## HOW TO WORK

Build in the phases below, in order. Commit after each phase. Do not ask questions before starting — every decision you need is in this document. If something is genuinely ambiguous, pick the simplest option that satisfies the acceptance criteria and note it in your final report.

**Budget discipline:** function first. Match the existing design system faithfully, but do **not** run iterative screenshot-critique loops. One careful pass per screen against the reference art and the acceptance criteria is enough. Do not regenerate or redesign the visual system — it already exists and works.

---

## 1. WHAT THIS IS

A scoreboard for **SOL Kids Camp "Junkyard Redemption"** — a 5-day camp with 8 teams competing for points across 6 daily categories plus uncapped Golden Keys.

Helpers and directors score from their phones. A projector shows live standings at the evening service.
**The current repo scores individual campers in arbitrary amounts with totals in the thousands. That model is wrong and gets deleted entirely.**

---

## 2. THE SCORING MODEL — GET THIS EXACTLY RIGHT
### Six categories, base ceiling 6.0 per day

| Category | id | Kind | Value |
|---|---|---|---|
| Cleanliness | `cleanliness` | binary | 0 or 1.0 |
| Punctuality | `punctuality` | punctuality | ladder below |
| Memory Verse | `memory_verse` | binary | 0 or 1.0 |
| Good Deed | `good_deed` | binary | 0 or 1.0 |
| Lesson Knowledge | `lesson_knowledge` | binary | 0 or 1.0 |
| Behavior | `behavior` | binary | 0 or 1.0 |
| **Golden Key** | `golden_key` | key | **1.0 each, unlimited** |

### Punctuality — 7 check-ins, resets daily, and a cliff at the end

Seven scored check-ins per day, each worth **0.1** — **except that hitting all seven jumps the value to 1.0.** Resets to zero every day. Nothing carries over.

| Check-ins | 0 | 1 | 2 | 3 | 4 | 5 | 6 | **7** |
|---|---|---|---|---|---|---|---|---|
| Points | 0.0 | 0.1 | 0.2 | 0.3 | 0.4 | 0.5 | 0.6 | **1.0** |

**Missing the seventh check-in costs 0.4 points, not 0.1.** The UI must make that visible before it happens.

### Golden Keys — the uncapped breakout
Every other category is capped, so disciplined teams all cluster at 5.5–6.0 by Day 2. **The camp is decided on keys.** A team can earn 0, 1, 2 or more in a single day, which is the only way a day total exceeds 6.0.

### THE TRAP THAT WILL BREAK YOUR IMPLEMENTATION

`score_events.delta` means **different units per category kind**:

- `binary` and `key`: delta is **deci-points**, `+10` or `-10`
- `punctuality`: delta is **check-ins**, `+1` or `-1`, and the scored value is `PUNCTUALITY_DECI[clamp(sum, 0, 7)]` — **never the sum of deltas**

If you sum punctuality deltas as points you will render 0.7 where the answer is 1.0, and everything downstream will be wrong.

Put this in **one module, `src/scoring/scoring.ts`, and nowhere else.** Every screen, export and chart derives from these functions. Write the unit tests in this phase, before any UI.

```ts
export const PUNCTUALITY_DECI = [0, 1, 2, 3, 4, 5, 6, 10] as const
export const MAX_CHECKINS = 7
export const BINARY_DECI = 10
export const KEY_DECI = 10

/** All scores are integers in tenths of a point. Never use floats. */
export function formatDeci(deci: number): string {
  return `${Math.floor(deci / 10)}.${Math.abs(deci % 10)}`
}
```

**All arithmetic is integer tenths.** `0.1 + 0.2 === 0.30000000000000004` in JavaScript; a projector reading `5.6000000000000005` in front of the camp director ends the project. Divide by 10 only at the render boundary.

### Derivation rules — binary categories must clamp

Deriving a day total from the raw log is not a plain sum. With an offline outbox, retries and two helpers on two phones, the same category can legitimately receive two `+10` rows. **Clamp each binary category to `[0, 10]` before adding it to the total**, or a double-tap silently pays twice:

```ts
// per binary category: net the deltas, then clamp — never just sum
total += Math.min(Math.max(net, 0), BINARY_DECI)

// punctuality: clamp the CHECK-IN COUNT, then look up the ladder
total += PUNCTUALITY_DECI[Math.min(Math.max(ticks, 0), MAX_CHECKINS)]

// keys: floor at 0, deliberately no ceiling
total += Math.max(keySum, 0)
```

A reversal is a compensating row carrying `reverses_event_id`. When deriving, drop both the reversal row and the row it reverses. Verified against the log:

```
perfect base day                      6.0
6 of 7 check-ins                      5.6   +1 more -> 6.0   (a 0.4 jump)
perfect base + 3 keys                 9.0
award then reverse                    0.0
7/7 then undo one tick                0.6   (loses 0.4, not 0.1)
same binary category awarded twice    1.0   not 2.0
```

Required tests:

```
punctuality ladder      0..7 -> 0.0 0.1 0.2 0.3 0.4 0.5 0.6 1.0
missing the 7th costs   0.4
perfect base, no keys   6.0
perfect base + 2 keys   8.0
6 of 7 check-ins        5.6
reversal nets to zero   award then reverse -> 0.0
5-day base ceiling      30.0
```

---

## 3. ROSTER

Eight teams, one pool, one champion.

| Full name | short | id | Colour |
|---|---|---|---|
| Pink Junkyard Warriors | WARRIORS | `warriors` | `#FF5FB8` |
| Precious Pieces | PRECIOUS | `precious` | `#B14DFF` |
| Hidden Gems | GEMS | `gems` | `#3D9BFF` |
| God's Pearls | PEARLS | `pearls` | `#96F5B4` |
| Fire Knights | KNIGHTS | `knights` | `#FF4438` |
| Innocent | INNOCENT | `innocent` | `#FFD84D` |
| Forged | FORGED | `forged` | `#78D62E` |
| Rust Revival Co. | RUST CO. | `rustco` | `#FF9440` |

These are verified: all clear 4.5:1 contrast on `#16110D`, minimum pairwise separation 0.145 OKLab, none collides with brass, arc-teal or body text. **Do not adjust them by eye.**

Keep the existing default crest style — extend `TeamCrest.tsx` from 6 to 8 emblems. Engraved industrial marks, not cartoon icons.

## 4. THE FIVE DAYS

| idx | id | name | theme |
|---|---|---|---|
| 0 | `arrival` | Arrival | Creation — God's Perfect World Breaks |
| 1 | `day1` | Day 1 | Nation — God Makes Eternal Promises |
| 2 | `day2` | Day 2 | Kingdom — God Promises a Perfect Ruler |
| 3 | `day3` | Day 3 | Savior — God Sends His Perfect Sacrifice |
| 4 | `day4` | Day 4 | Redemption — God Promises a New Earth |

Seed `days.date` with placeholder consecutive dates and expose them in one config constant — the camp dates get set later with a single edit.

---

## 5. BACKEND — SUPABASE

Static client-side app on GitHub Pages talking directly to Supabase. No server to run.

### 5.1 Schema

Run this in the Supabase SQL editor. Include it in the repo at `supabase/schema.sql`.

```sql
create table teams (
  id text primary key,
  name text not null,
  short_name text not null,
  color text not null,
  sort_order int not null
);

create table days (
  id text primary key,
  idx int not null,
  name text not null,
  theme text not null,
  date date not null,
  scored boolean not null default true
);
create table categories (
  id text primary key,
  label text not null,
  kind text not null check (kind in ('binary','punctuality','key')),
  sort_order int not null
);

-- mirrors auth.users; role drives what a signed-in person may do
create table app_users (
id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'helper' check (role in ('helper','director')),
  is_active boolean not null default true
);

-- append-only. never UPDATE, never DELETE. corrections are compensating rows.
create table score_events (
  id uuid primary key,                      -- generated on the client
  occurred_at timestamptz not null default now(),
  day_id text not null references days(id),
  team_id text not null references teams(id),
  category_id text not null references categories(id),
  delta int not null,                       -- deci-points for binary/key, CHECK-INS for punctuality
  actor_id uuid not null references app_users(id),
  device_id text,
  reverses_event_id uuid references score_events(id),
  note text,
  created_at timestamptz not null default now()
);

create index on score_events (day_id, team_id);
create index on score_events (occurred_at desc);
```

### 5.2 The camp day boundary

Camp runs until lights out at 22:30, and someone may score at 23:50. **The day rolls over at 03:00 local, not midnight.** One constant, one SQL function:

```sql
-- set this to the camp's actual timezone
create or replace function camp_today() returns date language sql stable as $$
  select ((now() at time zone 'America/Los_Angeles') - interval '3 hours')::date;
$$;

create or replace function is_director() returns boolean language sql stable as $$
  select coalesce((select role = 'director' from app_users where id = auth.uid()), false);
$$;
```
Mirror the same 03:00 rule in TypeScript so the client and the database always agree on what "today" is.

### 5.3 Row-level security

Security is not critical here, but an anon key that lets anyone on the internet write to the scoreboard is an obvious flaw. Close it.

```sql
alter table teams        enable row level security;
alter table days         enable row level security;
alter table categories   enable row level security;
alter table app_users    enable row level security;
alter table score_events enable row level security;

create policy r_teams  on teams        for select to authenticated using (true);
create policy r_days   on days         for select to authenticated using (true);
create policy r_cats   on categories   for select to authenticated using (true);
create policy r_users  on app_users    for select to authenticated using (true);
create policy r_events on score_events for select to authenticated using (true);

-- you may only write as yourself, only for today, and only directors award keys
create policy w_events on score_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    (select date from days where id = day_id) = camp_today()
    or is_director()
  )
  and (category_id <> 'golden_key' or is_director())
);
-- deliberately no update and no delete policies: the log is append-only
```

### 5.4 Accounts

**Team leaders do not get accounts** — a leader scoring their own team is the one real integrity hole. Only helpers and directors sign in.

Two roles:
- `helper` — awards every category, for today or for any day already past (see backdating)
- `director` — additionally reaches days the camp has not got to yet

If everyone should have equal powers, that is a one-line change: seed every user as `director`. Build it so that works.

There is **no sign-up screen.** Accounts are seeded once by a script run locally:

`scripts/seed-users.mjs` — reads a local, git-ignored `users.json`, creates each Supabase auth user and its `app_users` row. Uses the service-role key from the environment. **The service-role key must never appear in client code or in the repo.**

```json
[
  { "username": "ilya", "password": "…", "display_name": "Ilya K.", "role": "director" },
  { "username": "anna", "password": "…", "display_name": "Anna P.", "role": "helper"   }
]
```

Usernames map to Supabase emails as `<username>@junkyard.camp`. The sign-in screen asks for **username and password only** and appends the domain itself — nobody types an email.

Commit `users.example.json` with fake values and gitignore the real one.

### 5.5 Session — sign in once for the whole camp

```ts
createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
})
```

Never sign out automatically. The only sign-out is the explicit menu item, behind a confirm.

### 5.6 Offline — the camp has spotty signal

The append-only log with client-generated UUIDs makes this straightforward. Do not skip it: a dead zone at morning line-up must not lose points or block a helper.

- Every award is written to an **IndexedDB outbox first**, and local state updates immediately and optimistically. The UI never waits on the network.
- A flusher drains the outbox via `upsert(rows, { onConflict: 'id', ignoreDuplicates: true })` — a duplicate submission is a no-op, never a double award.
- Flush triggers: on write, on `window.online`, and on a 15s interval while anything is pending.
- The full event list is cached in localStorage, so the app opens instantly and is fully readable offline.
- Persistent chrome shows `▲ 3 UNSYNCED` while the outbox is non-empty, and nothing at all when it is clear. **Never show a spinner that blocks scoring.**

### 5.7 Live updates

Subscribe to `postgres_changes` on `score_events` and merge inserts into local state. The projector dashboard must update within a second of an award, with no refresh and no polling.

---

## 6. SCREENS

### 6.0 Sign In
Username + password, full junkyard treatment. Persistent session, so this is seen once per person per camp. Clear error on bad credentials. Nothing else on this screen — no sign-up, no password reset.

### 6.1 Board — home / team select

The default screen after sign-in.

- **Day rail across the top:** five chips. Today is lit and active. Every other day shows a **padlock** and is view-only. Tapping a locked day opens it read-only with a banner: `DAY 1 · LOCKED — VIEW ONLY`. Anyone gets an `ADD POINTS` action on a **past** day behind a confirm naming its date; directors also get `UNLOCK` on a future one. While the day is open the banner is an amber warning band that stays visible on every screen that can score.
- **Eight team rows.** Each shows: crest, **full team name** (not the short name — there is room here), **today's points**, and **overall points**, clearly distinguished from each other. All zeros by default.
- Rows are sorted by overall points descending, with a rank numeral.
- **Menu button** top-left opens the menu (6.5).

### 6.2 Team Detail

Reached by tapping a team row.

**Header:** crest, full team name, and today's total. Show the total as visible arithmetic so keys are never hidden inside one number:

```
   5.6 / 6.0   +   2 KEYS   =   7.6
   base            breakout      TODAY
```

**Below it, every scoring item, each labelling its own point value:**

1. **Five charge cells** — Cleanliness, Memory Verse, Good Deed, Lesson Knowledge, Behavior. Each shows `1.0 PT`.
2. **Punctuality** — seven circles in a rail. Header shows `0.1 EACH · ALL 7 = 1.0` and a live readout `4 / 7 · 0.4`.
3. **Golden Keys** — a brass rail. Shows `1.0 PT EACH · NO LIMIT` and the current count.

#### These are NOT on/off switches

A light switch reads as a binary state. This is **points being delivered**, so every control uses the same electrical language as the rest of the app:

**Charge cell.** A recessed socket with a brass contact post at each side and the category's glyph engraved into its face. Unearned: dark engraved metal, glyph readable, a faint idle arc flickering between the posts. On award: the arc cracks across, the cell floods with the team's colour and spills light onto the surrounding metal. Earned: steady emissive fill with a slow breathe. Tapping again to remove: the arc collapses inward and the light drains out.

The unearned state is **visible engraved metal, never an empty hole** — you must be able to read what a team is missing as easily as what they have.

**Punctuality rail.** Seven sockets, same language, smaller. Circles 1–6 are identical and fill with the team colour. **The seventh is visibly a different object** — larger, heavy brass bezel, its own engraved mark — so the payoff is legible *before* it is reached. Sitting at 6/7 its rim pulses and the readout previews `0.6 → 1.0`. Completing it burns **white-hot with a gold corona**, distinct from both the team colour and the solid gold of the keys.

**Key rail.** Keys are *objects hanging from a rail*, not sockets in the panel — that shape difference is what keeps them distinct from everything else. Earned keys **emit** warm gold light onto the rail and surrounding metal; a dull outline reads as decoration, and these are points. Empty dark hooks sit beside them showing there is room for more. `+ KEY` plate to award. Visible to everyone, **enabled only for directors**; helpers see it greyed with a small `DIRECTOR` tag rather than hidden, so the mechanic is understood by all.

**Never render a key as a multiplier.** No `×2`, and never `×1.5`. A team holds one key, or two, or three — read by counting. There is no `×` symbol anywhere in this app.

**Locked days:** all controls visibly inert — recessed, desaturated, no idle arcs, no hover. It must be obvious at a glance that this day cannot be edited.

### 6.3 Quick Roll Call

Reached from the menu. Punctuality is called about 7× a day for all 8 teams; without this that is 56 trips through the team screen.

- Pick a category at the top.
- All eight teams as full-width rows, **each a 56px+ tap target where the whole plate is the hit area.**
- Multi-select, then **one commit action** applies to every selected team at once.
- Reuse the existing `Lever.tsx` as the commit control. Fix its travel (currently `TRAVEL = 118` down a `TRACK_H = 214` track, with the cylinder at `y = 154`): the grip starts at the **top** of the track and travels the **full length past the emitter** to seat at the base. Rest = grip above the emitter; fired = grip below it. Today it stops level with the cylinder, so "fired" looks identical to "at rest" with sparks added.
- Hold the grip seated through the commit beat before it returns.
- 60-second undo after commit.

### 6.4 Dashboard — `/display`

The projector screen for evening service. 16:9, landscape, readable from the back of a hall.

- **Live rankings, all 8 teams, by overall points.** Rank changes animate — teams physically move.
- Each team is a **column built of glowing bricks, one brick per point**, with a partial brick for the fraction. Countable across a room in a way a bare number is not.
- Golden keys hang on a brass rail above the columns that hold them.
- Header: day name and theme. Show both **today's** and **overall** totals.
- Arcs on the leading column only — arcs everywhere flattens the hierarchy.
- Updates live via realtime. No refresh, no interaction, no scrolling. Assume it is left open for two hours.

### 6.5 Menu

Board · Quick Roll Call · Dashboard · Exports & Analytics · Audit Log · Sign Out. Show the signed-in display name and role.

### 6.6 Exports & Analytics

**Excel export** — client-side with the `xlsx` package, no server:

- One sheet per day, laid out like the paper score sheet: teams down the left, categories across the top, punctuality as its 7 sub-columns, Golden Key count, day total
- A `Standings` sheet — overall totals, base vs keys split out, rank
- An `Audit` sheet — every event, one row each
- Also offer plain CSV of the raw event log

**Visual dashboards** — hand-rolled SVG using the existing design tokens. Do **not** add a charting library; it will fight the theme and cost more than it saves.

- Cumulative points by day, one line per team
- Category completion heatmap, teams × categories
- Punctuality: how many teams hit a perfect 7 each day
- Keys by team

### 6.7 Audit Log

Full accountability: **who gave what to whom, and when.**

- Reverse-chronological table: time, actor display name, team, category, value, and the resulting running total
- Reversals shown inline, with the original struck through rather than removed
- Filter by day, team, actor and category
- This is the reason the log is append-only — never add an edit or delete path

---

## 7. WHAT TO KEEP AND WHAT TO DELETE

**Keep as-is** — this is the expensive part and it works:

```
src/theme.css              design tokens + materials
src/fx/Arc.tsx             arc system
src/fx/arcPaths.ts
src/components/chrome.tsx  panel/bevel primitives
src/components/Lever.tsx   keep the composition, fix the travel (6.3)
scripts/*.mjs              Playwright + token validation tooling
```

**Extend:** `TeamCrest.tsx` from 6 crests to 8.

**Rewrite:** `src/data/*` and every file in `src/screens/`.

**Delete outright:** the entire camper layer — the `Camper` type, `CAMPERS`, `ROSTER`, `camperTotals()`, and the camper chip grid in `Award.tsx`. There is no camper-level scoring.

Keep `DataProvider` as the storage seam and put the Supabase + outbox implementation behind it. **Zero storage calls in components** — this is the most important structural rule in the codebase and it is already right.

---

## 8. DESIGN SYSTEM — NON-NEGOTIABLE

Already defined in `CLAUDE.md` and `theme.css`. The essentials:

```
--bg #16110D   --panel #241C16   --panel-raised #2E241C   --bevel #4A3B2E
--brass #C08A3E   --rust #8A5230   --accent #2FD9D0 (teal)   --text #EDE3D2
```

- The interface reads **warm and brown** — aged brass and oxidised steel. **If a screen reads silver, chrome or blue-grey, it is wrong.**
- One consistent **top-left key light** on every screen. Inconsistent light direction is the single biggest tell that something was generated rather than designed.
- **Every glow is a real emitting source** — a lit tube, an emissive fill, a backlit chip — with tight physical falloff. Never glow as decoration.
- **Every arc terminates on two visible brass contact posts.** An arc ending on nothing reads as decoration; an arc jumping a gap reads as current.
- Arc flicker runs at **8–12fps**, not 60. Real arcs are stochastic and stuttery; smooth arc motion looks fake.
- Heavy condensed uppercase display type, tabular numerals, right-aligned on a shared column edge. **Ban Inter, ban system-ui.**
- Strict 8px grid, uniform radii, identical row heights in any list.
- Animate `transform` and `opacity` only. Honour `prefers-reduced-motion`: keep state changes, drop arcs and motion.
- **Forbidden:** purple gradients, glassmorphism, generic card grids, emoji icons, Tailwind defaults, filigree, depth-of-field blur, lens flare, atmospheric haze, floating particles.

**The one deliberate exception:** Golden Key moments use gold-white light and no teal at all. Breaking the rule exactly once is what makes the rare thing feel rare — so hold it everywhere else.

**Reference art is optional.** If `design/reference/v2/*.jpg` is present in the repo, treat it as a **taste target, not a pixel target** — match materials, hierarchy, proportion and mood, and deviate wherever a real interface demands it for tap targets, safe areas and legibility. **If those files are not present, do not look for them and do not block** — the written specification above is complete, and the existing `theme.css`, `chrome.tsx`, `Arc.tsx` and `Lever.tsx` in the repo already encode the visual language you need.

---

## 9. BUILD ORDER

1. **Scoring core.** `scoring.ts` + unit tests from §2. Nothing else until these pass.
2. **Supabase.** Schema, RLS, seed data for teams/days/categories, `seed-users.mjs`, typed client.
3. **Data layer.** `DataProvider` over Supabase + IndexedDB outbox + localStorage cache + realtime. Test it offline: airplane mode, award points, reconnect, confirm exactly one row lands.
4. **Auth.** Sign-in screen, session persistence, role context, route guards.
5. **Controls.** Charge cell, punctuality rail, key rail, and the Lever travel fix — in isolation on the existing `/lab` route.
6. **Screens.** Board → Team Detail → Quick Roll Call → Dashboard.
7. **Menu screens.** Exports, analytics, audit log.
8. **Deploy.** Existing GitHub Pages workflow. `base: "/junkyard-camp/"`, `HashRouter`. Supabase URL and anon key via Vite env vars — the anon key is safe to ship, the service-role key is not.

---

## 10. ACCEPTANCE CRITERIA
- [ ] Punctuality ladder tested, including the 6→7 jump from 0.6 to 1.0
- [ ] All scoring is integer tenths — no float arithmetic anywhere in the scoring path
- [ ] Punctuality deltas are check-ins, never summed as points
- [ ] Binary categories clamp to [0,10] — awarding the same one twice yields 1.0, not 2.0
- [ ] Reversals drop both rows when deriving; 7/7 then undo one tick yields 0.6
- [ ] Golden keys uncapped; a day total above 6.0 is reachable and renders correctly
- [ ] No `×` multiplier anywhere; key counts are whole numbers
- [ ] Punctuality rail is six plain circles **plus a visibly distinct seventh**
- [ ] Every scoring control uses the electrical/charge language — no toggle switches
- [ ] Every control states its point value on screen
- [ ] Only today is editable until a day is reopened; every other day is visibly locked
- [ ] Anyone can reopen a **past** day to add points, and cannot do so without confirming a warning that names its date
- [ ] The warning stays on screen — board, team sheet and roll call — for as long as that day is open
- [ ] A future day stays locked to everyone but a director
- [ ] Helpers cannot award Golden Keys, enforced in RLS and not only in the UI
- [ ] Sign-in persists across app restarts for the length of the camp
- [ ] Airplane-mode test: award offline, reconnect, exactly one row lands, no duplicates
- [ ] Unsynced count is visible and scoring is never blocked by the network
- [ ] Dashboard updates live within ~1s of an award on another device
- [ ] Lever rest and fired states are unmistakably different
- [ ] Excel export opens in Excel with one sheet per day matching the paper layout
- [ ] Audit log shows who awarded what, when, with reversals visible
- [ ] Every screen reads warm brown with consistent top-left key light
- [ ] Service-role key appears nowhere in the repo or client bundle
- [ ] Deployed, live URL verified, `/`, `/#/display` and sign-in all load

---

## 11. FINAL REPORT

Give me: the live URL, what you decided on my behalf, anything that did not reach the quality bar, and the exact steps I still need to do myself — Supabase project creation, env vars, running the user seed script. Do not tell me it is perfect. Tell me what is weakest.