import { describe, expect, it } from 'vitest'
import {
  BASE_CEILING_DECI,
  PUNCTUALITY_DECI,
  formatDeci,
  isAtCliff,
  nextCheckInGainDeci,
  punctualityDeci,
  splitDeci,
} from './scoring'
import {
  dayScore,
  keyCount,
  liveEvents,
  reversalOf,
  standings,
} from './derive'
import type { CategoryId, Day, ScoreEvent, Team, TeamId } from './types'
import { CATEGORIES, DAYS, TEAMS, nearestActivity, resolveActiveDay } from './seed'

let n = 0
const ev = (
  teamId: TeamId,
  dayId: string,
  categoryId: CategoryId,
  deltaDeci: number,
  activityId: string | null = null,
): ScoreEvent => ({
  id: `e${++n}`,
  occurredAt: '2026-08-20T09:00:00.000Z',
  dayId,
  teamId,
  categoryId,
  deltaDeci,
  activityId,
  note: null,
  actorId: 'a1',
  deviceId: 'd1',
  reversesEventId: null,
  syncedAt: null,
})

const tick = (teamId: TeamId, dayId: string, i: number) =>
  ev(teamId, dayId, 'punctuality', 1, `act-${i}`)

describe('punctuality ladder', () => {
  it('pays 0.1 per check-in for the first six', () => {
    expect(PUNCTUALITY_DECI).toEqual([0, 1, 2, 3, 4, 5, 6, 10])
    for (let t = 0; t <= 6; t++) expect(punctualityDeci(t)).toBe(t)
  })

  it('jumps from 0.6 to 1.0 on the seventh check-in', () => {
    expect(punctualityDeci(6)).toBe(6)
    expect(punctualityDeci(7)).toBe(10)
    expect(formatDeci(punctualityDeci(6))).toBe('0.6')
    expect(formatDeci(punctualityDeci(7))).toBe('1.0')
  })

  it('makes the seventh worth 0.4, not 0.1', () => {
    expect(nextCheckInGainDeci(6)).toBe(4)
    for (let t = 0; t < 6; t++) expect(nextCheckInGainDeci(t)).toBe(1)
    expect(nextCheckInGainDeci(7)).toBe(0)
  })

  it('flags the cliff only at 6 of 7', () => {
    expect(isAtCliff(6)).toBe(true)
    expect([0, 1, 2, 3, 4, 5, 7].every((t) => !isAtCliff(t))).toBe(true)
  })

  it('saturates past seven and floors below zero', () => {
    expect(punctualityDeci(8)).toBe(10)
    expect(punctualityDeci(99)).toBe(10)
    expect(punctualityDeci(-3)).toBe(0)
  })
})

describe('integer-tenths rendering', () => {
  it('never produces a float artifact', () => {
    expect(formatDeci(56)).toBe('5.6')
    expect(formatDeci(60)).toBe('6.0')
    expect(formatDeci(0)).toBe('0.0')
    expect(formatDeci(3)).toBe('0.3')
    expect(formatDeci(276)).toBe('27.6')
  })

  it('agrees with float division on every value a camp can reach', () => {
    for (let d = 0; d <= 600; d++) expect(formatDeci(d)).toBe((d / 10).toFixed(1))
  })

  it('splits into whole bricks and leftover tenths', () => {
    expect(splitDeci(56)).toEqual({ whole: 5, tenths: 6 })
    expect(splitDeci(60)).toEqual({ whole: 6, tenths: 0 })
    expect(splitDeci(0)).toEqual({ whole: 0, tenths: 0 })
  })
})

