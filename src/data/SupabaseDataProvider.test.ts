import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseDataProvider } from './SupabaseDataProvider'
import { EVENTS_KEY } from './LocalStorageDataProvider'
import { MemoryOutbox } from './outbox'
import { fromRow, toRow, type RemoteEventStore, type ScoreEventInsert, type ScoreEventRow } from './remote'
import type { CategoryId, ScoreEvent, TeamId } from './types'

/**
 * The sync engine is tested against a fake RemoteEventStore and an in-memory
 * outbox — no network, no supabase-js client, no IndexedDB.
 * `window`/`navigator`/`localStorage` are stubbed because vitest runs in a
 * node environment.
 */

let n = 0
const ev = (
  teamId: TeamId = 'gems',
  dayId = 'day1',
  categoryId: CategoryId = 'good_deed',
  deltaDeci = 10,
): ScoreEvent => ({
  id: `evt-${++n}`,
  occurredAt: '2026-08-20T09:00:00.000Z',
  dayId,
  teamId,
  categoryId,
  deltaDeci,
  note: null,
  actorId: 'leader-1',
  deviceId: 'test-device',
  reversesEventId: null,
  syncedAt: null,
})

const asRow = (e: ScoreEvent, createdAt = '2026-08-20T09:00:01.000Z'): ScoreEventRow => ({
  ...toRow(e),
  created_at: createdAt,
})

class FakeRemote implements RemoteEventStore {
  rows: ScoreEventRow[] = []
  upsertCalls: ScoreEventInsert[][] = []
  failUpsert = false
  private cb: ((row: ScoreEventRow) => void) | null = null

  async fetchAll(): Promise<ScoreEventRow[]> {
    return this.rows
  }

  async upsert(rows: ScoreEventInsert[]): Promise<void> {
    this.upsertCalls.push(rows)
    if (this.failUpsert) throw new Error('offline')
    const now = new Date().toISOString()
    for (const r of rows) {
      if (!this.rows.some((x) => x.id === r.id)) this.rows.push({ ...r, created_at: now })
    }
  }

  onInsert(cb: (row: ScoreEventRow) => void): void {
    this.cb = cb
  }

  /** Simulate a row arriving from another device via realtime. */
  emit(row: ScoreEventRow): void {
    this.cb?.(row)
  }

  close(): void {}
}

function storageStub() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size
    },
  }
}

let provider: SupabaseDataProvider
let remote: FakeRemote
let outbox: MemoryOutbox

beforeEach(() => {
  vi.stubGlobal('localStorage', storageStub())
  vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} })
  vi.stubGlobal('navigator', { onLine: true })
  remote = new FakeRemote()
  outbox = new MemoryOutbox()
  provider = new SupabaseDataProvider(remote, outbox)
})

afterEach(() => {
  provider.close()
  vi.unstubAllGlobals()
})

