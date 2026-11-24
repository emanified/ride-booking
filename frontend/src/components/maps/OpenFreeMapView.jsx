import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { OPENFREEMAP_STYLE_URL, OPENFREEMAP_DEFAULT_CENTER, OPENFREEMAP_DEFAULT_ZOOM } from '../../config/openFreeMapConfig'

const EMPTY_ROUTE = { type: 'FeatureCollection', features: [] }

function createMarkerElement({ label, background, fontSize }) {
  const el = document.createElement('div')
  el.style.width = '28px'
  el.style.height = '28px'
  el.style.borderRadius = '9999px'
  el.style.background = background
  el.style.border = '2px solid #ffffff'
  el.style.display = 'flex'
  el.style.alignItems = 'center'
  el.style.justifyContent = 'center'
  el.style.color = '#ffffff'
  el.style.fontWeight = '600'
  el.style.fontSize = fontSize || '12px'
  el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.4)'
  el.textContent = label
  return el
}

/**
 * OpenFreeMapView
 *
 * Reusable MapLibre map display used across booking, ride status, and active trip screens.
 * Renders pickup / dropoff / driver markers when coordinates are supplied, draws a route
 * line from `routeGeoJson` when present, and fits the map bounds to pickup/dropoff/driver
 * when their coordinates change. The map instance is created once and updated imperatively
 * (markers moved via setLngLat, route via source.setData) rather than remounted on prop changes.
 *
 * Props:
 * - center: { lat, lng } — optional initial center, defaults to Karachi
 * - zoom: number — optional initial zoom
 * - pickup: { lat, lng } | null
 * - dropoff: { lat, lng } | null
 * - driverLocation: { lat, lng } | null
 * - routeGeoJson: GeoJSON LineString geometry | null — drawn as a route line
 * - onMapClick: (latLng: { lat, lng }) => void — optional click handler
 * - fitToMarkers: boolean — fit bounds to pickup+dropoff (+driver) when they change (default true)
 * - height: number | string — map height, defaults to 400px
 * - className: string — extra classes for the outer wrapper
 * - bare: fills its positioned ancestor edge-to-edge (no rounded card chrome) — used as the
 *   immersive canvas backdrop on map pages
 */
