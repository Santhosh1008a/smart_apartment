import api from './axios'

// --- Services (Emergency, Parking, Vendors) ---

// Emergencies
export const triggerEmergency = async (data) => {
  const res = await api.post('/services/emergencies', data)
  return res.data
}

export const listEmergencies = async (params) => {
  const res = await api.get('/services/emergencies', { params })
  return res.data
}

export const resolveEmergency = async (id) => {
  const res = await api.patch(`/services/emergencies/${id}`, { status: 'resolved' })
  return res.data
}

// Parking
export const listParkingSlots = async (params) => {
  const res = await api.get('/services/parking/slots', { params })
  return res.data
}

export const listMyParkingAssignments = async (params) => {
  const res = await api.get('/services/parking/my-assignments', { params })
  return res.data
}

// Vendors
export const listVendors = async (category) => {
  const res = await api.get('/services/vendors', { params: { category } })
  return res.data
}

export const raiseVendorRequest = async (data) => {
  const res = await api.post('/services/vendor-requests', data)
  return res.data
}

export const listMyVendorRequests = async (params) => {
  const res = await api.get('/services/vendor-requests', { params })
  return res.data
}
