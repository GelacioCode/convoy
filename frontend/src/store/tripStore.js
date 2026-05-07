import { create } from 'zustand';

const TOAST_DURATION_MS = 3500;

export const useTripStore = create((set, get) => ({
  trip: null,
  participants: [],
  myParticipantId: null,
  route: null,
  personalReroute: null,
  toasts: [],
  setTrip: (trip) => set({ trip }),
  setRoute: (route) => set({ route }),
  setPersonalReroute: (route) => set({ personalReroute: route }),
  setMyParticipantId: (id) => set({ myParticipantId: id }),
  setParticipants: (participants) => set({ participants }),
  pushToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    set((state) => ({ toasts: [...state.toasts, { id, ...toast }] }));
    setTimeout(() => get().removeToast(id), TOAST_DURATION_MS);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  updateParticipantPosition: (participantId, position) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, ...position } : p
      ),
    })),
  upsertParticipant: (incoming) =>
    set((state) => {
      const idx = state.participants.findIndex((p) => p.id === incoming.id);
      if (idx === -1) {
        return { participants: [...state.participants, incoming] };
      }
      const next = [...state.participants];
      next[idx] = { ...next[idx], ...incoming };
      return { participants: next };
    }),
  reset: () =>
    set({
      trip: null,
      participants: [],
      myParticipantId: null,
      route: null,
      personalReroute: null,
      toasts: [],
    }),
}));
