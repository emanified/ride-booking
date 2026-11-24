import { useEffect, useState } from 'react'
import { getTrips } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { getLocationAddress } from '../../utils/locations'
import { formatCurrency, getVehicleConfig } from '../../utils/fareCalculator'

const STATUS_VARIANT = {
  pending_driver: 'neutral',
  accepted: 'warning',
  driver_arriving: 'warning',
  arrived: 'warning',
  started: 'warning',
  awaiting_payment: 'warning',
  completed: 'neutral',
  cancelled: 'neutral',
}

export default function ManageTrips() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTrips().then((res) => setTrips(res.data.trips || [])).finally(() => setLoading(false))
  }, [])

  return (
    <ImmersiveScreen mapLabel="Trips">
      <FloatingPanel width="xl">
        <PageHeader title="Trips" subtitle="Live and historical activity" />
        {loading && <p className="text-zinc-500">Loading...</p>}
        <DataTable
          columns={['ID', 'Passenger', 'Driver', 'Route', 'Vehicle', 'Minimum fare', 'Fare', 'Status', 'Offers']}
          empty={!loading ? 'No trips yet.' : null}
        >
          {trips.map((trip) => (
            <tr key={trip.trip_id}>
              <td className="font-mono text-xs font-semibold text-yellow-700">#{trip.trip_id}</td>
              <td>{trip.passenger}</td>
              <td>{trip.driver || <span className="text-zinc-400">—</span>}</td>
              <td className="text-xs">{getLocationAddress(trip.pickup_location)} → {getLocationAddress(trip.dropoff_location)}</td>
              <td className="text-xs">
                {trip.vehicle
                  ? `${trip.vehicle.typeLabel} · ${trip.vehicle.number}`
                  : trip.vehicleType
                    ? getVehicleConfig(trip.vehicleType)?.label
                    : <span className="text-zinc-400">Not specified</span>}
              </td>
              <td className="text-xs text-zinc-500">{formatCurrency(trip.minimumFare)}</td>
              <td className="font-semibold">{formatCurrency(trip.fare)}</td>
              <td>
                <Badge variant={STATUS_VARIANT[trip.status] || 'neutral'}>{trip.status}</Badge>
              </td>
              <td className="text-xs text-zinc-500">
                {trip.status === 'pending_driver'
                  ? `${trip.offersCount || 0} offer(s) so far`
                  : trip.driverAssigned
                    ? 'Accepted'
                    : '—'}
              </td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
