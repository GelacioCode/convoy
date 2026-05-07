-- Phase 5 auth policies.
-- Profiles can only be inserted/updated by the matching auth.uid(), so a
-- logged-in user can create their own profile row but can't write someone
-- else's. SELECT was already opened up in 002 so display names + colors
-- can be shown alongside trip results.

drop policy if exists "self insert profiles" on profiles;
create policy "self insert profiles" on profiles
  for insert with check (auth.uid() = id);

drop policy if exists "self update profiles" on profiles;
create policy "self update profiles" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
