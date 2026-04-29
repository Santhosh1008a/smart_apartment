import { useState, useEffect } from "react"
import { Card, CardContent } from "../../components/ui/Card"
import { Button } from "../../components/ui/Button"
import { Input } from "../../components/ui/Input"
import { Modal } from "../../components/ui/Modal"
import { generateInvoice, listUnits } from "../../api/admin"
import toast from "react-hot-toast"

export default function AdminInvoices() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [units, setUnits] = useState([])
  const [formData, setFormData] = useState({ unit_id: '', amount: '', type: 'maintenance', due_date: '', description: '' })
  
  useEffect(() => {
    listUnits().then(res => {
      if(res.success) setUnits(res.data)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await generateInvoice({ ...formData, amount: Number(formData.amount) })
      toast.success("Invoice created successfully!")
      setIsModalOpen(false)
    } catch (err) {
      toast.error(err.response?.data?.message || "Error creating invoice")
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
      
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Generate New Invoice">
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-sm font-medium mb-1">Target Unit</label>
            <select required className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={formData.unit_id} onChange={e => setFormData({...formData, unit_id: e.target.value})}>
              <option value="">Select Unit</option>
              {units?.map(u => <option key={u.id} value={u.id}>{u.building_name} - {u.unit_number}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Amount (₹)</label>
            <Input required type="number" placeholder="e.g. 5000" className="h-11" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Fee Type</label>
            <select className="flex h-11 w-full rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
              <option value="maintenance">Maintenance</option>
              <option value="event flex">Event</option>
              <option value="fine">Fine</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Due Date</label>
            <Input required type="date" className="h-11 w-full flex" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description (Optional)</label>
            <Input placeholder="Invoice details..." className="h-11" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
          </div>
          <div className="pt-4 flex justify-end space-x-3 border-t">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit">Generate Invoice</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
