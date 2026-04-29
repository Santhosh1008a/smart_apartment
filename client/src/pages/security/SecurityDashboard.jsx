import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { getVisitorsToday, checkinVisitor, checkoutVisitorSecurity } from "../../api/security"
import { Users, UserCheck, UserX, Clock, Loader2, RefreshCw, Shield } from "lucide-react"
import toast from "react-hot-toast"

export default function SecurityDashboard() {
  const [visitors, setVisitors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchVisitors = async () => {
    try {
      setIsLoading(true)
      const res = await getVisitorsToday()
      if (res.success) setVisitors(res.data)
    } catch {
      toast.error("Error fetching visitors")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchVisitors() }, [])

  const handleCheckin = async (id) => {
    setActionLoading(id)
    try {
      const res = await checkinVisitor(id)
      if (res.success) {
        toast.success("Visitor checked in!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckout = async (id) => {
    setActionLoading(id)
    try {
      const res = await checkoutVisitorSecurity(id)
      if (res.success) {
        toast.success("Visitor checked out!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-out failed")
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="capitalize">Expected</Badge>
      case "checked_in": return <Badge variant="success" className="capitalize">Inside</Badge>
      case "checked_out": return <Badge variant="outline" className="capitalize">Left</Badge>
      case "cancelled": return <Badge variant="destructive" className="capitalize">Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const counts = {
    expected: visitors.filter(v => v.status === 'pending').length,
    inside: visitors.filter(v => v.status === 'checked_in').length,
    left: visitors.filter(v => v.status === 'checked_out').length,
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p>Loading visitor data…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Today's Visitors</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Button onClick={fetchVisitors} className="gap-2" variant="outline">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Quick Counters */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Expected</p>
              <p className="text-2xl font-bold">{counts.expected}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Inside</p>
              <p className="text-2xl font-bold">{counts.inside}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500">
              <UserX className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Left</p>
              <p className="text-2xl font-bold">{counts.left}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visitor List */}
      <div className="space-y-3">
        {visitors.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="py-12 text-center text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No visitors expected today</p>
            </CardContent>
          </Card>
        ) : (
          visitors.map(visitor => (
            <Card key={visitor.id} className="animate-in fade-in slide-in-from-bottom-2 border-none shadow-md overflow-hidden">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold text-lg">
                    {visitor.visitor_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{visitor.visitor_name}</p>
                    <p className="text-sm text-gray-500">
                      Host: <span className="font-medium text-foreground">{visitor.host_name}</span>
                      {visitor.visitor_phone && <span className="ml-2">• {visitor.visitor_phone}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{visitor.purpose}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {statusBadge(visitor.status)}

                  {visitor.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleCheckin(visitor.id)}
                      disabled={actionLoading === visitor.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {actionLoading === visitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Check In
                    </Button>
                  )}

                  {visitor.status === "checked_in" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCheckout(visitor.id)}
                      disabled={actionLoading === visitor.id}
                      className="gap-1.5"
                    >
                      {actionLoading === visitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                      Check Out
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
