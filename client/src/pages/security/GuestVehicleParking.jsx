import { useEffect, useState } from "react"
import { Car, CircleParking, Loader2, RefreshCw, Search, Shield, UserX } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import {
  createVisitorParkingSession,
  listSecurityParkingSlots,
  listVisitorParkingSessions,
  releaseVisitorParkingSession,
  verifyParkingVehicle,
} from "../../api/parking"
import toast from "react-hot-toast"

const emptyForm = { slot_id: "", visitor_name: "", visitor_phone: "", vehicle_number: "", notes: "" }

const getResponseData = (response) => Array.isArray(response?.data) ? response.data : []

export default function GuestVehicleParking() {
  const [slots, setSlots] = useState([])
  const [sessions, setSessions] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [actionLoading, setActionLoading] = useState(null)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleResult, setVehicleResult] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const visibleSessions = sessions.filter(Boolean)
  const availableSlots = slots.filter((slot) => slot?.status === "available")

  const fetchParking = async () => {
    setIsLoading(true)
    setError("")
    try {
      const [slotRes, parkingRes] = await Promise.all([
        listSecurityParkingSlots({ slot_kind: "visitor" }),
        listVisitorParkingSessions({ status: "active" }, "security"),
      ])
      setSlots(slotRes?.success ? getResponseData(slotRes) : [])
      setSessions(parkingRes?.success ? getResponseData(parkingRes) : [])
      if (!slotRes?.success || !parkingRes?.success) setError("Unable to load visitor parking data.")
    } catch {
      setSlots([])
      setSessions([])
      setError("Unable to load visitor parking data.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchParking() }, [])

  const handleVerifyVehicle = async (event) => {
    event.preventDefault()
    if (!vehicleNumber.trim()) return
    setActionLoading("verify")
    try {
      const res = await verifyParkingVehicle(vehicleNumber)
      if (res?.success && res?.data) setVehicleResult(res.data)
      else setVehicleResult({ found: false })
    } catch {
      toast.error("Parking information is temporarily unavailable.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleVisitorParking = async (event) => {
    event.preventDefault()
    setActionLoading("visitor-parking")
    try {
      const res = await createVisitorParkingSession({ ...form, slot_id: form.slot_id || null }, "security")
      if (res.success) {
        toast.success("Visitor parking recorded")
        setIsModalOpen(false)
        setForm(emptyForm)
        fetchParking()
      }
    } catch {
      toast.error("Unable to record visitor parking.")
    } finally {
      setActionLoading(null)
    }
  }

  const handleRelease = async (id) => {
    setActionLoading(id)
    try {
      const res = await releaseVisitorParkingSession(id, "security")
      if (res.success) {
        toast.success("Visitor parking released")
        fetchParking()
      }
    } catch {
      toast.error("Unable to release visitor parking.")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Guest Vehicle Parking</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">
            Manage visitor parking allocations and vehicle verification
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button onClick={fetchParking} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CircleParking className="w-4 h-4" /> Add Parking
          </Button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-none shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Parked Now</p>
              <p className="text-2xl font-bold">{isLoading ? "—" : visibleSessions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              <CircleParking className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Available Slots</p>
              <p className="text-2xl font-bold">{isLoading ? "—" : availableSlots.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md sm:col-span-1 col-span-2">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Slots</p>
              <p className="text-2xl font-bold">{isLoading ? "—" : slots.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Vehicle Verification */}
      <Card className="border-none shadow-md">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-600" /> Verify Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleVerifyVehicle} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                className="pl-9 uppercase"
                placeholder="Enter vehicle number (e.g. TN09AB1234)"
                value={vehicleNumber}
                onChange={(e) => setVehicleNumber(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={actionLoading === "verify"} className="gap-2">
              {actionLoading === "verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Verify
            </Button>
          </form>
          {vehicleResult && (
            <div className="mt-4 rounded-lg border bg-background p-4 animate-in fade-in duration-200">
              {!vehicleResult.found ? (
                <div className="flex items-center gap-3 text-red-600">
                  <UserX className="w-5 h-5" />
                  <p className="font-medium">Vehicle not registered or not currently parked as a visitor.</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <Badge className={vehicleResult.type === "resident" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}>
                      {vehicleResult.type === "resident" ? "Resident" : "Visitor"}
                    </Badge>
                    <p className="font-semibold mt-2 uppercase">{vehicleResult.vehicle?.vehicle_number || vehicleNumber}</p>
                    <p className="text-sm text-gray-500">
                      {vehicleResult.type === "resident"
                        ? `${vehicleResult.vehicle?.resident_name || "Resident vehicle"} — ${vehicleResult.vehicle?.building_name || "Building"} Unit ${vehicleResult.vehicle?.unit_number || "-"}`
                        : `${vehicleResult.vehicle?.visitor_name || "Visitor"} — Visitor`}
                    </p>
                  </div>
                  <div className="rounded-md bg-secondary/50 px-3 py-2 text-right">
                    <p className="text-xs text-gray-500">Assigned Slot</p>
                    <p className="font-medium">{vehicleResult.vehicle?.parking_slot || "No slot assigned"}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Visitor Parking Sessions */}
      <Card className="border-none shadow-md">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-base flex items-center gap-2">
            <Car className="w-5 h-5 text-emerald-600" /> Active Visitor Parking
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" /> Loading visitor parking...
            </div>
          ) : error ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/70 p-4 dark:border-red-900/40 dark:bg-red-950/20">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              <Button type="button" size="sm" variant="outline" onClick={fetchParking} className="gap-2 self-start sm:self-auto">
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </div>
          ) : visibleSessions.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Car className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No visitor parking allocations today</p>
              <Button variant="link" className="mt-2 text-emerald-600" onClick={() => setIsModalOpen(true)}>
                Record a visitor parking
              </Button>
            </div>
          ) : (
            visibleSessions.map((parking) => (
              <div
                key={parking.id}
                className="rounded-lg border bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-200"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold">
                    <Car className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold">{parking.visitor_name}</p>
                    <p className="text-sm text-gray-500 uppercase font-mono">{parking.vehicle_number}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{parking.display_name || "No slot selected"}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRelease(parking.id)}
                  disabled={actionLoading === parking.id}
                  className="self-end sm:self-auto gap-1.5"
                >
                  {actionLoading === parking.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Release
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Add Visitor Parking Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => actionLoading !== "visitor-parking" && setIsModalOpen(false)}
        title="Record Visitor Parking"
      >
        <form onSubmit={handleVisitorParking} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Name *</label>
            <Input required value={form.visitor_name} onChange={(e) => setForm({ ...form, visitor_name: e.target.value })} placeholder="e.g. Rajesh Kumar" className="h-11" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Number *</label>
              <Input required className="uppercase h-11" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} placeholder="e.g. TN09AB1234" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input className="h-11" value={form.visitor_phone} onChange={(e) => setForm({ ...form, visitor_phone: e.target.value })} placeholder="10-digit number" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Assign Slot</label>
            <select
              className="h-11 w-full rounded-md border border-input bg-card px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={form.slot_id}
              onChange={(e) => setForm({ ...form, slot_id: e.target.value })}
            >
              <option value="">No slot selected</option>
              {availableSlots.map((slot) => (
                <option key={slot.id} value={slot.id}>{slot.display_name}</option>
              ))}
            </select>
          </div>
          <div className="pt-4 flex justify-end gap-2 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={actionLoading === "visitor-parking"}>Cancel</Button>
            <Button type="submit" disabled={actionLoading === "visitor-parking"} className="shadow-md">
              {actionLoading === "visitor-parking" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record Parking"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
