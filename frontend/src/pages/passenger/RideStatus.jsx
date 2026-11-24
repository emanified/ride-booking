import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getRideStatus, payTrip, getPassengerMessages, postPassengerMessage, markPassengerMessagesRead, cancelRide, acceptDriverOffer, rejectDriverOffer } from '../../api'
import { Badge, ChatButton, ChatDialog, CancelRideDialog } from '../../components/ui'
import AsymmetricWorkspace, { GlassHud, InspectorModule, ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import OpenFreeMapView from '../../components/maps/OpenFreeMapView'
import { getRoute } from '../../utils/openStreetMap'
import { getLocationAddress } from '../../utils/locations'
import { formatCurrency, formatDistance, formatDuration, getVehicleConfig } from '../../utils/fareCalculator'

const STATUS_LABELS = {
  pending_driver: 'Waiting for a driver to accept or offer a fare',
  accepted: 'Driver accepted your ride.',
  driver_arriving: 'Driver is on the way to pickup',
  arrived: 'Driver has arrived at pickup',
  started: 'Your ride has started',
  awaiting_payment: 'Ride finished — payment required to close it out',
  completed: 'Your ride is completed',
  cancelled: 'Cancelled',
}

// Chat is only meaningful once a driver has actually accepted — before that
// there's nobody on the other end to message.
const CHAT_ENABLED_STATUSES = ['accepted', 'driver_arriving', 'arrived', 'started', 'awaiting_payment', 'completed']

const STATUS_BADGE_VARIANT = {
  pending_driver: 'neutral',
  accepted: 'warning',
  driver_arriving: 'warning',
  arrived: 'warning',
  started: 'warning',
  awaiting_payment: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
}

export default function RideStatus() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [trip, setTrip] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [events, setEvents] = useState([])
  const [messages, setMessages] = useState([])
  const [msgText, setMsgText] = useState('')
  const [paying, setPaying] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [offerActingId, setOfferActingId] = useState(null)
  const [unreadIds, setUnreadIds] = useState(new Set())
  const messagesEndRef = useRef(null)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getRideStatus(tripId)
        if (!cancelled) {
          setTrip(res.data.trip)
          setEvents(res.data.events || [])
        }
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.error || 'Could not load trip.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    const interval = setInterval(load, 5000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [tripId])

  // Poll messages — only once a driver has accepted, so there's no chat
  // activity (or wasted requests) before that. While the dialog is open, also
  // mark new arrivals as read so the badge stays accurate without the user
  // having to reopen the chat.
  useEffect(() => {
    if (!CHAT_ENABLED_STATUSES.includes(trip?.status)) return
    let cancelled = false
    async function loadMessages() {
      try {
        const res = await getPassengerMessages(tripId)
        if (!cancelled) setMessages(res.data.messages || [])
        if (!cancelled && chatOpen) await markPassengerMessagesRead(tripId)
      } catch (_) {}
    }
    loadMessages()
    const id = setInterval(loadMessages, 5000)
    return () => { cancelled = true; clearInterval(id) }
  }, [trip?.status, tripId, chatOpen])

  const unreadCount = messages.filter((m) => m.senderRole === 'driver' && !m.isRead).length

  const handleOpenChat = async () => {
    setUnreadIds(new Set(messages.filter((m) => m.senderRole === 'driver' && !m.isRead).map((m) => m.messageId)))
    setChatOpen(true)
    try {
      await markPassengerMessagesRead(tripId)
      const res = await getPassengerMessages(tripId)
      setMessages(res.data.messages || [])
    } catch {
      // best-effort read-receipt sync; ignore failures
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages])

  const pickupLat = trip?.pickup?.lat ?? trip?.pickup_lat
  const pickupLng = trip?.pickup?.lng ?? trip?.pickup_lng
  const dropoffLat = trip?.dropoff?.lat ?? trip?.dropoff_lat
  const dropoffLng = trip?.dropoff?.lng ?? trip?.dropoff_lng

  const pickup = pickupLat != null && pickupLng != null ? { lat: Number(pickupLat), lng: Number(pickupLng) } : null
  const dropoff = dropoffLat != null && dropoffLng != null ? { lat: Number(dropoffLat), lng: Number(dropoffLng) } : null
  const driverLocation = trip?.driverLocation && trip.driverLocation.lat != null && trip.driverLocation.lng != null
    ? { lat: Number(trip.driverLocation.lat), lng: Number(trip.driverLocation.lng) }
    : (trip?.driver_lat != null && trip?.driver_lng != null ? { lat: Number(trip.driver_lat), lng: Number(trip.driver_lng) } : null)

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

  const handleConfirmCancel = async (reason) => {
    setCancelling(true)
    setError('')
    try {
      await cancelRide(tripId, reason)
      navigate('/passenger/book')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not cancel ride.')
      setCancelling(false)
      setCancelDialogOpen(false)
    }
  }

  const handleAcceptOffer = async (offerId) => {
    setOfferActingId(offerId)
    setError('')
    try {
      await acceptDriverOffer(tripId, offerId)
      const res = await getRideStatus(tripId)
      setTrip(res.data.trip)
      setEvents(res.data.events || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not accept offer.')
    } finally {
      setOfferActingId(null)
    }
  }

  const handleRejectOffer = async (offerId) => {
    setOfferActingId(offerId)
    setError('')
    try {
      await rejectDriverOffer(tripId, offerId)
      const res = await getRideStatus(tripId)
      setTrip(res.data.trip)
      setEvents(res.data.events || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reject offer.')
    } finally {
      setOfferActingId(null)
    }
  }

  const handleSendMessage = async () => {
    if (!msgText.trim()) return
    try {
      await postPassengerMessage(tripId, { message: msgText })
      setMsgText('')
      const res = await getPassengerMessages(tripId)
      setMessages(res.data.messages || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not send message')
    }
  }

  if (loading) {
    return (
      <ImmersiveScreen mapLabel="Trip status">
        <FloatingPanel width="sm" className="flex items-center justify-center text-zinc-500">
          Loading trip...
        </FloatingPanel>
      </ImmersiveScreen>
    )
  }
  if (error || !trip) {
    return (
      <ImmersiveScreen mapLabel="Trip status">
        <FloatingPanel width="sm">
          <p className="alert-error">{error || 'Trip not found.'}</p>
          <button type="button" onClick={() => navigate('/passenger/dashboard')} className="link-accent mt-4">
            Back to dashboard
          </button>
        </FloatingPanel>
      </ImmersiveScreen>
    )
  }

  const pickupAddress = getLocationAddress(trip.pickup ?? trip.pickup_location)
  const dropoffAddress = getLocationAddress(trip.dropoff ?? trip.dropoff_location)
  const requestedVehicleLabel = trip.vehicleType ? getVehicleConfig(trip.vehicleType)?.label : 'Not specified'
  const statusLabel = STATUS_LABELS[trip.status] || trip.status
  const badgeVariant = STATUS_BADGE_VARIANT[trip.status] || 'neutral'

  const isPendingDriver = trip.status === 'pending_driver'
  const isAssigned = trip.driverAssigned && Boolean(trip.driver_name)
  const canCancel = !['started', 'awaiting_payment', 'completed', 'cancelled'].includes(trip.status)
  const canChat = CHAT_ENABLED_STATUSES.includes(trip.status)
  const pendingOffers = (trip.offers || []).filter((o) => o.status === 'pending')

  return (
    <>
    <AsymmetricWorkspace
      mapLabel="Trip status"
      mapOverlay={
        <>
          <OpenFreeMapView pickup={pickup} dropoff={dropoff} driverLocation={driverLocation} routeGeoJson={routeGeoJson} bare />
          <GlassHud position="top-right">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Badge variant={badgeVariant}>{statusLabel}</Badge>
                <span className="text-lg font-bold text-yellow-400">{formatCurrency(trip.fare)}</span>
              </div>
              {canCancel && (
                <button
                  type="button"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelling}
                  title="Cancel ride"
                  aria-label="Cancel ride"
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full bg-white/10 border border-white/20 text-white/70 hover:bg-red-500 hover:text-white hover:border-red-500 transition-colors duration-200 disabled:opacity-50"
                >
                  {cancelling ? (
                    <span className="text-[10px]">…</span>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-3.5 h-3.5">
                      <line x1="6" y1="6" x2="18" y2="18" />
                      <line x1="18" y1="6" x2="6" y2="18" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </GlassHud>
        </>
      }
      inspector={
        <>
          {/* Driver fare offers — shown at TOP so passenger never misses them */}
          {pendingOffers.length > 0 && (
            <InspectorModule title="🚗 Driver offers" subtitle="Respond to counter-offers">
              <div className="space-y-2">
                {pendingOffers.map((offer) => (
                  <div key={offer.offerId} className="glass-panel p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{offer.driverName}</p>
                      <p className="text-2xl font-bold text-yellow-600">{formatCurrency(offer.fare)}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <button type="button" onClick={() => handleAcceptOffer(offer.offerId)} disabled={offerActingId === offer.offerId} className="btn-primary btn-sm">{offerActingId === offer.offerId ? "…" : "Accept"}</button>
                      <button type="button" onClick={() => handleRejectOffer(offer.offerId)} disabled={offerActingId === offer.offerId} className="btn-secondary btn-sm">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            </InspectorModule>
          )}
          <InspectorModule
            title="Trip details"
            subtitle={`Trip #${tripId}`}
            className="shrink-0"
            footer={canCancel && (
              <button
                type="button"
                onClick={() => setCancelDialogOpen(true)}
                disabled={cancelling}
                className="btn-secondary btn-danger w-full"
              >
                {cancelling ? 'Cancelling...' : 'Cancel ride'}
              </button>
            )}
          >
            <div className="space-y-1 text-sm text-zinc-600">
              <p><span className="font-semibold text-zinc-800">Pickup:</span> {pickupAddress}</p>
              <p><span className="font-semibold text-zinc-800">Dropoff:</span> {dropoffAddress}</p>
              <p><span className="font-semibold text-zinc-800">Vehicle requested:</span> {requestedVehicleLabel}</p>
              {trip.estimate && (
                <p>
                  <span className="font-semibold text-zinc-800">Trip:</span>{' '}
                  {formatDistance(trip.estimate.distanceKm)} · {formatDuration(trip.estimate.durationMin)}
                </p>
              )}
            </div>
          </InspectorModule>

          <InspectorModule
            title="Driver"
            className="shrink-0"
            footer={(trip.status === 'awaiting_payment' || trip.status === 'completed') && (
              <div className="space-y-2">
                {trip.status === 'awaiting_payment' && (
                  <button type="button" disabled={paying} onClick={async () => {
                    setPaying(true)
                    try {
                      await payTrip(tripId)
                      // refresh
                      const res = await getRideStatus(tripId)
                      setTrip(res.data.trip)
                      setEvents(res.data.events || [])
                    } catch (err) {
                      setError(err.response?.data?.error || 'Payment failed.')
                    } finally {
                      setPaying(false)
                    }
                  }} className="btn-primary w-full">{paying ? 'Processing...' : 'Pay Now'}</button>
                )}
                <button type="button" onClick={() => navigate(`/passenger/payment/${tripId}`)} className="btn-secondary w-full">View receipt</button>
              </div>
            )}
          >
            <div className="space-y-1 text-sm text-zinc-600">
              {isPendingDriver ? (
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-zinc-700 mb-1">Waiting for a driver</p>
                    <p className="text-zinc-500 text-xs">
                      Your requested fare is <span className="font-semibold">{formatCurrency(trip.minimumFare ?? trip.fare)}</span>.
                      Any nearby driver can accept it now, or send you a counter-offer below.
                    </p>
                  </div>
                  {pendingOffers.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-zinc-700">Driver offers</p>
                      {pendingOffers.map((offer) => (
                        <div key={offer.offerId} className="glass-panel p-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-zinc-900">{offer.driverName}</p>
                            <p className="text-lg font-bold text-yellow-600">{formatCurrency(offer.fare)}</p>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleAcceptOffer(offer.offerId)}
                              disabled={offerActingId === offer.offerId}
                              className="btn-primary btn-sm"
                            >
                              {offerActingId === offer.offerId ? '…' : 'Accept'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectOffer(offer.offerId)}
                              disabled={offerActingId === offer.offerId}
                              className="btn-secondary btn-sm"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : isAssigned || trip.driver_name ? (
                <>
                  <p>
                    <span className="font-semibold text-zinc-800">Driver:</span> {trip.driver_name || '—'}
                    {trip.driver_rating ? ` · ★ ${Number(trip.driver_rating).toFixed(1)}` : ''}
                  </p>
                  {trip.vehicle ? (
                    <>
                      <p><span className="font-semibold text-zinc-800">Vehicle:</span> {trip.vehicle.typeLabel} · {trip.vehicle.model}</p>
                      <p><span className="font-semibold text-zinc-800">Number:</span> {trip.vehicle.number}</p>
                      <p><span className="font-semibold text-zinc-800">Color:</span> {trip.vehicle.color}</p>
                    </>
                  ) : (
                    <p className="text-zinc-500">Vehicle details not available.</p>
                  )}
                  {canChat && (
                    <ChatButton
                      label={trip.driver_name || 'Driver'}
                      unreadCount={unreadCount}
                      onClick={handleOpenChat}
                      className="mt-2"
                    />
                  )}
                </>
              ) : null}
            </div>
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
        </>
      }
    />
    <ChatDialog
      open={chatOpen}
      onClose={() => setChatOpen(false)}
      title={`Chat with ${trip.driver_name || 'driver'}`}
      messages={messages}
      value={msgText}
      onChange={setMsgText}
      onSend={handleSendMessage}
      messagesEndRef={messagesEndRef}
      unreadIds={unreadIds}
    />
    <CancelRideDialog
      open={cancelDialogOpen}
      onClose={() => setCancelDialogOpen(false)}
      onConfirm={handleConfirmCancel}
      confirming={cancelling}
    />
    </>
  )
}