import { describe, expect, it } from 'vitest'
import { campToday, formatCampDate } from './campday'
import { DAYS, canBackdateDay, resolveEditableDayId } from './seed'

const day = (id: string) => DAYS.find((d) => d.id === id)!
/** Mid-Day-2, well clear of the 03:00 rollover: 20:00Z = 13:00 PDT. */
const DURING_DAY2 = new Date('2026-08-21T20:00:00.000Z')

/**
 * Backdating: awarding points to a day that has already been and gone.
 *
 * The rule these assert is one half of a pair — `camp_can_backdate_day()` in
 * supabase/schema.sql is the other, and the client must never be the wider of
 * the two. A client that opens a day the policy refuses does not show an
 * error: the award appears on the phone and the row sits in the outbox
 * forever. So each case here is also a case the SQL has to agree on.
 */
describe('canBackdateDay', () => {
  it('opens a day that has already happened', () => {
    expect(canBackdateDay(day('day1'), DURING_DAY2)).toBe(true)
  })

  it('opens today itself — the guard above it decides, not this', () => {
    // Today is already editable without an unlock; the store checks
    // `dayId === editableDayId` first and never reaches here for it. What
    // matters is that the boundary is `<=`, matching the SQL's `date <=
    // camp_today()`, so the two can never disagree by a day.
    expect(canBackdateDay(day('day2'), DURING_DAY2)).toBe(true)
    expect(day('day2').date).toBe(campToday(DURING_DAY2))
  })

  it('refuses a day the camp has not reached', () => {
    expect(canBackdateDay(day('day3'), DURING_DAY2)).toBe(false)
    expect(canBackdateDay(day('day4'), DURING_DAY2)).toBe(false)
  })

  it('refuses Arrival, which scores nothing at all', () => {
    // Arrival is in the past by Day 2 and still must not open: not scoring is
    // a rule of the camp, not a lock waiting to be picked.
    expect(day('arrival').date < campToday(DURING_DAY2)).toBe(true)
    expect(canBackdateDay(day('arrival'), DURING_DAY2)).toBe(false)
  })

  it('refuses every day before camp opens', () => {
    const before = new Date('2026-08-01T20:00:00.000Z')
    expect(DAYS.filter((d) => canBackdateDay(d, before))).toEqual([])
    // And the app is not left unscoreable: the first scoring day stands in.
    expect(resolveEditableDayId(DAYS, before)).toBe('day1')
  })

  it('opens every scoring day once camp is over', () => {
    // After the last day nothing is editable without reopening one — which is
    // exactly when a leader is reconciling the final tally, so all four have
    // to be reachable.
    const after = new Date('2026-09-01T20:00:00.000Z')
    expect(resolveEditableDayId(DAYS, after)).toBe(null)
    expect(DAYS.filter((d) => canBackdateDay(d, after)).map((d) => d.id)).toEqual([
      'day1',
      'day2',
      'day3',
      'day4',
    ])
  })

  it('follows the 03:00 rollover, not midnight', () => {
    // 02:30 PDT on the 21st is still Day 1 at camp: Day 1 is today, not a past
    // day, and Day 2 has not started.
    const smallHours = new Date('2026-08-21T09:30:00.000Z')
    expect(campToday(smallHours)).toBe('2026-08-20')
    expect(canBackdateDay(day('day2'), smallHours)).toBe(false)
    // Half an hour later the rollover has happened and Day 1 is the past.
    const afterRollover = new Date('2026-08-21T10:00:00.000Z')
    expect(canBackdateDay(day('day1'), afterRollover)).toBe(true)
  })
})

describe('formatCampDate', () => {
  /*
   * The warning is built out of this. `new Date('2026-08-20')` parses as UTC
   * and formats as the 19th anywhere west of Greenwich — a warning naming the
   * wrong day is worse than no warning, so the parse is field by field.
   */
  it('names the day on the calendar, not the day in UTC', () => {
    expect(formatCampDate('2026-08-20')).toBe('Thu 20 Aug')
    expect(formatCampDate('2026-08-19')).toBe('Wed 19 Aug')
  })

  it('spans the whole camp without a stray separator anywhere', () => {
    // Asserted character by character because this used to go through
    // Intl.DateTimeFormat, where Node and Chromium disagreed about a comma —
    // Node passed this suite while the browser rendered a longer string that
    // overflowed the warning band.
    expect(DAYS.map((d) => formatCampDate(d.date))).toEqual([
      'Wed 19 Aug',
      'Thu 20 Aug',
      'Fri 21 Aug',
      'Sat 22 Aug',
      'Sun 23 Aug',
    ])
  })

  it('passes anything that is not a camp date straight through', () => {
    expect(formatCampDate('')).toBe('')
    expect(formatCampDate('not-a-date')).toBe('not-a-date')
    expect(formatCampDate('2026-13-01')).toBe('2026-13-01')
  })
})
