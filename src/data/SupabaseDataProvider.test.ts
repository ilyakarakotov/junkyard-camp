import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseDataProvider } from './SupabaseDataProvider'
import { EVENTS_KEY } from './LocalStorageDataProvider'
import { MemoryOutbox } from './outbox'
import {
  fromRow,
  RemoteWriteError,
  toRow,
  type RemoteEventStore,
  type ScoreEventInsert,
  type ScoreEventRow,
} from './remote'
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
  /**
   * Stands in for the RLS policy: a row this predicate rejects raises 42501,
   * exactly as Postgres does — and, as in Postgres, it fails the WHOLE
   * statement, taking every other row in the batch with it. That is the
   * behaviour that stranded a phone at camp for two days.
   */
  reject: ((r: ScoreEventInsert) => boolean) | null = null
  private cb: ((row: ScoreEventRow) => void) | null = null

  async fetchAll(): Promise<ScoreEventRow[]> {
    return this.rows
  }

  async upsert(rows: ScoreEventInsert[]): Promise<void> {
    this.upsertCalls.push(rows)
    if (this.failUpsert) throw new Error('offline')
    if (this.reject && rows.some(this.reject)) {
      throw new RemoteWriteError(
        '42501',
        null,
        null,
        'new row violates row-level security policy for table "score_events"',
      )
    }
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

  /*
   * The data epoch (src/data/epoch.ts). A phone that ran the rehearsal build
   * must open the camp on zeroes, and the shared log must not put the
   * rehearsal back — with or without supabase/reset-camp.sql having been run.
   */
  it('ignores server rows from before the data epoch', async () => {
    const old = { ...ev('knights'), occurredAt: '2026-08-19T09:00:00.000Z' }
    const fresh = ev('pearls')
    remote.rows = [asRow(old, '2026-08-19T09:00:01.000Z'), asRow(fresh)]

    await provider.getEvents() // boot fetch
    await vi.waitFor(async () => {
      expect((await provider.getEvents()).map((e) => e.id)).toEqual([fresh.id])
    })

    // …and a realtime insert of one is ignored too, not merely the boot fetch.
    remote.emit(asRow({ ...ev('forged'), occurredAt: '2026-08-18T12:00:00.000Z' }))
    expect((await provider.getEvents()).map((e) => e.id)).toEqual([fresh.id])
  })

  it('drops a pre-epoch mirror and never flushes a pre-epoch outbox row', async () => {
    const stale = { ...ev(), occurredAt: '2026-08-14T09:00:00.000Z' }
    const real = ev()
    localStorage.setItem(EVENTS_KEY, JSON.stringify([stale, real]))
    const box = new MemoryOutbox()
    await box.put([stale])

    const p = new SupabaseDataProvider(remote, box)
    expect((await p.getEvents()).map((e) => e.id)).toEqual([real.id])
    await vi.waitFor(async () => expect(await box.all()).toHaveLength(0))
    await p.flush()
    expect(remote.rows.map((r) => r.id)).not.toContain(stale.id)
    p.close()
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

/**
 * These cover the failure that actually happened at camp on 2026-08-21: a
 * phone with a working connection, a full outbox, and a server refusing one
 * poisoned row — 127 rejections over 23 hours, every one of them swallowed.
 */
describe('a row the server refuses', () => {
  it('does not stop the other awards from reaching the server', async () => {
    const poison = { ...ev('gems'), actorId: 'someone-else' }
    const good1 = ev('warriors')
    const good2 = ev('pearls')
    remote.reject = (r) => r.actor_id === 'someone-else'

    await provider.appendEvents([good1, poison, good2])
    await provider.flush()

    const landed = remote.rows.map((r) => r.id).sort()
    expect(landed).toEqual([good1.id, good2.id].sort())
    // ...and the refused one is still held, not lost.
    expect((await outbox.all()).map((e) => e.id)).toEqual([poison.id])
  })

  it('reports why, instead of looking exactly like being offline', async () => {
    remote.reject = () => true
    await provider.appendEvents([ev()])
    await provider.flush()

    const state = provider.getSyncState()
    expect(state.lastError?.code).toBe('42501')
    expect(state.blocked).toBe(1)
    expect(state.pending).toBe(1)
    expect(state.lastError?.plain).toMatch(/different sign-in|not open to you/i)
  })

  it('keeps the refused row out of every later batch', async () => {
    const poison = { ...ev('gems'), actorId: 'someone-else' }
    remote.reject = (r) => r.actor_id === 'someone-else'
    await provider.appendEvents([poison])
    await provider.flush()

    remote.upsertCalls = []
    const later = ev('forged')
    await provider.appendEvents([later])
    await provider.flush()

    // The new award goes up on its own, never batched with the poison again.
    expect(remote.rows.map((r) => r.id)).toContain(later.id)
    for (const call of remote.upsertCalls) {
      if (call.length > 1) expect(call.map((r) => r.id)).not.toContain(poison.id)
    }
  })

  it('lets a blocked row heal once the server changes its mind', async () => {
    const late = ev('rustco', 'day3')
    remote.reject = (r) => r.day_id === 'day3'
    await provider.appendEvents([late])
    await provider.flush()
    expect(provider.getSyncState().blocked).toBe(1)

    // Day 3 opens. Nothing about the row changed — only the policy.
    remote.reject = null
    await provider.flush()

    expect(remote.rows.map((r) => r.id)).toContain(late.id)
    expect(provider.getSyncState().blocked).toBe(0)
    expect(provider.getSyncState().pending).toBe(0)
  })

  it('does not quarantine anything merely because the network is down', async () => {
    remote.failUpsert = true
    await provider.appendEvents([ev(), ev('warriors')])
    await provider.flush()

    expect(provider.getSyncState().blocked).toBe(0)
    expect(provider.getSyncState().pending).toBe(2)

    remote.failUpsert = false
    await provider.flush()
    expect(provider.getSyncState().pending).toBe(0)
  })
})

describe('repairActor', () => {
  it('re-stamps awards recorded under another sign-in and delivers them', async () => {
    const mine = ev('warriors')
    const theirs = { ...ev('gems'), actorId: 'the-other-leader' }
    remote.reject = (r) => r.actor_id !== 'natasha'

    await provider.appendEvents([mine, theirs])
    await provider.flush()
    // Both are refused: this device is signed in as nobody the server knows.
    expect(remote.rows).toHaveLength(0)
    expect(provider.getSyncState('natasha').wrongActor).toBe(2)

    const fixed = await provider.repairActor('natasha')

    expect(fixed).toBe(2)
    expect(remote.rows.map((r) => r.id).sort()).toEqual([mine.id, theirs.id].sort())
    expect(remote.rows.every((r) => r.actor_id === 'natasha')).toBe(true)
    expect(provider.getSyncState().pending).toBe(0)
  })

  it('rewrites the mirror too, so the audit log matches what the server got', async () => {
    const theirs = { ...ev('gems'), actorId: 'the-other-leader' }
    remote.reject = (r) => r.actor_id !== 'natasha'
    await provider.appendEvents([theirs])
    await provider.flush()

    await provider.repairActor('natasha')

    const mirrored = (await provider.getEvents()).find((e) => e.id === theirs.id)
    expect(mirrored?.actorId).toBe('natasha')
    expect(mirrored?.syncedAt).not.toBeNull()
  })

  it('is a no-op when nothing is blocked on the actor', async () => {
    await provider.appendEvents([ev()])
    await provider.flush()
    expect(await provider.repairActor('natasha')).toBe(0)
  })

  it('does not offer to re-stamp rows the signed-in user already owns', async () => {
    // Blocked for the DAY, not the actor: re-stamping would change nothing,
    // so the panel must not offer a button that silently does nothing.
    const mine = { ...ev('gems', 'day4'), actorId: 'natasha' }
    remote.reject = (r) => r.day_id === 'day4'
    await provider.appendEvents([mine])
    await provider.flush()

    expect(provider.getSyncState('natasha').blocked).toBe(1)
    expect(provider.getSyncState('natasha').wrongActor).toBe(0)
    expect(await provider.repairActor('natasha')).toBe(0)
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
