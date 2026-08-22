import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ScoreEvent } from './types'
import { RemoteError, classifyServerError } from './syncFault'

/**
 * The network seam for Phase 1. Everything that knows about Supabase lives in
 * this file; `SupabaseDataProvider` talks only to the `RemoteEventStore`
 * interface, so tests inject a fake and never touch the network (or
 * supabase-js).
 *
 * One remote table: `score_events` (see `supabase/schema.sql`). The roster is
 * static camp data and stays in `seed.ts`.
 */

/** Row shape of `public.score_events` (snake_case). */
export interface ScoreEventRow {
  id: string
  occurred_at: string
  day_id: string
  team_id: string
  category_id: string
  /** deci-points for binary/key, CHECK-INS for punctuality — never summed. */
  delta: number
  /** The signed-in user's auth UUID; RLS requires it to be the writer. */
  actor_id: string
  device_id: string | null
  reverses_event_id: string | null
  note: string | null
  /** Stamped by the database on arrival — never sent by the client. */
  created_at: string
}

/** What the client sends. `created_at` is omitted so the DB default applies. */
export type ScoreEventInsert = Omit<ScoreEventRow, 'created_at'>

export function toRow(e: ScoreEvent): ScoreEventInsert {
  return {
    id: e.id,
    occurred_at: e.occurredAt,
    day_id: e.dayId,
    team_id: e.teamId,
    category_id: e.categoryId,
    delta: e.deltaDeci,
    actor_id: e.actorId,
    device_id: e.deviceId,
    reverses_event_id: e.reversesEventId,
    note: e.note,
  }
}

export function fromRow(r: ScoreEventRow): ScoreEvent {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    dayId: r.day_id,
    teamId: r.team_id as ScoreEvent['teamId'],
    categoryId: r.category_id as ScoreEvent['categoryId'],
    deltaDeci: r.delta,
    note: r.note,
    actorId: r.actor_id,
    deviceId: r.device_id ?? '',
    reversesEventId: r.reverses_event_id,
    // created_at doubles as the outbox marker: a row the server has is synced.
    syncedAt: r.created_at,
  }
}

export interface RemoteEventStore {
  /** The whole shared log. Camp-scale data: well under one page's 10k range. */
  fetchAll(): Promise<ScoreEventRow[]>
  /**
   * Idempotent by primary key: re-sending an id is a no-op, not a double
   * award.
   *
   * Throws `RemoteError` carrying a classified `SyncFault`, never a bare
   * Error: the caller has to be able to tell a dead network (wait) from a
   * refused row (hold it back and say so), and one rejected row fails the
   * whole statement, so the caller also has to be able to decide to re-send
   * the rows one at a time.
   */
  upsert(rows: ScoreEventInsert[]): Promise<void>
  /** Register the handler for rows inserted by other devices (realtime). */
  onInsert(cb: (row: ScoreEventRow) => void): void
  close(): void
}

/** Env configured at build time. Absent → the app runs in local-only mode. */
export function isSupabaseConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
}

/**
 * The host this build was compiled to talk to, for the sync screen to read
 * out. Host only — never the key, which is in the bundle anyway but has no
 * business on screen.
 *
 * Both values are baked in at build time, so "is there a backend at all" is a
 * property of the deployed bundle rather than of the phone holding it. That
 * is worth showing: a build shipped without them behaves exactly like a phone
 * with no signal, forever, on every device at once — and until this was on
 * screen there was nothing anywhere in the app that could tell the two apart.
 */
export function backendHost(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url || !import.meta.env.VITE_SUPABASE_ANON_KEY) return null
  try {
    return new URL(url).host
  } catch {
    return String(url)
  }
}

/**
 * The app holds one client: auth session, data and realtime all ride on it.
 * Sign in once for the whole camp — the session persists in localStorage and
 * refreshes itself; the only sign-out is the explicit menu item.
 */
let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    })
  }
  return client
}

/**
 * Build the Supabase-backed event store, or null when env is missing. Opens a
 * realtime channel, so call it lazily — never from a constructor that a
 * discarded StrictMode render might run.
 */
export function createSupabaseEventStore(): RemoteEventStore | null {
  const supabase = getSupabaseClient()
  if (!supabase) return null

  let cb: ((row: ScoreEventRow) => void) | null = null
  const channel = supabase
    .channel('score-events-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'score_events' },
      (payload) => cb?.(payload.new as ScoreEventRow),
    )
    .subscribe()

  return {
    async fetchAll() {
      const { data, error } = await supabase.from('score_events').select('*').range(0, 9999)
      if (error) throw new RemoteError(classifyServerError(error, new Date().toISOString()))
      return data as ScoreEventRow[]
    },
    async upsert(rows) {
      const { error } = await supabase
        .from('score_events')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw new RemoteError(classifyServerError(error, new Date().toISOString()))
    },
    onInsert(fn) {
      cb = fn
    },
    close() {
      void supabase.removeChannel(channel)
    },
  }
}
