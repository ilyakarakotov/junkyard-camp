import type { DataProvider } from './DataProvider'
import type { AppUser, Category, Day, ScoreEvent, Team } from './types'
import { EVENTS_KEY, SETTING_PREFIX } from './LocalStorageDataProvider'
import { inEpoch } from './epoch'
import { CATEGORIES, DAYS, TEAMS } from './seed'
import { IdbOutbox, type OutboxStore } from './outbox'
import {
  createSupabaseEventStore,
  fromRow,
  getSupabaseClient,
  RemoteWriteError,
  toRow,
  type RemoteEventStore,
} from './remote'

const FLUSH_MS = 15_000

/**
 * Rows the server has refused for a reason that will not change on its own.
 * Kept OUT of the batch (see flushOnce) and retried one at a time, and kept in
 * localStorage so the reason survives the restart a leader will certainly try.
 */
const BLOCKED_KEY = 'jr:sync-blocked'

export interface BlockedRow {
  code: string | null
  message: string
  /** Wording for a leader rather than for Postgres. */
  plain: string
  at: string
}

export interface SyncState {
  online: boolean
  /** Events still in the outbox — everything not yet on the server. */
  pending: number
  /** Of those, the ones the server actively refuses. */
  blocked: number
  /** True while a flush is in flight, so a retry button can say so. */
  syncing: boolean
  /** Why the last attempt failed, or null if the last one was clean. */
  lastError: BlockedRow | null
  /** When something last reached the server. */
  lastSyncedAt: string | null
  /**
   * Blocked rows recorded under somebody else's sign-in. These are the ones
   * `repairActor` can rescue, and the count is what the UI offers to fix.
   */
  wrongActor: number
}

/** Phase-0 mock camp state must never reach the real backend. */
const isSeedEvent = (e: ScoreEvent) => e.id.startsWith('seed-')

/**
 * Phase 1 storage: a localStorage mirror the UI always reads (instant,
 * offline-safe), an IndexedDB outbox every award is written to FIRST, and
 * Supabase as the shared replica behind both.
 *
 * - Writes land in the outbox (durable) and the mirror (immediate UI) before
 *   any network attempt. The flusher drains the outbox on every write, on
 *   `window.online`, and on a 15s interval while anything is pending, via an
 *   upsert idempotent by client-generated UUID — a retry can never
 *   double-award. Scoring is never blocked by the network.
 * - A realtime INSERT subscription merges other leaders' events into the
 *   mirror, so several leaders can score at once and the big screen stays
 *   live within about a second.
 * - The roster stays static seed data: it is fixed camp data that must work
 *   offline anyway (the same rows are seeded into Supabase for the FKs).
 *
 * Construction is side-effect-light; the network and the database open on
 * first use (`ensureStarted`), so a discarded StrictMode render opens nothing.
 */
export class SupabaseDataProvider implements DataProvider {
  private listeners = new Set<() => void>()
  private cache: ScoreEvent[] | null = null
  /** undefined = not yet attempted (lazy); null = unavailable. */
  private store: RemoteEventStore | null | undefined
  private outboxStore: OutboxStore | null | undefined
  private started = false
  private timer: ReturnType<typeof setInterval> | null = null
  private online = true

  private flushing = false
  private flushQueued = false
  private inFlight: Promise<void> = Promise.resolve()

  private blocked = new Map<string, BlockedRow>()
  private blockedLoaded = false
  private lastError: BlockedRow | null = null
  private lastSyncedAt: string | null = null
  /** Actor ids on blocked rows, so the UI can offer to re-stamp them. */
  private blockedActors = new Map<string, string>()

  constructor(store?: RemoteEventStore | null, outbox?: OutboxStore | null) {
    this.store = store
    this.outboxStore = outbox
  }

  private remote(): RemoteEventStore | null {
    if (this.store === undefined) this.store = createSupabaseEventStore()
    return this.store
  }

