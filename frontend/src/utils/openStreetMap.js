// OpenStreetMap-based replacements for Google Places / Geocoder / Directions.
// Nominatim handles search + reverse geocoding, OSRM handles routing.
// Both are public demo endpoints — fine for a demo app, not for production traffic.

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org'
const OSRM_BASE = 'https://router.project-osrm.org'

/**
 * Maps a raw Nominatim result to the shape the rest of the app expects:
 * { address, lat, lng, name, placeId }
 */
export function normalizeOsmPlace(place) {
  return {
    address: place.display_name || '',
    lat: Number(place.lat),
    lng: Number(place.lon),
    name: (place.display_name || '').split(',')[0] || place.display_name || '',
    placeId: `osm-${place.place_id}`,
  }
}

/**
 * Searches for locations matching `query` via Nominatim. Returns an array of
 * normalized places ({ address, lat, lng, name, placeId }), or [] on any
 * failure (no results, network error, bad response) — callers never need to
 * handle a rejected promise.
 */
export async function searchLocations(query) {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  try {
    const url = `${NOMINATIM_BASE}/search?format=json&q=${encodeURIComponent(trimmed)}&limit=5&addressdetails=1&countrycodes=pk`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return []
    const data = await res.json()
    if (!Array.isArray(data)) return []
    return data.map(normalizeOsmPlace)
  } catch {
    return []
  }
}

/**
 * Reverse geocodes { lat, lng } via Nominatim. Returns the display_name on
 * success, or null on failure so callers can fall back to a coordinate string.
 */
export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?format=json&lat=${lat}&lon=${lng}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const data = await res.json()
    return data?.display_name || null
  } catch {
    return null
  }
}

/**
 * Requests a driving route between pickup and dropoff via OSRM. Returns
 * { distanceKm, durationMin, routeGeoJson, pricingSource: 'osrm' } on
 * success, or null on failure (no route, network error) so callers can fall
 * back to the haversine estimate.
 */
export async function getRoute(pickup, dropoff) {
  if (!pickup || !dropoff) return null
  try {
    const url = `${OSRM_BASE}/route/v1/driving/${pickup.lng},${pickup.lat};${dropoff.lng},${dropoff.lat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const route = data?.routes?.[0]
    if (!route || !route.geometry) return null
    return {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
      routeGeoJson: route.geometry,
      pricingSource: 'osrm',
    }
  } catch {
    return null
  }
}
