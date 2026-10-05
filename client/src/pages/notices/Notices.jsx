import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Check, Eye, Megaphone, Plus, Send, X } from "lucide-react"
import toast from "react-hot-toast"
import { useAuthStore } from "../../store/useAuthStore"
import { useNotificationStore } from "../../store/useNotificationStore"
import { cancelNotice, createNotice, listNotices, markNoticeAsRead, sendNotice, updateNotice } from "../../api/notices"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/Card"
import { Input } from "../../components/ui/Input"
import { formFromNotice, noticeReviewState, upsertNotice } from "./noticeState.mjs"

const CATEGORY_LABELS = {
  maintenance: "Maintenance",
  water_supply: "Water Supply",
  electricity: "Electricity",
  safety: "Safety",
  events: "Events",
  general: "General",
}

const formatDateTime = (value) => value
  ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
  : "Not specified"

const toLocalInput = (value) => {
  if (!value) return ""
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

const toIso = (value) => value ? new Date(value).toISOString() : null

const initialForm = () => {
  const start = new Date(Date.now() + 60 * 60 * 1000)
  start.setMinutes(0, 0, 0)
  return {
    title: "",
    message: "",
    category: "general",
    priority: "normal",
    starts_at: toLocalInput(start),
    ends_at: "",
  }
}

const payloadFromForm = (form) => ({
  ...form,
  starts_at: toIso(form.starts_at),
  ends_at: toIso(form.ends_at),
})

function NoticeDetails({ notice, onClose, onMarkRead }) {
  if (!notice) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="notice-details-title">
      <div className="w-full max-w-xl rounded-t-2xl border bg-card p-5 shadow-2xl sm:rounded-xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex flex-wrap gap-2">
              <Badge variant="outline">{CATEGORY_LABELS[notice.category] || "General"}</Badge>
              {notice.priority === "important" && <Badge variant="destructive">Important</Badge>}
              {notice.status === "cancelled" && <Badge variant="secondary">Cancelled</Badge>}
            </div>
            <h2 id="notice-details-title" className="text-xl font-bold">{notice.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-2 text-gray-500 hover:bg-secondary" aria-label="Close notice details"><X className="h-5 w-5" /></button>
        </div>
        {notice.status === "cancelled" && <p className="mb-3 rounded-md bg-amber-50 p-3 text-sm font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">This notice has been cancelled by the society admin.</p>}
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">{notice.message}</p>
        <div className="mt-5 rounded-lg bg-secondary/40 p-3 text-sm">
          <p><span className="font-semibold">Starts:</span> {formatDateTime(notice.starts_at)}</p>
          {notice.ends_at && <p className="mt-1"><span className="font-semibold">Ends:</span> {formatDateTime(notice.ends_at)}</p>}
        </div>
        {!notice.is_read && notice.status !== "draft" && (
          <div className="mt-5 flex justify-end">
            <Button onClick={() => onMarkRead(notice)}><Check className="mr-2 h-4 w-4" />Mark as read</Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Notices() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === "admin"
  const refreshUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)
  const [notices, setNotices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [editingNotice, setEditingNotice] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [previewed, setPreviewed] = useState(false)
  const [selectedNotice, setSelectedNotice] = useState(null)
  const submitLock = useRef(false)
  const noticeFormRef = useRef(null)
  const scrollToReviewRef = useRef(false)

  useEffect(() => {
    if (!showForm || !scrollToReviewRef.current) return
    scrollToReviewRef.current = false
    noticeFormRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" })
  }, [showForm, editingNotice, previewed])

  const loadNotices = useCallback(async () => {
    try {
      const result = await listNotices()
      setNotices(Array.isArray(result.data) ? result.data : [])
    } catch {
      toast.error("Could not load notices")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { loadNotices() }, [loadNotices])

  const isFormValid = useMemo(() => (
    form.title.trim().length >= 3
    && form.message.trim().length >= 3
    && Boolean(form.starts_at)
    && (!form.ends_at || new Date(form.ends_at) >= new Date(form.starts_at))
  ), [form])

  const resetForm = () => {
    setForm(initialForm())
    setEditingNotice(null)
    setShowForm(false)
    setPreviewed(false)
  }

  const startNewNotice = () => {
    setForm(initialForm())
    setEditingNotice(null)
    setPreviewed(false)
    setShowForm(true)
  }

  const editNotice = (notice) => {
    setForm(formFromNotice(notice))
    setEditingNotice(notice)
    setPreviewed(false)
    setShowForm(true)
  }

  const reviewNotice = (notice) => {
    const review = noticeReviewState(notice)
    scrollToReviewRef.current = true
    setForm(review.form)
    setEditingNotice(review.notice)
    setPreviewed(review.previewed)
    setShowForm(review.showForm)
  }

  const saveDraft = async () => {
    if (!isFormValid) return toast.error("Add a title, message, start time, and a valid end time")
    if (submitLock.current) return
    submitLock.current = true
    setIsSaving(true)
    try {
      const payload = payloadFromForm(form)
      const result = editingNotice
        ? await updateNotice(editingNotice.id, payload)
        : await createNotice(payload)
      setEditingNotice(result.data)
      setNotices((current) => upsertNotice(current, result.data))
      setForm(formFromNotice(result.data))
      setPreviewed(false)
      toast.success(editingNotice?.status === "sent" ? "Notice updated for residents and tenants" : "Draft saved")
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save the notice")
    } finally {
      submitLock.current = false
      setIsSaving(false)
    }
  }

  const saveAndSend = async () => {
    if (!isFormValid) return toast.error("Add a title, message, start time, and a valid end time")
    if (!previewed) return toast.error("Preview the notice before sending it")
    if (submitLock.current) return
    const recipientText = "active residents and current tenants assigned to units in your complex"
    if (!window.confirm(`Send “${form.title.trim()}” to ${recipientText}?`)) return

    submitLock.current = true
    setIsSaving(true)
    try {
      let notice = editingNotice
      const payload = payloadFromForm(form)
      if (notice) {
        const updated = await updateNotice(notice.id, payload)
        notice = updated.data
        setEditingNotice(notice)
        setNotices((current) => upsertNotice(current, notice))
      } else {
        const created = await createNotice(payload)
        notice = created.data
        setEditingNotice(notice)
        setNotices((current) => upsertNotice(current, notice))
      }
      const result = await sendNotice(notice.id)
      setNotices((current) => upsertNotice(current, result.data))
      toast.success(`Notice sent to ${result.data.delivery_count} recipients`)
      resetForm()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not send the notice")
    } finally {
      submitLock.current = false
      setIsSaving(false)
    }
  }

  const cancel = async (notice) => {
    if (!window.confirm(`Cancel “${notice.title}”? Residents who received it will see the cancellation.`)) return
    try {
      await cancelNotice(notice.id)
      toast.success("Notice cancelled")
      await loadNotices()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not cancel the notice")
    }
  }

  const markRead = async (notice) => {
    try {
      await markNoticeAsRead(notice.id)
      setNotices((current) => current.map((item) => item.id === notice.id ? { ...item, is_read: true } : item))
      setSelectedNotice((current) => current?.id === notice.id ? { ...current, is_read: true } : current)
      await refreshUnreadCount()
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not mark the notice as read")
    }
  }

  const orderedNotices = useMemo(() => isAdmin ? notices : [...notices].sort((a, b) => {
    if (a.status === "cancelled" && b.status !== "cancelled") return 1
    if (b.status === "cancelled" && a.status !== "cancelled") return -1
    return new Date(a.starts_at) - new Date(b.starts_at)
  }), [isAdmin, notices])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Notices &amp; Notifications</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isAdmin ? "Create and manage announcements for residents and unit tenants in your complex." : "Announcements and upcoming updates for your complex."}
          </p>
        </div>
        {isAdmin && !showForm && <Button onClick={startNewNotice}><Plus className="mr-2 h-4 w-4" />Create notice</Button>}
      </div>

      {isAdmin && showForm && (
        <Card ref={noticeFormRef}>
          <CardHeader className="pb-4">
            <CardTitle>{editingNotice ? "Edit notice" : "Create a notice"}</CardTitle>
            <CardDescription>Save a draft to review it later, or preview and confirm before sending to residents and current unit tenants.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Title
                <Input maxLength={160} value={form.title} onChange={(event) => { setForm({ ...form, title: event.target.value }); setPreviewed(false) }} placeholder="Water Tank Cleaning" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Category
                <select className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={form.category} onChange={(event) => { setForm({ ...form, category: event.target.value }); setPreviewed(false) }}>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">Priority
                <select className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={form.priority} onChange={(event) => { setForm({ ...form, priority: event.target.value }); setPreviewed(false) }}>
                  <option value="normal">Normal</option><option value="important">Important</option>
                </select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">Starts
                <Input type="datetime-local" value={form.starts_at} onChange={(event) => { setForm({ ...form, starts_at: event.target.value }); setPreviewed(false) }} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Ends (optional)
                <Input type="datetime-local" value={form.ends_at} onChange={(event) => { setForm({ ...form, ends_at: event.target.value }); setPreviewed(false) }} />
              </label>
            </div>
            <label className="block space-y-1.5 text-sm font-medium">Message
              <textarea className="min-h-32 w-full rounded-md border border-input bg-card px-3 py-2 text-sm leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" maxLength={5000} value={form.message} onChange={(event) => { setForm({ ...form, message: event.target.value }); setPreviewed(false) }} placeholder="Share the details residents need to know…" />
            </label>
            {form.ends_at && form.starts_at && new Date(form.ends_at) < new Date(form.starts_at) && <p className="text-sm text-red-600">End time must be after the start time.</p>}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button variant="outline" onClick={() => { if (!isFormValid) return toast.error("Complete the required fields first"); setPreviewed(true) }} disabled={isSaving}><Eye className="mr-2 h-4 w-4" />Preview</Button>
              {editingNotice?.status !== "sent" && <Button variant="secondary" onClick={saveDraft} disabled={isSaving || !isFormValid}>{isSaving ? "Saving…" : "Save draft"}</Button>}
              {(!editingNotice || editingNotice.status === "draft") && <Button onClick={saveAndSend} disabled={isSaving || !isFormValid || !previewed}><Send className="mr-2 h-4 w-4" />{isSaving ? "Sending…" : "Send to residents and tenants"}</Button>}
              {editingNotice?.status === "sent" && <Button onClick={saveDraft} disabled={isSaving || !isFormValid}>{isSaving ? "Saving…" : "Save changes"}</Button>}
              <Button variant="ghost" onClick={resetForm} disabled={isSaving}>Close</Button>
            </div>

            {previewed && (
              <div className={`rounded-xl border p-4 ${form.priority === "important" ? "border-amber-300 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20" : "border-border bg-secondary/20"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{CATEGORY_LABELS[form.category]}</Badge>
                  {form.priority === "important" && <Badge variant="destructive">Important</Badge>}
                  <Badge variant="secondary">Preview</Badge>
                </div>
                <h3 className="text-lg font-semibold">{form.title}</h3>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">{form.message}</p>
                <p className="mt-3 text-xs text-gray-500"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{formatDateTime(form.starts_at)}{form.ends_at ? ` – ${formatDateTime(form.ends_at)}` : ""}</p>
                <p className="mt-2 text-xs font-medium text-amber-800 dark:text-amber-300">This notice will be delivered to active residents and users with a current tenant unit assignment in your complex.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card><CardContent className="py-12 text-center text-sm text-gray-500">Loading notices…</CardContent></Card>
      ) : orderedNotices.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center py-12 text-center">
          <div className="mb-3 rounded-full bg-primary/10 p-3 text-primary"><Megaphone className="h-6 w-6" /></div>
          <h3 className="font-semibold">{isAdmin ? "No notices yet" : "You're all caught up"}</h3>
          <p className="mt-1 max-w-md text-sm text-gray-500">{isAdmin ? "Create a notice to share an update with residents and current unit tenants in your complex." : "New society announcements will appear here."}</p>
          {isAdmin && <Button className="mt-4" onClick={startNewNotice}><Plus className="mr-2 h-4 w-4" />Create notice</Button>}
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {orderedNotices.map((notice) => {
            const important = notice.priority === "important"
            return (
              <Card key={notice.id} className={important ? "border-amber-300 dark:border-amber-800" : ""}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{CATEGORY_LABELS[notice.category] || "General"}</Badge>
                        {important && <Badge variant="destructive">Important</Badge>}
                        <Badge variant={notice.status === "cancelled" ? "secondary" : notice.status === "sent" ? "success" : "outline"}>{notice.status}</Badge>
                        {!isAdmin && !notice.is_read && <Badge>Unread</Badge>}
                      </div>
                      <h3 className="break-words text-lg font-semibold">{notice.title}</h3>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-gray-600 dark:text-gray-300">{notice.message}</p>
                      <p className="mt-3 text-xs text-gray-500"><CalendarClock className="mr-1 inline h-3.5 w-3.5" />{formatDateTime(notice.starts_at)}{notice.ends_at ? ` – ${formatDateTime(notice.ends_at)}` : ""}</p>
                      {isAdmin && notice.status !== "draft" && <p className="mt-2 text-xs text-gray-500">Delivered to {notice.delivery_count || 0} recipients · Read by {notice.read_count || 0}</p>}
                      {isAdmin && <p className="mt-1 text-xs text-gray-500">Created {formatDateTime(notice.created_at)}</p>}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                      {!isAdmin && <Button variant="outline" size="sm" onClick={() => setSelectedNotice(notice)}><Eye className="mr-2 h-4 w-4" />Details</Button>}
                      {!isAdmin && !notice.is_read && <Button size="sm" onClick={() => markRead(notice)}><Check className="mr-2 h-4 w-4" />Mark read</Button>}
                      {isAdmin && notice.status !== "cancelled" && notice.status !== "draft" && <Button variant="outline" size="sm" onClick={() => editNotice(notice)}>Edit</Button>}
                      {isAdmin && notice.status === "draft" && (
                        <Button size="sm" onClick={() => reviewNotice(notice)}><Eye className="mr-2 h-4 w-4" />Review &amp; send</Button>
                      )}
                      {isAdmin && notice.status !== "cancelled" && <Button variant="destructive" size="sm" onClick={() => cancel(notice)}><X className="mr-2 h-4 w-4" />Cancel</Button>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      <NoticeDetails notice={selectedNotice} onClose={() => setSelectedNotice(null)} onMarkRead={markRead} />
    </div>
  )
}
