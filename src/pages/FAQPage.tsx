import { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ChevronDown } from 'lucide-react'
import {
  FREE_REFILL,
  OWN_KEYS_RENDER_CAP,
  PLAN_PRICE_ANNUAL_USD,
  PLAN_PRICE_USD,
  UNIT_CREDITS,
  channelCount,
} from '@lib/creditCosts'

const categories = [
  {
    category: 'Getting started',
    faqs: [
      { q: 'How do I create my first video?', a: "Sign up free, connect your YouTube channel, click 'New Job', enter a topic, and submit. The pipeline runs automatically - you'll get notified when it's ready." },
      { q: 'Do I need any technical knowledge?', a: 'None at all. The workflow is entirely point-and-click. If you can use a web browser, you can use this platform.' },
      { q: 'How long does a video take to generate?', a: 'Most videos are ready in 3–8 minutes. A 60-second Short takes ~2–3 minutes; a 10-minute video takes 6–10 minutes.' },
    ],
  },
  {
    category: 'Content & quality',
    faqs: [
      { q: 'Will my audience know it was AI-generated?', a: "Two separate questions. On quality, our target is a production that stands up next to a manually made video. On disclosure, the content must be labelled: YouTube requires realistic synthetic content to be flagged, and if your audience is in the EU the AI Act requires a clear disclosure. We set YouTube's 'altered or synthetic content' flag on upload by default, so that part is done for you - but keep it accurate, and add an on-screen or description note where the content is realistic." },
      { q: 'Can I customise the script before it renders?', a: "Yes. Every job has a review step where you can modify the script, change the title, or swap out visuals before rendering starts." },
      { q: 'What languages are supported?', a: '80+ languages for voiceover and script, including English, Spanish, Portuguese, French, German, Arabic, Hindi, Urdu, Bengali, Indonesian, Japanese, Korean, Mandarin, and Cantonese. Scripts are generated natively in your chosen language.' },
    ],
  },
  {
    category: 'Platforms & distribution',
    faqs: [
      { q: 'Which platforms can I publish to?', a: "YouTube (long-form and Shorts), Instagram Reels, TikTok, Facebook Reels, Telegram channels, and Reddit (as a link post to the subreddits you choose). X (Twitter) and Pinterest are next on the roadmap." },
      { q: 'Can I schedule when my video publishes?', a: 'Yes. Every job has a "Publish at" option - pick any future date and time and the video will upload and go public automatically.' },
      { q: 'Can I manage multiple YouTube channels?', a: `Yes. Free, Own Keys and Starter: ${channelCount('starter')}, Pro: ${channelCount('pro')}, Studio: ${channelCount('studio')}, Agency: ${channelCount('agency').toLowerCase()} - each with independent settings, voices, and branding.` },
    ],
  },
  {
    category: 'Billing & plans',
    faqs: [
      { q: 'Can I cancel at any time?', a: 'Yes. Cancel from billing settings in one click. You keep access until the end of your billing period. No cancellation fees.' },
      { q: 'What happens when I run out of credits?', a: `You can still browse and manage your content, but new renders are paused until you upgrade or buy a credit top-up. Unused paid credits roll over for one month. Free accounts get ${FREE_REFILL.monthly} more credits every month, up to ${FREE_REFILL.cap}.` },
      { q: 'Can I use my own API keys?', a: `Yes, on every paid plan. Connect your Claude, OpenAI, Gemini, Kling, MiniMax or ElevenLabs key in Settings. You pay that provider directly, and we only charge credits for the parts of a render that still run on our keys. Starter adds a ${UNIT_CREDITS.byokPlatformFee}-credit platform fee per run; Own Keys, Pro, Studio and Agency pay none.` },
      { q: 'What is the Own Keys plan?', a: `A $${PLAN_PRICE_USD.own_keys}/month plan for creators who already pay for AI. Your own Claude, OpenAI or Gemini key writes the scripts and we do the rest: rendering, uploading, scheduling and posting, up to ${OWN_KEYS_RENDER_CAP} renders a month on one channel. It includes no credits, but you can buy a top-up to use our keys for a single job.` },
      { q: 'Is animation on the free plan?', a: 'No. Animated episodes need a paid plan: Own Keys (on your own Kling or MiniMax key) or any credit plan from Starter up.' },
      { q: 'Can I choose 720p or 1080p, or the AI model that writes my scripts?', a: 'Yes, on every paid plan. Pick 720p or 1080p per animated episode (1080p costs more credits, shown before you render), and choose Claude, OpenAI or Gemini for scripts in Settings.' },
      { q: 'Is there yearly billing?', a: `Yes. Every paid plan can be billed yearly for the price of ten months, e.g. Pro is $${PLAN_PRICE_ANNUAL_USD.pro}/year instead of $${PLAN_PRICE_USD.pro * 12}. Credits are still granted monthly.` },
      { q: 'Do you offer refunds?', a: '14-day money-back guarantee on the first charge of any paid plan. Contact support within 14 days.' },
    ],
  },
  {
    category: 'Security & privacy',
    faqs: [
      { q: 'Is my YouTube data safe?', a: "We use OAuth 2.0 with minimal scopes - only permissions needed to upload on your behalf. We never store your YouTube password." },
      { q: 'Do you train AI on my videos?', a: 'No. Your content is never used to train our models. We use third-party foundation models under data processing agreements that prohibit training on customer data.' },
    ],
  },
]

