import { OPENFREEMAP_DEFAULT_CENTER } from '../config/openFreeMapConfig'

/**
 * Wraps navigator.geolocation.getCurrentPosition with our own timeout race.
 * Some embedded/sandboxed browser contexts never invoke either callback when
 * the permission prompt can't be rendered — the native `timeout` option only
 * bounds position acquisition, not permission negotiation, so it doesn't help
 * there. This always resolves (never rejects), falling back to a default
 * location so callers never hang indefinitely.
 */
// GeolocationPositionError codes, per spec: 1 = PERMISSION_DENIED,
// 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
const ERROR_CODE_REASON = {
  1: 'permission_denied',
  2: 'position_unavailable',
  3: 'timeout',
}

export const GEOLOCATION_REASON_MESSAGE = {
  permission_denied: 'Location permission was denied for this site.',
  position_unavailable: "Your browser/OS could not determine a position (location services may be off).",
  timeout: 'The browser gave up trying to get a position in time.',
  no_response: "The browser never responded to the location request (often a blocked permission prompt).",
  unsupported: 'This browser does not support geolocation.',
}

// Shown only for an explicit permission denial — the one case where retrying
// without the user taking action first is pointless.
export const LOCATION_PERMISSION_INSTRUCTIONS =
  'Location access is blocked for this site. Click the lock/info icon next to the address bar, set "Location" to "Allow", then try again.'

export function getCurrentLocationOrFallback(timeoutMs = 8000, fallback = OPENFREEMAP_DEFAULT_CENTER) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ ...fallback, usedFallback: true, reason: 'unsupported' })
      return
    }

    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      resolve({ ...fallback, usedFallback: true, reason: 'no_response' })
    }, timeoutMs)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude, usedFallback: false })
      },
      (geoError) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve({ ...fallback, usedFallback: true, reason: ERROR_CODE_REASON[geoError?.code] || 'position_unavailable' })
      },
      { enableHighAccuracy: true, timeout: timeoutMs },
    )
  })
}
