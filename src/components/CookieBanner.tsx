import { useLayoutEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readConsent, saveConsent, CONSENT_EVENT } from '@lib/consent'

/**
 * Storage / cookie consent banner.
 *
 * Only appears while a non-essential purpose is still undecided — currently
 * just Sentry Session Replay. Everything else the app stores is strictly
 * necessary (sign-in tokens, your own drafts), so choosing "Essential only"
 * changes nothing about how the product works.
 *
 * Deliberate design choices, because dark patterns are what regulators
 * actually fine: both buttons carry the same visual weight, nothing is
 * pre-selected, the banner never blocks the page, and refusing is one click.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(true)

  useLayoutEffect(() => {
    const sync = () => {
      const decided = readConsent() !== null
      document.documentElement.toggleAttribute('data-consent-decided', decided)
      setVisible(!decided)
    }
    sync()
    window.addEventListener(CONSENT_EVENT, sync)
    return () => window.removeEventListener(CONSENT_EVENT, sync)
  }, [])

  if (!visible) return null

  return (
    <div
      data-consent-banner=""
      role="dialog"
      aria-live="polite"
      aria-label="Cookies and stored data"
      className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 pointer-events-none"
    >
      <div className="max-w-3xl mx-auto bg-white border border-[#E5E5E5] rounded-lg shadow-lg p-5 pointer-events-auto">
        <p className="text-sm font-semibold text-[#0A0A0A] mb-1">Cookies and stored data</p>
        <p className="text-sm text-[#525252] leading-relaxed mb-4">
          We use your browser's storage to keep you signed in and to remember your drafts. That part
          is essential and cannot be switched off. We would also like to record short replays of the
          screen when an error happens, so we can fix bugs faster — that part is optional.{' '}
          <Link to="/cookies" className="underline hover:text-[#0A0A0A]">
            What we store
          </Link>
        </p>
        <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => saveConsent('denied')}
            className="h-9 px-4 text-sm font-medium rounded-md border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
          >
            Essential only
          </button>
          <button
            type="button"
            onClick={() => saveConsent('granted')}
            className="h-9 px-4 text-sm font-medium rounded-md bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  )
}
