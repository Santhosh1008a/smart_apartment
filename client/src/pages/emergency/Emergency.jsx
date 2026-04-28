import { useState, useEffect, useRef } from "react"
import { AlertTriangle, Flame, HeartPulse, ShieldAlert, PhoneCall, Loader2, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { triggerEmergency, listEmergencies, resolveEmergency } from "../../api/services"
import { useAuthStore } from "../../store/useAuthStore"
import { io } from "socket.io-client"
import toast from "react-hot-toast"

const EMERGENCY_TYPES = [
  { id: "medical",  name: "Medical Emergency", icon: HeartPulse, color: "bg-red-500 hover:bg-red-600",    text: "text-red-500",    severity: "critical" },
  { id: "fire",     name: "Fire Alarm",         icon: Flame,      color: "bg-orange-500 hover:bg-orange-600", text: "text-orange-500", severity: "high"     },
  { id: "security", name: "Security Threat",    icon: ShieldAlert, color: "bg-purple-500 hover:bg-purple-600", text: "text-purple-500", severity: "high"  },
]

const EMERGENCY_CONTACTS = [
  { name: "Building Security (Main Gate)", phone: "+91 98765 43210" },
  { name: "City Police Station",           phone: "100" },
  { name: "City Hospital Ambulance",       phone: "108" },
  { name: "Fire Department",               phone: "101" },
]

export default function Emergency() {
  const { user } = useAuthStore()
  const [isTriggering, setIsTriggering] = useState(false)
  const [resolvingId, setResolvingId]   = useState(null)
  const [activeAlerts, setActiveAlerts] = useState([])
  const [isLoading, setIsLoading]       = useState(true)
  const socketRef = useRef(null)

  // Fetch active alerts on mount
  const fetchAlerts = async () => {
    try {
      setIsLoading(true)
      const res = await listEmergencies({ status: 'active' })
      if (res.success) setActiveAlerts(res.data)
    } catch {
      // silently fail — don't block UI
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAlerts()

    // Socket.IO for real-time emergency sync
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", { withCredentials: true })
    socketRef.current = socket

    socket.on("connect", () => {
      if (user?.id) socket.emit("join_user_room", user.id)
      if (user?.complex_id) socket.emit("join_complex_room", user.complex_id)
    })

    // New emergency triggered (by me or someone in same complex)
    socket.on("emergency_alert", (alert) => {
      setActiveAlerts(prev => {
        if (prev.find(a => a.id === alert.id)) return prev
        return [alert, ...prev]
      })
    })

    // Alert resolved / false alarm
    socket.on("emergency_resolved", ({ id, status }) => {
      setActiveAlerts(prev => prev.filter(a => a.id !== id))
      if (status === 'false_alarm') toast("Alert cancelled as false alarm", { icon: "🔕" })
      if (status === 'resolved')    toast.success("Emergency alert resolved")
    })

    return () => socket.disconnect()
  }, [user])

  const handleSOS = async (type) => {
    if (isTriggering) return
    setIsTriggering(true)
    try {
      const unitId = user?.units?.[0]?.unit_id || null
      const res = await triggerEmergency({
        type,
        unit_id: unitId,
        severity: EMERGENCY_TYPES.find(t => t.name === type)?.severity || 'high',
        description: `${type} triggered from resident app`,
      })
      if (res.success) {
        toast.error(`🚨 ${type} alert sent! Help is on the way.`, { duration: 5000 })
        // The socket event will add it to activeAlerts
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to trigger alert. Please call emergency services directly.")
    } finally {
      setIsTriggering(false)
    }
  }

  const handleCancel = async (alertId) => {
    setResolvingId(alertId)
    try {
      const res = await resolveEmergency(alertId)
      if (res.success) {
        setActiveAlerts(prev => prev.filter(a => a.id !== alertId))
        toast("Alert cancelled as false alarm", { icon: "🔕" })
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel alert")
    } finally {
      setResolvingId(null)
    }
  }

  const hasActive = activeAlerts.length > 0

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="text-center sm:text-left">
        <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center justify-center sm:justify-start">
          <AlertTriangle className="w-6 h-6 mr-2 text-danger" />
          Emergency Center
        </h2>
        <p className="text-sm text-gray-500 mt-1">Trigger SOS alerts and find emergency contacts</p>
      </div>

      {/* Active Alert Banners */}
      {!isLoading && activeAlerts.map(alert => (
        <div
          key={alert.id}
          className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-6 shadow-sm animate-in zoom-in duration-300"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center text-red-600 animate-pulse flex-shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-900 dark:text-red-400">🚨 SOS Alert Active</h3>
              <p className="text-red-700 dark:text-red-300/80 text-sm mt-0.5">
                <span className="font-semibold capitalize">{alert.type}</span>
                {alert.full_name && <> · Reported by {alert.full_name}</>}
                {alert.unit_number && <> · Unit {alert.unit_number}</>}
                {' · '}{new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <Badge variant="destructive" className="bg-red-600 animate-pulse hidden sm:flex border-transparent">
              Active — Help dispatched
            </Badge>
          </div>
          <p className="mt-4 text-sm text-red-800 dark:text-red-200 bg-red-100/50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200/50 dark:border-red-800/50">
            Security and emergency contacts have been notified. Please stay calm and remain in a safe location. Help is on the way.
          </p>
          {/* Only the reporter can cancel */}
          {alert.user_id === user?.id && (
            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                className="border-red-200 text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 bg-background"
                onClick={() => handleCancel(alert.id)}
                disabled={resolvingId === alert.id}
              >
                {resolvingId === alert.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                False Alarm / Cancel
              </Button>
            </div>
          )}
        </div>
      ))}

      {/* SOS Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {EMERGENCY_TYPES.map((type) => (
          <button
            key={type.id}
            disabled={isTriggering || hasActive}
            onClick={() => handleSOS(type.name)}
            className={`relative overflow-hidden group flex flex-col items-center justify-center p-8 rounded-2xl border-none shadow-lg transition-all transform hover:-translate-y-1 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${hasActive ? 'bg-secondary blur-[2px]' : 'bg-card'}`}
          >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${type.color} bg-opacity-10`} />
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-inner bg-background ${type.text}`}>
              {isTriggering ? <Loader2 className="w-10 h-10 animate-spin" /> : <type.icon className="w-10 h-10" />}
            </div>
            <h3 className="text-lg font-bold text-foreground relative z-10">{type.name}</h3>
            <p className="text-xs text-gray-500 mt-2 text-center uppercase tracking-widest font-semibold relative z-10">Tap to trigger</p>
          </button>
        ))}
      </div>

      {/* Emergency Contacts */}
      <Card className="mt-8 shadow-md border-none">
        <CardHeader className="bg-secondary/30 border-b border-border/50 pb-4">
          <CardTitle className="text-lg flex items-center">
            <PhoneCall className="w-5 h-5 mr-2 text-primary" />
            Important Contacts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {EMERGENCY_CONTACTS.map((contact, i) => (
              <div key={i} className={`p-5 flex justify-between items-center hover:bg-secondary/20 transition-colors ${i > 1 ? 'border-t border-border' : ''}`}>
                <div>
                  <p className="font-semibold text-foreground text-sm">{contact.name}</p>
                  <p className="text-xl font-mono font-bold text-gray-700 dark:text-gray-300 mt-1">{contact.phone}</p>
                </div>
                <a
                  href={`tel:${contact.phone.replace(/\s/g, '')}`}
                  className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
