import React from 'react'
import ReactDOM from 'react-dom/client'
import { HelmetProvider } from 'react-helmet-async'
import * as Sentry from '@sentry/react'
import App from './App.tsx'
import { replayConsent, CONSENT_EVENT } from '@lib/consent'
import './index.css'

// Unregister any stale service workers (e.g. from old PWA builds)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister())
  })
}

// ── Sentry — same project as the backend ────────────────────────────────────
//
// Session Replay records what the user actually sees. This previously ran with
// maskAllText:false / blockAllMedia:false on 100% of production error sessions,
// which captured unmasked screen text — including generated scripts, prompts,
// and the OAuth Client Secret field in Settings. That was a privacy hole, and
// because Replay writes to the device it is also non-essential storage under
// ePrivacy Art. 5(3), so it must not run before consent.
//
// Now: error monitoring and tracing stay on (they keep the service working and
// record no screen), Replay is attached only once the user opts in, and masking
// is on regardless — so even a consented replay cannot capture text or media.
const replayAllowed = () => replayConsent() === 'granted'

let replayAttached = false
let replayLoading = false
async function attachReplay() {
  if (replayAttached || replayLoading || !import.meta.env.VITE_SENTRY_DSN) return
  replayLoading = true
  try {
    const { replayIntegration } = await import('@sentry/replay')
    if (!replayAllowed()) return
    Sentry.addIntegration(replayIntegration({
      maskAllText: true,     // never capture text, including user content
      maskAllInputs: true,   // never capture what is typed into forms
      blockAllMedia: true,   // never capture images, audio or video
    }))
    replayAttached = true
  } catch (error) {
    Sentry.captureException(error)
    console.error('Unable to load consented error replay.', error)
  } finally {
    replayLoading = false
  }
}

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,        // 'development' | 'production'
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
    // Sampling only takes effect once the integration is attached below.
    replaysOnErrorSampleRate: import.meta.env.PROD ? 1.0 : 0,
    integrations: [Sentry.browserTracingIntegration()],
  })
  if (replayAllowed()) attachReplay()
}

// The user can change their mind from the banner or the Cookie Policy page.
window.addEventListener(CONSENT_EVENT, () => {
  if (replayAllowed()) attachReplay()
})

const app = (
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
        <HelmetProvider>
          <App />
        </HelmetProvider>
    </Sentry.ErrorBoundary>
  </React.StrictMode>
)

const root = document.getElementById('root')
if (root.dataset.prerendered === 'true') {
  ReactDOM.hydrateRoot(root, app)
} else {
  // The unrendered private/dev shell has no React-owned metadata to hydrate.
  document.head.querySelectorAll('[data-seo]').forEach((tag) => tag.remove())
  ReactDOM.createRoot(root).render(app)
}
