import type { DataProvider } from './DataProvider'
import type { Activity, Category, Day, ScoreEvent, Team } from './types'
import { EVENTS_KEY, SETTING_PREFIX } from './LocalStorageDataProvider'
import { ACTIVITIES, CATEGORIES, DAYS, TEAMS } from './seed'
import {
  createSupabaseEventStore,
  fromRow,
  toRow,
  type RemoteEventStore,
} from './remote'

const FLUSH_MS = 15_000

/** Phase-0 mock camp state must never reach the real backend. */
const isSeedEvent = (e: ScoreEvent) => e.id.startsWith('seed-')

/**
 * Phase 1 storage: a localStorage mirror the UI always reads (instant,
 * offline-safe), with Supabase as the shared replica behind it.
 *
 * - Writes land in the mirror first and notify immediately; anything with
 *   `syncedAt: null` is the outbox and is pushed on every append, on
 *   `online`, on a 15s interval, and on boot. Push is an idempotent upsert by
 *   client-generated UUID, so a retry can never double-award.
 * - A realtime INSERT subscription merges other leaders' events into the
 *   mirror, so several leaders can score at once and the big screen stays
 *   live.
 * - The roster stays static seed data: it is fixed camp data that must work
 *   offline anyway.
 *
 * Construction is side-effect-light; the network starts on first use
 * (`ensureStarted`), so a discarded StrictMode render opens no channel.
 */
export class SupabaseDataProvider implements DataProvider {
  private listeners = new Set<() => void>()
  private cache: ScoreEvent[] | null = null
  /** undefined = not yet attempted (lazy); null = unavailable. */
  private store: RemoteEventStore | null | undefined
  private started = false
  private timer: ReturnType<typeof setInterval> | null = null
  private online = true

  private flushing = false
  private flushQueued = false
  private inFlight: Promise<void> = Promise.resolve()

  constructor(store?: RemoteEventStore | null) {
    this.store = store
  }

  private remote(): RemoteEventStore | null {
    if (this.store === undefined) this.store = createSupabaseEventStore()
    return this.store
  }

  async getTeams(): Promise<Team[]> {
    return TEAMS
  }

  async getDays(): Promise<Day[]> {
    return DAYS
  }

  async getCategories(): Promise<Category[]> {
    return CATEGORIES
  }

  async getActivities(): Promise<Activity[]> {
    return ACTIVITIES
  }

  async getEvents(): Promise<ScoreEvent[]> {
    this.ensureStarted()
    return this.read()
  }

  async appendEvent(event: ScoreEvent): Promise<void> {
    return this.appendEvents([event])
  }

  async appendEvents(incoming: ScoreEvent[]): Promise<void> {
    this.ensureStarted()
    const events = this.read()
    // Idempotent by event id — both against the mirror and within the batch.
    const known = new Set(events.map((e) => e.id))
    const fresh: ScoreEvent[] = []
    for (const e of incoming) {
      if (known.has(e.id)) continue
      known.add(e.id)
      fresh.push(e)
    }
    if (fresh.length === 0) return
    this.write([...events, ...fresh])
    this.notify()
    void this.flush()
  }

  async getSetting(key: string): Promise<string | null> {
    return localStorage.getItem(SETTING_PREFIX + key)
  }

  async setSetting(key: string, value: string): Promise<void> {
    localStorage.setItem(SETTING_PREFIX + key, value)
    this.notify()
  }

  subscribe(listener: () => void): () => void {
    this.ensureStarted()
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /** Extra surface beyond DataProvider, for the board footer's sync readout. */
  getSyncState(): { online: boolean } {
    return { online: this.online }
  }

  /** Push every unsynced event. Re-entrant: callers join the in-flight run. */
  flush(): Promise<void> {
    if (this.flushing) {
      this.flushQueued = true
      return this.inFlight
    }
    this.flushing = true
    this.inFlight = (async () => {
      try {
        do {
          this.flushQueued = false
          await this.flushOnce()
        } while (this.flushQueued)
      } finally {
        this.flushing = false
      }
    })()
    return this.inFlight
  }

  /** Tear down timers, listeners and the realtime channel. Tests use this. */
  close(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
    if (this.started) {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
      window.removeEventListener('storage', this.handleStorage)
    }
    this.started = false
    this.store?.close()
  }

  // -------------------------------------------------------------------------

  private ensureStarted(): void {
    if (this.started) return
    this.started = true
    this.dropSeedEvents()
    this.online = navigator.onLine
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)
    window.addEventListener('storage', this.handleStorage)
    const remote = this.remote()
    if (!remote) return
    remote.onInsert((row) => this.mergeRemote([fromRow(row)]))
    void this.refreshFromServer().then(() => this.flush())
    this.timer = setInterval(() => void this.flush(), FLUSH_MS)
  }

  private handleOnline = (): void => {
    this.online = true
    this.notify()
    void this.refreshFromServer().then(() => this.flush())
  }

  private handleOffline = (): void => {
    this.online = false
    this.notify()
  }

  private handleStorage = (e: StorageEvent): void => {
    if (e.key === EVENTS_KEY) {
      this.cache = null
      this.notify()
    }
  }

  /** One-time migration: Phase-0 mock events are not real camp data. */
  private dropSeedEvents(): void {
    const events = this.read()
    if (events.some(isSeedEvent)) this.write(events.filter((e) => !isSeedEvent(e)))
  }

  private async refreshFromServer(): Promise<void> {
    const remote = this.remote()
    if (!remote) return
    try {
      const rows = await remote.fetchAll()
      this.mergeRemote(rows.map(fromRow))
    } catch {
      // Offline or server error — the mirror is already on screen; retry on
      // the next trigger.
    }
  }

  /**
   * Union by id; a server row beats a local copy only when the local one is
   * still unsynced (the server's `syncedAt` is authoritative). The mirror
   * stays sorted by occurredAt, matching seed.ts.
   */
  private mergeRemote(remoteEvents: ScoreEvent[]): void {
    if (remoteEvents.length === 0) return
    const byId = new Map(this.read().map((e) => [e.id, e]))
    let changed = false
    for (const e of remoteEvents) {
      const cur = byId.get(e.id)
      if (!cur || (cur.syncedAt === null && e.syncedAt !== null)) {
        byId.set(e.id, e)
        changed = true
      }
    }
    if (!changed) return
    this.write([...byId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)))
    this.notify()
  }

  private async flushOnce(): Promise<void> {
    const remote = this.remote()
    if (!remote) return
    const pending = this.read().filter((e) => e.syncedAt === null)
    if (pending.length === 0) return
    try {
      await remote.upsert(pending.map(toRow))
    } catch {
      return // still offline — events stay pending, nothing is lost
    }
    const stamp = new Date().toISOString()
    const done = new Set(pending.map((e) => e.id))
    this.write(this.read().map((e) => (done.has(e.id) ? { ...e, syncedAt: stamp } : e)))
    this.notify()
  }

  private read(): ScoreEvent[] {
    if (this.cache) return this.cache
    try {
      this.cache = JSON.parse(localStorage.getItem(EVENTS_KEY) ?? '[]') as ScoreEvent[]
    } catch {
      this.cache = []
    }
    return this.cache
  }

  private write(events: ScoreEvent[]): void {
    this.cache = events
    localStorage.setItem(EVENTS_KEY, JSON.stringify(events))
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}
