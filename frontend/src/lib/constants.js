// Visual icons for transport modes are resolved per-component (e.g. via
// react-icons in TransportTabs) so that constants.js stays plain JS.
export const TRANSPORT_MODES = [
  { id: 'driving',      label: 'Car',     mapbox: 'driving-traffic' },
  { id: 'motorcycling', label: 'Motor',   mapbox: 'driving' },
  { id: 'cycling',      label: 'Bicycle', mapbox: 'cycling' },
  { id: 'running',      label: 'Run',     mapbox: 'walking' },
  { id: 'walking',      label: 'Walk',    mapbox: 'walking' },
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

// `description` is shown in the toast and serves as the accessible label.
// Components map id -> icon component (see ReactionBar / ReactionToasts).
export const REACTIONS = [
  { id: 'thumbsup', description: 'All good' },
  { id: 'wait',     description: 'Wait up' },
  { id: 'pullover', description: 'Pull over' },
  { id: 'horn',     description: 'Hey!' },
];

export const POSITION_UPDATE_INTERVAL_MS = 3000;
export const POSITION_LOG_INTERVAL_MS = 5000;
export const ARRIVAL_RADIUS_METERS = 100;