describe('SupabaseDataProvider', () => {
  it('appends instantly and keeps the event pending while offline', async () => {
    remote.failUpsert = true
    const listener = vi.fn()
    provider.subscribe(listener)

    await provider.appendEvent(ev())
    await provider.flush() // join the in-flight run; the upsert fails

    const events = await provider.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].syncedAt).toBeNull()
    expect(listener).toHaveBeenCalled()
  })

  it('flushes the outbox once back online and stamps syncedAt', async () => {
    remote.failUpsert = true
    const e = ev()
    await provider.appendEvent(e)
    await provider.flush()
    expect((await provider.getEvents())[0].syncedAt).toBeNull()

    remote.failUpsert = false
    await provider.flush()

    const events = await provider.getEvents()
    expect(events[0].syncedAt).not.toBeNull()
    expect(remote.rows).toHaveLength(1)
    // snake_case mapping, and the client never sends created_at
    expect(remote.upsertCalls.at(-1)?.[0]).toMatchObject({
      id: e.id,
      day_id: 'day1',
      team_id: 'gems',
      delta: 10,
    })
    expect(remote.upsertCalls.at(-1)?.[0]).not.toHaveProperty('created_at')
  })

  it('is idempotent by event id — a retry is a no-op, not a double award', async () => {
    const e = ev()
    await provider.appendEvents([e, e])
    await provider.appendEvent(e)
    expect(await provider.getEvents()).toHaveLength(1)

    await provider.flush()
    expect(remote.rows).toHaveLength(1)
    expect(remote.upsertCalls[0]).toHaveLength(1)
  })

  it('writes awards to the outbox first and drains it on flush', async () => {
    remote.failUpsert = true
    await provider.appendEvent(ev())
    // Durable before any network attempt — the airplane-mode guarantee.
    await vi.waitFor(async () => expect(await outbox.all()).toHaveLength(1))

    remote.failUpsert = false
    await provider.flush()
    expect(await outbox.all()).toHaveLength(0)
    expect(remote.rows).toHaveLength(1)
  })

  it('merges realtime inserts from other devices and notifies once', async () => {
    const listener = vi.fn()
    provider.subscribe(listener)
    await provider.getEvents() // start

    const incoming = asRow(ev('knights'))
    const before = listener.mock.calls.length
    remote.emit(incoming)

    const events = await provider.getEvents()
    expect(events.map((e) => e.id)).toEqual([incoming.id])
    expect(events[0].syncedAt).toBe(incoming.created_at)
    expect(listener.mock.calls.length).toBe(before + 1)

    // A duplicate delivery changes nothing and stays silent.
    remote.emit(incoming)
    expect(listener.mock.calls.length).toBe(before + 1)
    expect(await provider.getEvents()).toHaveLength(1)
  })

  it('marks a pending event synced when the server copy arrives', async () => {
    remote.failUpsert = true // stay pending locally
    const e = ev()
    await provider.appendEvent(e)
    await provider.flush()
    expect((await provider.getEvents())[0].syncedAt).toBeNull()

    remote.emit(asRow(e)) // another tab/device already pushed it
    const events = await provider.getEvents()
    expect(events).toHaveLength(1)
    expect(events[0].syncedAt).not.toBeNull()
  })

  it('merges the server log fetched on boot', async () => {
    const a = ev('pearls')
    const b = ev('forged')
    remote.rows = [asRow(a), asRow(b)]
    await provider.getEvents() // start triggers the boot fetch
    await vi.waitFor(async () => {
      expect((await provider.getEvents()).map((e) => e.id).sort()).toEqual([a.id, b.id].sort())
    })
    expect((await provider.getEvents()).every((e) => e.syncedAt !== null)).toBe(true)
  })

  it('drops Phase-0 seed events so mock data never reaches the backend', async () => {
    const real = ev()
    localStorage.setItem(
      EVENTS_KEY,
      JSON.stringify([{ ...ev(), id: 'seed-day1-gems-good_deed' }, real]),
    )

    const p = new SupabaseDataProvider(remote, new MemoryOutbox())
    const events = await p.getEvents() // start runs the one-time migration
    expect(events.map((e) => e.id)).toEqual([real.id])

    await p.flush()
    expect(remote.rows.map((r) => r.id)).toEqual([real.id])
    p.close()
  })
})

describe('row mapping', () => {
  it('round-trips camelCase ScoreEvent <-> snake_case row', () => {
    const e = { ...ev(), note: 'Evening gathering' }
    const row = asRow(e)
    expect(row).toMatchObject({
      id: e.id,
      occurred_at: e.occurredAt,
      day_id: e.dayId,
      team_id: e.teamId,
      category_id: e.categoryId,
      delta: e.deltaDeci,
      note: e.note,
      actor_id: e.actorId,
      device_id: e.deviceId,
      reverses_event_id: null,
    })
    expect(toRow(e)).not.toHaveProperty('created_at')
    expect(fromRow(row)).toEqual({ ...e, syncedAt: row.created_at })
  })
})
