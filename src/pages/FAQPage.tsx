import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import { ChevronDown } from 'lucide-react'

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
      { q: 'Will my audience know it was AI-generated?', a: "Our quality targets are set so content is indistinguishable from manually produced videos. We always recommend following YouTube's disclosure guidelines." },
      { q: 'Can I customise the script before it renders?', a: "Yes. Every job has a review step where you can modify the script, change the title, or swap out visuals before rendering starts." },
      { q: 'What languages are supported?', a: '30+ languages for voiceover, including English, Spanish, French, German, Arabic, Hindi, and Mandarin. Scripts are generated natively in your chosen language.' },
    ],
  },
  {
    category: 'Platforms & distribution',
    faqs: [
      { q: 'Which platforms can I publish to?', a: "YouTube (long-form and Shorts), Instagram Reels, TikTok, and Facebook Reels. X and LinkedIn are coming in Q3 2026." },
      { q: 'Can I schedule when my video publishes?', a: 'Yes. Every job has a "Publish at" option - pick any future date and time and the video will upload and go public automatically.' },
      { q: 'Can I manage multiple YouTube channels?', a: 'Yes. Free: 1 channel, Pro: 5 channels, Enterprise: unlimited - each with independent settings, voices, and branding.' },
    ],
  },
  {
    category: 'Billing & plans',
    faqs: [
      { q: 'Can I cancel at any time?', a: 'Yes. Cancel from billing settings in one click. You keep access until the end of your billing period. No cancellation fees.' },
      { q: 'What happens if I exceed my video quota?', a: 'New submissions are paused when you hit your limit. You can upgrade mid-month - overage is prorated.' },
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

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full text-left py-4 flex items-start justify-between gap-4"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="font-medium text-navy-600 text-sm leading-relaxed">{q}</span>
        <ChevronDown
          size={16}
          className={`text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="pb-5 text-gray-500 text-sm leading-relaxed pr-8">{a}</div>
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
        description="Answers to common questions about getting started, content quality, platforms and distribution, billing, and security and privacy on Channelpilot."
        path="/faq"
        jsonLd={faqJsonLd}
      />

      {/* Hero */}
      <section className="pt-28 pb-20 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">FAQ</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">Common questions</h1>
          <p className="text-xl text-gray-500 max-w-xl">
            Everything you need to know before getting started.
          </p>
        </div>
      </section>

      {/* FAQ by category */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto space-y-14">
          {categories.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">{cat.category}</h2>
              <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 px-6">
                {cat.faqs.map((item) => (
                  <FAQItem key={item.q} q={item.q} a={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Still have questions */}
      <section className="py-16 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-bold text-navy-600 mb-1">Still have questions?</h2>
            <p className="text-gray-500 text-sm">We respond to every message within 24 hours.</p>
          </div>
          <Link to="/contact" className="btn-secondary whitespace-nowrap">Contact us</Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
