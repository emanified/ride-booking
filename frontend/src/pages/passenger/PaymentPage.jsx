import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRideStatus, payTrip } from '../../api'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { getLocationAddress } from '../../utils/locations'
import { formatCurrency } from '../../utils/fareCalculator'

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PaymentPage() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [loadingTrip, setLoadingTrip] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [paid, setPaid] = useState(false)

  useEffect(() => {
    let cancelled = false
    getRideStatus(tripId)
      .then((res) => {
        if (cancelled) return
        setTrip(res.data.trip)
        if (res.data.trip?.isPaid) setPaid(true)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingTrip(false) })
    return () => { cancelled = true }
  }, [tripId])

  const handlePay = async () => {
    setLoading(true)
    setError('')
    try {
      await payTrip(tripId)
      setPaid(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Payment failed.')
    } finally {
      setLoading(false)
    }
  }

  const pickupAddress = trip ? getLocationAddress(trip.pickup ?? trip.pickup_location) : '—'
  const dropoffAddress = trip ? getLocationAddress(trip.dropoff ?? trip.dropoff_location) : '—'

  return (
    <ImmersiveScreen mapLabel="Payment">
      <FloatingPanel width="sm" className="text-center">
        <p className="text-xs uppercase tracking-wider text-yellow-600 font-semibold">Payment</p>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">Trip receipt</h1>
        <p className="text-xs text-zinc-400 font-mono mt-1">#{tripId}</p>

        {loadingTrip ? (
          <p className="text-sm text-zinc-500 mt-6">Loading receipt...</p>
        ) : trip ? (
          <div className="text-left mt-6 space-y-3 text-sm">
            <div className="glass-panel p-4 space-y-1.5">
              <p><span className="font-semibold text-zinc-800">Pickup:</span> <span className="text-zinc-600">{pickupAddress}</span></p>
              <p><span className="font-semibold text-zinc-800">Dropoff:</span> <span className="text-zinc-600">{dropoffAddress}</span></p>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <p><span className="font-semibold text-zinc-800">Driver:</span> <span className="text-zinc-600">{trip.driver_name || '—'}</span></p>
              <p><span className="font-semibold text-zinc-800">Driver phone:</span> <span className="text-zinc-600">{trip.driver_phone || '—'}</span></p>
              <p><span className="font-semibold text-zinc-800">Passenger:</span> <span className="text-zinc-600">{trip.passenger_name || '—'}</span></p>
              <p><span className="font-semibold text-zinc-800">Passenger phone:</span> <span className="text-zinc-600">{trip.passenger_phone || '—'}</span></p>
            </div>

            <div className="glass-panel p-4 space-y-1.5">
              <p><span className="font-semibold text-zinc-800">Ride started:</span> <span className="text-zinc-600">{formatDateTime(trip.startedAt)}</span></p>
              <p><span className="font-semibold text-zinc-800">Ride ended:</span> <span className="text-zinc-600">{formatDateTime(trip.completed_at)}</span></p>
            </div>

            <div className="glass-panel-strong p-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total fare</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">{formatCurrency(trip.fare)}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600 mt-6">Could not load trip details.</p>
        )}

        {error && <div className="alert-error mt-4">{error}</div>}
        {!paid ? (
          <button type="button" onClick={handlePay} disabled={loading} className="btn-primary w-full mt-6">
            {loading ? 'Processing...' : 'Confirm payment'}
          </button>
        ) : (
          <>
            <div className="alert-success mt-4">Payment confirmed</div>
            {!trip?.isRated && (
              <button type="button" onClick={() => navigate(`/passenger/rate/${tripId}`)} className="btn-primary w-full mt-4">
                Rate your driver
              </button>
            )}
          </>
        )}
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
