import { useEffect, useRef, useState } from 'react';
import { fetchDirections } from '../lib/directions';

export function useDirections({
  from,
  to,
  mode = 'driving',
  avoidTolls = false,
  alternatives = false,
}) {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!from || !to) {
      setRoutes([]);
      setError(null);
      return undefined;
    }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);

    fetchDirections({ from, to, mode, avoidTolls, alternatives, signal: ctrl.signal })
      .then((rs) => {
        setRoutes(rs);
        setError(null);
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [from?.lat, from?.lng, to?.lat, to?.lng, mode, avoidTolls, alternatives]);

  return { routes, loading, error };
}
