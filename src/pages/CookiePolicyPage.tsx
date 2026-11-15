import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { useEffect, useState } from 'react'
import type { ConsentState } from '@lib/consent'
import { clearConsent, replayConsent } from '@lib/consent'

const LAST_UPDATED = '11 October 2026'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE FOR MAINTAINERS
//
// Keep this table in step with the code. The keys below were read from
// lib/tokenStore.ts, lib/consent.ts, store/create.ts (persist name) and the
// dashboard's per-user keys. If you add storage, add a row here.
//
// The distinction that matters legally is essential vs optional. Everything
// except Sentry Session Replay is strictly necessary under ePrivacy Art. 5(3),
// which is why refusing consent does not degrade the product.
// ─────────────────────────────────────────────────────────────────────────────

interface Row {
  name: string
  type: string
  purpose: string
  retention: string
}

const ESSENTIAL: Row[] = [
  {
    name: 'vidora_access_token',
    type: 'localStorage',
    purpose: 'Keeps you signed in — the token sent with each request to your account.',
    retention: 'Until you sign out, or the token expires.',
  },
  {
    name: 'vidora_refresh_token',
    type: 'localStorage',
    purpose: 'Renews your session so you are not signed out mid-task.',
    retention: 'Until you sign out.',
  },
  {
    name: 'vidora_user',
    type: 'localStorage',
    purpose: 'Caches your name, email and plan so the interface renders instantly on load.',
    retention: 'Until you sign out.',
  },
  {
    name: 'yt-create-workspace',
    type: 'localStorage',
    purpose: 'Saves your in-progress Create wizard draft, so a half-written script survives closing the tab.',
    retention: 'Until you finish or discard the draft.',
  },
  {
    name: 'yt-oauth, yt_channel_added',
    type: 'localStorage',
    purpose: 'Carries short-lived state through the YouTube channel-connection flow.',
    retention: 'Cleared when the flow completes.',
  },
  {
    name: 'vidora_bookmarks_*',
    type: 'localStorage',
    purpose: 'Remembers which topic ideas you bookmarked.',
    retention: 'Until you clear your browser data.',
  },
  {
    name: 'vidora_checklist_dismissed_*, vidora_first_video_celebrated_*',
    type: 'localStorage',
    purpose: 'Remembers that you dismissed the getting-started checklist or the first-video message, so we do not show them again.',
    retention: 'Until you clear your browser data.',
  },
  {
    name: 'vidora_consent',
    type: 'localStorage',
    purpose: 'Records the choice you make on this page, so we do not ask again.',
    retention: 'Until you change your choice below.',
  },
]

const OPTIONAL: Row[] = [
  {
    name: 'Sentry Session Replay',
    type: 'localStorage / IndexedDB',
    purpose:
      'Records a short replay of what is on screen when an error happens, so we can reproduce and fix it. Text and form inputs are masked, and images, audio and video are blocked — a replay never contains your script, your prompts or your keys.',
    retention: 'About 30 days, then deleted automatically by Sentry.',
  },
]

function StorageTable({ rows }: { rows: Row[] }) {
  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Name</th>
            <th className="text-left font-semibold px-4 py-3">What it is for</th>
            <th className="text-left font-semibold px-4 py-3 whitespace-nowrap">Kept for</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-t border-gray-100 align-top">
              <td className="px-4 py-3">
                <code className="text-xs text-navy-600 break-all">{r.name}</code>
                <p className="text-xs text-gray-500 mt-1">{r.type}</p>
              </td>
              <td className="px-4 py-3 text-gray-500 leading-relaxed">{r.purpose}</td>
              <td className="px-4 py-3 text-gray-500">{r.retention}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function CookiePolicyPage() {
  const [current, setCurrent] = useState<ConsentState>('unset')
  useEffect(() => {
    setCurrent(replayConsent())
  }, [])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Cookies and stored data"
        description="What Vidora stores in your browser, why, for how long, and how to change your mind."
        path="/cookies"
      />

      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 64, paddingBottom: 40 }}>
          <p
            className="font-semibold uppercase text-sky-700"
            style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}
          >
            Legal
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.025em', marginBottom: 12 }}
          >
            Cookies and stored data
          </h1>
          <p className="text-gray-500" style={{ fontSize: 13.5 }}>Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      <section className="flex-1">
        <div
          className="site-container"
          style={{ maxWidth: 760, paddingTop: 48, paddingBottom: 72, display: 'grid', gap: 36 }}
        >

          <div>
            <p className="text-gray-500 leading-relaxed mb-3">
              Vidora does not use advertising cookies, third-party analytics, or tracking pixels.
              We store a small amount of data in your browser using <code className="text-xs text-navy-600">localStorage</code>,
              which is what keeps you signed in and remembers what you were working on.
            </p>
            <p className="text-gray-500 leading-relaxed">
              Under EU law (ePrivacy Article 5(3)) we need your consent for anything that is not
              strictly necessary. Everything below in the first table is strictly necessary, so it
              runs either way. Only the second table needs your consent.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35, marginBottom: 14 }}>Essential — always on</h2>
            <p className="text-gray-500 text-sm mb-4">
              These exist only to provide the service you asked for. Turning them off would break
              sign-in or lose your drafts, so they do not require consent.
            </p>
            <StorageTable rows={ESSENTIAL} />
          </div>

          <div>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35, marginBottom: 14 }}>Optional — only with your consent</h2>
            <p className="text-gray-500 text-sm mb-4">
              This is the only non-essential purpose on the site. It stays off until you say yes,
              and everything above works identically if you say no.
            </p>
            <StorageTable rows={OPTIONAL} />
          </div>

          <div>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35, marginBottom: 14 }}>Your current choice</h2>
            <p className="text-gray-500 leading-relaxed mb-4">
              {current === 'granted'
                ? 'You have accepted the optional error replays. You can withdraw this at any time.'
                : current === 'denied'
                  ? 'You have chosen essential only. Error replays are off. You can change this at any time.'
                  : 'You have not made a choice yet. Error replays are off until you do.'}
            </p>
            <button
              type="button"
              onClick={() => { clearConsent(); setCurrent('unset') }}
              className="h-9 px-4 text-sm font-medium rounded-md border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors"
            >
              Change my choice
            </button>
            <p className="text-xs text-gray-500 mt-3">
              This clears the stored preference and shows the banner again. Withdrawing consent is
              deliberately as easy as giving it.
            </p>
          </div>

          <div>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35, marginBottom: 14 }}>Controlling storage yourself</h2>
            <p className="text-gray-500 leading-relaxed">
              You can also clear this data at any time from your browser settings — clearing site
              data for vidora.ai removes everything in the tables above, and you will simply be
              signed out. For how we handle personal data more generally, see our{' '}
              <a href="/privacy" className="underline hover:text-navy-600">Privacy Policy</a>.
            </p>
          </div>

          <p className="text-xs text-gray-500 border-t border-gray-100 pt-6">
            The controller for the data described on this page is Rihla AB, org.nr 559589-5656,
            Sollentuna, Sweden. This page describes the software as built and is pending legal
            review alongside our other legal pages.
          </p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
