import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ColorPicker from '../components/ui/ColorPicker';
import Button from '../components/ui/Button';
import { api } from '../lib/api';
import { saveIdentity, loadIdentity } from '../store/userStore';
import { MARKER_COLORS } from '../lib/constants';

export default function JoinTrip() {
  const { shareToken } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const [name, setName] = useState('');
  const [color, setColor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { trip: t } = await api.getTrip(shareToken);
        if (cancelled) return;
        setTrip(t);
        const existing = loadIdentity(t.id);
        if (existing?.participantId) {
          navigate(`/trip/${shareToken}/lobby`, { replace: true });
          return;
        }
        const { participants: p } = await api.listParticipants(t.id);
        if (cancelled) return;
        setParticipants(p);
        const taken = new Set(p.map((x) => x.color));
        const firstAvailable = MARKER_COLORS.find((c) => !taken.has(c));
        setColor(firstAvailable ?? MARKER_COLORS[0]);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken, navigate]);

  const takenColors = participants.map((p) => p.color);

  const handleJoin = async () => {
    if (!name.trim() || !color || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { participant } = await api.joinTrip(trip.id, {
        guestName: name.trim(),
        color,
      });
      saveIdentity(trip.id, {
        participantId: participant.id,
        displayName: participant.display_name,
        color: participant.color,
        tripId: trip.id,
        shareToken,
        isHost: false,
      });
      navigate(`/trip/${shareToken}/lobby`);
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          Couldn't load trip: {loadError}
        </div>
      </div>
    );
  }

  if (!trip) {
    return <div className="p-6 text-slate-500">Loading trip…</div>;
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-5 shadow-lg sm:p-6">
        <div>
          <p className="text-sm text-slate-500">Convoy to</p>
          <h1 className="text-xl font-semibold">{trip.destination_name}</h1>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Your name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            Pick a color
          </label>
          <ColorPicker value={color} onChange={setColor} taken={takenColors} />
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <Button
          onClick={handleJoin}
          disabled={!name.trim() || !color || submitting}
          className="w-full"
        >
          {submitting ? 'Joining…' : 'Join convoy'}
        </Button>
      </div>
    </div>
  );
}
