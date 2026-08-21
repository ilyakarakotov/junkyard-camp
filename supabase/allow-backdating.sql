-- Let every staff member add points to a PREVIOUS day. Paste into the Supabase
-- SQL editor and run it once, on a project that already has schema.sql.
--
-- Before this, only a director could reach a past day. A leader who forgot to
-- award Tuesday's good deed had to find the director during the evening
-- gathering, and if they did not, the point the team earned simply never
-- landed. That is a scoreboard being wrong in a way nobody can fix, which is
-- worse than the risk this opens up.
--
-- What replaces the role as the guard: the client makes a leader confirm a
-- warning that names the date before it will reopen the day, keeps a lit amber
-- band on screen for as long as that day stays open, and repeats the date in
-- every award dialog. Underneath, the table is append-only and every row
-- carries actor_id and occurred_at — so a backdated award is attributable, and
-- the audit log shows who added it and when.
--
-- Past only. A future day still needs a director: a day the camp has not
-- reached has nothing to correct, so awarding into it is always a mis-tap.
--
-- Mirrored client-side by canBackdateDay() in src/data/seed.ts. The two must
-- agree: a client wider than the policy means every backdated award sits in the
-- outbox forever while the phone shows the point as awarded.
--
-- Already folded into schema.sql — this file is only for a live project.

create or replace function camp_can_backdate_day(d text) returns boolean
  language sql stable set search_path = public as $$
  select exists (
    select 1 from days
     where id = d and scored and date <= camp_today()
  );
$$;

drop policy if exists w_events on score_events;

create policy w_events on score_events for insert to authenticated
with check (
  actor_id = auth.uid()
  and (
    camp_can_edit_day(day_id)
    or camp_can_backdate_day(day_id)
    or private.is_director()
  )
);
