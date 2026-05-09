import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaUsers,
  FaChevronDown,
  FaSun,
  FaMoon,
  FaArrowsRotate,
  FaArrowRotateLeft,
  FaRightFromBracket,
} from 'react-icons/fa6';
import ConvoyMap from '../components/map/ConvoyMap';
import ParticipantList from '../components/trip/ParticipantList';
import ReactionBar from '../components/trip/ReactionBar';
import ReactionToasts from '../components/trip/ReactionToasts';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { useTripRealtime } from '../hooks/useTripRealtime';
import { useTripStore } from '../store/tripStore';
import { useMapStore } from '../store/mapStore';
import { loadIdentity, clearIdentity } from '../store/userStore';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { fetchDirections } from '../lib/directions';
import {
  isWithinRadius,
  snappedDistanceToRoute,
  progressAlongRoute,
} from '../utils/geo';
import {
  ARRIVAL_RADIUS_METERS,
  POSITION_UPDATE_INTERVAL_MS,
  POSITION_LOG_INTERVAL_MS,
} from '../lib/constants';

const OFF_ROUTE_DISTANCE_M = 60;
const OFF_ROUTE_TICKS_BEFORE_REROUTE = 2;
const AUTO_REROUTE_COOLDOWN_MS = 15_000;

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
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const setMapStyle = useMapStore((s) => s.setMapStyle);
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

  useEffect(() => {
    if (!trip || trip.status !== 'active' || !myParticipantId) return undefined;
    const tick = async () => {
      const p = positionRef.current;
      if (!p) return;
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

  // Off-route detection — tighter thresholds now (2 ticks > 60m, 15s cooldown)
  // so the auto-reroute kicks in within a few seconds of an actual wrong turn
  // instead of waiting for the user to drift well off course.
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

    if (dist > OFF_ROUTE_DISTANCE_M) {
      offRouteCountRef.current += 1;
      if (
        offRouteCountRef.current < OFF_ROUTE_TICKS_BEFORE_REROUTE ||
        offRouteShownRef.current
      ) {
        return;
      }
      offRouteShownRef.current = true;

      const now = Date.now();
      const cooldownElapsed =
        now - lastAutoRerouteAtRef.current >= AUTO_REROUTE_COOLDOWN_MS;

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
    if (
      isWithinRadius({ lat: position.lat, lng: position.lng }, dest, ARRIVAL_RADIUS_METERS)
    ) {
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

  const me = participants.find((p) => p.id === myParticipantId);
  const isHost = Boolean(me?.is_host);

  const handleConfirmExit = async () => {
    if (!trip) return;
    if (isHost) {
      try {
        await api.setStatus(trip.id, 'finished');
      } catch (err) {
        console.warn('[convoy] end trip failed', err);
      }
      // Host stays in localStorage for results view.
      navigate(`/trip/${shareToken}/results`, { replace: true });
    } else {
      // Guest: drop our identity for this trip and bounce home. Their position
      // logs and finish state remain on the server for the results screen.
      clearIdentity(trip.id);
      navigate('/', { replace: true });
    }
  };

  // Past-route trim progress (0..1) — feeds the line-gradient in ConvoyMap so
  // the road behind you fades out, like Google Maps navigation.
  const activeCoords = (personalReroute ?? trip?.route_data)?.geometry?.coordinates;
  const routeProgress = useMemo(() => {
    if (!activeCoords || !position) return null;
    const { progress } = progressAlongRoute(
      { lat: position.lat, lng: position.lng },
      activeCoords
    );
    return progress;
  }, [activeCoords, position]);

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
        routeProgress={routeProgress}
      />

      {/* Right-side: collapsible riders panel */}
      <div className="absolute right-2 top-2 z-10 flex w-[calc(100%-1rem)] max-w-xs flex-col items-end gap-2 sm:right-4 sm:top-4 sm:w-72 sm:max-w-none">
        {panelCollapsed ? (
          <button
            type="button"
            onClick={() => setPanelCollapsed(false)}
            className="flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-50"
            aria-label="Expand riders panel"
          >
            <FaUsers className="h-4 w-4 text-slate-500" aria-hidden />
            <span>
              {participants.length} {participants.length === 1 ? 'rider' : 'riders'}
            </span>
            <FaChevronDown className="h-3 w-3 text-slate-500" aria-hidden />
          </button>
        ) : (
          <ParticipantList
            participants={participants}
            myParticipantId={myParticipantId}
            destination={destination}
            transportMode={trip.transport_mode}
            onCollapse={() => setPanelCollapsed(true)}
            onLeave={() => setConfirmExit(true)}
            isHost={isHost}
          />
        )}
      </div>

      {/* Top-left: theme toggle */}
      <button
        type="button"
        onClick={() => setMapStyle(mapStyle === 'dark' ? 'light' : 'dark')}
        aria-label={`Switch to ${mapStyle === 'dark' ? 'light' : 'dark'} map`}
        className="absolute left-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95 sm:left-4 sm:top-4"
      >
        {mapStyle === 'dark' ? (
          <FaSun className="h-5 w-5 text-amber-500" aria-hidden />
        ) : (
          <FaMoon className="h-5 w-5 text-slate-700" aria-hidden />
        )}
      </button>

      {/* Bottom-left: reroute stack — sits ABOVE the recenter button (which
          ConvoyMap renders at bottom-20 left-4 when follow is paused). */}
      <div className="absolute bottom-36 left-4 z-10 flex flex-col gap-2">
        {personalReroute && (
          <button
            type="button"
            onClick={handleUseMain}
            aria-label="Switch back to main route"
            title="Switch back to main route"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
          >
            <FaArrowRotateLeft className="h-4 w-4 text-slate-600" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={handleManualReroute}
          disabled={rerouting}
          aria-label={
            personalReroute
              ? 'Recompute personal route from here'
              : 'Reroute from here'
          }
          title={
            personalReroute
              ? 'Recompute personal route from here'
              : 'Reroute from here'
          }
          className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95 disabled:cursor-wait disabled:opacity-60"
        >
          <FaArrowsRotate
            className={`h-5 w-5 text-blue-600 ${rerouting ? 'animate-spin' : ''}`}
            aria-hidden
          />
        </button>
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

      {confirmExit && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-center gap-2">
              <FaRightFromBracket className="h-5 w-5 text-slate-700" aria-hidden />
              <h2 className="text-lg font-semibold">
                {isHost ? 'End trip for everyone?' : 'Leave trip?'}
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              {isHost
                ? 'This finishes the convoy for all riders and sends everyone to the results screen.'
                : 'You will leave this convoy. Other riders will continue without you.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmExit}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                {isHost ? 'End trip' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
