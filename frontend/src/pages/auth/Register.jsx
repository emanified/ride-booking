import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../../api'
import { AuthLayout } from '../../components/ui'
import { VEHICLE_TYPES, DEFAULT_VEHICLE_TYPE } from '../../utils/fareCalculator'

export default function Register() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'passenger',
    license_number: '',
    vehicle_model: '',
    vehicle_plate: '',
    vehicle_type: DEFAULT_VEHICLE_TYPE,
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const payload = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      role: formData.role,
    }

    if (formData.role === 'driver') {
      payload.license_number = formData.license_number
      payload.vehicle_model = formData.vehicle_model
      payload.vehicle_plate = formData.vehicle_plate
      payload.vehicle_type = formData.vehicle_type
    }

    try {
      const res = await register(payload)
      setSuccess(res.data.message || 'Registered successfully!')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout label="Create account">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-yellow-600 font-semibold">RideBook</p>
        <h2 className="text-2xl font-bold text-zinc-900 mt-2">Create account</h2>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {success && <div className="alert-success">{success}</div>}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Full name</label>
          <input type="text" name="name" required className="input-field" onChange={handleChange} value={formData.name} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input type="email" name="email" required className="input-field" onChange={handleChange} value={formData.email} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
          <input type="password" name="password" required className="input-field" onChange={handleChange} value={formData.password} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Phone</label>
          <input type="text" name="phone" required className="input-field" placeholder="+1234567890" onChange={handleChange} value={formData.phone} />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Register as</label>
          <select name="role" className="input-field" onChange={handleChange} value={formData.role}>
            <option value="passenger">Passenger</option>
            <option value="driver">Driver</option>
          </select>
        </div>

        {formData.role === 'driver' && (
          <div className="glass-panel p-4 space-y-3">
            <h3 className="text-sm font-semibold text-zinc-800">Vehicle details</h3>
            <input type="text" name="license_number" required placeholder="License number" className="input-field" onChange={handleChange} value={formData.license_number} />
            <input type="text" name="vehicle_model" required placeholder="Vehicle model" className="input-field" onChange={handleChange} value={formData.vehicle_model} />
            <input type="text" name="vehicle_plate" required placeholder="License plate" className="input-field" onChange={handleChange} value={formData.vehicle_plate} />
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">Vehicle category</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {VEHICLE_TYPES.map((v) => {
                  const selected = formData.vehicle_type === v.value
                  return (
                    <button
                      key={v.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, vehicle_type: v.value })}
                      className={`p-3 text-center rounded-2xl transition-all duration-300 ${
                        selected
                          ? 'bg-yellow-400 border border-white/40 shadow-md shadow-yellow-500/30 scale-105'
                          : 'glass-panel hover:scale-105'
                      }`}
                    >
                      <p className="text-sm font-semibold text-zinc-900">{v.label}</p>
                      <p className={`text-[11px] mt-0.5 ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>Rs. {v.baseFare} base</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Creating account...' : 'Sign up'}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        Have an account? <Link to="/login" className="link-accent">Sign in</Link>
      </p>
    </AuthLayout>
  )
}