export default function OpenFreeMapView({
  center,
  zoom = OPENFREEMAP_DEFAULT_ZOOM,
  pickup = null,
  dropoff = null,
  driverLocation = null,
  routeGeoJson = null,
  onMapClick,
  fitToMarkers = true,
  height = 400,
  className = '',
  bare = false,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({ pickup: null, dropoff: null, driver: null })
  const onMapClickRef = useRef(onMapClick)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [locating, setLocating] = useState(false)

  useEffect(() => {
    onMapClickRef.current = onMapClick
  }, [onMapClick])

  // Create the map once on mount; never recreate it on prop changes.
  useEffect(() => {
    const initialCenter = center || pickup || dropoff || OPENFREEMAP_DEFAULT_CENTER
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: [initialCenter.lng, initialCenter.lat],
      zoom,
      pitchWithRotate: false,
      dragRotate: false,
      attributionControl: true,
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: EMPTY_ROUTE })
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#eab308', 'line-width': 4, 'line-opacity': 0.85 },
      })
      setIsLoaded(true)
    })
    map.on('error', () => setLoadError(true))
    map.on('click', (e) => {
      if (onMapClickRef.current) onMapClickRef.current({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pickupLat = pickup?.lat
  const pickupLng = pickup?.lng
  const dropoffLat = dropoff?.lat
  const dropoffLng = dropoff?.lng
  const driverLat = driverLocation?.lat
  const driverLng = driverLocation?.lng

  // Keep pickup/dropoff/driver markers in sync without recreating them on every render.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current
    const markers = markersRef.current

    function syncMarker(key, lat, lng, opts) {
      if (lat == null || lng == null) {
        if (markers[key]) {
          markers[key].remove()
          markers[key] = null
        }
        return
      }
      if (markers[key]) {
        markers[key].setLngLat([lng, lat])
      } else {
        const el = createMarkerElement(opts)
        markers[key] = new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map)
      }
    }

    syncMarker('pickup', pickupLat, pickupLng, { label: 'P', background: '#eab308' })
    syncMarker('dropoff', dropoffLat, dropoffLng, { label: 'D', background: '#18181b' })
    syncMarker('driver', driverLat, driverLng, { label: '🚗', background: '#ffffff', fontSize: '14px' })
  }, [isLoaded, pickupLat, pickupLng, dropoffLat, dropoffLng, driverLat, driverLng])

  // Draw/update the route line whenever routeGeoJson changes.
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const source = mapRef.current.getSource('route')
    if (!source) return
    source.setData(
      routeGeoJson ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: routeGeoJson, properties: {} }] } : EMPTY_ROUTE,
    )
  }, [isLoaded, routeGeoJson])

  // Fit bounds to pickup/dropoff (+driver) only when their actual coordinates change.
  useEffect(() => {
    if (!isLoaded || !mapRef.current || !fitToMarkers) return
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) return
    const bounds = new maplibregl.LngLatBounds()
    bounds.extend([pickupLng, pickupLat])
    bounds.extend([dropoffLng, dropoffLat])
    if (driverLat != null && driverLng != null) bounds.extend([driverLng, driverLat])
    mapRef.current.fitBounds(bounds, { padding: 64, maxZoom: 16 })
  }, [isLoaded, fitToMarkers, pickupLat, pickupLng, dropoffLat, dropoffLng, driverLat, driverLng])

  const handleLocateMe = () => {
    if (!navigator.geolocation || locating) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false)
        mapRef.current?.flyTo({
          center: [position.coords.longitude, position.coords.latitude],
          zoom: 15,
        })
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const wrapperStyle = bare ? undefined : { height: typeof height === 'number' ? `${height}px` : height }
  // `relative` only when not bare — combining it with bare's `absolute inset-0` on the
  // same element would let Tailwind's cascade order resolve `position` to `relative`
  // (a same-specificity utility collision), collapsing this wrapper's height to 0 since
  // it would no longer fill its absolutely-positioned parent.
  const chrome = bare ? 'absolute inset-0' : 'rounded-xl overflow-hidden border border-white/60 relative'

  return (
    <div style={wrapperStyle} className={`${chrome} ${className}`}>
      {/* Inline position/inset (not Tailwind's `absolute inset-0` classes) because
          MapLibre adds its own `.maplibregl-map { position: relative }` rule to this
          exact element once the map is created, which would otherwise win the cascade
          over a class-based `position: absolute` and collapse this div's height to 0. */}
      <div ref={containerRef} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />

      {loadError && (
        <div className="absolute inset-0 alert-error flex flex-col items-center justify-center text-center px-4">
          <span className="text-2xl mb-2">⚠</span>
          <p className="font-medium text-sm">Map service unavailable</p>
          <p className="text-xs mt-1">Please check your connection and try again.</p>
        </div>
      )}

      {!isLoaded && !loadError && (
        <div
          className={`${bare ? 'absolute inset-0' : 'absolute inset-0 rounded-xl border border-white/60'} bg-zinc-200/50 flex flex-col items-center justify-center text-zinc-500 pointer-events-none`}
        >
          <span className="text-2xl mb-2 animate-pulse">📍</span>
          <p className="font-medium text-zinc-600 text-sm">Loading map...</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleLocateMe}
        disabled={locating}
        title="Find my location"
        aria-label="Find my location"
        className="absolute top-1/2 left-3 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white shadow-lg border border-zinc-200 flex items-center justify-center text-zinc-700 hover:bg-yellow-50 hover:text-yellow-600 transition-colors disabled:opacity-50"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`w-5 h-5 ${locating ? 'animate-pulse' : ''}`}
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1 1 18 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </button>
    </div>
  )
}

export { OPENFREEMAP_DEFAULT_CENTER as DEFAULT_CENTER, OPENFREEMAP_DEFAULT_ZOOM as DEFAULT_ZOOM }