// Anchor id for a category heading. Local and total, so the jump index above and
// the section ids below cannot disagree about a category name.
const _slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="flex w-full items-start justify-between text-left"
        style={{ gap: 16, padding: '18px 0' }}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        {/* Was 14px -- smaller than the answer it introduces. */}
        <span className="font-semibold text-navy-600" style={{ fontSize: 15.5, lineHeight: 1.5 }}>{q}</span>
        <ChevronDown
          size={17}
          className={`flex-shrink-0 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ marginTop: 2 }}
        />
      </button>
      {open && (
        <p
          className="text-gray-500"
          style={{ fontSize: 14.5, lineHeight: 1.7, paddingBottom: 18, paddingRight: 34 }}
        >
          {a}
        </p>
      )}
    </div>
  )
}

export default function FAQPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: categories.flatMap((cat) =>
      cat.faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      }))
    ),
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="FAQ"
        description="Answers to common questions about getting started, content quality, platforms and distribution, billing, and security and privacy on Vidora."
        path="/faq"
        jsonLd={faqJsonLd}
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 56 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            FAQ
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em' }}
          >
            Common questions.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 17, lineHeight: 1.7, marginTop: 18, maxWidth: 620 }}>
            Everything you need to know before getting started. If your question is not here, we
            answer every message within 24 hours.
          </p>
        </div>
      </section>

      {/* FAQ by category */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 56, paddingBottom: 72 }}>
          <div className="grid grid-cols-1 lg:grid-cols-[190px_minmax(0,1fr)]" style={{ gap: '40px 56px' }}>
            {/* Jump index. The categories sit far enough apart that scrolling to
                find one is the main friction on a page this long. `scroll-mt-`
                on each section clears the 64px sticky header when an anchor is
                followed, which would otherwise hide the heading it jumped to. */}
            <nav
              className="hidden lg:block"
              style={{ position: 'sticky', top: 96, alignSelf: 'start' }}
              aria-label="FAQ sections"
            >
              <p
                className="font-semibold uppercase text-gray-500"
                style={{ fontSize: 11, letterSpacing: '0.09em', marginBottom: 12 }}
              >
                On this page
              </p>
              <ul style={{ display: 'grid', gap: 10 }}>
                {categories.map((cat) => (
                  <li key={cat.category}>
                    <a
                      href={`#${_slug(cat.category)}`}
                      className="text-gray-600 hover:text-navy-600 transition-colors"
                      style={{ fontSize: 13.5 }}
                    >
                      {cat.category}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div style={{ display: 'grid', gap: 40 }}>
              {categories.map((cat) => (
                <div key={cat.category} id={_slug(cat.category)} className="scroll-mt-[88px]">
                  {/* Was `text-sm font-bold uppercase text-gray-400` -- the same
                      size as the answers it was labelling. */}
                  <h2 className="font-semibold text-navy-600" style={{ fontSize: 19, marginBottom: 14 }}>
                    {cat.category}
                  </h2>
                  <div className="rounded-[14px] border border-gray-200 bg-white" style={{ paddingInline: 22 }}>
                    {cat.faqs.map((item) => (
                      <FAQItem key={item.q} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Still have questions */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 68, paddingBottom: 68 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.6rem, 2.8vw, 2.05rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            Still have questions?
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            We answer every message within 24 hours.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ gap: 12, marginTop: 24 }}>
            <Link to="/contact" className="btn-primary btn-lg btn-inverse">
              Contact us
            </Link>
            <Link to="/signup" className="btn-secondary btn-lg btn-outline-inverse">
              Start free
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
