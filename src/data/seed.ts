import type { Category, Day, ScoreEvent, Team, TeamId } from './types'
import { campToday, campTodayCandidates } from './campday'

/**
 * Eight teams, one pool, one champion. Hexes mirror theme.css and are
 * machine-verified: all clear 4.5:1 on #16110D, minimum pairwise separation
 * 0.145 OKLab, none collides with brass, arc-teal or body text.
 * Re-run scripts/validate-tokens.mjs rather than nudging one by eye.
 *
 * `leader` is the team's human leader off the camp's program sheet, in English
 * transliteration. It rides with the roster because it is fixed camp data — no
 * table, no event, nothing to sync.
 */
export const TEAMS: Team[] = [
  { id: 'warriors', name: 'Pink Junkyard Warriors', shortName: 'WARRIORS', leader: 'Ira', colorToken: 'warriors', order: 0 },
  { id: 'precious', name: 'Precious Pieces', shortName: 'PRECIOUS', leader: 'Vika', colorToken: 'precious', order: 1 },
  { id: 'gems', name: 'Hidden Gems', shortName: 'GEMS', leader: 'Tanya', colorToken: 'gems', order: 2 },
  { id: 'pearls', name: "God's Pearls", shortName: 'PEARLS', leader: 'Anzhela', colorToken: 'pearls', order: 3 },
  { id: 'knights', name: 'Fire Knights', shortName: 'KNIGHTS', leader: 'Egor', colorToken: 'knights', order: 4 },
  { id: 'innocent', name: 'Innocent', shortName: 'INNOCENT', leader: 'Dima', colorToken: 'innocent', order: 5 },
  { id: 'forged', name: 'Forged', shortName: 'FORGED', leader: 'Vova', colorToken: 'forged', order: 6 },
  { id: 'rustco', name: 'Rust Revival Co.', shortName: 'RUST CO.', leader: 'Vlad', colorToken: 'rustco', order: 7 },
]

/**
 * Six scored categories plus the key. `glyph` is the engraved abbreviation on
 * the board column header — the physical object underneath carries the meaning,
 * so these stay terse. The database spells the middle kind `punctuality`
 * (supabase/schema.sql); the app's `CategoryKind` calls the same object
 * `track` — the row mapper translates, the UI never sees the difference.
 */
export const CATEGORIES: Category[] = [
  { id: 'cleanliness', key: 'cleanliness', label: 'Cleanliness', glyph: 'CLN', kind: 'binary', order: 0 },
  { id: 'punctuality', key: 'punctuality', label: 'Punctuality', glyph: 'PNC', kind: 'track', order: 1 },
  { id: 'memory_verse', key: 'memory_verse', label: 'Memory Verse', glyph: 'VRS', kind: 'binary', order: 2 },
  { id: 'good_deed', key: 'good_deed', label: 'Good Deed', glyph: 'DEED', kind: 'binary', order: 3 },
  { id: 'lesson_knowledge', key: 'lesson_knowledge', label: 'Lesson Knowledge', glyph: 'LSN', kind: 'binary', order: 4 },
  { id: 'behavior', key: 'behavior', label: 'Behavior', glyph: 'BHV', kind: 'binary', order: 5 },
  { id: 'golden_key', key: 'golden_key', label: 'Golden Key', glyph: 'KEY', kind: 'key', order: 6 },
]

/**
 * The five days. Dates are placeholder consecutive dates — set the real camp
 * dates here and in supabase/schema.sql with a single edit each. Arrival is
 * travel and settling in — it carries no score.
 */
export const DAYS: Day[] = [
  { id: 'arrival', index: 0, name: 'Arrival', theme: "Creation — God's Perfect World Breaks", date: '2026-08-19', scored: false },
  { id: 'day1', index: 1, name: 'Day 1', theme: 'Nation — God Makes Eternal Promises', date: '2026-08-20', scored: true },
  { id: 'day2', index: 2, name: 'Day 2', theme: 'Kingdom — God Promises a Perfect Ruler', date: '2026-08-21', scored: true },
  { id: 'day3', index: 3, name: 'Day 3', theme: 'Savior — God Sends His Perfect Sacrifice', date: '2026-08-22', scored: true },
  { id: 'day4', index: 4, name: 'Day 4', theme: 'Redemption — God Promises a New Earth', date: '2026-08-23', scored: true },
]

