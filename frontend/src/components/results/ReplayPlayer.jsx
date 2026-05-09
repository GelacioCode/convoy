import { useEffect, useMemo, useRef, useState } from 'react';
import { FaPlay, FaPause, FaRoute } from 'react-icons/fa6';
import ConvoyMap from '../map/ConvoyMap';
import { api } from '../../lib/api';
import { calculateBearing } from '../../utils/geo';
import { formatDuration } from '../../utils/formatters';

const ANIMATION_DURATION_MS = 15_000;

function tsMs(iso) {
  return new Date(iso).getTime();
}

function interpolate(logs, targetMs) {
  if (!logs || logs.length === 0) return null;
  const firstMs = tsMs(logs[0].logged_at);
  if (targetMs < firstMs) return null;
  const lastMs = tsMs(logs[logs.length - 1].logged_at);
  if (targetMs >= lastMs) {
    const last = logs[logs.length - 1];
    const prev = logs[logs.length - 2] ?? last;
    return {
      lat: last.lat,
      lng: last.lng,
      heading:
        prev !== last
          ? calculateBearing({ lat: prev.lat, lng: prev.lng }, { lat: last.lat, lng: last.lng })
          : null,
    };
  }
  for (let i = 1; i < logs.length; i++) {
    const t = tsMs(logs[i].logged_at);
    if (t >= targetMs) {
      const prev = logs[i - 1];
      const next = logs[i];
      const prevT = tsMs(prev.logged_at);
      const span = Math.max(t - prevT, 1);
      const f = (targetMs - prevT) / span;
      return {
        lat: prev.lat + (next.lat - prev.lat) * f,
        lng: prev.lng + (next.lng - prev.lng) * f,
        heading: calculateBearing(
          { lat: prev.lat, lng: prev.lng },
          { lat: next.lat, lng: next.lng }
        ),
      };
    }
  }
  return null;
}

export default function ReplayPlayer({ tripId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [animMs, setAnimMs] = useState(0); // 0..ANIMATION_DURATION_MS
  const [playing, setPlaying] = useState(true);
  const [showMainRoute, setShowMainRoute] = useState(true);
  const lastFrameRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getReplay(tripId)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  const { startMs, endMs, tripDurationMs } = useMemo(() => {
    if (!data) return { startMs: 0, endMs: 0, tripDurationMs: 0 };
    const start = data.trip.started_at
      ? tsMs(data.trip.started_at)
      : data.tracks.length
      ? Math.min(...data.tracks.map((t) => tsMs(t.logs[0].logged_at)))
      : 0;
    const end = data.trip.ended_at
      ? tsMs(data.trip.ended_at)
      : data.tracks.length
      ? Math.max(...data.tracks.map((t) => tsMs(t.logs[t.logs.length - 1].logged_at)))
      : start + 1000;
    return {
      startMs: start,
      endMs: end,
      tripDurationMs: Math.max(end - start, 1000),
    };
  }, [data]);

  // Animate at a fixed total of ~15s regardless of trip length. Convert anim
  // time -> trip time by ratio. requestAnimationFrame keeps things smooth.
  useEffect(() => {
    if (!playing || tripDurationMs <= 0) return undefined;
    let raf = 0;
    lastFrameRef.current = performance.now();
    const tick = (now) => {
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;
      setAnimMs((cur) => {
        const next = cur + dt;
        if (next >= ANIMATION_DURATION_MS) {
          setPlaying(false);
          return ANIMATION_DURATION_MS;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, tripDurationMs]);

  const tripT = (animMs / ANIMATION_DURATION_MS) * tripDurationMs;
  const targetTimeMs = startMs + tripT;

  const trails = useMemo(() => {
    if (!data) return [];
    return data.tracks.map((t) => ({
      id: t.participantId,
      color: t.color,
      coordinates: t.logs.map((l) => [l.lng, l.lat]),
    }));
  }, [data]);

  const participants = useMemo(() => {
    if (!data) return [];
    return data.tracks
      .map((t) => {
        const pos = interpolate(t.logs, targetTimeMs);
        if (!pos) return null;
        return {
          id: t.participantId,
          display_name: t.displayName,
          color: t.color,
          lat: pos.lat,
          lng: pos.lng,
          heading: pos.heading,
        };
      })
      .filter(Boolean);
  }, [data, targetTimeMs]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Couldn't load replay: {error}
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        Loading replay…
      </div>
    );
  }
  if (data.tracks.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
        No GPS logs were recorded for this trip — replay isn't available.
      </div>
    );
  }

  const handleTogglePlay = () => {
    if (animMs >= ANIMATION_DURATION_MS) setAnimMs(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Route replay</p>
        <span className="text-xs text-slate-500">
          {formatDuration(tripT)} / {formatDuration(tripDurationMs)}
        </span>
      </div>

      <div className="h-72 overflow-hidden rounded-lg border border-slate-200">
        <ConvoyMap
          destination={{ lat: data.trip.destination_lat, lng: data.trip.destination_lng }}
          route={showMainRoute ? data.trip.route_data : null}
          participants={participants}
          participantTrails={trails}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleTogglePlay}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow hover:bg-blue-700 active:scale-95"
        >
          {playing ? (
            <FaPause className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <FaPlay className="ml-0.5 h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-600 transition-[width] duration-75"
            style={{ width: `${(animMs / ANIMATION_DURATION_MS) * 100}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMainRoute((v) => !v)}
          aria-pressed={showMainRoute}
          title={showMainRoute ? 'Hide main route' : 'Show main route'}
          className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
            showMainRoute
              ? 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
              : 'bg-slate-100 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-200'
          }`}
        >
          <FaRoute className="h-3.5 w-3.5" aria-hidden />
          <span className="hidden sm:inline">
            {showMainRoute ? 'Main route on' : 'Main route off'}
          </span>
        </button>
      </div>
    </div>
  );
}
