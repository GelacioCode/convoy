import { useEffect, useState } from 'react';

export function useGeoLocation({ enabled = true } = {}) {
  const [position, setPosition] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        setPosition({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy: p.coords.accuracy,
          heading: p.coords.heading,
          speed: p.coords.speed,
          timestamp: p.timestamp,
        });
        setError(null);
      },
      (err) => setError(err),
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 15_000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return { position, error };
}
