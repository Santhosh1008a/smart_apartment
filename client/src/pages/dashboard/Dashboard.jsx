import { useEffect, useState } from "react"
import { AlertCircle, ArrowRight, Building2, Car, CheckCircle2, Clock3, CreditCard, DoorOpen, FileText, MapPin, Megaphone, Users, Wrench } from "lucide-react"
import { Link } from "react-router-dom"
import { useAuthStore } from "../../store/useAuthStore"
import { listMyPasses } from "../../api/visitors"
import { listMyInvoices } from "../../api/payments"
import { listEmergencies } from "../../api/services"
import { listNotices } from "../../api/notices"
import { Badge } from "../../components/ui/Badge"
import { Loader2 } from "lucide-react"
import toast from "react-hot-toast"
import communityBackground from "../../../../public/branding/resident-community-bg.png"

const asArray = (value) => Array.isArray(value) ? value : []
const asAmount = (value) => Number.parseFloat(value || 0) || 0

export default function Dashboard() {
  const { user, complex, building, unit, parking } = useAuthStore()
  const [stats, setStats] = useState({ activeVisitors: 0, unpaidAmount: 0, unpaidCount: 0, activeAlerts: 0 })
  const [recentPasses, setRecentPasses] = useState([])
  const [recentInvoices, setRecentInvoices] = useState([])
  const [recentNotices, setRecentNotices] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true)
        const [passesResult, invoicesResult, alertsResult, noticesResult] = await Promise.allSettled([
          listMyPasses(), listMyInvoices(), listEmergencies(), listNotices(),
        ])
        const valueOf = (result) => result.status === "fulfilled" ? result.value : null
        const passesRes = valueOf(passesResult)
        const invoicesRes = valueOf(invoicesResult)
        const alertsRes = valueOf(alertsResult)
        const noticesRes = valueOf(noticesResult)
        const passes = passesRes?.success ? asArray(passesRes.data) : []
        const invoices = invoicesRes?.success ? asArray(invoicesRes.data) : []
        const alerts = alertsRes?.success ? asArray(alertsRes.data) : []
        const notices = noticesRes?.success ? asArray(noticesRes.data) : []
        const unpaidInvoices = invoices.filter((invoice) => invoice.status !== "paid")
        setStats({
          activeVisitors: passes.filter((pass) => pass.status === "checked_in").length,
          unpaidAmount: unpaidInvoices.reduce((sum, invoice) => sum + asAmount(invoice.amount), 0),
          unpaidCount: unpaidInvoices.length,
          activeAlerts: alerts.length,
        })
        setRecentPasses(passes.slice(0, 3))
        setRecentInvoices(unpaidInvoices.slice(0, 3))
        setRecentNotices(notices
          .filter((notice) => notice.status === "sent" && (!notice.ends_at || new Date(notice.ends_at) >= new Date()))
          .sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at))
          .slice(0, 3))
      } catch {
        toast.error("Error loading dashboard data")
      } finally {
        setIsLoading(false)
      }
    }
    fetchDashboardData()
  }, [])

  const location = [building?.name, unit?.unit_number ? `Unit ${unit.unit_number}` : null].filter(Boolean).join(" · ")
  const metrics = [
    { label: "Visitors on site", value: stats.activeVisitors, note: "Currently checked in", icon: Users },
    { label: "Payments due", value: `₹${stats.unpaidAmount.toLocaleString()}`, note: `${stats.unpaidCount} outstanding ${stats.unpaidCount === 1 ? "invoice" : "invoices"}`, icon: CreditCard },
    { label: "Parking", value: parking?.slot_number ? parking.slot_number : "—", note: parking?.slot_number ? "Your assigned space" : "No assigned space", icon: Car },
    { label: "Active alerts", value: stats.activeAlerts, note: "Community emergency alerts", icon: AlertCircle },
  ]
  const shortcuts = [
    { to: "/visitors", label: "Create a visitor pass", icon: Users },
    { to: "/vendors", label: "Request maintenance", icon: Wrench },
    { to: "/payments", label: "View payments", icon: CreditCard },
    { to: "/parking", label: "Manage parking", icon: Car },
  ]

  return (
    <div className="resident-dashboard">
      <section className="resident-welcome" aria-label="Resident overview" style={{ "--resident-bg": `url("${communityBackground}")` }}>
        <div>
          <p className="resident-welcome-label">Your resident portal</p>
          <h2>Good to see you, {user?.full_name?.split(" ")[0] || "there"}.</h2>
          <p className="mt-2 text-sm">Everything happening around home, at a glance.</p>
          {(complex || location) && <p className="resident-location"><MapPin className="h-4 w-4" />{[complex?.name, location].filter(Boolean).join(" · ")}</p>}
        </div>
        {(complex || unit) && <div className="resident-home-tag"><Building2 className="h-4 w-4" />{complex?.name || "My home"}{unit?.unit_number && <><span aria-hidden="true">·</span><DoorOpen className="h-4 w-4" />{unit.unit_number}</>}</div>}
      </section>

      {!unit && user?.role === "resident" && (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <div><p className="font-semibold">Your apartment is not assigned yet</p><p className="mt-1 text-sm">Please contact your community administrator to link your unit.</p></div>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-14 text-sm text-gray-500" role="status"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span>Loading your overview…</span></div>
      ) : (
        <>
          <section aria-label="Home metrics" className="resident-stat-grid">
            {metrics.map((metric) => (
              <article key={metric.label} className="resident-stat"><div className="resident-stat-top"><span>{metric.label}</span><span className="resident-stat-icon"><metric.icon className="h-[17px] w-[17px]" /></span></div><p className="resident-stat-value">{metric.value}</p><p className="resident-stat-note">{metric.note}</p></article>
            ))}
          </section>

          <section aria-labelledby="shortcuts-heading">
            <h3 id="shortcuts-heading" className="resident-section-title mb-3">Quick actions</h3>
            <div className="resident-shortcuts">{shortcuts.map((shortcut) => <Link className="resident-shortcut" to={shortcut.to} key={shortcut.to}><span className="resident-shortcut-icon"><shortcut.icon className="h-[17px] w-[17px]" /></span><span>{shortcut.label}</span><ArrowRight className="ml-auto h-4 w-4 shrink-0 text-gray-400" /></Link>)}</div>
          </section>

          <div className="resident-data-grid">
            <section className="resident-data-card" aria-labelledby="visitors-heading">
              <div className="resident-data-card-header"><h3 id="visitors-heading" className="resident-section-title">Recent visitors</h3><Link to="/visitors" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">All visitors <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              <div className="resident-data-card-body">{recentPasses.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">No recent visitor passes.</p> : recentPasses.map((pass) => <div key={pass.id} className="resident-dashboard-row flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{pass.visitor_name} <span className="font-normal text-gray-500">· {pass.purpose}</span></p><p className="mt-1 flex items-center gap-1 text-xs text-gray-500"><Clock3 className="h-3 w-3" />{pass.valid_from ? new Date(pass.valid_from).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "Time not specified"}</p></div><Badge variant="outline" className="capitalize">{pass.status}</Badge></div>)}</div>
            </section>

            <section className="resident-data-card" aria-labelledby="dues-heading">
              <div className="resident-data-card-header"><h3 id="dues-heading" className="resident-section-title">Payments to review</h3><Link to="/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">View payments <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              <div className="resident-data-card-body">{recentInvoices.length === 0 ? <p className="flex items-center justify-center gap-2 py-4 text-sm text-gray-500"><CheckCircle2 className="h-4 w-4 text-primary" />You’re all caught up.</p> : recentInvoices.map((invoice) => <div key={invoice.id} className="resident-dashboard-row flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold capitalize text-foreground">{invoice.type}</p><p className="mt-1 text-xs text-gray-500">Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "date not set"}</p></div><p className="shrink-0 text-sm font-semibold">₹{asAmount(invoice.amount).toLocaleString()}</p></div>)}</div>
            </section>

            <section className="resident-data-card wide" aria-labelledby="notices-heading">
              <div className="resident-data-card-header"><h3 id="notices-heading" className="resident-section-title flex items-center gap-2"><Megaphone className="h-4 w-4 text-primary" />Community notices</h3><Link to="/notices" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">All notices <ArrowRight className="h-3.5 w-3.5" /></Link></div>
              <div className="resident-data-card-body">{recentNotices.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">There are no current announcements.</p> : recentNotices.map((notice) => <Link key={notice.id} to="/notices" className="resident-dashboard-row block transition-colors hover:bg-[#f4f7f2]"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-semibold text-foreground">{notice.title}</p><p className="mt-1 line-clamp-2 text-sm text-gray-500">{notice.message}</p></div><span className="shrink-0 text-xs text-gray-500"><FileText className="mr-1 inline h-3.5 w-3.5" />{new Date(notice.starts_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span></div></Link>)}</div>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
