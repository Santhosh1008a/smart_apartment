import { create } from 'zustand'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../api/notifications'

export const useNotificationStore = create((set) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  fetchNotifications: async () => {
    set({ isLoading: true })
    try {
      const { data } = await getNotifications()
      set({ notifications: data })
    } catch (err) {
      console.error(err)
    } finally {
      set({ isLoading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { count } = await getUnreadCount()
      set({ unreadCount: count })
    } catch (err) {
      console.error(err)
    }
  },

  markAsRead: async (id) => {
    try {
      await markAsRead(id)
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, is_read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))
    } catch (err) {
      console.error(err)
    }
  },

  markAllAsRead: async () => {
    try {
      await markAllAsRead()
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        unreadCount: 0,
      }))
    } catch (err) {
      console.error(err)
    }
  },

  addRealtimeNotification: (notification) => {
    set((state) => {
      const alreadyExists = state.notifications.some((item) => item.id === notification.id)
      return {
        notifications: [notification, ...state.notifications.filter((item) => item.id !== notification.id)],
        unreadCount: alreadyExists ? state.unreadCount : state.unreadCount + (notification.is_read ? 0 : 1),
      }
    })
  },

  updateRealtimeNotification: (notification) => {
    set((state) => {
      const previous = state.notifications.find((item) => item.id === notification.id)
      const unreadDelta = previous
        ? Number(!notification.is_read) - Number(!previous.is_read)
        : 0
      return {
        notifications: previous
          ? state.notifications.map((item) => item.id === notification.id ? notification : item)
          : state.notifications,
        unreadCount: Math.max(0, state.unreadCount + unreadDelta),
      }
    })
  },
}))
