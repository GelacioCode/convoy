import { create } from 'zustand';
import { DEFAULT_VIEWPORT } from '../lib/mapbox';

export const useMapStore = create((set) => ({
  mapInstance: null,
  viewport: DEFAULT_VIEWPORT,
  setMapInstance: (mapInstance) => set({ mapInstance }),
  setViewport: (viewport) => set({ viewport }),
}));
