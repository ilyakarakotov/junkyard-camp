# Junkyard Redemption

Team points scoreboard for **SOL Kids Camp "Junkyard Redemption"** — a mobile web
app in the visual register of AAA console game UI (warm brown industrial salvage,
brass hardware, electrical arcs).

Volunteers award points to campers; points credit both the camper and their team.
A big-screen route shows live standings at the evening gathering.

## Screens

| Route | Screen |
| --- | --- |
| `/#/` | Team select — 2×3 grid of team plates, leader tagged with arcing contact posts |
| `/#/award/:teamId` | Award — camper chip multi-select + pull-down lever (+1 per pull) |
| `/#/confirm/:eventId` | Confirmation — medallion interstitial, 60s undo window |
| `/#/standings` | Standings — ranked rows with gauge tubes + recent activity |
| `/#/display` | Big screen — 16:9 vertical gauge columns, live-updating |

## Phase 0 (this build)

UI-complete, mock data, no auth. The append-only event log lives in
localStorage behind the `DataProvider` interface (`src/data/DataProvider.ts`).
Totals are always derived from the log; corrections are compensating events
(`reversesEventId` + negative points), never edits. Event ids are
client-generated UUIDs so offline retry is idempotent.

Phase 1 (later) swaps `LocalStorageDataProvider` for an Azure-backed
implementation — components never touch storage directly.

## Develop

```bash
npm install
npm run dev          # dev server at /junkyard-camp/
npm run build        # typecheck + production build
npm run shot -- '/#/standings' shots/standings.png   # Playwright screenshot
node scripts/validate-tokens.mjs                     # computed-style token audit
```

Design system and build rules live in [CLAUDE.md](CLAUDE.md). Reference concept
art is in `design/reference/`.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages
(Settings → Pages → Source must be "GitHub Actions"; the repo must be public on
a free plan).
