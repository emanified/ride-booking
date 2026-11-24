import { Fragment, useEffect, useState } from 'react'
import { ImmersiveMapCanvas } from '../shell/AsymmetricWorkspace'

export function PageHeader({ title, subtitle, action }) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function GlassCard({ children, className = '' }) {
  return (
    <div className={`panel-enter glass-panel p-6 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 ${className}`}>
      {children}
    </div>
  )
}

export function StatCard({ label, value, accent }) {
  return (
    <div className="panel-enter glass-panel-strong p-6 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">{label}</span>
      <p className={`text-3xl font-bold mt-2 ${accent || 'text-zinc-800'}`}>{value}</p>
    </div>
  )
}

export function Badge({ variant = 'neutral', children }) {
  return <span className={`badge badge-${variant}`}>{children}</span>
}

export function DataTable({ columns, children, empty }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children)
  if (empty && !hasRows) {
    return <p className="text-sm text-zinc-500 py-4">{empty}</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="glass-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col}>{col}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function formatSeenTime(isoString) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function EyeIcon({ className = 'w-3 h-3' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ChatBubbleIcon({ className = 'w-4 h-4' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
    </svg>
  )
}

// Opens the chat dialog. Solid background (not glass) so it stays readable
// over the map, plus an unread-count badge in the top-right corner.
export function ChatButton({ label, unreadCount = 0, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full flex items-center justify-center gap-2 rounded-xl bg-white border border-zinc-200 shadow-md px-4 py-2.5 text-sm font-semibold text-zinc-900 transition-all duration-200 hover:bg-zinc-50 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] ${className}`}
    >
      <ChatBubbleIcon />
      {label}
      {unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[11px] font-bold shadow">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

export function ChatDialog({ open, onClose, title, messages, value, onChange, onSend, messagesEndRef, unreadIds }) {
  if (!open) return null
  const dividerBeforeId = unreadIds && unreadIds.size > 0
    ? messages?.find((m) => unreadIds.has(m.messageId))?.messageId
    : null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-[fade-slide-in_0.2s_ease]" onClick={onClose} />
      <div className="panel-enter relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 shrink-0">
          <h3 className="text-sm font-bold text-zinc-900 truncate">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:rotate-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px]">
          {(!messages || messages.length === 0) && <p className="text-sm text-zinc-400">No messages yet.</p>}
          {messages?.map((m, i) => (
            <Fragment key={m.messageId ?? i}>
              {dividerBeforeId != null && m.messageId === dividerBeforeId && (
                <div className="flex items-center gap-2 py-1">
                  <div className="flex-1 h-px bg-red-200" />
                  <span className="text-[10px] uppercase tracking-wider text-red-500 font-semibold">Recent texts</span>
                  <div className="flex-1 h-px bg-red-200" />
                </div>
              )}
              <div className="glass-panel p-2 text-sm">
                <div className="text-xs text-zinc-500">{m.createdAt}</div>
                <div className="font-medium">{m.senderRole}</div>
                <div className="text-zinc-600 text-xs">{m.message}</div>
                {m.isRead && (
                  <div className="flex items-center gap-1 mt-1 text-zinc-400">
                    <EyeIcon />
                    {m.readAt && <span className="text-[10px]">Seen at {formatSeenTime(m.readAt)}</span>}
                  </div>
                )}
              </div>
            </Fragment>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-200 shrink-0">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSend()
              }
            }}
            className="input-field flex-1"
            placeholder="Type a message"
          />
          <button type="button" onClick={onSend} className="btn-primary btn-sm">Send</button>
        </div>
      </div>
    </div>
  )
}

const CANCEL_REASONS = [
  'Driver is taking too long',
  'Wrong pickup or dropoff location',
  'Price is too high',
  'Found another ride',
  'Changed my mind',
  'Other',
]

export function CancelRideDialog({ open, onClose, onConfirm, confirming }) {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 animate-[fade-slide-in_0.2s_ease]" onClick={onClose} />
      <div className="panel-enter relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 shrink-0">
          <h3 className="text-sm font-bold text-zinc-900">Why are you cancelling?</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-full text-zinc-500 transition-all duration-200 hover:bg-zinc-100 hover:rotate-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="w-4 h-4">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {CANCEL_REASONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setReason(option)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all duration-200 ${
                reason === option ? 'border-yellow-500 bg-yellow-50 text-zinc-900 font-medium' : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:border-yellow-300 hover:translate-x-0.5'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="flex gap-2 px-4 py-3 border-t border-zinc-200 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">Keep ride</button>
          <button
            type="button"
            onClick={() => onConfirm(reason)}
            disabled={!reason || confirming}
            className="btn-secondary btn-danger flex-1"
          >
            {confirming ? 'Cancelling...' : 'Confirm cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function AuthLayout({ children, label = 'RideBook' }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <ImmersiveMapCanvas label={label} />
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="panel-enter w-full max-w-md bg-white/90 backdrop-blur-xl border border-white/70 rounded-2xl shadow-xl p-8 space-y-6">
          {children}
        </div>
      </div>
    </div>
  )
}