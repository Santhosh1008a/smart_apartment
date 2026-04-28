import { useState, useEffect } from "react"
import { Card, CardContent } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { generateInvoice, listUnits } from "../../api/admin"
import { Loader2, FileText, CheckCircle2 } from "lucide-react"
import toast from "react-hot-toast"

export default function AdminInvoices() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [units, setUnits] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({ unit_id: '', amount: '', type: 'maintenance', due_date: '' })
  
  useEffect(() => {
    listUnits().then(res => {
      if(res.success) setUnits(res.data)
    }).catch(() => {
      toast.error("Failed to load units")
    })
  }, [])

  const resetForm = () => {
    setFormData({ unit_id: '', amount: '', type: 'maintenance', due_date: '' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Client-side guard
    if (!formData.unit_id) {
      toast.error("Please select a unit")
      return
    }
    if (!formData.amount || Number(formData.amount) <= 0) {
      toast.error("Please enter a valid amount")
      return
    }
    if (!formData.due_date) {
      toast.error("Please select a due date")
      return
    }

    setIsSubmitting(true)

    try {
      // Convert date to ISO format for Joi validation
      const payload = {
        unit_id: formData.unit_id,
        type: formData.type,
        amount: Number(formData.amount),
        due_date: new Date(formData.due_date).toISOString(),
      }

      const res = await generateInvoice(payload)

      if (res.success) {
        toast.success("Invoice created successfully!")
        setIsModalOpen(false)
        resetForm()
      }
    } catch (err) {
      // Handle validation errors with details
      const data = err.response?.data
      if (data?.errors && Array.isArray(data.errors)) {
        data.errors.forEach(e => toast.error(`${e.field}: ${e.message}`))
      } else {
        toast.error(data?.message || "Error creating invoice")
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Invoices & Billing</h2>
          <p className="text-gray-500 text-sm mt-1">Manage society invoices and generate new bills.</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>Create Invoice</Button>
      </div>
      
      <Card>
        <CardContent className="p-12 text-center text-gray-500">
          <p>Active and past invoices are tracked in the Admin Dashboard Payment Tracker.</p>
        </CardContent>
      </Card>
      
      <Modal isOpen={isModalOpen} onClose={() => !isSubmitting && setIsModalOpen(false)} title="Generate New Invoice">
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Target Unit</label>
            <select 
              required 
              disabled={isSubmitting}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" 
              value={formData.unit_id} 
              onChange={e => setFormData({...formData, unit_id: e.target.value})}
            >
              <option value="">Select Unit</option>
              {units?.map(u => <option key={u.id} value={u.id}>{u.building_name} - {u.unit_number}</option>)}
            </select>
            {units.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">No units found. Create buildings & units first.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <Input 
              required 
              type="number" 
              min="1"
              step="0.01"
              placeholder="e.g. 5000" 
              className="h-11" 
              disabled={isSubmitting}
              value={formData.amount} 
              onChange={e => setFormData({...formData, amount: e.target.value})} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fee Type</label>
            <select 
              disabled={isSubmitting}
              className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" 
              value={formData.type} 
              onChange={e => setFormData({...formData, type: e.target.value})}
            >
              <option value="maintenance">Maintenance</option>
              <option value="water">Water</option>
              <option value="electricity">Electricity</option>
              <option value="parking">Parking</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <Input 
              required 
              type="date" 
              className="h-11 w-full flex" 
              disabled={isSubmitting}
              min={new Date().toISOString().split('T')[0]}
              value={formData.due_date} 
              onChange={e => setFormData({...formData, due_date: e.target.value})} 
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                "Generate Invoice"
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
