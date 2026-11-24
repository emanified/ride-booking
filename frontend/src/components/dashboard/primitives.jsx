import { useState } from 'react'

export function DashboardChrome({ eyebrow, title, description, actions, tabs }) {
  return (
    <header className="sticky top-0 z-30 -mx-6 lg:-mx-8 px-6 lg:px-8 py-4 bg-zinc-100/80 backdrop-blur-xl border-b border-white/60">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-yellow-600">{eyebrow}</p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 mt-0.5">{title}</h1>
          {description && <p className="text-sm text-zinc-500 mt-1 max-w-xl">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {tabs && <div className="mt-4 flex gap-1">{tabs}</div>}
    </header>
  )
}

export function SplitViewport({ main, inspector, inspectorOpen }) {
  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 gap-4 lg:gap-0 relative h-full">
      <div className="flex-1 min-w-0 min-h-[280px] lg:min-h-0 transition-all duration-300">
        {main}
      </div>
      <aside
        className={`
          shrink-0 overflow-hidden transition-all duration-300 ease-out
          ${inspectorOpen
            ? 'w-full lg:w-[380px] max-h-[50vh] lg:max-h-none opacity-100'
            : 'h-0 lg:h-auto w-full lg:w-0 opacity-0 pointer-events-none overflow-hidden'
          }
        `}
      >
        {inspector}
      </aside>
    </div>
  )
}

export function MapCanvas({ children, overlay, label = 'Live map' }) {
  return (
    <div className="relative h-full min-h-[320px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-white/70 bg-gradient-to-br from-zinc-200/80 via-zinc-100/60 to-yellow-50/40 shadow-inner">
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: `
            linear-gradient(rgba(24,24,27,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(24,24,27,0.04) 1px, transparent 1px)
          `,
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 pointer-events-none">
        <div className="w-16 h-16 rounded-full bg-yellow-400/20 border-2 border-yellow-400/40 flex items-center justify-center mb-3 animate-pulse">
          <span className="text-2xl">◎</span>
        </div>
        <p className="text-sm font-semibold text-zinc-600">{label}</p>
        <p className="text-xs text-zinc-400 mt-1">Simulated geospatial viewport</p>
      </div>
      {overlay}
      {children}
    </div>
  )
}

export function ActionSheet({ children, className = '' }) {
  return (
    <div
      className={`
        absolute z-20 right-4 top-4 bottom-4 w-[min(100%,300px)]
        bg-white/80 backdrop-blur-xl rounded-2xl border border-white/90
        shadow-[0_20px_60px_-12px_rgba(24,24,27,0.18)]
        p-5 flex flex-col gap-4 overflow-y-auto
        hover:shadow-[0_24px_70px_-12px_rgba(234,179,8,0.15)] transition-all duration-300
        ${className}
      `}
    >
      {children}
    </div>
  )
}

