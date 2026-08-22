import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SupabaseDataProvider } from './SupabaseDataProvider'
import { EVENTS_KEY } from './LocalStorageDataProvider'
import { MemoryOutbox } from './outbox'
import { fromRow, toRow, type RemoteEventStore, type ScoreEventInsert, type ScoreEventRow } from './remote'
import { RemoteError, classifyServerError } from './syncFault'
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

const OFFLINE = { message: 'TypeError: Failed to fetch', code: '' }
/** What Postgres answers when RLS refuses a row. */
const REFUSED = {
  message: 'new row violates row-level security policy for table "score_events"',
  code: '42501',
}

class FakeRemote implements RemoteEventStore {
  rows: ScoreEventRow[] = []
  upsertCalls: ScoreEventInsert[][] = []
  /** The link is down: every call fails, whatever is in it. */
  failUpsert = false
  /**
   * Event ids the server refuses. Postgres fails the WHOLE statement over one
   * bad row, so a batch containing any of these is rejected entire — which is
   * the behaviour the provider has to cope with.
   */
  reject = new Set<string>()
  /**
   * The signed-in account, as RLS sees it: `actor_id = auth.uid()`. When set,
   * a row credited to anyone else is refused — which is what happens to an
   * award recorded by one leader and flushed from another's phone.
   */
  authUid: string | null = null
  private cb: ((row: ScoreEventRow) => void) | null = null

  async fetchAll(): Promise<ScoreEventRow[]> {
    if (this.failUpsert) throw new RemoteError(classifyServerError(OFFLINE, new Date().toISOString()))
    return this.rows
  }

  async upsert(rows: ScoreEventInsert[]): Promise<void> {
    this.upsertCalls.push(rows)
    if (this.failUpsert) throw new RemoteError(classifyServerError(OFFLINE, new Date().toISOString()))
    const refused =
      rows.some((r) => this.reject.has(r.id)) ||
      (this.authUid !== null && rows.some((r) => r.actor_id !== this.authUid))
    if (refused) throw new RemoteError(classifyServerError(REFUSED, new Date().toISOString()))
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

/*
 * The bug this was written for. A leader with four bars could not sync, and
 * nothing in the app or the code could say why: every failure in the write
 * path was caught by a bare `catch { return }` commented "still offline", and
 * the whole outbox went up as one statement — so a single row the server
 * refused failed the statement and held every award behind it, silently,
 * retried every fifteen seconds for the rest of camp.
 */
describe('one refused award does not hold the rest', () => {
  it('sends the batch one at a time once the batch is refused, and lands the good ones', async () => {
    const good1 = ev('gems')
    const bad = ev('knights')
    const good2 = ev('pearls')
    remote.reject.add(bad.id)

    await provider.appendEvents([good1, bad, good2])
    await provider.flush()

    // The two clean awards are on the server.
    expect(remote.rows.map((r) => r.id).sort()).toEqual([good1.id, good2.id].sort())
    // The batch went once, was refused, and was then re-sent row by row.
    expect(remote.upsertCalls[0]).toHaveLength(3)
    expect(remote.upsertCalls.slice(1).every((c) => c.length === 1)).toBe(true)

    const events = await provider.getEvents()
    const byId = new Map(events.map((e) => [e.id, e]))
    expect(byId.get(good1.id)?.syncedAt).not.toBeNull()
    expect(byId.get(good2.id)?.syncedAt).not.toBeNull()
    expect(byId.get(bad.id)?.syncedAt).toBeNull()
  })

  it('keeps the refused award — in the outbox, in the mirror, and on the board', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id)
    await provider.appendEvents([bad, ev('gems')])

    // Nothing is discarded, however many times it is asked.
    for (let i = 0; i < 5; i++) await provider.flush()

    expect((await outbox.all()).map((e) => e.id)).toEqual([bad.id])
    expect((await provider.getEvents()).map((e) => e.id)).toContain(bad.id)
    // The award still counts on this phone: only `syncedAt` says otherwise.
    expect((await provider.getEvents()).find((e) => e.id === bad.id)?.deltaDeci).toBe(10)
  })

  it('stops retrying the refused award unattended, so later awards go straight out', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id)
    await provider.appendEvent(bad)
    await provider.flush()

    remote.upsertCalls.length = 0
    const later = ev('forged')
    await provider.appendEvent(later)
    await provider.flush()

    // One clean request carrying only the new award — the held one is not in it.
    expect(remote.upsertCalls.every((c) => c.every((r) => r.id !== bad.id))).toBe(true)
    expect(remote.rows.map((r) => r.id)).toContain(later.id)
  })

  it('reports what is held and why', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id)
    await provider.appendEvents([bad, ev('gems')])
    await provider.flush()

    const state = provider.getSyncState()
    expect(state.blocked).toBe(1)
    expect(state.fault?.kind).toBe('refused')
    expect(state.fault?.code).toBe('42501')
    expect(state.lastSyncAt).not.toBeNull() // the good one did land

    const held = await provider.getBlockedEvents()
    expect(held).toHaveLength(1)
    expect(held[0].event.id).toBe(bad.id)
    expect(held[0].event.teamId).toBe('knights')
    expect(held[0].fault.kind).toBe('refused')
    expect(held[0].attempts).toBeGreaterThanOrEqual(1)
  })
})