describe('day scoring', () => {
  const D = 'day-1'
  const T: TeamId = 'warriors'

  it('caps the six categories at 6.0', () => {
    const events = [
      ev(T, D, 'cleanliness', 10),
      ev(T, D, 'memory_verse', 10),
      ev(T, D, 'good_deed', 10),
      ev(T, D, 'lesson_knowledge', 10),
      ev(T, D, 'behavior', 10),
      ...Array.from({ length: 7 }, (_, i) => tick(T, D, i)),
    ]
    const s = dayScore(events, D, T)
    expect(s.baseDeci).toBe(BASE_CEILING_DECI)
    expect(formatDeci(s.baseDeci)).toBe('6.0')
  })

  it('lands on 5.6 at six of seven check-ins', () => {
    const events = [
      ev(T, D, 'cleanliness', 10),
      ev(T, D, 'memory_verse', 10),
      ev(T, D, 'good_deed', 10),
      ev(T, D, 'lesson_knowledge', 10),
      ev(T, D, 'behavior', 10),
      ...Array.from({ length: 6 }, (_, i) => tick(T, D, i)),
    ]
    const s = dayScore(events, D, T)
    expect(s.ticks).toBe(6)
    expect(formatDeci(s.baseDeci)).toBe('5.6')
  })

  it('does not double-count a repeated binary append', () => {
    const events = [ev(T, D, 'cleanliness', 10), ev(T, D, 'cleanliness', 10)]
    expect(dayScore(events, D, T).byCategory.cleanliness).toBe(10)
  })

  it('keeps keys out of the base and uncapped on top', () => {
    const events = [
      ev(T, D, 'cleanliness', 10),
      ev(T, D, 'golden_key', 10),
      ev(T, D, 'golden_key', 10),
      ev(T, D, 'golden_key', 10),
    ]
    const s = dayScore(events, D, T)
    expect(s.baseDeci).toBe(10)
    expect(s.keys).toBe(3)
    expect(s.keysDeci).toBe(30)
    expect(s.totalDeci).toBe(40)
  })

  it('isolates days from each other', () => {
    const events = [ev(T, 'day-1', 'cleanliness', 10), ev(T, 'day-2', 'cleanliness', 10)]
    expect(dayScore(events, 'day-1', T).baseDeci).toBe(10)
    expect(dayScore(events, 'day-2', T).baseDeci).toBe(10)
  })

  it('does not carry punctuality across days', () => {
    const events = [
      ...Array.from({ length: 7 }, (_, i) => tick(T, 'day-1', i)),
      ...Array.from({ length: 2 }, (_, i) => tick(T, 'day-2', i)),
    ]
    expect(dayScore(events, 'day-1', T).byCategory.punctuality).toBe(10)
    expect(dayScore(events, 'day-2', T).byCategory.punctuality).toBe(2)
  })
})

describe('compensating events', () => {
  const D = 'day-1'
  const T: TeamId = 'gems'

  it('cancels a binary with a reversal rather than an edit', () => {
    const on = ev(T, D, 'cleanliness', 10)
    const off = reversalOf(on, 'd1')
    expect(off.deltaDeci).toBe(-10)
    expect(off.reversesEventId).toBe(on.id)
    expect(dayScore([on], D, T).byCategory.cleanliness).toBe(10)
    expect(dayScore([on, off], D, T).byCategory.cleanliness).toBe(0)
  })

  it('re-earning after a reversal scores again', () => {
    const on = ev(T, D, 'behavior', 10)
    const off = reversalOf(on, 'd1')
    const again = ev(T, D, 'behavior', 10)
    expect(dayScore([on, off, again], D, T).byCategory.behavior).toBe(10)
  })

  it('walks punctuality back down the ladder, including off the cliff', () => {
    const ticks = Array.from({ length: 7 }, (_, i) => tick(T, D, i))
    expect(dayScore(ticks, D, T).byCategory.punctuality).toBe(10)
    const undone = [...ticks, reversalOf(ticks[6], 'd1')]
    expect(dayScore(undone, D, T).ticks).toBe(6)
    expect(dayScore(undone, D, T).byCategory.punctuality).toBe(6)
  })

  it('removes a key by counting one fewer event', () => {
    const k1 = ev(T, D, 'golden_key', 10)
    const k2 = ev(T, D, 'golden_key', 10)
    expect(keyCount([k1, k2], T)).toBe(2)
    expect(keyCount([k1, k2, reversalOf(k2, 'd1')], T)).toBe(1)
  })

  it('excludes both the original and the reversal from the live log', () => {
    const a = ev(T, D, 'good_deed', 10)
    const b = reversalOf(a, 'd1')
    expect(liveEvents([a, b])).toHaveLength(0)
  })
})

