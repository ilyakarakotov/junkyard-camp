import type { AwardEvent, Camper, Team, Volunteer } from './types'

/**
 * The single seam between the app and storage. Phase 0 implements this over
 * localStorage; Phase 1 swaps in an Azure-backed implementation (plus an
 * IndexedDB outbox) without touching any component.
 *
 * Components never call storage directly — they go through the store hooks in
 * `store.tsx`, which sit on top of this interface.
 */
export interface DataProvider {
  getTeams(): Promise<Team[]>
  getCampers(): Promise<Camper[]>
  getVolunteers(): Promise<Volunteer[]>
  getEvents(): Promise<AwardEvent[]>
  /** Idempotent by event id: appending an existing id is a no-op. */
  appendEvent(event: AwardEvent): Promise<void>
  /** Change notification (covers cross-tab updates for the big screen). */
  subscribe(listener: () => void): () => void
}
