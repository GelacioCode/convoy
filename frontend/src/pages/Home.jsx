import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import ConvoyMap from '../components/map/ConvoyMap';
import SearchBar from '../components/trip/SearchBar';
import TransportTabs from '../components/trip/TransportTabs';
import Modal from '../components/ui/Modal';
import ColorPicker from '../components/ui/ColorPicker';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import { useGeoLocation } from '../hooks/useGeoLocation';
import { useDirections } from '../hooks/useDirections';
import { api } from '../lib/api';
import { saveIdentity, useUserStore } from '../store/userStore';
import { MARKER_COLORS } from '../lib/constants';

const MOTORIZED_MODES = new Set(['driving', 'motorcycling']);

export default function Home() {
  const navigate = useNavigate();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const [destination, setDestination] = useState(null);
  const [mode, setMode] = useState('driving');
  const [origin, setOrigin] = useState(null);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const { position: userPosition } = useGeoLocation();

  const [createOpen, setCreateOpen] = useState(false);
  const [hostName, setHostName] = useState('');
  const [hostColor, setHostColor] = useState(MARKER_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Prefill the Create modal from the signed-in profile so logged-in users
  // don't have to re-type their name and color every trip. Only seeds empty
  // fields so a host who's already typed something keeps their input.
  useEffect(() => {
    if (!profile) return;
    setHostName((cur) => cur || profile.display_name || '');
    setHostColor((cur) =>
      cur === MARKER_COLORS[0] ? profile.avatar_color || MARKER_COLORS[0] : cur
    );
  }, [profile]);

  useEffect(() => {
    if (!destination) {
      setOrigin(null);
      return;
    }
    if (userPosition && !origin) {
      setOrigin({ lat: userPosition.lat, lng: userPosition.lng });
    }
  }, [destination, userPosition, origin]);

  const isMotorized = MOTORIZED_MODES.has(mode);

  const { routes, loading: routeLoading } = useDirections({
    from: origin,
    to: destination,
    mode,
    avoidTolls: isMotorized && avoidTolls,
    alternatives: isMotorized,
  });

  // Reset selection whenever the route list changes (new mode/destination/tolls).
  useEffect(() => {
    setSelectedRouteIndex(0);
  }, [routes]);

  const safeIndex = Math.min(selectedRouteIndex, Math.max(routes.length - 1, 0));
  const route = routes[safeIndex] ?? null;
  const alternateRoutes = routes.filter((_, i) => i !== safeIndex);

  const canCreate = Boolean(destination && route);

  const handleCreate = async () => {
    if (!hostName.trim() || !canCreate || submitting) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const { trip, host } = await api.createTrip({
        destinationName: destination.placeName,
        destinationLat: destination.lat,
        destinationLng: destination.lng,
        transportMode: mode,
        avoidTolls: isMotorized ? avoidTolls : false,
        routeData: route,
        host: { name: hostName.trim(), color: hostColor },
      });
      saveIdentity(trip.id, {
        participantId: host.id,
        displayName: host.display_name,
        color: host.color,
        tripId: trip.id,
        shareToken: trip.share_token,
        isHost: true,
      });
      navigate(`/trip/${trip.share_token}/lobby`);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative h-full w-full">
      <ConvoyMap
        userPosition={userPosition}
        destination={destination}
        route={route}
        alternateRoutes={alternateRoutes}
      />
      <div className="absolute left-2 right-2 top-2 mx-auto max-w-xl space-y-2 sm:left-4 sm:right-4 sm:top-4">
        <div className="flex justify-end">
          {session ? (
            <Link
              to="/dashboard"
              className="flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
            >
              <Avatar
                name={profile?.display_name ?? session.user?.email ?? 'You'}
                color={profile?.avatar_color ?? '#3B82F6'}
                size={28}
              />
              <span className="hidden pr-1 text-sm font-medium text-slate-700 sm:inline">
                {profile?.display_name ?? 'My account'}
              </span>
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-md ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Sign in
            </Link>
          )}
        </div>
        <SearchBar onSelect={setDestination} />
        <TransportTabs value={mode} onChange={setMode} />

        {isMotorized && destination && (
          <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-sm">
            <input
              type="checkbox"
              checked={avoidTolls}
              onChange={(e) => setAvoidTolls(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-blue-600"
            />
            <span className="text-sm text-slate-700">Avoid tolls</span>
          </label>
        )}

        {destination && routeLoading && routes.length === 0 && (
          <div className="rounded-lg bg-white px-3 py-1 text-sm text-slate-600 shadow-sm">
            Calculating route…
          </div>
        )}

        {routes.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {routes.map((r, i) => {
              const selected = i === safeIndex;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedRouteIndex(i)}
                  className={`shrink-0 rounded-lg border px-3 py-2 text-left shadow-sm transition ${
                    selected
                      ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900">
                    {Math.round(r.duration / 60)} min
                  </div>
                  <div className="text-xs text-slate-500">
                    {(r.distance / 1000).toFixed(1)} km
                    {selected && <span className="ml-1 text-blue-600">· selected</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {route && (
          <div className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="flex gap-4 text-sm">
              <span>
                <span className="font-semibold">{Math.round(route.duration / 60)}</span> min
              </span>
              <span>
                <span className="font-semibold">{(route.distance / 1000).toFixed(1)}</span> km
              </span>
            </div>
            <Button
              onClick={() => setCreateOpen(true)}
              className="w-full sm:w-auto"
            >
              Create Convoy
            </Button>
          </div>
        )}
      </div>

      <Modal open={createOpen}>
        <div className="w-80 space-y-4">
          <h2 className="text-lg font-semibold">Start a convoy</h2>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Your name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              maxLength={40}
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700">
              Your color
            </label>
            <ColorPicker value={hostColor} onChange={setHostColor} />
          </div>
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="rounded-lg px-4 py-2 text-slate-600 hover:bg-slate-100"
              disabled={submitting}
            >
              Cancel
            </button>
            <Button
              onClick={handleCreate}
              disabled={!hostName.trim() || submitting}
            >
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
