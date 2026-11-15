import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { SUPPORT_EMAIL } from '@lib/site'
import { EXTENSION_DATA_FLOWS, EXTENSION_PERMISSIONS, EXTENSION_HOSTS } from '@content/extension'

const LAST_UPDATED = '15 November 2026'

// ─────────────────────────────────────────────────────────────────────────────
// NOTE FOR MAINTAINERS
//
// This page exists because a Chrome Web Store submission requires a live privacy
// policy URL, and this is the one the listing should point at. It is deliberately
// narrower than `/privacy`, which covers the dashboard: a store reviewer -- and a
// creator deciding whether to install -- needs the extension's own data story.
//
// It must stay in step with the code, and the code is the authority:
//   - `extension/manifest.json`   -> permissions and host permissions
//   - `extension/browse.js`       -> what the badges send, and when
//   - `extension/content.js`      -> the CTR capture and the suggest call
//   - `api/routers/extension.py`  -> what the API stores and for how long
//   - `EXTENSION_DATA_FLOWS`      -> the table rendered below
//
// `scripts/test_extension_contract.py` pins the manifest half of that. If you
// change a flag default or add a permission, update this page in the same commit.
// ─────────────────────────────────────────────────────────────────────────────

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: '1. In short',
    body: [
      'The Vidora extension is free to use without an account. Most of what it does happens entirely inside your browser and sends us nothing at all. Two optional features send data, both are switched off when you install it, and the table above lists exactly what they send.',
      'We do not sell data, we do not run advertising, and we do not use anything you do in the extension to train models.',
    ],
  },
  {
    heading: '2. Local features and requested lookups',
    body: [
      'Scoring a video: the extension reads the public metadata of the video you are looking at and posts the video ID to our API, which returns a score. Public metadata means what any logged-out viewer can see — the title, description, tags, duration and view count. No account, no token, and nothing about you is attached to the request.',
      'Character counters: a count of how many characters are in the field you are typing into. This is computed in the page and never leaves your browser.',
      'Copying tags: it reads the tags already visible on the page you are looking at and puts them on your clipboard. Nothing is sent to us.',
      'The views-per-day badges read the video IDs on the page — but sending them is a separate switch, described above.',
    ],
  },
  {
    heading: '3. What we never receive',
    body: [
      'Your YouTube or Google password. The shipped code does not ask for or collect it. This is a statement about our implementation, not a claim that password fields are unreadable to every extension. Account features use a scoped token you can revoke.',
      'Your browsing history. The extension runs on two YouTube hosts and nowhere else, and it has no permission to see any other site you visit.',
      'Your revenue, your subscriber list, your comments, or your audience data. The analytics feature reads two numbers — impressions and click-through — from the Studio page you are already viewing, and sends those two numbers.',
      'Anything from your clipboard. Copying tags writes to your clipboard; the extension never reads from it.',
    ],
  },
  {
    heading: '4. Accounts and tokens',
    body: [
      'The free features need no account, so they create no account record and store nothing about you on our side beyond a rate-limit counter against your IP address.',
      "If you connect the extension to a Vidora account, we issue a scoped token stored in your browser's extension storage. You can revoke it from Settings → Integrations so our API rejects further requests using that token. Turn capture off or remove the extension to stop local capture. The token grants access to the extension endpoints, not general account or channel control.",
      'Account linking happens from your dashboard, where you are already signed in. The extension receives the token; it never receives your login.',
    ],
  },
  {
    heading: '5. Where data goes, and how long we keep it',
    body: [
      'Everything the extension sends goes to our API and nowhere else. We do not forward it to advertising networks, data brokers, or analytics providers.',
      "Click-through readings are stored against the video they describe, so a thumbnail change can be compared with the video's own past. They are deleted when you delete that history, when you revoke the token, or when you delete your account.",
      'Public video metadata — the score lookup and the views-per-day lookup — is cached briefly to avoid repeat calls to the YouTube API. The cache is keyed by video ID, not by user, because the data is public and identical for everyone.',
      'Rate-limit counters are keyed by IP address and expire within minutes.',
      'Our API is hosted on Microsoft Azure. See the main Privacy Policy for the full processor list and the international-transfer details.',
    ],
  },
  {
    heading: '6. Your controls',
    body: [
      "Two switches control every optional data flow, and both are off when you install the extension. You can turn them on and off at any time from the extension's Options page, and turning one off stops the sending immediately rather than at some later point.",
      'You can remove the extension at any time from chrome://extensions, which deletes everything it stored locally, including any token.',
      'For access, correction, export or deletion of anything held against your account, email us. See the main Privacy Policy for how we handle GDPR and CCPA requests.',
    ],
  },
  {
    heading: '7. Permissions the extension requests',
    body: [
      'Chrome shows requested access during installation and in extension settings. Content scripts match the two YouTube sites listed above; separate host permissions allow network requests to the configured API and local-development endpoints.',
      'Review the manifest for the exact network hosts. Those deployment addresses still need the planned domain cutover before a public release.',
    ],
  },
  {
    heading: '8. Children, and advertising',
    body: [
      'The extension is not directed at children under 13, and we do not knowingly collect data from them. It contains no advertising and no third-party tracking of any kind.',
    ],
  },
  {
    heading: '9. Changes to this policy',
    body: [
      "If a future version of the extension sends something this page does not describe, we will update this page and note it in that version's release notes before it is published. The date at the top always reflects the current version.",
    ],
  },
  {
    heading: '10. Contact',
    body: [
      `Questions about this policy, or about anything the extension does with your data, go to ${SUPPORT_EMAIL}. We answer these directly rather than through a ticket queue.`,
    ],
  },
]

