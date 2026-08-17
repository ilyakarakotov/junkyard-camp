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

create or replace function camp_today() returns date language sql stable as $$
  select ((now() at time zone 'America/Los_Angeles') - interval '3 hours')::date;
$$;

create or replace function is_director() returns boolean language sql stable as $$
  select coalesce((select role = 'director' from app_users where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------------
-- Row-level security. Security is not critical here, but an anon key that
-- lets anyone on the internet write to the scoreboard is an obvious flaw.
-- ---------------------------------------------------------------------------

alter table teams        enable row level security;
alter table days         enable row level security;
alter table categories   enable row level security;
alter table app_users    enable row level security;
alter table score_events enable row level security;

create policy r_teams  on teams        for select to authenticated using (true);
create policy r_days   on days         for select to authenticated using (true);
create policy r_cats   on categories   for select to authenticated using (true);
create policy r_users  on app_users    for select to authenticated using (true);
create policy r_events on score_events for select to authenticated using (true);

-- you may only write as yourself, only for today, and only directors award keys
create policy w_events on score_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    (select date from days where id = day_id) = camp_today()
    or is_director()
  )
  and (category_id <> 'golden_key' or is_director())
);

-- deliberately no update and no delete policies: the log is append-only

-- Realtime: other devices' awards land on every open screen as they happen.
alter publication supabase_realtime add public.score_events;

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
