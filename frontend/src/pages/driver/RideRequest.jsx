import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  acceptBroadcastRequest, declineBroadcastRequest, getBroadcastRequests, offerOnBroadcastRequest,
  getDriverStatus, goOnline, goOffline,
} from '../../api'
import { PageHeader, GlassCard, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { formatCurrency, getVehicleConfig } from '../../utils/fareCalculator'
import { getCurrentLocationOrFallback, GEOLOCATION_REASON_MESSAGE, LOCATION_PERMISSION_INSTRUCTIONS } from '../../utils/geolocation'

export default function RideRequest() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState([])
  const [requestsMessage, setRequestsMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actingId, setActingId] = useState(null)
  const [offeringId, setOfferingId] = useState(null)
  const [offerFare, setOfferFare] = useState('')

  // Availability: whether this driver is online and can receive broadcast
  // requests at all. `null` while the initial status check is in flight.
  const [available, setAvailable] = useState(null)
  const [togglingAvailability, setTogglingAvailability] = useState(false)
  const [availabilityError, setAvailabilityError] = useState('')

  const loadAvailability = () => {
    getDriverStatus()
      .then((res) => setAvailable(!!res.data.status?.isOnline))
      .catch(() => {})
  }

  const loadRequests = () => {
    getBroadcastRequests()
      .then((res) => {
        setRequests(res.data.requests || [])
        setRequestsMessage(res.data.message || '')
      })
      .catch(() => setError('Could not load requests.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAvailability()
    loadRequests()
    const interval = setInterval(() => { loadAvailability(); loadRequests() }, 6000)
    return () => clearInterval(interval)
  }, [])

  const handleSetAvailable = async () => {
    setAvailabilityError('')
    setTogglingAvailability(true)
    try {
      const loc = await getCurrentLocationOrFallback()
      if (loc.reason === 'permission_denied') {
        // Don't go available on a denial — ask the driver to fix it and retry,
        // rather than silently using an approximate location they didn't agree to.
        setAvailabilityError(LOCATION_PERMISSION_INSTRUCTIONS)
        return
      }
      await goOnline({ lat: loc.lat, lng: loc.lng })
      setAvailable(true)
      if (loc.usedFallback) {
        const reasonText = GEOLOCATION_REASON_MESSAGE[loc.reason] || 'Could not get your exact location.'
        setAvailabilityError(`${reasonText} An approximate location was used instead — you can update it later from the Hub.`)
      }
      loadRequests()
    } catch (err) {
      setAvailabilityError(err.response?.data?.error || 'Could not set you as available.')
    } finally {
      setTogglingAvailability(false)
    }
  }

  const handleSetUnavailable = async () => {
    setAvailabilityError('')
    setTogglingAvailability(true)
    try {
      await goOffline()
      setAvailable(false)
      setRequests([])
    } catch (err) {
      setAvailabilityError(err.response?.data?.error || 'Could not set you as unavailable.')
    } finally {
      setTogglingAvailability(false)
    }
  }

  const handleAccept = async (tripId) => {
    setActingId(tripId)
    setError('')
    try {
      await acceptBroadcastRequest(tripId)
      navigate(`/driver/active-trip/${tripId}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept ride.')
      loadRequests()
    } finally {
      setActingId(null)
    }
  }

  const handleDecline = async (tripId) => {
    setActingId(tripId)
    setError('')
    try {
      await declineBroadcastRequest(tripId)
      setRequests((prev) => prev.filter((r) => r.trip_id !== tripId))
    } catch (err) {
      setError(err.response?.data?.error || 'Could not decline ride.')
    } finally {
      setActingId(null)
    }
  }

  const handleSubmitOffer = async (tripId) => {
    const fare = Number(offerFare)
    if (!fare || fare <= 0) {
      setError('Enter a valid offer amount.')
      return
    }
    setActingId(tripId)
    setError('')
    try {
      await offerOnBroadcastRequest(tripId, fare)
      setOfferingId(null)
      setOfferFare('')
      loadRequests()
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit offer.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <ImmersiveScreen mapLabel="Ride requests">
      <FloatingPanel width="lg">
      <PageHeader title="Open ride requests" subtitle="Accept at the passenger's fare, or counter-offer" />

      <GlassCard className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={available ? 'success' : 'neutral'}>{available ? 'Available' : 'Unavailable'}</Badge>
          <p className="text-sm text-zinc-600">
            {available ? 'You will receive new ride requests.' : 'You will not receive ride requests until you set yourself available.'}
          </p>
        </div>
        {available ? (
          <button type="button" onClick={handleSetUnavailable} disabled={togglingAvailability || available === null} className="btn-secondary">
            {togglingAvailability ? 'Updating…' : 'Set unavailable'}
          </button>
        ) : (
          <button type="button" onClick={handleSetAvailable} disabled={togglingAvailability || available === null} className="btn-primary">
            {togglingAvailability ? 'Updating…' : 'Set available'}
          </button>
        )}
      </GlassCard>
      {availabilityError && <div className="alert-error mb-4">{availabilityError}</div>}

      {loading && <p className="text-zinc-500">Loading...</p>}
      {error && <div className="alert-error mb-4">{error}</div>}
      {!loading && requests.length === 0 && (
        <GlassCard><p className="text-zinc-500 text-sm">{requestsMessage || 'No open requests right now.'}</p></GlassCard>
      )}
      <div className="space-y-4">
        {requests.map((req) => {
          const vehicleLabel = req.vehicleType ? getVehicleConfig(req.vehicleType)?.label : null
          const myOffer = req.myOffer
          return (
            <GlassCard key={req.trip_id} className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <p className="text-xs font-mono text-yellow-700 font-bold">#{req.trip_id}</p>
                  <Badge variant="warning">Open request</Badge>
                  {vehicleLabel && <Badge variant="neutral">{vehicleLabel}</Badge>}
                </div>
                <h3 className="text-lg font-semibold text-zinc-900 mt-1">{req.passenger_name}</h3>
                <p className="text-sm text-zinc-600 mt-2">
                  <span className="font-medium">From:</span>{' '}
                  {req.pickup_location || (req.pickup || {}).address || '—'}
                </p>
                <p className="text-sm text-zinc-600">
                  <span className="font-medium">To:</span>{' '}
                  {req.dropoff_location || (req.dropoff || {}).address || '—'}
                </p>
                {req.estimate && (
                  <p className="text-xs text-zinc-400 mt-1">
                    {req.estimate.distanceKm} km · ~{req.estimate.durationMin} min
                  </p>
                )}
                {myOffer && (
                  <p className="text-xs mt-2">
                    Your offer of <span className="font-semibold">{formatCurrency(myOffer.fare)}</span>:{' '}
                    <span className={
                      myOffer.status === 'pending' ? 'text-amber-600'
                        : myOffer.status === 'rejected' ? 'text-red-600'
                        : 'text-zinc-500'
                    }>{myOffer.status}</span>
                    {myOffer.status === 'rejected' && ' — you can submit a new offer'}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-start md:items-end gap-2">
                <span className="text-2xl font-bold text-yellow-600">{formatCurrency(req.minimumFare)}</span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-400">Minimum fare</span>
                <button
                  type="button"
                  onClick={() => handleAccept(req.trip_id)}
                  disabled={actingId === req.trip_id}
                  className="btn-primary"
                >
                  {actingId === req.trip_id ? 'Accepting…' : 'Accept at minimum fare'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOfferingId(req.trip_id); setOfferFare('') }}
                  disabled={actingId === req.trip_id}
                  className="btn-secondary"
                >
                  Offer a different fare
                </button>
                <button
                  type="button"
                  onClick={() => handleDecline(req.trip_id)}
                  disabled={actingId === req.trip_id}
                  className="btn-ghost text-xs"
                >
                  Not interested
                </button>
              </div>
              {offeringId === req.trip_id && (
                <div className="glass-panel p-4 rounded-3xl bg-white/80 w-full md:w-auto mt-3">
                  <p className="text-sm font-semibold text-zinc-800 mb-2">Your offer (must be above {formatCurrency(req.minimumFare)})</p>
                  <div className="space-y-2">
                    <input
                      type="number"
                      value={offerFare}
                      onChange={(e) => setOfferFare(e.target.value)}
                      placeholder="Enter fare amount"
                      className="w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setOfferingId(null)}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmitOffer(req.trip_id)}
                        disabled={actingId === req.trip_id}
                        className="btn-primary flex-1"
                      >
                        {actingId === req.trip_id ? 'Submitting…' : 'Submit offer'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          )
        })}
      </div>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
