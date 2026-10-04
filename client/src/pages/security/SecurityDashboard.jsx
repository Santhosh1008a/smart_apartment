import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { getVisitorsToday, checkinVisitor, checkoutVisitorSecurity, resolveOverdueVisitor, extendVisitorValidity } from "../../api/security"
import { UserCheck, UserX, Clock, Loader2, RefreshCw, Shield, AlertTriangle, LogOut } from "lucide-react"
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

  const handleResolveOverdue = async (id) => {
    setActionLoading(id)
    try {
      const res = await resolveOverdueVisitor(id)
      if (res.success) {
        toast.success("Overdue visitor forcefully checked out!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Resolve failed")
    } finally {
      setActionLoading(null)
    }
  }

  const handleExtend = async (id) => {
    setActionLoading(id)
    try {
      const res = await extendVisitorValidity(id, 24)
      if (res.success) {
        toast.success("Visitor validity extended by 24 hours!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Extend failed")
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="capitalize">Expected</Badge>
      case "checked_in": return <Badge variant="success" className="capitalize">Inside</Badge>
      case "overdue": return <Badge variant="destructive" className="capitalize">Overdue</Badge>
      case "checked_out": return <Badge variant="outline" className="capitalize">Left</Badge>
      case "expired": return <Badge variant="outline" className="capitalize">Expired</Badge>
      case "cancelled": return <Badge variant="destructive" className="capitalize">Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const counts = {
    expected: visitors.filter(v => v.status === 'pending').length,
    inside: visitors.filter(v => v.status === 'checked_in').length,
    overdue: visitors.filter(v => v.status === 'overdue').length,
    left: visitors.filter(v => ['checked_out', 'cancelled', 'expired'].includes(v.status)).length,
  }

  const expectedList = visitors.filter(v => v.status === 'pending')
  const activeList = visitors.filter(v => v.status === 'checked_in')
  const overdueList = visitors.filter(v => v.status === 'overdue')
  const historyList = visitors.filter(v => ['checked_out', 'expired', 'cancelled'].includes(v.status))

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p>Loading visitor data...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Today's Visitors</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
          <Button onClick={fetchVisitors} className="gap-2" variant="outline">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      {/* Quick Counters */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 shrink-0">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Expected</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.expected}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
              <UserCheck className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Inside</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.inside}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
              <UserX className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Left</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.left}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue List */}
      {overdueList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Overdue Visitors
          </h3>
          {overdueList.map(visitor => renderVisitorCard(visitor))}
        </div>
      )}

      {/* Active List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-emerald-600 flex items-center gap-2">
          <UserCheck className="w-5 h-5" /> Active Visitors (Inside)
        </h3>
        {activeList.length === 0 ? (
          <Card className="border-none shadow-md"><CardContent className="py-6 text-center text-gray-500">No active visitors.</CardContent></Card>
        ) : activeList.map(visitor => renderVisitorCard(visitor))}
      </div>

      {/* Expected List */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-gray-600 flex items-center gap-2">
          <Clock className="w-5 h-5" /> Expected Visitors
        </h3>
        {expectedList.length === 0 ? (
          <Card className="border-none shadow-md"><CardContent className="py-6 text-center text-gray-500">No expected visitors today.</CardContent></Card>
        ) : expectedList.map(visitor => renderVisitorCard(visitor))}
      </div>

      {/* History List */}
      {historyList.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-400 flex items-center gap-2">
            <LogOut className="w-5 h-5" /> Checked Out History
          </h3>
          {historyList.map(visitor => renderVisitorCard(visitor))}
        </div>
      )}

    </div>
  )

  function renderVisitorCard(visitor) {
    return (
      <Card key={visitor.id} className="animate-in fade-in slide-in-from-bottom-2 border-none shadow-md overflow-hidden">
        <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold text-lg">
              {visitor.visitor_name?.charAt(0)?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-foreground">{visitor.visitor_name}</p>
              <p className="text-sm text-gray-500">
                Host: <span className="font-medium text-foreground">{visitor.host_name}</span>
                {visitor.visitor_phone && <span className="ml-2">- {visitor.visitor_phone}</span>}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{visitor.purpose} • {new Date(visitor.valid_from).toLocaleTimeString()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
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

            {visitor.status === "overdue" && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleResolveOverdue(visitor.id)}
                  disabled={actionLoading === visitor.id}
                  className="gap-1.5"
                >
                  {actionLoading === visitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                  Force Checkout
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleExtend(visitor.id)}
                  disabled={actionLoading === visitor.id}
                  className="gap-1.5 text-blue-600"
                >
                  Extend Visit
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
}
