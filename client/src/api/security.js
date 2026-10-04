import api from './axios'

// --- Security Module ---
export const getVisitorsToday = async () => {
  const res = await api.get('/security/visitors/today')
  return res.data
}

export const checkinVisitor = async (id) => {
  const res = await api.post(`/security/visitor/${id}/checkin`)
  return res.data
}

export const checkoutVisitorSecurity = async (id) => {
  const res = await api.post(`/security/visitor/${id}/checkout`)
  return res.data
}

export const resolveOverdueVisitor = async (id) => {
  const res = await api.post(`/security/visitor/${id}/resolve-overdue`)
  return res.data
}

export const extendVisitorValidity = async (id, hours = 24) => {
  const res = await api.post(`/security/visitor/${id}/extend`, { hours })
  return res.data
}
