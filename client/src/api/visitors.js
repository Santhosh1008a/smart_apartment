import api from './axios'

// --- Visitors ---
export const createVisitorPass = async (data) => {
  const res = await api.post('/visitors', data)
  return res.data
}

export const verifyQR = async (token) => {
  const res = await api.post('/visitors/verify-qr', { token })
  return res.data
}

// Will be created in backend step 3.4
export const listMyPasses = async (params) => {
  const res = await api.get('/visitors', { params })
  return res.data
}

export const checkoutVisitor = async (id) => {
  const res = await api.post(`/visitors/${id}/checkout`)
  return res.data
}

export const cancelVisitorPass = async (id) => {
  const res = await api.delete(`/visitors/${id}`)
  return res.data
}
