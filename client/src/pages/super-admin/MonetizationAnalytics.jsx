import { createElement, useEffect, useMemo, useRef, useState } from "react"
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Building2,
  Check, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, CreditCard,
  Download, Eye, FileText, IndianRupee, Loader2, Pencil, Plus, RefreshCw,
  Search, ShieldCheck, Users, X,
} from "lucide-react"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts"
import toast from "react-hot-toast"
import { Button } from "../../components/ui/Button"
import { Card, CardContent } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { Badge } from "../../components/ui/Badge"
import {
  createMonetizationPlan, createMonetizationSubscription, getMonetizationDashboard,
  getMonetizationReport, getMonetizationSubscription, updateMonetizationPlan,
  updateMonetizationSubscription,
} from "../../api/superAdmin"

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "3m", label: "3 months" },
  { value: "6m", label: "6 months" },
  { value: "1y", label: "1 year" },
]
const REPORTS = [
  { id: "revenue", name: "Revenue summary", description: "Captured amount, refunds and net revenue by transaction." },
  { id: "subscriptions", name: "Subscription performance", description: "Plan, community, billing cycle, status and payment state." },
  { id: "usage", name: "Apartment usage", description: "Passes, QR scans, check-ins, check-outs and security events." },
  { id: "transactions", name: "Payment history", description: "Confirmed SaaS payment records and provider references." },
]
const CHART_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#8b5cf6"]
const STATUS_CLASSES = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/25 dark:text-emerald-300",
  trial: "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/25 dark:text-blue-300",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300",
  expired: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/25 dark:text-amber-300",
  captured: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-900/25 dark:text-emerald-300",
  refunded: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-900/25 dark:text-orange-300",
  failed: "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/25 dark:text-red-300",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-900/25 dark:text-amber-300",
  unpaid: "bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300",
}
const CHART_MONEY = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
const INR = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 })
const currency = (value) => INR.format(Number(value) || 0)
const dateText = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"
const titleCase = (value) => String(value || "—").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())

