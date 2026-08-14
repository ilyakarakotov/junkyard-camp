/**
 * The scoring core. Pure integer arithmetic on tenths ("deci") — no float
 * ever enters this file, and nothing here touches storage or React.
 */

import type { CategoryId } from './types'

/**
 * Punctuality ladder, indexed by check-in count. Seven scored check-ins a day,
 * each worth 0.1 — except that all seven jumps to 1.0.
 *
 * Missing the seventh costs 0.4, not 0.1. The jump falls out of this table for
 * free, which is exactly why the computed value is never stored: store it and
 * the 0.6 -> 1.0 step becomes a special case someone has to remember.
 */
export const PUNCTUALITY_DECI = [0, 1, 2, 3, 4, 5, 6, 10] as const

export const MAX_CHECK_INS = 7

/** Six categories, ceiling 6.0 per day. Keys are uncapped and sit on top. */
export const BASE_CEILING_DECI = 60

/** Value in tenths for a given number of check-ins. Saturates at seven. */
export function punctualityDeci(ticks: number): number {
  const t = Math.max(0, Math.min(MAX_CHECK_INS, Math.floor(ticks)))
  return PUNCTUALITY_DECI[t]
}

/** What the next check-in is worth — 0.4 at the cliff, 0.1 everywhere else. */
export function nextCheckInGainDeci(ticks: number): number {
  if (ticks >= MAX_CHECK_INS) return 0
  return punctualityDeci(ticks + 1) - punctualityDeci(ticks)
}

/** True at 6/7, where the seventh socket is worth four times the others. */
export function isAtCliff(ticks: number): boolean {
  return ticks === MAX_CHECK_INS - 1
}

/**
 * Render tenths as a fixed one-decimal string using integer math only.
 * `(deci / 10).toFixed(1)` would route the value through a float; this cannot.
 */
export function formatDeci(deci: number): string {
  const neg = deci < 0
  const n = Math.abs(Math.round(deci))
  return `${neg ? '-' : ''}${Math.floor(n / 10)}.${n % 10}`
}

/** Whole points and the leftover tenths — for the big screen's brick columns. */
export function splitDeci(deci: number): { whole: number; tenths: number } {
  const n = Math.max(0, Math.round(deci))
  return { whole: Math.floor(n / 10), tenths: n % 10 }
}

export const BINARY_DECI = 10
export const KEY_DECI = 10

/** The five binary categories, in board order. */
export const BINARY_CATEGORIES: CategoryId[] = [
  'cleanliness',
  'memory_verse',
  'good_deed',
  'lesson_knowledge',
  'behavior',
]

/** The six scored categories (five binaries plus the punctuality track). */
export const SCORED_CATEGORIES: CategoryId[] = [
  'cleanliness',
  'punctuality',
  'memory_verse',
  'good_deed',
  'lesson_knowledge',
  'behavior',
]
