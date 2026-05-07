import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import ConvoyMap from '../map/ConvoyMap';
import { api } from '../../lib/api';
import { loadIdentity } from '../../store/userStore';

const POLL_MS = 2000;

export default function TripLobby() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [identity, setIdentity] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [starting, setStarting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async (firstRun) => {
      try {
        let currentTrip = trip;
        if (firstRun || !currentTrip) {
          const { trip: t } = await api.getTrip(shareToken);
          if (cancelled) return;
          currentTrip = t;
          setTrip(t);
          const id = loadIdentity(t.id);
          setIdentity(id);
          if (!id) {
            navigate(`/join/${shareToken}`, { replace: true });
            return;
          }
        }
        const { participants: p } = await api.listParticipants(currentTrip.id);
        if (cancelled) return;
        setParticipants(p);

        if (currentTrip.status === 'active') {
          navigate(`/trip/${shareToken}/active`, { replace: true });
          return;
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) timer = setTimeout(() => tick(false), POLL_MS);
      }
    };

    tick(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareToken]);

  const shareUrl = `${window.location.origin}/join/${shareToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const handleStart = async () => {
    if (starting || !trip) return;
    setStarting(true);
    try {
      await api.setStatus(trip.id, 'active');
      navigate(`/trip/${shareToken}/active`);
    } catch (err) {
      setLoadError(err.message);
      setStarting(false);
    }
  };

  if (loadError && !trip) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {loadError}
        </div>
      </div>
    );
  }

  if (!trip) return <div className="p-6 text-slate-500">Loading lobby…</div>;

  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <div>
        <p className="text-sm text-slate-500">Convoy to</p>
        <h1 className="break-words text-xl font-semibold sm:text-2xl">
          {trip.destination_name}
        </h1>
      </div>

      {trip.route_data && (
        <div className="h-48 overflow-hidden rounded-xl border border-slate-200 shadow-sm sm:h-56">
          <ConvoyMap
            destination={{ lat: trip.destination_lat, lng: trip.destination_lng }}
            route={trip.route_data}
          />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-medium text-slate-700">Share link</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={shareUrl}
            readOnly
            onFocus={(e) => e.target.select()}
            className="flex-1 truncate rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
          />
          <Button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy'}</Button>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-medium text-slate-700">
          Riders ({participants.length})
        </p>
        <ul className="space-y-2">
          {participants.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1"
            >
              <Avatar name={p.display_name} color={p.color} />
              <span className="font-medium">{p.display_name}</span>
              {p.is_host && (
                <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                  Host
                </span>
              )}
              {identity?.participantId === p.id && (
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  You
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {loadError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {identity?.isHost ? (
        <Button
          onClick={handleStart}
          disabled={starting || participants.length === 0}
          className="w-full"
        >
          {starting ? 'Starting…' : 'Start convoy'}
        </Button>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Waiting for the host to start…
        </p>
      )}
    </div>
  );
}