  private outbox(): OutboxStore | null {
    if (this.outboxStore === undefined) this.outboxStore = new IdbOutbox()
    return this.outboxStore
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

  async getEvents(): Promise<ScoreEvent[]> {
    this.ensureStarted()
    return this.read()
  }

  /** The staff directory from app_users — the audit log's actor names. */
  async getUsers(): Promise<AppUser[]> {
    const supabase = getSupabaseClient()
    if (!supabase) return []
    const { data, error } = await supabase
      .from('app_users')
      .select('id, username, display_name, role')
    if (error || !data) return []
    return data.map((r) => ({
      id: r.id as string,
      username: r.username as string,
      displayName: r.display_name as string,
      role: r.role as AppUser['role'],
    }))
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
    await this.outbox()?.put(fresh) // durable FIRST — then local state
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

  /**
   * Extra surface beyond DataProvider, for the unsynced chrome and the sync
   * panel. `currentActorId` is who is signed in: without it `wrongActor`
   * would count every policy rejection, and offer a "re-submit as me" button
   * that re-stamps nothing because the rows already carry that actor.
   */
  getSyncState(currentActorId?: string): SyncState {
    this.loadBlocked()
    const unsynced = this.read().filter((e) => e.syncedAt === null)
    const wrongActor = currentActorId
      ? [...this.blockedActors.values()].filter((a) => a !== currentActorId).length
      : 0
    return {
      online: this.online,
      pending: unsynced.length,
      blocked: this.blocked.size,
      syncing: this.flushing,
      lastError: this.lastError,
      lastSyncedAt: this.lastSyncedAt,
      wrongActor,
    }
  }

  /**
   * Re-stamp blocked awards to the person signed in on this device and push
   * them again.
   *
   * This exists because of what actually happened at camp: a phone signed in
   * as one leader, scored, then signed in as another. Every award from the
   * first session carries the first actor's id, and the RLS policy requires
   * `actor_id = auth.uid()` — so those rows are refused for as long as the
   * phone lives, and under the old all-or-nothing flush they took every later
   * award down with them.
   *
   * Re-stamping is a deliberate, human-triggered act, never automatic. It
   * changes who the log says awarded the point, so it must be a choice
   * somebody makes with their eyes open — and the alternative is real points
   * that the scoreboard can never record. The person tapping it is the person
   * signed in, vouching for awards their own device captured.
   */
  async repairActor(actorId: string): Promise<number> {
    this.loadBlocked()
    const outbox = this.outbox()
    if (!outbox || this.blockedActors.size === 0) return 0
    const ids = new Set(
      [...this.blockedActors.entries()].filter(([, a]) => a !== actorId).map(([id]) => id),
    )
    if (ids.size === 0) return 0
    const pending = await outbox.all()
    const fixed = pending.filter((e) => ids.has(e.id)).map((e) => ({ ...e, actorId }))
    if (fixed.length === 0) return 0
    await outbox.put(fixed)
    // The mirror carries the same actor, so the audit log agrees with the row
    // the server is about to receive.
    const byId = new Map(fixed.map((e) => [e.id, e]))
    this.write(this.read().map((e) => byId.get(e.id) ?? e))
    // Unblock so the next flush actually tries them.
    for (const id of ids) {
      this.blocked.delete(id)
      this.blockedActors.delete(id)
    }
    this.saveBlocked()
    this.notify()
    await this.flush()
    return fixed.length
  }

  /** Push everything in the outbox. Re-entrant: callers join the in-flight run. */
  flush(): Promise<void> {
    if (this.flushing) {
      this.flushQueued = true
      return this.inFlight
    }
    this.flushing = true
    this.notify()
    this.inFlight = (async () => {
      try {
        do {
          this.flushQueued = false
          await this.flushOnce()
        } while (this.flushQueued)
      } catch (err) {
        // `void this.flush()` is called from four places; an escaping
        // rejection there is an unhandled promise rejection every 15s and
        // tells nobody anything. Record it where the UI can read it instead.
        this.recordError(err)
      } finally {
        this.flushing = false
        this.notify()
      }
    })()
    return this.inFlight
  }

  /** Tear down timers, listeners, the realtime channel and the database. */
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
    this.outboxStore?.close()
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
    // Realtime registration is synchronous: an insert that lands while the
    // async boot chain is still reconciling must not be missed.
    if (remote) remote.onInsert((row) => this.mergeRemote([fromRow(row)]))
    void (async () => {
      // Each step is guarded: a phone whose IndexedDB is gone (private
      // browsing, evicted storage) used to reject out of this chain, which
      // skipped the server refresh AND the first flush entirely.
      try {
        await this.reconcileOutbox()
      } catch {
        // nothing reconcilable — the mirror is still on screen
      }
      await this.refreshFromServer()
      await this.flush()
    })()
    if (remote) this.timer = setInterval(() => void this.flush(), FLUSH_MS)
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

  /**
   * One-time migration: Phase-0 mock events are not real camp data, and
   * neither is anything that happened before the data epoch — a rehearsal
   * score carried over from a previous build (src/data/epoch.ts).
   */
  private dropSeedEvents(): void {
    const events = this.read()
    const keep = events.filter((e) => !isSeedEvent(e) && inEpoch(e))
    if (keep.length !== events.length) this.write(keep)
  }

  /**
   * The outbox and the mirror must agree. Both directions are healed here:
   * outbox events missing from the mirror (a crash between the two writes)
   * are merged in, and unsynced mirror events missing from the outbox are
   * re-queued.
   */
  private async reconcileOutbox(): Promise<void> {
    const outbox = this.outbox()
    if (!outbox) return
    const all = await outbox.all()
    // A rehearsal award queued on a phone that never came back online must
    // not reach Postgres days later, and must not be merged back into a
    // mirror the epoch just cleared. Dropped from the outbox, not merely
    // skipped, so it cannot be reconsidered on the next boot.
    const stale = all.filter((e) => !inEpoch(e))
    if (stale.length > 0) await outbox.delete(stale.map((e) => e.id))
    const pending = all.filter(inEpoch)
    const pendingIds = new Set(pending.map((e) => e.id))
    const mirrorIds = new Set(this.read().map((e) => e.id))
    const missing = pending.filter((e) => !mirrorIds.has(e.id))
    if (missing.length > 0) {
      this.write(
        [...this.read(), ...missing].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
      )
      this.notify()
    }
    const stranded = this.read().filter((e) => e.syncedAt === null && !pendingIds.has(e.id))
    if (stranded.length > 0) await outbox.put(stranded)
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
   * still unsynced (the server's `created_at` is authoritative). The mirror
   * stays sorted by occurredAt, matching seed.ts.
   */
  private mergeRemote(incoming: ScoreEvent[]): void {
    /*
     * The shared log is the one place a cleared device can be re-seeded from:
     * a phone wiped by the epoch fetches the server on boot and merges
     * whatever is there. `supabase/reset-camp.sql` empties that table, but
     * the client must converge to zero whether or not it has been run — so
     * pre-epoch rows are ignored here rather than trusted.
     */
    const remoteEvents = incoming.filter(inEpoch)
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

  /**
   * One drain of the outbox.
   *
   * ONE BAD ROW MUST NEVER HOLD THE REST HOSTAGE. This used to send the whole
   * outbox as a single upsert and swallow any error with a bare `catch {}`. A
   * batch insert is one statement, so a row the policy refuses fails all of
   * them — and a phone at camp sat on two days of real awards, retrying the
   * same doomed batch every fifteen seconds, with nothing on screen, in the
   * console or in the log to say why. Both halves of that are fixed here:
   * failures are classified rather than swallowed, and a permanent rejection
   * drops to one row at a time so the good awards get through and only the
   * genuinely bad row is held back.
   */
  private async flushOnce(): Promise<void> {
    const remote = this.remote()
    const outbox = this.outbox()
    if (!remote || !outbox) return
    this.loadBlocked()

    let pending: ScoreEvent[]
    try {
      pending = await outbox.all()
    } catch {
      // The durable store itself is unavailable (private browsing, evicted
      // storage). Nothing to do, and it must not reject the flush.
      return
    }
    if (pending.length === 0) {
      if (this.lastError) {
        this.lastError = null
        this.notify()
      }
      return
    }

    // Quarantined rows never travel with the batch again.
    const batch = pending.filter((e) => !this.blocked.has(e.id))
    const held = pending.filter((e) => this.blocked.has(e.id))

    if (batch.length > 0) {
      try {
        await remote.upsert(batch.map(toRow))
        await this.settle(outbox, batch)
      } catch (err) {
        if (!(err instanceof RemoteWriteError) || !err.permanent) {
          // Offline, or the server had a moment. The whole batch waits.
          this.recordError(err)
          return
        }
        // Something in there is poison. Find out what, one row at a time, so
        // every award that CAN land does — today, not after someone notices.
        this.recordError(err)
        for (const e of batch) {
          if (!(await this.pushOne(remote, outbox, e))) break
        }
      }
    }

    // Retry the held rows individually. A row blocked because its day was not
    // open yet heals itself the moment that day opens, so quarantine has to be
    // a state a row can leave on its own.
    for (const e of held) {
      if (!(await this.pushOne(remote, outbox, e))) break
    }
    this.notify()
  }

  /**
   * Push a single event. Returns false when the failure was a network one, so
   * the caller stops rather than grinding through the rest of the outbox
   * against a server that is not answering.
   */
  private async pushOne(
    remote: RemoteEventStore,
    outbox: OutboxStore,
    e: ScoreEvent,
  ): Promise<boolean> {
    try {
      await remote.upsert([toRow(e)])
    } catch (err) {
      if (!(err instanceof RemoteWriteError) || !err.permanent) {
        this.recordError(err)
        return false
      }
      this.blocked.set(e.id, {
        code: err.code,
        message: err.message,
        plain: err.plain,
        at: new Date().toISOString(),
      })
      // Only an actor mismatch is repairable from the phone, and only a 42501
      // can be one — anything else needs a person who knows the camp.
      if (err.code === '42501') this.blockedActors.set(e.id, e.actorId)
      this.saveBlocked()
      return true
    }
    if (this.blocked.delete(e.id)) {
      this.blockedActors.delete(e.id)
      this.saveBlocked()
    }
    await this.settle(outbox, [e])
    return true
  }

  /** A row is on the server: out of the outbox, stamped in the mirror. */
  private async settle(outbox: OutboxStore, rows: ScoreEvent[]): Promise<void> {
    await outbox.delete(rows.map((e) => e.id))
    const stamp = new Date().toISOString()
    const done = new Set(rows.map((e) => e.id))
    this.write(this.read().map((e) => (done.has(e.id) ? { ...e, syncedAt: stamp } : e)))
    this.lastSyncedAt = stamp
    this.lastError = null
    this.notify()
  }

  private recordError(err: unknown): void {
    const w = err instanceof RemoteWriteError ? err : null
    this.lastError = {
      code: w?.code ?? null,
      message: w?.message ?? (err instanceof Error ? err.message : 'Could not reach the server'),
      plain: w?.plain ?? 'Could not reach the server.',
      at: new Date().toISOString(),
    }
    this.notify()
  }

  private loadBlocked(): void {
    if (this.blockedLoaded) return
    this.blockedLoaded = true
    try {
      const raw = JSON.parse(localStorage.getItem(BLOCKED_KEY) ?? '{}') as Record<
        string,
        BlockedRow & { actorId?: string }
      >
      for (const [id, v] of Object.entries(raw)) {
        this.blocked.set(id, { code: v.code, message: v.message, plain: v.plain, at: v.at })
        if (v.actorId) this.blockedActors.set(id, v.actorId)
      }
    } catch {
      // A corrupt quarantine file is not worth failing sync over — the rows
      // are still in the outbox and will simply be re-classified.
    }
  }

  private saveBlocked(): void {
    const out: Record<string, BlockedRow & { actorId?: string }> = {}
    for (const [id, v] of this.blocked) {
      out[id] = { ...v, actorId: this.blockedActors.get(id) }
    }
    try {
      localStorage.setItem(BLOCKED_KEY, JSON.stringify(out))
    } catch {
      // Quota. The in-memory map still holds for this session.
    }
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
