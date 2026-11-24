import { useState } from 'react'
import { Navigate, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { getDashboardPath } from '../../utils/auth'
import { AuthLayout } from '../../components/ui'

export default function Login() {
  const { user, loading: authLoading, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  if (authLoading) return <div className="loading-screen">Loading...</div>
  if (user) return <Navigate to={getDashboardPath(user.role)} replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    if (result.success) {
      navigate(getDashboardPath(result.role))
    } else {
      setError(result.message || 'Invalid email or password.')
    }
    setLoading(false)
  }

  return (
    <AuthLayout label="Sign in">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-yellow-600 font-semibold">RideBook</p>
        <h2 className="text-2xl font-bold text-zinc-900 mt-2">Welcome back</h2>
        <p className="text-sm text-zinc-500 mt-1">Sign in to your account</p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
          <input
            type="email"
            required
            disabled={loading}
            className="input-field"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
          <input
            type="password"
            required
            disabled={loading}
            className="input-field"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500">
        No account?{' '}
        <Link to="/register" className="link-accent">Create one</Link>
      </p>
    </AuthLayout>
  )
}
