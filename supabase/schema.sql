-- Junkyard Redemption — Phase 1 backend.
-- Run once in the Supabase SQL editor (or `supabase db push`).
--
-- One table is all the app shares: the append-only score event log. The
-- roster (teams/days/categories/activities) is fixed camp data and ships
-- inside the app. Totals are always derived client-side from this log;
-- corrections are compensating events, never updates or deletes — and the
-- policies below enforce exactly that (insert + read only).

create table public.score_events (
  -- Client-generated UUID: an offline retry re-sends the same id, and the
  -- primary key makes that a no-op instead of a double award.
  id uuid primary key,
  occurred_at timestamptz not null,
  day_id text not null,
  team_id text not null,
  category_id text not null,
  -- Integer tenths: +1 per punctuality check-in, ±10 for binaries and keys.
  delta_deci integer not null check (delta_deci between -10 and 10),
  activity_id text,
  note text,
  actor_id text not null,
  device_id text not null,
  -- No foreign key: a reversal may reach the server before the event it
  -- compensates when two devices sync out of order.
  reverses_event_id uuid,
  -- Stamped by the database on arrival; the client never sends it.
  synced_at timestamptz not null default now()
);

alter table public.score_events enable row level security;

-- Every leader's device reads the whole log (the board, standings and the big
-- screen are all views over it) and appends to it. No update, no delete: the
-- log is append-only.
create policy "leaders read events"
  on public.score_events for select to anon
  using (true);

create policy "leaders append events"
  on public.score_events for insert to anon
  with check (delta_deci between -10 and 10);

-- Realtime: other leaders' awards land on every open screen as they happen.
alter publication supabase_realtime add public.score_events;
