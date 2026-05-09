import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN } from '../lib/mapbox';

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

function newSessionToken() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID — Search Box just needs
  // a unique-per-session string, the format isn't important.
  return `sess-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// Mapbox Search Box API v1 — designed for interactive POI / business / address
// search with autocomplete. Two-step flow: /suggest returns results with a
// `mapbox_id` (no coordinates), /retrieve resolves the chosen suggestion into
// full feature data including coordinates. Retrieve also "closes" the billing
// session, so we rotate the session token after each retrieve.
export function useGeocoder(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const sessionTokenRef = useRef(newSessionToken());

  useEffect(() => {
    const trimmed = (query ?? '').trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    const timer = setTimeout(async () => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setLoading(true);
      try {
        const params = new URLSearchParams({
          q: trimmed,
          access_token: MAPBOX_TOKEN,
          session_token: sessionTokenRef.current,
          language: 'en',
          limit: '6',
          types:
            'poi,address,place,locality,neighborhood,district,postcode,region,country,street',
        });
        const res = await fetch(
          `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`,
          { signal: ctrl.signal }
        );
        if (!res.ok) throw new Error(`Search error ${res.status}`);
        const data = await res.json();
        setResults(
          (data.suggestions ?? []).map((s) => ({
            id: s.mapbox_id,
            placeName: s.name ?? s.place_formatted ?? 'Unknown',
            address: s.full_address ?? s.place_formatted ?? '',
            featureType: s.feature_type,
          }))
        );
        setError(null);
      } catch (err) {
        if (err.name !== 'AbortError') setError(err);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Resolve a suggestion's mapbox_id to actual coordinates. Closes the billing
  // session by rotating the token, so the next /suggest starts fresh.
  const retrieve = async (id) => {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      session_token: sessionTokenRef.current,
    });
    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${id}?${params}`
    );
    if (!res.ok) throw new Error(`Retrieve error ${res.status}`);
    const data = await res.json();
    const feature = data.features?.[0];
    if (!feature) throw new Error('no_result');
    const [lng, lat] = feature.geometry.coordinates;
    sessionTokenRef.current = newSessionToken();
    const props = feature.properties ?? {};
    return {
      id,
      lat,
      lng,
      placeName:
        props.name_preferred ??
        props.name ??
        props.full_address ??
        'Unknown',
      address: props.full_address ?? props.place_formatted ?? '',
    };
  };

  return { results, loading, error, retrieve };
}
