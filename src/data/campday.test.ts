import { describe, expect, it } from 'vitest'
import { CAMP_TIMEZONE, campToday } from './campday'

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
})
