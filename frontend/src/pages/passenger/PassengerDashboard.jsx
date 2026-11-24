import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRideHistory } from '../../api'
import { useAuth } from '../../context/AuthContext'
import AsymmetricWorkspace, { GlassHud, InspectorModule } from '../../components/shell/AsymmetricWorkspace'
import { VerticalTimeline, TripCard, SkeletonGrid, StatusPill } from '../../components/dashboard/primitives'
import { getLocationAddress } from '../../utils/locations'
import { formatCurrency } from '../../utils/fareCalculator'

const JOURNEY = [
  { id: '1', title: 'Book', desc: 'Set route' },
  { id: '2', title: 'Track', desc: 'Live driver' },
  { id: '3', title: 'Pay', desc: 'Confirm fare' },
  { id: '4', title: 'Rate', desc: 'Feedback' },
]

export default function PassengerDashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    getRideHistory()
      .then((res) => {
        // pickup/dropoff come back as either plain strings (legacy) or
        // { address, lat, lng } objects (Phase 2+) — resolve to a display
        // string once here so TripCard/the inspector never render an object.
        const resolved = (res.data.rides || []).map((ride) => ({
          ...ride,
          pickup: getLocationAddress(ride.pickup),
          dropoff: getLocationAddress(ride.dropoff),
        }))
        setRides(resolved)
      })
      .catch(() => setRides([]))
      .finally(() => setLoading(false))
  }, [])

  const spent = rides.reduce((s, r) => s + Number(r.fare || 0), 0)
  // This dashboard only ever sees completed-trip history, never an active
  // trip, so the pipeline always rests at "Book" between rides.
  const step = 0

  return (
    <AsymmetricWorkspace
      wide
      mapLabel={`${user?.name?.split(' ')[0] || 'Passenger'} · service area`}
      mapOverlay={
        <GlassHud position="bottom-left">
          <div className="flex flex-wrap gap-6 text-zinc-900">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Trips</p>
              <p className="text-2xl font-bold">{loading ? '—' : rides.length}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-zinc-500">Spend</p>
              <p className="text-2xl font-bold text-yellow-400">{loading ? '—' : formatCurrency(spent.toFixed(0))}</p>
            </div>
          </div>
        </GlassHud>
      }
      inspector={
        <>
          <InspectorModule
            title="Operations"
            subtitle="Passenger command"
            className="shrink-0"
            footer={
              <button type="button" onClick={() => navigate('/passenger/book')} className="btn-primary w-full">
                + New ride
              </button>
            }
          >
            <p className="text-xs text-zinc-500 mb-3">Journey pipeline</p>
            <VerticalTimeline steps={JOURNEY} activeIndex={step} />
          </InspectorModule>

          <InspectorModule title="Trip feed" subtitle={loading ? 'Syncing…' : `${rides.length} records`} className="flex-1 min-h-[200px]">
            {loading ? (
              <SkeletonGrid count={2} />
            ) : rides.length === 0 ? (
              <p className="text-sm text-zinc-500">No trips yet. Book from the canvas or dock.</p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {rides.map((ride) => (
                  <TripCard
                    key={ride.trip_id}
                    trip={ride}
                    selected={selected?.trip_id === ride.trip_id}
                    onClick={() => setSelected(ride)}
                  />
                ))}
              </div>
            )}
          </InspectorModule>

          {selected && (
            <InspectorModule
              title={`Trip #${selected.trip_id}`}
              subtitle={`${selected.pickup} → ${selected.dropoff}`}
              className="lg:col-span-2"
              footer={
                <button
                  type="button"
                  onClick={() => navigate(`/passenger/payment/${selected.trip_id}`)}
                  className="btn-primary w-full"
                >
                  Open receipt
                </button>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <StatusPill status={selected.status} />
                  <span className="text-xl font-bold text-zinc-900">{formatCurrency(Number(selected.fare).toFixed(2))}</span>
                </div>
                {selected.driver_name && (
                  <p className="text-zinc-600">
                    <span className="font-semibold text-zinc-800">Driver:</span> {selected.driver_name}
                  </p>
                )}
              </div>
            </InspectorModule>
          )}
        </>
      }
    />
  )
}