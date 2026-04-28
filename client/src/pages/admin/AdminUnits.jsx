import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/Table"
import { listBuildings, listUnits, createUnit, bulkCreateUnits, assignUserToUnit, listUsers } from "../../api/admin"
import { DoorOpen, Plus, Loader2, Layers, Building2, Hash, UserPlus } from "lucide-react"
import toast from "react-hot-toast"

const statusColors = {
  vacant: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  occupied: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  maintenance: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
}

export default function AdminUnits() {
  const [units, setUnits] = useState([])
  const [buildings, setBuildings] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filterBuilding, setFilterBuilding] = useState("")

  // Assign modal state
  const [assignModal, setAssignModal] = useState(false)
  const [assignUnit, setAssignUnit] = useState(null)
  const [residents, setResidents] = useState([])
  const [assignForm, setAssignForm] = useState({ user_id: "", relation: "owner" })
  const [isAssigning, setIsAssigning] = useState(false)

  const [form, setForm] = useState({
    building_id: "",
    unit_number: "",
    floor: "",
    type: "apartment",
  })

  const [bulkForm, setBulkForm] = useState({
    building_id: "",
    prefix: "",
    start: "",
    end: "",
    floor: "",
  })

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [buildingsRes, unitsRes] = await Promise.all([
        listBuildings(),
        listUnits(),
      ])
      if (buildingsRes.success) setBuildings(buildingsRes.data)
      if (unitsRes.success) setUnits(unitsRes.data)
    } catch (err) {
      toast.error("Failed to load data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleCreateUnit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        building_id: form.building_id,
        unit_number: form.unit_number,
        floor: form.floor ? parseInt(form.floor) : null,
        type: form.type,
      }
      const res = await createUnit(payload)
      if (res.success) {
        toast.success("Unit created successfully")
        setForm({ building_id: "", unit_number: "", floor: "", type: "apartment" })
        setShowForm(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create unit")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBulkCreate = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payload = {
        building_id: bulkForm.building_id,
        prefix: bulkForm.prefix,
        start: parseInt(bulkForm.start),
        end: parseInt(bulkForm.end),
        floor: bulkForm.floor ? parseInt(bulkForm.floor) : null,
      }
      const res = await bulkCreateUnits(payload)
      if (res.success) {
        toast.success(`${res.count} units created successfully`)
        setBulkForm({ building_id: "", prefix: "", start: "", end: "", floor: "" })
        setShowBulk(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create units")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openAssignModal = async (unit) => {
    setAssignUnit(unit)
    setAssignForm({ user_id: "", relation: "owner" })
    setAssignModal(true)

    // Fetch residents for dropdown
    try {
      const res = await listUsers({ role: "resident" })
      if (res.success) setResidents(res.data)
    } catch {
      toast.error("Failed to load residents")
    }
  }

  const handleAssignSubmit = async (e) => {
    e.preventDefault()
    if (!assignForm.user_id) {
      toast.error("Please select a resident")
      return
    }
    setIsAssigning(true)
    try {
      const res = await assignUserToUnit(assignUnit.id, {
        user_id: assignForm.user_id,
        relation: assignForm.relation,
      })
      if (res.success) {
        toast.success(res.message || "Resident assigned successfully!")
        setAssignModal(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign resident")
    } finally {
      setIsAssigning(false)
    }
  }

  const filteredUnits = filterBuilding
    ? units.filter((u) => u.building_name === filterBuilding)
    : units

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p>Loading units...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Units Management</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Create and manage units across your society buildings.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setShowBulk(!showBulk); setShowForm(false) }}
            variant="outline"
            className="gap-2 border-violet-300 dark:border-violet-700 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950/30"
          >
            <Layers className="w-4 h-4" /> Bulk Create
          </Button>
          <Button
            onClick={() => { setShowForm(!showForm); setShowBulk(false) }}
            className="gap-2 bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Plus className="w-4 h-4" /> Add Unit
          </Button>
        </div>
      </div>

      {/* Single Unit Form */}
      {showForm && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <DoorOpen className="w-5 h-5 text-violet-500" /> Create New Unit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateUnit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Building *</label>
                <select
                  required
                  value={form.building_id}
                  onChange={(e) => setForm({ ...form, building_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <option value="">Select Building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Unit Number *</label>
                <Input
                  required
                  placeholder="e.g., A-101"
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Floor</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="e.g., 1"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <option value="apartment">Apartment</option>
                  <option value="studio">Studio</option>
                  <option value="penthouse">Penthouse</option>
                  <option value="shop">Shop</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isSubmitting} className="w-full bg-violet-600 hover:bg-violet-700 text-white h-10">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Unit"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bulk Create Form */}
      {showBulk && (
        <Card className="animate-in fade-in slide-in-from-top-2 border-violet-200 dark:border-violet-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-violet-500" /> Bulk Create Units
            </CardTitle>
            <p className="text-xs text-gray-500 mt-1">
              Generate multiple units at once. E.g., Prefix "A", Start 101, End 120 → A-101, A-102, ..., A-120
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleBulkCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Building *</label>
                <select
                  required
                  value={bulkForm.building_id}
                  onChange={(e) => setBulkForm({ ...bulkForm, building_id: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                >
                  <option value="">Select Building</option>
                  {buildings.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Prefix *</label>
                <Input
                  required
                  placeholder="e.g., A"
                  value={bulkForm.prefix}
                  onChange={(e) => setBulkForm({ ...bulkForm, prefix: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Start *</label>
                <Input
                  required
                  type="number"
                  min="1"
                  placeholder="101"
                  value={bulkForm.start}
                  onChange={(e) => setBulkForm({ ...bulkForm, start: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">End *</label>
                <Input
                  required
                  type="number"
                  min="1"
                  placeholder="120"
                  value={bulkForm.end}
                  onChange={(e) => setBulkForm({ ...bulkForm, end: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Floor</label>
                <Input
                  type="number"
                  min="0"
                  placeholder="Optional"
                  value={bulkForm.floor}
                  onChange={(e) => setBulkForm({ ...bulkForm, floor: e.target.value })}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={isSubmitting} className="w-full bg-violet-600 hover:bg-violet-700 text-white h-10">
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Filter + Stats Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
            className="h-9 rounded-md border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            <option value="">All Buildings</option>
            {[...new Set(units.map((u) => u.building_name))].map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500">
            {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Vacant: {filteredUnits.filter((u) => u.status === "vacant").length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Occupied: {filteredUnits.filter((u) => u.status === "occupied").length}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Maintenance: {filteredUnits.filter((u) => u.status === "maintenance").length}
          </span>
        </div>
      </div>

      {/* Units Table */}
      <Card>
        <CardContent className="p-0">
          {filteredUnits.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">
              <DoorOpen className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
              <p>No units found. Create your first unit above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit Number</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUnits.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Hash className="w-3.5 h-3.5 text-gray-400" />
                          {unit.unit_number}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="w-3.5 h-3.5 text-gray-400" />
                          {unit.building_name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-sm">{unit.type || "apartment"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs font-medium capitalize ${statusColors[unit.status] || ""}`}>
                          {unit.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {unit.status === "vacant" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignModal(unit)}
                            className="gap-1.5 text-violet-600 border-violet-300 hover:bg-violet-50 dark:text-violet-400 dark:border-violet-700 dark:hover:bg-violet-950/30"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Assign
                          </Button>
                        )}
                        {unit.status === "occupied" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openAssignModal(unit)}
                            className="gap-1.5 text-blue-600 border-blue-300 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-700 dark:hover:bg-blue-950/30"
                          >
                            <UserPlus className="w-3.5 h-3.5" /> Reassign
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

      {/* Assign Resident Modal */}
      <Modal isOpen={assignModal} onClose={() => !isAssigning && setAssignModal(false)} title="Assign Resident to Unit">
        {assignUnit && (
          <form onSubmit={handleAssignSubmit} className="space-y-4 pt-2">
            <div className="p-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-lg">
              <p className="text-sm text-violet-700 dark:text-violet-300 font-medium">
                {assignUnit.building_name} — {assignUnit.unit_number}
              </p>
              <p className="text-xs text-violet-500 mt-0.5 capitalize">{assignUnit.type || "apartment"}</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Select Resident *</label>
              <select
                required
                disabled={isAssigning}
                value={assignForm.user_id}
                onChange={(e) => setAssignForm({ ...assignForm, user_id: e.target.value })}
                className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="">Choose a resident...</option>
                {residents.map((r) => (
                  <option key={r.id} value={r.id}>{r.full_name} ({r.email})</option>
                ))}
              </select>
              {residents.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No residents found in your complex.</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Relation</label>
              <select
                disabled={isAssigning}
                value={assignForm.relation}
                onChange={(e) => setAssignForm({ ...assignForm, relation: e.target.value })}
                className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                <option value="owner">Owner</option>
                <option value="tenant">Tenant</option>
                <option value="family">Family</option>
              </select>
            </div>

            <div className="pt-4 flex justify-end space-x-3 border-t">
              <Button type="button" variant="ghost" onClick={() => setAssignModal(false)} disabled={isAssigning}>Cancel</Button>
              <Button type="submit" disabled={isAssigning} className="bg-violet-600 hover:bg-violet-700 text-white">
                {isAssigning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Assigning...</>
                ) : (
                  <><UserPlus className="w-4 h-4 mr-2" /> Assign Resident</>
                )}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
