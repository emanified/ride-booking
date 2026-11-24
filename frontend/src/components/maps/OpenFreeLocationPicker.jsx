import OpenFreeMapView from './OpenFreeMapView'

/**
 * OpenFreeLocationPicker
 *
 * Wraps OpenFreeMapView to let a passenger pick pickup/dropoff coordinates by
 * clicking the map. The parent (BookRide) owns the pickup/dropoff state, the
 * active "mode" (which point is currently being selected), and the route
 * (fetched from OSRM) that's drawn on the map.
 *
 * Props:
 * - mode: 'pickup' | 'dropoff' — which marker the next map click should set
 * - pickup: { lat, lng } | null
 * - dropoff: { lat, lng } | null
 * - onSelect: (mode, latLng) => void — called with the active mode and clicked coordinates
 * - routeGeoJson: GeoJSON LineString geometry | null — forwarded to OpenFreeMapView
 * - height: number | string
 */
export default function OpenFreeLocationPicker({ mode, pickup, dropoff, onSelect, routeGeoJson, height = 400, bare = false }) {
  const handleMapClick = (latLng) => {
    onSelect(mode, latLng)
  }

  const modeLabel = mode === 'pickup' ? 'pickup' : 'dropoff'
  const banner = (
    <>
      <span className="font-semibold text-zinc-900">Click on the map</span> to set the {modeLabel} location.
    </>
  )

  if (bare) {
    return (
      <>
        <OpenFreeMapView
          pickup={pickup}
          dropoff={dropoff}
          onMapClick={handleMapClick}
          routeGeoJson={routeGeoJson}
          bare
        />
        <div className="absolute top-6 left-6 z-10 max-w-[min(100%,420px)] bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 text-sm text-zinc-700 shadow-lg">
          {banner}
        </div>
      </>
    )
  }

  return (
    <div className="space-y-2">
      <div className="glass-panel px-4 py-2 text-sm text-zinc-700">{banner}</div>
      <OpenFreeMapView
        pickup={pickup}
        dropoff={dropoff}
        onMapClick={handleMapClick}
        routeGeoJson={routeGeoJson}
        height={height}
      />
    </div>
  )
}