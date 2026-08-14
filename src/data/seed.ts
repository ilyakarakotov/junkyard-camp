import type { Activity, Category, Day, ScoreEvent, Team, TeamId } from './types'

/**
 * Eight teams, one pool, one champion. Hexes mirror theme.css and are
 * machine-verified: all clear 4.5:1 on #16110D, minimum pairwise separation
 * 0.145 OKLab, none collides with brass, arc-teal or body text.
 * Re-run scripts/validate-tokens.mjs rather than nudging one by eye.
 */
export const TEAMS: Team[] = [
  { id: 'warriors', name: 'Pink Junkyard Warriors', shortName: 'WARRIORS', colorToken: 'warriors', order: 0 },
  { id: 'precious', name: 'Precious Pieces', shortName: 'PRECIOUS', colorToken: 'precious', order: 1 },
  { id: 'gems', name: 'Hidden Gems', shortName: 'GEMS', colorToken: 'gems', order: 2 },
  { id: 'pearls', name: "God's Pearls", shortName: 'PEARLS', colorToken: 'pearls', order: 3 },
  { id: 'knights', name: 'Fire Knights', shortName: 'KNIGHTS', colorToken: 'knights', order: 4 },
  { id: 'innocent', name: 'Innocent', shortName: 'INNOCENT', colorToken: 'innocent', order: 5 },
  { id: 'forged', name: 'Forged', shortName: 'FORGED', colorToken: 'forged', order: 6 },
  { id: 'rustco', name: 'Rust Revival Co.', shortName: 'RUST CO.', colorToken: 'rustco', order: 7 },
]

/**
 * Six scored categories plus the key. `glyph` is the engraved abbreviation on
 * the board column header — the physical object underneath carries the meaning,
 * so these stay terse.
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
 * Camp runs Wed 19 Aug (Arrival, travel and settling in — no scoring) through
 * Sun 23 Aug. Day 1 is the first full day.
 */
export const DAYS: Day[] = [
  { id: 'day-0', index: 0, name: 'Arrival', theme: "Creation — God's Perfect World Breaks", date: '2026-08-19', scored: false },
  { id: 'day-1', index: 1, name: 'Day 1', theme: 'Nation — God Makes Eternal Promises', date: '2026-08-20', scored: true },
  { id: 'day-2', index: 2, name: 'Day 2', theme: 'Kingdom — God Promises a Perfect Ruler', date: '2026-08-21', scored: true },
  { id: 'day-3', index: 3, name: 'Day 3', theme: 'Savior — God Sends His Perfect Sacrifice', date: '2026-08-22', scored: true },
  { id: 'day-4', index: 4, name: 'Day 4', theme: 'Redemption — God Promises a New Earth', date: '2026-08-23', scored: true },
]

/** The seven scored check-ins on a full day. */
const FULL_DAY_ACTIVITIES: { time: string; label: string }[] = [
  { time: '08:30', label: 'Morning exercise' },
  { time: '09:00', label: 'Breakfast' },
  { time: '09:45', label: 'Morning line up' },
  { time: '10:15', label: 'Lesson' },
  { time: '13:00', label: 'Lunch' },
  { time: '17:30', label: 'Dinner' },
  { time: '19:30', label: 'Evening service' },
]

/** Arrival runs on its own shape and none of it scores. */
const ARRIVAL_ACTIVITIES: { time: string; label: string }[] = [
  { time: '14:00', label: 'Registration' },
  { time: '17:30', label: 'Dinner' },
  { time: '19:30', label: 'Opening service' },
]

export const ACTIVITIES: Activity[] = DAYS.flatMap((day) => {
  const rows = day.scored ? FULL_DAY_ACTIVITIES : ARRIVAL_ACTIVITIES
  return rows.map((a, i) => ({
    id: `${day.id}-act-${i}`,
    dayId: day.id,
    time: a.time,
    label: a.label,
    scoresPunctuality: day.scored,
  }))
})

export const activitiesForDay = (dayId: string) => ACTIVITIES.filter((a) => a.dayId === dayId)

/** Minutes past midnight, for clock comparisons. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/**
 * Roll call auto-selects the activity nearest the current clock time —
 * opening it at 9:47 should already have "Morning line up · 9:45" chosen.
 */
export function nearestActivity(activities: Activity[], now: Date): Activity | undefined {
  const scored = activities.filter((a) => a.scoresPunctuality)
  if (scored.length === 0) return undefined
  const mins = now.getHours() * 60 + now.getMinutes()
  return scored.reduce((best, a) =>
    Math.abs(timeToMinutes(a.time) - mins) < Math.abs(timeToMinutes(best.time) - mins) ? a : best,
  )
}

/**
 * Which day the rail opens on. During camp that is today; before camp the
 * first scoring day (so the board is never blank on Arrival), after camp the
 * last day.
 */
export function resolveActiveDay(days: Day[], now: Date): Day {
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const exact = days.find((d) => d.date === today)
  if (exact) return exact
  const scored = days.filter((d) => d.scored)
  if (today < days[0].date) return scored[0]
  if (today > days[days.length - 1].date) return scored[scored.length - 1]
  // Mid-camp with no exact match (shouldn't happen) — nearest scoring day.
  return scored.find((d) => d.date >= today) ?? scored[scored.length - 1]
}

// ---------------------------------------------------------------------------
// Mock camp state. Phase 0 only — Phase 1 reads real events from the backend.
//
// Hand-authored rather than random so screenshots are byte-stable and so the
// board demonstrates the cases that matter: a team sitting on the 6/7 cliff,
// a team missing a visible category, and a leader who is ahead on KEYS while
// trailing on base points.
// ---------------------------------------------------------------------------

type DayPlan = {
  dayId: string
  rows: { team: TeamId; binaries: string[]; ticks: number; keys: number }[]
}

const ALL5 = ['cleanliness', 'memory_verse', 'good_deed', 'lesson_knowledge', 'behavior']
const without = (...drop: string[]) => ALL5.filter((c) => !drop.includes(c))

const PLANS: DayPlan[] = [
  {
    dayId: 'day-1',
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
    dayId: 'day-2',
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
    dayId: 'day-3',
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
    const acts = activitiesForDay(day.id)
    const stamp = (minutes: number) => `${day.date}T${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:00.000Z`

    for (const row of plan.rows) {
      for (const cat of row.binaries) {
        events.push({
          id: `seed-${day.id}-${row.team}-${cat}`,
          occurredAt: stamp(timeToMinutes('11:00')),
          dayId: day.id,
          teamId: row.team,
          categoryId: cat as ScoreEvent['categoryId'],
          deltaDeci: 10,
          activityId: null,
          note: null,
          actorId,
          deviceId,
          reversesEventId: null,
          syncedAt: null,
        })
      }
      for (let i = 0; i < row.ticks; i++) {
        const act = acts[i]
        events.push({
          id: `seed-${day.id}-${row.team}-punct-${i}`,
          occurredAt: stamp(timeToMinutes(act.time)),
          dayId: day.id,
          teamId: row.team,
          categoryId: 'punctuality',
          deltaDeci: 1,
          activityId: act.id,
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
          occurredAt: stamp(timeToMinutes('20:15')),
          dayId: day.id,
          teamId: row.team,
          categoryId: 'golden_key',
          deltaDeci: 10,
          activityId: null,
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
