import type { AppUser, Category, Day, ScoreEvent, Team } from './types'
import type { SyncFault } from './syncFault'

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

  /** The staff directory, for the audit log's actor names. Empty in local mode. */
  getUsers(): Promise<AppUser[]>

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

/**
 * What the sync engine knows about its own health, for the sync screen and
 * the unsynced chrome. Local-only providers have none of this — see
 * `isSyncCapable`.
 */
export interface SyncState {
  /** `navigator.onLine`: the phone has a link. It does NOT mean sync works. */
  online: boolean
  /** Awards held back because the server refuses them (never discarded). */
  blocked: number
  /** A flush is in flight right now. */
  syncing: boolean
  /** ISO instant the last award actually landed on the server. */
  lastSyncAt: string | null
  /** The most recent thing that went wrong, or null if the last pass was clean. */
  fault: SyncFault | null
}

/** An award the server has refused, with the reason and how often it has tried. */
export interface BlockedEvent {
  event: ScoreEvent
  fault: SyncFault
  attempts: number
}

/** What a forced pass achieved, beyond the state it left behind. */
export interface ForceSyncResult extends SyncState {
  /**
   * Awards that only got through once they were re-credited to the person
   * who pressed the button. Worth saying out loud: their attribution in the
   * audit log changed, and the note on each one records that it did.
   */
  recovered: number
}

/**
 * The extra surface a backed provider carries. Kept off `DataProvider` itself
 * so local-only mode does not have to pretend to have a network.
 */
export interface SyncCapableProvider {
  getSyncState(): SyncState
  /** Everything currently held back, joined with why. */
  getBlockedEvents(): Promise<BlockedEvent[]>
  /**
   * Retry everything now, held-back awards included, and re-read the shared
   * log. This is the "force sync" button: it clears the quarantine so every
   * queued award gets one more real attempt, whatever happened last time.
   *
   * `actorId` is the signed-in user. Given one, an award the server still
   * refuses is re-sent credited to them rather than left stranded — see
   * `repaired()` in SupabaseDataProvider for exactly what that rewrites
   * (one field) and what it never touches (everything that means anything).
   */
  forceSync(opts?: { actorId?: string }): Promise<ForceSyncResult>
}

export function isSyncCapable(dp: DataProvider): dp is DataProvider & SyncCapableProvider {
  return typeof (dp as Partial<SyncCapableProvider>).getSyncState === 'function'
}
