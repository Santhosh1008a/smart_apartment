import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { getVisitorsToday, checkinVisitor, checkoutVisitorSecurity } from "../../api/security"
import { createVisitorParkingSession, listSecurityParkingSlots, listVisitorParkingSessions, releaseVisitorParkingSession, verifyParkingVehicle } from "../../api/parking"
import { UserCheck, UserX, Clock, Loader2, RefreshCw, Shield, Car, Search, CircleParking } from "lucide-react"
import toast from "react-hot-toast"

export default function SecurityDashboard() {
  const [visitors, setVisitors] = useState([])
  const [parkingSlots, setParkingSlots] = useState([])
  const [visitorParking, setVisitorParking] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [vehicleNumber, setVehicleNumber] = useState("")
  const [vehicleResult, setVehicleResult] = useState(null)
  const [parkingModal, setParkingModal] = useState(false)
  const [parkingForm, setParkingForm] = useState({ slot_id: "", visitor_name: "", visitor_phone: "", vehicle_number: "", notes: "" })

  const fetchVisitors = async () => {
    try {
      setIsLoading(true)
      const [res, slotRes, parkingRes] = await Promise.all([
        getVisitorsToday(),
        listSecurityParkingSlots({ slot_kind: "visitor" }),
        listVisitorParkingSessions({ status: "active" }, "security"),
      ])
      if (res.success) setVisitors(res.data)
      if (slotRes.success) setParkingSlots(slotRes.data)
      if (parkingRes.success) setVisitorParking(parkingRes.data)
    } catch {
      toast.error("Error fetching visitors")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchVisitors() }, [])

  const handleCheckin = async (id) => {
    setActionLoading(id)
    try {
      const res = await checkinVisitor(id)
      if (res.success) {
        toast.success("Visitor checked in!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed")
    } finally {
      setActionLoading(null)
    }
  }

  const handleCheckout = async (id) => {
    setActionLoading(id)
    try {
      const res = await checkoutVisitorSecurity(id)
      if (res.success) {
        toast.success("Visitor checked out!")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-out failed")
    } finally {
      setActionLoading(null)
    }
  }

  const handleVerifyVehicle = async (event) => {
    event.preventDefault()
    if (!vehicleNumber.trim()) return
    setActionLoading("verify")
    try {
      const res = await verifyParkingVehicle(vehicleNumber)
      if (res.success) setVehicleResult(res.data)
    } catch (err) {
      toast.error(err.response?.data?.message || "Verification failed")
    } finally {
      setActionLoading(null)
    }
  }

  const handleVisitorParking = async (event) => {
    event.preventDefault()
    setActionLoading("visitor-parking")
    try {
      const res = await createVisitorParkingSession({ ...parkingForm, slot_id: parkingForm.slot_id || null }, "security")
      if (res.success) {
        toast.success("Visitor parking recorded")
        setParkingModal(false)
        setParkingForm({ slot_id: "", visitor_name: "", visitor_phone: "", vehicle_number: "", notes: "" })
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not record visitor parking")
    } finally {
      setActionLoading(null)
    }
  }

  const handleReleaseVisitorParking = async (id) => {
    setActionLoading(id)
    try {
      const res = await releaseVisitorParkingSession(id, "security")
      if (res.success) {
        toast.success("Visitor parking released")
        fetchVisitors()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not release parking")
    } finally {
      setActionLoading(null)
    }
  }

  const statusBadge = (status) => {
    switch (status) {
      case "pending": return <Badge variant="secondary" className="capitalize">Expected</Badge>
      case "checked_in": return <Badge variant="success" className="capitalize">Inside</Badge>
      case "checked_out": return <Badge variant="outline" className="capitalize">Left</Badge>
      case "cancelled": return <Badge variant="destructive" className="capitalize">Cancelled</Badge>
      default: return <Badge variant="outline">{status}</Badge>
    }
  }

  const counts = {
    expected: visitors.filter(v => v.status === 'pending').length,
    inside: visitors.filter(v => v.status === 'checked_in').length,
    left: visitors.filter(v => v.status === 'checked_out').length,
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <p>Loading visitor data…</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Today's Visitors</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 self-start sm:self-auto">
          <Button onClick={() => setParkingModal(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
            <CircleParking className="w-4 h-4" /> Visitor Parking
          </Button>
          <Button onClick={fetchVisitors} className="gap-2" variant="outline">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-md">
        <CardContent className="p-4 sm:p-5">
          <form onSubmit={handleVerifyVehicle} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input className="pl-9 uppercase" placeholder="Enter vehicle number" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
            </div>
            <Button type="submit" disabled={actionLoading === "verify"} className="gap-2">
              {actionLoading === "verify" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Verify Vehicle
            </Button>
          </form>
          {vehicleResult && (
            <div className="mt-4 rounded-lg border bg-background p-4">
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
                    <p className="font-semibold mt-2 uppercase">{vehicleResult.vehicle.vehicle_number}</p>
                    <p className="text-sm text-gray-500">
                      {vehicleResult.type === "resident"
                        ? `${vehicleResult.vehicle.resident_name || "Resident vehicle"} - ${vehicleResult.vehicle.building_name} Unit ${vehicleResult.vehicle.unit_number}`
                        : `${vehicleResult.vehicle.visitor_name} - Visitor`}
                    </p>
                  </div>
                  <div className="rounded-md bg-secondary/50 px-3 py-2">
                    <p className="text-xs text-gray-500">Assigned Parking</p>
                    <p className="font-medium">{vehicleResult.vehicle.parking_slot || "No slot assigned"}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Counters */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 shrink-0">
              <Clock className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Expected</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.expected}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 shrink-0">
              <UserCheck className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Inside</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.inside}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-md">
          <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
              <UserX className="w-4 h-4 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-500">Left</p>
              <p className="text-xl sm:text-2xl font-bold">{counts.left}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Visitor List */}
      <div className="space-y-3">
        {visitors.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="py-12 text-center text-gray-500">
              <Shield className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No visitors expected today</p>
            </CardContent>
          </Card>
        ) : (
          visitors.map(visitor => (
            <Card key={visitor.id} className="animate-in fade-in slide-in-from-bottom-2 border-none shadow-md overflow-hidden">
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center font-bold text-lg">
                    {visitor.visitor_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{visitor.visitor_name}</p>
                    <p className="text-sm text-gray-500">
                      Host: <span className="font-medium text-foreground">{visitor.host_name}</span>
                      {visitor.visitor_phone && <span className="ml-2">• {visitor.visitor_phone}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{visitor.purpose}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto shrink-0">
                  {statusBadge(visitor.status)}

                  {visitor.status === "pending" && (
                    <Button
                      size="sm"
                      onClick={() => handleCheckin(visitor.id)}
                      disabled={actionLoading === visitor.id}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    >
                      {actionLoading === visitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Check In
                    </Button>
                  )}

                  {visitor.status === "checked_in" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCheckout(visitor.id)}
                      disabled={actionLoading === visitor.id}
                      className="gap-1.5"
                    >
                      {actionLoading === visitor.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                      Check Out
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Card className="border-none shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-emerald-600" /> Active Visitor Parking
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {visitorParking.length === 0 ? (
            <p className="text-sm text-gray-500">No visitor vehicles are currently parked.</p>
          ) : (
            visitorParking.map((parking) => (
              <div key={parking.id} className="rounded-lg border bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{parking.visitor_name}</p>
                  <p className="text-sm text-gray-500 uppercase">{parking.vehicle_number}</p>
                  <p className="text-sm mt-1">{parking.display_name || "No slot selected"}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleReleaseVisitorParking(parking.id)} disabled={actionLoading === parking.id}>
                  Release
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Modal isOpen={parkingModal} onClose={() => actionLoading !== "visitor-parking" && setParkingModal(false)} title="Visitor Parking">
        <form onSubmit={handleVisitorParking} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Name *</label>
            <Input required value={parkingForm.visitor_name} onChange={(e) => setParkingForm({ ...parkingForm, visitor_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Vehicle Number *</label>
              <Input required value={parkingForm.vehicle_number} onChange={(e) => setParkingForm({ ...parkingForm, vehicle_number: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <Input value={parkingForm.visitor_phone} onChange={(e) => setParkingForm({ ...parkingForm, visitor_phone: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Slot</label>
            <select className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" value={parkingForm.slot_id} onChange={(e) => setParkingForm({ ...parkingForm, slot_id: e.target.value })}>
              <option value="">No slot selected</option>
              {parkingSlots.filter((slot) => slot.status === "available").map((slot) => (
                <option key={slot.id} value={slot.id}>{slot.display_name}</option>
              ))}
            </select>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setParkingModal(false)} disabled={actionLoading === "visitor-parking"}>Cancel</Button>
            <Button type="submit" disabled={actionLoading === "visitor-parking"}>
              {actionLoading === "visitor-parking" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Record Parking"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
