import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import { ToastProvider } from '@components/Toast'
import './index.css'

// Unregister any stale service workers (e.g. from old PWA builds)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  })
}

// ── Sentry — same project as the backend ────────────────────────────────────
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,        // 'development' | 'production'
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
    ],
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-navy-600 mb-2">Something went wrong</h2>
          <p className="text-gray-500 text-sm mb-4">The error has been reported automatically.</p>
          <button onClick={() => window.location.reload()} className="bg-navy-600 text-white px-5 py-2 rounded-lg text-sm font-medium">
            Reload page
          </button>
        </div>
      </div>
    }>
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </HelmetProvider>
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)
