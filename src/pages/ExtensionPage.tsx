import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ArrowRight, Check, ShieldCheck, Puzzle, ExternalLink, Terminal, X } from 'lucide-react'
import {
  EXTENSION_FEATURES,
  EXTENSION_TIER_LABELS,
  EXTENSION_PERMISSIONS,
  EXTENSION_LIMITS,
  EXTENSION_HOSTS,
  EXTENSION_IS_PUBLISHED,
  EXTENSION_STORE_URL,
  type ExtensionTier,
} from '@content/extension'

/**
 * The extension's landing page.
 *
 * The one thing it has to get right is not overclaiming. This is a marketing page for a product that
 * is genuinely free and genuinely unfinished in one specific way - there is no published store
 * listing yet - so the install section says so and offers the route that works, rather than a button
 * that leads nowhere. Everything below renders from `@content/extension`, so it cannot drift from
 * the privacy page or the README.
 */

const TIER_ORDER: ExtensionTier[] = ['free', 'byok', 'account']

function FeatureGrid({ tier }: { tier: ExtensionTier }) {
  const features = EXTENSION_FEATURES.filter((f) => f.tier === tier)
  if (features.length === 0) return null
  return (
    <div>
      <h3
        className="font-semibold uppercase text-sky-700"
        style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 16 }}
      >
        {EXTENSION_TIER_LABELS[tier]}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 14 }}>
        {features.map((feature) => (
          <div
            key={feature.title}
            className="rounded-[14px] border border-gray-200 bg-white"
            style={{ padding: 20 }}
          >
            <div className="flex items-start" style={{ gap: 9 }}>
              <Check size={16} className="text-green-500 flex-shrink-0" style={{ marginTop: 3 }} />
              <h4 className="font-semibold text-navy-600" style={{ fontSize: 15.5, lineHeight: 1.4 }}>
                {feature.title}
              </h4>
            </div>
            <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 8 }}>
              {feature.body}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExtensionPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Free YouTube Studio SEO Extension"
        description="Score any video's SEO, see views per day on thumbnails, and get character counters inside YouTube Studio - free, no account required. Works in Chrome and Edge."
        path="/extension"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Vidora SEO for YouTube Studio',
          applicationCategory: 'BrowserApplication',
          operatingSystem: 'Chrome, Edge',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description:
            "A browser extension that scores any YouTube video's SEO and adds views-per-day badges to search and browse, without leaving the page.",
        }}
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
          <div
            className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]"
            style={{ gap: 48 }}
          >
            <div>
              <p
                className="font-semibold uppercase text-sky-700"
                style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}
              >
                Browser extension
              </p>
              <h1
                className="font-bold text-navy-600"
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.9rem)',
                  lineHeight: 1.1,
                  letterSpacing: '-0.028em',
                  maxWidth: 640,
                }}
              >
                SEO scoring inside YouTube Studio, not two tabs away from it
              </h1>
              <p
                className="text-gray-500"
                style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18, maxWidth: 560 }}
              >
                Score any video without leaving the page it is on, see views per day on thumbnails in
                search, and get live character counters in the fields Studio leaves you guessing about.
                Free, and no account to start.
              </p>
              <div className="flex flex-col sm:flex-row" style={{ gap: 12, marginTop: 28 }}>
                <Link to="/tools/seo-analyzer" className="btn-primary btn-lg">
                  Try it without installing <ArrowRight size={17} />
                </Link>
                <Link to="/signup" className="btn-secondary btn-lg">
                  Start free
                </Link>
              </div>
              <p className="text-gray-500" style={{ fontSize: 13, marginTop: 14, maxWidth: 520 }}>
                The analyzer above runs in your browser with no install at all — the extension just
                puts the same report next to the video you are already looking at.
              </p>
            </div>

            {/* Install card. Which of the two routes it offers is decided by one constant in
                @content/extension, not by a hardcoded URL. */}
            <div
              className="rounded-[16px] border border-gray-200 bg-[#FAFBFC] self-start"
              style={{ padding: 26 }}
            >
              <div className="flex items-center" style={{ gap: 9, marginBottom: 14 }}>
                <Puzzle size={18} className="text-navy-600" />
                <p className="font-semibold text-navy-600" style={{ fontSize: 15 }}>
                  Install it
                </p>
              </div>

              {EXTENSION_IS_PUBLISHED ? (
                <a
                  href={EXTENSION_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full"
                >
                  Add to Chrome <ExternalLink size={15} />
                </a>
              ) : (
                <>
                  <p className="text-gray-600" style={{ fontSize: 14, lineHeight: 1.65 }}>
                    <strong className="text-navy-600">Not in the Chrome Web Store yet.</strong> It is
                    built and working, but the listing needs a developer registration and a review, so
                    there is no one-click install today.
                  </p>
                  <p
                    className="text-gray-500"
                    style={{ fontSize: 13.5, lineHeight: 1.65, marginTop: 12 }}
                  >
                    You can still load it in about a minute:
                  </p>
                  <ol
                    className="text-gray-500"
                    style={{ fontSize: 13.5, lineHeight: 1.75, marginTop: 10, paddingLeft: 18 }}
                  >
                    <li>
                      Open <code className="text-navy-600">chrome://extensions</code>
                    </li>
                    <li>
                      Turn on <strong>Developer mode</strong>
                    </li>
                    <li>
                      Choose <strong>Load unpacked</strong> and select the{' '}
                      <code className="text-navy-600">extension/</code> folder
                    </li>
                  </ol>
                  <p
                    className="text-gray-500 flex items-start"
                    style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 14, gap: 6 }}
                  >
                    <Terminal size={13} className="flex-shrink-0" style={{ marginTop: 2 }} />
                    <span>
                      That route points the extension at a local API by default, so it needs a small
                      config change to reach a hosted one. It is the honest state of things, and the
                      reason the free analyzer exists.
                    </span>
                  </p>
                </>
              )}

              <div className="border-t border-gray-200" style={{ marginTop: 20, paddingTop: 16 }}>
                <div className="flex items-center" style={{ gap: 7 }}>
                  <ShieldCheck size={14} className="text-green-500" />
                  <p className="font-medium text-navy-600" style={{ fontSize: 13 }}>
                    Three permissions, two sites
                  </p>
                </div>
                <p className="text-gray-500" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 7 }}>
                  Content scripts run on {EXTENSION_HOSTS.join(' and ')}. API network hosts are declared separately.{' '}
                  <Link to="/extension/privacy" className="text-navy-600 underline">
                    What it can see
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it does, grouped by what it costs. The grouping is the point: a visitor should be able
          to see at a glance that the useful half needs nothing from them. */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.05rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            What it does, and what each part costs you
          </h2>
          <p className="text-gray-500" style={{ fontSize: 16.5, lineHeight: 1.7, marginTop: 12, maxWidth: 620 }}>
            The split is deliberate. An extension that only works once you have signed up is an advert,
            so the half that needs nothing is the half you get first.
          </p>

          <div style={{ display: 'grid', gap: 40, marginTop: 40 }}>
            {TIER_ORDER.map((tier) => (
              <FeatureGrid key={tier} tier={tier} />
            ))}
          </div>
        </div>
      </section>

      {/* The honest section. Every claim here is a decision that was made on purpose, and several are
          things a competitor's extension does do - which is exactly why they are worth stating. */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ paddingTop: 64, paddingBottom: 64 }}>
          <div className="grid grid-cols-1 lg:grid-cols-2" style={{ gap: 40 }}>
            <div>
              <h2
                className="font-bold text-navy-600"
                style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.022em' }}
              >
                What it deliberately does not do
              </h2>
              <p className="text-gray-500" style={{ fontSize: 16, lineHeight: 1.7, marginTop: 12 }}>
                Most extension pages list what a product can do. This list is the other half, and it is
                the half that decides whether you can trust the first one.
              </p>
              <div style={{ display: 'grid', gap: 16, marginTop: 24 }}>
                {EXTENSION_LIMITS.map((limit) => (
                  <div key={limit} className="flex items-start" style={{ gap: 10 }}>
                    <X size={15} className="text-gray-400 flex-shrink-0" style={{ marginTop: 4 }} />
                    <p className="text-gray-600" style={{ fontSize: 14.5, lineHeight: 1.7 }}>
                      {limit}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2
                className="font-bold text-navy-600"
                style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.022em' }}
              >
                The permissions, in plain words
              </h2>
              <p className="text-gray-500" style={{ fontSize: 16, lineHeight: 1.7, marginTop: 12 }}>
                Three, and a Chrome install prompt is a fair thing to be suspicious of. Here is what
                each one is for.
              </p>
              <div
                className="rounded-[14px] border border-gray-200 bg-white"
                style={{ marginTop: 24, overflow: 'hidden' }}
              >
                {EXTENSION_PERMISSIONS.map((permission, i) => (
                  <div
                    key={permission.name}
                    className={i > 0 ? 'border-t border-gray-100' : undefined}
                    style={{ padding: '18px 20px' }}
                  >
                    <p className="font-semibold text-navy-600" style={{ fontSize: 14.5 }}>
                      {permission.name}
                    </p>
                    <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.65, marginTop: 5 }}>
                      {permission.why}
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 16 }}>
                <Link
                  to="/extension/privacy"
                  className="inline-flex items-center text-navy-600 font-medium"
                  style={{ fontSize: 14, gap: 6 }}
                >
                  Read the full data disclosure <ArrowRight size={14} />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ. Short, and every answer is something a person deciding whether to install would
          actually ask - including the one about whether it can read their analytics. */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 64, paddingBottom: 64, maxWidth: 820 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.022em' }}
          >
            Questions worth asking before you install
          </h2>
          <div style={{ display: 'grid', gap: 22, marginTop: 28 }}>
            {[
              {
                q: 'Is it really free, or is this a trial?',
                a: 'The scoring, the character counters, the tag copying and the views-per-day badges are free with no account and no expiry. Title and tag suggestions run on your own Anthropic key, so those cost us nothing to give away either. What needs an account is the half that works on your own channel data - click-through history and thumbnail testing.',
              },
              {
                q: 'Can it read my YouTube analytics?',
                a: 'Only if you switch that on, and it is off when you install it. When it is on, it reads the impressions and click-through numbers from the analytics page you are already looking at, and sends those two numbers with a token you can revoke from Settings. It does not read your revenue, your audience, or your comments.',
              },
              {
                q: 'Does it post or edit anything on my channel?',
                a: 'The shipped suggestion workflow does not automatically edit or publish your video fields. Suggestions use copy buttons and you choose what to paste. This is an implementation choice, not a browser-enforced read-only boundary on the signed-in page.',
              },
              {
                q: 'Which browsers does it work in?',
                a: 'Chrome, and anything Chromium-based - Edge, Brave, Arc, Opera. It is a Manifest V3 extension with no remote code, so what is reviewed is what runs.',
              },
              {
                q: 'Do I need the dashboard to use it?',
                a: 'No. The free half works on its own the moment you install it. The dashboard is where the channel-wide work happens - auditing every video at once, bulk edits, retention analysis - and the extension links to it rather than replacing it.',
              },
            ].map((item) => (
              <div key={item.q} className="border-t border-gray-100" style={{ paddingTop: 20 }}>
                <h3 className="font-semibold text-navy-600" style={{ fontSize: 16, lineHeight: 1.4 }}>
                  {item.q}
                </h3>
                <p className="text-gray-600" style={{ fontSize: 15, lineHeight: 1.75, marginTop: 8 }}>
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 68, paddingBottom: 68 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.05rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            The extension is the free half. The dashboard is the rest.
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            Audit a whole channel, fix metadata in bulk, and see what your retention is really doing.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ marginTop: 24, gap: 12 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/tools/seo-analyzer" className="btn-outline-inverse btn-lg">
              Analyze a video first
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
