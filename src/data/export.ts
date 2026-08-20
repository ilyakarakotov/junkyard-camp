import * as XLSX from 'xlsx'
import type { AppUser, Category, Day, ScoreEvent, Team } from './types'
import { dayScore } from './derive'
import { formatDeci, punctualityDeci } from './scoring'

/**
 * Export and audit derivations, pure and off the render path. The workbook
 * layout mirrors the paper score sheet: teams down the left, categories
 * across the top, punctuality as its seven sub-columns, keys, day total.
 * All point math stays in integer tenths until the final cell value.
 */

/** One day sheet: header + one row per team. */
export function buildDayRows(day: Day, events: ScoreEvent[], teams: Team[]): (string | number)[][] {
  const header = [
    'Team',
    'Cleanliness',
    'PNC 1',
    'PNC 2',
    'PNC 3',
    'PNC 4',
    'PNC 5',
    'PNC 6',
    'PNC 7',
    'Memory Verse',
    'Good Deed',
    'Lesson Knowledge',
    'Behavior',
    'Golden Keys',
    'Day Total',
  ]
  const rows = teams.map((t) => {
    const s = dayScore(events, day.id, t.id)
    const binary = (c: keyof typeof s.byCategory) => (s.byCategory[c] > 0 ? 1 : 0)
    const tick = (i: number) => (s.ticks > i ? 1 : 0)
    return [
      t.name,
      binary('cleanliness'),
      tick(0),
      tick(1),
      tick(2),
      tick(3),
      tick(4),
      tick(5),
      tick(6),
      binary('memory_verse'),
      binary('good_deed'),
      binary('lesson_knowledge'),
      binary('behavior'),
      s.keys,
      Number(formatDeci(s.totalDeci)),
    ]
  })
  return [header, ...rows]
}

/** The Standings sheet: overall totals, base and keys split, rank. */
/** One standings row, as `standings()` in derive.ts produces it. */
export interface StandingsRow {
  teamId: string
  baseDeci: number
  keysDeci: number
  keys: number
  totalDeci: number
  rank: number
}

export function buildStandingsRows(rows: StandingsRow[], teams: Team[]): (string | number)[][] {
  const name = (id: string) => teams.find((t) => t.id === id)?.name ?? id
  return [
    ['Rank', 'Team', 'Base Points', 'Golden Keys', 'Key Points', 'Overall Total'],
    ...rows.map((r) => [
      r.rank,
      name(r.teamId),
      Number(formatDeci(r.baseDeci)),
      r.keys,
      Number(formatDeci(r.keysDeci)),
      Number(formatDeci(r.totalDeci)),
    ]),
  ]
}

/**
 * The audit walk: the log in ascending order, tracking each team's live
 * state so every row can carry the value of that event and the team's
 * running total after it. Reversals cancel their original's effect; the
 * original row is flagged struck for the audit log's strike-through.
 */
export interface AuditRow {
  event: ScoreEvent
  /** Points this event moved: +1.0 a binary, the marginal ladder step a tick. */
  valueDeci: number
  /** The team's camp-wide running total after this event. */
  runningDeci: number
  /** This row is a compensating reversal. */
  reversal: boolean
  /** This row's effect was later cancelled (render struck through). */
  struck: boolean
}

export function buildAuditRows(events: ScoreEvent[]): AuditRow[] {
  const asc = [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt))
  const byId = new Map(asc.map((e) => [e.id, e]))
  const struck = new Set(asc.filter((e) => e.reversesEventId).map((e) => e.reversesEventId as string))

  // Binaries and ticks reset every day; keys accumulate over the camp. The
  // running total is the team's camp-wide figure after the event lands.
  interface DayState { bins: Set<string>; ticks: number }
  const state = new Map<string, { days: Map<string, DayState>; keys: number }>()
  const stateFor = (teamId: string, dayId: string) => {
    let s = state.get(teamId)
    if (!s) {
      s = { days: new Map(), keys: 0 }
      state.set(teamId, s)
    }
    let d = s.days.get(dayId)
    if (!d) {
      d = { bins: new Set(), ticks: 0 }
      s.days.set(dayId, d)
    }
    return { team: s, day: d }
  }
  const totalOf = (s: { days: Map<string, DayState>; keys: number }) => {
    let base = 0
    for (const d of s.days.values()) base += d.bins.size * 10 + punctualityDeci(d.ticks)
    return base + s.keys * 10
  }

  const out: AuditRow[] = []
  for (const e of asc) {
    const { team, day } = stateFor(e.teamId, e.dayId)
    const before = totalOf(team)
    if (e.reversesEventId) {
      const orig = byId.get(e.reversesEventId)
      if (orig) {
        const od = stateFor(orig.teamId, orig.dayId).day
        if (orig.categoryId === 'punctuality') od.ticks = Math.max(0, od.ticks - 1)
        else if (orig.categoryId === 'golden_key') team.keys = Math.max(0, team.keys - 1)
        else od.bins.delete(orig.categoryId)
      }
      out.push({ event: e, valueDeci: totalOf(team) - before, runningDeci: totalOf(team), reversal: true, struck: false })
      continue
    }
    if (e.categoryId === 'punctuality') day.ticks += 1
    else if (e.categoryId === 'golden_key') team.keys += 1
    else day.bins.add(e.categoryId)
    out.push({ event: e, valueDeci: totalOf(team) - before, runningDeci: totalOf(team), reversal: false, struck: struck.has(e.id) })
  }
  // Newest first for display.
  return out.reverse()
}

