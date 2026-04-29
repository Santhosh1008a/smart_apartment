import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { useAuthStore } from "../../store/useAuthStore"
import { Users, FileText, AlertCircle, ArrowRight, Loader2 } from "lucide-react"
import { listMyPasses } from "../../api/visitors"
import { listMyInvoices } from "../../api/payments"
import { listEmergencies } from "../../api/services"
import { Badge } from "../../components/ui/Badge"
import { Link } from "react-router-dom"
import toast from "react-hot-toast"

export default function Dashboard() {
  const { user } = useAuthStore()
  
  const [stats, setStats] = useState({
    activeVisitors: 0,
    unpaidAmount: 0,
    activeAlerts: 0
  })
  
  const [recentPasses, setRecentPasses] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        const [passesRes, invoicesRes, alertsRes] = await Promise.all([
          listMyPasses(),
          listMyInvoices(),
          listEmergencies()
        ])

        if (passesRes.success && invoicesRes.success) {
          const passes = passesRes.data || []
          const invoices = invoicesRes.data || []
          const alerts = alertsRes.success ? (alertsRes.data || []) : []

          const activeVis = passes.filter(p => p.status === 'checked_in').length
          const unpaid = invoices.filter(i => i.status !== 'paid')
            .reduce((sum, i) => sum + parseFloat(i.amount), 0)

          setStats({
            activeVisitors: activeVis,
            unpaidAmount: unpaid,
            activeAlerts: alerts.length // Number of recent global alerts
          })

          setRecentPasses(passes.slice(0, 3))
          setRecentInvoices(invoices.filter(i => i.status !== 'paid').slice(0, 3))
        }
      } catch (err) {
        toast.error("Error loading dashboard data")
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const statCards = [
    { title: "Active Visitors", value: stats.activeVisitors, icon: Users, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
    { title: "Unpaid Invoices", value: `₹${stats.unpaidAmount.toLocaleString()}`, icon: FileText, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-800" },
    { title: "Active Alerts", value: stats.activeAlerts, icon: AlertCircle, color: "text-red-500", bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-200 dark:border-red-800" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Welcome back, {user?.full_name?.split(' ')[0]}!</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Here is the latest overview of your apartment ecosystem.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center flex-col items-center py-12 text-gray-500 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p>Loading dashboard metrics...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {statCards.map((stat, i) => (
              <Card key={i} className="animate-in fade-in slide-in-from-bottom-4 border-none shadow-md overflow-hidden relative group" style={{ animationDelay: `${i * 100}ms` }}>
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-20 ${stat.bg} group-hover:scale-150 transition-transform duration-500`} />
                <CardContent className="p-6 flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-base font-medium text-gray-600 dark:text-gray-400">{stat.title}</p>
                    <h3 className="text-3xl font-bold mt-2 text-foreground">{stat.value}</h3>
                  </div>
                  <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} shadow-sm border ${stat.border}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            <Card className="animate-in fade-in slide-in-from-bottom-6 delay-300">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
                <CardTitle className="text-base font-semibold">Today's Visitors</CardTitle>
                <Link to="/visitors" className="text-sm font-medium text-primary hover:text-primary-hover flex items-center transition-colors">
                  View all <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {recentPasses.length === 0 ? (
                    <p className="text-sm text-center py-4 text-gray-500">No recent visitor passes.</p>
                  ) : (
                    recentPasses.map(pass => (
                      <div key={pass.id} className="flex items-center justify-between bg-background p-3.5 rounded-xl border shadow-sm">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 flex items-center justify-center">
                            <Users className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{pass.visitor_name} ({pass.purpose})</p>
                            <p className="text-xs text-gray-500 mt-0.5">Valid from {new Date(pass.valid_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="capitalize">{pass.status}</Badge>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="animate-in fade-in slide-in-from-bottom-6 delay-400">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b border-border/40">
                <CardTitle className="text-base font-semibold">Pending Dues</CardTitle>
                <Link to="/payments" className="text-sm font-medium text-primary hover:text-primary-hover flex items-center transition-colors">
                  Pay now <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-3">
                  {recentInvoices.length === 0 ? (
                    <p className="text-sm text-center py-4 text-gray-500">No pending dues. You're all caught up!</p>
                  ) : (
                    recentInvoices.map(inv => (
                      <div key={inv.id} className="flex items-center justify-between p-4 rounded-xl border bg-orange-50/50 dark:bg-orange-950/10 border-orange-100 dark:border-orange-900 shadow-sm">
                        <div className="flex items-center">
                          <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400 flex items-center justify-center mr-4 shadow-inner">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-semibold text-foreground capitalize">{inv.type}</p>
                            <p className="text-xs text-gray-500 mt-0.5">Due: {new Date(inv.due_date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg">₹{parseFloat(inv.amount).toLocaleString()}</p>
                          <p className="text-[11px] uppercase tracking-wider text-orange-600 dark:text-orange-400 font-bold mt-0.5">Unpaid</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
