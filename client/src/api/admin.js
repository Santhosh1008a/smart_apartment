import api from './axios'

// --- Admin ---
export const getDashboardStats = async () => {
  const res = await api.get('/admin/dashboard/stats')
  return res.data
}

export const getPaymentStatus = async () => {
  const res = await api.get('/admin/payment-status')
  return res.data
}

export const getAnalyticsTrends = async () => {
  const res = await api.get('/admin/analytics/trends')
  return res.data
}

export const listUsers = async (params) => {
  const res = await api.get('/admin/users', { params })
  return res.data
}

export const updateUserRole = async (id, data) => {
  const res = await api.patch(`/admin/users/${id}`, data)
  return res.data
}

export const listUnits = async (params) => {
  const res = await api.get('/admin/units', { params })
  return res.data
}

export const generateInvoice = async (data) => {
  const res = await api.post('/admin/invoices', data)
  return res.data
}

