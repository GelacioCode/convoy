export function estimateETA(distanceMeters, speedKmh, modeAvgSpeedKmh) {
  const effectiveKmh = speedKmh && speedKmh > 1 ? speedKmh : modeAvgSpeedKmh;
  if (!effectiveKmh) return null;
  const hours = distanceMeters / 1000 / effectiveKmh;
  return hours * 3600 * 1000;
}