export default function ExtensionPrivacyPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Extension Privacy Policy"
        description="Exactly what the Vidora browser extension can see, what it sends, and what it never touches. Two optional data flows, both off by default."
        path="/extension/privacy"
      />

      <main className="site-container flex-1" style={{ paddingTop: 64, paddingBottom: 72, maxWidth: 780 }}>
        <p
          className="font-semibold uppercase text-sky-700"
          style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}
        >
          Privacy
        </p>
        <h1
          className="font-bold text-navy-600"
          style={{ fontSize: 'clamp(1.9rem, 3.6vw, 2.6rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
        >
          Vidora extension privacy policy
        </h1>
        <p className="text-gray-500" style={{ fontSize: 14, marginTop: 14, lineHeight: 1.7 }}>
          Last updated {LAST_UPDATED} · Applies to the Vidora browser extension for Chrome and
          Chromium-based browsers. The dashboard has its own{' '}
          <Link to="/privacy" className="text-navy-600 underline">
            Privacy Policy
          </Link>
          .
        </p>

        {/* The disclosure table, rendered from the same module the landing page uses so the two
            cannot end up describing different behaviour. */}
        <div className="rounded-[14px] border border-gray-200 overflow-hidden" style={{ marginTop: 32 }}>
          <div className="bg-[#FAFBFC] border-b border-gray-200" style={{ padding: '16px 20px' }}>
            <p className="font-semibold text-navy-600" style={{ fontSize: 15 }}>
              Everything that can leave your browser
            </p>
            <p className="text-gray-500" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 4 }}>
              Three flows in total. Two of them are optional and off until you switch them on.
            </p>
          </div>
          {EXTENSION_DATA_FLOWS.map((flow, i) => (
            <div
              key={flow.what}
              className={i > 0 ? 'border-t border-gray-100' : undefined}
              style={{ padding: '18px 20px' }}
            >
              <p className="font-medium text-navy-600" style={{ fontSize: 14.5, lineHeight: 1.5 }}>
                {flow.what}
              </p>
              <p className="text-gray-600" style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 6 }}>
                <strong className="text-navy-600">When:</strong> {flow.when}
              </p>
              <p className="text-gray-600" style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 4 }}>
                <strong className="text-navy-600">Where it goes:</strong> {flow.to}
              </p>
            </div>
          ))}
        </div>

        <p className="text-gray-500" style={{ fontSize: 13.5, lineHeight: 1.7, marginTop: 16 }}>
          The extension runs on{' '}
          <strong className="text-navy-600">{EXTENSION_HOSTS.join(' and ')}</strong>, requests{' '}
          {EXTENSION_PERMISSIONS.length} Chrome permissions, and separately declares API and local-development network hosts.
        </p>

        <div style={{ display: 'grid', gap: 28, marginTop: 40 }}>
          {SECTIONS.map((section) => (
            <section key={section.heading}>
              <h2 className="font-bold text-navy-600" style={{ fontSize: 19, lineHeight: 1.35 }}>
                {section.heading}
              </h2>
              <div style={{ display: 'grid', gap: 12, marginTop: 10 }}>
                {section.body.map((para, i) => (
                  <p key={i} className="text-gray-600" style={{ fontSize: 15.5, lineHeight: 1.75 }}>
                    {para}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div
          className="rounded-[14px] border border-gray-200 bg-[#FAFBFC]"
          style={{ marginTop: 40, padding: 24 }}
        >
          <p className="font-semibold text-navy-600" style={{ fontSize: 15, marginBottom: 6 }}>
            Rather see it than read it?
          </p>
          <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.65 }}>
            The extension is plain JavaScript with no build step and no remote code — what you install
            is what you can read.
          </p>
          <p style={{ marginTop: 14 }}>
            <Link to="/extension" className="inline-flex items-center text-navy-600 font-medium" style={{ fontSize: 14 }}>
              Back to the extension overview
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}

