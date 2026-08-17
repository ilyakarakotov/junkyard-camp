import type { Category, Day, ScoreEvent, Team } from './types'

/**
 * The single seam between the app and storage. Phase 0 implements this over
 * localStorage; Phase 1 swaps in a shared backend (plus an outbox for offline
 * retry) so several leaders can score at once — without touching a component.
 *
 * Components never call storage directly. They go through the store hooks in
 * `store.tsx`, which sit on top of this interface.
 */
export interface DataProvider {
  getTeams(): Promise<Team[]>
  getDays(): Promise<Day[]>
  getCategories(): Promise<Category[]>
  getEvents(): Promise<ScoreEvent[]>

  /** Idempotent by event id: appending an existing id is a no-op. */
  appendEvent(event: ScoreEvent): Promise<void>

  /**
   * A roll-call commit is one gesture over eight teams. Batching keeps it a
   * single write and a single notification — and in Phase 1, one request.
   */
  appendEvents(events: ScoreEvent[]): Promise<void>

  /** Device-local preferences (director mode). Not domain data. */
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>

  /** Change notification (covers cross-tab updates for the big screen). */
  subscribe(listener: () => void): () => void
}
