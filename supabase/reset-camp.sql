-- Wipe the shared score log for a fresh camp start. Roster, days, categories
-- and accounts stay. Run in the Supabase SQL editor (RLS has no delete policy,
-- so this only works from the SQL editor / service role — by design).
--
-- Pair it with a client data-epoch bump (src/data/epoch.ts): bump DATA_EPOCH,
-- set EPOCH_AT to the deploy moment, ship. Devices then start from an empty
-- mirror and ignore any pre-epoch remote rows.

delete from score_events;
