import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  full_name?: string
  tier: 'free' | 'pro' | 'business'
  created_at: string
}

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean

  setUser: (user: User | null) => void
  setToken: (token: string | null) => void
  login: (user: User, token: string) => void
  logout: () => void
  upgradeTier: (tier: string) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => set({ token }),

      login: (user, token) =>
        set({
          user,
          token,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        }),

      upgradeTier: (tier) =>
        set((state) => ({
          user: state.user ? { ...state.user, tier: tier as any } : null,
        })),
    }),
    {
      name: 'auth-storage',
    }
  )
)
