import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO, { SITE_NAME, SITE_URL } from '@components/SEO'
import PipelinePreview from '@components/marketing/PipelinePreview'
import { ArrowRight, CalendarClock, Check, Film, LineChart, Mic, Share2, Sparkles } from 'lucide-react'
import { PLAN_CREDITS, channelPhrase } from '@lib/creditCosts'
import { DESTINATIONS, DESTINATION_COUNT } from '@lib/destinations'
import { publisherSchema, websiteSchema } from '@lib/structuredData'

const steps = [
  { num: '01', title: 'Enter a topic', description: 'Type any topic or keyword. The AI researches, outlines, and writes a full script for your channel.' },
  { num: '02', title: 'Pipeline runs', description: 'Script, voiceover, background music, visuals, and thumbnail are generated automatically - no editing needed.' },
  { num: '03', title: 'Review & publish', description: 'Preview the finished video, make any tweaks, then publish to YouTube with one click.' },
]

const features = [
  { icon: Sparkles, title: 'AI Script Generation', description: 'Engaging scripts tuned to your niche, tone, and audience - generated in seconds.' },
  { icon: Mic, title: 'Automatic Media Pipeline', description: 'Voiceover, music, visuals, and thumbnail created without touching a timeline.' },
  { icon: Share2, title: 'Multi-Channel Publishing', description: 'Manage unlimited channels, publish to YouTube, and auto-post vertical cuts to Instagram, TikTok, Facebook, Telegram and Reddit.' },
  { icon: LineChart, title: 'AI Growth Coach', description: 'Not just charts - AI reviews your real retention, traffic sources, and publish timing and tells you exactly what to fix next.' },
  { icon: CalendarClock, title: 'Queue Management', description: 'Batch-schedule weeks of content in advance. The scheduler handles the rest.' },
  { icon: Film, title: 'Social Performance Tracking', description: 'Automatically cut vertical Shorts from every video, and track how your posts perform on Instagram, Facebook, TikTok, Telegram and Reddit in one place.' },
]

// 40 -> "40", 8000 -> "8,000". The same formatter PricingPage and Billing use.
const _fmt = (n: number | null) => (n == null ? 'Unlimited' : n.toLocaleString('en-US'))

// Both columns derive from @lib/creditCosts. They were typed literals ('40
// credits', '5 channels') and the E3 guard did not reach them, because it only
// scanned PricingPage.tsx and dashboard/Billing.tsx -- so "no credit figure is
// hardcoded in the marketing UI" was not yet true. HomePage is now in that list.
const plans = [
  { name: 'Free', price: '$0', period: '', vids: `${_fmt(PLAN_CREDITS.free)} credits`, channels: channelPhrase('free') },
  { name: 'Pro', price: '$49', period: '/mo', vids: `${_fmt(PLAN_CREDITS.pro)} credits / mo`, channels: channelPhrase('pro'), highlight: true },
  { name: 'Agency', price: 'Custom', period: '', vids: `${_fmt(PLAN_CREDITS.agency)} credits / mo`, channels: channelPhrase('agency') },
]