describe('a dead link is not a refusal', () => {
  it('does not fan out into one request per award when the network is down', async () => {
    await provider.appendEvents([ev('gems'), ev('knights'), ev('pearls')])
    await provider.flush()
    remote.upsertCalls.length = 0

    remote.failUpsert = true
    await provider.appendEvents([ev('forged'), ev('rustco'), ev('innocent')])
    await provider.flush()

    // One batch attempt, not three probes into a dead zone.
    expect(remote.upsertCalls).toHaveLength(1)
    expect(remote.upsertCalls[0]).toHaveLength(3)
    expect(provider.getSyncState().fault?.kind).toBe('network')
    // Nothing is held: the awards are fine, the link is not.
    expect(provider.getSyncState().blocked).toBe(0)
    expect(await provider.getBlockedEvents()).toHaveLength(0)
  })

  it('drains everything by itself once the link comes back', async () => {
    remote.failUpsert = true
    await provider.appendEvents([ev('gems'), ev('knights')])
    await provider.flush()
    expect(provider.getSyncState().fault?.kind).toBe('network')

    remote.failUpsert = false
    await provider.flush()

    expect(remote.rows).toHaveLength(2)
    expect(await outbox.all()).toHaveLength(0)
    expect(provider.getSyncState().fault).toBeNull()
  })
})

describe('forceSync — the retry button', () => {
  it('retries a held award, and drains it once the server accepts it', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id)
    await provider.appendEvent(bad)
    await provider.flush()
    expect(provider.getSyncState().blocked).toBe(1)

    // Whatever was wrong is put right — the right leader signs in, the day is
    // reopened, the session refreshes.
    remote.reject.delete(bad.id)
    const state = await provider.forceSync()

    expect(state.blocked).toBe(0)
    expect(state.fault).toBeNull()
    expect(remote.rows.map((r) => r.id)).toEqual([bad.id])
    expect(await outbox.all()).toHaveLength(0)
    expect((await provider.getEvents())[0].syncedAt).not.toBeNull()
  })

  it('asks again even when nothing has changed, and still loses nothing', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id)
    await provider.appendEvent(bad)
    await provider.flush()
    remote.upsertCalls.length = 0

    const state = await provider.forceSync()

    // It really did try the held award again.
    expect(remote.upsertCalls.flat().map((r) => r.id)).toContain(bad.id)
    expect(state.blocked).toBe(1)
    expect((await outbox.all()).map((e) => e.id)).toEqual([bad.id])
  })

  it('is safe with an empty queue — it just re-reads the shared log', async () => {
    const mine = ev('gems')
    await provider.appendEvent(mine)
    await provider.flush()
    remote.rows.push(asRow(ev('forged'), '2026-08-20T10:00:00.000Z'))

    const state = await provider.forceSync()
    expect(state.fault).toBeNull()
    expect(state.blocked).toBe(0)
    expect((await provider.getEvents())).toHaveLength(2)
  })
})

describe('the sync readout', () => {
  it('records a failed read of the shared log rather than swallowing it', async () => {
    remote.failUpsert = true // fetchAll fails too
    await provider.getEvents() // boot fetch
    await vi.waitFor(() => expect(provider.getSyncState().fault?.kind).toBe('network'))
  })

  it('stays quiet on an idle tick', async () => {
    await provider.appendEvent(ev())
    await provider.flush()
    const listener = vi.fn()
    provider.subscribe(listener)

    await provider.flush()
    await provider.flush()
    expect(listener).not.toHaveBeenCalled()
  })
})

/*
 * "No need for super high security — in case there's some random bug just let
 * it force sync stuff." Every refusal that is not about the award itself comes
 * down to actor_id, so the force button is allowed to re-credit a stuck award
 * to whoever presses it rather than leave a team's point stranded over which
 * phone recorded it.
 */
