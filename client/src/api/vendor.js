import api from './axios'

// --- Vendor Module ---
export const getVendorRequests = async () => {
  const res = await api.get('/vendor/requests')
  return res.data
}

export const updateVendorRequestStatus = async (id, status) => {
  const res = await api.patch(`/vendor/requests/${id}`, { status })
  return res.data
}
