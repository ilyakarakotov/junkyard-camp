import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { ScoreEvent } from './types'

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

/**
 * Postgres SQLSTATEs that mean "the server will refuse this row every time".
 * Sending it again in ten seconds, or in ten hours, changes nothing:
 *
 *   42501  the row-level security policy refused it — wrong actor, or a day
 *          that is not open to this person
 *   23503  a foreign key does not resolve (an unknown day, team, category,
 *          actor, or a compensating event whose original never landed)
 *   23502  a NOT NULL column arrived null
 *   23514  a CHECK constraint failed
 *   22P02  malformed input — a uuid column that did not get a uuid
 *
 * The distinction matters because it decides what the flusher does next. A
 * network error means "try the whole batch again later"; one of these means
 * "this row is poison, and if it stays in the batch it takes every other
 * award down with it."
 */
const PERMANENT_SQLSTATES = new Set(['42501', '23503', '23502', '23514', '22P02', '23505'])

/**
 * A write the server rejected, with enough detail to act on and to show a
 * human. The old code threw `new Error(error.message)` and the provider
 * caught it with a bare `catch {}` — so a policy rejection was indistinguish-
 * able from being in a dead zone, and a phone could retry the same doomed
 * batch for two days without a single word reaching anybody.
 */
export class RemoteWriteError extends Error {
  constructor(
    readonly code: string | null,
    readonly details: string | null,
    readonly hint: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'RemoteWriteError'
  }

  /** True when retrying this row unchanged can never succeed. */
  get permanent(): boolean {
    return this.code !== null && PERMANENT_SQLSTATES.has(this.code)
  }

  /** What to tell a leader holding the phone, in their language, not Postgres'. */
  get plain(): string {
    switch (this.code) {
      case '42501':
        return 'The server refused these points: either they were recorded under a different sign-in, or that day is not open to you.'
      case '23503':
        return 'These points refer to something the server does not have yet — most often an undo whose original award never arrived.'
      case '22P02':
        return 'These points were recorded without a valid sign-in, so the server cannot tell who awarded them.'
      default:
        return this.message
    }
  }
}

export interface RemoteEventStore {
  /** The whole shared log. Camp-scale data: well under one page's 10k range. */
  fetchAll(): Promise<ScoreEventRow[]>
  /** Idempotent by primary key: re-sending an id is a no-op, not a double award. */
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
      if (error) throw new Error(error.message)
      return data as ScoreEventRow[]
    },
    async upsert(rows) {
      const { error } = await supabase
        .from('score_events')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      // PostgREST hands back the SQLSTATE; keeping it is the whole difference
      // between "we are offline" and "the server said no, and here is why".
      if (error) {
        throw new RemoteWriteError(
          error.code ?? null,
          error.details ?? null,
          error.hint ?? null,
          error.message,
        )
      }
    },
    onInsert(fn) {
      cb = fn
    },
    close() {
      void supabase.removeChannel(channel)
    },
  }
}