// This section previously showed three invented testimonials -- complete with
// names, subscriber counts and quotes ("Sarah K., YouTuber - 340K subscribers")
// -- under the heading "Trusted by creators". On a pre-launch product those were
// fabricated endorsements: a credibility risk and, more importantly, a legal one
// (fabricated testimonials are what the FTC's fake-review rule targets).
//
// Replaced with commitments that are true today and checkable by anyone:
// pricing is displayed before the render and matches the charge (W8 +
// core/pricing.episode_quote), BYOK is real (key_resolver), failed renders are
// not charged (the charge runs only after the pipeline completes), and credits
// roll over for a month (_reset_monthly_usage with roll_unused).
const commitments = [
  { title: 'The price is the price', body: 'The exact credit cost is shown before every render, and that is the number you are charged.' },
  { title: 'Your keys, your spend', body: 'Connect your own Anthropic, ElevenLabs or Kling key and pay the provider directly instead of our markup.' },
  { title: 'No dark patterns', body: 'One-click cancel. Unused credits roll over for a month. A failed render costs you nothing.' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Vidora - AI Video Production & YouTube Automation"
        description="Create scripts, voiceovers and videos from a topic. Review your content, schedule YouTube uploads and track connected-channel analytics with Vidora."
        path="/"
        noSuffix
        jsonLd={[{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          '@id': `${SITE_URL}/#application`,
          name: SITE_NAME,
          url: SITE_URL,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: {
            '@type': 'Offer',
            name: 'Free starter plan',
            price: '0',
            priceCurrency: 'USD',
            url: `${SITE_URL}/pricing`,
            description: `${PLAN_CREDITS.free} one-time starter credits; paid plans available.`,
          },
          description: 'AI-powered YouTube automation platform: script, voiceover, visuals, and multi-platform upload handled end-to-end, with retention and growth analytics.',
        }, { '@context': 'https://schema.org', ...publisherSchema() }, websiteSchema()]}
      />

      {/* ── Hero ───────────────────────────────────────────────────────────
          Two columns on desktop: the claim on the left, the product on the
          right. The previous hero was a single column of text, which is most of
          why the page read as unfinished — every reference in this space shows
          the product itself above the fold. Sizing is explicit because
          tailwind.config.js doubles spacing keys 0-16. */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 76 }}>
          <div className="grid items-center gap-[48px] lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
            <div>
              <p
                className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 font-medium text-gray-600"
                style={{ gap: 7, padding: '5px 12px', fontSize: 12 }}
              >
                <span className="rounded-full bg-emerald-500" style={{ width: 6, height: 6 }} />
                Idea in, published video out
              </p>

              <h1
                className="font-bold text-navy-600"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 3.75rem)', lineHeight: 1.05, letterSpacing: '-0.03em', marginTop: 20 }}
              >
                Publish more.
                <br />
                Work less.
              </h1>

              <p className="text-gray-500" style={{ fontSize: 19, lineHeight: 1.65, marginTop: 20, maxWidth: 500 }}>
                Give Vidora a topic. It writes the script, records the voiceover, sources the
                visuals, mixes the music and publishes — across every channel you run.
              </p>

              <div className="flex flex-col sm:flex-row" style={{ gap: 12, marginTop: 32 }}>
                <Link to="/signup" className="btn-primary btn-lg">
                  Start free <ArrowRight size={17} />
                </Link>
                <Link to="/how-it-works" className="btn-secondary btn-lg">
                  See how it works
                </Link>
              </div>

              <p className="text-gray-500" style={{ fontSize: 13, marginTop: 18 }}>
                {/* Derived, not typed: the E3 guard requires every credit figure in
                    the marketing UI to come from @lib/creditCosts. */}
                {_fmt(PLAN_CREDITS.free)} free credits · No credit card · Cancel anytime
              </p>
            </div>

            <PipelinePreview />
          </div>
        </div>
      </section>

      {/* ── Destinations ───────────────────────────────────────────────────
          This was five `text-gray-500` words on gray — the lightest thing on the
          page, so a real capability read as filler. The integration targets are
          a genuine selling point, so they are set in brand navy. The list itself
          now comes from @lib/destinations: Telegram and Reddit shipped months
          earlier but were missing here, so the page under-sold the pipeline by
          two destinations. */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div
          className="site-container flex flex-col md:flex-row md:items-center"
          style={{ paddingTop: 22, paddingBottom: 22, gap: 18 }}
        >
          <p className="font-semibold uppercase text-gray-500 whitespace-nowrap" style={{ fontSize: 11, letterSpacing: '0.1em' }}>
            Publishes to
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: '10px 26px' }}>
            {DESTINATIONS.map((platform) => (
              <span key={platform} className="font-semibold text-navy-600" style={{ fontSize: 15 }}>
                {platform}
              </span>
            ))}
          </div>
          <p className="md:ml-auto text-gray-500 whitespace-nowrap" style={{ fontSize: 12.5 }}>
            One pipeline · {DESTINATION_COUNT} destinations
          </p>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div style={{ marginBottom: 48 }}>
            <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              How it works
            </p>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              From idea to published in minutes.
            </h2>
            <p className="text-gray-500" style={{ fontSize: 17, marginTop: 12, maxWidth: 520 }}>
              Three steps. No timeline, no editor, no exporting.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 40 }}>
            {steps.map((step) => (
              <div key={step.num}>
                {/* Measured at 1.10:1 against white as `text-gray-100` (rgb(243
                    244 246) on #fff) -- effectively invisible at any size, so the
                    section rendered as three empty columns. Now a deliberate,
                    legible accent. Still decorative: the reading order and the
                    "Three steps" line above carry the meaning, so it is hidden
                    from assistive tech rather than announced as content. */}
                <p
                  aria-hidden="true"
                  className="text-7xl font-bold text-gray-500 leading-none mb-4 select-none"
                >
                  {step.num}
                </p>
                <h3 className="font-semibold text-navy-600" style={{ fontSize: 18, marginBottom: 8 }}>{step.title}</h3>
                <p className="text-gray-500" style={{ fontSize: 14.5, lineHeight: 1.65 }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div style={{ marginBottom: 44 }}>
            <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              What is included
            </p>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Everything you need to scale.
            </h2>
            <p className="text-gray-500" style={{ fontSize: 17, marginTop: 12, maxWidth: 520 }}>
              One platform for the whole workflow — from a blank page to a scheduled upload.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-[14px] overflow-hidden border border-gray-200">
            {features.map((f) => (
              <div key={f.title} className="bg-white" style={{ padding: 28 }}>
                <span
                  className="inline-flex items-center justify-center rounded-[10px] bg-navy-50 text-navy-600"
                  style={{ width: 38, height: 38, marginBottom: 16 }}
                >
                  <f.icon size={19} strokeWidth={1.9} />
                </span>
                <h3 className="font-semibold text-navy-600" style={{ fontSize: 16.5, marginBottom: 8 }}>
                  {f.title}
                </h3>
                <p className="text-gray-500" style={{ fontSize: 14.5, lineHeight: 1.65 }}>{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Numbers ────────────────────────────────────────────────────────
          Real, checkable figures, which is what this space normally fills with a
          logo wall or testimonials. This page used to show three invented
          testimonials; they were removed as fabricated endorsements, and these
          numbers come from the same registry the product itself reads. The free
          credit figure is derived so it cannot drift from the charge. */}
      <section className="border-b border-gray-100">
        <div
          className="site-container grid grid-cols-2 lg:grid-cols-4"
          style={{ paddingTop: 44, paddingBottom: 44, gap: 28 }}
        >
          {[
            { value: '80+', label: 'Languages for script and voice' },
            { value: '300+', label: 'Built-in voices, no add-on cost' },
            { value: String(DESTINATION_COUNT), label: 'Destinations from one pipeline' },
            { value: `${_fmt(PLAN_CREDITS.free)}`, label: 'Free credits to start, no card' },
          ].map((stat) => (
            <div key={stat.label}>
              <p
                className="font-bold text-navy-600"
                style={{ fontSize: 30, lineHeight: 1, letterSpacing: '-0.02em' }}
              >
                {stat.value}
              </p>
              <p className="text-gray-500" style={{ fontSize: 13.5, lineHeight: 1.5, marginTop: 8 }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing Teaser ───────────────────────────────────────────────── */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div style={{ marginBottom: 40 }}>
            <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              Pricing
            </p>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Simple, predictable pricing.
            </h2>
            <p className="text-gray-500" style={{ fontSize: 17, marginTop: 12 }}>
              Start free. No hidden fees, no per-video charges.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 18, marginBottom: 24 }}>
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-[14px] border-2 ${
                  plan.highlight ? 'border-navy-600' : 'border-gray-200'
                }`}
                style={{ padding: 26 }}
              >
                {plan.highlight && (
                  <p className="font-bold text-navy-600 uppercase" style={{ fontSize: 10.5, letterSpacing: '0.1em', marginBottom: 14 }}>
                    Most popular
                  </p>
                )}
                <p className="font-semibold text-gray-500" style={{ fontSize: 13.5, marginBottom: 6 }}>{plan.name}</p>
                <p className="font-bold text-navy-600" style={{ fontSize: 34, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                  {plan.price}
                  <span className="font-normal text-gray-500" style={{ fontSize: 15 }}>{plan.period}</span>
                </p>
                <div style={{ marginTop: 18, display: 'grid', gap: 8 }}>
                  {[plan.vids, plan.channels].map((feat) => (
                    <div key={feat} className="flex items-center text-gray-600" style={{ gap: 8, fontSize: 13.5 }}>
                      <Check size={14} className="text-green-500 flex-shrink-0" /> {feat}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/pricing"
            className="inline-flex items-center font-semibold text-navy-600 hover:underline"
            style={{ gap: 6, fontSize: 14 }}
          >
            See full feature comparison <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Commitments (was: fabricated testimonials) ────────────────────── */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ paddingTop: 88, paddingBottom: 88 }}>
          <div style={{ marginBottom: 36 }}>
            <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 12 }}>
              Our commitments
            </p>
            <h2 className="font-bold text-navy-600" style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              What we commit to.
            </h2>
            <p className="text-gray-500" style={{ fontSize: 16.5, lineHeight: 1.65, marginTop: 12, maxWidth: 620 }}>
              Vidora is new, so we are not going to show you testimonials we do not have yet.
              Here is what we hold ourselves to instead — all of it verifiable from inside the product.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 18 }}>
            {commitments.map((c) => (
              <div
                key={c.title}
                className="rounded-[14px] border border-gray-200 bg-white"
                style={{ padding: 24 }}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full"
                  style={{ width: 26, height: 26, backgroundColor: '#EAF6EF', marginBottom: 14 }}
                >
                  <Check size={14} strokeWidth={3} color="#267361" />
                </span>
                <p className="font-semibold text-navy-600" style={{ fontSize: 15.5, marginBottom: 8 }}>{c.title}</p>
                <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.65 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 80, paddingBottom: 80 }}>
          <h2 className="font-bold text-white" style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.5rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}>
            Ready to automate your channel?
          </h2>
          <p className="text-sky-200" style={{ fontSize: 17, lineHeight: 1.6, marginTop: 14, marginInline: 'auto', maxWidth: 520 }}>
            Publish more, edit less. One topic is enough to see the whole pipeline run.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ gap: 12, marginTop: 30 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/how-it-works" className="btn-secondary btn-lg btn-outline-inverse">
              See how it works
            </Link>
          </div>
          <p className="text-sky-200" style={{ fontSize: 13, marginTop: 18 }}>
            {_fmt(PLAN_CREDITS.free)} free credits · No credit card required
          </p>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