function StatusPill({ value }) {
  const key = String(value || "unpaid").toLowerCase()
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${STATUS_CLASSES[key] || STATUS_CLASSES.unpaid}`}>{titleCase(key)}</span>
}

function EmptyChart({ title, description = "No matching records for this date range." }) {
  return <div className="flex min-h-[245px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-secondary/20 px-6 text-center">
    <div className="mb-3 rounded-xl bg-card p-3 text-gray-400 shadow-sm"><BarChart3 className="h-5 w-5" /></div>
    <p className="text-sm font-semibold text-foreground">{title}</p>
    <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">{description}</p>
  </div>
}

function ChartPanel({ title, subtitle, action, children, className = "" }) {
  return <Card className={`overflow-hidden ${className}`}>
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-6">
      <div><h3 className="text-sm font-semibold text-foreground">{title}</h3>{subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}</div>
      {action}
    </div>
    <CardContent className="px-3 pb-5 pt-4 sm:px-5">{children}</CardContent>
  </Card>
}

function ChartTip({ active, payload, label, money = false }) {
  if (!active || !payload?.length) return null
  return <div className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xl">
    <p className="mb-1.5 text-xs font-semibold text-foreground">{label}</p>
    {payload.map((item) => <div key={item.dataKey} className="flex items-center justify-between gap-5 text-xs leading-5">
      <span className="text-gray-500">{item.name}</span><span className="font-semibold text-foreground">{money ? currency(item.value) : CHART_MONEY.format(Number(item.value) || 0)}</span>
    </div>)}
  </div>
}

function MetricCard({ title, value, detail, icon: Icon, tone, growth }) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-300",
    rose: "bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300",
  }
  return <Card className="group relative overflow-hidden p-4 sm:p-5">
    <div className="flex items-start justify-between gap-2">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{createElement(Icon, { className: "h-5 w-5" })}</div>
      {growth !== undefined && growth !== null && <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${growth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        {growth >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(growth).toFixed(1)}%
      </span>}
    </div>
    <p className="mt-4 text-xs font-medium text-gray-500">{title}</p>
    <p className="mt-1 text-[1.6rem] font-bold tracking-tight text-foreground sm:text-3xl">{value}</p>
    <p className="mt-1 truncate text-[11px] text-gray-500">{detail}</p>
  </Card>
}

function TextSelect({ label, value, onChange, children, className = "" }) {
  return <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
    {label && <span className="text-[11px] font-medium text-gray-500">{label}</span>}
    <select value={value} onChange={onChange} className="h-10 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none ring-offset-background transition focus:ring-2 focus:ring-ring">
      {children}
    </select>
  </label>
}

function csvDownload(rows, name) {
  if (!rows?.length) {
    toast("There are no rows to export for these filters.")
    return
  }
  const headers = Object.keys(rows[0])
  const cell = (value) => {
    let text = value === null || value === undefined ? "" : typeof value === "object" ? JSON.stringify(value) : String(value)
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  const csv = [headers.map(cell).join(","), ...rows.map((row) => headers.map((header) => cell(row[header])).join(","))].join("\r\n")
  const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = `syncliving-${name}-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

const emptyPlan = { name: "", description: "", monthly_price: "", yearly_price: "", max_units: "", max_residents: "", max_admins: "", features: "", is_active: true }

function PlanEditor({ plan, onClose, onSaved }) {
  const [form, setForm] = useState(() => plan ? {
    ...plan,
    monthly_price: plan.monthly_price ?? "",
    yearly_price: plan.yearly_price ?? "",
    max_units: plan.max_units ?? "",
    max_residents: plan.max_residents ?? "",
    max_admins: plan.max_admins ?? "",
    features: Array.isArray(plan.features) ? plan.features.join(", ") : "",
  } : emptyPlan)
  const [saving, setSaving] = useState(false)
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const numeric = (value) => value === "" ? null : Number(value)
    const payload = {
      name: form.name,
      description: form.description || null,
      monthly_price: numeric(form.monthly_price),
      yearly_price: numeric(form.yearly_price),
      max_units: numeric(form.max_units),
      max_residents: numeric(form.max_residents),
      max_admins: numeric(form.max_admins),
      features: form.features.split(",").map((feature) => feature.trim()).filter(Boolean),
    }
    try {
      if (plan) {
        await updateMonetizationPlan(plan.id, { ...payload, is_active: form.is_active })
        toast.success("Plan updated")
      } else {
        await createMonetizationPlan(payload)
        toast.success("Plan created")
      }
      await onSaved()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save this plan")
    } finally {
      setSaving(false)
    }
  }

  const priceInput = (field, label) => <label className="space-y-1.5"><span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span><div className="relative"><IndianRupee className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input type="number" min="0" step="0.01" placeholder="Not set" value={form[field]} onChange={(event) => update(field, event.target.value)} className="pl-9" /></div></label>
  const limitInput = (field, label) => <label className="space-y-1.5"><span className="text-xs font-medium text-gray-600 dark:text-gray-300">{label}</span><Input type="number" min="0" step="1" placeholder="No limit" value={form[field]} onChange={(event) => update(field, event.target.value)} /></label>

  return <Modal isOpen onClose={onClose} title={plan ? "Edit subscription plan" : "Create subscription plan"} className="sm:max-w-2xl">
    {!plan && <div className="mb-4 rounded-lg border border-indigo-100 bg-indigo-50/70 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">Name suggestions</p>
      <div className="mt-2 flex flex-wrap gap-1.5">{["Free", "Basic", "Premium", "Enterprise"].map((name) => <button key={name} type="button" onClick={() => update("name", name)} className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">{name}</button>)}</div>
      <p className="mt-2 text-[11px] text-gray-500">Suggestions only; set your own pricing and feature limits before saving.</p>
    </div>}
    <form onSubmit={save} className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-gray-600 dark:text-gray-300">Plan name</span><Input required minLength="2" maxLength="120" value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="For example, your community plan" /></label>
        <label className="space-y-1.5 sm:col-span-2"><span className="text-xs font-medium text-gray-600 dark:text-gray-300">Description</span><textarea maxLength="1000" value={form.description || ""} onChange={(event) => update("description", event.target.value)} className="min-h-20 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="Who this plan is for, or what it includes" /></label>
        {priceInput("monthly_price", "Monthly price (INR)")}{priceInput("yearly_price", "Yearly price (INR)")}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Feature limits <span className="font-normal normal-case">· leave blank for no limit</span></p>
        <div className="grid gap-3 sm:grid-cols-3">{limitInput("max_units", "Apartment units")}{limitInput("max_residents", "Residents")}{limitInput("max_admins", "Administrators")}</div>
      </div>
      <label className="block space-y-1.5"><span className="text-xs font-medium text-gray-600 dark:text-gray-300">Included features <span className="font-normal text-gray-400">· comma separated</span></span><Input value={form.features} onChange={(event) => update("features", event.target.value)} placeholder="Visitor passes, QR entry, resident portal" /></label>
      <div className="flex flex-col-reverse justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        {plan && <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300"><input type="checkbox" checked={Boolean(form.is_active)} onChange={(event) => update("is_active", event.target.checked)} className="h-4 w-4 rounded border-input text-primary focus:ring-ring" />Available for new subscriptions</label>}
        {!plan && <p className="text-xs text-gray-500">No example prices are pre-filled.</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{plan ? "Save changes" : "Save plan"}</Button></div>
      </div>
    </form>
  </Modal>
}

function SubscriptionDetails({ id, onClose, onSaved }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState("")
  useEffect(() => {
    let active = true
    getMonetizationSubscription(id).then((result) => {
      if (active) { setDetail(result.data); setStatus(result.data.status) }
    }).catch((error) => toast.error(error.response?.data?.message || "Could not load subscription details"))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [id])

  const saveStatus = async () => {
    setSaving(true)
    try {
      await updateMonetizationSubscription(id, { status })
      toast.success("Subscription status updated")
      const result = await getMonetizationSubscription(id)
      setDetail(result.data)
      await onSaved()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the subscription")
    } finally { setSaving(false) }
  }

  return <Modal isOpen onClose={onClose} title="Subscription details" className="sm:max-w-3xl">
    {loading ? <div className="flex items-center justify-center gap-2 py-14 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading subscription…</div> : detail ? <div className="space-y-6">
      <div className="grid gap-3 rounded-xl bg-secondary/30 p-4 sm:grid-cols-3">
        <Info label="Apartment complex" value={detail.complex_name} />
        <Info label="Subscription plan" value={detail.plan_name} />
        <Info label="Contract amount" value={`${currency(detail.amount)} / ${detail.billing_cycle}`} />
        <Info label="Started" value={dateText(detail.started_at)} />
        <Info label="Renewal date" value={dateText(detail.renewal_at)} />
        <Info label="Latest payment" value={<StatusPill value={detail.payment_status} />} />
      </div>
      <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold">Subscription status</p><p className="mt-1 text-xs text-gray-500">Changing a subscription does not collect or confirm a payment.</p></div>
        <div className="flex gap-2"><select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-input bg-card px-3 text-sm"><option value="active">Active</option><option value="trial">Trial</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select><Button disabled={saving || status === detail.status} onClick={saveStatus} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Update</Button></div>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Payment history</h4>{detail.transactions?.length ? <div className="space-y-2">{detail.transactions.map((transaction) => <div key={transaction.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"><div><p className="text-sm font-medium">{currency(transaction.amount)} <span className="font-normal text-gray-500">· {dateText(transaction.paid_at || transaction.created_at)}</span></p><p className="text-[11px] text-gray-500">Refund {currency(transaction.refund_amount)}{transaction.provider_reference ? ` · ${transaction.provider_reference}` : ""}</p></div><StatusPill value={transaction.status} /></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-xs text-gray-500">No confirmed SaaS payment records for this subscription.</p>}</div>
        <div><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Subscription activity</h4>{detail.events?.length ? <div className="space-y-2">{detail.events.map((event) => <div key={event.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5"><span className="text-sm font-medium">{titleCase(event.event_type)}</span><span className="text-xs text-gray-500">{dateText(event.occurred_at)}</span></div>)}</div> : <p className="rounded-lg border border-dashed border-border p-4 text-xs text-gray-500">No recorded changes yet.</p>}</div>
      </div>
      {detail.notes && <div className="rounded-lg border border-border p-3"><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm">{detail.notes}</p></div>}
    </div> : <EmptyChart title="Subscription unavailable" description="This record could not be found." />}
  </Modal>
}

function Info({ label, value }) {
  return <div><p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p><div className="mt-1 text-sm font-semibold text-foreground">{value || "—"}</div></div>
}

function NewSubscription({ complexes, plans, onClose, onSaved }) {
  const [form, setForm] = useState({ complex_id: "", plan_id: "", billing_cycle: "monthly", status: "trial", amount: "", renewal_at: "", notes: "" })
  const [saving, setSaving] = useState(false)
  const selectedPlan = plans.find((plan) => plan.id === form.plan_id)
  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      amount: form.amount === "" ? undefined : Number(form.amount),
      renewal_at: form.renewal_at ? new Date(`${form.renewal_at}T12:00:00`).toISOString() : undefined,
      notes: form.notes || undefined,
    }
    try {
      await createMonetizationSubscription(payload)
      toast.success("Subscription recorded")
      await onSaved()
      onClose()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not record this subscription")
    } finally { setSaving(false) }
  }
  return <Modal isOpen onClose={onClose} title="Record a subscription" className="sm:max-w-xl">
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">This records the community's subscription details only. It does not create a charge or mark any payment as collected.</div>
    <form onSubmit={save} className="space-y-4">
      <TextSelect label="Apartment complex" value={form.complex_id} onChange={(event) => setForm({ ...form, complex_id: event.target.value })}><option value="">Choose a complex</option>{complexes.map((complex) => <option key={complex.id} value={complex.id}>{complex.name}</option>)}</TextSelect>
      <TextSelect label="Plan" value={form.plan_id} onChange={(event) => setForm({ ...form, plan_id: event.target.value })}><option value="">Choose a plan</option>{plans.filter((plan) => plan.is_active).map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</TextSelect>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextSelect label="Billing cycle" value={form.billing_cycle} onChange={(event) => setForm({ ...form, billing_cycle: event.target.value })}><option value="monthly">Monthly</option><option value="yearly">Yearly</option></TextSelect>
        <TextSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="trial">Trial</option><option value="active">Active</option></TextSelect>
        <label className="space-y-1.5"><span className="text-[11px] font-medium text-gray-500">Contract price (INR) · optional</span><Input type="number" min="0" step="0.01" placeholder={selectedPlan ? (selectedPlan[form.billing_cycle === "monthly" ? "monthly_price" : "yearly_price"] == null ? "Plan price not set" : String(selectedPlan[form.billing_cycle === "monthly" ? "monthly_price" : "yearly_price"])) : "Use plan price"} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
        <label className="space-y-1.5"><span className="text-[11px] font-medium text-gray-500">Renewal date · optional</span><Input type="date" value={form.renewal_at} onChange={(event) => setForm({ ...form, renewal_at: event.target.value })} /></label>
      </div>
      <label className="block space-y-1.5"><span className="text-[11px] font-medium text-gray-500">Internal notes · optional</span><textarea maxLength="1000" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="min-h-16 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" /></label>
      <div className="flex justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={saving || !form.complex_id || !form.plan_id} className="gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Record subscription</Button></div>
    </form>
  </Modal>
}

export default function MonetizationAnalytics() {
  const [range, setRange] = useState("30d")
  const [complexId, setComplexId] = useState("")
  const [tab, setTab] = useState("overview")
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const hasLoadedRef = useRef(false)
  const [refreshToken, setRefreshToken] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [planFilter, setPlanFilter] = useState("")
  const [sort, setSort] = useState("started")
  const [order, setOrder] = useState("desc")
  const [page, setPage] = useState(1)
  const [activeReport, setActiveReport] = useState("revenue")
  const [exporting, setExporting] = useState(false)
  const [planEditor, setPlanEditor] = useState(undefined)
  const [newSubscriptionOpen, setNewSubscriptionOpen] = useState(false)
  const [selectedSubscription, setSelectedSubscription] = useState(null)

  useEffect(() => {
    let live = true
    const timer = setTimeout(async () => {
      if (!hasLoadedRef.current) setLoading(true)
      else setRefreshing(true)
      setError("")
      try {
        const result = await getMonetizationDashboard({
          range, complex_id: complexId || undefined, page, page_size: 10,
          search: search || undefined, status: statusFilter || undefined,
          plan_id: planFilter || undefined, sort, order,
        })
        if (live) { setData(result.data); hasLoadedRef.current = true }
      } catch (requestError) {
        if (live) setError(requestError.response?.data?.message || "Could not load monetization analytics.")
      } finally {
        if (live) { setLoading(false); setRefreshing(false) }
      }
    }, 160)
    return () => { live = false; clearTimeout(timer) }
  }, [range, complexId, page, search, statusFilter, planFilter, sort, order, refreshToken])

  const refresh = async () => setRefreshToken((value) => value + 1)
  const metrics = data?.metrics || {}
  const subscriptions = data?.subscriptions || { rows: [], page: 1, page_count: 0, total: 0 }
  const hasRevenueInRange = useMemo(() => data?.revenue_trend?.some((row) => Number(row.gross) > 0 || Number(row.refunds) > 0) || false, [data])
  const tabs = [{ id: "overview", label: "Overview" }, { id: "subscriptions", label: "Subscriptions" }, { id: "plans", label: "Plans" }, { id: "reports", label: "Reports" }]

  const selectSort = (next) => {
    if (sort === next) setOrder((value) => value === "asc" ? "desc" : "asc")
    else { setSort(next); setOrder("desc") }
  }
  const onFilter = (setter, value) => { setter(value); setPage(1) }
  const exportReport = async () => {
    setExporting(true)
    try {
      const params = {
        type: activeReport, range, complex_id: complexId || undefined,
        ...(activeReport === "subscriptions" ? { status: statusFilter || undefined, plan_id: planFilter || undefined, search: search || undefined, sort, order } : {}),
      }
      const result = await getMonetizationReport(params)
      csvDownload(result.data, activeReport)
      if (result.truncated) toast("Export is capped at 5,000 matching rows.")
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Could not export this report")
    } finally { setExporting(false) }
  }

  if (loading && !data) return <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-500"><Loader2 className="h-7 w-7 animate-spin text-primary" /><p className="text-sm">Loading platform analytics…</p></div>

  if (error && !data) return <div className="mx-auto max-w-xl py-16 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-500 dark:bg-red-950/40"><Activity className="h-6 w-6" /></div><h2 className="text-lg font-semibold">Analytics are unavailable</h2><p className="mt-2 text-sm text-gray-500">{error}</p><Button onClick={refresh} className="mt-5 gap-2"><RefreshCw className="h-4 w-4" />Try again</Button></div>

  return <div className="space-y-6 pb-8">
    <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div>
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-700 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-300"><ShieldCheck className="h-3.5 w-3.5" />Super admin · platform wide</div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Monetization &amp; Analytics</h2>
        <p className="mt-1 text-sm text-gray-500">SaaS revenue, subscription performance and community usage.</p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <TextSelect label="Date range" value={range} onChange={(event) => { setRange(event.target.value); setPage(1) }} className="sm:min-w-36"><>{RANGES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</></TextSelect>
        <TextSelect label="Apartment complex" value={complexId} onChange={(event) => { setComplexId(event.target.value); setPage(1) }} className="sm:min-w-52"><option value="">All complexes</option>{(data?.complexes || []).map((complex) => <option key={complex.id} value={complex.id}>{complex.name}</option>)}</TextSelect>
        <Button variant="outline" onClick={refresh} title="Refresh dashboard" className="h-10 gap-2"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /><span className="sm:hidden">Refresh</span></Button>
      </div>
    </div>

    {error && <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"><span>{error} Showing the most recently loaded values.</span><button onClick={refresh} className="font-semibold underline">Retry</button></div>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
      <MetricCard title="Total revenue" value={currency(metrics.total_revenue)} detail={data?.has_financial_records ? `All time · gross ${currency(metrics.gross_revenue)} · refunds ${currency(metrics.refunds)}` : "No SaaS payment records yet"} icon={IndianRupee} tone="emerald" />
      <MetricCard title="Monthly recurring revenue" value={currency(metrics.mrr)} detail="Contracted MRR · active recurring plans" icon={CircleDollarSign} tone="indigo" />
      <MetricCard title="Active subscriptions" value={CHART_MONEY.format(metrics.active_subscriptions || 0)} detail={metrics.trial_subscriptions ? `${metrics.trial_subscriptions} trial${metrics.trial_subscriptions === 1 ? "" : "s"} · excluded from MRR` : "Paid or contracted, excluding trials"} icon={CreditCard} tone="violet" />
      <MetricCard title="Registered residents" value={CHART_MONEY.format(metrics.total_residents || 0)} detail="Resident accounts in the selected scope" icon={Users} tone="blue" />
      <MetricCard title="Apartment complexes" value={CHART_MONEY.format(metrics.total_complexes || 0)} detail="Communities registered on SyncLiving" icon={Building2} tone="amber" />
      <MetricCard title="Subscription growth" value={metrics.subscription_growth_rate == null ? "—" : `${metrics.subscription_growth_rate >= 0 ? "+" : ""}${metrics.subscription_growth_rate.toFixed(1)}%`} detail={metrics.growth_comparison_available ? "Versus the beginning of this period" : "No previous active-subscription baseline"} icon={Activity} tone="rose" growth={metrics.growth_comparison_available ? metrics.subscription_growth_rate : undefined} />
    </div>

    {!data?.has_financial_records && <div className="flex flex-col gap-2 rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 dark:border-blue-900 dark:from-blue-950/35 dark:to-indigo-950/25 sm:flex-row sm:items-center">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300"><CircleDollarSign className="h-4 w-4" /></div>
      <div><p className="text-sm font-semibold text-blue-950 dark:text-blue-100">SaaS revenue starts when confirmed platform payments are recorded.</p><p className="text-xs leading-5 text-blue-800/80 dark:text-blue-200/70">Apartment maintenance payments are kept separate. Subscription value is not counted as money collected.</p></div>
    </div>}

    <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5 shadow-sm">
      {tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === item.id ? "bg-indigo-600 text-white shadow-sm" : "text-gray-500 hover:bg-secondary hover:text-foreground"}`}>{item.label}</button>)}
    </div>

    {tab === "overview" && <Overview data={data} hasRevenueInRange={hasRevenueInRange} range={range} />}
    {tab === "subscriptions" && <SubscriptionSection
      rows={subscriptions.rows || []} page={subscriptions.page || page} pageCount={subscriptions.page_count || 0} total={subscriptions.total || 0}
      search={search} setSearch={(value) => onFilter(setSearch, value)} statusFilter={statusFilter} setStatusFilter={(value) => onFilter(setStatusFilter, value)}
      planFilter={planFilter} setPlanFilter={(value) => onFilter(setPlanFilter, value)} plans={data?.plans || []} sort={sort} order={order} selectSort={selectSort}
      setPage={setPage} onDetails={setSelectedSubscription} onCreate={() => setNewSubscriptionOpen(true)} loading={refreshing}
    />}
    {tab === "plans" && <PlanSection data={data} onNew={() => setPlanEditor(null)} onEdit={(plan) => setPlanEditor(plan)} onToggle={async (plan) => {
      try { await updateMonetizationPlan(plan.id, { is_active: !plan.is_active }); toast.success(plan.is_active ? "Plan made unavailable" : "Plan is available again"); refresh() }
      catch (requestError) { toast.error(requestError.response?.data?.message || "Could not update this plan") }
    }} />}
    {tab === "reports" && <ReportsSection activeReport={activeReport} setActiveReport={setActiveReport} onExport={exportReport} exporting={exporting} data={data} />}

    {planEditor !== undefined && <PlanEditor plan={planEditor} onClose={() => setPlanEditor(undefined)} onSaved={refresh} />}
    {newSubscriptionOpen && <NewSubscription complexes={data?.complexes || []} plans={data?.plans || []} onClose={() => setNewSubscriptionOpen(false)} onSaved={refresh} />}
    {selectedSubscription && <SubscriptionDetails id={selectedSubscription} onClose={() => setSelectedSubscription(null)} onSaved={refresh} />}
  </div>
}

function Overview({ data, hasRevenueInRange, range }) {
  const usage = data?.usage || {}
  const cycleData = (data?.revenue_by_cycle || []).map((item) => ({ ...item, name: titleCase(item.billing_cycle), value: Number(item.net) }))
  const planData = (data?.plan_distribution || []).map((item) => ({ ...item, count: Number(item.active_subscriptions) + Number(item.trials) }))
  return <div className="space-y-5">
    <div className="grid gap-4 xl:grid-cols-3">
      <ChartPanel title="Revenue trend" subtitle="Gross collection, refunds and net revenue · INR" className="xl:col-span-2">
        {hasRevenueInRange ? <ResponsiveContainer width="100%" height={280}><LineChart data={data.revenue_trend} margin={{ top: 8, right: 14, bottom: 0, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={22} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => `₹${CHART_MONEY.format(value)}`} width={65} /><Tooltip content={<ChartTip money />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} /><Line type="monotone" dataKey="gross" name="Gross" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /><Line type="monotone" dataKey="refunds" name="Refunds" stroke="#f59e0b" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="net" name="Net" stroke="#10b981" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer> : <EmptyChart title="No SaaS revenue in this range" description="Revenue appears after captured platform subscription payments are recorded. No demo values are shown." />}
      </ChartPanel>
      <ChartPanel title="Billing cycle revenue" subtitle="Net collected by recurring billing cycle">
        {cycleData.some((item) => item.value > 0) ? <div className="relative"><ResponsiveContainer width="100%" height={240}><PieChart><Pie data={cycleData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3} stroke="none">{cycleData.map((item, index) => <Cell key={item.billing_cycle} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip content={<ChartTip money />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer></div> : <EmptyChart title="No billing cycle revenue yet" description="Monthly and yearly totals will appear when confirmed SaaS transactions exist." />}
      </ChartPanel>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Revenue by apartment complex" subtitle="Net SaaS revenue for the selected period">
        {hasRevenueInRange && data.revenue_by_complex?.some((item) => Number(item.net) > 0) ? <ResponsiveContainer width="100%" height={270}><BarChart data={data.revenue_by_complex} margin={{ top: 6, right: 10, left: 4, bottom: 4 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="complex_name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} interval={0} angle={-10} textAnchor="end" height={52} /><YAxis tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => `₹${CHART_MONEY.format(value)}`} width={65} /><Tooltip content={<ChartTip money />} /><Bar dataKey="net" name="Net revenue" fill="#4f46e5" radius={[6, 6, 0, 0]} maxBarSize={48} /></BarChart></ResponsiveContainer> : <EmptyChart title="No revenue by complex" />}
      </ChartPanel>
      <ChartPanel title="Revenue by subscription plan" subtitle="Net SaaS revenue · plan name captured at transaction time">
        {hasRevenueInRange && data.revenue_by_plan?.some((item) => Number(item.net) > 0) ? <ResponsiveContainer width="100%" height={270}><BarChart data={data.revenue_by_plan} layout="vertical" margin={{ top: 2, right: 18, left: 12, bottom: 2 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" /><XAxis type="number" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} tickFormatter={(value) => `₹${CHART_MONEY.format(value)}`} /><YAxis type="category" dataKey="plan_name" tickLine={false} axisLine={false} tick={{ fill: "#64748b", fontSize: 11 }} width={95} /><Tooltip content={<ChartTip money />} /><Bar dataKey="net" name="Net revenue" fill="#0ea5e9" radius={[0, 6, 6, 0]} maxBarSize={30} /></BarChart></ResponsiveContainer> : <EmptyChart title="No revenue by plan" description="Plan revenue is based on collected transactions, not subscription prices." />}
      </ChartPanel>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      <ChartPanel title="Subscription growth" subtitle="Active subscription records over time; trials are included in the trend">
        {data.subscription_growth?.some((item) => Number(item.active_subscriptions) > 0) ? <ResponsiveContainer width="100%" height={260}><AreaChart data={data.subscription_growth} margin={{ top: 8, right: 10, left: 2, bottom: 0 }}><defs><linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4f46e5" stopOpacity={0.24} /><stop offset="95%" stopColor="#4f46e5" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={20} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={35} /><Tooltip content={<ChartTip />} /><Area type="monotone" dataKey="active_subscriptions" name="Active subscriptions" stroke="#4f46e5" strokeWidth={2.5} fill="url(#growthFill)" /></AreaChart></ResponsiveContainer> : <EmptyChart title="No subscription history" description="As subscriptions are recorded, their active counts will appear here." />}
      </ChartPanel>
      <ChartPanel title="Community usage" subtitle={`Visitor and security activity · ${RANGES.find((item) => item.value === range)?.label}`}>
        {data.usage_trend?.some((item) => Number(item.passes) + Number(item.qr_scans) + Number(item.checkins) + Number(item.checkouts) + Number(item.security_alerts) > 0) ? <ResponsiveContainer width="100%" height={260}><AreaChart data={data.usage_trend} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} minTickGap={20} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} width={35} /><Tooltip content={<ChartTip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 8 }} /><Area type="monotone" dataKey="passes" name="Passes" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.09} /><Area type="monotone" dataKey="qr_scans" name="QR scans" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.09} /><Area type="monotone" dataKey="checkins" name="Check-ins" stroke="#10b981" fill="#10b981" fillOpacity={0.09} /><Area type="monotone" dataKey="checkouts" name="Check-outs" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.07} /><Area type="monotone" dataKey="security_alerts" name="Security alerts" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.05} /></AreaChart></ResponsiveContainer> : <EmptyChart title="No usage events in this range" description="Pass, QR, check-in, check-out and security activity is tracked from real application events." />}
      </ChartPanel>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
      <ActivityTile icon={FileText} label="Visitor passes" value={usage.visitor_passes} color="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" />
      <ActivityTile icon={Activity} label="QR scans" value={usage.qr_scans} color="text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30" />
      <ActivityTile icon={ArrowDownRight} label="Visitor check-ins" value={usage.visitor_checkins} color="text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30" />
      <ActivityTile icon={ArrowUpRight} label="Visitor check-outs" value={usage.visitor_checkouts} color="text-blue-700 bg-blue-50 dark:bg-blue-900/30" />
      <ActivityTile icon={ShieldCheck} label="Security activity" value={usage.security_activity} color="text-amber-700 bg-amber-50 dark:bg-amber-900/30" />
      <ActivityTile icon={Users} label="Residents engaged" value={usage.engaged_residents} color="text-violet-700 bg-violet-50 dark:bg-violet-900/30" />
    </div>

    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
      <ChartPanel title="Plan distribution" subtitle="Current active subscriptions and trials by plan">
        {planData.some((item) => item.count > 0) ? <div className="grid items-center gap-2 sm:grid-cols-[1.1fr_0.9fr]"><ResponsiveContainer width="100%" height={245}><PieChart><Pie data={planData.filter((item) => item.count > 0)} dataKey="count" nameKey="name" innerRadius={60} outerRadius={94} paddingAngle={3} stroke="none">{planData.filter((item) => item.count > 0).map((item, index) => <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}</Pie><Tooltip content={<ChartTip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /></PieChart></ResponsiveContainer><div className="space-y-2">{planData.filter((item) => item.count > 0).map((item, index) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"><span className="flex min-w-0 items-center gap-2 text-xs font-medium"><i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} /> <span className="truncate">{item.name}</span></span><span className="shrink-0 text-xs text-gray-500">{item.active_subscriptions} active · {item.trials} trial</span></div>)}</div></div> : <EmptyChart title="No plans with subscriptions" description="Create a plan and record a subscription to show distribution." />}
      </ChartPanel>
      <ChartPanel title="Subscription activity" subtitle="Changes recorded during the selected range">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <ActivityTile icon={Plus} label="Started" value={data.subscription_activity?.started} color="text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30" />
          <ActivityTile icon={ArrowUpRight} label="Upgraded" value={data.subscription_activity?.upgrades} color="text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30" />
          <ActivityTile icon={ArrowDownRight} label="Downgraded" value={data.subscription_activity?.downgrades} color="text-amber-600 bg-amber-50 dark:bg-amber-900/30" />
          <ActivityTile icon={X} label="Cancelled" value={data.subscription_activity?.cancellations} color="text-rose-600 bg-rose-50 dark:bg-rose-900/30" />
          <ActivityTile icon={RefreshCw} label="Renewed" value={data.subscription_activity?.renewals} color="text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30" />
          <ActivityTile icon={Clock3} label="Trials" value={metricsValue(data?.metrics?.trial_subscriptions)} color="text-blue-600 bg-blue-50 dark:bg-blue-900/30" />
        </div>
      </ChartPanel>
    </div>
    <p className="px-1 text-[11px] leading-5 text-gray-500">Revenue reflects captured platform subscription transactions less recorded refunds. Contracted MRR is an estimate from active recurring subscription records. Resident invoice payments are excluded.</p>
  </div>
}

const metricsValue = (value) => Number(value || 0)
function ActivityTile({ icon: Icon, label, value, color }) {
  return <div className="rounded-xl border border-border p-3"><div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>{createElement(Icon, { className: "h-4 w-4" })}</div><p className="text-[11px] text-gray-500">{label}</p><p className="mt-0.5 text-lg font-bold text-foreground">{metricsValue(value).toLocaleString("en-IN")}</p></div>
}

function SubscriptionSection({ rows, page, pageCount, total, search, setSearch, statusFilter, setStatusFilter, planFilter, setPlanFilter, plans, sort, order, selectSort, setPage, onDetails, onCreate, loading }) {
  const header = (name, key) => <th key={key || name} className="px-4 py-3 text-left"><button className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 hover:text-foreground" onClick={() => key && selectSort(key)}>{name}{key && <span className={sort === key ? "text-indigo-600" : "text-gray-300"}>↕</span>}{key && sort === key && <span className="text-[9px]">{order === "asc" ? "↑" : "↓"}</span>}</button></th>
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div><h3 className="text-lg font-semibold">Subscription management</h3><p className="mt-1 text-xs text-gray-500">{total.toLocaleString("en-IN")} subscription records · payment state comes from confirmed transactions.</p></div>
      <Button onClick={onCreate} className="gap-2 self-start"><Plus className="h-4 w-4" />Record subscription</Button>
    </div>
    <Card className="overflow-hidden">
      <div className="grid gap-2 border-b border-border p-4 md:grid-cols-[minmax(220px,1fr)_180px_200px]">
        <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search community or plan" className="pl-9" /></label>
        <TextSelect value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="trial">Trial</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></TextSelect>
        <TextSelect value={planFilter} onChange={(event) => setPlanFilter(event.target.value)}><option value="">All plans</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</TextSelect>
      </div>
      <div className="relative overflow-x-auto">
        {loading && <div className="absolute inset-x-0 top-0 z-10 h-0.5 animate-pulse bg-indigo-500" />}
        <table className="min-w-[980px] w-full border-collapse text-sm">
          <thead className="bg-secondary/30"><tr>{[
            header("Community", "complex"), header("Plan", "plan"), header("Plan price", "amount"), header("Billing"), header("Status", "status"), header("Started", "started"), header("Next renewal", "renewal"), header("Payment"),
          ]}<th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wide text-gray-500">Details</th></tr></thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => <tr key={row.id} className="transition hover:bg-secondary/20">
              <td className="px-4 py-3.5"><p className="font-semibold text-foreground">{row.complex_name}</p><p className="mt-0.5 text-[11px] text-gray-500">Started {dateText(row.started_at)}</p></td>
              <td className="px-4 py-3.5"><span className="font-medium">{row.plan_name}</span></td>
              <td className="px-4 py-3.5 font-semibold">{currency(row.amount)}</td>
              <td className="px-4 py-3.5 capitalize text-gray-600 dark:text-gray-300">{row.billing_cycle}</td>
              <td className="px-4 py-3.5"><StatusPill value={row.status} /></td>
              <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">{dateText(row.started_at)}</td>
              <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-300">{dateText(row.renewal_at)}</td>
              <td className="px-4 py-3.5"><StatusPill value={row.payment_status} /></td>
              <td className="px-4 py-3.5 text-right"><Button variant="ghost" size="sm" onClick={() => onDetails(row.id)} className="gap-1.5"><Eye className="h-3.5 w-3.5" />View</Button></td>
            </tr>)}
            {!rows.length && <tr><td colSpan={9} className="px-5 py-14"><EmptyChart title="No subscriptions match these filters" description="Clear a filter or record the first subscription to see it here." /></td></tr>}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">Page {pageCount ? page : 0} of {pageCount} · {total.toLocaleString("en-IN")} total records</p>
        <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="gap-1"><ChevronLeft className="h-4 w-4" />Previous</Button><Button variant="outline" size="sm" disabled={!pageCount || page >= pageCount} onClick={() => setPage((value) => value + 1)} className="gap-1">Next<ChevronRight className="h-4 w-4" /></Button></div>
      </div>
    </Card>
  </div>
}

function PlanSection({ data, onNew, onEdit, onToggle }) {
  const plans = data?.plans || []
  const monthPrice = (plan) => plan.monthly_price == null ? "Not set" : currency(plan.monthly_price)
  const yearPrice = (plan) => plan.yearly_price == null ? "Not set" : currency(plan.yearly_price)
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="text-lg font-semibold">Subscription plans</h3><p className="mt-1 text-xs text-gray-500">Configure prices and limits for SyncLiving communities. Empty prices mean the plan is not priced yet.</p></div><Button onClick={onNew} className="gap-2 self-start"><Plus className="h-4 w-4" />Create plan</Button></div>
    {!plans.length ? <Card className="p-8 sm:p-12"><EmptyChart title="No subscription plans configured" description="Add your own plans when pricing and feature limits are ready. Example names are available in the plan editor." /></Card> : <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {plans.map((plan, index) => <Card key={plan.id} className="overflow-hidden">
        <div className="h-1" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="text-lg font-semibold">{plan.name}</h4>{!plan.is_active && <Badge variant="secondary">Unavailable</Badge>}</div><p className="mt-1 min-h-9 text-xs leading-5 text-gray-500">{plan.description || "No description provided."}</p></div><button aria-label={`Edit ${plan.name}`} onClick={() => onEdit(plan)} className="rounded-lg border border-border p-2 text-gray-500 hover:bg-secondary hover:text-foreground"><Pencil className="h-4 w-4" /></button></div>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-secondary/30 p-3"><div><p className="text-[10px] uppercase tracking-wide text-gray-500">Monthly</p><p className="mt-1 text-lg font-bold">{monthPrice(plan)}</p></div><div><p className="text-[10px] uppercase tracking-wide text-gray-500">Yearly</p><p className="mt-1 text-lg font-bold">{yearPrice(plan)}</p></div></div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">{[[plan.max_units, "Units"], [plan.max_residents, "Residents"], [plan.max_admins, "Admins"]].map(([value, label]) => <div key={label} className="rounded-lg border border-border px-2 py-2"><p className="text-sm font-semibold">{value == null ? "∞" : value}</p><p className="mt-0.5 text-[10px] text-gray-500">{label}</p></div>)}</div>
          {plan.features?.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{plan.features.map((feature) => <span key={feature} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-300"><Check className="h-3 w-3" />{feature}</span>)}</div>}
          <div className="mt-5 flex items-center justify-between border-t border-border pt-3"><p className="text-xs text-gray-500">{plan.active_subscriptions} active · {plan.trials} trial</p><Button variant="outline" size="sm" onClick={() => onToggle(plan)}>{plan.is_active ? "Make unavailable" : "Make available"}</Button></div>
        </div>
      </Card>)}
    </div>}
    <div className="grid gap-4 md:grid-cols-2">
      <ChartPanel title="Plan distribution" subtitle="Active subscriptions and trials by plan">
        {plans.some((plan) => Number(plan.active_subscriptions) + Number(plan.trials) > 0) ? <ResponsiveContainer width="100%" height={245}><BarChart data={plans} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" /><XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#94a3b8", fontSize: 11 }} /><Tooltip content={<ChartTip />} /><Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} /><Bar dataKey="active_subscriptions" name="Active" fill="#4f46e5" radius={[5, 5, 0, 0]} /><Bar dataKey="trials" name="Trial" fill="#38bdf8" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyChart title="No plan subscriptions yet" />}
      </ChartPanel>
      <ChartPanel title="Subscription activity" subtitle="Changes in the selected date range"><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{[
        ["Started", data?.subscription_activity?.started, "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30", Plus],
        ["Upgraded", data?.subscription_activity?.upgrades, "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30", ArrowUpRight],
        ["Downgraded", data?.subscription_activity?.downgrades, "text-amber-600 bg-amber-50 dark:bg-amber-900/30", ArrowDownRight],
        ["Cancelled", data?.subscription_activity?.cancellations, "text-rose-600 bg-rose-50 dark:bg-rose-900/30", X],
        ["Renewed", data?.subscription_activity?.renewals, "text-cyan-700 bg-cyan-50 dark:bg-cyan-900/30", RefreshCw],
      ].map(([label, value, color, Icon]) => <ActivityTile key={label} icon={Icon} label={label} value={value} color={color} />)}</div></ChartPanel>
    </div>
  </div>
}

function ReportsSection({ activeReport, setActiveReport, onExport, exporting, data }) {
  const report = REPORTS.find((item) => item.id === activeReport)
  const counts = {
    revenue: data?.metrics?.period_transaction_count || 0,
    subscriptions: data?.subscriptions?.total || 0,
    usage: data?.usage_trend?.reduce((total, row) => total + Number(row.passes || 0) + Number(row.qr_scans || 0) + Number(row.checkins || 0) + Number(row.checkouts || 0) + Number(row.security_alerts || 0), 0) || 0,
    transactions: data?.metrics?.period_transaction_count || 0,
  }
  return <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
    <Card className="p-5 sm:p-6"><div className="flex items-start gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300"><FileText className="h-5 w-5" /></div><div><h3 className="text-lg font-semibold">Reports</h3><p className="mt-1 text-xs leading-5 text-gray-500">Exports use the selected date range, complex and report filters. Only super admins can request these records.</p></div></div>
      <div className="mt-5 space-y-2">{REPORTS.map((item) => <button key={item.id} onClick={() => setActiveReport(item.id)} className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${activeReport === item.id ? "border-indigo-300 bg-indigo-50/70 ring-1 ring-indigo-200 dark:border-indigo-800 dark:bg-indigo-950/30 dark:ring-indigo-900" : "border-border hover:bg-secondary/30"}`}><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold">{item.name}</span>{activeReport === item.id && <span className="h-2 w-2 rounded-full bg-indigo-600" />}</div><p className="mt-1 text-[11px] leading-5 text-gray-500">{item.description}</p></button>)}</div>
      <Button onClick={onExport} disabled={exporting} className="mt-5 w-full gap-2"><Download className="h-4 w-4" />{exporting ? "Preparing CSV…" : `Export ${report.name}`}</Button>
    </Card>
    <div className="space-y-4">
      <Card className="overflow-hidden"><div className="border-b border-border px-5 py-4"><div className="flex items-center justify-between gap-3"><div><h4 className="text-sm font-semibold">{report.name}</h4><p className="mt-1 text-xs text-gray-500">Current filter scope · {RANGES.find((item) => item.value === data?.range)?.label || "30 days"}</p></div><span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-gray-600 dark:text-gray-300">{counts[activeReport].toLocaleString("en-IN")} {activeReport === "subscriptions" ? "records" : "activity periods"}</span></div></div>
        <div className="p-5">
          <div className="grid gap-3 sm:grid-cols-2">{activeReport === "revenue" || activeReport === "transactions" ? <>
            <ReportValue label="Collected gross" value={currency(data?.metrics?.period_gross_revenue)} note="Captured platform payments in range" icon={IndianRupee} />
            <ReportValue label="Refunds" value={currency(data?.metrics?.period_refunds)} note="Recorded refunds in range" icon={ArrowDownRight} />
            <ReportValue label="Net collected" value={currency(data?.metrics?.period_net_revenue)} note="Gross less refunds in range" icon={CircleDollarSign} />
            <ReportValue label="Payment rows" value={counts[activeReport].toLocaleString("en-IN")} note="For the selected date window" icon={CreditCard} />
          </> : activeReport === "subscriptions" ? <>
            <ReportValue label="Total matching subscriptions" value={counts.subscriptions.toLocaleString("en-IN")} note="Filtered by status, plan and search" icon={CreditCard} />
            <ReportValue label="Active" value={data?.metrics?.active_subscriptions || 0} note="Current active contracts" icon={Check} />
            <ReportValue label="Trials" value={data?.metrics?.trial_subscriptions || 0} note="Trials excluded from MRR" icon={Clock3} />
            <ReportValue label="Cancellations" value={data?.subscription_activity?.cancellations || 0} note="In selected date range" icon={X} />
          </> : <>
            <ReportValue label="Visitor passes" value={data?.usage?.visitor_passes || 0} note="Created during selected dates" icon={FileText} />
            <ReportValue label="QR scans" value={data?.usage?.qr_scans || 0} note="Timestamped scan events" icon={Activity} />
            <ReportValue label="Check-ins / check-outs" value={`${data?.usage?.visitor_checkins || 0} / ${data?.usage?.visitor_checkouts || 0}`} note="Visitor gate events" icon={Users} />
            <ReportValue label="Security activity" value={data?.usage?.security_activity || 0} note="Check-in, check-out and alert events" icon={ShieldCheck} />
          </>}</div>
        </div>
      </Card>
      <Card className="border-blue-200 bg-blue-50/50 p-4 dark:border-blue-900 dark:bg-blue-950/20"><p className="text-xs font-semibold text-blue-900 dark:text-blue-200">Data handling</p><p className="mt-1 text-xs leading-5 text-blue-800/80 dark:text-blue-200/70">CSV exports are generated from the same server-side scope as this dashboard. SaaS transaction records remain empty until a confirmed platform payment is recorded; resident maintenance payments are never included.</p></Card>
    </div>
  </div>
}

function ReportValue({ label, value, note, icon: Icon }) {
  return <div className="rounded-xl border border-border p-3.5"><div className="flex items-center gap-2 text-gray-500">{createElement(Icon, { className: "h-4 w-4" })}<span className="text-[11px] font-medium">{label}</span></div><p className="mt-2 text-xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[10px] text-gray-500">{note}</p></div>
}
