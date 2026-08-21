-- Junkyard Redemption — backend schema. Run once in the Supabase SQL editor.
--
-- Five tables, two helper functions, row-level security, realtime on the
-- event log. The log is append-only: corrections are compensating rows, and
-- there are deliberately no update or delete policies.

create table teams (
  id text primary key,
  name text not null,
  short_name text not null,
  color text not null,
  sort_order int not null
);

create table days (
  id text primary key,
  idx int not null,
  name text not null,
  theme text not null,
  date date not null,
  scored boolean not null default true
);

create table categories (
  id text primary key,
  label text not null,
  kind text not null check (kind in ('binary','punctuality','key')),
  sort_order int not null
);

-- mirrors auth.users; role drives what a signed-in person may do
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text not null,
  role text not null default 'helper' check (role in ('helper','director')),
  is_active boolean not null default true
);

-- append-only. never UPDATE, never DELETE. corrections are compensating rows.
create table score_events (
  id uuid primary key,                      -- generated on the client
  occurred_at timestamptz not null default now(),
  day_id text not null references days(id),
  team_id text not null references teams(id),
  category_id text not null references categories(id),
  delta int not null,                       -- deci-points for binary/key, CHECK-INS for punctuality
  actor_id uuid not null references app_users(id),
  device_id text,
  reverses_event_id uuid references score_events(id),
  note text,
  created_at timestamptz not null default now()
);

create index on score_events (day_id, team_id);
create index on score_events (occurred_at desc);

-- ---------------------------------------------------------------------------
-- The camp day boundary. Camp runs until lights out, and someone may score at
-- 23:50: the day rolls over at 03:00 local, not midnight. Set this to the
-- camp's actual timezone. src/data/campday.ts mirrors the same rule client-
-- side so the client and the database always agree on what "today" is.
-- ---------------------------------------------------------------------------

create or replace function camp_today() returns date
  language sql stable set search_path = public as $$
  select ((now() at time zone 'America/Los_Angeles') - interval '3 hours')::date;
$$;

-- Which day accepts writes with nothing reopened at all. This mirrors
-- seed.ts's resolveEditableDayId exactly, and it must: comparing a day's date
-- to camp_today() directly means that before camp opens no date matches, so
-- every helper insert is refused while the client happily accepts it — the
-- award shows on the phone, the server rejects it, and the outbox grows
-- forever with nothing telling the helper why.
--
-- Two rules beyond "the date matches", both mirrored client-side:
--
--   * A non-scoring today (Arrival) falls FORWARD to the next scoring day
--     rather than resolving to nothing. A strict match returned null for the
--     whole of Arrival, which left the camp with no editable day at all.
--   * Before camp opens, the first scoring day stands in.
create or replace function camp_editable_day() returns text
  language sql stable set search_path = public as $$
  select case
    when camp_today() > (select max(date) from days) then null
    else coalesce(
      (select id from days where date = camp_today() and scored),
      (select id from days where scored and date >= camp_today() order by idx limit 1)
    )
  end;
$$;

-- Whether a given day accepts a helper's write right now.
--
-- The window is camp_today() ± 1 day rather than one exact id, because
-- 'America/Los_Angeles' above is a BUILD-TIME GUESS at where the camp is
-- held. A phone east of that zone reads the next date hours before the
-- database does — at UTC+3 the 20th is not "today" here until 13:00 camp-local,
-- by which point morning exercise, breakfast, morning line up and the lesson
-- have all been and gone. src/data/campday.ts therefore accepts either
-- reading, and this is the matching server bound: one day of slack, which is
-- the largest the two readings can ever differ by. Arrival is excluded by
-- `scored`, and after the last camp day nothing is open.
create or replace function camp_can_edit_day(d text) returns boolean
  language sql stable set search_path = public as $$
  select coalesce(d = camp_editable_day(), false)
      or exists (
        select 1 from days
         where id = d and scored
           and date between camp_today() - 1 and camp_today() + 1
      );
$$;

-- Whether a day may be reopened for BACKDATING — awarding points to a day that
-- has already been and gone.
--
-- A leader who forgets a good deed on Tuesday has to be able to put it right on
-- Wednesday. Before this, only a director could: the point was earned, the
-- scoreboard could not record it, and the only way in was to find the director
-- during the evening gathering. So a past scoring day accepts every active
-- staff member's insert, and what protects the log is not a role — it is the
-- warning the client makes them confirm, the banner it keeps up for as long as
-- the day is open, and the actor_id and occurred_at this append-only table
-- keeps on every row. src/data/seed.ts's canBackdateDay mirrors this exactly.
--
-- Past only. A future day has nothing to correct, so it stays closed to
-- everyone but a director: awarding Thursday's points on Wednesday is a
-- mis-tap, never a fix.
create or replace function camp_can_backdate_day(d text) returns boolean
  language sql stable set search_path = public as $$
  select exists (
    select 1 from days
     where id = d and scored and date <= camp_today()
  );
