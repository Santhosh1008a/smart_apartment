import { useCallback, useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, RefreshCw, ShieldCheck } from 'lucide-react'
import { getPrivacyRequestInbox, updatePrivacyRequest } from '../../api/superAdmin'

const statuses = ['received', 'in_review', 'needs_information', 'completed', 'rejected']

export default function PrivacyRequestInbox() {
  const [requests, setRequests] = useState([])
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const result = await getPrivacyRequestInbox()
      const rows = result.data || []
      setRequests(rows)
      setDrafts(Object.fromEntries(rows.map((request) => [request.id, {
        status: request.status,
        resolution_note: request.resolution_note || '',
      }])))
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load privacy requests.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const save = async (id) => {
    setSavingId(id)
    setError('')
    setMessage('')
    try {
      await updatePrivacyRequest(id, drafts[id])
      setMessage('Request status saved.')
      await load()
    } catch (err) {
      setError(err.response?.data?.message || 'Could not update this request.')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-6 w-6 text-indigo-600" /><h2 className="text-2xl font-bold">Privacy requests</h2></div>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Review requests submitted by signed-in users. Updating status does not itself export or delete their records; complete those actions through an approved process.</p>
        </div>
        <button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-secondary disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-4 w-4" />{error}</div>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      {loading ? <div className="flex items-center gap-2 py-12 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Loading requests…</div> : requests.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-sm text-gray-500">No privacy requests have been submitted.</div>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => <section key={request.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold capitalize">{request.request_type.replaceAll('_', ' ')}</p>
                <p className="mt-1 text-sm text-gray-500">{request.requester_name || 'Deleted account'} · {request.requester_email || 'No account email available'}</p>
                <p className="mt-1 text-xs text-gray-500">Received {new Date(request.submitted_at).toLocaleString()}</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium capitalize text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">{request.status.replaceAll('_', ' ')}</span>
            </div>
            {request.details && <p className="mt-4 whitespace-pre-wrap rounded-lg bg-secondary/40 p-3 text-sm">{request.details}</p>}
            <div className="mt-4 grid gap-3 sm:grid-cols-[220px_1fr_auto] sm:items-end">
              <label className="text-sm font-medium">Status
                <select value={drafts[request.id]?.status || request.status} onChange={(event) => setDrafts((state) => ({ ...state, [request.id]: { ...state[request.id], status: event.target.value } }))} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Response note
                <input maxLength={2000} value={drafts[request.id]?.resolution_note || ''} onChange={(event) => setDrafts((state) => ({ ...state, [request.id]: { ...state[request.id], resolution_note: event.target.value } }))} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 text-sm" placeholder="Optional update visible to requester" />
              </label>
              <button onClick={() => save(request.id)} disabled={savingId === request.id} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-60">
                {savingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
              </button>
            </div>
          </section>)}
        </div>
      )}
    </div>
  )
}
