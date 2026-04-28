import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Modal } from "../../components/ui/Modal"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table"
import { listVendorRequests, listVendorsForComplex, assignVendorToRequest } from "../../api/admin"
import { Wrench, Loader2, UserPlus, CheckCircle2, Clock, AlertCircle, RefreshCw } from "lucide-react"
import toast from "react-hot-toast"

const STATUS_COLORS = {
  pending:     "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  assigned:    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  completed:   "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelled:   "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
}

const PRIORITY_COLORS = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high:   "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low:    "bg-gray-100 text-gray-600 border-gray-200",
}

const CATEGORY_LABELS = {
  plumber:     "🔧 Plumbing",
  electrician: "⚡ Electrical",
  carpenter:   "🪚 Carpentry",
  painter:     "🖌️ Painting",
  cleaner:     "🧹 Cleaning",
  security:    "🔒 Security",
  other:       "📋 Other",
}

export default function AdminVendorRequests() {
  const [requests, setRequests] = useState([])
  const [vendors, setVendors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState("")

  const [assignModal, setAssignModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [selectedVendorId, setSelectedVendorId] = useState("")
  const [isAssigning, setIsAssigning] = useState(false)

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [reqRes, venRes] = await Promise.all([
        listVendorRequests(filterStatus ? { status: filterStatus } : {}),
        listVendorsForComplex()
      ])
      if (reqRes.success) setRequests(reqRes.data)
      if (venRes.success) setVendors(venRes.data)
    } catch {
      toast.error("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [filterStatus])

  const openAssignModal = (req) => {
    setSelectedRequest(req)
    // Pre-select vendor matching the request category
    const matchingVendor = vendors.find(v => v.vendor_category === req.category)
    setSelectedVendorId(matchingVendor?.id || "")
    setAssignModal(true)
  }

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedVendorId) { toast.error("Select a vendor"); return }
    setIsAssigning(true)
    try {
      const res = await assignVendorToRequest(selectedRequest.id, selectedVendorId)
      if (res.success) {
        toast.success("Vendor assigned successfully!")
        setAssignModal(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign vendor")
    } finally {
      setIsAssigning(false)
    }
  }

  const stats = {
    pending:     requests.filter(r => r.status === 'pending').length,
    assigned:    requests.filter(r => r.status === 'assigned').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed:   requests.filter(r => r.status === 'completed').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Vendor Requests</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Manage and assign service requests raised by residents.
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Pending", count: stats.pending, icon: AlertCircle, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
          { label: "Assigned", count: stats.assigned, icon: UserPlus, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-900/20" },
          { label: "In Progress", count: stats.in_progress, icon: Clock, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-900/20" },
          { label: "Completed", count: stats.completed, icon: CheckCircle2, color: "text-green-500", bg: "bg-green-50 dark:bg-green-900/20" },
        ].map(({ label, count, icon: Icon, color, bg }) => (
          <Card key={label} className="border-none shadow-md">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${bg}`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="h-9 rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <span className="text-sm text-gray-500">{requests.length} request{requests.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Requests Table */}
      <Card className="border-none shadow-md">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center flex-col items-center py-16 text-gray-500 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
              <p>Loading requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-16 text-center text-gray-500">
              <Wrench className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No vendor requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Resident</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Assigned Vendor</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map(req => (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">
                        <span className="text-sm">{CATEGORY_LABELS[req.category] || req.category}</span>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-[200px] truncate">{req.description || '—'}</p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-mono">{req.unit_number}</span>
                        <br />
                        <span className="text-xs text-gray-500">{req.building_name}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{req.requested_by}</span>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${PRIORITY_COLORS[req.priority]}`}>
                          {req.priority}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs font-medium capitalize ${STATUS_COLORS[req.status]}`}>
                          {req.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.vendor_name ? (
                          <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{req.vendor_name}</span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {req.status !== 'completed' && req.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignModal(req)}
                            className="gap-1.5 text-violet-600 border-violet-300 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-700"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            {req.assigned_vendor_id ? 'Reassign' : 'Assign'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assign Vendor Modal */}
      <Modal isOpen={assignModal} onClose={() => !isAssigning && setAssignModal(false)} title="Assign Vendor">
        {selectedRequest && (
          <form onSubmit={handleAssign} className="space-y-4 pt-2">
            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg">
              <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                {CATEGORY_LABELS[selectedRequest.category]} — Unit {selectedRequest.unit_number}
              </p>
              <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{selectedRequest.description}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Select Vendor *</label>
              <select
                required
                disabled={isAssigning}
                value={selectedVendorId}
                onChange={e => setSelectedVendorId(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:opacity-50"
              >
                <option value="">Choose a vendor...</option>
                {vendors.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.full_name} {v.vendor_category ? `(${v.vendor_category})` : ''} {v.vendor_category === selectedRequest.category ? '✓ Match' : ''}
                  </option>
                ))}
              </select>
              {vendors.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No vendors found in your complex.</p>
              )}
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button type="button" variant="ghost" onClick={() => setAssignModal(false)} disabled={isAssigning}>Cancel</Button>
              <Button type="submit" disabled={isAssigning} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isAssigning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Assign Vendor</>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
