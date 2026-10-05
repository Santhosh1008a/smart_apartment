import api from './axios'

export const listNotices = async () => {
  const res = await api.get('/notices')
  return res.data
}

export const getNotice = async (id) => {
  const res = await api.get(`/notices/${id}`)
  return res.data
}

export const createNotice = async (notice) => {
  const res = await api.post('/notices', notice)
  return res.data
}

export const updateNotice = async (id, notice) => {
  const res = await api.patch(`/notices/${id}`, notice)
  return res.data
}

export const sendNotice = async (id) => {
  const res = await api.post(`/notices/${id}/send`)
  return res.data
}

export const cancelNotice = async (id) => {
  const res = await api.post(`/notices/${id}/cancel`)
  return res.data
}

export const markNoticeAsRead = async (id) => {
  const res = await api.patch(`/notices/${id}/read`)
  return res.data
}