$$;

-- ---------------------------------------------------------------------------
-- Who you are, for the policies below.
--
-- These live in `private` rather than `public` because PostgREST exposes
-- public: as SECURITY DEFINER functions in public they were callable by anyone
-- with the anon key at /rest/v1/rpc/is_staff. Revoking EXECUTE is not the fix —
-- Postgres evaluates an RLS expression with the querying role's privileges, so
-- that breaks every policy that calls them. An unexposed schema keeps the
-- policies working and removes the endpoints.
--
-- They must be SECURITY DEFINER: a policy on app_users cannot call a function
-- that reads app_users under invoker rights without recursing, and the audit
-- log needs every staff display name, so "read only your own row" will not do.
-- search_path is pinned so a definer function can never resolve a name through
-- a caller-controlled path.
-- ---------------------------------------------------------------------------

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from app_users where id = auth.uid() and is_active);
$$;

create or replace function private.is_director() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'director' from app_users where id = auth.uid() and is_active), false);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security.
--
-- Reads require an active app_users row, not merely a signed-in session. The
-- anon key ships in the client bundle by design and sign-up may be open on the
-- project, so `to authenticated using (true)` means anyone who pulls that key
-- out of the JS can register an account and read the whole camp. Writing was
-- always impossible for them — score_events.actor_id references app_users — but
-- reading should be too.
-- ---------------------------------------------------------------------------

alter table teams        enable row level security;
alter table days         enable row level security;
alter table categories   enable row level security;
alter table app_users    enable row level security;
alter table score_events enable row level security;

create policy r_teams  on teams        for select to authenticated using (private.is_staff());
create policy r_days   on days         for select to authenticated using (private.is_staff());
create policy r_cats   on categories   for select to authenticated using (private.is_staff());
create policy r_users  on app_users    for select to authenticated using (private.is_staff());
create policy r_events on score_events for select to authenticated using (private.is_staff());

-- You may only write as yourself, and only for a day that is open to you:
-- today, any day already past (backdating a miss), or — for a director —
-- any day at all. Keys are points like any other: every active staff member
-- may award them.
create policy w_events on score_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    camp_can_edit_day(day_id)
    or camp_can_backdate_day(day_id)
    or private.is_director()
  )
);

-- deliberately no update and no delete policies: the log is append-only

-- Realtime: other devices' awards land on every open screen as they happen.
alter publication supabase_realtime add table public.score_events;

-- ---------------------------------------------------------------------------
-- Seed data. score_events has foreign keys into teams/days/categories, so
-- these rows must exist before any event is inserted. The roster is fixed
-- camp data; the app ships the same constants for offline use
-- (src/data/seed.ts). days.date holds placeholder consecutive dates — set
-- the real camp dates here and in seed.ts with a single edit each.
-- ---------------------------------------------------------------------------

insert into teams (id, name, short_name, color, sort_order) values
  ('warriors', 'Pink Junkyard Warriors', 'WARRIORS', '#FF5FB8', 0),
  ('precious', 'Precious Pieces',        'PRECIOUS', '#B14DFF', 1),
  ('gems',     'Hidden Gems',            'GEMS',     '#3D9BFF', 2),
  ('pearls',   'God''s Pearls',          'PEARLS',   '#96F5B4', 3),
  ('knights',  'Fire Knights',           'KNIGHTS',  '#FF4438', 4),
  ('innocent', 'Innocent',               'INNOCENT', '#FFD84D', 5),
  ('forged',   'Forged',                 'FORGED',   '#78D62E', 6),
  ('rustco',   'Rust Revival Co.',       'RUST CO.', '#FF9440', 7);

insert into days (id, idx, name, theme, date, scored) values
  ('arrival', 0, 'Arrival', 'Creation — God''s Perfect World Breaks',     '2026-08-19', false),
  ('day1',    1, 'Day 1',   'Nation — God Makes Eternal Promises',        '2026-08-20', true),
  ('day2',    2, 'Day 2',   'Kingdom — God Promises a Perfect Ruler',     '2026-08-21', true),
  ('day3',    3, 'Day 3',   'Savior — God Sends His Perfect Sacrifice',   '2026-08-22', true),
  ('day4',    4, 'Day 4',   'Redemption — God Promises a New Earth',      '2026-08-23', true);

insert into categories (id, label, kind, sort_order) values
  ('cleanliness',      'Cleanliness',      'binary',      0),
  ('punctuality',      'Punctuality',      'punctuality', 1),
  ('memory_verse',     'Memory Verse',     'binary',      2),
  ('good_deed',        'Good Deed',        'binary',      3),
  ('lesson_knowledge', 'Lesson Knowledge', 'binary',      4),
  ('behavior',         'Behavior',         'binary',      5),
  ('golden_key',       'Golden Key',       'key',         6);
