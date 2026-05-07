import { useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import { api } from '../lib/api';
import { MARKER_COLORS } from '../lib/constants';

function collectGuestParticipantIds() {
  const ids = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('convoy.identity.')) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key));
        if (val?.participantId) ids.push(val.participantId);
      } catch {
        // ignore corrupt entries
      }
    }
  } catch {
    // ignore localStorage access errors
  }
  return ids;
}

async function ensureProfile(session) {
  const userId = session.user.id;
  const setProfile = useUserStore.getState().setProfile;

  const { data: existing, error: lookupErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (lookupErr) {
    console.warn('[convoy] profile lookup failed', lookupErr);
    return;
  }
  if (existing) {
    setProfile(existing);
    return;
  }

  const meta = session.user.user_metadata ?? {};
  const fallbackName =
    meta.display_name ?? session.user.email?.split('@')[0] ?? 'User';
  const fallbackColor = meta.avatar_color ?? MARKER_COLORS[0];

  const { data: inserted, error: insertErr } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      display_name: fallbackName,
      avatar_color: fallbackColor,
    })
    .select()
    .maybeSingle();
  if (insertErr) {
    console.warn('[convoy] profile insert failed', insertErr);
    setProfile({
      id: userId,
      display_name: fallbackName,
      avatar_color: fallbackColor,
    });
    return;
  }
  setProfile(inserted);
}

async function claimGuestTripsIfAny() {
  const ids = collectGuestParticipantIds();
  if (ids.length === 0) return;
  try {
    await api.claimGuestTrips(ids);
  } catch (err) {
    // Non-fatal: dashboard will simply omit unclaimed past trips.
    console.warn('[convoy] claim guest trips failed', err);
  }
}

export function useAuthSync() {
  useEffect(() => {
    let mounted = true;
    const setSession = useUserStore.getState().setSession;
    const setProfile = useUserStore.getState().setProfile;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      if (data.session) {
        ensureProfile(data.session);
        claimGuestTripsIfAny();
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setSession(session ?? null);
      if (session) {
        ensureProfile(session);
        if (event === 'SIGNED_IN') claimGuestTripsIfAny();
      } else {
        setProfile(null);
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);
}
