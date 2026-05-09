import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from '../lib/supabase.js';

const SHARE_TOKEN_LENGTH = 8;

function makeShareToken() {
  return uuidv4().replace(/-/g, '').slice(0, SHARE_TOKEN_LENGTH);
}

function fail(message, status = 500, code = 'internal_error') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

export async function createTrip(input) {
  const sb = getSupabase();
  const tripRow = {
    host_id: input.hostId ?? null,
    share_token: makeShareToken(),
    destination_name: input.destinationName,
    destination_lat: input.destinationLat,
    destination_lng: input.destinationLng,
    route_data: input.routeData ?? null,
    transport_mode: input.transportMode ?? 'driving',
    avoid_tolls: Boolean(input.avoidTolls),
    status: 'lobby',
  };

  const { data: trip, error: tripErr } = await sb
    .from('trips')
    .insert(tripRow)
    .select()
    .single();
  if (tripErr) throw fail(tripErr.message, 500, 'trip_create_failed');

  let host = null;
  if (input.host) {
    const hostRow = {
      trip_id: trip.id,
      user_id: input.hostId ?? null,
      guest_name: input.hostId ? null : input.host.name,
      display_name: input.host.name,
      color: input.host.color,
      is_host: true,
    };
    const { data, error } = await sb
      .from('participants')
      .insert(hostRow)
      .select()
      .single();
    if (error) {
      await sb.from('trips').delete().eq('id', trip.id);
      throw fail(error.message, 500, 'host_create_failed');
    }
    host = data;
  }

  return { trip, host };
}

export async function getTripByShareToken(shareToken) {
  const { data, error } = await getSupabase()
    .from('trips')
    .select('*')
    .eq('share_token', shareToken)
    .maybeSingle();
  if (error) throw fail(error.message, 500, 'trip_lookup_failed');
  return data;
}

export async function deleteTrip(tripId, userId) {
  const sb = getSupabase();

  const { data: trip, error: lookupErr } = await sb
    .from('trips')
    .select('id, host_id')
    .eq('id', tripId)
    .maybeSingle();
  if (lookupErr) throw fail(lookupErr.message, 500, 'trip_lookup_failed');
  if (!trip) throw fail('trip_not_found', 404, 'trip_not_found');

  // Only the host can delete. host_id may be null for guest-created trips —
  // those can't be deleted via this endpoint (would need a guest-token check).
  if (!trip.host_id) {
    throw fail('guest_trip_cannot_delete', 403, 'guest_trip_cannot_delete');
  }
  if (trip.host_id !== userId) {
    throw fail('not_host', 403, 'not_host');
  }

  const { error: deleteErr } = await sb.from('trips').delete().eq('id', tripId);
  if (deleteErr) throw fail(deleteErr.message, 500, 'trip_delete_failed');
  return { id: tripId };
}

export async function setTripStatus(tripId, status) {
  const patch = { status };
  if (status === 'active') patch.started_at = new Date().toISOString();
  if (status === 'finished') patch.ended_at = new Date().toISOString();

  const { data, error } = await getSupabase()
    .from('trips')
    .update(patch)
    .eq('id', tripId)
    .select()
    .single();
  if (error) throw fail(error.message, 500, 'trip_status_failed');
  return data;
}
