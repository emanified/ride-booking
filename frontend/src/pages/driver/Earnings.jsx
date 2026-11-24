import { useEffect, useState } from 'react'
import { getEarnings } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'

export default function Earnings() {
  const [trips, setTrips] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getEarnings()
      .then((res) => {
        setTrips(res.data.trips || [])
        setTotal(Number(res.data.total_earnings || 0))
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <ImmersiveScreen mapLabel="Earnings">
      <FloatingPanel width="lg">
        <PageHeader
          title="Earnings"
          subtitle={<>Total: <span className="text-yellow-600 font-semibold">${total.toFixed(2)}</span></>}
        />
        {loading && <p className="text-zinc-500">Loading...</p>}
        <DataTable columns={['Trip', 'Route', 'Date', 'Payout', 'Status']} empty={!loading ? 'No payouts yet.' : null}>
          {trips.map((tx) => (
            <tr key={tx.trip_id}>
              <td className="font-mono text-xs font-semibold text-yellow-700">#{tx.trip_id}</td>
              <td className="text-xs">{tx.pickup || '—'} → {tx.dropoff || '—'}</td>
              <td>{tx.earnedAt ? new Date(tx.earnedAt).toLocaleDateString() : '—'}</td>
              <td className="font-semibold text-yellow-700">${Number(tx.amount || 0).toFixed(2)}</td>
              <td><Badge variant="success">Paid</Badge></td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
