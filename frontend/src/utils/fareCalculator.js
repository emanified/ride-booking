// Frontend fare calculator and helpers (Phase 2)
export const VEHICLE_TYPES = [
  { value: 'bike', label: 'Bike', baseFare: 50, perKmRate: 35, perMinuteRate: 2 },
  { value: 'mini', label: 'Mini', baseFare: 100, perKmRate: 60, perMinuteRate: 3 },
  { value: 'ac_car', label: 'AC Car', baseFare: 150, perKmRate: 85, perMinuteRate: 4 },
  { value: 'premium', label: 'Premium', baseFare: 250, perKmRate: 120, perMinuteRate: 6 },
]

export const DEFAULT_VEHICLE_TYPE = 'mini'

export function getVehicleConfig(value) {
  return VEHICLE_TYPES.find((v) => v.value === value) || VEHICLE_TYPES.find((v) => v.value === DEFAULT_VEHICLE_TYPE)
}

export function calculateFare(distanceKm, durationMin, vehicleType = DEFAULT_VEHICLE_TYPE) {
  const cfg = getVehicleConfig(vehicleType)
  if (!cfg) return null
  const fare = cfg.baseFare + distanceKm * cfg.perKmRate + durationMin * cfg.perMinuteRate
  return Math.round(fare)
}

export function formatCurrency(amount) {
  if (amount == null) return '—'
  return `Rs. ${amount}`
}

export function formatDistance(distanceKm) {
  if (distanceKm == null) return '—'
  return `${distanceKm.toFixed(2)} km`
}

export function formatDuration(durationMin) {
  if (durationMin == null) return '—'
  return `${Math.round(durationMin)} min`
}

// Haversine fallback used when route calculation fails.
export function estimateFallback(a, b) {
  const toRad = (v) => (v * Math.PI) / 180
  const R = 6371 // km
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const hav = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const distanceKm = R * 2 * Math.asin(Math.sqrt(hav))
  // approximate duration assuming avg speed 40 km/h
  const durationMin = distanceKm / 40 * 60
  return { distanceKm, durationMin, approximate: true }
}
