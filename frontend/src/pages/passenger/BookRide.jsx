import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { bookRide } from '../../api'
import AsymmetricWorkspace, { GlassHud, InspectorModule } from '../../components/shell/AsymmetricWorkspace'
import OpenFreeMapView from '../../components/maps/OpenFreeMapView'
import LocationSearchInput from '../../components/maps/LocationSearchInput'
import { getRoute, reverseGeocode as reverseGeocodeOsm } from '../../utils/openStreetMap'
import {
  VEHICLE_TYPES,
  DEFAULT_VEHICLE_TYPE,
  calculateFare,
  formatCurrency,
  formatDistance,
  formatDuration,
  estimateFallback,
} from '../../utils/fareCalculator'

async function reverseGeocode(latLng) {
  const address = await reverseGeocodeOsm(latLng.lat, latLng.lng)
  return address || `Selected Location (${latLng.lat.toFixed(5)}, ${latLng.lng.toFixed(5)})`
}

export default function BookRide() {
  const [pickupText, setPickupText] = useState('')
  const [dropoffText, setDropoffText] = useState('')
  const [pickupPlace, setPickupPlace] = useState(null)
  const [dropoffPlace, setDropoffPlace] = useState(null)
  const [pickerMode, setPickerMode] = useState('pickup')
  const [showMap, setShowMap] = useState(false)
  const [vehicleType, setVehicleType] = useState(DEFAULT_VEHICLE_TYPE)
  const [route, setRoute] = useState(null)
  const [routeGeoJson, setRouteGeoJson] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const pickupCoords = useMemo(
    () => (pickupPlace ? { lat: pickupPlace.lat, lng: pickupPlace.lng } : null),
    [pickupPlace?.lat, pickupPlace?.lng],
  )
  const dropoffCoords = useMemo(
    () => (dropoffPlace ? { lat: dropoffPlace.lat, lng: dropoffPlace.lng } : null),
    [dropoffPlace?.lat, dropoffPlace?.lng],
  )

  const handlePickupPlaceSelect = (place) => {
    setPickupPlace(place)
    setPickupText(place.address)
    setRoute(null)
    setRouteGeoJson(null)
  }
  const handleDropoffPlaceSelect = (place) => {
    setDropoffPlace(place)
    setDropoffText(place.address)
    setRoute(null)
    setRouteGeoJson(null)
  }

  const handleSwapLocations = () => {
    setPickupText(dropoffText)
    setDropoffText(pickupText)
    setPickupPlace(dropoffPlace)
    setDropoffPlace(pickupPlace)
  }

  // Single map click handler — always mounted, mode determined by pickerMode state
  const handleMapClick = useCallback(async (latLng) => {
    if (!showMap) return
    const address = await reverseGeocode(latLng)
    const place = { address, lat: latLng.lat, lng: latLng.lng, name: address, placeId: '' }
    if (pickerMode === 'pickup') {
      setPickupPlace(place)
      setPickupText(address)
    } else {
      setDropoffPlace(place)
      setDropoffText(address)
    }
    setRoute(null)
    setRouteGeoJson(null)
  }, [showMap, pickerMode])

  const handlePickupTextChange = (text) => {
    setPickupText(text)
    if (pickupPlace && text !== pickupPlace.address) setPickupPlace(null)
  }
  const handleDropoffTextChange = (text) => {
    setDropoffText(text)
    if (dropoffPlace && text !== dropoffPlace.address) setDropoffPlace(null)
  }

  const pickupLat = pickupCoords?.lat
  const pickupLng = pickupCoords?.lng
  const dropoffLat = dropoffCoords?.lat
  const dropoffLng = dropoffCoords?.lng

  useEffect(() => {
    if (pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      setRoute(null)
      setRouteGeoJson(null)
      return
    }
    let cancelled = false
    getRoute({ lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng }).then((result) => {
      if (cancelled) return
      if (result) {
        setRoute({ distanceKm: result.distanceKm, durationMin: result.durationMin, approximate: false })
        setRouteGeoJson(result.routeGeoJson)
      } else {
        setRoute(estimateFallback({ lat: pickupLat, lng: pickupLng }, { lat: dropoffLat, lng: dropoffLng }))
        setRouteGeoJson(null)
      }
    })
    return () => { cancelled = true }
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng])

  const fare = useMemo(() => {
    if (!route || !route.distanceKm || route.distanceKm <= 0) return null
    return calculateFare(route.distanceKm, route.durationMin, vehicleType)
  }, [route, vehicleType])

  const sameLocation =
    pickupCoords && dropoffCoords && pickupCoords.lat === dropoffCoords.lat && pickupCoords.lng === dropoffCoords.lng

  const canBook =
    pickupText.trim() &&
    dropoffText.trim() &&
    pickupCoords &&
    dropoffCoords &&
    !sameLocation &&
    route &&
    route.distanceKm > 0 &&
    fare > 0

  const handleConfirmBooking = async () => {
    setError('')
    if (!pickupText.trim() || !dropoffText.trim()) { setError('Pickup and dropoff addresses are required.'); return }
    if (!pickupCoords || !dropoffCoords) { setError('Please select pickup and dropoff from the search suggestions or the map.'); return }
    if (sameLocation) { setError('Pickup and dropoff locations cannot be the same.'); return }
    if (!route || !(route.distanceKm > 0)) { setError('Could not calculate distance for this route.'); return }
    if (!(fare > 0)) { setError('Could not calculate a fare estimate. Please try again.'); return }

    setSubmitting(true)
    try {
      const payload = {
        pickup: { address: pickupText, lat: pickupCoords.lat, lng: pickupCoords.lng, placeId: pickupPlace?.placeId || '' },
        dropoff: { address: dropoffText, lat: dropoffCoords.lat, lng: dropoffCoords.lng, placeId: dropoffPlace?.placeId || '' },
        vehicleType,
        estimate: {
          distanceKm: Number(route.distanceKm.toFixed(2)),
          durationMin: Math.round(route.durationMin),
          fare,
          currency: 'PKR',
          pricingSource: route.approximate ? 'haversine_fallback' : 'osrm',
        },
      }
      const res = await bookRide(payload)
      navigate(`/passenger/ride-status/${res.data.trip_id}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Booking failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AsymmetricWorkspace
      mapLabel="Plan your ride"
      mapOverlay={
        <>
          {/* Single persistent map — never remounts, click handler toggled by showMap */}
          <OpenFreeMapView
            pickup={pickupCoords}
            dropoff={dropoffCoords}
            routeGeoJson={routeGeoJson}
            onMapClick={showMap ? handleMapClick : undefined}
            bare
          />

          {/* Instruction banner shown only when map picking is active */}
          {showMap && (
            <div className="absolute top-6 left-6 z-10 max-w-[min(100%,420px)] bg-white/80 backdrop-blur-xl border border-white/60 rounded-2xl px-4 py-3 text-sm text-zinc-700 shadow-lg">
              <span className="font-semibold text-zinc-900">Click on the map</span> to set the{' '}
              <span className="text-yellow-600 font-semibold">{pickerMode}</span> location.
            </div>
          )}

          {route && route.distanceKm > 0 && (
            <GlassHud position="bottom-left">
              <div className="flex flex-wrap gap-6 text-zinc-900">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Distance</p>
                  <p className="text-lg font-bold">{formatDistance(route.distanceKm)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">ETA</p>
                  <p className="text-lg font-bold">
                    {formatDuration(route.durationMin)}
                    {route.approximate && <span className="text-zinc-400 font-normal text-xs"> (approx.)</span>}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-zinc-500">Fare</p>
                  <p className="text-lg font-bold text-yellow-600">{fare != null ? formatCurrency(fare) : '—'}</p>
                </div>
              </div>
            </GlassHud>
          )}
        </>
      }
      inspector={
        <>
          <InspectorModule title="Pickup & dropoff" subtitle="Search or pick on the map" className="">
            {error && <div className="alert-error mb-2">{error}</div>}
            <div className="space-y-2">
              <div className="relative">
                <LocationSearchInput
                  label="Pickup"
                  placeholder="Search pickup location, e.g. Iqra University, Karachi"
                  value={pickupText}
                  onChange={handlePickupTextChange}
                  onPlaceSelect={handlePickupPlaceSelect}
                />
                <div className="h-2" />
                <LocationSearchInput
                  label="Dropoff"
                  placeholder="Search dropoff location"
                  value={dropoffText}
                  onChange={handleDropoffTextChange}
                  onPlaceSelect={handleDropoffPlaceSelect}
                />
                <button
                  type="button"
                  onClick={handleSwapLocations}
                  title="Swap pickup and dropoff"
                  aria-label="Swap pickup and dropoff"
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white border border-zinc-200 shadow-sm flex items-center justify-center text-zinc-500 hover:bg-yellow-50 hover:text-yellow-600 transition-colors"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                    <path d="M7 16V4M7 4 4 7M7 4l3 3" />
                    <path d="M17 8v12m0 0 3-3m-3 3-3-3" />
                  </svg>
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setShowMap(true); setPickerMode('pickup') }}
                  className={pickerMode === 'pickup' && showMap ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  📍 Pickup on Map
                </button>
                <button
                  type="button"
                  onClick={() => { setShowMap(true); setPickerMode('dropoff') }}
                  className={pickerMode === 'dropoff' && showMap ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
                >
                  📍 Dropoff on Map
                </button>
                {showMap && (
                  <button type="button" onClick={() => setShowMap(false)} className="btn-ghost btn-sm">
                    Done
                  </button>
                )}
              </div>
              {sameLocation && (
                <p className="text-xs text-red-600">Pickup and dropoff locations cannot be the same.</p>
              )}
            </div>
          </InspectorModule>

          <InspectorModule
            title="Minimum fare"
            subtitle={
              pickupCoords && dropoffCoords && !sameLocation
                ? route
                  ? `${formatDistance(route.distanceKm)} · ${formatDuration(route.durationMin)}`
                  : 'Calculating route…'
                : 'Select pickup & dropoff first'
            }
            className=""
            scrollContent={false}
            footer={
              <button
                type="button"
                onClick={handleConfirmBooking}
                disabled={!canBook || submitting}
                className="btn-primary w-full"
              >
                {submitting ? 'Requesting...' : 'Request ride at this fare'}
              </button>
            }
          >
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-4 gap-1.5">
                {VEHICLE_TYPES.map((v) => {
                  const selected = vehicleType === v.value
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setVehicleType(v.value)}
                      className={`py-2 px-1 text-center rounded-xl transition-transform duration-150 ease-out active:scale-90 ${
                        selected
                          ? 'scale-105 bg-yellow-400 border border-white/40 shadow-md shadow-yellow-500/30'
                          : 'glass-panel hover:scale-105'
                      }`}
                    >
                      <p className="text-xs font-bold text-zinc-900 truncate">{v.label}</p>
                      <p className={`text-[10px] ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>Rs. {v.baseFare}</p>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-col items-center justify-center text-center py-4">
                <p className="text-4xl font-bold text-yellow-600">
                  {fare != null ? formatCurrency(fare) : '—'}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Minimum fare you're offering · {VEHICLE_TYPES.find((v) => v.value === vehicleType)?.label}
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Nearby drivers can accept this fare or send you a counter-offer.
                </p>
                {route && !(route.distanceKm > 0) && (
                  <p className="mt-3 text-xs text-red-600">Could not calculate a route for this pickup/dropoff.</p>
                )}
              </div>
            </div>
          </InspectorModule>
        </>
      }
    />
  )
}