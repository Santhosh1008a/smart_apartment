import { useState, useEffect, useRef } from "react"
import { Bell, Check, Trash2, ShieldAlert, CreditCard, UserCheck, Info } from "lucide-react"
import { useAuthStore } from "../../store/useAuthStore"
import { useNotificationStore } from "../../store/useNotificationStore"
import { cn } from "../../utils/cn"
import { io } from "socket.io-client"

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)
  const { user } = useAuthStore()
  const { notifications, unreadCount, fetchNotifications, fetchUnreadCount, markAsRead, markAllAsRead, addRealtimeNotification } = useNotificationStore()

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Initial fetch and WebSocket connection
  useEffect(() => {
    if (!user) return

    fetchUnreadCount()

    // Setup Socket.IO for real-time notifications
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
      withCredentials: true,
    })

    socket.on("connect", () => {
      socket.emit("join_user_room", user.id)
      // Also join complex room for society-wide broadcasts (emergencies)
      if (user.complex_id) {
        socket.emit("join_complex_room", user.complex_id)
      }
    })

    socket.on("notification", (notification) => {
      addRealtimeNotification(notification)
    })

    return () => socket.disconnect()
  }, [user])

  // Fetch full list when dropdown opens
  useEffect(() => {
    if (isOpen) fetchNotifications()
  }, [isOpen])

  const getIcon = (type) => {
    switch (type) {
      case "emergency_alert": return <ShieldAlert className="w-5 h-5 text-red-500" />
      case "payment_reminder": return <CreditCard className="w-5 h-5 text-amber-500" />
      case "visitor_arrival": return <UserCheck className="w-5 h-5 text-emerald-500" />
      default: return <Info className="w-5 h-5 text-blue-500" />
    }
  }

  const getBg = (type) => {
    switch (type) {
      case "emergency_alert": return "bg-red-50 dark:bg-red-900/20"
      case "payment_reminder": return "bg-amber-50 dark:bg-amber-900/20"
      case "visitor_arrival": return "bg-emerald-50 dark:bg-emerald-900/20"
      default: return "bg-blue-50 dark:bg-blue-900/20"
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-gray-400 hover:text-foreground relative p-2 rounded-full hover:bg-secondary transition-colors"
      >
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-2 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-danger ring-2 ring-card"></span>
          </span>
        )}
        <Bell className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-card border border-border shadow-xl rounded-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-4 border-b border-border flex items-center justify-between bg-secondary/30">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <span className="text-xs bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 px-2 py-0.5 rounded-full font-bold">
                  {unreadCount} new
                </span>
              )}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-gray-500 hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <Check className="w-3.5 h-3.5" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Bell className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (!n.is_read) markAsRead(n.id)
                    }}
                    className={cn(
                      "p-4 flex gap-3 cursor-pointer transition-colors hover:bg-secondary/50",
                      !n.is_read ? getBg(n.type) : "opacity-75 grayscale-[30%]"
                    )}
                  >
                    <div className="mt-0.5 shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm mb-0.5 truncate", !n.is_read ? "font-bold text-foreground" : "font-medium text-gray-600 dark:text-gray-300")}>
                        {n.title}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">
                        {n.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-2 font-medium">
                        {new Date(n.created_at).toLocaleString()}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div className="shrink-0 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-violet-500 block"></span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
