/**
 * v2 scoring model. Teams only — there is no camper-level scoring.
 *
 * Every score is an INTEGER NUMBER OF TENTHS ("deci"). Float arithmetic never
 * touches the scoring path: 0.1 + 0.2 === 0.30000000000000004, and a big
 * screen reading 5.6000000000000005 in front of the camp director ends the
 * project. Divide by 10 only when rendering, via `formatDeci`.
 */

export type TeamId =
  | 'warriors'
  | 'precious'
  | 'gems'
  | 'pearls'
  | 'knights'
  | 'innocent'
  | 'forged'
  | 'rustco'

export interface Team {
  id: TeamId
  name: string
  /** What appears on the board — the full names don't fit at 390px. */
  shortName: string
  /** Token name — resolves to `--color-team-<token>` in theme.css. */
  colorToken: TeamId
  order: number
}

export type CategoryId =
  | 'cleanliness'
  | 'punctuality'
  | 'memory_verse'
  | 'good_deed'
  | 'lesson_knowledge'
  | 'behavior'
  | 'golden_key'

/**
 * Each kind gets a distinct physical object on screen (breaker / charge track
 * / key rail) so nothing needs a text label to be understood.
 */
export type CategoryKind = 'binary' | 'track' | 'key'

export interface Category {
  id: CategoryId
  key: CategoryId
  label: string
  /** Short engraved abbreviation for the board column header. */
  glyph: string
  kind: CategoryKind
  order: number
}

export interface Day {
  id: string
  index: number
  name: string
  theme: string
  /** YYYY-MM-DD, local camp date. */
  date: string
  /** Arrival is travel and settling in — it carries no score. */
  scored: boolean
}

/**
 * Append-only score event. Corrections are compensating events
 * (`reversesEventId` + negative delta) — never an edit, never a delete.
 *
 * `deltaDeci` means different units per category kind, by design: deci-points
 * (±10) for binary and key categories, CHECK-INS (±1) for punctuality. The
 * scored value of punctuality is `PUNCTUALITY_DECI[clamp(ticks,0,7)]`, never
 * the sum of deltas.
 */
export interface ScoreEvent {
  /** Client-generated UUID — duplicate submission is a no-op, not a double award. */
  id: string
  occurredAt: string // ISO 8601
  dayId: string
  teamId: TeamId
  categoryId: CategoryId
  /** Integer tenths for binary/key; ±1 check-ins for punctuality. */
  deltaDeci: number
  note: string | null
  /** The signed-in user's auth UUID in backed mode. */
  actorId: string
  deviceId: string
  /** Set on compensating events; never edit or delete the original. */
  reversesEventId: string | null
  /** Null while the event sits in the outbox; stamped when the server has it
   * (the row's `created_at`). This is the outbox flag, not a scored value. */
  syncedAt: string | null
}

/** A staff account — the audit log's "who". */
export interface AppUser {
  id: string
  username: string
  displayName: string
  role: 'helper' | 'director'
}

/** One team's six categories for one day, all derived from the log. */
export interface DayScore {
  teamId: TeamId
  /** Per-category value in tenths; punctuality already through the ladder. */
  byCategory: Record<CategoryId, number>
  /** Punctuality check-ins today, 0..7+. */
  ticks: number
  /** Golden keys earned today. */
  keys: number
  /** Six categories, ceiling 60 deci (6.0). */
  baseDeci: number
  /** keys * 10. */
  keysDeci: number
  /** baseDeci + keysDeci. Uncapped, because keys are uncapped. */
  totalDeci: number
}

/** Cumulative standing across every scored day. */
export interface Standing {
  teamId: TeamId
  baseDeci: number
  keysDeci: number
  keys: number
  totalDeci: number
  rank: number
}

/** A committed roll-call batch, for the 60-second undo. */
export interface CommitBatch {
  eventIds: string[]
  categoryId: CategoryId
  dayId: string
  teamIds: TeamId[]
  at: number
}
