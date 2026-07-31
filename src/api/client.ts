import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios'
import { tokenStore } from '@lib/tokenStore'

// FastAPI routers include /api/ in their own prefix, so baseURL is the bare host.
// VITE_API_URL should be set to e.g. http://localhost:8080 (no trailing /api)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach stored JWT ────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = tokenStore.getAccess()
    if (token) config.headers.Authorization = `Bearer ${token}`
    return config
  },
  (error) => Promise.reject(error)
)

// ── Response interceptor: silent token refresh on 401 ────────────────────────
let _refreshing = false
let _waitQueue: Array<(token: string | null) => void> = []

function _drainQueue(token: string | null) {
  _waitQueue.forEach((cb) => cb(token))
  _waitQueue = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error)
    }

    const refreshToken = tokenStore.getRefresh()
    if (!refreshToken) {
      tokenStore.clear()
      window.location.href = '/login'
      return Promise.reject(error)
    }

    if (_refreshing) {
      // Queue this request until the in-flight refresh completes
      return new Promise((resolve, reject) => {
        _waitQueue.push((newToken) => {
          if (!newToken) return reject(error)
          original._retry = true
          original.headers.Authorization = `Bearer ${newToken}`
          resolve(apiClient(original))
        })
      })
    }

    original._retry = true
    _refreshing = true

    try {
      const { data } = await axios.post(`${API_BASE_URL}/api/auth/refresh`, {
        refresh_token: refreshToken,
      })
      tokenStore.set(data.access_token, data.refresh_token)
      _drainQueue(data.access_token)
      original.headers.Authorization = `Bearer ${data.access_token}`
      return apiClient(original)
    } catch {
      tokenStore.clear()
      _drainQueue(null)
      window.location.href = '/login'
      return Promise.reject(error)
    } finally {
      _refreshing = false
    }
  }
)

export default apiClient
