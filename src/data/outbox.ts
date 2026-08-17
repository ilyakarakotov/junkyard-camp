import type { ScoreEvent } from './types'

/**
 * The offline outbox. Every award is written here FIRST, before any network
 * attempt, so a dead zone at morning line-up can neither lose points nor
 * block a helper. The flusher drains it (idempotent upsert by client UUID)
 * on every write, on `window.online`, and on a 15s interval while anything
 * is pending.
 *
 * Spec'd as IndexedDB; the interface keeps the sync engine testable without a
 * browser (MemoryOutbox) and leaves the door open to a different durable
 * store. The full event cache lives separately in localStorage.
 */
export interface OutboxStore {
  /** Add events (or refresh an existing id's payload). */
  put(events: ScoreEvent[]): Promise<void>
  /** Everything still waiting to reach the server, in insertion order. */
  all(): Promise<ScoreEvent[]>
  /** Drop successfully flushed ids. */
  delete(ids: string[]): Promise<void>
  close(): void
}

const DB_NAME = 'jr-outbox'
const STORE = 'events'

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

/** Durable outbox over IndexedDB. No dependencies, one object store. */
export class IdbOutbox implements OutboxStore {
  private dbp: Promise<IDBDatabase>

  constructor() {
    this.dbp = new Promise((resolve, reject) => {
      const open = indexedDB.open(DB_NAME, 1)
      open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' })
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
  }

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.dbp
    return db.transaction(STORE, mode).objectStore(STORE)
  }

  async put(events: ScoreEvent[]): Promise<void> {
    const s = await this.store('readwrite')
    for (const e of events) s.put(e)
    await new Promise<void>((resolve, reject) => {
      s.transaction.oncomplete = () => resolve()
      s.transaction.onerror = () => reject(s.transaction.error)
    })
  }

  async all(): Promise<ScoreEvent[]> {
    const s = await this.store('readonly')
    return (await req(s.getAll())) as ScoreEvent[]
  }

  async delete(ids: string[]): Promise<void> {
    const s = await this.store('readwrite')
    for (const id of ids) s.delete(id)
    await new Promise<void>((resolve, reject) => {
      s.transaction.oncomplete = () => resolve()
      s.transaction.onerror = () => reject(s.transaction.error)
    })
  }

  close(): void {
    void this.dbp.then((db) => db.close()).catch(() => {})
  }
}

/** In-memory outbox for tests and non-DOM environments. */
export class MemoryOutbox implements OutboxStore {
  private map = new Map<string, ScoreEvent>()

  async put(events: ScoreEvent[]): Promise<void> {
    for (const e of events) this.map.set(e.id, e)
  }

  async all(): Promise<ScoreEvent[]> {
    return [...this.map.values()]
  }

  async delete(ids: string[]): Promise<void> {
    for (const id of ids) this.map.delete(id)
  }

  close(): void {}
}
