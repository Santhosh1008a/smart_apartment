import { useState, useEffect } from "react"
import { Wrench, Star, Phone, ShieldCheck, MapPin, Search, Loader2 } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Card, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"
import { listVendors, listMyVendorRequests, raiseVendorRequest } from "../../api/services"
import toast from "react-hot-toast"
import { useAuthStore } from "../../store/useAuthStore"

export default function Vendors() {
  const { user } = useAuthStore()
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)
  
  const [vendors, setVendors] = useState([])
  const [requests, setRequests] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [newReq, setNewReq] = useState({ category: "plumber", desc: "", preferredTime: "" })
  
  const fetchData = async () => {
    try {
      setIsLoading(true)
      const [venRes, reqRes] = await Promise.all([
        listVendors(),
        listMyVendorRequests()
      ])
      
      if (venRes.success) setVendors(venRes.data)
      if (reqRes.success) setRequests(reqRes.data)
    } catch (err) {
      toast.error("Failed to load vendor data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRequestSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      const description = newReq.preferredTime 
        ? `${newReq.desc} (Preferred: ${newReq.preferredTime})` 
        : newReq.desc;

      const unitId = user?.units?.[0]?.unit_id || null;

      const res = await raiseVendorRequest({
        unit_id: unitId,
        category: newReq.category,
        description: description,
        priority: 'medium'
      })

      if (res.success) {
        toast.success("Service request submitted successfully!")
        setIsRequestModalOpen(false)
        setNewReq({ category: "plumber", desc: "", preferredTime: "" })
        setSelectedVendor(null)
        fetchData()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to submit request")
    } finally {
      setIsSubmitting(false)
    }
  }

  const openRequestModal = (vendor = null) => {
    setSelectedVendor(vendor)
    if (vendor) {
      setNewReq({ ...newReq, category: vendor.category })
    }
    setIsRequestModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Vendor Services</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Book society-approved maintenance professionals</p>
        </div>
        <Button onClick={() => openRequestModal()} className="w-full sm:w-auto shadow-md">
          <Wrench className="w-4 h-4 mr-2" />
          Raise Service Request
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Vendor Directory */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Verified Professionals</h3>
            <div className="relative w-48 hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <Input placeholder="Search..." className="pl-9 h-9" />
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center flex-col items-center py-12 text-gray-500 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Loading vendors...</p>
            </div>
          ) : vendors.length === 0 ? (
            <div className="text-center py-12 text-gray-500 border rounded-xl bg-secondary/10">
              <p>No verified vendors available right now.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vendors.map(vendor => (
                <Card key={vendor.id} className="overflow-hidden group hover:shadow-md transition-shadow cursor-default">
                  <CardContent className="p-0">
                    <div className="flex px-5 py-5 gap-4">
                      {/* Placeholder for missing images */}
                      <div className="w-16 h-16 rounded-xl bg-indigo-100 text-indigo-500 flex items-center justify-center font-bold text-2xl uppercase">
                        {vendor.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] py-0 capitalize">{vendor.category}</Badge>
                          {vendor.is_verified && <ShieldCheck className="w-4 h-4 text-green-500 title" title="Verified Professional" />}
                        </div>
                        <h4 className="font-bold text-foreground mt-1 truncate">{vendor.name}</h4>
                        <div className="flex items-center text-sm text-gray-500 mt-1 space-x-3">
                          <span className="flex items-center text-yellow-500"><Star className="w-3.5 h-3.5 fill-current mr-1" /> 4.5</span>
                          <span className="flex items-center"><MapPin className="w-3 h-3 mr-1" /> Available</span>
                        </div>
                      </div>
                    </div>
                    <div className="bg-secondary/30 px-5 py-3 border-t flex justify-between items-center group-hover:bg-primary/5 transition-colors">
                      <a href={`tel:${vendor.contact_number}`} className="text-sm font-medium text-primary flex items-center cursor-pointer hover:underline">
                        <Phone className="w-3.5 h-3.5 mr-1.5" /> Call
                      </a>
                      <Button variant="ghost" size="sm" className="h-8 group-hover:bg-primary group-hover:text-primary-foreground" onClick={() => openRequestModal(vendor)}>
                        Direct Request
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Active Requests */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">My Requests</h3>
          <div className="space-y-4">
            {isLoading ? (
               <div className="text-center py-6 text-gray-400">Loading...</div>
            ) : requests.length === 0 ? (
               <div className="text-center py-8 text-gray-400 border border-dashed rounded-xl">
                 <Wrench className="w-8 h-8 mx-auto mb-2 opacity-50" />
                 <p className="text-sm">No service requests yet.</p>
               </div>
            ) : (
              requests.map(req => (
                <Card key={req.id} className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <Badge variant="secondary" className="bg-primary/10 text-primary capitalize">{req.category}</Badge>
                      <span className="text-xs font-mono text-gray-400">{req.id.split('-')[0]}</span>
                    </div>
                    <h4 className="font-medium text-foreground text-sm line-clamp-2">{req.description}</h4>
                    
                    <div className="mt-4 pt-4 border-t border-border/50 text-sm">
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-gray-500">Status</span>
                        <span className={`font-semibold capitalize ${req.status === 'completed' || req.status === 'resolved' ? 'text-green-600' : req.status === 'open' || req.status === 'pending' ? 'text-orange-500' : 'text-blue-600'}`}>
                          {req.status}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Created</span>
                        <span className="text-foreground">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={isRequestModalOpen} onClose={() => !isSubmitting && setIsRequestModalOpen(false)} title="Raise Service Request">
        <form onSubmit={handleRequestSubmit} className="space-y-4 pt-2">
          {selectedVendor ? (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <Wrench className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-primary font-medium uppercase tracking-wider">Direct Request</p>
                <p className="font-semibold text-foreground">{selectedVendor.name}</p>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">Service Category</label>
              <select 
                disabled={isSubmitting}
                value={newReq.category} 
                onChange={e => setNewReq({...newReq, category: e.target.value})}
                className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="plumber">Plumbing</option>
                <option value="electrician">Electrical</option>
                <option value="carpenter">Carpentry</option>
                <option value="cleaner">Cleaning / Pest Control</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Issue Description</label>
            <textarea
              required
              disabled={isSubmitting}
              rows={4}
              value={newReq.desc}
              onChange={e => setNewReq({...newReq, desc: e.target.value})}
              className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              placeholder="Please describe the issue in detail..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Preferred Timing (Optional)</label>
            <Input disabled={isSubmitting} type="text" value={newReq.preferredTime} onChange={e => setNewReq({...newReq, preferredTime: e.target.value})} placeholder="e.g. Tomorrow morning, Weekends only" className="h-11" />
          </div>

          <div className="pt-4 flex justify-end space-x-3 border-t border-border mt-4">
            <Button disabled={isSubmitting} type="button" variant="ghost" onClick={() => setIsRequestModalOpen(false)}>Cancel</Button>
            <Button disabled={isSubmitting} type="submit">
               {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting</> : "Submit Request"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
