import { createClient } from '@supabase/supabase-js'
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
  delta_deci: number
  activity_id: string | null
  note: string | null
  actor_id: string
  device_id: string
  reverses_event_id: string | null
  /** Stamped by the database on insert — never sent by the client. */
  synced_at: string
}

/** What the client sends. `synced_at` is omitted so the DB default applies. */
export type ScoreEventInsert = Omit<ScoreEventRow, 'synced_at'>

export function toRow(e: ScoreEvent): ScoreEventInsert {
  return {
    id: e.id,
    occurred_at: e.occurredAt,
    day_id: e.dayId,
    team_id: e.teamId,
    category_id: e.categoryId,
    delta_deci: e.deltaDeci,
    activity_id: e.activityId,
    note: e.note,
    actor_id: e.actorId,
    device_id: e.deviceId,
    reverses_event_id: e.reversesEventId,
  }
}

export function fromRow(r: ScoreEventRow): ScoreEvent {
  return {
    id: r.id,
    occurredAt: r.occurred_at,
    dayId: r.day_id,
    teamId: r.team_id as ScoreEvent['teamId'],
    categoryId: r.category_id as ScoreEvent['categoryId'],
    deltaDeci: r.delta_deci,
    activityId: r.activity_id,
    note: r.note,
    actorId: r.actor_id,
    deviceId: r.device_id,
    reversesEventId: r.reverses_event_id,
    syncedAt: r.synced_at,
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
 * Build the Supabase-backed store, or null when env is missing. Opens a
 * realtime channel, so call it lazily — never from a constructor that a
 * discarded StrictMode render might run.
 */
export function createSupabaseEventStore(): RemoteEventStore | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null

  const client = createClient(url, key)
  let cb: ((row: ScoreEventRow) => void) | null = null
  const channel = client
    .channel('score-events-feed')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'score_events' },
      (payload) => cb?.(payload.new as ScoreEventRow),
    )
    .subscribe()

  return {
    async fetchAll() {
      const { data, error } = await client.from('score_events').select('*').range(0, 9999)
      if (error) throw new Error(error.message)
      return data as ScoreEventRow[]
    },
    async upsert(rows) {
      const { error } = await client
        .from('score_events')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) throw new Error(error.message)
    },
    onInsert(fn) {
      cb = fn
    },
    close() {
      void client.removeChannel(channel)
    },
  }
}
