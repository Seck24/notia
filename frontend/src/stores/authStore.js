import { create } from 'zustand'
import api from '../services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  cabinet: null,
  config: null,
  loading: true,

  initialize: async () => {
    const token = localStorage.getItem('notia_token')
    if (!token) { set({ loading: false }); return }
    try {
      const { data } = await api.get('/auth/me')
      set({ user: data.user, cabinet: data.cabinet, config: data.config, loading: false })
    } catch {
      localStorage.removeItem('notia_token')
      set({ user: null, cabinet: null, config: null, loading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('notia_token', data.access_token)
    localStorage.setItem('notia_refresh', data.refresh_token)
    set({ user: data.user })
    await get().initialize()
    return data
  },

  register: async (payload) => {
    const { data } = await api.post('/auth/register', payload)
    return data
  },

  logout: () => {
    localStorage.removeItem('notia_token')
    localStorage.removeItem('notia_refresh')
    set({ user: null, cabinet: null, config: null })
    window.location.href = '/login'
  },
}))

export default useAuthStore
