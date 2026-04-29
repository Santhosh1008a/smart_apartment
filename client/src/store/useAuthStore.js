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
  parking: JSON.parse(localStorage.getItem('parking')) || null,
  roleContext: JSON.parse(localStorage.getItem('roleContext')) || null,

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
    localStorage.removeItem('parking')
    localStorage.removeItem('roleContext')
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, complex: null, building: null, unit: null, parking: null, roleContext: null })
  },

  setToken: (token) => {
    localStorage.setItem('accessToken', token)
    set({ accessToken: token, isAuthenticated: true })
  },

  // Hydrate user data from the /me endpoint
  setUser: (userData) => {
    localStorage.setItem('user', JSON.stringify(userData))
    set({ user: userData })
  },

  // Patch user fields without full re-login (for profile updates)
  updateUser: (partial) => {
    set((state) => {
      const updated = { ...state.user, ...partial }
      localStorage.setItem('user', JSON.stringify(updated))
      return { user: updated }
    })
  },

  // Set full context from /auth/me response
  setContext: (complex, building, unit, parking, roleContext) => {
    if (complex) localStorage.setItem('complex', JSON.stringify(complex))
    else localStorage.removeItem('complex')
    if (building) localStorage.setItem('building', JSON.stringify(building))
    else localStorage.removeItem('building')
    if (unit) localStorage.setItem('unit', JSON.stringify(unit))
    else localStorage.removeItem('unit')
    if (parking) localStorage.setItem('parking', JSON.stringify(parking))
    else localStorage.removeItem('parking')
    if (roleContext) localStorage.setItem('roleContext', JSON.stringify(roleContext))
    else localStorage.removeItem('roleContext')
    set({ complex, building, unit, parking: parking || null, roleContext: roleContext || null })
  },
}))
