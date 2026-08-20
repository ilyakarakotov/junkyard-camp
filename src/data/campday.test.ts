import { describe, expect, it } from 'vitest'
import { CAMP_TIMEZONE, campToday, campTodayCandidates, deviceToday } from './campday'
import { DAYS, resolveActiveDay, resolveEditableDayId } from './seed'

/**
 * The 03:00 rollover, verified against fixed UTC instants. August in
 * America/Los_Angeles is PDT (UTC-7), so 10:00Z is exactly 03:00 camp-local.
 */
describe('camp day boundary', () => {
  it('uses the camp timezone constant', () => {
    expect(CAMP_TIMEZONE).toBe('America/Los_Angeles')
  })

  it('counts 00:00–02:59 camp-local as the previous day', () => {
    // 09:30Z = 02:30 PDT on the 20th → still the 19th at camp.
    expect(campToday(new Date('2026-08-20T09:30:00.000Z'))).toBe('2026-08-19')
    // One second before the rollover.
    expect(campToday(new Date('2026-08-20T09:59:59.000Z'))).toBe('2026-08-19')
  })

  it('rolls over at 03:00 camp-local, not midnight', () => {
    // 10:00Z = 03:00 PDT on the 20th exactly → the 20th.
    expect(campToday(new Date('2026-08-20T10:00:00.000Z'))).toBe('2026-08-20')
    // 10:30Z = 03:30 PDT.
    expect(campToday(new Date('2026-08-20T10:30:00.000Z'))).toBe('2026-08-20')
  })

  it('is an ordinary date for the rest of the day', () => {
    expect(campToday(new Date('2026-08-21T20:00:00.000Z'))).toBe('2026-08-21') // 13:00 PDT
    expect(campToday(new Date('2026-08-22T06:59:00.000Z'))).toBe('2026-08-21') // 23:59 PDT prev
  })

  /*
   * The camp timezone is a build-time guess; the phone in a leader's hand is
   * not. Both readings have to be on the table, or a camp held east of
   * America/Los_Angeles spends every morning padlocked on its own date.
   */
  it('offers both the camp reading and the phone reading of today', () => {
    const at = new Date('2026-08-20T05:00:00.000Z')
    const candidates = campTodayCandidates(at)
    expect(candidates[0]).toBe(campToday(at))
    expect(candidates).toContain(deviceToday(at))
    expect(new Set(candidates).size).toBe(candidates.length)
  })
})

describe('which day accepts writes', () => {
  it('opens the day that matches the calendar', () => {
    expect(resolveEditableDayId(DAYS, new Date('2026-08-22T12:00:00.000Z'))).toBe('day3')
    expect(resolveActiveDay(DAYS, new Date('2026-08-22T12:00:00.000Z')).id).toBe('day3')
  })

  /*
   * The regression this guards: an exact match on Arrival resolved to `null`,
   * so on Arrival's own date — and, through the timezone skew, well into Day
   * 1 — nothing in the app was editable. Every control rendered disabled and a
   * leader tapping punctuality got silence.
   */
  it('never leaves the camp with no editable day', () => {
    expect(resolveEditableDayId(DAYS, new Date('2026-08-19T12:00:00.000Z'))).toBe('day1')
  })

  it('stands the first scoring day in before camp opens', () => {
    expect(resolveEditableDayId(DAYS, new Date('2026-08-01T12:00:00.000Z'))).toBe('day1')
  })

  it('closes everything after the last camp day', () => {
    expect(resolveEditableDayId(DAYS, new Date('2026-09-01T12:00:00.000Z'))).toBe(null)
  })
})
