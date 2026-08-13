import type { ActivityEntry, AwardEvent, TeamId, TeamTotals } from './types'

/** Team totals are a pure view over the event log. */
export function teamTotals(events: AwardEvent[], teamIds: TeamId[]): TeamTotals[] {
  const sums = new Map<TeamId, number>(teamIds.map((id) => [id, 0]))
  for (const e of events) {
    sums.set(e.teamId, (sums.get(e.teamId) ?? 0) + e.points * e.camperIds.length)
  }
  return [...sums.entries()]
    .map(([teamId, points]) => ({ teamId, points, rank: 0 }))
    .sort((a, b) => b.points - a.points)
    .map((t, i) => ({ ...t, rank: i + 1 }))
}

/** Per-camper totals, also derived. */
export function camperTotals(events: AwardEvent[]): Map<string, number> {
  const sums = new Map<string, number>()
  for (const e of events) {
    for (const camperId of e.camperIds) {
      sums.set(camperId, (sums.get(camperId) ?? 0) + e.points)
    }
  }
  return sums
}

const reversedIds = (events: AwardEvent[]) =>
  new Set(events.filter((e) => e.reversesEventId).map((e) => e.reversesEventId as string))

/** Latest first; excludes compensating events themselves, flags reversed originals. */
export function recentActivity(events: AwardEvent[], limit: number): ActivityEntry[] {
  const reversed = reversedIds(events)
  return events
    .filter((e) => !e.reversesEventId)
    .slice(-limit * 3)
    .reverse()
    .map((event) => ({ event, reversed: reversed.has(event.id) }))
    .slice(0, limit)
}

export function isReversed(events: AwardEvent[], eventId: string): boolean {
  return events.some((e) => e.reversesEventId === eventId)
}

/** Build the compensating event for an undo. Appended, never edited. */
export function reversalOf(original: AwardEvent, deviceId: string): AwardEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    volunteerId: original.volunteerId,
    teamId: original.teamId,
    points: -original.points,
    note: 'Undo',
    deviceId,
    reversesEventId: original.id,
    syncedAt: null,
    camperIds: original.camperIds,
  }
}
