import { useEffect, useState } from 'react'
import { getDriverRideHistory } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { formatCurrency, getVehicleConfig } from '../../utils/fareCalculator'

const PAYMENT_BADGE_VARIANT = {
  completed: 'success',
  pending: 'warning',
}

function formatDateTime(isoString) {
  if (!isoString) return '—'
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export default function RideHistory() {
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getDriverRideHistory()
      .then((res) => setRides(res.data.rides || []))
      .catch(() => setError('Could not load recent rides.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ImmersiveScreen mapLabel="Recent rides">
      <FloatingPanel width="lg">
        <PageHeader title="Recent rides" subtitle="Your completed trips" />
        {loading && <p className="text-zinc-500">Loading...</p>}
        {error && <div className="alert-error mb-4">{error}</div>}
        <DataTable
          columns={['Trip', 'Passenger', 'Route', 'Vehicle', 'Completed', 'Fare', 'Payment', 'Rating']}
          empty={!loading && !error ? 'No completed rides yet.' : null}
        >
          {rides.map((ride) => (
            <tr key={ride.trip_id}>
              <td className="font-mono text-xs font-semibold text-yellow-700">#{ride.trip_id}</td>
              <td>{ride.passenger_name}</td>
              <td className="text-xs">{ride.pickup_location || '—'} → {ride.dropoff_location || '—'}</td>
              <td className="text-xs">{ride.vehicleType ? getVehicleConfig(ride.vehicleType)?.label : '—'}</td>
              <td className="text-xs">{formatDateTime(ride.completedAt)}</td>
              <td className="font-semibold">{formatCurrency(ride.fare)}</td>
              <td>
                <Badge variant={PAYMENT_BADGE_VARIANT[ride.paymentStatus] || 'neutral'}>
                  {ride.paymentStatus === 'completed' ? 'Paid' : 'Unpaid'}
                </Badge>
              </td>
              <td className="text-xs">{ride.rating ? `★ ${ride.rating}` : '—'}</td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
