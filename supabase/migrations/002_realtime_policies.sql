-- Convoy realtime + RLS policies
-- Run after 001_init_schema.sql.

-- Enable RLS on all user-touchable tables. The Express backend uses the
-- service-role key, which bypasses RLS — these policies govern direct
-- frontend->Supabase access (Realtime subscriptions, position upserts).
alter table trips             enable row level security;
alter table participants      enable row level security;
alter table position_updates  enable row level security;
alter table position_logs     enable row level security;
alter table reactions         enable row level security;
alter table profiles          enable row level security;

-- Phase 2 dev policies: permissive read for anon clients so Realtime payloads
-- arrive. Tighten in Phase 5 when auth lands.
drop policy if exists "anon read trips"            on trips;
drop policy if exists "anon read participants"     on participants;
drop policy if exists "anon read position_updates" on position_updates;
drop policy if exists "anon read reactions"        on reactions;
drop policy if exists "anon read profiles"         on profiles;

create policy "anon read trips"            on trips            for select using (true);
create policy "anon read participants"     on participants     for select using (true);
create policy "anon read position_updates" on position_updates for select using (true);
create policy "anon read reactions"        on reactions        for select using (true);
create policy "anon read profiles"         on profiles         for select using (true);

-- Phase 3: anyone can upsert their own position. Tightened by participant_id
-- match against a session header in Phase 5.
drop policy if exists "anon write position_updates" on position_updates;
create policy "anon write position_updates" on position_updates
  for insert with check (true);

drop policy if exists "anon update position_updates" on position_updates;
create policy "anon update position_updates" on position_updates
  for update using (true) with check (true);

drop policy if exists "anon write reactions" on reactions;
create policy "anon write reactions" on reactions
  for insert with check (true);

-- Realtime publication: stream changes on these tables to subscribed clients.
-- Supabase creates the `supabase_realtime` publication automatically; we just
-- add our tables to it.
alter publication supabase_realtime add table position_updates;
alter publication supabase_realtime add table reactions;
alter publication supabase_realtime add table participants;
alter publication supabase_realtime add table trips;
