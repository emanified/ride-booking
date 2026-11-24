import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStats, getAdminVehicles } from '../../api'
import AsymmetricWorkspace, { GlassHud, InspectorModule } from '../../components/shell/AsymmetricWorkspace'
import { MetricRingCard } from '../../components/dashboard/primitives'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [pendingVehicles, setPendingVehicles] = useState(0)
  const [loading, setLoading] = useState(true)
  const [focus, setFocus] = useState('network')

  useEffect(() => {
    Promise.all([
      getStats().then((r) => setStats(r.data)),
      getAdminVehicles('pending').then((r) => setPendingVehicles((r.data.vehicles || []).length)),
    ]).finally(() => setLoading(false))
  }, [])

  const modules = [
    { id: 'users', label: 'Users', path: '/admin/users', desc: 'Governance & roles', badge: null },
    { id: 'trips', label: 'Trips', path: '/admin/trips', desc: 'Live operations', badge: null },
    { id: 'vehicles', label: 'Vehicles', path: '/admin/vehicles', desc: 'Driver approvals', badge: pendingVehicles > 0 ? pendingVehicles : null },
    { id: 'payments', label: 'Payments', path: '/admin/payments', desc: 'Financial audit', badge: null },
  ]

  return (
    <AsymmetricWorkspace
      wide
      mapLabel="Global network telemetry"
      mapOverlay={
        <GlassHud position="bottom-left">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full min-w-[280px]">
            {loading ? (
              [...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-white/10 rounded-lg animate-pulse" />
              ))
            ) : (
              <>
                <HudStat label="Passengers" value={stats.total_passengers} />
                <HudStat label="Drivers" value={stats.total_drivers} />
                <HudStat label="Active" value={stats.active_trips} highlight />
                <HudStat label="Revenue" value={`Rs. ${Number(stats.total_revenue).toFixed(0)}`} />
              </>
            )}
          </div>
        </GlassHud>
      }
      inspector={
        <>
          <InspectorModule title="Platform pulse" subtitle={loading ? 'Syncing…' : 'Real-time'} className="shrink-0 lg:col-span-2">
            <div className="grid grid-cols-2 gap-2">
              {loading ? (
                <>
                  <MetricRingCard loading />
                  <MetricRingCard loading />
                </>
              ) : (
                <>
                  <MetricRingCard
                    label="Live trips"
                    value={stats.active_trips}
                    progress={stats.active_trips ? 75 : 10}
                    onClick={() => setFocus('trips')}
                  />
                  <MetricRingCard
                    label="Revenue"
                    value={`Rs. ${Number(stats.total_revenue).toFixed(0)}`}
                    progress={88}
                    trendUp
                    trend="Settled"
                    onClick={() => setFocus('revenue')}
                  />
                </>
              )}
            </div>
          </InspectorModule>

          <InspectorModule title="Control modules" subtitle="Drill-down access" className="flex-1">
            <div className="space-y-2">
              {modules.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setFocus(m.id)
                    navigate(m.path)
                  }}
                  className={`
                    w-full text-left p-4 rounded-xl border transition-all duration-300 relative
                    hover:scale-[1.01] hover:shadow-lg
                    ${focus === m.id
                      ? 'bg-yellow-50 border-yellow-400/50'
                      : 'bg-white/60 border-zinc-200/80'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-zinc-900">{m.label}</p>
                    {m.badge !== null && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">{m.desc}</p>
                </button>
              ))}
            </div>
          </InspectorModule>

          <InspectorModule
            title="Network summary"
            subtitle={`${stats?.completed_trips ?? 0} completed trips`}
            footer={
              <button type="button" onClick={() => navigate('/admin/trips')} className="btn-primary w-full">
                Open trip explorer
              </button>
            }
          >
            {!loading && stats && (
              <dl className="space-y-2 text-sm text-zinc-600">
                <div className="flex justify-between">
                  <dt>Passengers</dt>
                  <dd className="font-bold text-zinc-900">{stats.total_passengers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Drivers</dt>
                  <dd className="font-bold text-zinc-900">{stats.total_drivers}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Completed</dt>
                  <dd className="font-bold text-zinc-900">{stats.completed_trips}</dd>
                </div>
                {pendingVehicles > 0 && (
                  <div className="flex justify-between items-center pt-2 border-t border-zinc-200/60">
                    <dt className="text-amber-700 font-medium">Pending approvals</dt>
                    <dd className="font-bold text-amber-600">{pendingVehicles}</dd>
                  </div>
                )}
              </dl>
            )}
          </InspectorModule>
        </>
      }
    />
  )
}

function HudStat({ label, value, highlight }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p>
      <p className={`text-lg font-bold ${highlight ? 'text-yellow-400' : 'text-white'}`}>{value}</p>
    </div>
  )
}