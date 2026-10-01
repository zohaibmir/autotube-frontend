import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO from '@components/SEO'
import {
  Search, Loader2, CheckCircle2, AlertTriangle, ArrowRight,
  Tag, FileText, Type, ListVideo, Clapperboard, Eye,
} from 'lucide-react'
import { publicApi } from '@api/services'

interface AnalyzeResult {
  ok: boolean
  video_id: string
  score: number
  video: {
    title: string
    title_len: number
    status: string
    views: number
    tags_count: number
    desc_len: number
    category: string
    language: string
    duration_secs: number
    has_chapters: boolean
    is_short: boolean
    issues: string[]
  }
}

const EXAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

const fmtCompact = (n: number) => {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

const fmtDuration = (secs: number) => {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Checklist items shown for every analysis, each marked pass/fail based on
// whether its corresponding issue string is present in video.issues.
function buildChecklist(video: AnalyzeResult['video']) {
  const has = (needle: string) => video.issues.some((i) => i.toLowerCase().includes(needle))
  return [
    { icon: Tag, label: `${video.tags_count} tags`, pass: !has('tags'), detail: has('tags') ? 'Aim for 8+ specific tags' : 'Good tag coverage' },
    { icon: FileText, label: `${video.desc_len} character description`, pass: !has('short description'), detail: has('short description') ? 'Aim for 200+ characters' : 'Good description length' },
    { icon: Type, label: `${video.title_len}-character title`, pass: !has('title exceeds'), detail: has('title exceeds') ? 'May truncate in search/suggested' : 'Fits within search/suggested surfaces' },
    { icon: ListVideo, label: video.has_chapters ? 'Has chapters' : 'No chapters', pass: video.has_chapters || video.duration_secs < 180, detail: video.duration_secs < 180 ? 'Not needed for short videos' : (video.has_chapters ? 'Improves navigation and retention' : 'Add timestamps for videos over 3 min') },
    { icon: Clapperboard, label: `Category ${video.category}`, pass: !has('category'), detail: has('category') ? 'Consider Education/News/Nonprofits for discoverability' : 'Good category fit' },
  ]
}

export default function SeoAnalyzerPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)

  const runAnalysis = async (targetUrl: string) => {
    if (!targetUrl.trim()) return
    setLoading(true)
    setError('')
    setIsRateLimited(false)
    setResult(null)
    try {
      const data = await publicApi.seoAnalyze(targetUrl.trim())
      setResult(data)
    } catch (err: any) {
      const status = err?.response?.status
      setIsRateLimited(status === 429)
      setError(
        err?.response?.data?.detail ||
        'Could not analyze this video. Double-check the link and try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runAnalysis(url)
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-500' : score >= 50 ? 'text-amber-500' : 'text-red-500'
  const scoreRing = (score: number) =>
    score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444'

  const checklist = result ? buildChecklist(result.video) : []
  const passCount = checklist.filter((c) => c.pass).length

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />
      <SEO
        title="Free YouTube SEO Analyzer"
        description="Paste any public YouTube link and get an instant SEO checklist - tags, description length, title length, chapters, and category. No signup required."
        path="/tools/seo-analyzer"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Free YouTube SEO Analyzer',
          applicationCategory: 'BusinessApplication',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          description: 'Instant SEO checklist for any public YouTube video - tags, description length, title length, chapters, and category.',
        }}
      />

      {/* Hero */}
      <section className="pt-28 pb-16 px-6 border-b border-gray-100 bg-gradient-to-b from-sky-50/60 to-white">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-sky-500 font-semibold text-sm uppercase tracking-widest mb-5">Free tool · No signup · Instant results</p>
          <h1 className="text-5xl font-bold text-navy-600 leading-[1.1] mb-5">
            Free YouTube video SEO analyzer
          </h1>
          <p className="text-xl text-gray-500 max-w-xl mx-auto mb-10">
            Paste any public YouTube link and get an instant SEO checklist - tags, description length,
            title length, chapters, and category - the same checklist our full product runs on your own channel.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full h-12 pl-10 pr-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-shadow"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="h-12 px-6 bg-navy-600 text-white text-sm font-semibold rounded-lg hover:bg-navy-700 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-gray-400">
            <span>Works with watch, Shorts, and youtu.be links.</span>
            <button
              type="button"
              onClick={() => { setUrl(EXAMPLE_URL); runAnalysis(EXAMPLE_URL) }}
              className="text-sky-500 hover:text-sky-600 font-medium underline underline-offset-2"
            >
              Try an example
            </button>
          </div>

          {error && (
            <div className={`mt-5 max-w-xl mx-auto text-sm rounded-lg px-4 py-3 text-left flex items-start gap-2 ${
              isRateLimited ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
            }`}>
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* Results */}
      {result && (
        <section className="py-16 px-6 border-b border-gray-100">
          <div className="max-w-2xl mx-auto">
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">
              {/* Video preview header */}
              <div className="flex items-center gap-4 p-6 border-b border-gray-100 bg-gray-50/60">
                <img
                  src={`https://i.ytimg.com/vi/${result.video_id}/hqdefault.jpg`}
                  alt=""
                  className="w-28 h-16 object-cover rounded-md flex-shrink-0 bg-gray-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-600 truncate">{result.video.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span className="flex items-center gap-1"><Eye size={12} /> {fmtCompact(result.video.views)} views</span>
                    <span>{fmtDuration(result.video.duration_secs)}</span>
                    {result.video.is_short && <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-500">Short</span>}
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center justify-between px-6 py-6">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">SEO Score</p>
                  <p className={`text-5xl font-bold ${scoreColor(result.score)}`}>
                    {result.score}<span className="text-lg text-gray-300">/100</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{passCount} of {checklist.length} checks passed</p>
                </div>
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.5" fill="none" stroke="#F3F4F6" strokeWidth="3.5" />
                    <circle
                      cx="18" cy="18" r="15.5" fill="none"
                      stroke={scoreRing(result.score)}
                      strokeWidth="3.5"
                      strokeDasharray={`${(result.score / 100) * 97.4} 97.4`}
                      strokeLinecap="round"
                    />
                  </svg>
                  {result.video.issues.length === 0 ? (
                    <CheckCircle2 size={22} className="text-green-500 absolute inset-0 m-auto" />
                  ) : (
                    <AlertTriangle size={22} className="text-amber-500 absolute inset-0 m-auto" />
                  )}
                </div>
              </div>

              {/* Checklist */}
              <div className="border-t border-gray-100 divide-y divide-gray-100">
                {checklist.map((item, i) => {
                  const Icon = item.icon
                  return (
                    <div key={i} className="flex items-start gap-3 px-6 py-3.5">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        item.pass ? 'bg-green-50 text-green-500' : 'bg-amber-50 text-amber-500'
                      }`}>
                        {item.pass ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-sm font-medium text-navy-600">
                          <Icon size={13} className="text-gray-400" />
                          {item.label}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{item.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="text-center">
              <p className="text-gray-500 text-sm mb-4">
                Want this checklist automated across your whole channel, plus AI-generated fixes?
              </p>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 h-11 px-6 bg-navy-600 text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors"
              >
                Get started free <ArrowRight size={15} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* How it works (shown when no result yet, to explain the tool) */}
      {!result && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8 text-center">
            {[
              { step: '1', title: 'Paste a link', desc: 'Any public YouTube watch, Shorts, or youtu.be URL.' },
              { step: '2', title: 'We check the real data', desc: 'Tags, description, title length, chapters, and category via the YouTube Data API.' },
              { step: '3', title: 'Get a scored checklist', desc: 'See exactly what to fix - no vague advice, just concrete issues.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="w-9 h-9 rounded-full bg-navy-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h3 className="font-semibold text-navy-600 mb-1.5">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}

