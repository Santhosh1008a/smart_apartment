import { useEffect, useMemo, useState } from "react"
import { Car, CircleParking, Clock, Loader2, Plus, Send, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { getMyParking, registerVehicle, requestParking } from "../../api/parking"
import toast from "react-hot-toast"

const statusStyles = {
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  rejected: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  cancelled: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
}

export default function Parking() {
  const [data, setData] = useState({ unit: null, vehicles: [], assignments: [], requests: [] })
  const [isLoading, setIsLoading] = useState(true)
  const [isVehicleOpen, setIsVehicleOpen] = useState(false)
  const [isRequestOpen, setIsRequestOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({ vehicle_number: "", vehicle_type: "car", make_model: "", color: "" })
  const [requestForm, setRequestForm] = useState({ vehicle_id: "", request_type: "extra_parking", reason: "" })

  const fetchParking = async () => {
    try {
      setIsLoading(true)
      const res = await getMyParking()
      if (res.success) setData(res.data)
    } catch {
      toast.error("Failed to load parking details")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchParking()
  }, [])

  const pendingRequests = useMemo(
    () => data.requests.filter((request) => request.status === "pending").length,
    [data.requests]
  )

  const handleVehicleSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const res = await registerVehicle(vehicleForm)
      if (res.success) {
        toast.success("Vehicle registered")
        setVehicleForm({ vehicle_number: "", vehicle_type: "car", make_model: "", color: "" })
        setIsVehicleOpen(false)
        fetchParking()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not register vehicle")
    } finally {
      setIsSaving(false)
    }
  }

  const handleRequestSubmit = async (event) => {
    event.preventDefault()
    setIsSaving(true)
    try {
      const payload = {
        ...requestForm,
        vehicle_id: requestForm.vehicle_id || null,
      }
      const res = await requestParking(payload)
      if (res.success) {
        toast.success("Parking request sent")
        setRequestForm({ vehicle_id: "", request_type: "extra_parking", reason: "" })
        setIsRequestOpen(false)
        fetchParking()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send request")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-20 text-gray-500 space-y-4 flex-col">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p>Loading parking details...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">My Parking</h2>
          <p className="text-sm text-gray-500 mt-1">
            {data.unit ? `${data.unit.building_name} - Unit ${data.unit.unit_number}` : "Your unit is not linked yet"}
          </p>
        </div>
        <div className="flex flex-col xs:flex-row gap-2">
          <Button variant="outline" onClick={() => setIsVehicleOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Register Vehicle
          </Button>
          <Button onClick={() => setIsRequestOpen(true)} className="gap-2">
            <Send className="w-4 h-4" /> Request Parking
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600">
              <CircleParking className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Assigned Slots</p>
              <p className="text-2xl font-bold">{data.assignments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vehicles</p>
              <p className="text-2xl font-bold">{data.vehicles.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Pending Requests</p>
              <p className="text-2xl font-bold">{pendingRequests}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" /> Assigned Parking
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.assignments.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                <CircleParking className="w-9 h-9 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No slot assigned yet</p>
                <p className="text-sm mt-1">Your approved parking slot will appear here.</p>
              </div>
            ) : (
              data.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-lg border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{assignment.display_name}</p>
                      <p className="text-sm text-gray-500">{assignment.parking_area || "Society parking"}</p>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Active
                    </Badge>
                  </div>
                  <div className="mt-4 rounded-md bg-secondary/40 p-3">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-500">Vehicle</p>
                    <p className="mt-1 font-semibold">
                      {assignment.vehicle_number || "No vehicle linked"}
                      {assignment.vehicle_type && <span className="ml-2 text-sm font-normal text-gray-500 capitalize">{assignment.vehicle_type}</span>}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="w-5 h-5 text-primary" /> Registered Vehicles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.vehicles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
                <Car className="w-9 h-9 mx-auto mb-3 opacity-40" />
                <p className="font-medium">No vehicles registered</p>
                <p className="text-sm mt-1">Register your vehicle so guards can verify it at the gate.</p>
              </div>
            ) : (
              data.vehicles.map((vehicle) => (
                <div key={vehicle.id} className="rounded-lg border bg-background p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold tracking-wide uppercase">{vehicle.vehicle_number}</p>
                    <p className="text-sm text-gray-500 capitalize">
                      {vehicle.vehicle_type}
                      {vehicle.make_model ? ` - ${vehicle.make_model}` : ""}
                      {vehicle.color ? ` - ${vehicle.color}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline">Registered</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parking Requests</CardTitle>
        </CardHeader>
        <CardContent>
          {data.requests.length === 0 ? (
            <p className="text-sm text-gray-500">No parking requests yet.</p>
          ) : (
            <div className="space-y-3">
              {data.requests.map((request) => (
                <div key={request.id} className="rounded-lg border bg-background p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <p className="font-medium capitalize">{request.request_type.replace("_", " ")}</p>
                    <p className="text-sm text-gray-500">{request.reason || "No reason added"}</p>
                    {request.vehicle_number && <p className="text-xs text-gray-400 mt-1 uppercase">{request.vehicle_number}</p>}
                  </div>
                  <Badge className={`${statusStyles[request.status] || ""} capitalize self-start sm:self-auto`}>
                    {request.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isVehicleOpen} onClose={() => !isSaving && setIsVehicleOpen(false)} title="Register Vehicle">
        <form onSubmit={handleVehicleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Number *</label>
            <Input required placeholder="KA 01 AB 1234" value={vehicleForm.vehicle_number} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_number: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle Type</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={vehicleForm.vehicle_type} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}>
              <option value="car">Car</option>
              <option value="bike">Bike</option>
              <option value="ev">EV</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Make / Model</label>
              <Input placeholder="Honda City" value={vehicleForm.make_model} onChange={(e) => setVehicleForm({ ...vehicleForm, make_model: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Color</label>
              <Input placeholder="White" value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} />
            </div>
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsVehicleOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Register"}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isRequestOpen} onClose={() => !isSaving && setIsRequestOpen(false)} title="Request Parking">
        <form onSubmit={handleRequestSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Request Type</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={requestForm.request_type} onChange={(e) => setRequestForm({ ...requestForm, request_type: e.target.value })}>
              <option value="extra_parking">Extra parking</option>
              <option value="visitor_parking">Visitor parking</option>
              <option value="slot_change">Slot change</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Vehicle</label>
            <select className="flex h-10 w-full rounded-md border border-input bg-card px-3 py-2 text-sm" value={requestForm.vehicle_id} onChange={(e) => setRequestForm({ ...requestForm, vehicle_id: e.target.value })}>
              <option value="">No specific vehicle</option>
              {data.vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Reason</label>
            <textarea className="min-h-[96px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Tell the admin what you need" value={requestForm.reason} onChange={(e) => setRequestForm({ ...requestForm, reason: e.target.value })} />
          </div>
          <div className="pt-3 flex justify-end gap-2 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsRequestOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Request"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
