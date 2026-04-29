import api from './axios'

export const getNotifications = async () => {
  const res = await api.get('/notifications')
  return res.data
}

export const getUnreadCount = async () => {
  const res = await api.get('/notifications/unread-count')
  return res.data
}

export const markAsRead = async (id) => {
  const res = await api.patch(`/notifications/${id}/read`)
  return res.data
}

export const markAllAsRead = async () => {
  const res = await api.patch('/notifications/read-all')
  return res.data
}