/**
 * Which day the rail opens on. During camp that is the camp day (03:00
 * rollover, see campday.ts); before camp the first scoring day (so the board
 * is never blank on Arrival), after camp the last day.
 */
export function resolveActiveDay(days: Day[], now: Date): Day {
  const candidates = campTodayCandidates(now)
  // A scoring day wins the tie: when the camp-timezone reading and the phone's
  // own reading straddle a boundary, the one a leader can actually score on is
  // the one to open.
  for (const today of candidates) {
    const scoring = days.find((d) => d.date === today && d.scored)
    if (scoring) return scoring
  }
  for (const today of candidates) {
    const exact = days.find((d) => d.date === today)
    if (exact) return exact
  }
  const today = candidates[0]
  const scored = days.filter((d) => d.scored)
  if (today < days[0].date) return scored[0]
  if (today > days[days.length - 1].date) return scored[scored.length - 1]
  // Mid-camp with no exact match (shouldn't happen) — nearest scoring day.
  return scored.find((d) => d.date >= today) ?? scored[scored.length - 1]
}

/**
 * The one day that accepts writes without a director's unlock, resolved from
 * the fixed camp calendar. Shared by the store and by `isToday` so a screen and
 * the guard behind it can never disagree about which day is open.
 *
 * Two rules beyond "the date matches":
 *
 *  - **A non-scoring today falls forward.** Arrival scores nothing, so an
 *    exact match on it used to resolve to `null` and every control in the app
 *    went inert for a whole day. The next scoring day stands in instead, the
 *    same way the first one stands in before camp opens.
 *  - **Either reading of "today" counts** (see campTodayCandidates): the camp
 *    timezone constant is only right for a camp held in that zone, and being
 *    wrong about it padlocks the day on its own date.
 *
 * After the last camp day nothing is editable — a director unlock is the only
 * way back in, which is the point of the lock.
 */
export function resolveEditableDayId(days: Day[], now: Date = new Date()): string | null {
  if (days.length === 0) return null
  const candidates = campTodayCandidates(now)
  for (const today of candidates) {
    const exact = days.find((d) => d.date === today)
    if (exact?.scored) return exact.id
  }
  const earliest = candidates.reduce((a, b) => (a < b ? a : b))
  if (earliest > days[days.length - 1].date) return null
  return days.find((d) => d.scored && d.date >= earliest)?.id ?? null
}

/**
 * Only today is editable; every other day is view-only. Directors may unlock
 * a day per device to fix a mistake (the RLS policy permits director inserts
 * into any day) — the unlock itself is UI state, never a data change.
 */
export function isToday(day: Day, now: Date = new Date()): boolean {
  return day.date === campToday(now)
}

// ---------------------------------------------------------------------------
// Mock camp state, local-only mode only — the backed app starts from real
// events ("all zeros by default") and SupabaseDataProvider drops these on
// first start. Hand-authored rather than random so screenshots are byte-stable
// and the board demonstrates the cases that matter: a team sitting on the
// 6/7 cliff, a team missing a visible category, and a leader who is ahead on
// KEYS while trailing on base points.
// ---------------------------------------------------------------------------

type DayPlan = {
  dayId: string
  rows: { team: TeamId; binaries: string[]; ticks: number; keys: number }[]
}

const ALL5 = ['cleanliness', 'memory_verse', 'good_deed', 'lesson_knowledge', 'behavior']
const without = (...drop: string[]) => ALL5.filter((c) => !drop.includes(c))

