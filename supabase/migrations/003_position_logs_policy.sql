-- Allow anon clients to append rows to position_logs during an active trip.
-- The frontend writes one row per participant every ~5 seconds; rows are
-- read back by the backend (service role, RLS-bypassing) when computing
-- /api/trips/:id/results stats.
--
-- Phase 5 will tighten this to require participant_id to match a session-bound
-- guest token or auth.uid() for an authenticated rider.

drop policy if exists "anon write position_logs" on position_logs;
create policy "anon write position_logs" on position_logs
  for insert with check (true);

-- Read access only matters if we ever query logs from the frontend (e.g. route
-- replay). Backend uses service role which bypasses RLS regardless.
drop policy if exists "anon read position_logs" on position_logs;
create policy "anon read position_logs" on position_logs
  for select using (true);
