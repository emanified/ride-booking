import { useEffect, useState } from 'react'
import { approveVehicle, getAdminVehicles, rejectVehicle } from '../../api'
import { PageHeader, DataTable, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' }
const STATUS_LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' }
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export default function VehicleApprovals() {
  const [vehicles, setVehicles] = useState([])
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [actingId, setActingId] = useState(null)
  const [rejectingId, setRejectingId] = useState(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const load = async (status) => {
    setLoading(true)
    setError('')
    try {
      const [listRes, pendingRes] = await Promise.all([
        getAdminVehicles(status || undefined),
        getAdminVehicles('pending'),
      ])
      setVehicles(listRes.data.vehicles || [])
      setPendingCount((pendingRes.data.vehicles || []).length)
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load vehicles.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(filter) }, [filter])

  const handleApprove = async (vehicleId) => {
    setActingId(vehicleId)
    setError('')
    try {
      await approveVehicle(vehicleId)
      await load(filter)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not approve vehicle.')
    } finally {
      setActingId(null)
    }
  }

  const handleRejectSubmit = async (vehicleId) => {
    if (!reason.trim()) return
    setActingId(vehicleId)
    setError('')
    try {
      await rejectVehicle(vehicleId, reason.trim())
      setRejectingId(null)
      setReason('')
      await load(filter)
    } catch (err) {
      setError(err.response?.data?.error || 'Could not reject vehicle.')
    } finally {
      setActingId(null)
    }
  }

  return (
    <ImmersiveScreen mapLabel="Vehicle approvals">
      <FloatingPanel width="xl">
        <PageHeader
          title="Vehicle approvals"
          subtitle="Review and approve driver vehicle submissions"
          action={
            <div className="flex gap-2 flex-wrap">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={`relative btn-sm ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {f.label}
                  {f.value === 'pending' && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          }
        />

        {/* Pending alert banner */}
        {pendingCount > 0 && filter !== 'pending' && (
          <div className="mb-5 flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200/80">
            <span className="text-amber-500 text-xl leading-none">⚠</span>
            <p className="text-sm font-medium text-amber-800">
              {pendingCount} vehicle{pendingCount !== 1 ? 's' : ''} awaiting approval
            </p>
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className="ml-auto text-xs font-bold text-amber-700 hover:text-amber-900 hover:underline"
            >
              Review now →
            </button>
          </div>
        )}

        {error && <div className="alert-error mb-4">{error}</div>}

        {loading ? (
          <div className="flex items-center gap-3 py-10 text-zinc-400">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
            <span className="text-sm">Loading vehicles…</span>
          </div>
        ) : vehicles.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-zinc-400 text-sm">
              {filter === 'pending'
                ? 'No pending vehicle submissions.'
                : filter
                ? `No ${filter} vehicles.`
                : 'No vehicles registered yet.'}
            </p>
            <p className="text-zinc-500 text-xs mt-2">
              Drivers register vehicles from their Vehicle Management page.
            </p>
          </div>
        ) : (
          <DataTable
            columns={['Driver', 'Vehicle', 'Plate', 'Color', 'Seats', 'Submitted', 'Status', 'Actions']}
          >
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td>
                  <p className="font-medium text-zinc-900">{v.driverName}</p>
                  {v.driverEmail && <p className="text-xs text-zinc-500">{v.driverEmail}</p>}
                </td>
                <td className="text-sm">
                  <span className="font-medium">{v.typeLabel}</span>
                  {v.brand ? <span className="text-zinc-500"> · {v.brand}</span> : null}
                  {v.model ? <span className="text-zinc-500"> {v.model}</span> : null}
                  {v.year ? <span className="text-zinc-400"> ({v.year})</span> : null}
                </td>
                <td className="font-mono text-sm font-semibold text-zinc-700">{v.number}</td>
                <td className="text-sm text-zinc-600">{v.color}</td>
                <td className="text-sm text-zinc-600">{v.capacity}</td>
                <td className="text-xs text-zinc-500">
                  {v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—'}
                </td>
                <td>
                  <Badge variant={STATUS_VARIANT[v.status] || 'neutral'}>
                    {STATUS_LABEL[v.status] || v.status}
                  </Badge>
                  {v.status === 'rejected' && v.rejectionReason && (
                    <p className="text-[11px] text-red-600 mt-1 max-w-[160px]">{v.rejectionReason}</p>
                  )}
                </td>
                <td>
                  {v.status === 'pending' && rejectingId !== v.id && (
                    <div className="flex gap-3">
                      <button
                        type="button"
                        disabled={!!actingId}
                        onClick={() => handleApprove(v.id)}
                        className="text-xs font-semibold text-green-700 hover:text-green-900 hover:underline disabled:opacity-40 whitespace-nowrap"
                      >
                        {actingId === v.id ? '…' : '✓ Approve'}
                      </button>
                      <button
                        type="button"
                        disabled={!!actingId}
                        onClick={() => { setRejectingId(v.id); setReason('') }}
                        className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline disabled:opacity-40"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  )}
                  {v.status === 'pending' && rejectingId === v.id && (
                    <div className="space-y-2 min-w-[180px]">
                      <input
                        type="text"
                        className="input-field text-xs"
                        placeholder="Reason for rejection"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!!actingId || !reason.trim()}
                          onClick={() => handleRejectSubmit(v.id)}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                        >
                          {actingId === v.id ? 'Submitting…' : 'Confirm'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setRejectingId(null); setReason('') }}
                          className="text-xs text-zinc-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                  {v.status !== 'pending' && (
                    <span className="text-xs text-zinc-300">—</span>
                  )}
                </td>
              </tr>
            ))}
          </DataTable>
        )}
      </FloatingPanel>
    </ImmersiveScreen>
  )
}