const PLANS: DayPlan[] = [
  {
    dayId: 'day1',
    rows: [
      { team: 'warriors', binaries: ALL5, ticks: 7, keys: 1 },
      { team: 'precious', binaries: ALL5, ticks: 6, keys: 1 },
      { team: 'gems', binaries: without('good_deed'), ticks: 7, keys: 1 },
      { team: 'pearls', binaries: without('lesson_knowledge'), ticks: 5, keys: 0 },
      { team: 'knights', binaries: without('memory_verse'), ticks: 6, keys: 1 },
      { team: 'innocent', binaries: without('behavior'), ticks: 4, keys: 0 },
      { team: 'forged', binaries: ALL5, ticks: 7, keys: 0 },
      { team: 'rustco', binaries: without('cleanliness'), ticks: 3, keys: 0 },
    ],
  },
  {
    dayId: 'day2',
    rows: [
      { team: 'warriors', binaries: ALL5, ticks: 7, keys: 0 },
      { team: 'precious', binaries: ALL5, ticks: 7, keys: 2 },
      { team: 'gems', binaries: without('behavior'), ticks: 6, keys: 0 },
      { team: 'pearls', binaries: ALL5, ticks: 7, keys: 1 },
      { team: 'knights', binaries: ALL5, ticks: 6, keys: 0 },
      { team: 'innocent', binaries: without('cleanliness'), ticks: 7, keys: 1 },
      { team: 'forged', binaries: ALL5, ticks: 7, keys: 1 },
      { team: 'rustco', binaries: without('lesson_knowledge'), ticks: 5, keys: 0 },
    ],
  },
  {
    // Day 3 is mid-morning: cleanliness done at inspection, three check-ins in.
    dayId: 'day3',
    rows: [
      { team: 'warriors', binaries: ['cleanliness'], ticks: 3, keys: 0 },
      { team: 'precious', binaries: ['cleanliness'], ticks: 3, keys: 0 },
      { team: 'gems', binaries: ['cleanliness'], ticks: 2, keys: 0 },
      { team: 'pearls', binaries: ['cleanliness'], ticks: 3, keys: 0 },
      { team: 'knights', binaries: [], ticks: 3, keys: 0 },
      { team: 'innocent', binaries: ['cleanliness'], ticks: 3, keys: 0 },
      { team: 'forged', binaries: ['cleanliness', 'memory_verse'], ticks: 3, keys: 0 },
      { team: 'rustco', binaries: [], ticks: 2, keys: 0 },
    ],
  },
]

/**
 * Seed events carry stable synthetic ids rather than random UUIDs so a
 * re-seed is idempotent and screenshots do not churn. Runtime events use
 * crypto.randomUUID().
 */
export function seedEvents(deviceId: string): ScoreEvent[] {
  const events: ScoreEvent[] = []
  const actorId = 'leader-seed'

  for (const plan of PLANS) {
    const day = DAYS.find((d) => d.id === plan.dayId)!
    const stamp = (minutes: number) =>
      `${day.date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00.000Z`

    for (const row of plan.rows) {
      for (const cat of row.binaries) {
        events.push({
          id: `seed-${day.id}-${row.team}-${cat}`,
          occurredAt: stamp(11 * 60),
          dayId: day.id,
          teamId: row.team,
          categoryId: cat as ScoreEvent['categoryId'],
          deltaDeci: 10,
          note: null,
          actorId,
          deviceId,
          reversesEventId: null,
          syncedAt: null,
        })
      }
      // Punctuality check-ins are ordinal ticks, an hour apart from 08:30.
      for (let i = 0; i < row.ticks; i++) {
        events.push({
          id: `seed-${day.id}-${row.team}-punct-${i}`,
          occurredAt: stamp(8 * 60 + 30 + i * 60),
          dayId: day.id,
          teamId: row.team,
          categoryId: 'punctuality',
          deltaDeci: 1,
          note: null,
          actorId,
          deviceId,
          reversesEventId: null,
          syncedAt: null,
        })
      }
      for (let k = 0; k < row.keys; k++) {
        events.push({
          id: `seed-${day.id}-${row.team}-key-${k}`,
          occurredAt: stamp(20 * 60 + 15),
          dayId: day.id,
          teamId: row.team,
          categoryId: 'golden_key',
          deltaDeci: 10,
          note: 'Evening gathering',
          actorId,
          deviceId,
          reversesEventId: null,
          syncedAt: null,
        })
      }
    }
  }

  return events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
}
