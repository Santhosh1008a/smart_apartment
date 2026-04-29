import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table"
import { Badge } from "../../components/ui/Badge"
import { getDashboardStats, getPaymentStatus, getAnalyticsTrends } from "../../api/admin"
import { useAuthStore } from "../../store/useAuthStore"
import { Users, Home, IndianRupee, FileText, TrendingUp, AlertTriangle, Loader2, Building2 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts"
import toast from "react-hot-toast"

export default function AdminDashboard() {
  const [stats, setStats] = useState(null)
  const [payments, setPayments] = useState({ paid: [], unpaid: [], overdue: [] })
  const [trends, setTrends] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("overdue")
  const { user } = useAuthStore()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        const [statsRes, paymentsRes, trendsRes] = await Promise.all([
          getDashboardStats(),
          getPaymentStatus(),
          getAnalyticsTrends()
        ])
        if (statsRes.success) setStats(statsRes.data)
        if (paymentsRes.success) setPayments(paymentsRes.data)
        if (trendsRes.success) setTrends(trendsRes.data)
      } catch (err) {
        toast.error("Error loading admin dashboard")
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const statCards = stats ? [
    { title: "Total Residents", value: stats.total_residents, icon: Users, color: "text-blue-500", bg: "bg-blue-100 dark:bg-blue-900/30", border: "border-blue-200 dark:border-blue-800" },
    { title: "Occupied Units", value: stats.occupied_units, icon: Home, color: "text-emerald-500", bg: "bg-emerald-100 dark:bg-emerald-900/30", border: "border-emerald-200 dark:border-emerald-800" },
    { title: "Vacant Units", value: stats.vacant_units, icon: Home, color: "text-orange-500", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-800" },
    { title: "Total Revenue", value: `₹${stats.total_revenue.toLocaleString()}`, icon: IndianRupee, color: "text-green-500", bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-200 dark:border-green-800" },
    { title: "Pending Invoices", value: stats.pending_invoices, icon: FileText, color: "text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-200 dark:border-yellow-800" },
    { title: "Active Visitors", value: stats.active_visitors, icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-100 dark:bg-violet-900/30", border: "border-violet-200 dark:border-violet-800" },
  ] : []

  const tabs = [
    { key: "overdue", label: "Overdue", count: payments.overdue.length, color: "text-red-600 border-red-500" },
    { key: "unpaid", label: "Unpaid", count: payments.unpaid.length, color: "text-orange-600 border-orange-500" },
    { key: "paid", label: "Paid", count: payments.paid.length, color: "text-green-600 border-green-500" },
  ]

  const activePayments = payments[activeTab] || []

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p>Loading admin dashboard…</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h2>
        {user?.complex_name && (
          <div className="flex items-center gap-2 mt-2">
            <Building2 className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">Society: {user.complex_name}</span>
          </div>
        )}
        <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Overview of your apartment complex.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat, i) => (
          <Card key={i} className="animate-in fade-in slide-in-from-bottom-4 border-none shadow-md overflow-hidden relative group" style={{ animationDelay: `${i * 80}ms` }}>
            <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-20 ${stat.bg} group-hover:scale-150 transition-transform duration-500`} />
            <CardContent className="p-6 flex items-center justify-between relative z-10">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{stat.title}</p>
                <h3 className="text-3xl font-bold mt-2 text-foreground">{stat.value}</h3>
              </div>
              <div className={`p-3.5 rounded-2xl ${stat.bg} ${stat.color} shadow-sm border ${stat.border}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Analytics Trends */}
      {trends && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-5 delay-300">
          
          {/* Monthly Revenue Bar Chart */}
          <Card className="lg:col-span-2 border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Monthly Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends.monthly_revenue} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                  <XAxis dataKey="month" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })} axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis tickFormatter={(val) => `₹${val/1000}k`} axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <Tooltip
                    cursor={{fill: '#88888811'}}
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    formatter={(value) => [`₹${value.toLocaleString()}`, "Revenue"]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Occupancy Donut Chart */}
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-500" />
                Occupancy Rate
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col justify-center items-center relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Occupied', value: trends.occupancy.occupied, color: '#3b82f6' },
                      { name: 'Vacant', value: trends.occupancy.vacant, color: '#f97316' }
                    ]}
                    cx="50%" cy="50%" innerRadius={65} outerRadius={90}
                    paddingAngle={5} dataKey="value" stroke="none"
                  >
                    {[{color: '#3b82f6'}, {color: '#f97316'}].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                    itemStyle={{color: '#333'}}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-4">
                <span className="text-4xl font-bold text-foreground">{trends.occupancy.occupancy_pct}%</span>
                <span className="text-sm text-gray-400">Occupied</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Trends Line Chart */}
          <Card className="lg:col-span-3 border-border/40 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-500" />
                Invoice Payment Trends
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trends.payment_trends} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#88888833" />
                  <XAxis dataKey="month" tickFormatter={(val) => new Date(val).toLocaleDateString('en-US', { month: 'short' })} axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{fill: '#888', fontSize: 12}} />
                  <Tooltip
                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', backgroundColor: 'var(--card)'}}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                  />
                  <Line type="monotone" dataKey="paid" name="Paid Invoices" stroke="#10b981" strokeWidth={3} dot={{r: 4, fill: '#10b981', strokeWidth: 0}} activeDot={{r: 6}} />
                  <Line type="monotone" dataKey="unpaid" name="Unpaid/Overdue" stroke="#f43f5e" strokeWidth={3} dot={{r: 4, fill: '#f43f5e', strokeWidth: 0}} activeDot={{r: 6}} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

        </div>
      )}

      {/* Payment Status Table */}
      <Card className="animate-in fade-in slide-in-from-bottom-6 delay-500">
        <CardHeader className="pb-4 border-b border-border/40">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <IndianRupee className="w-5 h-5 text-violet-500" />
            Payment Tracker
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex border-b border-border mb-4">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                  activeTab === tab.key
                    ? tab.color
                    : "border-transparent text-gray-500 hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className="ml-1.5 text-xs bg-secondary px-1.5 py-0.5 rounded-full">{tab.count}</span>
              </button>
            ))}
          </div>

          {activePayments.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              No {activeTab} invoices found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resident</TableHead>
                    <TableHead className="hidden sm:table-cell">Email</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden sm:table-cell">Due Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePayments.map((row, i) => (
                    <TableRow key={row.invoice_id + '-' + i}>
                      <TableCell className="font-medium">{row.full_name}</TableCell>
                      <TableCell className="text-gray-500 text-sm hidden sm:table-cell">{row.email}</TableCell>
                      <TableCell className="font-semibold">₹{parseFloat(row.amount).toLocaleString()}</TableCell>
                      <TableCell className="text-sm hidden sm:table-cell">{new Date(row.due_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        {activeTab === 'paid' && <Badge variant="success">Paid</Badge>}
                        {activeTab === 'unpaid' && <Badge variant="secondary">Unpaid</Badge>}
                        {activeTab === 'overdue' && <Badge variant="destructive">Overdue</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
