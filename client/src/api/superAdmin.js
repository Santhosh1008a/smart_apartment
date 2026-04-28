import api from './axios'

export const getSuperAdminDashboard = async () => {
  const res = await api.get('/super-admin/dashboard')
  return res.data
}

export const createComplex = async (data) => {
  const res = await api.post('/super-admin/complexes', data)
  return res.data
}

export const createAdmin = async (data) => {
  const res = await api.post('/super-admin/admins', data)
  return res.data
}
