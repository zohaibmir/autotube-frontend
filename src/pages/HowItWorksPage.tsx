import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import { ArrowRight } from 'lucide-react'

const pipeline = [
  {
    step: '01', title: 'Topic & Script', time: '~30 sec',
    description: 'Enter a topic or keyword. The AI researches top search intent and writes an optimised script matched to your channel voice and audience.',
    details: ['SEO-optimised title & description', 'Hook, body, and CTA structure', 'Audience-specific tone adjustment'],
  },
  {
    step: '02', title: 'Audio Generation', time: '~60 sec',
    description: 'A natural voiceover is generated with correct prosody, then mixed with royalty-free background music at the right energy level.',
    details: ['Multiple voice options (20+ voices)', 'Auto music bed & mixing', 'Multi-language support (30+ languages)'],
  },
  {
    step: '03', title: 'Visual Assembly', time: '~2 min',
    description: 'Stock footage, AI-generated images, and animated overlays are assembled and synced to your audio. Captions are burned in automatically.',
    details: ['AI image generation', 'Auto-subtitles (95%+ accuracy)', 'Thumbnail auto-generated'],
  },
  {
    step: '04', title: 'Publish & Distribute', time: '~30 sec',
    description: 'Your video is uploaded to YouTube with optimised metadata. Optionally distribute Shorts or Reels to Instagram, TikTok, and Facebook.',
    details: ['Direct YouTube API upload', 'Scheduled publishing', 'Cross-platform distribution'],
  },
  {
    step: '05', title: 'Monitor & Iterate', time: 'Ongoing',
    description: 'Track performance from your dashboard. Views, watch time, CTR, and engagement metrics update in real time.',
    details: ['Real-time analytics dashboard', 'Automated performance reports', 'AI content recommendations'],
  },
]

const faqs = [
  { q: 'How long does a video take?', a: '3–8 minutes for most videos. A 60-second Short takes ~2–3 min; a 10-minute video takes 6–10 min.' },
  { q: 'Can I edit the script before it renders?', a: 'Yes. Every job has a review step where you can modify the script, change the title, or swap visuals before rendering starts.' },
  { q: 'What languages are supported?', a: '30+ languages including English, Spanish, French, German, Arabic, Hindi, and Mandarin — script and voiceover both.' },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      <section className="pt-28 pb-20 px-6 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">How it works</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">Five stages.<br />Fully automatic.</h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-xl">
            From a single topic to a published, SEO-optimised video — the entire pipeline runs without you touching a timeline.
          </p>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-[19px] top-8 bottom-8 w-px bg-gray-100 hidden sm:block" />
            <div className="space-y-0">
              {pipeline.map((stage, i) => (
                <div key={stage.step} className="relative flex gap-8 pb-12 last:pb-0">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full border-2 border-gray-200 bg-white flex items-center justify-center z-10">
                    <span className="text-xs font-bold text-gray-400">{i + 1}</span>
                  </div>
                  <div className="flex-1 pt-1.5">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-navy-600">{stage.title}</h3>
                      <span className="text-xs text-gray-400 border border-gray-200 rounded-full px-2.5 py-0.5">{stage.time}</span>
                    </div>
                    <p className="text-gray-500 text-sm leading-relaxed mb-4">{stage.description}</p>
                    <ul className="space-y-1.5">
                      {stage.details.map((d) => (
                        <li key={d} className="flex items-center gap-2 text-sm text-gray-500">
                          <span className="w-1 h-1 rounded-full bg-sky-400 flex-shrink-0" />
                          {d}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 px-6 bg-gray-50 border-y border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-navy-600 mb-10">Common questions</h2>
          <div className="space-y-8">
            {faqs.map((item) => (
              <div key={item.q}>
                <p className="font-semibold text-navy-600 mb-1.5 text-sm">{item.q}</p>
                <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-2xl font-bold text-navy-600 mb-1">Ready to try it?</h2>
            <p className="text-gray-500">Start free — no credit card required.</p>
          </div>
          <Link to="/signup" className="btn-primary whitespace-nowrap">
            Get started <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