describe('five-day camp totals', () => {
  const scoredDays = DAYS.filter((d) => d.scored)

  it('runs four scoring days — Arrival does not score', () => {
    expect(DAYS).toHaveLength(5)
    expect(DAYS[0].name).toBe('Arrival')
    expect(DAYS[0].scored).toBe(false)
    expect(scoredDays).toHaveLength(4)
  })

  it('tops out at 24.0 base for a perfect camp, plus keys', () => {
    const T: TeamId = 'forged'
    const events: ScoreEvent[] = []
    for (const d of scoredDays) {
      for (const c of ['cleanliness', 'memory_verse', 'good_deed', 'lesson_knowledge', 'behavior'] as CategoryId[]) {
        events.push(ev(T, d.id, c, 10))
      }
      for (let i = 0; i < 7; i++) events.push(tick(T, d.id, i))
    }
    const row = standings(events, DAYS, TEAMS).find((r) => r.teamId === T)!
    expect(row.baseDeci).toBe(240)
    expect(formatDeci(row.baseDeci)).toBe('24.0')

    events.push(ev(T, scoredDays[0].id, 'golden_key', 10))
    events.push(ev(T, scoredDays[2].id, 'golden_key', 10))
    const withKeys = standings(events, DAYS, TEAMS).find((r) => r.teamId === T)!
    expect(withKeys.keys).toBe(2)
    expect(withKeys.totalDeci).toBe(260)
    expect(formatDeci(withKeys.totalDeci)).toBe('26.0')
  })

  it('accumulates tenths across days without float drift', () => {
    const T: TeamId = 'pearls'
    const events: ScoreEvent[] = []
    // 0.1 + 0.2 + 0.3 + 0.4 of punctuality across the four scoring days.
    scoredDays.forEach((d, di) => {
      for (let i = 0; i <= di; i++) events.push(tick(T, d.id, i))
    })
    const row = standings(events, DAYS, TEAMS).find((r) => r.teamId === T)!
    expect(row.baseDeci).toBe(10)
    expect(formatDeci(row.baseDeci)).toBe('1.0')
  })

  it('ignores anything logged against Arrival', () => {
    const T: TeamId = 'knights'
    const arrival = DAYS[0]
    const events = [ev(T, arrival.id, 'cleanliness', 10), ev(T, arrival.id, 'golden_key', 10)]
    const row = standings(events, DAYS, TEAMS).find((r) => r.teamId === T)!
    expect(row.totalDeci).toBe(0)
  })

  it('ranks by total and shares a rank on ties', () => {
    const events: ScoreEvent[] = [
      ev('warriors', 'day-1', 'cleanliness', 10),
      ev('warriors', 'day-1', 'behavior', 10),
      ev('gems', 'day-1', 'cleanliness', 10),
      ev('precious', 'day-1', 'cleanliness', 10),
    ]
    const rows = standings(events, DAYS, TEAMS)
    expect(rows[0].teamId).toBe('warriors')
    expect(rows[0].rank).toBe(1)
    const gems = rows.find((r) => r.teamId === 'gems')!
    const precious = rows.find((r) => r.teamId === 'precious')!
    expect(gems.rank).toBe(2)
    expect(precious.rank).toBe(2)
    // Rank 3 is skipped by the tie; the next distinct score is 4th.
    expect(rows.filter((r) => r.rank === 3)).toHaveLength(0)
    expect(rows.some((r) => r.rank === 4)).toBe(true)
  })

  it('separates base points from key points', () => {
    const T: TeamId = 'innocent'
    const events = [
      ev(T, 'day-1', 'cleanliness', 10),
      ev(T, 'day-1', 'golden_key', 10),
      ev(T, 'day-2', 'golden_key', 10),
    ]
    const row = standings(events, DAYS, TEAMS).find((r) => r.teamId === T)!
    expect(row.baseDeci).toBe(10)
    expect(row.keysDeci).toBe(20)
    expect(row.totalDeci).toBe(30)
  })
})

