import { create } from 'zustand'

export const useAuthStore = create((set) => ({
  // Authentication and personal profile/context data are memory-only. The
  // server keeps the refresh token in an HttpOnly cookie.
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isAuthReady: false,

  // Unit context (populated from /auth/me)
  complex: null,
  building: null,
  unit: null,
  parking: null,
  roleContext: null,

  login: (userData, token) => {
    set({ user: userData, accessToken: token, isAuthenticated: true })
  },

  logout: () => {
    try {
      ['user', 'accessToken', 'refreshToken', 'complex', 'building', 'unit', 'parking', 'roleContext']
        .forEach((key) => localStorage.removeItem(key))
    } catch {
      // Storage may be unavailable in restricted browser contexts.
    }
    set({ user: null, accessToken: null, isAuthenticated: false, isAuthReady: true, complex: null, building: null, unit: null, parking: null, roleContext: null })
  },

  setToken: (token) => {
    set({ accessToken: token })
  },

  setAuthReady: (ready) => set({ isAuthReady: ready }),
  setAuthenticated: (authenticated) => set({ isAuthenticated: authenticated }),

  // Hydrate user data from the /me endpoint
  setUser: (userData) => {
    set({ user: userData })
  },

  // Patch user fields without full re-login (for profile updates)
  updateUser: (partial) => {
    set((state) => {
      const updated = { ...state.user, ...partial }
      return { user: updated }
    })
  },

  // Set full context from /auth/me response
  setContext: (complex, building, unit, parking, roleContext) => {
    set({ complex, building, unit, parking: parking || null, roleContext: roleContext || null })
  },
}))
