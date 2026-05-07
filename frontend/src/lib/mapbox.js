import mapboxgl from 'mapbox-gl';

export const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

mapboxgl.accessToken = MAPBOX_TOKEN;

export { mapboxgl };

export const DEFAULT_VIEWPORT = {
  lng: -74.006,
  lat: 40.7128,
  zoom: 12,
};

export const MAP_STYLES = {
  light: 'mapbox://styles/mapbox/streets-v12',
  dark: 'mapbox://styles/mapbox/dark-v11',
};

export const MAP_STYLE = MAP_STYLES.light;
