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

// --- Buildings ---
export const listBuildings = async () => {
  const res = await api.get('/admin/buildings')
  return res.data
}

export const createBuilding = async (data) => {
  const res = await api.post('/admin/buildings', data)
  return res.data
}

// --- Units ---
export const createUnit = async (data) => {
  const res = await api.post('/admin/units', data)
  return res.data
}

export const bulkCreateUnits = async (data) => {
  const res = await api.post('/admin/units/bulk', data)
  return res.data
}

export const assignUserToUnit = async (unitId, data) => {
  const res = await api.post(`/admin/units/${unitId}/assign`, data)
  return res.data
}

// --- Vendor Requests (Admin) ---
export const listVendorRequests = async (params) => {
  const res = await api.get('/services/admin/vendor-requests', { params })
  return res.data
}

export const listVendorsForComplex = async () => {
  const res = await api.get('/admin/vendors')
  return res.data
}

export const assignVendorToRequest = async (requestId, vendorId) => {
  const res = await api.patch(`/admin/vendor-requests/${requestId}/assign`, { vendor_id: vendorId })
  return res.data
}
