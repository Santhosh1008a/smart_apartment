import { useState, useEffect, useRef } from "react"
import { Plus, Search, QrCode as QrCodeIcon, Calendar, Clock, MoreVertical, Loader2, Trash2, X } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"
import { listMyPasses, createVisitorPass, cancelVisitorPass } from "../../api/visitors"
import { QRCodeSVG } from "qrcode.react"
import toast from "react-hot-toast"

export default function Visitors() {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isQrOpen, setIsQrOpen] = useState(false)
  const [selectedPass, setSelectedPass] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)
  
  const [passes, setPasses] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(null)

  // New Pass Form State
  const [newPass, setNewPass] = useState({ name: "", phone: "", type: "Guest", date: "", time: "" })

  const fetchPasses = async () => {
    try {
      setIsLoading(true)
      const res = await listMyPasses()
      if (res.success) {
        setPasses(res.data)
      }
    } catch (err) {
      toast.error("Failed to load visitor passes")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPasses()
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    setIsCreating(true)

    try {
      // Create valid_from and valid_until
      const validFrom = new Date(`${newPass.date}T${newPass.time}:00`);
      // Default to 12 hours validity from generation
      const validUntil = new Date(validFrom.getTime() + 12 * 60 * 60 * 1000);

      const res = await createVisitorPass({
        visitor_name: newPass.name,
        visitor_phone: newPass.phone || null,
        purpose: newPass.type,
        valid_from: validFrom.toISOString(),
        valid_until: validUntil.toISOString()
      })

      if (res.success) {
        toast.success("Visitor pass generated successfully!")
        setIsCreateOpen(false)
        setNewPass({ name: "", phone: "", type: "Guest", date: "", time: "" })
        fetchPasses()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate pass")
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (passId) => {
    setIsDeleting(passId)
    try {
      const res = await cancelVisitorPass(passId)
      if (res.success) {
        toast.success("Pass cancelled successfully")
        setOpenMenuId(null)
        fetchPasses()
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel pass")
    } finally {
      setIsDeleting(null)
    }
  }

  const getStatusBadge = (status) => {
    switch(status) {
      case 'checked_in': return <Badge variant="success">Checked In</Badge>
      case 'pending': return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-400">Pending</Badge>
      case 'expired': return <Badge variant="outline" className="text-gray-500 border-gray-300">Expired</Badge>
      case 'completed': return <Badge variant="outline" className="text-gray-500 border-gray-300">Completed</Badge>
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>
      default: return <Badge variant="default" className="capitalize">{status}</Badge>
    }
  }

  const openQrModal = (pass) => {
    setSelectedPass(pass)
    setIsQrOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Visitors & QR Passes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your guests and service personnel</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto shadow-md">
          <Plus className="w-4 h-4 mr-2" />
          Create Pass
        </Button>
      </div>

      <Card className="border-none shadow-md">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Recent Passes</CardTitle>
            <div className="relative w-64 max-w-full hidden sm:block">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400">
                <Search className="w-4 h-4" />
              </div>
              <Input placeholder="Search visitors..." className="pl-9 h-9 bg-secondary/50 border-transparent focus:border-ring" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
             <div className="flex justify-center flex-col items-center py-12 text-gray-500 space-y-4">
               <Loader2 className="w-8 h-8 animate-spin text-primary" />
               <p>Loading passes...</p>
             </div>
          ) : passes.length === 0 ? (
             <div className="text-center py-12 text-gray-500">
               <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
                 <QrCodeIcon className="w-8 h-8 text-gray-400" />
               </div>
               <p>No visitor passes found.</p>
               <Button variant="link" onClick={() => setIsCreateOpen(true)} className="mt-2 text-primary">Create your first pass</Button>
             </div>
          ) : (
            <div className="divide-y divide-border/50">
              {Array.isArray(passes) && passes.map((pass) => (
                <div key={pass?.id} className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:bg-secondary/20 transition-colors">
                  <div className="flex items-center space-x-4 w-full">
                    <div className="hidden sm:flex w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/50 dark:to-purple-900/50 items-center justify-center text-xl font-bold text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 shadow-sm">
                      {pass?.visitor_name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-semibold text-foreground text-base">{pass?.visitor_name || 'Unknown'}</p>
                        {getStatusBadge(pass?.status)}
                      </div>
                      <div className="flex flex-wrap items-center text-sm text-gray-500 mt-1.5 gap-3">
                        <span className="flex items-center"><Badge variant="outline" className="text-[10px] leading-3 py-0 pb-0.5 border-border">{pass?.purpose}</Badge></span>
                        <span className="flex items-center text-gray-400">•</span>
                        <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1.5" /> {pass?.valid_from ? new Date(pass.valid_from).toLocaleDateString() : 'N/A'}</span>
                        <span className="flex items-center text-gray-400 hidden sm:block">•</span>
                        <span className="flex items-center"><Clock className="w-3.5 h-3.5 mr-1.5" /> {pass?.valid_from ? new Date(pass.valid_from).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center w-full sm:w-auto mt-4 sm:mt-0 justify-end space-x-2 border-t sm:border-t-0 pt-4 sm:pt-0 border-border/50">
                    <Button variant="outline" size="sm" onClick={() => openQrModal(pass)} disabled={pass?.status === 'cancelled' || pass?.status === 'completed'} className="w-full sm:w-auto hover:bg-primary/5 hover:text-primary hover:border-primary/50 transition-colors">
                      <QrCodeIcon className="w-4 h-4 mr-2" /> View QR
                    </Button>
                    
                    {/* 3-dot dropdown menu */}
                    <div className="relative" ref={openMenuId === pass?.id ? menuRef : null}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMenuId(openMenuId === pass?.id ? null : pass?.id)
                        }}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </Button>
                      {openMenuId === pass?.id && (
                        <div className="absolute right-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-xl z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                          <button
                            disabled={isDeleting === pass?.id || pass?.status === 'cancelled'}
                            onClick={() => handleDelete(pass?.id)}
                            className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {isDeleting === pass?.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                            Cancel Pass
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Pass Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => !isCreating && setIsCreateOpen(false)} title="Create Visitor Pass">
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Visitor Name</label>
            <Input required disabled={isCreating} value={newPass.name} onChange={e => setNewPass({...newPass, name: e.target.value})} placeholder="e.g. John Doe" className="h-11" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Phone Number (Optional)</label>
            <Input disabled={isCreating} value={newPass.phone} type="tel" maxLength="10" onChange={e => setNewPass({...newPass, phone: e.target.value})} placeholder="10-digit number" className="h-11" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Purpose / Type</label>
            <select 
              disabled={isCreating}
              value={newPass.type} 
              onChange={e => setNewPass({...newPass, type: e.target.value})}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="Guest">Guest</option>
              <option value="Delivery">Delivery</option>
              <option value="Service">Service/Repair</option>
              <option value="Cab">Cab</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Date</label>
              <Input required disabled={isCreating} type="date" value={newPass.date} onChange={e => setNewPass({...newPass, date: e.target.value})} className="h-11" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Time</label>
              <Input required disabled={isCreating} type="time" value={newPass.time} onChange={e => setNewPass({...newPass, time: e.target.value})} className="h-11" />
            </div>
          </div>
          <div className="pt-6 flex justify-end space-x-3 border-t border-border/50 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={isCreating}>Cancel</Button>
            <Button type="submit" className="shadow-md" disabled={isCreating}>
              {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Generate Pass"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View QR Modal */}
      {isQrOpen && selectedPass && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200" onClick={() => setIsQrOpen(false)}>
          <div className="bg-card text-card-foreground w-full max-w-md rounded-xl shadow-2xl border animate-in zoom-in-95 duration-200 p-6 relative flex flex-col m-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Visitor QR Pass</h2>
              <button onClick={() => setIsQrOpen(false)} className="p-1.5 rounded-md hover:bg-secondary text-gray-500 hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-col items-center justify-center p-4 space-y-6">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-foreground">{selectedPass.visitor_name}</h3>
                <div className="flex items-center justify-center space-x-2 mt-2">
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">{selectedPass.purpose}</Badge>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm font-medium text-gray-500">{new Date(selectedPass.valid_from).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="bg-white p-6 rounded-2xl shadow-[inset_0_-4px_6px_rgba(0,0,0,0.05),0_10px_15px_-3px_rgba(0,0,0,0.1)] border border-gray-100 relative overflow-hidden w-full max-w-[260px] mx-auto flex justify-center items-center">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                <div style={{ background: 'white', padding: '16px' }}>
                  <QRCodeSVG 
                    value={String(selectedPass.qr_token || selectedPass.id || "N/A")} 
                    size={180} 
                  />
                </div>
              </div>
              
              <div className="w-full bg-secondary/40 rounded-xl p-4 text-center border border-border shadow-inner">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">Pass ID</p>
                <p className="text-2xl font-mono font-bold tracking-[0.3em] text-foreground">{(selectedPass.id || "").toString().split('-')[0].toUpperCase() || "N/A"}</p>
              </div>
              
              <p className="text-xs text-center text-gray-500 max-w-xs">
                Valid until: {selectedPass.valid_until ? new Date(selectedPass.valid_until).toLocaleString() : 'N/A'}
              </p>
              
              <Button className="w-full h-11 text-base shadow-md" onClick={() => setIsQrOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