export function MetricRingCard({ label, value, sub, trend, trendUp, progress = 65, loading, onClick }) {
  const Tag = onClick ? 'button' : 'div'
  if (loading) {
    return (
      <div className="bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 p-5 animate-pulse">
        <div className="h-3 w-20 bg-zinc-200 rounded mb-4" />
        <div className="h-10 w-24 bg-zinc-200 rounded" />
      </div>
    )
  }

  const dash = `${(Math.min(100, progress) / 100) * 97} 97`

  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="group w-full text-left bg-white/70 backdrop-blur-md rounded-2xl border border-white/80 p-5 hover:scale-[1.01] hover:border-yellow-300/50 transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
          <p className="text-2xl font-bold text-zinc-900 mt-1 tracking-tight">{value}</p>
          {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
          {trend != null && (
            <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${trendUp ? 'text-emerald-600' : 'text-zinc-500'}`}>
              <span>{trendUp ? '↑' : '→'}</span> {trend}
            </p>
          )}
        </div>
        <div className="relative shrink-0 w-14 h-14">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#e4e4e7" strokeWidth="2.5" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#eab308"
              strokeWidth="2.5"
              strokeDasharray={dash}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-yellow-700">
            ●
          </span>
        </div>
      </div>
    </Tag>
  )
}

export function VerticalTimeline({ steps, activeIndex = 0 }) {
  return (
    <ol className="relative space-y-0">
      {steps.map((step, i) => {
        const done = i < activeIndex
        const active = i === activeIndex
        return (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={`absolute left-[11px] top-7 w-0.5 h-[calc(100%-12px)] ${done ? 'bg-yellow-400' : 'bg-zinc-200'}`}
              />
            )}
            <span
              className={`
                relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                transition-all duration-300
                ${done ? 'bg-yellow-400 text-zinc-900' : active ? 'bg-zinc-900 text-yellow-400 ring-4 ring-yellow-400/30' : 'bg-zinc-200 text-zinc-500'}
              `}
            >
              {done ? '✓' : i + 1}
            </span>
            <div className={`pt-0.5 ${active ? 'opacity-100' : 'opacity-60'}`}>
              <p className={`text-sm font-semibold ${active ? 'text-zinc-900' : 'text-zinc-600'}`}>{step.title}</p>
              {step.desc && <p className="text-xs text-zinc-500 mt-0.5">{step.desc}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

export function TripCard({ trip, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-full text-left p-4 rounded-2xl border transition-all duration-300
        hover:scale-[1.01] hover:shadow-lg
        ${selected
          ? 'bg-yellow-50/90 border-yellow-400/60 shadow-md ring-2 ring-yellow-400/20'
          : 'bg-white/75 backdrop-blur-sm border-white/90 hover:border-yellow-200/80'
        }
      `}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[11px] font-mono font-bold text-yellow-700">#{trip.trip_id}</span>
        <StatusPill status={trip.status} />
      </div>
      <p className="text-sm font-semibold text-zinc-800 mt-2 truncate">
        {trip.pickup} → {trip.dropoff}
      </p>
      <div className="flex justify-between items-center mt-3 text-xs text-zinc-500">
        <span>{trip.date ? new Date(trip.date).toLocaleDateString() : 'Recent'}</span>
        <span className="font-bold text-zinc-900">Rs. {Number(trip.fare).toFixed(2)}</span>
      </div>
    </button>
  )
}

export function StatusPill({ status }) {
  const styles = {
    completed: 'bg-emerald-500/15 text-emerald-700 border-emerald-200',
    requested: 'bg-yellow-400/20 text-yellow-800 border-yellow-300',
    pending_driver: 'bg-yellow-400/20 text-yellow-800 border-yellow-300',
    assigned: 'bg-sky-500/15 text-sky-700 border-sky-200',
    accepted: 'bg-sky-500/15 text-sky-700 border-sky-200',
    driver_arriving: 'bg-amber-500/15 text-amber-700 border-amber-200',
    arrived: 'bg-amber-500/15 text-amber-700 border-amber-200',
    started: 'bg-violet-500/15 text-violet-700 border-violet-200',
    in_progress: 'bg-violet-500/15 text-violet-700 border-violet-200',
    cancelled: 'bg-red-500/10 text-red-700 border-red-200',
  }
  const s = styles[status] || 'bg-zinc-100 text-zinc-600 border-zinc-200'
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${s}`}>
      {status}
    </span>
  )
}

export function SideInspector({ title, subtitle, onClose, children, footer }) {
  return (
    <div className="h-full flex flex-col bg-white/85 backdrop-blur-xl border-l border-white/80 shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.08)]">
      <div className="p-5 border-b border-zinc-100/80 flex justify-between items-start gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-yellow-600 font-semibold">Inspector</p>
          <h2 className="text-lg font-bold text-zinc-900 mt-0.5">{title}</h2>
          {subtitle && <p className="text-xs text-zinc-500 mt-1">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-600 text-sm transition-colors"
          aria-label="Close"
        >
          ×
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5">{children}</div>
      {footer && <div className="p-5 border-t border-zinc-100/80 bg-zinc-50/50">{footer}</div>}
    </div>
  )
}

export function AccordionSection({ title, count, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl border border-white/80 bg-white/60 backdrop-blur-md overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/50 transition-colors"
      >
        <span className="font-semibold text-zinc-900">{title}</span>
        <span className="flex items-center gap-2">
          {count != null && (
            <span className="text-xs font-bold bg-zinc-900 text-yellow-400 px-2 py-0.5 rounded-full">{count}</span>
          )}
          <span className={`text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>▼</span>
        </span>
      </button>
      <div
        className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-0 border-t border-zinc-100/60">{children}</div>
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 rounded-2xl bg-zinc-200/60 animate-pulse" />
      ))}
    </div>
  )
}

export function EmptyInspector() {
  return (
    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400">
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 flex items-center justify-center text-2xl mb-3">◇</div>
      <p className="text-sm font-medium text-zinc-500">Select an item to inspect details</p>
    </div>
  )
}