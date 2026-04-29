import { useState, useEffect } from "react"
import { Car, MapPin, CheckCircle2, Loader2 } from "lucide-react"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { listMyParkingAssignments } from "../../api/services"
import toast from "react-hot-toast"

export default function Parking() {
  const [assignedSlots, setAssignedSlots] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setIsLoading(true)
        const res = await listMyParkingAssignments()
        if (res.success) {
          setAssignedSlots(res.data || [])
        }
      } catch (err) {
        toast.error("Failed to load parking assignments")
      } finally {
        setIsLoading(false)
      }
    }
    
    fetchAssignments()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Parking Management</h2>
        <p className="text-sm text-gray-500 mt-1">View your assigned parking slots and vehicle details</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <div className="col-span-1 md:col-span-2 flex justify-center flex-col items-center py-12 text-gray-500 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p>Loading parking structure...</p>
          </div>
        ) : assignedSlots.length === 0 ? (
          <div className="col-span-1 border-2 border-dashed border-border bg-secondary/10 flex flex-col items-center justify-center text-center p-8 shadow-none min-h-[300px] rounded-xl">
             <div className="p-4 bg-background rounded-full shadow-sm mb-4">
               <Car className="w-8 h-8 text-gray-400" />
             </div>
             <h3 className="text-lg font-semibold text-foreground">No Parking Assigned</h3>
             <p className="text-sm text-gray-500 max-w-sm mt-2">You currently do not have any vehicle parking slots assigned to your unit.</p>
          </div>
        ) : (
          assignedSlots.map(slot => (
            <Card key={slot.id} className="overflow-hidden border-none shadow-md">
              <div className="bg-primary/5 px-6 py-4 flex justify-between items-center border-b border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <Car className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold font-mono tracking-wider text-foreground">{slot.slot_number}</h3>
                </div>
                <Badge variant="success" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Active
                </Badge>
              </div>
              <CardContent className="p-6">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-6">
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1 flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> Building & Floor</dt>
                    <dd className="text-base font-semibold text-foreground">{slot.building_name} - Floor {slot.floor}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500 mb-1">Vehicle Match</dt>
                    <dd className="text-base font-semibold text-foreground capitalize">{slot.vehicle_type}</dd>
                  </div>
                  <div className="col-span-2 pt-4 border-t border-border/50">
                    <dt className="text-sm font-medium text-gray-500 mb-1 opacity-80 uppercase tracking-wider text-xs">Registered Vehicle</dt>
                    <dd className="text-xl font-bold bg-secondary/30 inline-block px-4 py-2 rounded-lg border border-border tracking-widest mt-1 uppercase shadow-sm">
                      {slot.vehicle_number}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))
        )}

        <Card className="border-2 border-dashed border-border bg-secondary/10 flex flex-col items-center justify-center text-center p-8 shadow-none min-h-[300px]">
          <div className="p-4 bg-background rounded-full shadow-sm mb-4">
            <Car className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">Request Additional Slot</h3>
          <p className="text-sm text-gray-500 max-w-sm mt-2 mb-6">Need more parking space for your guests or a new vehicle? Submit a request to the management.</p>
          <button className="px-4 py-2 bg-background border border-border shadow-sm rounded-md text-sm font-medium text-foreground hover:bg-secondary transition-colors">
            Contact Admin
          </button>
        </Card>
      </div>
    </div>
  )
}
