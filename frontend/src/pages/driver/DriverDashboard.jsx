import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDriverVehicle, getEarnings, getAssignedTrips, goOnline, goOffline, getDriverStatus } from '../../api'
import AsymmetricWorkspace, { GlassHud, InspectorModule } from '../../components/shell/AsymmetricWorkspace'
import { VerticalTimeline, TripCard, SkeletonGrid, StatusPill } from '../../components/dashboard/primitives'
import { getCurrentLocationOrFallback, GEOLOCATION_REASON_MESSAGE, LOCATION_PERMISSION_INSTRUCTIONS } from '../../utils/geolocation'

const SHIFT = [
  { id: '1', title: 'Online', desc: 'Accept rides' },
  { id: '2', title: 'Pickup', desc: 'En route' },
  { id: '3', title: 'Dropoff', desc: 'Complete' },
  { id: '4', title: 'Paid', desc: 'Settled' },
]

const VEHICLE_MESSAGES = {
  none: 'Please add your vehicle details before going online.',
  pending: 'Your vehicle is pending admin approval.',
  approved: 'Vehicle approved. You can receive rides.',
  rejected: 'Vehicle rejected. Please update and resubmit.',
}

function formatCoord(n) {
  return n != null ? Number(n).toFixed(5) : '—'
}

