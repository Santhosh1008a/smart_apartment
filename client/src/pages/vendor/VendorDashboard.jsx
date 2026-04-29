import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { getVendorRequests, updateVendorRequestStatus } from "../../api/vendor"
import { Wrench, Clock, Play, CheckCircle2, Loader2, ArrowRight } from "lucide-react"
import toast from "react-hot-toast"

const STATUS_CONFIG = {
  assigned: { label: "Assigned", variant: "secondary", icon: Clock, next: "in_progress", nextLabel: "Start Job" },
  in_progress: { label: "In Progress", variant: "default", icon: Play, next: "completed", nextLabel: "Mark Done" },
  completed: { label: "Completed", variant: "success", icon: CheckCircle2, next: null, nextLabel: null },
}

const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800",
  low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700",
}

export default function VendorDashboard() {
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const res = await getVendorRequests()
      if (res.success) setRequests(res.data)
    } catch {
      toast.error("Error loading jobs")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleStatusUpdate = async (id, newStatus) => {
    setActionLoading(id)
    try {
      const res = await updateVendorRequestStatus(id, newStatus)
      if (res.success) {
        toast.success(`Job marked as ${newStatus.replace('_', ' ')}`)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Update failed")
    } finally {
      setActionLoading(null)
    }
  }

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
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">My Jobs</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{requests.length} active request{requests.length !== 1 ? 's' : ''}</p>
      </div>

      {requests.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="py-16 text-center text-gray-500">
            <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No active jobs assigned</p>
            <p className="text-sm mt-1">Check back later for new requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.assigned
            const StatusIcon = config.icon

            return (
              <Card key={req.id} className="animate-in fade-in slide-in-from-bottom-2 border-none shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center mt-0.5">
                        <Wrench className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-foreground capitalize">{req.category}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_COLORS[req.priority]}`}>
                            {req.priority}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{req.description}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>Unit: <span className="font-medium text-foreground">{req.unit_number}</span></span>
                          <span>•</span>
                          <span>By: <span className="font-medium text-foreground">{req.requested_by}</span></span>
                          <span>•</span>
                          <span>{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <Badge variant={config.variant} className="capitalize gap-1">
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </Badge>

                      {config.next && (
                        <button
                          onClick={() => handleStatusUpdate(req.id, config.next)}
                          disabled={actionLoading === req.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
                        >
                          {actionLoading === req.id ? (
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
