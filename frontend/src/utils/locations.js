const PRESET_COORDS = {
  'downtown station': { lat: 40.7128, lng: -74.006 },
  'central station': { lat: 40.7527, lng: -73.9772 },
  'international airport': { lat: 40.6413, lng: -73.7781 },
  'airport terminal 2': { lat: 40.6413, lng: -73.7781 },
  'westside mall': { lat: 40.758, lng: -73.9855 },
  '5th avenue': { lat: 40.7749, lng: -73.9654 },
  '5th avenue & oak': { lat: 40.7614, lng: -73.9776 },
  'hotel district': { lat: 40.7505, lng: -73.9934 },
}

const DEFAULT_PICKUP = { lat: 40.7128, lng: -74.006 }
const DEFAULT_DROPOFF = { lat: 40.6413, lng: -73.7781 }

function parseLatLng(text) {
  const parts = text.split(',').map((s) => s.trim())
  if (parts.length !== 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng }
  return null
}

export function resolveCoordinates(label, fallback) {
  const parsed = parseLatLng(label)
  if (parsed) return parsed

  const preset = PRESET_COORDS[label.trim().toLowerCase()]
  if (preset) return preset

  return fallback
}

export function buildRideCoordinates(pickupLabel, dropoffLabel) {
  const pickup = resolveCoordinates(pickupLabel, DEFAULT_PICKUP)
  const dropoff = resolveCoordinates(dropoffLabel, DEFAULT_DROPOFF)
  return {
    pickup_location: pickupLabel,
    dropoff_location: dropoffLabel,
    pickup_lat: pickup.lat,
    pickup_lng: pickup.lng,
    dropoff_lat: dropoff.lat,
    dropoff_lng: dropoff.lng,
  }
}

/**
 * Safely reads a display address from either the old string format
 * (trip.pickup_location = "Some Address") or the new Phase 2 object format
 * (trip.pickup = { address, lat, lng, placeId }). Returns a fallback string
 * if neither is present, so list/table views never render "undefined".
 */
export function getLocationAddress(location, fallback = '—') {
  if (!location) return fallback
  if (typeof location === 'string') return location || fallback
  if (typeof location === 'object') return location.address || fallback
  return fallback
}