describe('forceSync recovers an award stuck on who recorded it', () => {
  it('re-sends a refused award credited to the signer, and says how many', async () => {
    const mine = { ...ev('gems'), actorId: 'me' }
    const theirs = { ...ev('knights'), actorId: 'someone-else' }
    remote.authUid = 'me'

    await provider.appendEvents([mine, theirs])
    await provider.flush()
    expect(provider.getSyncState().blocked).toBe(1)

    const result = await provider.forceSync({ actorId: 'me' })

    expect(result.recovered).toBe(1)
    expect(result.blocked).toBe(0)
    expect(await outbox.all()).toHaveLength(0)
    expect(remote.rows.map((r) => r.id).sort()).toEqual([mine.id, theirs.id].sort())
    // It went up credited to the signer — that is the only reason it landed.
    expect(remote.rows.find((r) => r.id === theirs.id)?.actor_id).toBe('me')
  })

  it('keeps the award itself untouched — only the credit moves', async () => {
    const theirs = {
      ...ev('knights', 'day2', 'golden_key', 10),
      actorId: 'someone-else',
      note: 'Helped clear the yard',
      reversesEventId: null,
    }
    remote.authUid = 'me'
    await provider.appendEvent(theirs)
    await provider.flush()
    await provider.forceSync({ actorId: 'me' })

    const row = remote.rows.find((r) => r.id === theirs.id)!
    expect(row).toMatchObject({
      id: theirs.id,
      occurred_at: theirs.occurredAt,
      day_id: 'day2',
      team_id: 'knights',
      category_id: 'golden_key',
      delta: 10,
      reverses_event_id: null,
    })
    // The original reason survives, with the swap recorded beside it.
    expect(row.note).toContain('Helped clear the yard')
    expect(row.note).toContain('Recovered')

    // …and the phone's own copy agrees with what the server now holds.
    const local = (await provider.getEvents()).find((e) => e.id === theirs.id)!
    expect(local.actorId).toBe('me')
    expect(local.syncedAt).not.toBeNull()
  })

  it('sends the honest row first and only rewrites one the server refused', async () => {
    const mine = { ...ev('gems'), actorId: 'me' }
    remote.authUid = 'me'
    await provider.appendEvent(mine)

    await provider.forceSync({ actorId: 'me' })

    expect(remote.rows[0].actor_id).toBe('me')
    expect(remote.rows[0].note).toBeNull() // never marked as recovered
    expect(remote.upsertCalls.flat()).toHaveLength(1) // one attempt, no rewrite
  })

  it('leaves the award held when re-crediting is not the problem', async () => {
    const bad = ev('knights')
    remote.reject.add(bad.id) // refused whoever asks — a closed day
    await provider.appendEvent(bad)
    await provider.flush()

    const result = await provider.forceSync({ actorId: 'me' })

    expect(result.recovered).toBe(0)
    expect(result.blocked).toBe(1)
    // Still here. Nothing is thrown away because a rewrite did not help.
    expect((await outbox.all()).map((e) => e.id)).toEqual([bad.id])
    expect((await provider.getEvents()).find((e) => e.id === bad.id)?.actorId).toBe('leader-1')
  })

  it('never touches the reversal pointer, which would re-award the category', async () => {
    const award = { ...ev('gems'), id: 'aaa-award', actorId: 'someone-else' }
    const undo = {
      ...ev('gems'),
      id: 'bbb-undo',
      occurredAt: '2026-08-20T09:05:00.000Z',
      deltaDeci: -10,
      reversesEventId: award.id,
      actorId: 'someone-else',
    }
    remote.authUid = 'me'
    await provider.appendEvents([award, undo])
    await provider.flush()
    await provider.forceSync({ actorId: 'me' })

    // Both recovered — and the undo still names what it undoes. `liveEvents`
    // reads that pointer in both directions, so stripping it to dodge a
    // foreign-key failure would turn the undo into a live event of its own and
    // silently put the good deed back on the board.
    expect(remote.rows.find((r) => r.id === undo.id)?.reverses_event_id).toBe(award.id)
    expect((await provider.getEvents()).find((e) => e.id === undo.id)?.reversesEventId).toBe(
      award.id,
    )
  })

  it('does not re-credit anything on an ordinary background flush', async () => {
    const theirs = { ...ev('knights'), actorId: 'someone-else' }
    remote.authUid = 'me'
    await provider.appendEvent(theirs)

    await provider.flush()
    await provider.flush()

    expect(remote.rows).toHaveLength(0)
    expect(provider.getSyncState().blocked).toBe(1)
  })
})

describe('a correction is sent after the award it reverses', () => {
  it('orders the queue by when things happened, not by random uuid', async () => {
    // Deliberately named so id order is the opposite of chronological order:
    // IdbOutbox.getAll() returns key order, which would send the undo first
    // and trip the foreign key on reverses_event_id.
    const award = { ...ev('gems'), id: 'zzz-award', occurredAt: '2026-08-20T09:00:00.000Z' }
    const undo = {
      ...ev('gems'),
      id: 'aaa-undo',
      occurredAt: '2026-08-20T09:05:00.000Z',
      deltaDeci: -10,
      reversesEventId: award.id,
    }
    await provider.appendEvents([award, undo])
    await provider.flush()

    expect(remote.upsertCalls[0].map((r) => r.id)).toEqual([award.id, undo.id])
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
