import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FaTrophy, FaCar } from 'react-icons/fa6';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import ReplayPlayer from '../components/results/ReplayPlayer';
import { api } from '../lib/api';
import { formatDuration, formatDistance } from '../utils/formatters';
import { useUserStore } from '../store/userStore';

const PODIUM_COLOR = {
  1: 'text-amber-400', // gold
  2: 'text-slate-400', // silver
  3: 'text-orange-400', // bronze
};

export default function TripResults() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const session = useUserStore((s) => s.session);
  const [trip, setTrip] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const isGuest = !session;

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
        const data = await api.getResults(t.id);
        if (!cancelled) {
          setTrip(data.trip);
          setParticipants(data.participants);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
        </div>
      </div>
    );
  }
  if (!trip) {
    return <div className="p-6 text-slate-500">Loading results…</div>;
  }

  const finishers = participants.filter((p) => p.finish_rank);
  const podium = finishers.slice(0, 3);
  const winnerTime = podium[0]?.total_time_ms;

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Trip results
          </p>
          <h1 className="mt-1 break-words text-2xl font-semibold sm:text-3xl">
            {trip.destination_name}
          </h1>
          {winnerTime != null && (
            <p className="mt-1 text-sm text-slate-600">
              Winner finished in{' '}
              <span className="font-semibold text-slate-900">
                {formatDuration(winnerTime)}
              </span>
            </p>
          )}
        </header>

        {podium.length > 0 && (
          <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
            <PodiumSlot rider={podium[1]} rank={2} barHeight="h-20 sm:h-24" />
            <PodiumSlot rider={podium[0]} rank={1} barHeight="h-28 sm:h-32" />
            <PodiumSlot rider={podium[2]} rank={3} barHeight="h-16 sm:h-20" />
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">All riders</p>
          <ul className="space-y-3">
            {participants.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <Avatar name={p.display_name} color={p.color} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {p.display_name}
                    {p.is_host && (
                      <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        Host
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {p.finish_rank ? (
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        <span>
                          <span className="font-semibold text-slate-700">
                            #{p.finish_rank}
                          </span>{' '}
                          · {formatDuration(p.total_time_ms)}
                        </span>
                        {(p.actual_distance_m ?? p.planned_distance_m) != null && (
                          <span>
                            {formatDistance(p.actual_distance_m ?? p.planned_distance_m)}
                            {p.actual_distance_m == null && p.planned_distance_m != null && (
                              <span className="text-slate-400"> (planned)</span>
                            )}
                          </span>
                        )}
                        {p.avg_speed_kmh != null && (
                          <span>{Math.round(p.avg_speed_kmh)} km/h avg</span>
                        )}
                        {p.max_speed_kmh != null && (
                          <span>{Math.round(p.max_speed_kmh)} km/h max</span>
                        )}
                      </div>
                    ) : (
                      <span className="italic">Did not finish</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <ReplayPlayer tripId={trip.id} />

        {isGuest && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <p className="flex items-center gap-2 font-semibold">
              <FaCar className="h-4 w-4" aria-hidden />
              Nice convoy!
            </p>
            <p className="mt-1">
              You're a guest right now. Account features (saved trip history,
              dashboard, faster joins) are coming in the next release.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button onClick={() => navigate('/')} className="flex-1">
            Plan another trip
          </Button>
        </div>
      </div>
    </div>
  );
}

function PodiumSlot({ rider, rank, barHeight }) {
  if (!rider) return <div />;
  return (
    <div className="flex flex-col items-center text-center">
      <FaTrophy className={`h-7 w-7 ${PODIUM_COLOR[rank] ?? 'text-slate-400'}`} aria-hidden />
      <Avatar name={rider.display_name} color={rider.color} size={48} />
      <div className="mt-1 max-w-full truncate text-sm font-semibold">
        {rider.display_name}
      </div>
      <div className="text-xs text-slate-500">
        {formatDuration(rider.total_time_ms)}
      </div>
      <div
        className={`mt-2 flex w-full items-center justify-center rounded-t-lg font-bold text-white ${barHeight}`}
        style={{ backgroundColor: rider.color }}
      >
        #{rank}
      </div>
    </div>
  );
}
