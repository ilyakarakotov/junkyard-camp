import type { BlockedEvent, DataProvider, SyncCapableProvider, SyncState } from './DataProvider'
import type { AppUser, Category, Day, ScoreEvent, Team } from './types'
import { EVENTS_KEY, SETTING_PREFIX } from './LocalStorageDataProvider'
import { BLOCKED_KEY, inEpoch } from './epoch'
import { CATEGORIES, DAYS, TEAMS } from './seed'
import { IdbOutbox, type OutboxStore } from './outbox'
import { faultOf, isTransient, type SyncFault } from './syncFault'
import {
  createSupabaseEventStore,
  fromRow,
  getSupabaseClient,
  toRow,
  type RemoteEventStore,
} from './remote'

const FLUSH_MS = 15_000

interface BlockRecord {
  fault: SyncFault
  attempts: number
}

/**
 * How many times an unrecognised refusal is retried automatically before the
 * award is held back.
 *
 * A fault we can name as the row's own (RLS refused it, the server cannot
 * parse it, it points at a row that does not exist) is held on the first
 * refusal — asking again changes nothing, and every award behind it is
 * waiting. A fault we cannot name might be a 502 from the edge or a proxy
 * having a moment, and quarantining that on sight would switch off exactly
 * the automatic recovery the outbox exists for. So it gets three passes on
 * its own — the good awards around it are already going through by then —
 * and only then stops being retried unattended.
 */
const UNKNOWN_ATTEMPTS_BEFORE_HOLD = 3

/** Whether the server has told us, in as many words, that this row is the problem. */
const isRowFault = (fault: SyncFault): boolean =>
  fault.kind === 'refused' || fault.kind === 'malformed' || fault.kind === 'missing-reference'

const isHeld = (rec: BlockRecord): boolean =>
  isRowFault(rec.fault) || rec.attempts >= UNKNOWN_ATTEMPTS_BEFORE_HOLD

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
 * - A rejected award never blocks the ones behind it. Postgres fails the whole
 *   statement over one bad row, so a batch that comes back refused is re-sent
 *   one award at a time: the good ones land, and only the row the server
 *   actually objects to is held back — with the reason it gave, on the sync
 *   screen, retryable by hand. Held back is not discarded: a quarantined award
 *   stays in the outbox and in the mirror until the server accepts it.
 * - A realtime INSERT subscription merges other leaders' events into the
 *   mirror, so several leaders can score at once and the big screen stays
 *   live within about a second.
 * - The roster stays static seed data: it is fixed camp data that must work
 *   offline anyway (the same rows are seeded into Supabase for the FKs).
 *
 * Construction is side-effect-light; the network and the database open on
 * first use (`ensureStarted`), so a discarded StrictMode render opens nothing.
 */
export class SupabaseDataProvider implements DataProvider, SyncCapableProvider {
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
  private forceNext = false
  private inFlight: Promise<void> = Promise.resolve()

  /** Awards the server refused, by event id. Held, never dropped. */
  private blocked = new Map<string, BlockRecord>()
  private blockedLoaded = false
  /** What went wrong on the last write attempt. */
  private fault: SyncFault | null = null
  /**
   * What went wrong on the last read of the shared log — tracked apart from
   * the write fault because an empty outbox has nothing to say about the link.
   * A phone that cannot even READ the log is the clearest evidence there is
   * that the bars are lying, and it must not be cleared by a flush that had
   * nothing to send.
   */
  private readFault: SyncFault | null = null
  private lastSyncAt: string | null = null
  /** Last state broadcast, so an idle tick does not re-render the big screen. */
  private lastSignature = ''
  private mirrorDirty = false

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
   * Sync health, for the sync screen and the unsynced chrome. `online` is
   * `navigator.onLine` and says only that the phone has a link — `fault` is
   * the field that says whether anything is actually getting through.
   */
  getSyncState(): SyncState {
    this.loadBlocked()
    return {
      online: this.online,
      blocked: this.heldIds().size,
      syncing: this.flushing,
      lastSyncAt: this.lastSyncAt,
      // A write fault is about awards and wins; a read fault stands in when
      // there is nothing queued to have failed.
      fault: this.fault ?? this.readFault,
    }
  }

