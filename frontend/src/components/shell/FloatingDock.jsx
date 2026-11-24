import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function FloatingDock({ items, homePath }) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()

  return (
    <nav
      className="panel-enter fixed bottom-5 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 p-1.5 rounded-2xl bg-white/80 backdrop-blur-2xl border border-white/30 shadow-2xl shadow-black/15 pointer-events-auto"
      aria-label="Main navigation"
    >
      {/* Homepage button */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-zinc-500 transition-all duration-200 hover:bg-zinc-900 hover:text-yellow-400 hover:scale-105 active:scale-95"
        title="Go to homepage"
      >
        <span className="text-base leading-none">⌂</span>
        <span className="hidden sm:inline">Home</span>
      </button>

      <span className="w-px h-5 bg-zinc-200" />

      {items.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to.endsWith('/dashboard')}
          className={({ isActive }) =>
            `flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-95 ${
              isActive
                ? 'bg-zinc-900 text-yellow-400 shadow-lg'
                : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 hover:scale-105'
            }`
          }
        >
          <span className="text-base leading-none">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </NavLink>
      ))}

      <span className="w-px h-5 bg-zinc-200" />

      {user && (
        <span className="hidden md:inline px-2 text-xs text-zinc-500 max-w-[90px] truncate font-medium">
          {user.name || user.email?.split('@')[0]}
        </span>
      )}

      <button
        type="button"
        onClick={() => {
          logout()
          navigate('/')
        }}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-zinc-500 transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:scale-105 active:scale-95"
        title="Sign out"
      >
        <span className="text-base leading-none">↩</span>
        <span className="hidden sm:inline">Sign out</span>
      </button>
    </nav>
  )
}