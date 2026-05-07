import { useEffect, useMemo, useRef, useState } from 'react';
import ConvoyMap from '../map/ConvoyMap';
import { api } from '../../lib/api';
import { calculateBearing } from '../../utils/geo';
import { formatDuration } from '../../utils/formatters';

const TICK_MS = 50;
const SPEED_OPTIONS = [1, 2, 4, 8, 16];

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
  const [currentMs, setCurrentMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
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

  const { startMs, endMs, durationMs } = useMemo(() => {
    if (!data) return { startMs: 0, endMs: 0, durationMs: 0 };
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
      durationMs: Math.max(end - start, 1000),
    };
  }, [data]);

  // Auto-advance using requestAnimationFrame so playback stays smooth even
  // when the tab is frontmost (setInterval drifts under load).
  useEffect(() => {
    if (!playing || durationMs <= 0) return undefined;
    let raf = 0;
    lastFrameRef.current = performance.now();
    const tick = (now) => {
      const dt = now - lastFrameRef.current;
      lastFrameRef.current = now;
      setCurrentMs((cur) => {
        const next = cur + dt * speed;
        if (next >= durationMs) {
          setPlaying(false);
          return durationMs;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, durationMs]);

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
    const target = startMs + currentMs;
    return data.tracks
      .map((t) => {
        const pos = interpolate(t.logs, target);
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
  }, [data, startMs, currentMs]);

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

  const handleScrub = (e) => {
    setCurrentMs(Number(e.target.value));
    setPlaying(false);
  };

  const handleTogglePlay = () => {
    if (currentMs >= durationMs) setCurrentMs(0);
    setPlaying((p) => !p);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">Route replay</p>
        <span className="text-xs text-slate-500">
          {formatDuration(currentMs)} / {formatDuration(durationMs)}
        </span>
      </div>

      <div className="h-72 overflow-hidden rounded-lg border border-slate-200">
        <ConvoyMap
          destination={{ lat: data.trip.destination_lat, lng: data.trip.destination_lng }}
          route={data.trip.route_data}
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
          {playing ? '⏸' : '▶'}
        </button>
        <input
          type="range"
          min={0}
          max={durationMs}
          step={Math.max(durationMs / 1000, TICK_MS)}
          value={currentMs}
          onChange={handleScrub}
          className="flex-1 cursor-pointer accent-blue-600"
        />
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="shrink-0 rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
          aria-label="Playback speed"
        >
          {SPEED_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
