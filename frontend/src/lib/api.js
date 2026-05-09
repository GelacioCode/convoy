import { useUserStore } from '../store/userStore';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request(path, { method = 'GET', body } = {}) {
  const session = useUserStore.getState().session;
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message ?? data?.error ?? `HTTP ${res.status}`);
    err.status = res.status;
    err.code = data?.error;
    err.details = data?.details;
    throw err;
  }
  return data;
}

export const api = {
  createTrip: (payload) => request('/api/trips', { method: 'POST', body: payload }),
  getTrip: (shareToken) => request(`/api/trips/${shareToken}`),
  listParticipants: (tripId) => request(`/api/trips/${tripId}/participants`),
  joinTrip: (tripId, payload) =>
    request(`/api/trips/${tripId}/join`, { method: 'POST', body: payload }),
  setStatus: (tripId, status) =>
    request(`/api/trips/${tripId}/status`, { method: 'PATCH', body: { status } }),
  deleteTrip: (tripId) =>
    request(`/api/trips/${tripId}`, { method: 'DELETE' }),
  finishParticipant: (participantId) =>
    request(`/api/participants/${participantId}/finish`, { method: 'PATCH' }),
  getResults: (tripId) => request(`/api/trips/${tripId}/results`),
  getReplay: (tripId) => request(`/api/trips/${tripId}/replay`),
  getMyTrips: () => request('/api/me/trips'),
  claimGuestTrips: (participantIds) =>
    request('/api/me/claim-trips', {
      method: 'POST',
      body: { participantIds },
    }),
};
