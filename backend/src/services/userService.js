import { getSupabase } from '../lib/supabase.js';

function fail(message, status = 500, code = 'internal_error') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export async function listMyTrips(userId) {
  const { data, error } = await getSupabase()
    .from('participants')
    .select('trip_id, is_host, finish_rank, finished_at, trips(*)')
    .eq('user_id', userId);
  if (error) throw fail(error.message, 500, 'list_trips_failed');

  const seen = new Set();
  const trips = [];
  for (const row of data ?? []) {
    if (!row.trips || seen.has(row.trips.id)) continue;
    seen.add(row.trips.id);
    trips.push({
      ...row.trips,
      myRole: row.is_host ? 'host' : 'rider',
      myFinishRank: row.finish_rank,
      myFinishedAt: row.finished_at,
    });
  }
  trips.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  return trips;
}

// Claim guest participant rows whose user_id is still null. Restricting on
// `user_id is null` prevents re-assignment of someone else's already-claimed
// rows even if a malicious caller passes their participant ids.
export async function claimGuestParticipants(userId, participantIds) {
  if (!Array.isArray(participantIds) || participantIds.length === 0) return 0;
  const { data, error } = await getSupabase()
    .from('participants')
    .update({ user_id: userId })
    .in('id', participantIds)
    .is('user_id', null)
    .select('id');
  if (error) throw fail(error.message, 500, 'claim_failed');
  return data?.length ?? 0;
}
