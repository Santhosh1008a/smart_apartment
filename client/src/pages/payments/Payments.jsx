import { useState, useEffect } from "react"
import { CreditCard, CheckCircle2, FileText, ArrowUpRight, IndianRupee, Loader2, AlertCircle, Building2, DoorOpen, MapPin } from "lucide-react"
import { Button } from "../../components/ui/Button"
import { Card, CardHeader, CardTitle, CardContent } from "../../components/ui/Card"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "../../components/ui/Table"
import { Badge } from "../../components/ui/Badge"
import { Modal } from "../../components/ui/Modal"
import { useAuthStore } from "../../store/useAuthStore"
import { listMyInvoices, createOrder, verifyPayment } from "../../api/payments"
import toast from "react-hot-toast"

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script")
    script.src = "https://checkout.razorpay.com/v1/checkout.js"
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Payments() {
  const { user, complex, building, unit } = useAuthStore()
  const [isPayModalOpen, setIsPayModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [invoices, setInvoices] = useState([])

  const fetchInvoices = async () => {
    try {
      setIsLoading(true)
      const res = await listMyInvoices()
      if (res.success) {
        setInvoices(res.data)
      }
    } catch (err) {
      toast.error("Failed to load invoices")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handlePayClick = (invoice) => {
    setSelectedInvoice(invoice)
    setIsPayModalOpen(true)
    setPaymentSuccess(false)
  }

  const handlePaymentConfirm = async () => {
    setIsProcessing(true)
    
    try {
      // 1. Load Razorpay Script
      const res = await loadRazorpayScript()
      if (!res) {
        toast.error("Razorpay SDK failed to load. Are you online?")
        setIsProcessing(false)
        return
      }

      // 2. Create Order Backend
      const orderData = await createOrder(selectedInvoice.id)
      if (!orderData.success) {
        toast.error("Failed to create order")
        setIsProcessing(false)
        return
      }

      const { order_id, amount, currency, key_id } = orderData.data

      // 3. Initialize Razorpay Checkout
      const options = {
        key: key_id,
        amount: amount,
        currency: currency,
        name: "Apartment Management",
        description: selectedInvoice.type || "Maintenance Bill",
        order_id: order_id,
        handler: async function (response) {
          try {
            // 4. Verify Payment Backend
            const verifyRes = await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            })

            if (verifyRes.success) {
              setPaymentSuccess(true)
              fetchInvoices() // Refresh list
              setTimeout(() => {
                setIsPayModalOpen(false)
                setSelectedInvoice(null)
              }, 3000)
            }
          } catch (err) {
            toast.error("Payment verification failed")
            setIsProcessing(false)
          }
        },
        prefill: {
          name: user?.full_name || "",
          email: user?.email || "",
          contact: user?.phone || ""
        },
        theme: {
          color: "#4f46e5"
        }
      }

      const paymentObject = new window.Razorpay(options)
      paymentObject.on('payment.failed', function (response){
        toast.error("Payment failed. Please try again.")
        setIsProcessing(false)
      })
      paymentObject.open()
      
    } catch (err) {
      toast.error(err.response?.data?.message || "Something went wrong")
      setIsProcessing(false)
    }
  }

  const totalDue = invoices.filter(inv => inv.status !== 'paid').reduce((acc, curr) => acc + parseFloat(curr.amount), 0)
  const pendingCount = invoices.filter(inv => inv.status !== 'paid').length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Payments & Invoices</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your maintenance dues and view history</p>
        </div>
        {unit && (
          <div className="flex items-center gap-2 text-sm bg-secondary/50 border border-border rounded-lg px-3 py-2">
            <DoorOpen className="w-4 h-4 text-primary" />
            <span className="font-medium text-foreground">Unit {unit.unit_number}</span>
            {building && (
              <>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">{building.name}</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-gradient-to-br from-primary to-primary-hover text-primary-foreground border-none shadow-lg">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-primary-foreground/80">Total Due</p>
                <h3 className="text-4xl font-bold mt-2">₹{totalDue.toLocaleString()}</h3>
              </div>
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <IndianRupee className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-sm font-medium text-primary-foreground/90">
              <AlertCircle className="w-4 h-4 mr-1.5" /> {pendingCount} Invoice{pendingCount !== 1 ? 's' : ''} pending
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-none">
        <CardHeader className="border-b border-border/40 pb-4">
          <CardTitle className="text-lg">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center flex-col items-center py-12 text-gray-500 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p>Loading invoices...</p>
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500 opacity-50" />
              <p>You have no invoices. You're all caught up!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-md ${inv.status === 'paid' ? 'bg-secondary/40 text-gray-500' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30'}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-foreground capitalize">{inv.type}</p>
                          <p className="text-xs text-gray-500 font-mono mt-0.5">{inv.id}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{inv.type}</Badge></TableCell>
                    <TableCell className="font-semibold text-foreground">₹{parseFloat(inv.amount).toLocaleString()}</TableCell>
                    <TableCell className="text-gray-500">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {inv.status === "paid" 
                        ? <Badge variant="success" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 border-transparent">Paid</Badge>
                        : <Badge variant="destructive" className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 border-transparent">Unpaid</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status !== "paid" ? (
                        <Button size="sm" onClick={() => handlePayClick(inv)} className="shadow-sm">
                          Pay Now <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" className="text-gray-500">
                          Receipt
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Modal isOpen={isPayModalOpen} onClose={() => !isProcessing && setIsPayModalOpen(false)} title="Checkout Details">
        {selectedInvoice && !paymentSuccess && (
          <div className="space-y-6 pb-2">
            <div className="p-4 bg-secondary/30 rounded-xl border border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-500 capitalize">{selectedInvoice.type}</span>
                <span className="font-bold text-foreground">₹{parseFloat(selectedInvoice.amount).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">Convenience Fee</span>
                <span className="font-medium text-foreground">₹0</span>
              </div>
              <div className="h-px bg-border my-3" />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-foreground">Total Payable</span>
                <span className="text-xl font-bold text-primary">₹{parseFloat(selectedInvoice.amount).toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-medium">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button className="flex flex-col items-center justify-center p-4 border-2 border-primary bg-primary/5 rounded-xl transition-colors">
                  <CreditCard className="w-6 h-6 text-primary mb-2" />
                  <span className="text-sm font-semibold text-primary">Card / UPI</span>
                </button>
                <button disabled className="flex flex-col items-center justify-center p-4 border border-border bg-secondary/20 rounded-xl opacity-50 cursor-not-allowed">
                  <Building2 className="w-6 h-6 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-500">Net Banking</span>
                </button>
              </div>
            </div>

            <Button 
              className="w-full h-12 text-base shadow-lg shadow-primary/20 mt-4" 
              onClick={handlePaymentConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing via Razorpay...</>
              ) : (
                `Secure Pay ₹${parseFloat(selectedInvoice.amount).toLocaleString()}`
              )}
            </Button>
          </div>
        )}

        {paymentSuccess && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4 animate-in zoom-in duration-300">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mb-2">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-foreground">Payment Successful!</h3>
            <p className="text-gray-500 text-center max-w-xs">
              Your payment of ₹{parseFloat(selectedInvoice.amount).toLocaleString()} has been received and verified.
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
