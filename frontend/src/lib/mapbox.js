import mapboxgl from 'mapbox-gl';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

mapboxgl.accessToken = MAPBOX_TOKEN;

export { mapboxgl };

export const DEFAULT_VIEWPORT = {
  lng: -74.006,
  lat: 40.7128,
  zoom: 12,
};

export const MAP_STYLE = 'mapbox://styles/mapbox/streets-v12';
