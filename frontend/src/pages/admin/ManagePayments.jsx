import { useEffect, useState } from 'react'
import { getPayments } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'

export default function ManagePayments() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getPayments().then((res) => setPayments(res.data.payments || [])).finally(() => setLoading(false))
  }, [])

  return (
    <ImmersiveScreen mapLabel="Payments">
      <FloatingPanel width="lg">
        <PageHeader title="Payments" subtitle="Transaction audit log" />
        {loading && <p className="text-zinc-500">Loading...</p>}
        <DataTable columns={['ID', 'Passenger', 'Route', 'Amount', 'Date', 'Status']} empty={!loading ? 'No payments yet.' : null}>
          {payments.map((p) => (
            <tr key={p.payment_id}>
              <td className="font-mono text-xs font-semibold text-yellow-700">#{p.payment_id}</td>
              <td>{p.passenger}</td>
              <td className="text-xs">{p.pickup_location} → {p.dropoff_location}</td>
              <td className="font-semibold">${Number(p.amount).toFixed(2)}</td>
              <td>{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}</td>
              <td><Badge variant={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></td>
            </tr>
          ))}
        </DataTable>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