/**
 * The part of an event's note worth showing beside it on screen.
 *
 * A golden key cannot be awarded without a reason (TeamSheet's confirm), and
 * it is stored as `Golden key · Day 1 · they cleaned the whole yard` — the
 * prefix repeats what the row's own category and day columns already say, so
 * only the reason is returned. `Correction` is what every reversal carries and
 * `sandbox` is what test mode stamps on its rows: neither adds anything, and
 * printing them under every undo would bury the one note that matters.
 */
export function displayNote(note: string | null): string | null {
  if (!note) return null
  const text = note.replace(/^Golden key · [^·]+ · /, '').trim()
  if (!text || text === 'Correction' || text === 'sandbox') return null
  if (/^Golden key ·/.test(text)) return null // an older, reasonless auto-note
  return text
}

/** The Audit sheet: one row per event, who/what/when and the running total. */
export function buildAuditSheetRows(
  events: ScoreEvent[],
  teams: Team[],
  categories: Category[],
  users: AppUser[],
): (string | number)[][] {
  const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? id
  const catLabel = (id: string) => categories.find((c) => c.id === id)?.label ?? id
  const actorName = (id: string) => users.find((u) => u.id === id)?.displayName ?? id
  return [
    ['Time', 'Actor', 'Team', 'Category', 'Value', 'Running Total', 'Reversal', 'Note'],
    ...buildAuditRows(events).map((r) => [
      r.event.occurredAt,
      actorName(r.event.actorId),
      teamName(r.event.teamId),
      catLabel(r.event.categoryId),
      Number(formatDeci(r.valueDeci)),
      Number(formatDeci(r.runningDeci)),
      r.reversal ? 'yes' : r.struck ? 'reversed later' : '',
      r.event.note ?? '',
    ]),
  ]
}

/** Plain CSV of the raw event log, exactly as stored. */
export function buildEventsCsv(events: ScoreEvent[]): string {
  const esc = (v: string | null) => (v === null ? '' : `"${v.replace(/"/g, '""')}"`)
  const lines = [
    'id,occurred_at,day_id,team_id,category_id,delta,actor_id,device_id,reverses_event_id,note,synced_at',
    ...events.map((e) =>
      [
        e.id,
        e.occurredAt,
        e.dayId,
        e.teamId,
        e.categoryId,
        e.deltaDeci,
        e.actorId,
        e.deviceId,
        e.reversesEventId ?? '',
        esc(e.note),
        e.syncedAt ?? '',
      ].join(','),
    ),
  ]
  return lines.join('\n')
}

/*
 * The workbook itself.
 *
 * This lives here rather than in the screen so that "opens in Excel with one
 * sheet per day" is a testable claim: a unit test can build the book, write it
 * to a buffer and read it back. Assembled in the screen it was only ever
 * provable by hand.
 *
 * Sheet names are the day names, so `Standings` and `Audit` sit after them.
 */
export function buildWorkbook(
  days: Day[],
  teams: Team[],
  categories: Category[],
  users: AppUser[],
  events: ScoreEvent[],
  rows: StandingsRow[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  for (const day of days) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildDayRows(day, events, teams)), day.name)
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(buildStandingsRows(rows, teams)), 'Standings')
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(buildAuditSheetRows(events, teams, categories, users)),
    'Audit',
  )
  return wb
}

/** Trigger a client-side download — no server involved. */
export function downloadFile(name: string, content: string | Blob, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
