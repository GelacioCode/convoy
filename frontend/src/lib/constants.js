export const TRANSPORT_MODES = [
  { id: 'driving',      label: 'Car',     icon: '🚗',  mapbox: 'driving-traffic' },
  { id: 'motorcycling', label: 'Motor',   icon: '🏍️', mapbox: 'driving' },
  { id: 'cycling',      label: 'Bicycle', icon: '🚴',  mapbox: 'cycling' },
  { id: 'running',      label: 'Run',     icon: '🏃',  mapbox: 'walking' },
  { id: 'walking',      label: 'Walk',    icon: '🚶',  mapbox: 'walking' },
];

export const MARKER_COLORS = [
  '#3B82F6', // blue
  '#EF4444', // red
  '#10B981', // green
  '#F59E0B', // amber
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#F97316', // orange
  '#14B8A6', // teal
];

export const TRIP_STATUS = {
  LOBBY: 'lobby',
  ACTIVE: 'active',
  FINISHED: 'finished',
};

export const REACTIONS = [
  { id: 'thumbsup', label: '👍', description: 'All good' },
  { id: 'wait',     label: '✋', description: 'Wait up' },
  { id: 'pullover', label: '🛑', description: 'Pull over' },
  { id: 'horn',     label: '📣', description: 'Hey!' },
];

export const POSITION_UPDATE_INTERVAL_MS = 3000;
export const POSITION_LOG_INTERVAL_MS = 5000;
export const ARRIVAL_RADIUS_METERS = 50;
