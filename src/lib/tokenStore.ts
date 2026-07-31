/**
 * tokenStore — central localStorage token management.
 *
 * All auth state lives here.  The apiClient interceptors read/write here.
 * No Supabase JS client is imported anywhere — all auth proxies through FastAPI.
 */

const ACCESS_KEY  = 'vidora_access_token'
const REFRESH_KEY = 'vidora_refresh_token'
const USER_KEY    = 'vidora_user'

export interface StoredUser {
  id: string
  email: string
  name: string
  plan: string
  created_at: string
}

export const tokenStore = {
  getAccess:  (): string | null => localStorage.getItem(ACCESS_KEY),
  getRefresh: (): string | null => localStorage.getItem(REFRESH_KEY),

  getUser: (): StoredUser | null => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
    } catch {
      return null
    }
  },

  /** Store tokens (and optionally the user object) after login / signup / refresh. */
  set: (access: string, refresh: string, user?: StoredUser) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  /** Update only the cached user object (e.g. after /api/auth/me). */
  setUser: (user: StoredUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  },

  /** Clear everything — called on logout or after a failed refresh. */
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  },

  /** Returns true if an access token is present (doesn't validate expiry). */
  hasToken: (): boolean => Boolean(localStorage.getItem(ACCESS_KEY)),
}
