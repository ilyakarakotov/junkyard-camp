import { describe, expect, it } from 'vitest'
import { buildAuditRows, buildDayRows, buildEventsCsv } from './export'
import { reversalOf } from './derive'
import type { CategoryId, ScoreEvent, TeamId } from './types'
import { DAYS, TEAMS } from './seed'

let n = 0
const ev = (
  teamId: TeamId,
  dayId: string,
  categoryId: CategoryId,
  deltaDeci: number,
  occurredAt = '2026-08-20T09:00:00.000Z',
): ScoreEvent => ({
  id: `e${++n}`,
  occurredAt,
  dayId,
  teamId,
  categoryId,
  deltaDeci,
  note: null,
  actorId: 'a1',
  deviceId: 'd1',
  reversesEventId: null,
  syncedAt: null,
})

describe('audit walk', () => {
  it('values binaries +1.0, ticks +0.1, and the seventh tick +0.4', () => {
    const events = [
      ev('gems', 'day1', 'cleanliness', 10),
      ...Array.from({ length: 7 }, (_, i) =>
        ev('gems', 'day1', 'punctuality', 1, `2026-08-20T1${i}:00:00.000Z`),
      ),
    ]
    const rows = buildAuditRows(events)
    const byId = new Map(rows.map((r) => [r.event.id, r]))
    expect(byId.get(events[0].id)?.valueDeci).toBe(10)
    for (let i = 1; i <= 6; i++) expect(byId.get(events[i].id)?.valueDeci).toBe(1)
    expect(byId.get(events[7].id)?.valueDeci).toBe(4) // the cliff
    // running total after everything: 5.0 base? no — 1.0 binary + 1.0 ladder
    expect(rows[0].runningDeci).toBe(20)
  })

  it('resets ticks and binaries per day — day 2 pays again', () => {
    const events = [
      ev('gems', 'day1', 'cleanliness', 10, '2026-08-20T09:00:00.000Z'),
      ev('gems', 'day2', 'cleanliness', 10, '2026-08-21T09:00:00.000Z'),
      ev('gems', 'day2', 'punctuality', 1, '2026-08-21T10:00:00.000Z'),
    ]
    const rows = buildAuditRows(events)
    expect(rows.find((r) => r.event.id === events[1].id)?.valueDeci).toBe(10)
    expect(rows.find((r) => r.event.id === events[2].id)?.valueDeci).toBe(1)
    expect(rows[0].runningDeci).toBe(21)
  })

  it('a reversal carries the negative value and strikes the original', () => {
    const orig = ev('gems', 'day1', 'good_deed', 10)
    const undo = { ...reversalOf(orig, 'd1'), occurredAt: '2026-08-20T10:00:00.000Z' }
    const rows = buildAuditRows([orig, undo])
    const undoRow = rows.find((r) => r.event.id === undo.id)!
    const origRow = rows.find((r) => r.event.id === orig.id)!
    expect(undoRow.reversal).toBe(true)
    expect(undoRow.valueDeci).toBe(-10)
    expect(undoRow.runningDeci).toBe(0)
    expect(origRow.struck).toBe(true)
  })
})

describe('export builders', () => {
  it('lays a day sheet out like the paper score sheet', () => {
    const rows = buildDayRows(DAYS[1], [], TEAMS)
    expect(rows[0]).toContain('PNC 7')
    expect(rows[0]).toContain('Golden Keys')
    expect(rows[0]).toContain('Day Total')
    expect(rows).toHaveLength(9) // header + eight teams
    expect(rows[1][0]).toBe(TEAMS[0].name)
  })

  it('writes the raw log as CSV with a header', () => {
    const csv = buildEventsCsv([ev('gems', 'day1', 'cleanliness', 10)])
    const lines = csv.split('\n')
    expect(lines[0]).toContain('occurred_at')
    expect(lines).toHaveLength(2)
    expect(lines[1]).toContain('cleanliness')
  })
})
