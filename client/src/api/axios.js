import axios from 'axios'
import { useAuthStore } from '../store/useAuthStore'

const apiOrigin = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
const apiBaseUrl = `${apiOrigin}/api/v1`

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token && config.url !== '/auth/refresh' && config.url !== '/auth/login') {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let refreshPromise = null

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    const canRefresh = error.response?.status === 401
      && originalRequest
      && !originalRequest._retry
      && !['/auth/refresh', '/auth/login', '/auth/logout'].includes(originalRequest.url)

    if (!canRefresh) return Promise.reject(error)

    originalRequest._retry = true
    try {
      if (!refreshPromise) {
        refreshPromise = axios.post(`${apiBaseUrl}/auth/refresh`, {}, { withCredentials: true })
          .then(({ data }) => {
            if (!data.success || !data.accessToken) throw new Error('Session refresh failed')
            useAuthStore.getState().setToken(data.accessToken)
            return data.accessToken
          })
          .finally(() => { refreshPromise = null })
      }

      const accessToken = await refreshPromise
      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${accessToken}`
      return api(originalRequest)
    } catch {
      useAuthStore.getState().logout()
      if (window.location.pathname !== '/login') window.location.href = '/login'
      return Promise.reject(error)
    }
  },
)

export default api
