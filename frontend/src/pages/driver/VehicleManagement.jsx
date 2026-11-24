import { useEffect, useState } from 'react'
import { createDriverVehicle, deleteDriverVehicle, getDriverVehicle, updateDriverVehicle } from '../../api'
import { PageHeader, Badge } from '../../components/ui'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'
import { VEHICLE_TYPES } from '../../utils/fareCalculator'

const STATUS_VARIANT = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

const EMPTY_FORM = {
  type: VEHICLE_TYPES[0].value,
  brand: '',
  model: '',
  year: '',
  number: '',
  color: '',
  capacity: '',
}

export default function VehicleManagement() {
  const [vehicle, setVehicle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = () => {
    setLoading(true)
    getDriverVehicle()
      .then((res) => {
        const v = res.data.vehicle
        setVehicle(v)
        if (!v) {
          setEditing(true)
          setForm(EMPTY_FORM)
        }
      })
      .catch(() => setError('Could not load vehicle details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const startEdit = () => {
    if (vehicle) {
      setForm({
        type: vehicle.type,
        brand: vehicle.brand || '',
        model: vehicle.model || '',
        year: vehicle.year || '',
        number: vehicle.number || '',
        color: vehicle.color || '',
        capacity: vehicle.capacity || '',
      })
    }
    setFieldErrors({})
    setError('')
    setSuccess('')
    setEditing(true)
  }

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    setFieldErrors({})

    const payload = {
      type: form.type,
      brand: form.brand,
      model: form.model,
      number: form.number,
      color: form.color,
      capacity: form.capacity,
    }
    if (form.year) payload.year = form.year

    try {
      const res = vehicle
        ? await updateDriverVehicle(vehicle.id, payload)
        : await createDriverVehicle(payload)
      setVehicle(res.data.vehicle)
      setEditing(false)
      setSuccess(vehicle ? 'Vehicle updated and resubmitted for approval.' : 'Vehicle submitted for approval.')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not save vehicle details.')
      setFieldErrors(err.response?.data?.fields || {})
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!vehicle) return
    setDeleting(true)
    setError('')
    try {
      await deleteDriverVehicle(vehicle.id)
      setVehicle(null)
      setEditing(true)
      setForm(EMPTY_FORM)
      setSuccess('Vehicle removed.')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not delete vehicle.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <ImmersiveScreen mapLabel="My vehicle">
      <FloatingPanel width="md">
        <PageHeader title="My vehicle" subtitle="Manage your vehicle details and approval status" />

        {loading ? (
          <p className="text-zinc-500">Loading...</p>
        ) : (
          <>
            {error && <div className="alert-error mb-4">{error}</div>}
            {success && <div className="alert-success mb-4">{success}</div>}

          {vehicle && !editing && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <Badge variant={STATUS_VARIANT[vehicle.status] || 'neutral'}>
                  {STATUS_LABEL[vehicle.status] || vehicle.status}
                </Badge>
                <span className="text-xs text-zinc-500">
                  Submitted {vehicle.createdAt ? new Date(vehicle.createdAt).toLocaleDateString() : '—'}
                </span>
              </div>

              {vehicle.status === 'rejected' && vehicle.rejectionReason && (
                <div className="alert-error mb-4">
                  <span className="font-semibold">Rejection reason:</span> {vehicle.rejectionReason}
                </div>
              )}

              <div className="glass-panel p-4 mb-4 space-y-1 text-sm text-zinc-600">
                <p><span className="font-semibold text-zinc-800">Type:</span> {vehicle.typeLabel}</p>
                {vehicle.brand && <p><span className="font-semibold text-zinc-800">Brand:</span> {vehicle.brand}</p>}
                <p><span className="font-semibold text-zinc-800">Model:</span> {vehicle.model}</p>
                {vehicle.year && <p><span className="font-semibold text-zinc-800">Year:</span> {vehicle.year}</p>}
                <p><span className="font-semibold text-zinc-800">Number:</span> {vehicle.number}</p>
                <p><span className="font-semibold text-zinc-800">Color:</span> {vehicle.color}</p>
                <p><span className="font-semibold text-zinc-800">Capacity:</span> {vehicle.capacity}</p>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={startEdit} className="btn-secondary flex-1">
                  {vehicle.status === 'rejected' ? 'Edit & resubmit' : 'Edit vehicle'}
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="btn-secondary btn-danger"
                >
                  {deleting ? 'Removing...' : 'Delete'}
                </button>
              </div>
            </div>
          )}

          {editing && (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-2">Vehicle type</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {VEHICLE_TYPES.map((v) => {
                    const selected = form.type === v.value
                    return (
                      <button
                        key={v.value}
                        type="button"
                        onClick={() => setForm({ ...form, type: v.value })}
                        className={`p-3 text-center rounded-2xl transition-all duration-300 ${
                          selected
                            ? 'bg-yellow-400 border border-white/40 shadow-md shadow-yellow-500/30 scale-105'
                            : 'glass-panel hover:scale-105'
                        }`}
                      >
                        <p className="text-sm font-semibold text-zinc-900">{v.label}</p>
                      </button>
                    )
                  })}
                </div>
                {fieldErrors.type && <p className="text-xs text-red-600 mt-1">{fieldErrors.type}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Brand</label>
                  <input type="text" name="brand" className="input-field" value={form.brand} onChange={handleChange} placeholder="Toyota" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Model</label>
                  <input type="text" name="model" required className="input-field" value={form.model} onChange={handleChange} placeholder="Corolla" />
                  {fieldErrors.model && <p className="text-xs text-red-600 mt-1">{fieldErrors.model}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Year</label>
                  <input type="number" name="year" className="input-field" value={form.year} onChange={handleChange} placeholder="2020" />
                  {fieldErrors.year && <p className="text-xs text-red-600 mt-1">{fieldErrors.year}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Capacity</label>
                  <input type="number" name="capacity" required min="1" className="input-field" value={form.capacity} onChange={handleChange} placeholder="4" />
                  {fieldErrors.capacity && <p className="text-xs text-red-600 mt-1">{fieldErrors.capacity}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Vehicle number</label>
                  <input type="text" name="number" required className="input-field" value={form.number} onChange={handleChange} placeholder="ABC-123" />
                  {fieldErrors.number && <p className="text-xs text-red-600 mt-1">{fieldErrors.number}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Color</label>
                  <input type="text" name="color" required className="input-field" value={form.color} onChange={handleChange} placeholder="White" />
                  {fieldErrors.color && <p className="text-xs text-red-600 mt-1">{fieldErrors.color}</p>}
                </div>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? 'Saving...' : vehicle ? 'Save & resubmit' : 'Submit vehicle'}
                </button>
                {vehicle && (
                  <button type="button" className="btn-secondary" onClick={() => { setEditing(false); setError(''); setFieldErrors({}) }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          )}
          </>
        )}
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