  /**
   * Everything held back, joined with the reason the server gave. Awards
   * still being retried unattended are deliberately not listed: they are the
   * outbox doing its job, and a list that empties itself teaches leaders to
   * ignore the list.
   */
  async getBlockedEvents(): Promise<BlockedEvent[]> {
    this.loadBlocked()
    const held = this.heldIds()
    if (held.size === 0) return []
    const queued = (await this.outbox()?.all()) ?? []
    return queued
      .filter((e) => held.has(e.id))
      .map((event) => {
        const rec = this.blocked.get(event.id)!
        return { event, fault: rec.fault, attempts: rec.attempts }
      })
  }

  private heldIds(): Set<string> {
    const ids = new Set<string>()
    for (const [id, rec] of this.blocked) if (isHeld(rec)) ids.add(id)
    return ids
  }

  /**
   * The force-sync button. Re-reads the shared log, then retries every queued
   * award including the held-back ones — the quarantine is advice to the
   * background flusher, never a verdict, and a leader who has just signed in
   * as the right person (or walked to where the signal is) gets to overrule it.
   */
  async forceSync(): Promise<SyncState> {
    this.ensureStarted()
    this.online = navigator.onLine
    await this.reconcileOutbox()
    await this.refreshFromServer()
    await this.flush(true)
    return this.getSyncState()
  }

