import { useEffect, useRef, useState } from 'react';
import 'mapbox-gl/dist/mapbox-gl.css';
import { mapboxgl, MAP_STYLES, DEFAULT_VIEWPORT } from '../../lib/mapbox';
import { useMapStore } from '../../store/mapStore';
import { createParticipantMarker } from './ParticipantMarker';

const ROUTE_SOURCE_ID = 'convoy-route';
const ROUTE_LAYER_ID = 'convoy-route-line';
const FOLLOW_BOTTOM_PADDING = 220;
const MARKER_TWEEN_MS = 2800;

const ROUTE_FULL_PAINT = {
  'line-color': '#3B82F6',
  'line-width': 5,
  'line-opacity': 0.9,
};

const ROUTE_TRANSPARENT = 'rgba(59, 130, 246, 0)';
const ROUTE_SOLID = 'rgba(59, 130, 246, 0.95)';

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

function makeRaceFlagMarker() {
  const el = document.createElement('div');
  el.style.cssText = `
    width: 40px;
    height: 50px;
    pointer-events: none;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  `;
  el.innerHTML = `
    <svg viewBox="0 0 28 36" width="40" height="50" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6" y="2" width="2" height="32" fill="#1f2937"/>
      <g>
        <rect x="8" y="3" width="18" height="13" fill="white" stroke="#1f2937" stroke-width="0.6"/>
        <rect x="8"  y="3"   width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="17" y="3"   width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="12.5" y="6.25" width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="21.5" y="6.25" width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="8"  y="9.5" width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="17" y="9.5" width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="12.5" y="12.75" width="4.5" height="3.25" fill="#1f2937"/>
        <rect x="21.5" y="12.75" width="4.5" height="3.25" fill="#1f2937"/>
      </g>
    </svg>
  `;
  return el;
}

