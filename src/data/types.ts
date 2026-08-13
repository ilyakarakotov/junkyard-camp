export type TeamId =
  | 'turquoise'
  | 'crimson'
  | 'sunburst'
  | 'lime'
  | 'violet'
  | 'cobalt'

export interface Team {
  id: TeamId
  name: string
  /** Token name — resolves to `--color-team-<token>` in theme.css. */
  colorToken: TeamId
}

export interface Camper {
  id: string
  firstName: string
  lastInitial: string
  teamId: TeamId
}

export interface Volunteer {
  id: string
  displayName: string
  /** Phase 1 adds pin_hash; Phase 0 mocks auth entirely. */
  role: 'volunteer' | 'director'
  isActive: boolean
}

/**
 * Append-only award event. `camperIds` collapses the
 * `award_event_campers` join table for Phase 0; the Phase 1 SQL schema keeps
 * them separate.
 */
export interface AwardEvent {
  /** Client-generated UUID — duplicate submission is a no-op, not a double award. */
  id: string
  occurredAt: string // ISO 8601
  volunteerId: string
  teamId: TeamId
  /** Points per camper. Negative only on compensating (reversal) events. */
  points: number
  note: string | null
  deviceId: string
  /** Set on compensating events; never edit or delete the original. */
  reversesEventId: string | null
  syncedAt: string | null
  camperIds: string[]
}

export interface TeamTotals {
  teamId: TeamId
  points: number
  rank: number
}

export interface ActivityEntry {
  event: AwardEvent
  /** Net effect is zero once a reversal exists. */
  reversed: boolean
}
