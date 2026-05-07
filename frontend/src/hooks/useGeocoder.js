import { useEffect, useRef, useState } from 'react';
import { MAPBOX_TOKEN } from '../lib/mapbox';

const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 2;

export function useGeocoder(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

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
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(trimmed)}.json` +
          `?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`Geocoder error ${res.status}`);
        const data = await res.json();
        setResults(
          (data.features ?? []).map((f) => ({
            id: f.id,
            placeName: f.place_name,
            lng: f.center[0],
            lat: f.center[1],
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

  return { results, loading, error };
}