  /**
   * Push everything in the outbox. Re-entrant: callers join the in-flight run.
   * A forced pass raised while one is in flight is honoured by the next lap,
   * so `forceSync` awaiting this promise always gets its retry.
   */
  flush(force = false): Promise<void> {
    if (force) {
      this.forceNext = true
      this.flushQueued = true
    }
    if (this.flushing) return this.inFlight
    this.flushing = true
    this.inFlight = (async () => {
      try {
        do {
          this.flushQueued = false
          const forced = this.forceNext
          this.forceNext = false
          await this.flushOnce(forced)
        } while (this.flushQueued)
      } finally {
        this.flushing = false
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
      await this.reconcileOutbox()
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
      this.readFault = null
    } catch (err) {
      // The mirror is already on screen, so a failed read costs nothing — but
      // it is recorded rather than swallowed. "Cannot even read the log" is
      // the clearest signal there is that the phone's bars are lying, and it
      // is the first thing the sync screen should be able to say.
      this.readFault = faultOf(err)
    }
    this.settleState(this.fault)
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
   * One drain pass.
   *
   * The batch goes up as a single upsert, which is what makes a roll-call
   * commit one request. Postgres fails the whole statement over one bad row,
   * though, so a refusal here says nothing about WHICH award it objected to —
   * and the old code, which caught that and returned, let one unwritable award
   * hold every award behind it hostage indefinitely, retried every fifteen
   * seconds, with `▲ N UNSYNCED` as the only thing on screen.
   *
   * So a refusal is a question, not an answer: re-send the awards one at a
   * time and find out. The good ones land, the one the server actually
   * objects to is held back with its reason, and the queue moves again.
   *
   * A transient fault short-circuits all of that. There is nothing to single
   * out when the link is down, and firing N requests into a dead zone is how
   * you flatten a phone before the evening gathering.
   */
  private async flushOnce(force: boolean): Promise<void> {
    const remote = this.remote()
    const outbox = this.outbox()
    if (!remote || !outbox) return
    this.loadBlocked()

    const queued = await outbox.all()
    if (queued.length === 0) {
      this.blocked.clear()
      return this.settleState(null)
    }
    // A record outlives its award when the row arrives by realtime from
    // another device: the outbox drops it, so the reason has nothing left to
    // explain.
    const live = new Set(queued.map((e) => e.id))
    for (const id of [...this.blocked.keys()]) if (!live.has(id)) this.blocked.delete(id)

    const held = this.heldIds()
    const ready = force ? queued : queued.filter((e) => !held.has(e.id))
    if (ready.length === 0) return this.settleState(this.fault)

    try {
      await remote.upsert(ready.map(toRow))
      for (const e of ready) this.blocked.delete(e.id)
      await this.drain(ready, outbox)
      return this.settleState(null)
    } catch (err) {
      const fault = faultOf(err)
      if (isTransient(fault)) return this.settleState(fault)
      if (ready.length === 1) {
        this.block(ready[0], fault)
        return this.settleState(fault)
      }
      // One of these rows poisoned the statement. Fall through and find it.
    }

    const sent: ScoreEvent[] = []
    let last: SyncFault | null = null
    for (const e of ready) {
      try {
        await remote.upsert([toRow(e)])
        sent.push(e)
        this.blocked.delete(e.id)
      } catch (err) {
        const fault = faultOf(err)
        // The link died mid-pass: stop, keep what landed, hold nothing
        // against the rows we never got to ask about.
        if (isTransient(fault)) {
          last = fault
          break
        }
        this.block(e, fault)
        last = fault
      }
    }
    if (sent.length > 0) await this.drain(sent, outbox)
    this.settleState(last)
  }

  /** Clear the outbox of what landed and stamp it synced in the mirror. */
  private async drain(sent: ScoreEvent[], outbox: OutboxStore): Promise<void> {
    await outbox.delete(sent.map((e) => e.id))
    const stamp = new Date().toISOString()
    const done = new Set(sent.map((e) => e.id))
    this.write(this.read().map((e) => (done.has(e.id) ? { ...e, syncedAt: stamp } : e)))
    this.lastSyncAt = stamp
    this.mirrorDirty = true
    // Writing proves the link: whatever the last read said is now stale.
    this.readFault = null
  }

  /**
   * Hold one award back. The event itself stays exactly where it is — in the
   * outbox and in the mirror; all that is recorded here is why it did not go
   * and how many times it has been asked.
   */
  private block(event: ScoreEvent, fault: SyncFault): void {
    const prev = this.blocked.get(event.id)
    this.blocked.set(event.id, { fault, attempts: (prev?.attempts ?? 0) + 1 })
  }

  /**
   * Publish the outcome of a pass — but only when there is one.
   *
   * The flusher wakes every fifteen seconds for the whole camp. Notifying on
   * each of those ticks re-renders every screen subscribed to the store,
   * including the big screen with its arcs running, to say nothing has
   * changed. So the state is broadcast on a change and silent otherwise.
   */
  private settleState(fault: SyncFault | null): void {
    this.fault = fault
    this.saveBlocked()
    const shown = fault ?? this.readFault
    const sig = [
      this.online,
      this.heldIds().size,
      this.lastSyncAt,
      shown?.kind ?? '',
      shown?.code ?? '',
      shown?.message ?? '',
    ].join('|')
    const changed = this.mirrorDirty || sig !== this.lastSignature
    this.lastSignature = sig
    this.mirrorDirty = false
    if (changed) this.notify()
  }

  private loadBlocked(): void {
    if (this.blockedLoaded) return
    this.blockedLoaded = true
    try {
      const raw = localStorage.getItem(BLOCKED_KEY)
      if (!raw) return
      this.blocked = new Map(Object.entries(JSON.parse(raw) as Record<string, BlockRecord>))
    } catch {
      // A reason is an explanation, not camp data. Losing it costs a sentence.
    }
  }

  private saveBlocked(): void {
    this.blockedLoaded = true
    try {
      if (this.blocked.size === 0) localStorage.removeItem(BLOCKED_KEY)
      else localStorage.setItem(BLOCKED_KEY, JSON.stringify(Object.fromEntries(this.blocked)))
    } catch {
      // Quota or private browsing: the quarantine still works for this session.
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
