import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { getSuperAdminDashboard, createComplex, createAdmin } from "../../api/superAdmin"
import { Building2, Users, Plus, Loader2, Shield, MapPin } from "lucide-react"
import toast from "react-hot-toast"

const asArray = (value) => Array.isArray(value) ? value : []
const emptyDashboard = { total_complexes: 0, total_users: 0, complexes: [] }
const normalizeDashboard = (data) => ({
  ...emptyDashboard,
  ...(data || {}),
  complexes: asArray(data?.complexes),
})

export default function SuperAdminDashboard() {
  const [data, setData] = useState(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)

  // Create Complex form
  const [showComplexForm, setShowComplexForm] = useState(false)
  const [complexForm, setComplexForm] = useState({ name: "", address: "" })
  const [complexLoading, setComplexLoading] = useState(false)

  // Create Admin form
  const [showAdminForm, setShowAdminForm] = useState(false)
  const [adminForm, setAdminForm] = useState({ email: "", phone: "", password: "", full_name: "", complex_id: "" })
  const [adminLoading, setAdminLoading] = useState(false)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const res = await getSuperAdminDashboard()
      setData(res.success ? normalizeDashboard(res.data) : emptyDashboard)
    } catch (err) {
      toast.error("Failed to load dashboard")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleCreateComplex = async (e) => {
    e.preventDefault()
    setComplexLoading(true)
    try {
      const res = await createComplex(complexForm)
      if (res.success) {
        toast.success("Society created successfully!")
        setComplexForm({ name: "", address: "" })
        setShowComplexForm(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create society")
    } finally {
      setComplexLoading(false)
    }
  }

  const handleCreateAdmin = async (e) => {
    e.preventDefault()
    setAdminLoading(true)
    try {
      const res = await createAdmin(adminForm)
      if (res.success) {
        toast.success("Admin created successfully!")
        setAdminForm({ email: "", phone: "", password: "", full_name: "", complex_id: "" })
        setShowAdminForm(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create admin")
    } finally {
      setAdminLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p>Loading super admin dashboard…</p>
      </div>
    )
  }

  const statCards = [
    {
      title: "Total Societies",
      value: data.total_complexes,
      icon: Building2,
      color: "text-indigo-500",
      bg: "bg-indigo-100 dark:bg-indigo-900/30",
      border: "border-indigo-200 dark:border-indigo-800",
    },
    {
      title: "Total Users",
      value: data.total_users,
      icon: Users,
      color: "text-emerald-500",
      bg: "bg-emerald-100 dark:bg-emerald-900/30",
      border: "border-emerald-200 dark:border-emerald-800",
    },
  ]

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Super Admin Dashboard</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">Platform-wide overview of all societies.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => { setShowComplexForm(!showComplexForm); setShowAdminForm(false) }}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4" /> New Society
          </Button>
          <Button
            onClick={() => { setShowAdminForm(!showAdminForm); setShowComplexForm(false) }}
            className="gap-2"
            variant="outline"
          >
            <Shield className="w-4 h-4" /> New Admin
          </Button>
        </div>
      </div>

      {/* Create Complex Form */}
      {showComplexForm && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-indigo-200 dark:border-indigo-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Create New Society</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateComplex} className="flex flex-col sm:flex-row gap-3">
              <Input
                required
                placeholder="Society name"
                value={complexForm.name}
                onChange={(e) => setComplexForm({ ...complexForm, name: e.target.value })}
                className="flex-1"
              />
              <Input
                placeholder="Address (optional)"
                value={complexForm.address}
                onChange={(e) => setComplexForm({ ...complexForm, address: e.target.value })}
                className="flex-1"
              />
              <Button type="submit" disabled={complexLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white whitespace-nowrap">
                {complexLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Create Admin Form */}
      {showAdminForm && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Create New Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <Input required placeholder="Full name" value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} />
              <Input required type="email" placeholder="Email" value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} />
              <Input required placeholder="Phone" value={adminForm.phone} onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })} />
              <Input required type="password" placeholder="Password" value={adminForm.password} onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })} />
              <select
                required
                value={adminForm.complex_id}
                onChange={(e) => setAdminForm({ ...adminForm, complex_id: e.target.value })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="" disabled>Select society</option>
                {data.complexes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button type="submit" disabled={adminLoading} className="whitespace-nowrap">
                {adminLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Admin"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Societies List */}
      <Card className="animate-in fade-in slide-in-from-bottom-6 delay-200">
        <CardHeader className="pb-4 border-b border-border/40">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-500" />
            All Societies
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {data.complexes.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              No societies created yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.complexes.map((complex) => (
                <div
                  key={complex.id}
                  className="p-5 rounded-xl border border-border bg-card hover:shadow-md transition-shadow duration-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">{complex.name}</h4>
                        {complex.address && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3" /> {complex.address}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-border/40 text-sm">
                    <div className="text-gray-500 mb-1 font-medium">Admin(s):</div>
                    {complex.admins && complex.admins.length > 0 ? (
                      <ul className="space-y-1">
                        {complex.admins.map((admin, idx) => (
                          <li key={idx} className="text-gray-700 dark:text-gray-300">
                            • {admin.full_name} <span className="text-gray-400">({admin.email})</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-gray-400 italic">No Admin Assigned</div>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-border/40">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users className="w-4 h-4" />
                      <span>{complex.total_users} users</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {new Date(complex.created_at).toLocaleDateString()}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
