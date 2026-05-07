import { create } from 'zustand';

const IDENTITY_KEY = (tripId) => `convoy.identity.${tripId}`;

export function loadIdentity(tripId) {
  if (!tripId) return null;
  try {
    const raw = localStorage.getItem(IDENTITY_KEY(tripId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveIdentity(tripId, identity) {
  if (!tripId) return;
  try {
    localStorage.setItem(IDENTITY_KEY(tripId), JSON.stringify(identity));
  } catch {
    // ignore quota errors
  }
}

export function clearIdentity(tripId) {
  if (!tripId) return;
  try {
    localStorage.removeItem(IDENTITY_KEY(tripId));
  } catch {
    // ignore
  }
}

export const useUserStore = create((set, get) => ({
  session: null,
  profile: null,
  guestName: null,
  guestColor: null,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setGuest: (guestName, guestColor) => set({ guestName, guestColor }),
  isGuest: () => !get().session,
}));
