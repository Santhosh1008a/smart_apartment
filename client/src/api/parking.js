import api from './axios'

export const getMyParking = async () => {
  const res = await api.get('/parking/my')
  return res.data
}

export const registerVehicle = async (data) => {
  const res = await api.post('/parking/vehicles', data)
  return res.data
}

export const requestParking = async (data) => {
  const res = await api.post('/parking/requests', data)
  return res.data
}

export const getParkingOverview = async () => {
  const res = await api.get('/parking/admin/overview')
  return res.data
}

export const listParkingSlots = async (params) => {
  const res = await api.get('/parking/admin/slots', { params })
  return res.data
}

export const createParkingSlot = async (data) => {
  const res = await api.post('/parking/admin/slots', data)
  return res.data
}

export const updateParkingSlot = async (id, data) => {
  const res = await api.patch(`/parking/admin/slots/${id}`, data)
  return res.data
}

export const listParkingVehicles = async (params) => {
  const res = await api.get('/parking/admin/vehicles', { params })
  return res.data
}

export const assignParkingSlot = async (data) => {
  const res = await api.post('/parking/admin/assignments', data)
  return res.data
}

export const releaseParkingAssignment = async (id) => {
  const res = await api.patch(`/parking/admin/assignments/${id}/release`)
  return res.data
}

export const listParkingRequests = async (params) => {
  const res = await api.get('/parking/admin/requests', { params })
  return res.data
}

export const reviewParkingRequest = async (id, data) => {
  const res = await api.patch(`/parking/admin/requests/${id}`, data)
  return res.data
}

export const listVisitorParkingSessions = async (params, scope = 'admin') => {
  const res = await api.get(`/parking/${scope}/visitor-sessions`, { params })
  return res.data
}

export const createVisitorParkingSession = async (data, scope = 'admin') => {
  const res = await api.post(`/parking/${scope}/visitor-sessions`, data)
  return res.data
}

export const releaseVisitorParkingSession = async (id, scope = 'admin') => {
  const res = await api.patch(`/parking/${scope}/visitor-sessions/${id}/release`)
  return res.data
}

export const verifyParkingVehicle = async (vehicle_number) => {
  const res = await api.get('/parking/security/verify', { params: { vehicle_number } })
  return res.data
}

export const listSecurityParkingSlots = async (params) => {
  const res = await api.get('/parking/security/slots', { params })
  return res.data
}
