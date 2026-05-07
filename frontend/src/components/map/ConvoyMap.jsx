import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxgl, MAP_STYLES, DEFAULT_VIEWPORT } from '../../lib/mapbox';
import { useMapStore } from '../../store/mapStore';
import { createParticipantMarker } from './ParticipantMarker';

const ROUTE_SOURCE_ID = 'convoy-route';
const ROUTE_LAYER_ID = 'convoy-route-line';

function makeUserDot() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #3B82F6;
    border: 3px solid white;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35), 0 0 8px rgba(59, 130, 246, 0.6);
  `;
  return el;
}

export default function ConvoyMap({
  userPosition,
  destination,
  route,
  alternateRoutes = [],
  participants = [],
  participantTrails = [],
  myParticipantId,
  followParticipantId,
}) {
  const containerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const hasFitUserRef = useRef(false);
  const hasFollowFitRef = useRef(false);
  const lastFollowPosRef = useRef(null);
  const participantMarkersRef = useRef(new Map());
  const altLayersRef = useRef([]);
  const trailLayersRef = useRef(new Map());
  const mapInstance = useMapStore((s) => s.mapInstance);
  const setMapInstance = useMapStore((s) => s.setMapInstance);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const [followPaused, setFollowPaused] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const styleUrl = MAP_STYLES[mapStyle] ?? MAP_STYLES.light;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: styleUrl,
      center: [DEFAULT_VIEWPORT.lng, DEFAULT_VIEWPORT.lat],
      zoom: DEFAULT_VIEWPORT.zoom,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );
    setMapInstance(map);
    return () => {
      // Markers and layer state are tied to this specific map instance — clear
      // every ref so the next map (e.g. after a style swap) starts fresh.
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      for (const { marker } of participantMarkersRef.current.values()) {
        marker.remove();
      }
      participantMarkersRef.current.clear();
      altLayersRef.current = [];
      trailLayersRef.current.clear();
      hasFitUserRef.current = false;
      hasFollowFitRef.current = false;
      lastFollowPosRef.current = null;
      map.remove();
      setMapInstance(null);
    };
  }, [mapStyle, setMapInstance]);

  useEffect(() => {
    if (!mapInstance || !userPosition) return;
    const lngLat = [userPosition.lng, userPosition.lat];
    if (!userMarkerRef.current) {
      userMarkerRef.current = new mapboxgl.Marker(makeUserDot())
        .setLngLat(lngLat)
        .addTo(mapInstance);
    } else {
      userMarkerRef.current.setLngLat(lngLat);
    }
    if (!hasFitUserRef.current) {
      mapInstance.flyTo({ center: lngLat, zoom: 14, essential: true });
      hasFitUserRef.current = true;
    }
  }, [mapInstance, userPosition]);

  useEffect(() => {
    if (!mapInstance) return;
    if (!destination) {
      destMarkerRef.current?.remove();
      destMarkerRef.current = null;
      return;
    }
    const lngLat = [destination.lng, destination.lat];
    if (!destMarkerRef.current) {
      destMarkerRef.current = new mapboxgl.Marker({ color: '#EF4444' })
        .setLngLat(lngLat)
        .addTo(mapInstance);
    } else {
      destMarkerRef.current.setLngLat(lngLat);
    }
    if (!route) {
      mapInstance.flyTo({ center: lngLat, zoom: 13, essential: true });
    }
  }, [mapInstance, destination, route]);

  useEffect(() => {
    if (!mapInstance) return undefined;
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;

      // Clear any existing alternate-route layers/sources before re-adding.
      for (const { sourceId, layerId } of altLayersRef.current) {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      }
      altLayersRef.current = [];

      // Add fresh alternate routes (rendered before primary so primary layers
      // on top after we move it).
      alternateRoutes.forEach((alt, i) => {
        if (!alt?.geometry?.coordinates?.length) return;
        const sourceId = `convoy-alt-${i}`;
        const layerId = `convoy-alt-line-${i}`;
        mapInstance.addSource(sourceId, {
          type: 'geojson',
          data: { type: 'Feature', geometry: alt.geometry, properties: {} },
        });
        mapInstance.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#94a3b8',
            'line-width': 4,
            'line-opacity': 0.55,
          },
        });
        altLayersRef.current.push({ sourceId, layerId });
      });

      if (!route) {
        if (mapInstance.getLayer(ROUTE_LAYER_ID)) mapInstance.removeLayer(ROUTE_LAYER_ID);
        if (mapInstance.getSource(ROUTE_SOURCE_ID)) mapInstance.removeSource(ROUTE_SOURCE_ID);
        return;
      }

      const data = { type: 'Feature', geometry: route.geometry, properties: {} };

      if (mapInstance.getSource(ROUTE_SOURCE_ID)) {
        mapInstance.getSource(ROUTE_SOURCE_ID).setData(data);
      } else {
        mapInstance.addSource(ROUTE_SOURCE_ID, { type: 'geojson', data });
        mapInstance.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': '#3B82F6', 'line-width': 5, 'line-opacity': 0.9 },
        });
      }
      // Ensure primary route renders on top of alternates.
      mapInstance.moveLayer(ROUTE_LAYER_ID);

      // Fit to all visible routes (primary + alternates) so the user can see
      // every option at a glance.
      const allCoords = [...route.geometry.coordinates];
      for (const alt of alternateRoutes) {
        if (alt?.geometry?.coordinates) allCoords.push(...alt.geometry.coordinates);
      }
      if (allCoords.length && !followParticipantId) {
        const bounds = allCoords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(allCoords[0], allCoords[0])
        );
        mapInstance.fitBounds(bounds, { padding: 80, duration: 800 });
      }
    };

    if (mapInstance.isStyleLoaded()) {
      apply();
    } else {
      mapInstance.once('load', apply);
    }

    return () => {
      cancelled = true;
    };
  }, [mapInstance, route, alternateRoutes, followParticipantId]);

  // Replay trails: one polyline per participant in their color, showing their
  // recorded path. Diff-based — sources are reused with setData when a trail's
  // coordinates change, so this is cheap to call repeatedly.
  useEffect(() => {
    if (!mapInstance) return undefined;
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;
      const seen = new Set();

      for (const trail of participantTrails) {
        if (!trail?.coordinates || trail.coordinates.length < 2) continue;
        seen.add(trail.id);
        const sourceId = `convoy-trail-${trail.id}`;
        const layerId = `convoy-trail-line-${trail.id}`;
        const data = {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trail.coordinates },
          properties: {},
        };

        const existing = mapInstance.getSource(sourceId);
        if (existing) {
          existing.setData(data);
        } else {
          mapInstance.addSource(sourceId, { type: 'geojson', data });
          mapInstance.addLayer({
            id: layerId,
            type: 'line',
            source: sourceId,
            layout: { 'line-cap': 'round', 'line-join': 'round' },
            paint: {
              'line-color': trail.color ?? '#3B82F6',
              'line-width': 3.5,
              'line-opacity': 0.85,
            },
          });
          trailLayersRef.current.set(trail.id, { sourceId, layerId });
        }
      }

      // Drop trails for participants no longer in the list.
      for (const [id, { sourceId, layerId }] of trailLayersRef.current) {
        if (!seen.has(id)) {
          if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
          if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
          trailLayersRef.current.delete(id);
        }
      }
    };

    if (mapInstance.isStyleLoaded()) apply();
    else mapInstance.once('load', apply);

    return () => {
      cancelled = true;
    };
  }, [mapInstance, participantTrails]);

  useEffect(() => {
    if (!mapInstance) return undefined;
    const seen = new Set();
    const bearing = mapInstance.getBearing();

    for (const p of participants) {
      const isMe = p.id === myParticipantId;
      if (p.is_ghost && !isMe) continue;
      if (p.lat == null || p.lng == null) continue;
      seen.add(p.id);

      const existing = participantMarkersRef.current.get(p.id);
      const lngLat = [p.lng, p.lat];
      const rotation = (p.heading ?? 0) - bearing;

      if (existing) {
        existing.marker.setLngLat(lngLat);
        existing.update({
          rotation,
          isGhost: p.is_ghost,
          finished: Boolean(p.finished_at),
        });
      } else {
        const { element, update } = createParticipantMarker({
          color: p.color,
          displayName: p.display_name,
          isMe,
          isGhost: p.is_ghost,
          finished: Boolean(p.finished_at),
        });
        const marker = new mapboxgl.Marker({ element })
          .setLngLat(lngLat)
          .addTo(mapInstance);
        update({ rotation });
        participantMarkersRef.current.set(p.id, { marker, update });
      }
    }

    for (const [id, { marker }] of participantMarkersRef.current) {
      if (!seen.has(id)) {
        marker.remove();
        participantMarkersRef.current.delete(id);
      }
    }

    // Re-rotate all arrows when the map's bearing changes so each arrow keeps
    // pointing in the participant's true heading regardless of map rotation.
    const onMapRotate = () => {
      const b = mapInstance.getBearing();
      for (const [id, { update }] of participantMarkersRef.current) {
        const part = participants.find((x) => x.id === id);
        if (!part) continue;
        update({ rotation: (part.heading ?? 0) - b });
      }
    };
    mapInstance.on('rotate', onMapRotate);

    return () => {
      mapInstance.off('rotate', onMapRotate);
    };
  }, [mapInstance, participants, myParticipantId]);

  // Pause follow when the user manually pans/zooms/rotates. originalEvent is
  // only set on user-initiated interactions, not programmatic flyTo/easeTo.
  useEffect(() => {
    if (!mapInstance || !followParticipantId) return undefined;
    const onUserMove = (e) => {
      if (e.originalEvent) setFollowPaused(true);
    };
    mapInstance.on('dragstart', onUserMove);
    mapInstance.on('zoomstart', onUserMove);
    mapInstance.on('rotatestart', onUserMove);
    return () => {
      mapInstance.off('dragstart', onUserMove);
      mapInstance.off('zoomstart', onUserMove);
      mapInstance.off('rotatestart', onUserMove);
    };
  }, [mapInstance, followParticipantId]);

  // Waze-style follow: pan/zoom to keep the focused participant centered.
  useEffect(() => {
    if (!mapInstance || !followParticipantId || followPaused) return;
    const me = participants.find((p) => p.id === followParticipantId);
    if (!me || me.lat == null || me.lng == null) return;

    const last = lastFollowPosRef.current;
    if (last && last[0] === me.lng && last[1] === me.lat) return;
    lastFollowPosRef.current = [me.lng, me.lat];

    const lngLat = [me.lng, me.lat];
    // Heading-up navigation: rotate map so participant's heading is screen-up,
    // matching Google Maps / Waze. If heading is null (stationary, common on
    // desktop testing), keep the existing bearing so the map doesn't snap back.
    const bearingOpt = me.heading != null ? { bearing: me.heading } : {};
    if (!hasFollowFitRef.current) {
      mapInstance.flyTo({
        center: lngLat,
        zoom: 17,
        essential: true,
        duration: 1200,
        ...bearingOpt,
      });
      hasFollowFitRef.current = true;
    } else {
      mapInstance.easeTo({ center: lngLat, duration: 600, ...bearingOpt });
    }
  }, [mapInstance, participants, followParticipantId, followPaused]);

  useEffect(
    () => () => {
      for (const { marker } of participantMarkersRef.current.values()) {
        marker.remove();
      }
      participantMarkersRef.current.clear();
    },
    []
  );

  const recenter = () => {
    setFollowPaused(false);
    hasFollowFitRef.current = false;
    lastFollowPosRef.current = null;
  };

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {followParticipantId && followPaused && (
        <button
          type="button"
          onClick={recenter}
          aria-label="Recenter on my location"
          className="absolute bottom-20 left-4 z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-xl ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-95"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="3" fill="#3B82F6" stroke="none" />
            <circle cx="12" cy="12" r="8" />
            <line x1="12" y1="1.5" x2="12" y2="4" />
            <line x1="12" y1="20" x2="12" y2="22.5" />
            <line x1="1.5" y1="12" x2="4" y2="12" />
            <line x1="20" y1="12" x2="22.5" y2="12" />
          </svg>
        </button>
      )}
    </div>
  );
}