function shortestAngleDelta(from, to) {
  const d = (((to - from) % 360) + 540) % 360 - 180;
  return d;
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
  routeProgress = null,
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
  const styleVersionRef = useRef(0);
  const mapInstance = useMapStore((s) => s.mapInstance);
  const setMapInstance = useMapStore((s) => s.setMapInstance);
  const mapStyle = useMapStore((s) => s.mapStyle);
  const [followPaused, setFollowPaused] = useState(false);
  const [styleEpoch, setStyleEpoch] = useState(0);

  // Init map ONCE. Style is swapped via setStyle in a separate effect — the
  // earlier "destroy + recreate on every theme toggle" approach lost custom
  // sources/layers and caused the screen-blank-until-refresh bug.
  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_STYLES[useMapStore.getState().mapStyle] ?? MAP_STYLES.light,
      center: [DEFAULT_VIEWPORT.lng, DEFAULT_VIEWPORT.lat],
      zoom: DEFAULT_VIEWPORT.zoom,
    });
    map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false }),
      'bottom-right'
    );
    setMapInstance(map);
    return () => {
      if (userMarkerRef.current) {
        userMarkerRef.current.remove();
        userMarkerRef.current = null;
      }
      if (destMarkerRef.current) {
        destMarkerRef.current.remove();
        destMarkerRef.current = null;
      }
      for (const entry of participantMarkersRef.current.values()) {
        if (entry.animationId) cancelAnimationFrame(entry.animationId);
        entry.marker.remove();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setMapInstance]);

  // Theme swap. setStyle with default diff:true preserves user-added sources
  // and layers, but `style.load` still fires — bumping the epoch tells the
  // route/alts/trails effects to re-apply their data in case the diff missed
  // anything (line-gradient paint occasionally needs re-binding).
  useEffect(() => {
    if (!mapInstance) return undefined;
    const desired = MAP_STYLES[mapStyle] ?? MAP_STYLES.light;
    const currentName =
      mapInstance.getStyle()?.metadata?.['mapbox:origin'] ??
      mapInstance.getStyle()?.name;
    // Heuristic: if the active style's name already mentions the desired
    // theme keyword, skip (avoids redundant network fetch on first mount).
    const wantDark = mapStyle === 'dark';
    const isDark = (currentName ?? '').toLowerCase().includes('dark');
    if (wantDark === isDark) return undefined;

    const onStyleLoad = () => {
      styleVersionRef.current += 1;
      setStyleEpoch(styleVersionRef.current);
    };
    mapInstance.once('style.load', onStyleLoad);
    mapInstance.setStyle(desired);
    return () => {
      mapInstance.off('style.load', onStyleLoad);
    };
  }, [mapInstance, mapStyle]);

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
      destMarkerRef.current = new mapboxgl.Marker({
        element: makeRaceFlagMarker(),
        anchor: 'bottom',
      })
        .setLngLat(lngLat)
        .addTo(mapInstance);
    } else {
      destMarkerRef.current.setLngLat(lngLat);
    }
    if (!route) {
      mapInstance.flyTo({ center: lngLat, zoom: 13, essential: true });
    }
  }, [mapInstance, destination, route, styleEpoch]);

  // Route + alternates. lineMetrics:true on the primary so we can paint a
  // line-gradient that fades out the past portion (controlled via the
  // routeProgress prop).
  useEffect(() => {
    if (!mapInstance) return undefined;
    let cancelled = false;

    const apply = () => {
      if (cancelled) return;

      for (const { sourceId, layerId } of altLayersRef.current) {
        if (mapInstance.getLayer(layerId)) mapInstance.removeLayer(layerId);
        if (mapInstance.getSource(sourceId)) mapInstance.removeSource(sourceId);
      }
      altLayersRef.current = [];

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
        mapInstance.addSource(ROUTE_SOURCE_ID, {
          type: 'geojson',
          data,
          lineMetrics: true,
        });
        mapInstance.addLayer({
          id: ROUTE_LAYER_ID,
          type: 'line',
          source: ROUTE_SOURCE_ID,
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: ROUTE_FULL_PAINT,
        });
      }
      mapInstance.moveLayer(ROUTE_LAYER_ID);

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

    if (mapInstance.isStyleLoaded()) apply();
    else mapInstance.once('load', apply);

    return () => {
      cancelled = true;
    };
  }, [mapInstance, route, alternateRoutes, followParticipantId, styleEpoch]);

  // Past-route fade: rebind line-gradient or fall back to solid paint when
  // routeProgress is null (planning / replay where trimming makes no sense).
  useEffect(() => {
    if (!mapInstance) return;
    const apply = () => {
      if (!mapInstance.getLayer(ROUTE_LAYER_ID)) return;
      if (routeProgress == null || routeProgress <= 0) {
        // Restore solid paint.
        mapInstance.setPaintProperty(ROUTE_LAYER_ID, 'line-gradient', undefined);
        mapInstance.setPaintProperty(ROUTE_LAYER_ID, 'line-color', ROUTE_FULL_PAINT['line-color']);
        mapInstance.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', ROUTE_FULL_PAINT['line-opacity']);
        return;
      }
      const p = Math.min(0.999, Math.max(0.001, routeProgress));
      const fadeStart = Math.max(0, p - 0.02);
      mapInstance.setPaintProperty(ROUTE_LAYER_ID, 'line-opacity', 1);
      mapInstance.setPaintProperty(ROUTE_LAYER_ID, 'line-gradient', [
        'interpolate',
        ['linear'],
        ['line-progress'],
        0, ROUTE_TRANSPARENT,
        fadeStart, ROUTE_TRANSPARENT,
        p, ROUTE_SOLID,
        1, ROUTE_SOLID,
      ]);
    };
    if (mapInstance.isStyleLoaded()) apply();
    else mapInstance.once('load', apply);
  }, [mapInstance, routeProgress, route, styleEpoch]);

  // Replay trails (per-participant colored polylines).
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
  }, [mapInstance, participantTrails, styleEpoch]);

  // Participant markers — diff-based, with a smooth tween between position
  // updates so movement feels continuous instead of snapping every realtime
  // tick. Heading is interpolated via shortest-angle delta to avoid spinning
  // 350° instead of 10°.
  useEffect(() => {
    if (!mapInstance) return undefined;
    const seen = new Set();
    const bearing = mapInstance.getBearing();

    const animate = (entry, toLngLat, toRotation) => {
      if (entry.animationId) cancelAnimationFrame(entry.animationId);
      const fromLngLat = entry.currentLngLat ?? toLngLat;
      const fromRotation = entry.currentRotation ?? toRotation;
      const rotationDelta = shortestAngleDelta(fromRotation, toRotation);
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / MARKER_TWEEN_MS);
        const lng = fromLngLat[0] + (toLngLat[0] - fromLngLat[0]) * t;
        const lat = fromLngLat[1] + (toLngLat[1] - fromLngLat[1]) * t;
        const rot = fromRotation + rotationDelta * t;
        entry.marker.setLngLat([lng, lat]);
        entry.update({ rotation: rot });
        entry.currentLngLat = [lng, lat];
        entry.currentRotation = rot;
        if (t < 1) {
          entry.animationId = requestAnimationFrame(step);
        } else {
          entry.animationId = null;
        }
      };
      entry.animationId = requestAnimationFrame(step);
    };

    for (const p of participants) {
      const isMe = p.id === myParticipantId;
      if (p.is_ghost && !isMe) continue;
      if (p.lat == null || p.lng == null) continue;
      seen.add(p.id);

      const targetLngLat = [p.lng, p.lat];
      const targetRotation = (p.heading ?? 0) - bearing;

      const existing = participantMarkersRef.current.get(p.id);
      if (existing) {
        existing.update({
          isGhost: p.is_ghost,
          finished: Boolean(p.finished_at),
        });
        // Self-marker is updated frequently from local GPS — let it lead with
        // a fresh tween toward whatever just arrived. Other riders' updates
        // arrive at ~3s realtime cadence; same animation duration covers the
        // gap smoothly.
        animate(existing, targetLngLat, targetRotation);
      } else {
        const { element, update } = createParticipantMarker({
          color: p.color,
          displayName: p.display_name,
          isMe,
          isGhost: p.is_ghost,
          finished: Boolean(p.finished_at),
        });
        const marker = new mapboxgl.Marker({ element })
          .setLngLat(targetLngLat)
          .addTo(mapInstance);
        update({ rotation: targetRotation });
        participantMarkersRef.current.set(p.id, {
          marker,
          update,
          currentLngLat: targetLngLat,
          currentRotation: targetRotation,
          animationId: null,
        });
      }
    }

    for (const [id, entry] of participantMarkersRef.current) {
      if (!seen.has(id)) {
        if (entry.animationId) cancelAnimationFrame(entry.animationId);
        entry.marker.remove();
        participantMarkersRef.current.delete(id);
      }
    }

    const onMapRotate = () => {
      const b = mapInstance.getBearing();
      for (const [id, entry] of participantMarkersRef.current) {
        const part = participants.find((x) => x.id === id);
        if (!part) continue;
        const rot = (part.heading ?? 0) - b;
        entry.update({ rotation: rot });
        entry.currentRotation = rot;
      }
    };
    mapInstance.on('rotate', onMapRotate);

    return () => {
      mapInstance.off('rotate', onMapRotate);
    };
  }, [mapInstance, participants, myParticipantId, styleEpoch]);

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

  // Navigation viewport: when following, set bottom padding so the visual
  // center is shifted upward — your arrow sits in the lower third of the
  // screen with road ahead, just like Google Maps navigation.
  useEffect(() => {
    if (!mapInstance) return;
    if (followParticipantId && !followPaused) {
      mapInstance.setPadding({ top: 0, bottom: FOLLOW_BOTTOM_PADDING, left: 0, right: 0 });
    } else {
      mapInstance.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    }
  }, [mapInstance, followParticipantId, followPaused]);

  // Waze-style follow: pan/zoom to keep the focused participant in view (with
  // the bottom padding above doing the actual offset).
  useEffect(() => {
    if (!mapInstance || !followParticipantId || followPaused) return;
    const me = participants.find((p) => p.id === followParticipantId);
    if (!me || me.lat == null || me.lng == null) return;

    const last = lastFollowPosRef.current;
    if (last && last[0] === me.lng && last[1] === me.lat) return;
    lastFollowPosRef.current = [me.lng, me.lat];

    const lngLat = [me.lng, me.lat];
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
