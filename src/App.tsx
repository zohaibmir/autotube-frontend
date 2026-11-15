import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { tokenStore } from '@lib/tokenStore'
import { captureException } from '@sentry/react'
import './index.css'

import { PUBLIC_ROUTES } from './PublicRoutes'
import NotFoundPage from './pages/NotFoundPage'
import SEO from '@components/SEO'
import CookieBanner from '@components/CookieBanner'

// Auth Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const SignupPage = lazy(() => import('./pages/auth/SignupPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))

// App Dashboard
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
import ProtectedRoute from './components/ProtectedRoute'

const loadingWorkspace = <main className="min-h-screen flex items-center justify-center" role="status">Loading your workspace...</main>

function PrivateSEO() {
  const { pathname } = useLocation()
  if (!/^\/app(?:\/|$)/.test(pathname) && !['/login', '/signup', '/forgot-password', '/reset-password'].includes(pathname)) {
    return null
  }
  return <SEO title="Your workspace" noIndex />
}

function App() {
  useEffect(() => {
    async function syncSession() {
      try {
        if (!tokenStore.hasToken() && !tokenStore.getUser()) return
        const { useAuthStore } = await import('@store/auth')
        await useAuthStore.getState().syncSession()
      } catch (error) {
        captureException(error)
        console.error('Unable to synchronize your session.', error)
      }
    }
    void syncSession()
  }, [])

  return (
    <BrowserRouter>
      <PrivateSEO />
      <Routes>
        {PUBLIC_ROUTES.map((route) => <Route key={route.path} {...route} />)}
        <Route path="/login" element={<Suspense fallback={loadingWorkspace}><LoginPage /></Suspense>} />
        <Route path="/signup" element={<Suspense fallback={loadingWorkspace}><SignupPage /></Suspense>} />
        {/* Password recovery. LoginPage links to /forgot-password; Supabase's
            recovery email redirects to /reset-password. */}
        <Route path="/forgot-password" element={<Suspense fallback={loadingWorkspace}><ForgotPasswordPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={loadingWorkspace}><ResetPasswordPage /></Suspense>} />
        <Route path="/app/*" element={
          <ProtectedRoute>
            <Suspense fallback={loadingWorkspace}><DashboardPage /></Suspense>
          </ProtectedRoute>
        } />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      {/* Shown on every route until the user decides, including the dashboard —
          consent has to be collected wherever non-essential storage might run. */}
      <CookieBanner />
    </BrowserRouter>
  )
}

export default App
