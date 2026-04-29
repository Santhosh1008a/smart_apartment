import { create } from 'zustand'
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../api/notifications'

export const useNotificationStore = create((set, get) => ({
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
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }))
  },
}))
