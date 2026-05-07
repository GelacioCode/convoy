import { getSupabase } from '../lib/supabase.js';

function fail(message, status = 500, code = 'internal_error') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export async function joinTrip(tripId, input) {
  const sb = getSupabase();

  const { data: trip, error: tripErr } = await sb
    .from('trips')
    .select('id, status')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr) throw fail(tripErr.message, 500, 'trip_lookup_failed');
  if (!trip) throw fail('trip_not_found', 404, 'trip_not_found');
  if (trip.status === 'finished') throw fail('trip_finished', 409, 'trip_finished');

  const row = {
    trip_id: tripId,
    user_id: input.userId ?? null,
    guest_name: input.userId ? null : input.guestName,
    display_name: input.guestName,
    color: input.color,
    is_host: false,
  };

  const { data, error } = await sb
    .from('participants')
    .insert(row)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw fail('color_taken', 409, 'color_taken');
    }
    throw fail(error.message, 500, 'join_failed');
  }
  return data;
}

export async function listParticipants(tripId) {
  const { data, error } = await getSupabase()
    .from('participants')
    .select('*')
    .eq('trip_id', tripId)
    .order('joined_at', { ascending: true });
  if (error) throw fail(error.message, 500, 'participants_list_failed');
  return data ?? [];
}

export async function markFinished(participantId) {
  const sb = getSupabase();

  const { data: participant, error: pErr } = await sb
    .from('participants')
    .select('id, trip_id, finished_at')
    .eq('id', participantId)
    .maybeSingle();
  if (pErr) throw fail(pErr.message, 500, 'lookup_failed');
  if (!participant) throw fail('participant_not_found', 404, 'participant_not_found');
  if (participant.finished_at) return participant;

  const { count, error: countErr } = await sb
    .from('participants')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', participant.trip_id)
    .not('finished_at', 'is', null);
  if (countErr) throw fail(countErr.message, 500, 'rank_failed');

  const { data, error } = await sb
    .from('participants')
    .update({
      finished_at: new Date().toISOString(),
      finish_rank: (count ?? 0) + 1,
    })
    .eq('id', participantId)
    .select()
    .single();
  if (error) throw fail(error.message, 500, 'finish_failed');
  return data;
}

export async function setGhost(participantId, isGhost) {
  const { data, error } = await getSupabase()
    .from('participants')
    .update({ is_ghost: Boolean(isGhost) })
    .eq('id', participantId)
    .select()
    .single();
  if (error) throw fail(error.message, 500, 'ghost_failed');
  return data;
}
