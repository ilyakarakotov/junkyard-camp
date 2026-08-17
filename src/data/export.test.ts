import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildAuditRows, buildDayRows, buildEventsCsv, buildWorkbook } from './export'
import { reversalOf, standings } from './derive'
import type { CategoryId, ScoreEvent, TeamId } from './types'
import { CATEGORIES, DAYS, TEAMS } from './seed'

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

/*
 * §10: "Excel export opens in Excel with one sheet per day matching the paper
 * layout." The only honest way to assert that from a unit test is to write the
 * book to a real xlsx buffer and read it back through the parser, so a
 * malformed sheet name or a value xlsx refuses to serialise fails here rather
 * than on the director's laptop.
 */
describe('the workbook', () => {
  const events = [
    ev('warriors', 'day1', 'cleanliness', 10),
    ev('warriors', 'day1', 'punctuality', 1),
    ev('gems', 'day1', 'golden_key', 10),
    ev('gems', 'day2', 'behavior', 10, '2026-08-21T09:00:00.000Z'),
  ]
  const users = [
    { id: 'a1', username: 'ilya', displayName: 'Ilya K.', role: 'director' as const },
  ]
  const book = () =>
    buildWorkbook(DAYS, TEAMS, CATEGORIES, users, events, standings(events, DAYS, TEAMS))

  it('round-trips through a real xlsx buffer', () => {
    const buf = XLSX.write(book(), { type: 'buffer', bookType: 'xlsx' })
    const reread = XLSX.read(buf, { type: 'buffer' })
    expect(reread.SheetNames).toEqual([...DAYS.map((d) => d.name), 'Standings', 'Audit'])
  })

  it('carries one sheet per day, teams down the left', () => {
    const wb = book()
    const sheet = wb.Sheets['Day 1']
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 })
    expect(rows[0][0]).toBe('Team')
    // eight teams under the header, in roster order
    expect(rows.slice(1).map((r) => r[0])).toEqual(TEAMS.map((t) => t.name))
  })

  it('splits base from keys on the standings sheet', () => {
    const rows = XLSX.utils.sheet_to_json<(string | number)[]>(book().Sheets.Standings, { header: 1 })
    expect(rows[0]).toEqual(['Rank', 'Team', 'Base Points', 'Golden Keys', 'Key Points', 'Overall Total'])
    const gems = rows.slice(1).find((r) => r[1] === 'Hidden Gems')!
    expect(gems[3]).toBe(1) // one key, counted — never a multiplier
  })
})
