import { create } from 'zustand';
import { DEFAULT_VIEWPORT } from '../lib/mapbox';

const STYLE_KEY = 'convoy.mapStyle';

function loadInitialMapStyle() {
  try {
    const v = localStorage.getItem(STYLE_KEY);
    return v === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export const useMapStore = create((set) => ({
  mapInstance: null,
  viewport: DEFAULT_VIEWPORT,
  mapStyle: loadInitialMapStyle(),
  setMapInstance: (mapInstance) => set({ mapInstance }),
  setViewport: (viewport) => set({ viewport }),
  setMapStyle: (mapStyle) => {
    try {
      localStorage.setItem(STYLE_KEY, mapStyle);
    } catch {
      // ignore quota / privacy-mode errors
    }
    set({ mapStyle });
  },
}));
