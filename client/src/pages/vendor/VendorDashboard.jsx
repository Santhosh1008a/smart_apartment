import { useState, useEffect, useRef, useCallback } from "react"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { getVendorRequests, updateVendorRequestStatus } from "../../api/vendor"
import { useAuthStore } from "../../store/useAuthStore"
import { Wrench, Clock, Play, CheckCircle2, Loader2, ArrowRight, RefreshCw } from "lucide-react"
import { io } from "socket.io-client"
import toast from "react-hot-toast"

const STATUS_CONFIG = {
  pending:     { label: "Pending",     variant: "secondary", icon: Clock,         next: null,          nextLabel: null          },
  assigned:    { label: "Assigned",    variant: "secondary", icon: Clock,         next: "in_progress", nextLabel: "Start Job"   },
  in_progress: { label: "In Progress", variant: "default",   icon: Play,          next: "completed",   nextLabel: "Mark Done"   },
  completed:   { label: "Completed",   variant: "success",   icon: CheckCircle2,  next: null,          nextLabel: null          },
}

const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  high:   "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  low:    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
}

export default function VendorDashboard() {
  const { user } = useAuthStore()
  const [requests, setRequests]         = useState([])
  const [isLoading, setIsLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const socketRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await getVendorRequests()
      if (res.success) setRequests(res.data)
    } catch {
      toast.error("Error loading jobs")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()

    // Socket.IO for real-time job updates
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", { withCredentials: true })
    socketRef.current = socket

    socket.on("connect", () => {
      if (user?.id)         socket.emit("join_user_room",    user.id)
      if (user?.complex_id) socket.emit("join_complex_room", user.complex_id)
    })

    // Update local state when any vendor request changes in the same complex
    socket.on("vendor_request_update", (updated) => {
      setRequests(prev => {
        const exists = prev.find(r => r.id === updated.id)
        if (exists) {
          return prev.map(r => r.id === updated.id ? { ...r, ...updated } : r)
        }
        return prev  // if it's a new assignment that just appeared
      })
    })

    // New job assigned to me
    socket.on("notification", (notif) => {
      if (notif.type === "job_assigned") {
        toast.success(notif.title || "New job assigned!")
        fetchData()  // Refresh to pick up newly assigned jobs
      }
    })

    return () => socket.disconnect()
  }, [user, fetchData])

  const handleStatusUpdate = async (id, newStatus) => {
    if (actionLoading) return  // Prevent double-clicks
    setActionLoading(id)

    // Optimistic update
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r))

    try {
      const res = await updateVendorRequestStatus(id, newStatus)
      if (res.success) {
        // Sync final state from server
        setRequests(prev => prev.map(r => r.id === id ? { ...r, ...res.data } : r))
        toast.success(`Job marked as ${newStatus.replace('_', ' ')}`)
        // Remove completed jobs from active view after a short delay
        if (newStatus === 'completed') {
          setTimeout(() => {
            setRequests(prev => prev.filter(r => r.id !== id))
          }, 2000)
        }
      }
    } catch (err) {
      // Rollback optimistic update on error
      fetchData()
      toast.error(err.response?.data?.message || "Update failed — please try again")
    } finally {
      setActionLoading(null)
    }
  }

  const activeRequests = requests.filter(r => r.status !== 'completed')
  const completedToday = requests.filter(r => r.status === 'completed').length

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p>Loading your jobs…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Jobs</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            {activeRequests.length} active · {completedToday} completed today
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg hover:bg-secondary text-gray-500 hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {activeRequests.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center text-gray-500">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active jobs assigned</p>
            <p className="text-sm mt-1">Check back later for new requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeRequests.map(req => {
            const config     = STATUS_CONFIG[req.status] || STATUS_CONFIG.assigned
            const StatusIcon = config.icon
            const isUpdating = actionLoading === req.id

            return (
              <Card
                key={req.id}
                className="animate-in fade-in slide-in-from-bottom-2 border-none shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mt-0.5 flex-shrink-0">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="font-semibold text-foreground capitalize">{req.category}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_COLORS[req.priority]}`}>
                            {req.priority}
                          </span>
                          {req.status === 'pending' && (
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold border border-yellow-200">
                              Awaiting assignment
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{req.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 flex-wrap">
                          {req.unit_number && <span>Unit: <span className="font-medium text-foreground">{req.unit_number}</span></span>}
                          {req.unit_number && req.requested_by && <span>•</span>}
                          {req.requested_by && <span>By: <span className="font-medium text-foreground">{req.requested_by}</span></span>}
                          <span>•</span>
                          <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge variant={config.variant} className="capitalize gap-1 hidden sm:flex">
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </Badge>

                      {config.next && (
                        <button
                          onClick={() => handleStatusUpdate(req.id, config.next)}
                          disabled={isUpdating}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed min-w-[100px] justify-center"
                        >
                          {isUpdating ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              {config.nextLabel}
                              <ArrowRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
