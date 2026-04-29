import { useEffect, useMemo, useState } from "react"
import { Car, Check, CircleParking, Clock, Loader2, Plus, RefreshCw, Search, UserPlus } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"
import { listUnits } from "../../api/admin"
import {
  assignParkingSlot,
  createParkingSlot,
  createVisitorParkingSession,
  getParkingOverview,
  listParkingRequests,
  listParkingSlots,
  listParkingVehicles,
  listVisitorParkingSessions,
  releaseParkingAssignment,
  releaseVisitorParkingSession,
  reviewParkingRequest,
  updateParkingSlot,
} from "../../api/parking"
import toast from "react-hot-toast"

const statusClass = {
  available: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  occupied: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  assigned: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  reserved: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  maintenance: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  inactive: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
}

export default function AdminParking() {
  const [overview, setOverview] = useState(null)
  const [slots, setSlots] = useState([])
  const [units, setUnits] = useState([])
  const [vehicles, setVehicles] = useState([])
  const [requests, setRequests] = useState([])
  const [visitors, setVisitors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState("all")
  const [slotModal, setSlotModal] = useState(false)
  const [assignModal, setAssignModal] = useState(false)
  const [visitorModal, setVisitorModal] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)

  const [slotForm, setSlotForm] = useState({
    display_name: "",
    parking_area: "",
    slot_label: "",
    parking_type: "car",
    slot_kind: "resident",
    status: "available",
  })
  const [assignForm, setAssignForm] = useState({ slot_id: "", unit_id: "", vehicle_id: "", notes: "" })
  const [visitorForm, setVisitorForm] = useState({ slot_id: "", visitor_name: "", visitor_phone: "", vehicle_number: "", host_unit_id: "", notes: "" })

  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [overviewRes, slotsRes, unitsRes, vehiclesRes, requestsRes, visitorRes] = await Promise.all([
        getParkingOverview(),
        listParkingSlots(),
        listUnits(),
        listParkingVehicles(),
        listParkingRequests(),
        listVisitorParkingSessions({ status: "active" }),
      ])
      if (overviewRes.success) setOverview(overviewRes.data)
      if (slotsRes.success) setSlots(slotsRes.data)
      if (unitsRes.success) setUnits(unitsRes.data)
      if (vehiclesRes.success) setVehicles(vehiclesRes.data)
      if (requestsRes.success) setRequests(requestsRes.data)
      if (visitorRes.success) setVisitors(visitorRes.data)
    } catch {
      toast.error("Failed to load parking data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      const matchesFilter = filter === "all" || slot.status === filter || slot.slot_kind === filter
      const text = `${slot.display_name} ${slot.parking_area} ${slot.unit_number || ""} ${slot.vehicle_number || ""}`.toLowerCase()
      return matchesFilter && text.includes(query.toLowerCase())
    })
  }, [slots, filter, query])

  const vehiclesForUnit = useMemo(
    () => vehicles.filter((vehicle) => vehicle.unit_id === assignForm.unit_id),
    [vehicles, assignForm.unit_id]
  )

  const openAssign = (slot) => {
    setSelectedSlot(slot)
    setAssignForm({ slot_id: slot.id, unit_id: "", vehicle_id: "", notes: "" })
    setAssignModal(true)
  }

  const handleCreateSlot = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const res = await createParkingSlot(slotForm)
      if (res.success) {
        toast.success("Parking slot created")
        setSlotForm({ display_name: "", parking_area: "", slot_label: "", parking_type: "car", slot_kind: "resident", status: "available" })
        setSlotModal(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not create slot")
    } finally {
      setIsSaving(false)
    }
  }

  const handleAssign = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const res = await assignParkingSlot({ ...assignForm, vehicle_id: assignForm.vehicle_id || null })
      if (res.success) {
        toast.success("Parking assigned")
        setAssignModal(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not assign parking")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRelease = async (assignmentId) => {
    setIsSaving(true)
    try {
      const res = await releaseParkingAssignment(assignmentId)
      if (res.success) {
        toast.success("Parking released")
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not release parking")
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatus = async (slot, status) => {
    setIsSaving(true)
    try {
      const res = await updateParkingSlot(slot.id, { status })
      if (res.success) {
        toast.success("Slot updated")
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update slot")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRequestReview = async (request, status) => {
    setIsSaving(true)
    try {
      const res = await reviewParkingRequest(request.id, { status })
      if (res.success) {
        toast.success(status === "approved" ? "Request approved" : "Request rejected")
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update request")
    } finally {
      setIsSaving(false)
    }
  }

  const handleVisitorSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...visitorForm,
        slot_id: visitorForm.slot_id || null,
        host_unit_id: visitorForm.host_unit_id || null,
      }
      const res = await createVisitorParkingSession(payload)
      if (res.success) {
        toast.success("Visitor parking started")
        setVisitorForm({ slot_id: "", visitor_name: "", visitor_phone: "", vehicle_number: "", host_unit_id: "", notes: "" })
        setVisitorModal(false)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not start visitor parking")
    } finally {
      setIsSaving(false)
    }
  }

  const handleVisitorRelease = async (id) => {
    setIsSaving(true)
    try {
      const res = await releaseVisitorParkingSession(id)
      if (res.success) {
        toast.success("Visitor parking released")
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not release visitor parking")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        <p>Loading parking management...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Parking Management</h2>
          <p className="text-sm text-gray-500 mt-1">Create simple slot names, assign parking, and manage requests for your society.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={fetchData} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setVisitorModal(true)} className="gap-2">
            <Car className="w-4 h-4" /> Visitor Parking
          </Button>
          <Button onClick={() => setSlotModal(true)} className="gap-2 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-4 h-4" /> Add Slot
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Total", overview?.total_slots || 0, <CircleParking className="w-5 h-5" />],
          ["Available", overview?.available_slots || 0, <Check className="w-5 h-5" />],
          ["Occupied", overview?.occupied_slots || 0, <Car className="w-5 h-5" />],
          ["Visitors", overview?.visitor_slots || 0, <UserPlus className="w-5 h-5" />],
          ["Requests", overview?.pending_requests || 0, <Clock className="w-5 h-5" />],
        ].map(([label, value, icon]) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600">
                {icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <Input className="pl-9" placeholder="Search slots, units, or vehicles" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-md border border-input bg-card px-3 py-2 text-sm">
          <option value="all">All parking</option>
          <option value="available">Available</option>
          <option value="occupied">Occupied</option>
          <option value="maintenance">Maintenance</option>
          <option value="visitor">Visitor slots</option>
          <option value="resident">Resident slots</option>
        </select>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        <div className="space-y-3">
          {filteredSlots.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <CircleParking className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>No parking slots found.</p>
              </CardContent>
            </Card>
          ) : (
            filteredSlots.map((slot) => (
              <Card key={slot.id}>
                <CardContent className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold truncate">{slot.display_name}</h3>
                      <Badge className={`${statusClass[slot.status] || ""} capitalize`}>{slot.status === "assigned" ? "occupied" : slot.status}</Badge>
                      {slot.slot_kind === "visitor" && <Badge variant="outline">Visitor</Badge>}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      {slot.parking_area || "Main Parking"} - {slot.parking_type}
                    </p>
                    {slot.unit_number && (
                      <p className="text-sm mt-2">
                        Assigned to <span className="font-medium">{slot.unit_building_name} - Unit {slot.unit_number}</span>
                        {slot.vehicle_number && <span className="text-gray-500 uppercase"> - {slot.vehicle_number}</span>}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {(slot.status === "available" || slot.status === "reserved") && (
                      <Button size="sm" onClick={() => openAssign(slot)} className="gap-1.5">
                        <UserPlus className="w-4 h-4" /> Assign
                      </Button>
                    )}
                    {slot.assignment_id && (
                      <Button size="sm" variant="outline" onClick={() => handleRelease(slot.assignment_id)} disabled={isSaving}>
                        Release
                      </Button>
                    )}
                    {!slot.assignment_id && slot.status !== "maintenance" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(slot, "maintenance")} disabled={isSaving}>
                        Maintenance
                      </Button>
                    )}
                    {!slot.assignment_id && slot.status !== "available" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatus(slot, "available")} disabled={isSaving}>
                        Available
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Additional Parking Requests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {requests.filter((request) => request.status === "pending").length === 0 ? (
                <p className="text-sm text-gray-500">No pending requests.</p>
              ) : (
                requests.filter((request) => request.status === "pending").map((request) => (
                  <div key={request.id} className="rounded-lg border bg-background p-3">
                    <p className="font-medium">{request.building_name} - Unit {request.unit_number}</p>
                    <p className="text-sm text-gray-500">{request.resident_name}</p>
                    <p className="text-sm mt-2">{request.reason || "No reason added"}</p>
                    {request.vehicle_number && <p className="text-xs text-gray-400 uppercase mt-1">{request.vehicle_number}</p>}
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={() => handleRequestReview(request, "approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleRequestReview(request, "rejected")}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Visitor Parking Active</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {visitors.length === 0 ? (
                <p className="text-sm text-gray-500">No active visitor parking.</p>
              ) : (
                visitors.map((visitor) => (
                  <div key={visitor.id} className="rounded-lg border bg-background p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{visitor.visitor_name}</p>
                        <p className="text-sm text-gray-500 uppercase">{visitor.vehicle_number}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleVisitorRelease(visitor.id)}>
                        Release
                      </Button>
                    </div>
                    <p className="text-sm mt-2">{visitor.display_name || "No slot selected"}</p>
                    {visitor.unit_number && <p className="text-xs text-gray-500">Host: {visitor.building_name} - Unit {visitor.unit_number}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal isOpen={slotModal} onClose={() => !isSaving && setSlotModal(false)} title="Add Parking Slot">
        <form onSubmit={handleCreateSlot} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Slot Name *</label>
            <Input required placeholder="Block A - Slot 12" value={slotForm.display_name} onChange={(e) => setSlotForm({ ...slotForm, display_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Area</label>
              <Input placeholder="Block A" value={slotForm.parking_area} onChange={(e) => setSlotForm({ ...slotForm, parking_area: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Slot Number</label>
              <Input placeholder="12" value={slotForm.slot_label} onChange={(e) => setSlotForm({ ...slotForm, slot_label: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Parking Type</label>
              <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={slotForm.parking_type} onChange={(e) => setSlotForm({ ...slotForm, parking_type: e.target.value })}>
                <option value="car">Car</option>
                <option value="bike">Bike</option>
                <option value="ev">EV</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Use</label>
              <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={slotForm.slot_kind} onChange={(e) => setSlotForm({ ...slotForm, slot_kind: e.target.value })}>
                <option value="resident">Resident</option>
                <option value="visitor">Visitor</option>
                <option value="accessible">Accessible</option>
                <option value="staff">Staff</option>
              </select>
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setSlotModal(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Slot"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={assignModal} onClose={() => !isSaving && setAssignModal(false)} title="Assign Parking">
        <form onSubmit={handleAssign} className="space-y-4">
          {selectedSlot && (
            <div className="rounded-lg border bg-violet-50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800 p-3">
              <p className="font-medium text-violet-700 dark:text-violet-300">{selectedSlot.display_name}</p>
              <p className="text-xs text-violet-500">{selectedSlot.parking_area || "Main Parking"}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Unit *</label>
            <select required className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={assignForm.unit_id} onChange={(e) => setAssignForm({ ...assignForm, unit_id: e.target.value, vehicle_id: "" })}>
              <option value="">Choose unit</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.building_name} - Unit {unit.unit_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle</label>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={assignForm.vehicle_id} onChange={(e) => setAssignForm({ ...assignForm, vehicle_id: e.target.value })}>
              <option value="">Assign without vehicle</option>
              {vehiclesForUnit.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number} ({vehicle.vehicle_type})</option>
              ))}
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setAssignModal(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Assign Slot"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={visitorModal} onClose={() => !isSaving && setVisitorModal(false)} title="Visitor Parking">
        <form onSubmit={handleVisitorSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Name *</label>
            <Input required value={visitorForm.visitor_name} onChange={(e) => setVisitorForm({ ...visitorForm, visitor_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Number *</label>
              <Input required value={visitorForm.vehicle_number} onChange={(e) => setVisitorForm({ ...visitorForm, vehicle_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input value={visitorForm.visitor_phone} onChange={(e) => setVisitorForm({ ...visitorForm, visitor_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Slot</label>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={visitorForm.slot_id} onChange={(e) => setVisitorForm({ ...visitorForm, slot_id: e.target.value })}>
              <option value="">No slot selected</option>
              {slots.filter((slot) => slot.slot_kind === "visitor" && slot.status === "available").map((slot) => (
                <option key={slot.id} value={slot.id}>{slot.display_name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Host Unit</label>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={visitorForm.host_unit_id} onChange={(e) => setVisitorForm({ ...visitorForm, host_unit_id: e.target.value })}>
              <option value="">No host unit selected</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.building_name} - Unit {unit.unit_number}</option>
              ))}
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setVisitorModal(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Start Parking"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
