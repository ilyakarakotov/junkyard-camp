-- Add camp accounts. Edit the VALUES list at the top, paste the whole file into
-- the Supabase SQL editor, run it once.
--
-- Why this exists alongside scripts/seed-users.mjs: Supabase's Auth API
-- validates the email domain, and on this project it rejected
-- `@junkyard.camp` outright ("Email address is invalid"). This path writes
-- auth.users directly, so the username@junkyard.camp convention the sign-in
-- screen depends on keeps working regardless of that validator. It is how the
-- accounts on this project were actually created.
--
-- Nobody types an email: the sign-in screen appends @junkyard.camp itself.
--
-- Roles: `helper` awards the six normal categories for the current day.
-- `director` also awards Golden Keys and can unlock a past day. Want everyone
-- to have equal powers? Make every role 'director'.
--
-- Re-running is safe: an existing username has its password, display name and
-- role updated rather than being duplicated.

create temporary table _camp_staff (username text, password text, display_name text, role text) on commit drop;

insert into _camp_staff values
  --  username,  password,            display name,  role
  ('ilya',     'change-me-please',   'Ilya K.',     'director'),
  ('anna',     'change-me-please',   'Anna P.',     'helper');

-- 1. Existing accounts: reset the password, leave the id alone so their events
--    stay attributed to them. ON CONFLICT is avoided deliberately — the only
--    unique index on auth.users.email is partial, and inferring a partial index
--    is fragile across GoTrue versions.
update auth.users u
   set encrypted_password = extensions.crypt(s.password, extensions.gen_salt('bf')),
       raw_user_meta_data = jsonb_build_object('display_name', s.display_name),
       updated_at = now()
  from _camp_staff s
 where u.email = s.username || '@junkyard.camp';

-- 2. New accounts. email_confirmed_at is set here because no confirmation mail
--    can ever arrive at junkyard.camp.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  extensions.uuid_generate_v4(),
  'authenticated', 'authenticated',
  s.username || '@junkyard.camp',
  extensions.crypt(s.password, extensions.gen_salt('bf')),
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', s.display_name),
  '', '', '', ''
from _camp_staff s
where not exists (
  select 1 from auth.users u where u.email = s.username || '@junkyard.camp'
);

-- 3. The staff row the policies read. Without one, a signed-in account can
--    neither read nor write anything.
insert into public.app_users (id, username, display_name, role, is_active)
select u.id, s.username, s.display_name, s.role, true
from _camp_staff s
join auth.users u on u.email = s.username || '@junkyard.camp'
on conflict (id) do update
  set username     = excluded.username,
      display_name = excluded.display_name,
      role         = excluded.role,
      is_active    = true;

select username, role, is_active from public.app_users order by role, username;
