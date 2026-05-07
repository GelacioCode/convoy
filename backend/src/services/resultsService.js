import { getSupabase } from '../lib/supabase.js';

const EARTH_RADIUS_M = 6_371_000;
const MIN_LOGS_FOR_ACTUAL_DISTANCE = 3;

function fail(message, status = 500, code = 'internal_error') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function haversineMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(x));
}

function aggregateLogs(logs) {
  let maxSpeed = null;
  let distance = 0;
  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];
    if (log.speed_kmh != null && (maxSpeed == null || log.speed_kmh > maxSpeed)) {
      maxSpeed = log.speed_kmh;
    }
    if (i > 0) {
      distance += haversineMeters(logs[i - 1], log);
    }
  }
  return { maxSpeed, distance };
}

export async function getResults(tripId) {
  const sb = getSupabase();

  const { data: trip, error: tripErr } = await sb
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr) throw fail(tripErr.message, 500, 'trip_lookup_failed');
  if (!trip) throw fail('trip_not_found', 404, 'trip_not_found');

  const { data: participants, error: pErr } = await sb
    .from('participants')
    .select('*')
    .eq('trip_id', tripId);
  if (pErr) throw fail(pErr.message, 500, 'participants_failed');

  const { data: logs, error: lErr } = await sb
    .from('position_logs')
    .select('participant_id, lat, lng, speed_kmh, logged_at')
    .eq('trip_id', tripId)
    .order('logged_at', { ascending: true });
  if (lErr) throw fail(lErr.message, 500, 'logs_failed');

  const logsByParticipant = new Map();
  for (const log of logs ?? []) {
    if (!logsByParticipant.has(log.participant_id)) {
      logsByParticipant.set(log.participant_id, []);
    }
    logsByParticipant.get(log.participant_id).push(log);
  }

  const plannedDistanceM = trip.route_data?.distance ?? null;
  const startedAt = trip.started_at ? new Date(trip.started_at).getTime() : null;

  const enriched = (participants ?? []).map((p) => {
    const myLogs = logsByParticipant.get(p.id) ?? [];
    const { maxSpeed, distance: rawActualM } = aggregateLogs(myLogs);
    const useActual = myLogs.length >= MIN_LOGS_FOR_ACTUAL_DISTANCE && rawActualM > 0;
    const actualDistanceM = useActual ? rawActualM : null;

    const finishedAt = p.finished_at ? new Date(p.finished_at).getTime() : null;
    const totalTimeMs = startedAt && finishedAt ? finishedAt - startedAt : null;

    const distanceForAvg = actualDistanceM ?? plannedDistanceM;
    const avgSpeedKmh =
      totalTimeMs && distanceForAvg
        ? distanceForAvg / 1000 / (totalTimeMs / 3_600_000)
        : null;

    return {
      ...p,
      total_time_ms: totalTimeMs,
      planned_distance_m: plannedDistanceM,
      actual_distance_m: actualDistanceM,
      avg_speed_kmh: avgSpeedKmh,
      max_speed_kmh: maxSpeed,
    };
  });

  enriched.sort((a, b) => {
    if (a.finish_rank && b.finish_rank) return a.finish_rank - b.finish_rank;
    if (a.finish_rank) return -1;
    if (b.finish_rank) return 1;
    return 0;
  });

  return { trip, participants: enriched };
}

export async function getReplay(tripId) {
  const sb = getSupabase();

  const { data: trip, error: tripErr } = await sb
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .maybeSingle();
  if (tripErr) throw fail(tripErr.message, 500, 'trip_lookup_failed');
  if (!trip) throw fail('trip_not_found', 404, 'trip_not_found');

  const { data: participants, error: pErr } = await sb
    .from('participants')
    .select('id, display_name, color, is_host, finish_rank, finished_at')
    .eq('trip_id', tripId);
  if (pErr) throw fail(pErr.message, 500, 'participants_failed');

  const { data: logs, error: lErr } = await sb
    .from('position_logs')
    .select('participant_id, lat, lng, speed_kmh, logged_at')
    .eq('trip_id', tripId)
    .order('logged_at', { ascending: true });
  if (lErr) throw fail(lErr.message, 500, 'logs_failed');

  const logsByParticipant = new Map();
  for (const log of logs ?? []) {
    if (!logsByParticipant.has(log.participant_id)) {
      logsByParticipant.set(log.participant_id, []);
    }
    logsByParticipant.get(log.participant_id).push({
      lat: log.lat,
      lng: log.lng,
      speed_kmh: log.speed_kmh,
      logged_at: log.logged_at,
    });
  }

  const tracks = (participants ?? [])
    .map((p) => ({
      participantId: p.id,
      displayName: p.display_name,
      color: p.color,
      isHost: p.is_host,
      finishRank: p.finish_rank,
      logs: logsByParticipant.get(p.id) ?? [],
    }))
    .filter((t) => t.logs.length > 0);

  return { trip, tracks };
}
