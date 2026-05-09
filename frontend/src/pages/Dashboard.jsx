import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaXmark, FaTrash, FaArrowRight } from 'react-icons/fa6';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import { api } from '../lib/api';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { formatDistance } from '../utils/formatters';

const STATUS_LABEL = {
  lobby: 'Waiting',
  active: 'In progress',
  finished: 'Finished',
};

const STATUS_CLASS = {
  lobby: 'bg-amber-100 text-amber-700',
  active: 'bg-blue-100 text-blue-700',
  finished: 'bg-emerald-100 text-emerald-700',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const session = useUserStore((s) => s.session);
  const profile = useUserStore((s) => s.profile);
  const [trips, setTrips] = useState(null);
  const [error, setError] = useState(null);
  const [busyTripId, setBusyTripId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (session === null) {
      navigate('/login', { replace: true });
      return;
    }
    if (!session) return;
    let cancelled = false;
    api
      .getMyTrips()
      .then(({ trips: t }) => {
        if (!cancelled) setTrips(t);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (!session) return null;

  const tripPath = (t) => {
    if (t.status === 'finished') return `/trip/${t.share_token}/results`;
    if (t.status === 'active') return `/trip/${t.share_token}/active`;
    return `/trip/${t.share_token}/lobby`;
  };

  const refresh = async () => {
    const { trips: t } = await api.getMyTrips();
    setTrips(t);
  };

  const handleCancelTrip = async (trip) => {
    setBusyTripId(trip.id);
    setError(null);
    try {
      await api.setStatus(trip.id, 'finished');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyTripId(null);
      setConfirm(null);
    }
  };

  const handleDeleteTrip = async (trip) => {
    setBusyTripId(trip.id);
    setError(null);
    try {
      await api.deleteTrip(trip.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyTripId(null);
      setConfirm(null);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Avatar
              name={profile?.display_name ?? session.user?.email ?? 'You'}
              color={profile?.avatar_color ?? '#3B82F6'}
              size={40}
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Signed in as
              </p>
              <p className="font-semibold">
                {profile?.display_name ?? session.user?.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Sign out
          </button>
        </header>

        <div className="flex justify-end">
          <Link to="/">
            <Button>Plan a new convoy</Button>
          </Link>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-sm font-medium text-slate-700">Trip history</p>
          {trips === null && (
            <p className="text-sm text-slate-500">Loading…</p>
          )}
          {trips !== null && trips.length === 0 && (
            <p className="text-sm text-slate-500">
              No trips yet — your past convoys will show up here.
            </p>
          )}
          {trips && trips.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {trips.map((t) => {
                const isHosted = t.myRole === 'host';
                const isLive = t.status === 'lobby' || t.status === 'active';
                const busy = busyTripId === t.id;
                return (
                  <li key={t.id} className="flex items-center gap-2 py-3">
                    <Link
                      to={tripPath(t)}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 hover:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {t.destination_name}
                          </span>
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                              STATUS_CLASS[t.status] ?? 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {STATUS_LABEL[t.status] ?? t.status}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500">
                          <span>
                            {new Date(t.created_at).toLocaleDateString()} ·{' '}
                            {isHosted ? 'Hosted' : 'Joined'}
                          </span>
                          {t.route_data?.distance != null && (
                            <span>{formatDistance(t.route_data.distance)}</span>
                          )}
                          {t.myFinishRank != null && (
                            <span>Finished #{t.myFinishRank}</span>
                          )}
                        </div>
                      </div>
                      <FaArrowRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                    {isHosted && isLive && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'cancel', trip: t })}
                        disabled={busy}
                        title="Cancel trip"
                        aria-label="Cancel trip"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-amber-700 hover:bg-amber-50 disabled:cursor-wait disabled:opacity-50"
                      >
                        <FaXmark className="h-4 w-4" aria-hidden />
                      </button>
                    )}
                    {isHosted && (
                      <button
                        type="button"
                        onClick={() => setConfirm({ kind: 'delete', trip: t })}
                        disabled={busy}
                        title="Delete trip"
                        aria-label="Delete trip"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-600 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                      >
                        <FaTrash className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-lg font-semibold">
              {confirm.kind === 'cancel'
                ? `Cancel "${confirm.trip.destination_name}"?`
                : `Delete "${confirm.trip.destination_name}"?`}
            </h2>
            <p className="text-sm text-slate-600">
              {confirm.kind === 'cancel'
                ? 'This marks the trip as finished for everyone. Riders currently in the trip will be sent to the results screen.'
                : 'This permanently deletes the trip and all its participants, position logs, and reactions. This cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setConfirm(null)}
                className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() =>
                  confirm.kind === 'cancel'
                    ? handleCancelTrip(confirm.trip)
                    : handleDeleteTrip(confirm.trip)
                }
                disabled={busyTripId === confirm.trip.id}
                className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
                  confirm.kind === 'cancel'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {confirm.kind === 'cancel' ? 'Cancel trip' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
