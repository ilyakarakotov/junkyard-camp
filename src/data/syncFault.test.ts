import { describe, expect, it } from 'vitest'
import {
  classifyServerError,
  faultHeadline,
  faultOf,
  faultRemedy,
  isTransient,
  RemoteError,
} from './syncFault'

const AT = '2026-08-22T09:00:00.000Z'
const kind = (e: Parameters<typeof classifyServerError>[0]) => classifyServerError(e, AT).kind

/**
 * The classification is the whole reason the sync engine can tell "wait" from
 * "this will never go". Get it wrong in the transient direction and a refused
 * award is retried forever in silence — which is the bug this all came from.
 * Get it wrong in the other direction and a phone in a dead zone quarantines
 * a morning's scoring.
 */
describe('classifyServerError', () => {
  it('reads a dead network off the message, since supabase-js sends no code', () => {
    expect(kind({ message: 'TypeError: Failed to fetch', code: '' })).toBe('network')
    expect(kind({ message: 'NetworkError when attempting to fetch resource.' })).toBe('network')
    expect(kind({ message: 'The request timed out.' })).toBe('network')
    // SQLSTATE class 08 is connection failure, passed straight through.
    expect(kind({ message: 'connection failure', code: '08006' })).toBe('network')
  })

  it('names an expired session', () => {
    expect(kind({ message: 'JWT expired', code: 'PGRST301' })).toBe('auth')
    expect(kind({ message: 'invalid claim: missing sub claim', code: '401' })).toBe('auth')
    expect(kind({ message: 'JWSError JWSInvalidSignature' })).toBe('auth')
  })

  it('names a row-level security refusal', () => {
    expect(
      kind({
        message: 'new row violates row-level security policy for table "score_events"',
        code: '42501',
      }),
    ).toBe('refused')
  })

  it('names a row the server cannot parse — the local-mode actor id', () => {
    expect(kind({ message: 'invalid input syntax for type uuid: "leader-1"', code: '22P02' })).toBe(
      'malformed',
    )
    expect(kind({ message: 'null value in column "actor_id"', code: '23502' })).toBe('malformed')
  })

  it('names a correction whose original never arrived', () => {
    expect(
      kind({
        message: 'insert or update on table "score_events" violates foreign key constraint',
        code: '23503',
      }),
    ).toBe('missing-reference')
  })

  it('falls back to unknown rather than guessing weather', () => {
    expect(kind({ message: 'Bad Gateway', code: '502' })).toBe('unknown')
    expect(kind(null)).toBe('unknown')
  })
})

describe('isTransient', () => {
  it('is true only where waiting is the right response', () => {
    const at = AT
    expect(isTransient(classifyServerError({ message: 'Failed to fetch' }, at))).toBe(true)
    expect(isTransient(classifyServerError({ message: 'JWT expired', code: 'PGRST301' }, at))).toBe(true)
    expect(isTransient(classifyServerError({ message: 'refused', code: '42501' }, at))).toBe(false)
    expect(isTransient(classifyServerError({ message: 'bad uuid', code: '22P02' }, at))).toBe(false)
    expect(isTransient(classifyServerError({ message: 'Bad Gateway', code: '502' }, at))).toBe(false)
  })
})

describe('faultOf', () => {
  it('unwraps a RemoteError without reclassifying it', () => {
    const fault = classifyServerError({ message: 'refused', code: '42501' }, AT)
    expect(faultOf(new RemoteError(fault))).toEqual(fault)
  })

  it('classifies a bare thrown Error', () => {
    expect(faultOf(new Error('Failed to fetch'), AT).kind).toBe('network')
  })
})

describe('the words a leader reads', () => {
  it('gives every fault a headline and something to do about it', () => {
    for (const e of [
      { message: 'Failed to fetch' },
      { message: 'JWT expired', code: 'PGRST301' },
      { message: 'row-level security', code: '42501' },
      { message: 'bad uuid', code: '22P02' },
      { message: 'fk', code: '23503' },
      { message: 'Bad Gateway', code: '502' },
    ]) {
      const fault = classifyServerError(e, AT)
      expect(faultHeadline(fault).length).toBeGreaterThan(0)
      expect(faultRemedy(fault).length).toBeGreaterThan(0)
      // No jargon leaks into the headline: the code is shown separately.
      expect(faultHeadline(fault)).not.toMatch(/PGRST|[0-9]{5}/)
    }
  })
})
