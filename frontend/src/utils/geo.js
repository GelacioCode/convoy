const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;
const EARTH_RADIUS_M = 6_371_000;

export function calculateBearing(from, to) {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function distanceMeters(from, to) {
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function isWithinRadius(point, center, radiusMeters) {
  return distanceMeters(point, center) <= radiusMeters;
}

// Snap `point` to the nearest segment of a polyline (Mapbox geometry coords)
// and return the perpendicular distance in meters. Used for off-route detection.
// Uses an equirectangular projection scoped to each segment, which is accurate
// to within a few meters for any segment shorter than a few hundred km.
export function snappedDistanceToRoute(point, routeCoords) {
  if (!routeCoords || routeCoords.length < 2) return null;
  let min = Infinity;
  for (let i = 1; i < routeCoords.length; i++) {
    const a = { lng: routeCoords[i - 1][0], lat: routeCoords[i - 1][1] };
    const b = { lng: routeCoords[i][0], lat: routeCoords[i][1] };
    const d = distanceToSegmentMeters(point, a, b);
    if (d < min) min = d;
  }
  return Number.isFinite(min) ? min : null;
}

function distanceToSegmentMeters(p, a, b) {
  const meanLat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const xScale = Math.cos(meanLat) * 111_320; // meters per degree of longitude at this latitude
  const yScale = 110_540; // meters per degree of latitude (constant)

  const ax = a.lng * xScale;
  const ay = a.lat * yScale;
  const bx = b.lng * xScale;
  const by = b.lat * yScale;
  const px = p.lng * xScale;
  const py = p.lat * yScale;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}
