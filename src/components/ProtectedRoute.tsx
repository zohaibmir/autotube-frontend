import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { tokenStore } from '@lib/tokenStore'

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  // Synchronous check: if no access token in localStorage → redirect to login.
  // The apiClient refresh interceptor handles token expiry transparently on the first request.
  if (!tokenStore.hasToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}
