/**
 * Every total in the app is a view over the append-only log. Nothing here
 * stores a computed value, and `punctuality` in particular is always recomputed
 * from the tick count so the 0.6 -> 1.0 jump falls out of the ladder for free.
 */

import type {
  CategoryId,
  DayScore,
  Day,
  ScoreEvent,
  Standing,
  Team,
  TeamId,
} from './types'
import {
  BINARY_CATEGORIES,
  KEY_DECI,
  SCORED_CATEGORIES,
  punctualityDeci,
} from './scoring'

/**
 * Events that still count: not a compensating event themselves, and not
 * cancelled by one. Undo, toggle-off and corrections all land here.
 */
export function liveEvents(events: ScoreEvent[]): ScoreEvent[] {
  const reversed = new Set<string>()
  for (const e of events) if (e.reversesEventId) reversed.add(e.reversesEventId)
  return events.filter((e) => !e.reversesEventId && !reversed.has(e.id))
}

export function isReversed(events: ScoreEvent[], eventId: string): boolean {
  return events.some((e) => e.reversesEventId === eventId)
}

const emptyByCategory = (): Record<CategoryId, number> => ({
  cleanliness: 0,
  punctuality: 0,
  memory_verse: 0,
  good_deed: 0,
  lesson_knowledge: 0,
  behavior: 0,
  golden_key: 0,
})

/**
 * One team's day. `live` must already be filtered through `liveEvents`.
 *
 * Binaries read as earned/not earned rather than summing deltas — a category
 * is on when a live event exists for it, which keeps a stray double-append
 * from ever pushing a 1.0 category to 2.0.
 */
function scoreFromLive(teamId: TeamId, live: ScoreEvent[]): DayScore {
  const byCategory = emptyByCategory()
  let ticks = 0
  let keys = 0

  for (const e of live) {
    if (e.teamId !== teamId) continue
    if (e.categoryId === 'punctuality') ticks++
    else if (e.categoryId === 'golden_key') keys++
    else byCategory[e.categoryId] = 1
  }

  for (const c of BINARY_CATEGORIES) byCategory[c] = byCategory[c] ? 10 : 0
  byCategory.punctuality = punctualityDeci(ticks)
  byCategory.golden_key = keys * KEY_DECI

  const baseDeci = SCORED_CATEGORIES.reduce((sum, c) => sum + byCategory[c], 0)
  const keysDeci = keys * KEY_DECI

  return {
    teamId,
    byCategory,
    ticks,
    keys,
    baseDeci,
    keysDeci,
    totalDeci: baseDeci + keysDeci,
  }
}

/** One team, one day. */
export function dayScore(events: ScoreEvent[], dayId: string, teamId: TeamId): DayScore {
  const live = liveEvents(events).filter((e) => e.dayId === dayId)
  return scoreFromLive(teamId, live)
}

/** Every team for one day, in roster order. */
export function dayScores(events: ScoreEvent[], dayId: string, teams: Team[]): DayScore[] {
  const live = liveEvents(events).filter((e) => e.dayId === dayId)
  return teams.map((t) => scoreFromLive(t.id, live))
}

/** How many punctuality check-ins a team has logged for a day. */
export function checkInCount(events: ScoreEvent[], dayId: string, teamId: TeamId): number {
  return liveEvents(events).filter(
    (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === 'punctuality',
  ).length
}

/** Whether a binary category is currently earned. */
export function hasBinary(
  events: ScoreEvent[],
  dayId: string,
  teamId: TeamId,
  categoryId: CategoryId,
): boolean {
  return liveEvents(events).some(
    (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === categoryId,
  )
}

/** The live event backing a binary category, so it can be reversed. */
export function binaryEvent(
  events: ScoreEvent[],
  dayId: string,
  teamId: TeamId,
  categoryId: CategoryId,
): ScoreEvent | undefined {
  return liveEvents(events).find(
    (e) => e.dayId === dayId && e.teamId === teamId && e.categoryId === categoryId,
  )
}

/** Keys are counted by counting events — never stored as a number. */
export function keyCount(events: ScoreEvent[], teamId: TeamId, dayId?: string): number {
  return liveEvents(events).filter(
    (e) =>
      e.categoryId === 'golden_key' &&
      e.teamId === teamId &&
      (dayId === undefined || e.dayId === dayId),
  ).length
}

/**
 * Cumulative standings across every scored day. Base and key points stay
 * separate so you can see *how* a team is winning.
 */
export function standings(events: ScoreEvent[], days: Day[], teams: Team[]): Standing[] {
  const scoredDayIds = new Set(days.filter((d) => d.scored).map((d) => d.id))
  const live = liveEvents(events).filter((e) => scoredDayIds.has(e.dayId))

  const rows = teams.map((t) => {
    let baseDeci = 0
    let keys = 0
    for (const d of days) {
      if (!d.scored) continue
      const s = scoreFromLive(
        t.id,
        live.filter((e) => e.dayId === d.id),
      )
      baseDeci += s.baseDeci
      keys += s.keys
    }
    const keysDeci = keys * KEY_DECI
    return { teamId: t.id, baseDeci, keysDeci, keys, totalDeci: baseDeci + keysDeci, rank: 0 }
  })

  // Ties share a rank; the next rank skips accordingly.
  const sorted = [...rows].sort((a, b) => b.totalDeci - a.totalDeci)
  let lastTotal = Number.NaN
  let lastRank = 0
  return sorted.map((row, i) => {
    if (row.totalDeci !== lastTotal) {
      lastRank = i + 1
      lastTotal = row.totalDeci
    }
    return { ...row, rank: lastRank }
  })
}

/** Board order ranking for a single day. */
export function dayRanks(scores: DayScore[]): Map<TeamId, number> {
  const sorted = [...scores].sort((a, b) => b.totalDeci - a.totalDeci)
  const ranks = new Map<TeamId, number>()
  let lastTotal = Number.NaN
  let lastRank = 0
  sorted.forEach((s, i) => {
    if (s.totalDeci !== lastTotal) {
      lastRank = i + 1
      lastTotal = s.totalDeci
    }
    ranks.set(s.teamId, lastRank)
  })
  return ranks
}

/**
 * Build the compensating event for an undo. Appended, never edited.
 *
 * `actorId` is **whoever is doing the reversing**, which is not always who
 * made the award. It defaulted to the original's actor, and that quietly
 * minted events the backend can never accept: RLS is `actor_id = auth.uid()`,
 * so the moment one leader corrected another leader's mistake the compensating
 * row was refused forever — the correction showed on the phone, the shared log
 * kept the award live, and the two never reconciled. Pass the signed-in user.
 *
 * The default is kept for local-only mode and for tests that care about
 * scoring rather than authorship; every backed call site passes it.
 */
export function reversalOf(
  original: ScoreEvent,
  deviceId: string,
  note = 'Undo',
  actorId: string = original.actorId,
): ScoreEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    dayId: original.dayId,
    teamId: original.teamId,
    categoryId: original.categoryId,
    deltaDeci: -original.deltaDeci,
    note,
    actorId,
    deviceId,
    reversesEventId: original.id,
    syncedAt: null,
  }
}

/** Most recent first, compensating events folded into their originals. */
export function recentActivity(
  events: ScoreEvent[],
  limit: number,
): { event: ScoreEvent; reversed: boolean }[] {
  const reversed = new Set(
    events.filter((e) => e.reversesEventId).map((e) => e.reversesEventId as string),
  )
  return events
    .filter((e) => !e.reversesEventId)
    .slice()
    .reverse()
    .slice(0, limit)
    .map((event) => ({ event, reversed: reversed.has(event.id) }))
}
