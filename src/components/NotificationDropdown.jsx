import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../supabase"
import s from "./NotificationDropdown.module.css"

export default function NotificationDropdown({ userId }) {
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()

  const unreadCount = notifications.filter((n) => !n.read).length

  const load = async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20)
    if (data) setNotifications(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [userId])

  // Poll for new notifications every 60s
  useEffect(() => {
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [userId])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (!unreadIds.length) return
    await supabase.from("notifications").update({ read: true }).in("id", unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleClick = (notification) => {
    if (notification.invoice_id) {
      navigate(`/invoice/${notification.invoice_id}`)
    }
    setOpen(false)
    // Mark as read
    if (!notification.read) {
      supabase.from("notifications").update({ read: true }).eq("id", notification.id).then()
      setNotifications((prev) => prev.map((n) => n.id === notification.id ? { ...n, read: true } : n))
    }
  }

  const typeIcon = (type) => {
    switch (type) {
      case "bounce": return "⚠"
      case "complaint": return "🚫"
      case "opened": return "👁"
      case "clicked": return "🔗"
      case "delivered": return "✓"
      default: return "•"
    }
  }

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  }

  return (
    <div ref={ref} className={s.wrap}>
      <button
        onClick={() => { setOpen(!open); if (!open) load() }}
        className={s.bell}
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
      >
        🔔
        {unreadCount > 0 && <span className={s.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className={s.dropdown}>
          <div className={s.dropdownHeader}>
            <span className={s.dropdownTitle}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className={s.markRead}>Mark all read</button>
            )}
          </div>

          {loading && notifications.length === 0 ? (
            <div className={s.empty}>Loading...</div>
          ) : notifications.length === 0 ? (
            <div className={s.empty}>No notifications yet</div>
          ) : (
            <div className={s.list}>
              {notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={s.item}
                  data-unread={!n.read ? "true" : undefined}
                >
                  <span className={s.icon}>{typeIcon(n.type)}</span>
                  <div className={s.itemContent}>
                    <div className={s.itemTitle}>{n.title}</div>
                    {n.body && <div className={s.itemBody}>{n.body}</div>}
                    <div className={s.itemTime}>{timeAgo(n.created_at)}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
