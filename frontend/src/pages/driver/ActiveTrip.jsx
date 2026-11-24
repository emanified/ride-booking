import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getActiveTrip, updateTripStatus, updateDriverTripLocation, getDriverTripEvents, completeTrip, getDriverMessages, postDriverMessage, markDriverMessagesRead } from '../../api'
import AsymmetricWorkspace, { GlassHud, InspectorModule } from '../../components/shell/AsymmetricWorkspace'
import { ChatButton, ChatDialog } from '../../components/ui'
import OpenFreeMapView from '../../components/maps/OpenFreeMapView'
import { getRoute } from '../../utils/openStreetMap'
import { getLocationAddress } from '../../utils/locations'
import { getVehicleConfig } from '../../utils/fareCalculator'

const STATUS_FLOW = [
  { status: 'accepted', label: 'Accepted', button: 'Start driving to pickup' },
  { status: 'driver_arriving', label: 'Driving to pickup', button: 'I have arrived' },
  { status: 'arrived', label: 'Waiting at pickup', button: 'Start trip' },
  { status: 'started', label: 'On trip', button: 'Complete trip' },
  { status: 'awaiting_payment', label: 'Awaiting payment', button: '' },
]

export default function ActiveTrip() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [tripStep, setTripStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [events, setEvents] = useState([])
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [chatOpen, setChatOpen] = useState(false)
  const [unreadIds, setUnreadIds] = useState(new Set())
  const messagesEndRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getActiveTrip(tripId)
        if (cancelled) return
        const t = res.data.trip
        setTrip(t)
        const idx = STATUS_FLOW.findIndex((s) => s.status === t?.status)
        setTripStep(idx >= 0 ? idx : 0)
      } catch (err) {
        // ignore
      }
      try {
        const ev = await getDriverTripEvents(tripId)
        if (!cancelled) setEvents(ev.data.events || [])
        const ms = await getDriverMessages(tripId)
        if (!cancelled) setMessages(ms.data.messages || [])
      } catch (_) {}
    }
    load()
    return () => { cancelled = true }
  }, [tripId])

  const handleProgressStep = async () => {
    const next = STATUS_FLOW[tripStep + 1]
    if (!next) return
    setLoading(true)
    setError('')
    try {
      if (next.status === 'awaiting_payment') {
        await completeTrip(tripId)
      } else {
        await updateTripStatus(tripId, { status: next.status })
      }
      setTripStep(tripStep + 1)
      const res = await getActiveTrip(tripId)
      setTrip(res.data.trip)
      const ev = await getDriverTripEvents(tripId)
      setEvents(ev.data.events || [])
      const ms = await getDriverMessages(tripId)
      setMessages(ms.data.messages || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not update status.')
    } finally {
      setLoading(false)
    }
  }

  // Update my location (manual)
  const handleUpdateLocation = () => {
    if (!navigator.geolocation) {
      setError('Location permission is required to update your trip location.')
      return
    }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          await updateDriverTripLocation(tripId, { lat, lng, manual: true })
          const res = await getActiveTrip(tripId)
          setTrip(res.data.trip)
          const ev = await getDriverTripEvents(tripId)
          setEvents(ev.data.events || [])
        } catch (err) {
          setError(err.response?.data?.error || 'Could not update location.')
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setError('Location permission is required to update your trip location.')
        setLoading(false)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  // Auto-update location every 15s (non-manual)
  useEffect(() => {
    let id = null
    if (trip) {
      id = setInterval(() => {
        if (!navigator.geolocation) return
        navigator.geolocation.getCurrentPosition(async (position) => {
          try {
            const lat = position.coords.latitude
            const lng = position.coords.longitude
            await updateDriverTripLocation(tripId, { lat, lng, manual: false })
            const res = await getActiveTrip(tripId)
            setTrip(res.data.trip)
          } catch (_) {}
        })
      }, 15000)
    }
    return () => { if (id) clearInterval(id) }
  }, [trip, tripId])

  // Once the driver has finished the ride, it isn't actually over until the
  // passenger pays — keep polling and only leave for Earnings once the trip
  // flips to 'completed'.
  useEffect(() => {
    if (trip?.status !== 'awaiting_payment') return
    let cancelled = false
    const id = setInterval(async () => {
      try {
        const res = await getActiveTrip(tripId)
        if (cancelled) return
        if (res.data.trip?.status === 'completed') {
          navigate('/driver/earnings')
          return
        }
        setTrip(res.data.trip)
      } catch (_) {}
    }, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [trip?.status, tripId, navigate])

  // Poll messages every 5s. While the dialog is open, also mark new arrivals
  // as read so the badge stays accurate without reopening the chat.
  useEffect(() => {
    let id = null
    if (trip) {
      id = setInterval(async () => {
        try {
          const res = await getDriverMessages(tripId)
          setMessages(res.data.messages || [])
          if (chatOpen) await markDriverMessagesRead(tripId)
        } catch (_) {}
      }, 5000)
    }
    return () => { if (id) clearInterval(id) }
  }, [trip, tripId, chatOpen])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const unreadCount = messages.filter((m) => m.senderRole === 'passenger' && !m.isRead).length

  const handleOpenChat = async () => {
    setUnreadIds(new Set(messages.filter((m) => m.senderRole === 'passenger' && !m.isRead).map((m) => m.messageId)))
    setChatOpen(true)
    try {
      await markDriverMessagesRead(tripId)
      const res = await getDriverMessages(tripId)
      setMessages(res.data.messages || [])
    } catch {
      // best-effort read-receipt sync; ignore failures
    }
  }

  const handleSendMessage = async () => {
    if (!msgText.trim()) return
    try {
      await postDriverMessage(tripId, { message: msgText })
      setMsgText('')
      const res = await getDriverMessages(tripId)
      setMessages(res.data.messages || [])
    } catch (_) {}
  }

  const current = STATUS_FLOW[tripStep]

  const pickupLat = trip?.pickup?.lat ?? trip?.pickup_lat
  const pickupLng = trip?.pickup?.lng ?? trip?.pickup_lng
  const dropoffLat = trip?.dropoff?.lat ?? trip?.dropoff_lat
  const dropoffLng = trip?.dropoff?.lng ?? trip?.dropoff_lng

  const pickup = pickupLat != null && pickupLng != null ? { lat: Number(pickupLat), lng: Number(pickupLng) } : null
  const dropoff = dropoffLat != null && dropoffLng != null ? { lat: Number(dropoffLat), lng: Number(dropoffLng) } : null

  const [routeGeoJson, setRouteGeoJson] = useState(null)
  useEffect(() => {
    if (!pickup || !dropoff) {
      setRouteGeoJson(null)
      return
    }
    let cancelled = false
    getRoute(pickup, dropoff).then((result) => {
      if (!cancelled) setRouteGeoJson(result?.routeGeoJson || null)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng])

  const pickupAddress = trip ? getLocationAddress(trip.pickup ?? trip.pickup_location) : null
  const dropoffAddress = trip ? getLocationAddress(trip.dropoff ?? trip.dropoff_location) : null
  const vehicleLabel = trip?.vehicleType ? getVehicleConfig(trip.vehicleType)?.label : null

  return (
    <>
    <AsymmetricWorkspace
      mapLabel="Active trip"
      mapOverlay={
        <>
          <OpenFreeMapView
            pickup={pickup}
            dropoff={dropoff}
            driverLocation={trip?.driverLocation ? { lat: trip.driverLocation.lat, lng: trip.driverLocation.lng } : null}
            routeGeoJson={routeGeoJson}
            bare
          />
          <GlassHud position="top-right">
            <div className="flex items-center justify-between gap-4">
              <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                Step {tripStep + 1} of {STATUS_FLOW.length}
              </span>
              <span className="text-sm font-bold text-yellow-400">{current?.label}</span>
            </div>
          </GlassHud>
        </>
      }
      inspector={
        <>
          <InspectorModule title="Trip details" subtitle={`Trip #${tripId}`} className="shrink-0">
            {error && <div className="alert-error mb-3">{error}</div>}
            {(pickupAddress || dropoffAddress || vehicleLabel) ? (
              <div className="space-y-1 text-sm text-zinc-600">
                {pickupAddress && <p><span className="font-semibold text-zinc-800">Pickup:</span> {pickupAddress}</p>}
                {dropoffAddress && <p><span className="font-semibold text-zinc-800">Dropoff:</span> {dropoffAddress}</p>}
                {vehicleLabel && <p><span className="font-semibold text-zinc-800">Vehicle:</span> {vehicleLabel}</p>}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">Loading trip details…</p>
            )}
          </InspectorModule>

          <InspectorModule
            title="Trip controls"
            className="shrink-0"
            footer={
              current?.status === 'awaiting_payment' ? null : (
                <div className="flex gap-3">
                  <button type="button" onClick={handleProgressStep} disabled={loading || !current || !current.button} className="btn-primary flex-1">
                    {loading ? 'Updating...' : current?.button || '—'}
                  </button>
                  <button type="button" onClick={handleUpdateLocation} disabled={loading} className="btn-secondary">
                    {loading ? '…' : 'Update location'}
                  </button>
                </div>
              )
            }
          >
            {current?.status === 'awaiting_payment' ? (
              <div className="glass-cta p-3 text-sm font-medium text-zinc-900">
                Ride finished — waiting for the passenger to pay. You'll be moved to Earnings automatically once payment is confirmed.
              </div>
            ) : (
              <div className="glass-cta p-3 text-sm font-medium text-zinc-900">
                Current: {current?.label}
              </div>
            )}
          </InspectorModule>

          <InspectorModule title="Activity" subtitle="Timeline" className="flex-1 min-h-[200px]">
            {events.length > 0 ? (
              <div className="space-y-2">
                {events.map((e, i) => (
                  <div key={i} className="glass-panel p-3 text-sm">
                    <div className="text-xs text-zinc-500">{e.createdAt}</div>
                    <div className="font-medium">{e.eventType}</div>
                    {e.message && <div className="text-zinc-600 text-xs">{e.message}</div>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-400">No activity yet.</p>
            )}
          </InspectorModule>

          <ChatButton
            label={trip?.passenger_name || 'Passenger'}
            unreadCount={unreadCount}
            onClick={handleOpenChat}
            className="shrink-0"
          />
        </>
      }
    />
    <ChatDialog
      open={chatOpen}
      onClose={() => setChatOpen(false)}
      title={`Chat with ${trip?.passenger_name || 'passenger'}`}
      messages={messages}
      value={msgText}
      onChange={setMsgText}
      onSend={handleSendMessage}
      messagesEndRef={messagesEndRef}
      unreadIds={unreadIds}
    />
    </>
  )
}