describe('roster and categories', () => {
  it('carries eight teams with distinct colors and short names', () => {
    expect(TEAMS).toHaveLength(8)
    expect(new Set(TEAMS.map((t) => t.id)).size).toBe(8)
    expect(new Set(TEAMS.map((t) => t.shortName)).size).toBe(8)
    expect(TEAMS.every((t: Team) => t.shortName.length <= 8)).toBe(true)
  })

  it('carries six scored categories plus the key', () => {
    expect(CATEGORIES.filter((c) => c.kind === 'binary')).toHaveLength(5)
    expect(CATEGORIES.filter((c) => c.kind === 'track')).toHaveLength(1)
    expect(CATEGORIES.filter((c) => c.kind === 'key')).toHaveLength(1)
  })

  it('gives every scoring day seven punctuality activities', () => {
    for (const d of DAYS.filter((x: Day) => x.scored)) {
      const acts = DAYS_ACTIVITY_COUNT(d.id)
      expect(acts).toBe(7)
    }
  })
})

// Imported here rather than at the top so the helper reads next to its use.
import { ACTIVITIES } from './seed'
const DAYS_ACTIVITY_COUNT = (dayId: string) =>
  ACTIVITIES.filter((a) => a.dayId === dayId && a.scoresPunctuality).length

describe('clock-driven selection', () => {
  const day1 = DAYS[1]
  const acts = ACTIVITIES.filter((a) => a.dayId === day1.id)
  const at = (h: number, m: number) => {
    const d = new Date(2026, 7, 20, h, m, 0)
    return d
  }

  it('picks "Morning line up · 9:45" when opened at 9:47', () => {
    const a = nearestActivity(acts, at(9, 47))
    expect(a?.time).toBe('09:45')
    expect(a?.label).toBe('Morning line up')
  })

  it('picks the nearest activity either side of the clock', () => {
    expect(nearestActivity(acts, at(8, 20))?.time).toBe('08:30') // before the first
    expect(nearestActivity(acts, at(8, 50))?.time).toBe('09:00')
    expect(nearestActivity(acts, at(11, 0))?.time).toBe('10:15') // closer than 13:00
    expect(nearestActivity(acts, at(12, 0))?.time).toBe('13:00') // now 13:00 is closer
    expect(nearestActivity(acts, at(23, 30))?.time).toBe('19:30') // after the last
  })

  it('returns nothing for a day with no scoring activities', () => {
    const arrival = ACTIVITIES.filter((a) => a.dayId === DAYS[0].id)
    expect(arrival.length).toBeGreaterThan(0)
    expect(nearestActivity(arrival, at(19, 0))).toBeUndefined()
  })
})

describe('day rail resolution', () => {
  const on = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0)

  it('selects today during camp', () => {
    expect(resolveActiveDay(DAYS, on(2026, 8, 21)).id).toBe('day-2')
    expect(resolveActiveDay(DAYS, on(2026, 8, 23)).id).toBe('day-4')
  })

  it('selects Arrival on Arrival, even though it does not score', () => {
    const d = resolveActiveDay(DAYS, on(2026, 8, 19))
    expect(d.name).toBe('Arrival')
    expect(d.scored).toBe(false)
  })

  it('falls back to the first scoring day before camp', () => {
    expect(resolveActiveDay(DAYS, on(2026, 8, 14)).id).toBe('day-1')
  })

  it('falls back to the last scoring day after camp', () => {
    expect(resolveActiveDay(DAYS, on(2026, 9, 1)).id).toBe('day-4')
  })
})
