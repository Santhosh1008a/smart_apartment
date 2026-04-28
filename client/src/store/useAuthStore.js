import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user')) || null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  // Unit context (populated from /auth/me)
  complex: JSON.parse(localStorage.getItem('complex')) || null,
  building: JSON.parse(localStorage.getItem('building')) || null,
  unit: JSON.parse(localStorage.getItem('unit')) || null,

  login: (userData, token, refreshToken) => {
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('accessToken', token)
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
    set({ user: userData, accessToken: token, refreshToken: refreshToken || null, isAuthenticated: true })
  },

  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('complex')
    localStorage.removeItem('building')
    localStorage.removeItem('unit')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, complex: null, building: null, unit: null })
  },

  setToken: (token) => {
    localStorage.setItem('accessToken', token)
    set({ accessToken: token, isAuthenticated: true })
  },

  // Hydrate user data from the /me endpoint if needed
  setUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    set({ user: userData })
  },

  // Set full context from /auth/me response
  setContext: (complex, building, unit) => {
    if (complex) localStorage.setItem('complex', JSON.stringify(complex))
    else localStorage.removeItem('complex')
    if (building) localStorage.setItem('building', JSON.stringify(building))
    else localStorage.removeItem('building')
    if (unit) localStorage.setItem('unit', JSON.stringify(unit))
    else localStorage.removeItem('unit')
    set({ complex, building, unit })
  },
}))
