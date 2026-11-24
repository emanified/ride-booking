import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRideHistory } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { getLocationAddress } from '../../utils/locations'
import { formatCurrency } from '../../utils/fareCalculator'

export default function RideHistory() {
  const navigate = useNavigate()
  const [rides, setRides] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getRideHistory()
      .then((res) => setRides(res.data.rides || []))
      .catch(() => setError('Could not load history.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <ImmersiveScreen mapLabel="Ride history">
      <FloatingPanel width="lg">
        <PageHeader title="Ride history" subtitle="Your past trips and receipts" />
        {loading && <p className="text-zinc-500">Loading...</p>}
        {error && <div className="alert-error mb-4">{error}</div>}
        <DataTable columns={['Trip', 'Date', 'Route', 'Fare', 'Status', '']} empty={!loading && !error ? 'No completed rides yet.' : null}>
          {rides.map((ride) => (
            <tr key={ride.trip_id}>
              <td className="font-mono text-xs font-semibold text-yellow-700">#{ride.trip_id}</td>
              <td>{ride.date ? new Date(ride.date).toLocaleDateString() : '—'}</td>
              <td>{getLocationAddress(ride.pickup)} → {getLocationAddress(ride.dropoff)}</td>
              <td className="font-semibold">{formatCurrency(ride.fare)}</td>
              <td><Badge variant="success">{ride.status}</Badge></td>
              <td>
                <button type="button" onClick={() => navigate(`/passenger/payment/${ride.trip_id}`)} className="link-accent text-xs">
                  Receipt
                </button>
              </td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}