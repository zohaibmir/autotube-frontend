import { create } from 'zustand'
import { tokenStore, StoredUser } from '@lib/tokenStore'
import { User } from '@types/api'
import apiClient from '@api/client'

interface AuthStore {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name?: string) => Promise<{ confirmEmail: boolean }>
  logout: () => Promise<void>
  /** Rehydrate store from localStorage + optionally verify with /api/auth/me */
  syncSession: () => Promise<void>
}

function _toUser(u: any, fallback?: Partial<User>): User {
  return {
    id: u.id ?? u.user_id ?? '',
    email: u.email ?? '',
    name: u.name ?? u.display_name ?? u.email ?? '',
    plan: u.plan ?? fallback?.plan ?? 'free',
    created_at: u.created_at ?? fallback?.created_at ?? new Date().toISOString(),
    role: u.role ?? fallback?.role ?? 'user',
  } as User
}

/**
 * Fetch the authoritative role/plan from /api/auth/me and update the store +
 * cached user. Login/signup responses only return {id, email, name} - without
 * this, a freshly logged-in super_admin/unlimited user would be stuck showing
 * as role='user'/plan='free' until a full page reload re-ran syncSession().
 */
async function _refreshFromMe(set: (partial: Partial<AuthStore>) => void, fallback?: Partial<User>) {
  try {
    const { data } = await apiClient.get('/api/auth/me')
    const user = _toUser({
      id: data.user_id, email: data.email, name: data.email, plan: data.plan, role: data.role,
    }, fallback)
    tokenStore.setUser(user as StoredUser)
    set({ user })
  } catch {
    // Best effort - keep whatever user state was already set from login/signup.
  }
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true })
    try {
      const { data } = await apiClient.post('/api/auth/login', { email, password })
      const user = _toUser(data.user)
      tokenStore.set(data.access_token, data.refresh_token, user as StoredUser)
      set({ user })
      await _refreshFromMe(set, { created_at: user.created_at })
    } finally {
      set({ isLoading: false })
    }
  },

  signup: async (email, password, name) => {
    set({ isLoading: true })
    try {
      const { data } = await apiClient.post('/api/auth/signup', { email, password, name })
      if (data.access_token) {
        const user = _toUser(data.user, { plan: 'free' })
        tokenStore.set(data.access_token, data.refresh_token, user as StoredUser)
        set({ user })
        await _refreshFromMe(set, { created_at: user.created_at, plan: 'free' })
      }
      return { confirmEmail: data.confirm_email ?? false }
    } finally {
      set({ isLoading: false })
    }
  },

  logout: async () => {
    try { await apiClient.post('/api/auth/logout') } catch { /* best effort */ }
    tokenStore.clear()
    set({ user: null })
  },

  syncSession: async () => {
    const stored = tokenStore.getUser()
    if (!tokenStore.hasToken()) {
      set({ user: stored ? _toUser(stored) : null })
      return
    }
    // Rehydrate immediately from cache, then silently verify with /api/auth/me
    if (stored) set({ user: _toUser(stored) })
    await _refreshFromMe(set, { created_at: stored?.created_at })
  },
}))
