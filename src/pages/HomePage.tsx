import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO, { SITE_NAME, SITE_URL } from '@components/SEO'
import { ArrowRight, Check } from 'lucide-react'

const steps = [
  { num: '01', title: 'Enter a topic', description: 'Type any topic or keyword. The AI researches, outlines, and writes a full script for your channel.' },
  { num: '02', title: 'Pipeline runs', description: 'Script, voiceover, background music, visuals, and thumbnail are generated automatically - no editing needed.' },
  { num: '03', title: 'Review & publish', description: 'Preview the finished video, make any tweaks, then publish to YouTube with one click.' },
]

const features = [
  { title: 'AI Script Generation', description: 'Engaging scripts tuned to your niche, tone, and audience - generated in seconds.' },
  { title: 'Automatic Media Pipeline', description: 'Voiceover, music, visuals, and thumbnail created without touching a timeline.' },
  { title: 'Multi-Channel Publishing', description: 'Manage unlimited channels and schedule posts across YouTube, Instagram, and TikTok.' },
  { title: 'AI Growth Coach', description: 'Not just charts - AI reviews your real retention, traffic sources, and publish timing and tells you exactly what to fix next.' },
  { title: 'Queue Management', description: 'Batch-schedule weeks of content in advance. The scheduler handles the rest.' },
  { title: 'Social Distribution', description: 'Automatically cut Shorts and Reels from every video and post to every platform.' },
]

const plans = [
  { name: 'Free', price: '$0', period: '', vids: '5 videos / month', channels: '1 channel' },
  { name: 'Pro', price: '$49', period: '/mo', vids: '50 videos / month', channels: '5 channels', highlight: true },
  { name: 'Enterprise', price: 'Custom', period: '', vids: 'Unlimited', channels: 'Unlimited' },
]

const testimonials = [
  { quote: 'We went from 2 videos a week to 12. The quality is indistinguishable from our manual process.', name: 'Sarah K.', role: 'YouTuber · 340K subscribers' },
  { quote: 'The automation saved our team 20+ hours every week. Best investment we made this year.', name: 'Marcus T.', role: 'Digital Marketing Agency' },
  { quote: "I know exactly what's publishing and when. The dashboard is the calmest part of my workflow.", name: 'Priya M.', role: 'EdTech Creator' },
]

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Channelpilot - AI YouTube Automation That Actually Grows Your Channel"
        description="Turn one topic into a fully produced, multi-platform video - script, voiceover, visuals, and upload - handled by AI. Real retention analytics, traffic-source breakdowns, and best-time-to-publish guidance included."
        path="/"
        noSuffix
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_NAME,
          url: SITE_URL,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description: 'AI-powered YouTube automation platform: script, voiceover, visuals, and multi-platform upload handled end-to-end, with retention and growth analytics.',
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="pt-28 pb-24 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">
            Channelpilot · AI-Powered YouTube Automation
          </p>
          <h1 className="text-5xl sm:text-6xl font-bold text-navy-600 leading-[1.1] mb-6">
            Publish more.<br />Work less.
          </h1>
          <p className="text-xl text-gray-500 leading-relaxed mb-10 max-w-xl">
            From script to upload - every step of the video pipeline handled by AI, so you focus on building your audience.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link to="/signup" className="btn-primary text-base px-8 py-3">
              Start free <ArrowRight size={18} />
            </Link>
            <Link to="/how-it-works" className="btn-secondary text-base px-8 py-3">
              How it works
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-5">No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Trust strip ──────────────────────────────────────────────────── */}
      <section className="py-10 px-6 border-b border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest whitespace-nowrap">
            Publishing to
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-gray-400 font-semibold text-sm">
            <span>YouTube</span>
            <span>YouTube Shorts</span>
            <span>Instagram Reels</span>
            <span>TikTok</span>
            <span>Facebook Reels</span>
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-navy-600 mb-3">From idea to published in minutes</h2>
            <p className="text-gray-500 text-lg">Three steps. Zero editing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {steps.map((step) => (
              <div key={step.num}>
                <p className="text-7xl font-bold text-gray-100 leading-none mb-4 select-none">{step.num}</p>
                <h3 className="text-lg font-semibold text-navy-600 mb-2">{step.title}</h3>
                <p className="text-gray-500 leading-relaxed text-sm">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-navy-600 mb-3">Everything you need to scale</h2>
            <p className="text-gray-500 text-lg">One platform for the entire production workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-200 rounded-xl overflow-hidden border border-gray-200">
            {features.map((f) => (
              <div key={f.title} className="bg-white p-8 hover:bg-gray-50 transition-colors">
                <h3 className="text-base font-semibold text-navy-600 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing Teaser ───────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-16">
            <h2 className="text-3xl font-bold text-navy-600 mb-3">Simple, predictable pricing</h2>
            <p className="text-gray-500 text-lg">Start free. No hidden fees, no per-video charges.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`p-8 rounded-xl border-2 ${
                  plan.highlight ? 'border-navy-600' : 'border-gray-200'
                }`}
              >
                {plan.highlight && (
                  <p className="text-xs font-bold text-navy-600 uppercase tracking-widest mb-4">Most popular</p>
                )}
                <p className="text-sm font-semibold text-gray-500 mb-1">{plan.name}</p>
                <p className="text-4xl font-bold text-navy-600 mb-1">
                  {plan.price}<span className="text-base font-normal text-gray-400">{plan.period}</span>
                </p>
                <div className="mt-5 space-y-1.5">
                  {[plan.vids, plan.channels].map((feat) => (
                    <div key={feat} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check size={14} className="text-green-500 flex-shrink-0" /> {feat}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-navy-600 hover:underline">
            See full feature comparison <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-12">Trusted by creators</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="card">
                <p className="text-gray-600 leading-relaxed mb-6 text-sm">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-navy-600 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="py-28 px-6 bg-navy-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">Ready to automate your channel?</h2>
          <p className="text-sky-200 text-lg mb-8">Join creators publishing 5× more content without the extra work.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-white text-navy-600 hover:bg-gray-100 px-8 py-3.5 rounded-lg font-bold text-base transition-colors">
            Get started free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