export default function DriverDashboard() {
  const navigate = useNavigate()
  const [online, setOnline] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [stats, setStats] = useState({ earnings: 0, trips: 0 })
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [vehicleLoaded, setVehicleLoaded] = useState(false)
  const [onlineError, setOnlineError] = useState('')
  const [locationInfo, setLocationInfo] = useState(null) // { lat, lng, updatedAt }

  const loadVehicle = () => {
    getDriverVehicle()
      .then((res) => setVehicle(res.data.vehicle))
      .catch(() => setVehicle(null))
      .finally(() => setVehicleLoaded(true))
  }

  // Sync online state + location info from backend status on mount.
  const loadStatus = () => {
    getDriverStatus()
      .then((res) => {
        const s = res.data.status || {}
        setOnline(!!s.isOnline)
        if (s.lat != null && s.lng != null) {
          setLocationInfo({ lat: s.lat, lng: s.lng, updatedAt: s.currentLocationUpdatedAt })
        }
      })
      .catch(() => {})
  }

  const load = () => {
    setLoading(true)
    Promise.all([
      getEarnings().then((r) => ({
        earnings: Number(r.data.total_earnings || 0),
        trips: r.data.earnings || [],
      })),
      getAssignedTrips().then((r) => r.data.trips || []).catch(() => []),
    ])
      .then(([e, assigned]) => {
        setStats({ earnings: e.earnings, trips: e.trips.length })
        setRequests(
          assigned.map((r) => ({
            trip_id: r.trip_id,
            pickup: r.pickup_location || (r.pickup || {}).address || '',
            dropoff: r.dropoff_location || (r.dropoff || {}).address || '',
            fare: r.fare,
            status: r.status,
            passenger_name: r.passenger_name,
            vehicleType: r.vehicleType,
          }))
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadStatus()
    loadVehicle()
  }, [])

  useEffect(() => {
    load()
  }, [online])

  const vehicleStatusKey = vehicle ? vehicle.status : 'none'
  const vehicleApproved = vehicle && vehicle.isApproved

  // Go Online: capture browser location (falling back to a default if
  // geolocation never responds) then call backend.
  const handleGoOnline = async () => {
    setUpdating(true)
    setOnlineError('')

    if (!vehicleApproved) {
      setOnlineError('Your vehicle must be approved before you can go online.')
      setUpdating(false)
      return
    }

    try {
      const loc = await getCurrentLocationOrFallback()
      if (loc.reason === 'permission_denied') {
        setOnlineError(LOCATION_PERMISSION_INSTRUCTIONS)
        return
      }
      await goOnline({ lat: loc.lat, lng: loc.lng })
      setOnline(true)
      setLocationInfo({ lat: loc.lat, lng: loc.lng, updatedAt: new Date().toISOString() })
      if (loc.usedFallback) {
        const reasonText = GEOLOCATION_REASON_MESSAGE[loc.reason] || 'Could not get your exact location.'
        setOnlineError(`${reasonText} An approximate location was used instead.`)
      }
    } catch (err) {
      setOnlineError(err.response?.data?.error || 'Could not go online. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  // Update Location manually.
  const handleUpdateLocation = async () => {
    setUpdating(true)
    try {
      const loc = await getCurrentLocationOrFallback()
      const { updateDriverLocation } = await import('../../api')
      await updateDriverLocation({ lat: loc.lat, lng: loc.lng })
      setLocationInfo({ lat: loc.lat, lng: loc.lng, updatedAt: new Date().toISOString() })
    } catch {
      // best-effort manual refresh; ignore failures
    } finally {
      setUpdating(false)
    }
  }

  const handleGoOffline = async () => {
    setUpdating(true)
    setOnlineError('')
    try {
      await goOffline()
      setOnline(false)
    } catch (err) {
      setOnlineError(err.response?.data?.error || 'Could not go offline.')
    } finally {
      setUpdating(false)
    }
  }

  // Reflects the driver's *current* state only — once a ride is completed and
  // paid, the assigned-trips list empties out again, so this resets to
  // "Online" (ready for the next ride) instead of getting stuck on "Paid"
  // forever just because `stats.trips` (lifetime count) is non-zero.
  const shiftStep = !online ? 0 : requests.length > 0 ? 1 : 0

  return (
    <AsymmetricWorkspace
      wide
      mapLabel={online ? 'Active zone · receiving' : 'Offline · standby'}
      mapOverlay={
        <>
          <GlassHud position="top-right">
            {online ? (
              <button
                type="button"
                onClick={handleGoOffline}
                disabled={updating}
                className="w-full px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 bg-yellow-400 text-slate-950 shadow-lg shadow-yellow-500/30"
              >
                {updating ? '…' : '● Online'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGoOnline}
                disabled={updating}
                className="w-full px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 bg-white/10 text-white border border-white/20"
              >
                {updating ? '…' : 'Go online'}
              </button>
            )}
          </GlassHud>
          <GlassHud position="bottom-left">
            <div className="flex gap-8 text-white text-sm">
              <span><strong className="text-yellow-400">Rs. {stats.earnings.toFixed(0)}</strong> earned</span>
              <span><strong>{stats.trips}</strong> trips</span>
              <span><strong>{requests.length}</strong> assigned</span>
            </div>
          </GlassHud>
        </>
      }
      inspector={
        <>
          {vehicleLoaded && vehicleStatusKey !== 'approved' && (
            <InspectorModule title="Vehicle status" subtitle="Required to go online" className="shrink-0">
              <div className="flex items-center justify-between mb-3">
                <StatusPill status={vehicleStatusKey === 'rejected' ? 'cancelled' : 'requested'} />
              </div>
              <p className="text-sm text-zinc-600">{VEHICLE_MESSAGES[vehicleStatusKey]}</p>
              <button type="button" onClick={() => navigate('/driver/vehicle')} className="btn-primary w-full mt-4">
                {vehicle ? 'Manage vehicle' : 'Add vehicle details'}
              </button>
            </InspectorModule>
          )}

          {onlineError && (
            <InspectorModule title="Could not go online" className="shrink-0">
              <p className="text-sm text-red-600">{onlineError}</p>
            </InspectorModule>
          )}

          <InspectorModule title="Shift control" subtitle="Execution timeline" className="shrink-0">
            <div className="flex items-center justify-between mb-3">
              <StatusPill status={online ? 'accepted' : 'cancelled'} />
              <span className="text-xs text-zinc-500">
                {online ? 'Online · Available' : 'Offline'}
              </span>
            </div>
            <VerticalTimeline steps={SHIFT} activeIndex={shiftStep} />
            {online && (
              <button type="button" onClick={() => navigate('/driver/requests')} className="btn-primary w-full mt-4">
                Open request queue
              </button>
            )}
          </InspectorModule>

          {/* Phase 4: Location info panel */}
          {locationInfo && locationInfo.lat != null && (
            <InspectorModule title="Current location" subtitle="Last known GPS fix" className="shrink-0">
              <div className="space-y-1 text-sm text-zinc-600">
                <p><span className="font-semibold text-zinc-800">Latitude:</span> {formatCoord(locationInfo.lat)}</p>
                <p><span className="font-semibold text-zinc-800">Longitude:</span> {formatCoord(locationInfo.lng)}</p>
                {locationInfo.updatedAt && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Updated: {new Date(locationInfo.updatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
              {online && (
                <button
                  type="button"
                  onClick={handleUpdateLocation}
                  disabled={updating}
                  className="btn-secondary w-full mt-3 text-xs"
                >
                  {updating ? 'Updating…' : 'Update location'}
                </button>
              )}
            </InspectorModule>
          )}

          <InspectorModule
            title="Assigned rides"
            subtitle={online ? `${requests.length} assigned` : 'Go online to receive'}
            className="flex-1 min-h-[180px]"
          >
            {!online ? (
              <p className="text-sm text-zinc-500">Enable shift to populate requests.</p>
            ) : loading ? (
              <SkeletonGrid count={2} />
            ) : requests.length === 0 ? (
              <p className="text-sm text-zinc-500 animate-pulse">Scanning for passengers…</p>
            ) : (
              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {requests.map((r) => (
                  <TripCard
                    key={r.trip_id}
                    trip={r}
                    selected={selected?.trip_id === r.trip_id}
                    onClick={() => setSelected(r)}
                  />
                ))}
              </div>
            )}
          </InspectorModule>

          {selected && (
            <InspectorModule
              title={selected.passenger_name || `Trip #${selected.trip_id}`}
              subtitle={`${selected.pickup} → ${selected.dropoff}`}
              className="lg:col-span-2"
              footer={
                <button
                  type="button"
                  onClick={() => navigate(`/driver/active-trip/${selected.trip_id}`)}
                  className="btn-primary w-full"
                >
                  Launch trip monitor
                </button>
              }
            >
              <p className="text-2xl font-bold text-yellow-600">Rs. {Number(selected.fare).toFixed(2)}</p>
              <p className="text-xs text-zinc-500 mt-2">Estimated fare</p>
            </InspectorModule>
          )}
        </>
      }
    />
  )
}