import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
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
    details: ['300+ voice options', 'Auto music bed & mixing', 'Multi-language support (75+ languages)'],
  },
  {
    step: '03', title: 'Visual Assembly', time: '~2 min',
    description: 'Stock footage, AI-generated images, and animated overlays are assembled and synced to your audio. Captions are burned in automatically.',
    details: ['AI image generation', 'Auto-subtitles (95%+ accuracy)', 'Thumbnail auto-generated'],
  },
  {
    step: '04', title: 'Publish & Distribute', time: '~30 sec',
    description: 'Your video is uploaded to YouTube with optimised metadata. Optionally distribute Shorts or Reels to Instagram, TikTok and Facebook, share the link to a Telegram channel, and post it to your subreddits.',
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
  { q: 'What languages are supported?', a: '80+ languages including English, Spanish, Portuguese, French, German, Arabic, Hindi, Urdu, Bengali, Indonesian, Japanese, Korean, Mandarin, and Cantonese - script and voiceover both.' },
]

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="How It Works"
        description="See exactly how Vidora turns a topic into a published video: script generation, voiceover, visual assembly, render, and multi-platform upload - every stage visible, nothing hidden."
        path="/how-it-works"
      />

      {/* Hero */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 64 }}>
          <p className="font-semibold uppercase text-sky-700" style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}>
            How it works
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2.25rem, 4.6vw, 3.25rem)', lineHeight: 1.06, letterSpacing: '-0.03em', maxWidth: 760 }}
          >
            Five stages. Fully automatic.
          </h1>
          <p className="text-gray-500" style={{ fontSize: 18.5, lineHeight: 1.65, marginTop: 18, maxWidth: 620 }}>
            From a single topic to a published, SEO-optimised video — the whole pipeline runs
            without you touching a timeline.
          </p>
          <div className="flex flex-col sm:flex-row" style={{ gap: 12, marginTop: 30 }}>
            <Link to="/signup" className="btn-primary btn-lg">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/pricing" className="btn-secondary btn-lg">
              See pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Stages */}
      <section className="border-b border-gray-100">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <div className="relative">
            {/* Connector. The nodes used to be 40px grey circles with a
                text-gray-500 number and a `text-gray-500 border-gray-200` time
                chip — the whole ladder sat at the lightest end of the palette,
                so a five-stage pipeline read as decoration. */}
            <div
              className="absolute hidden sm:block"
              style={{ left: 19, top: 24, bottom: 24, width: 2, backgroundColor: '#E8EDF2' }}
            />
            <div>
              {pipeline.map((stage, i) => (
                <div
                  key={stage.step}
                  className="relative flex"
                  style={{ gap: 26, paddingBottom: i === pipeline.length - 1 ? 0 : 40 }}
                >
                  <div
                    className="relative z-10 flex flex-shrink-0 items-center justify-center rounded-full bg-white"
                    style={{ width: 40, height: 40, border: '2px solid #C2D1E0' }}
                  >
                    <span className="font-bold text-navy-600" style={{ fontSize: 13 }}>{stage.step}</span>
                  </div>

                  <div className="flex-1" style={{ paddingTop: 2 }}>
                    <div className="flex flex-wrap items-center" style={{ gap: 10, marginBottom: 8 }}>
                      <h2 className="font-semibold text-navy-600" style={{ fontSize: 19 }}>{stage.title}</h2>
                      <span
                        className="rounded-full bg-navy-50 font-semibold text-navy-600"
                        style={{ fontSize: 11, padding: '3px 10px' }}
                      >
                        {stage.time}
                      </span>
                    </div>
                    <p className="text-gray-500" style={{ fontSize: 15, lineHeight: 1.7, marginBottom: 14, maxWidth: 620 }}>
                      {stage.description}
                    </p>
                    <ul className="flex flex-wrap" style={{ gap: '8px 24px' }}>
                      {stage.details.map((d) => (
                        <li key={d} className="flex items-center text-gray-600" style={{ gap: 8, fontSize: 13.5 }}>
                          <span className="flex-shrink-0 rounded-full bg-sky-500" style={{ width: 5, height: 5 }} />
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

      {/* FAQ */}
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(1.5rem, 2.6vw, 1.9rem)', lineHeight: 1.2, letterSpacing: '-0.02em', marginBottom: 28 }}
          >
            Common questions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '26px 40px' }}>
            {faqs.map((item) => (
              <div key={item.q}>
                <p className="font-semibold text-navy-600" style={{ fontSize: 15, marginBottom: 6 }}>{item.q}</p>
                <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.7 }}>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy-600">
        <div className="site-container text-center" style={{ paddingTop: 72, paddingBottom: 72 }}>
          <h2
            className="font-bold text-white"
            style={{ fontSize: 'clamp(1.7rem, 3vw, 2.2rem)', lineHeight: 1.15, letterSpacing: '-0.025em' }}
          >
            Ready to try it?
          </h2>
          <p className="text-sky-200" style={{ fontSize: 16.5, lineHeight: 1.6, marginTop: 12 }}>
            Start free — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row justify-center" style={{ gap: 12, marginTop: 26 }}>
            <Link to="/signup" className="btn-primary btn-lg btn-inverse">
              Start free <ArrowRight size={17} />
            </Link>
            <Link to="/contact" className="btn-secondary btn-lg btn-outline-inverse">
              Talk to us
            </Link>
          </div>
        </div>
      </section>

      </main>
      <Footer />
    </div>
  )
}
