import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { rateDriver } from '../../api'
import { ImmersiveScreen, FloatingPanel } from '../../components/shell/AsymmetricWorkspace'

export default function RateDriver() {
  const { tripId } = useParams()
  const navigate = useNavigate()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      await rateDriver(tripId, { rating, comment })
      navigate('/passenger/dashboard')
    } catch (err) {
      setError(err.response?.data?.error || 'Could not submit rating.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ImmersiveScreen mapLabel="Rate your trip">
      <FloatingPanel width="sm" className="text-center">
        <p className="text-xs uppercase tracking-wider text-yellow-600 font-semibold">Rate your trip</p>
        <h1 className="text-2xl font-bold text-zinc-900 mt-2">How was your ride?</h1>
        <p className="text-sm text-zinc-500 mt-1">Trip #{tripId}</p>
        {error && <div className="alert-error mt-4">{error}</div>}
        <div className="flex justify-center gap-2 my-6">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-3xl transition-transform duration-200 ${star <= rating ? 'text-yellow-500 scale-110' : 'text-zinc-300'}`}
            >
              ★
            </button>
          ))}
        </div>
        <textarea
          className="input-field"
          rows="3"
          placeholder="Optional feedback..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <button type="button" onClick={handleSubmit} disabled={loading} className="btn-primary w-full mt-4">
          {loading ? 'Submitting...' : 'Submit & finish'}
        </button>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
