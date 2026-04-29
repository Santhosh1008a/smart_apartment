import api from './axios'

// --- Payments & Invoices ---
export const listMyInvoices = async (params) => {
  const res = await api.get('/invoices', { params })
  return res.data
}

export const createOrder = async (invoiceId) => {
  const res = await api.post('/payments/create-order', { invoice_id: invoiceId })
  return res.data
}

export const verifyPayment = async (verificationData) => {
  const res = await api.post('/payments/verify', verificationData)
  return res.data
}
