import { useEffect, useState } from 'react'
import { getNotifications, markNotificationRead } from '../api'
import { ImmersiveScreen, FloatingPanel } from '../components/shell/AsymmetricWorkspace'

export default function NotificationsPage() {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await getNotifications()
        if (!cancelled) setNotes(res.data.notifications || [])
      } catch (_) {}
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const markRead = async (id) => {
    try {
      await markNotificationRead(id)
      setNotes((n) => n.map((x) => (x.id === id ? { ...x, isRead: true } : x)))
    } catch (_) {}
  }

  return (
    <ImmersiveScreen mapLabel="Notifications">
      <FloatingPanel width="md">
        <h2 className="page-title mb-4">Notifications</h2>
        {loading && <p className="text-zinc-500">Loading…</p>}
        {!loading && notes.length === 0 && <p className="text-zinc-500">No notifications.</p>}
        <div className="space-y-2">
          {notes.map((n) => (
            <div key={n.id} className={`glass-panel p-3 text-sm transition-opacity duration-300 ${n.isRead ? 'opacity-60' : ''}`}>
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-zinc-500">{n.createdAt}</div>
                  <div className="text-zinc-700 text-xs mt-1">{n.message}</div>
                </div>
                {!n.isRead && (
                  <button onClick={() => markRead(n.id)} className="btn-secondary btn-sm shrink-0">Mark read</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </FloatingPanel>
    </ImmersiveScreen>
  )
}
