import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ConvoyMap from '../components/map/ConvoyMap';
import ParticipantList from '../components/trip/ParticipantList';
import ReactionBar from '../components/trip/ReactionBar';
import ReactionToasts from '../components/trip/ReactionToasts';
import RerouteControls from '../components/trip/RerouteControls';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { useTripRealtime } from '../hooks/useTripRealtime';
import { useTripStore } from '../store/tripStore';
import { loadIdentity } from '../store/userStore';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { fetchDirections } from '../lib/directions';
import { isWithinRadius, snappedDistanceToRoute } from '../utils/geo';
import {
  ARRIVAL_RADIUS_METERS,
  POSITION_UPDATE_INTERVAL_MS,
  POSITION_LOG_INTERVAL_MS,
} from '../lib/constants';

export default function TripActive() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const trip = useTripStore((s) => s.trip);
  const route = useTripStore((s) => s.route);
  const participants = useTripStore((s) => s.participants);
  const myParticipantId = useTripStore((s) => s.myParticipantId);
  const setTrip = useTripStore((s) => s.setTrip);
  const setRoute = useTripStore((s) => s.setRoute);
  const setParticipants = useTripStore((s) => s.setParticipants);
  const setMyParticipantId = useTripStore((s) => s.setMyParticipantId);
  const updateParticipantPosition = useTripStore((s) => s.updateParticipantPosition);
  const personalReroute = useTripStore((s) => s.personalReroute);
  const setPersonalReroute = useTripStore((s) => s.setPersonalReroute);

  const [error, setError] = useState(null);
  const [rerouting, setRerouting] = useState(false);
  const { position, error: gpsError } = useGeoLocation();
  const positionRef = useRef(position);
  positionRef.current = position;
  const offRouteCountRef = useRef(0);
  const offRouteShownRef = useRef(false);
  const lastAutoRerouteAtRef = useRef(0);
  const pushToast = useTripStore((s) => s.pushToast);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { trip: t } = await api.getTrip(shareToken);
        if (cancelled) return;
        if (!t) {
          setError('Trip not found');
          return;
        }
        if (t.status === 'finished') {
          navigate(`/trip/${shareToken}/results`, { replace: true });
          return;
        }
        if (t.status === 'lobby') {
          navigate(`/trip/${shareToken}/lobby`, { replace: true });
          return;
        }
        const id = loadIdentity(t.id);
        if (!id) {
          navigate(`/join/${shareToken}`, { replace: true });
          return;
        }
        setTrip(t);
        setRoute(t.route_data ?? null);
        setPersonalReroute(null);
        setMyParticipantId(id.participantId);
        const { participants: p } = await api.listParticipants(t.id);
        if (!cancelled) setParticipants(p);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    shareToken,
    navigate,
    setTrip,
    setRoute,
    setPersonalReroute,
    setParticipants,
    setMyParticipantId,
  ]);

  useTripRealtime(trip?.id);

  // Write my own GPS into the local store immediately — no Realtime roundtrip
  // for myself, so my marker renders the moment GPS resolves. We do NOT filter
  // by accuracy here: desktop browsers triangulate via Wi-Fi/IP and routinely
  // report accuracy in the hundreds of meters, which would otherwise hide the
  // user from their own map for the entire trip.
  useEffect(() => {
    if (!myParticipantId || !position) return;
    updateParticipantPosition(myParticipantId, {
      lat: position.lat,
      lng: position.lng,
      heading: position.heading,
      speed_kmh: position.speed != null ? position.speed * 3.6 : null,
      updated_at: new Date().toISOString(),
    });
  }, [position, myParticipantId, updateParticipantPosition]);

  // Broadcast my GPS to position_updates every 3s.
  useEffect(() => {
    if (!trip || trip.status !== 'active' || !myParticipantId) return undefined;

    const tick = async () => {
      const p = positionRef.current;
      if (!p) return;
      // Loose threshold: desktop testing reports >100m routinely. Production
      // can tighten this back toward 50m once we're on real mobile hardware.
      if (p.accuracy && p.accuracy > 500) return;
      const { error: upsertErr } = await supabase
        .from('position_updates')
        .upsert({
          participant_id: myParticipantId,
          trip_id: trip.id,
          lat: p.lat,
          lng: p.lng,
          heading: p.heading ?? null,
          speed_kmh: p.speed != null ? p.speed * 3.6 : null,
          updated_at: new Date().toISOString(),
        });
      if (upsertErr) console.warn('[convoy] position upsert failed', upsertErr);
    };

    tick();
    const interval = setInterval(tick, POSITION_UPDATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [trip, myParticipantId]);

  // Append a row to position_logs every 5s for replay/stats.
  useEffect(() => {
    if (!trip || trip.status !== 'active' || !myParticipantId) return undefined;

    const log = async () => {
      const p = positionRef.current;
      if (!p) return;
      if (p.accuracy && p.accuracy > 500) return;
      const { error: insertErr } = await supabase.from('position_logs').insert({
        participant_id: myParticipantId,
        trip_id: trip.id,
        lat: p.lat,
        lng: p.lng,
        speed_kmh: p.speed != null ? p.speed * 3.6 : null,
      });
      if (insertErr) console.warn('[convoy] position log failed', insertErr);
    };

    log();
    const interval = setInterval(log, POSITION_LOG_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [trip, myParticipantId]);

  // Off-route detection runs against the *active* route (personal reroute if
  // one is set, else the trip's main route). After 3 consecutive fixes >100m
  // away we either auto-reroute (if the cooldown has elapsed) or fall back to
  // a plain warning toast. The cooldown protects against thrashing under GPS
  // jitter or zig-zagging.
  useEffect(() => {
    if (!trip || !position) return;
    const activeRoute = personalReroute ?? trip.route_data;
    const coords = activeRoute?.geometry?.coordinates;
    if (!coords) return;
    const dist = snappedDistanceToRoute(
      { lat: position.lat, lng: position.lng },
      coords
    );
    if (dist == null) return;

    if (dist > 100) {
      offRouteCountRef.current += 1;
      if (offRouteCountRef.current < 3 || offRouteShownRef.current) return;
      offRouteShownRef.current = true;

      const now = Date.now();
      const cooldownElapsed = now - lastAutoRerouteAtRef.current >= 30_000;

      if (cooldownElapsed) {
        lastAutoRerouteAtRef.current = now;
        fetchDirections({
          from: { lat: position.lat, lng: position.lng },
          to: { lat: trip.destination_lat, lng: trip.destination_lng },
          mode: trip.transport_mode,
          avoidTolls: trip.avoid_tolls,
        })
          .then((routes) => {
            if (routes[0]) {
              setPersonalReroute(routes[0]);
              const km = (routes[0].distance / 1000).toFixed(1);
              pushToast({
                type: 'system',
                variant: 'info',
                message: `Auto-rerouted from here · ${km} km`,
              });
            } else {
              pushToast({
                type: 'system',
                variant: 'warning',
                message: `You may be off route (${Math.round(dist)} m away)`,
              });
            }
          })
          .catch(() => {
            pushToast({
              type: 'system',
              variant: 'warning',
              message: `You may be off route (${Math.round(dist)} m away)`,
            });
          });
      } else {
        pushToast({
          type: 'system',
          variant: 'warning',
          message: `You may be off route (${Math.round(dist)} m away)`,
        });
      }
    } else {
      offRouteCountRef.current = 0;
      offRouteShownRef.current = false;
    }
  }, [position, trip, personalReroute, pushToast, setPersonalReroute]);

  const handleManualReroute = async () => {
    if (rerouting || !position || !trip) return;
    setRerouting(true);
    try {
      const routes = await fetchDirections({
        from: { lat: position.lat, lng: position.lng },
        to: { lat: trip.destination_lat, lng: trip.destination_lng },
        mode: trip.transport_mode,
        avoidTolls: trip.avoid_tolls,
      });
      if (routes[0]) {
        setPersonalReroute(routes[0]);
        lastAutoRerouteAtRef.current = Date.now();
        pushToast({
          type: 'system',
          variant: 'info',
          message: 'Rerouted from your current position',
        });
      } else {
        pushToast({
          type: 'system',
          variant: 'warning',
          message: 'No route found from here',
        });
      }
    } catch {
      pushToast({
        type: 'system',
        variant: 'warning',
        message: 'Reroute failed',
      });
    } finally {
      setRerouting(false);
    }
  };

  const handleUseMain = () => {
    setPersonalReroute(null);
    offRouteCountRef.current = 0;
    offRouteShownRef.current = false;
    pushToast({
      type: 'system',
      message: 'Following main route',
    });
  };

  // Geofenced arrival detection.
  useEffect(() => {
    if (!trip || !position || !myParticipantId) return;
    const me = participants.find((p) => p.id === myParticipantId);
    if (!me || me.finished_at) return;
    const dest = { lat: trip.destination_lat, lng: trip.destination_lng };
    if (isWithinRadius({ lat: position.lat, lng: position.lng }, dest, ARRIVAL_RADIUS_METERS)) {
      api.finishParticipant(myParticipantId).catch((err) => {
        console.warn('[convoy] finish failed', err);
      });
    }
  }, [trip, position, participants, myParticipantId]);

  // Once everyone has finished, end the trip and head to results.
  useEffect(() => {
    if (!trip || participants.length === 0) return;
    const allFinished = participants.every((p) => p.finished_at);
    if (allFinished) {
      api.setStatus(trip.id, 'finished').catch(() => {});
      navigate(`/trip/${shareToken}/results`, { replace: true });
    }
  }, [trip, participants, navigate, shareToken]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!trip) return <div className="p-6 text-slate-500">Loading trip…</div>;

  const destination = { lat: trip.destination_lat, lng: trip.destination_lng };
  // When a personal reroute is in effect we show it as the bright primary
  // route and demote the trip's main route to a muted gray "alternate", so
  // the user can still see where the rest of the convoy is heading.
  const displayRoute = personalReroute ?? route;
  const displayAlts = personalReroute && route ? [route] : [];

  return (
    <div className="relative h-full w-full">
      <ConvoyMap
        destination={destination}
        route={displayRoute}
        alternateRoutes={displayAlts}
        participants={participants}
        myParticipantId={myParticipantId}
        followParticipantId={myParticipantId}
      />
      <div className="absolute right-2 top-2 z-10 w-[calc(100%-1rem)] max-w-xs space-y-2 sm:right-4 sm:top-4 sm:w-72 sm:max-w-none">
        <ParticipantList
          participants={participants}
          myParticipantId={myParticipantId}
          destination={destination}
          transportMode={trip.transport_mode}
        />
        <RerouteControls
          rerouted={Boolean(personalReroute)}
          loading={rerouting}
          onReroute={handleManualReroute}
          onUseMain={handleUseMain}
        />
      </div>
      <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
        <ReactionBar tripId={trip.id} participantId={myParticipantId} />
      </div>
      <ReactionToasts />
      {gpsError && (
        <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-amber-100 px-3 py-1 text-sm text-amber-800 shadow">
          GPS unavailable — turn on location services
        </div>
      )}
      {!gpsError && position?.accuracy != null && position.accuracy > 50 && (
        <div className="absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-amber-50 px-3 py-1 text-xs text-amber-700 shadow">
          Weak GPS · ±{Math.round(position.accuracy)} m
        </div>
      )}
    </div>
  );
}
