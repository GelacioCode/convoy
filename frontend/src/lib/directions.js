import { MAPBOX_TOKEN } from './mapbox';
import { TRANSPORT_MODES } from './constants';

export async function fetchDirections({
  from,
  to,
  mode = 'driving',
  avoidTolls = false,
  alternatives = false,
  signal,
}) {
  const profile =
    TRANSPORT_MODES.find((m) => m.id === mode)?.mapbox ?? 'driving';

  const params = new URLSearchParams({
    access_token: MAPBOX_TOKEN,
    geometries: 'geojson',
    overview: 'full',
    alternatives: alternatives ? 'true' : 'false',
  });
  if (avoidTolls && profile.startsWith('driving')) {
    params.set('exclude', 'toll');
  }

  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${profile}/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?${params}`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Directions error ${res.status}`);
  const data = await res.json();
  return data.routes ?? [];
}
