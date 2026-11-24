import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getDashboardPath } from '../utils/auth'
import heroPreview from '../assets/abc.jpg'

export default function Home() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (loading) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center bg-white text-black">
        Loading…
      </div>
    )
  }

  const fade = {
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: 'all 0.8s ease-out',
  }

  return (
    <div className="min-h-[100svh] bg-white text-black overflow-hidden">

      {/* soft Apple-like background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.04),transparent_40%)]" />

      {/* NAV */}
      <header className="relative z-10 flex items-center justify-between px-6 lg:px-16 py-6">
        <div className="text-xl font-semibold tracking-tight">
          RideBook
        </div>

        <div className="flex items-center gap-6 text-sm">
          {user ? (
            <>
              <span className="text-gray-500 hidden sm:block">
                {user.name || user.email}
              </span>

              <Link
                to={getDashboardPath(user.role)}
                className="px-4 py-2 rounded-full bg-black text-white hover:opacity-80 transition"
              >
                Dashboard
              </Link>

              <button
                onClick={() => {
                  logout()
                  navigate('/')
                }}
                className="text-gray-500 hover:text-black transition"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="text-gray-600 hover:text-black" to="/login">
                Sign in
              </Link>

              <Link
                className="px-4 py-2 rounded-full bg-black text-white hover:opacity-80 transition"
                to="/register"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </header>

      {/* HERO */}
      <section className="relative px-6 lg:px-16 pt-24 pb-20 max-w-6xl mx-auto">
        <div className="text-center" style={fade}>

          <p className="text-sm text-gray-500 tracking-wide">
            Urban mobility reimagined
          </p>

          <h1 className="mt-4 text-5xl sm:text-6xl font-semibold tracking-tight leading-tight">
            RideBook is the
            <br />
            simplest way to move
            <span className="block text-gray-400">through the city.</span>
          </h1>

          <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
            A clean, fast, and intelligent ride experience for passengers and drivers.
            Built for clarity, speed, and trust.
          </p>

          {!user && (
            <div className="mt-10 flex justify-center gap-4">
              <Link
                to="/register"
                className="px-6 py-3 rounded-full bg-black text-white hover:opacity-80 transition"
              >
                Create account
              </Link>

              <Link
                to="/login"
                className="px-6 py-3 rounded-full border border-gray-300 hover:border-black transition"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>

        {/* IMAGE SECTION (Apple-style focus block) */}
        <div className="mt-20 flex justify-center" style={fade}>
          <div className="relative w-full max-w-4xl">

            {/* subtle shadow frame */}
            <div className="absolute inset-0 bg-black/5 blur-3xl rounded-3xl scale-95" />

            <div className="relative rounded-3xl overflow-hidden border border-gray-200 shadow-2xl">
              <img
                src={heroPreview}
                alt="RideBook preview"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES (Apple-style minimal cards) */}
      <section className="px-6 lg:px-16 pb-24 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-10 text-center">

          <div>
            <h3 className="text-lg font-semibold">Fast Booking</h3>
            <p className="text-gray-500 mt-2 text-sm">
              Book a ride in seconds with instant pricing.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Live Tracking</h3>
            <p className="text-gray-500 mt-2 text-sm">
              Track your driver in real time with precision.
            </p>
          </div>

          <div>
            <h3 className="text-lg font-semibold">Secure Payments</h3>
            <p className="text-gray-500 mt-2 text-sm">
              Safe, fast, and transparent transactions.
            </p>
          </div>

        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-gray-100 py-10 text-center text-xs text-gray-400">
        © 2026 RideBook. All rights reserved.
      </footer>
    </div>
  )
}