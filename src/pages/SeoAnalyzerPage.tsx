import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Navbar from '@components/Navbar'
import Footer from '@components/Footer'
import SEO, { SITE_URL } from '@components/SEO'
import {
  Search, Loader2, CheckCircle2, AlertTriangle, ArrowRight,
  Tag, FileText, Type, ListVideo, Clapperboard, Eye, Bookmark,
} from 'lucide-react'
import { publicApi } from '@api/services'
import { apiErrorMessage } from '@lib/apiError'

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
  const [copied, setCopied] = useState(false)
  const [searchParams] = useSearchParams()
  const autoRan = useRef(false)
  const [bookmarkletOrigin, setBookmarkletOrigin] = useState(SITE_URL)

  useEffect(() => {
    setBookmarkletOrigin(window.location.origin)
  }, [])

  // `useCallback` with no dependencies (every setter is stable and `publicApi` is a module import)
  // so the deep-link effect below can depend on it without re-running on every render.
  const runAnalysis = useCallback(async (targetUrl: string) => {
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
      setError(apiErrorMessage(err, 'Could not analyze this video. Double-check the link and try again.'))
    } finally {
      setLoading(false)
    }
  }, [])

  // Deep link: /tools/seo-analyzer?url=<video id or URL> analyses on arrival.
  //
  // This is the whole reason the bookmarklet and the extension can be one line each: they only have
  // to open a URL, and the page does the rest. It also means the result is shareable -- a link with
  // `?url=` in it opens straight onto the report rather than an empty form.
  //
  // `autoRan` guards against React's double-invoked effects in development, which would otherwise
  // spend two of the visitor's 15 free analyses per ten minutes on one page load.
  useEffect(() => {
    if (autoRan.current) return
    const incoming = (searchParams.get('url') || searchParams.get('v') || '').trim()
    if (!incoming) return
    autoRan.current = true
    setUrl(incoming)
    runAnalysis(incoming)
  }, [searchParams, runAnalysis])

  // Built from the current origin rather than a hardcoded domain, so the same page hands out a
  // working bookmarklet on localhost, on a preview deploy, and in production without edits.
  const bookmarklet = useMemo(() => {
    const origin = bookmarkletOrigin
    const code =
      '(function(){' +
      'var m=location.href.match(/(?:v=|\\/shorts\\/|\\/live\\/|\\/video\\/|youtu\\.be\\/|\\/embed\\/)([A-Za-z0-9_-]{11})/);' +
      "if(!m){alert('Open a YouTube video, or a video in YouTube Studio, first.');return;}" +
      "window.open('" + origin + "/tools/seo-analyzer?url='+m[1],'_blank','noopener');" +
      '})();'
    return 'javascript:' + code
  }, [bookmarkletOrigin])

  const copyBookmarklet = async () => {
    try {
      await navigator.clipboard.writeText(bookmarklet)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be denied; the drag target next to this button still works, so a
      // failed copy is not worth an error message.
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    runAnalysis(url)
  }

  const scoreColor = (score: number) =>
    score >= 80 ? 'text-green-700' : score >= 50 ? 'text-amber-700' : 'text-red-600'
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

      {/* Hero.
          The search control was `h-12`, which this project's doubled spacing scale
          emits as 96px -- twice the intended height -- with `pl-10` (80px) putting
          the placeholder 80px from an icon sitting at 14px. Heights and paddings
          are explicit here so the input and button stay in proportion. The
          gradient is replaced with the flat tint the rest of the site uses, per
          the "no gradients" rule in the design tokens. */}
      <main className="flex flex-1 flex-col">
      <section className="border-b border-gray-100 bg-[#FAFBFC]">
        <div className="site-container text-center" style={{ paddingTop: 64, paddingBottom: 56 }}>
          <p
            className="font-semibold uppercase text-sky-700"
            style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 14 }}
          >
            Free tool · No signup · Instant results
          </p>
          <h1
            className="font-bold text-navy-600"
            style={{ fontSize: 'clamp(2rem, 4vw, 2.9rem)', lineHeight: 1.1, letterSpacing: '-0.028em', marginBottom: 16 }}
          >
            Free YouTube video SEO analyzer
          </h1>
          <p
            className="text-gray-500"
            style={{ fontSize: 17.5, lineHeight: 1.65, maxWidth: 620, marginInline: 'auto', marginBottom: 32 }}
          >
            Paste any public YouTube link and get an instant SEO checklist — tags, description length,
            title length, chapters, and category — the same checklist our full product runs on your own channel.
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row"
            style={{ gap: 12, maxWidth: 560, marginInline: 'auto' }}
          >
            <div className="relative flex-1">
              <Search
                size={16}
                className="absolute text-gray-500"
                style={{ left: 14, top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                aria-label="YouTube video URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
                className="w-full text-sm border border-gray-200 rounded-[10px] focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition-shadow"
                style={{ height: 52, paddingLeft: 38, paddingRight: 14 }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="flex flex-shrink-0 items-center justify-center bg-navy-600 text-sm font-semibold text-white rounded-[10px] hover:bg-navy-700 disabled:opacity-40 transition-colors"
              style={{ height: 52, paddingInline: 22, gap: 8 }}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
              {loading ? 'Analyzing…' : 'Analyze'}
            </button>
          </form>

          <div
            className="flex items-center justify-center text-gray-500"
            style={{ marginTop: 16, gap: 8, fontSize: 12.5 }}
          >
            <span>Works with watch, Shorts, and youtu.be links.</span>
            <button
              type="button"
              onClick={() => { setUrl(EXAMPLE_URL); runAnalysis(EXAMPLE_URL) }}
              className="font-medium text-sky-700 underline underline-offset-2 hover:text-navy-600"
            >
              Try an example
            </button>
          </div>

          {error && (
            <div role="alert" className={`mt-5 max-w-xl mx-auto text-sm rounded-lg px-4 py-3 text-left flex items-start gap-2 ${
              isRateLimited ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
            }`}>
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </section>

      {/* Work inside YouTube Studio (Competitor Playbook §2.9).
          Shown only while there is no report: once a result exists it is what the visitor came for,
          and pushing it down the page to advertise a shortcut would be the wrong trade. */}
      {!result && (
        <section className="border-b border-gray-100">
          <div className="site-container" style={{ maxWidth: 760, paddingTop: 44, paddingBottom: 52 }}>
            <div className="border border-gray-200 rounded-xl bg-[#FAFBFC]" style={{ padding: 24 }}>
              <div className="grid grid-cols-1 md:grid-cols-2 items-center" style={{ gap: 22 }}>
                <div>
                  <p
                    className="font-semibold uppercase text-sky-700"
                    style={{ fontSize: 11, letterSpacing: '0.1em', marginBottom: 10 }}
                  >
                    Also available in Studio
                  </p>
                  <h2 className="font-bold text-navy-600" style={{ fontSize: 19, marginBottom: 8 }}>
                    Run this without leaving YouTube Studio
                  </h2>
                  <p className="text-gray-500" style={{ fontSize: 14, lineHeight: 1.6 }}>
                    Drag the button to your bookmarks bar, or copy it. Open any video in Studio, click
                    the bookmark, and this page opens on that video's report — no copying links.
                  </p>
                </div>
                <div className="flex flex-col items-start md:items-end" style={{ gap: 10 }}>
                  <a
                    href={bookmarklet}
                    draggable
                    onClick={(e) => e.preventDefault()}
                    title="Drag me to your bookmarks bar"
                    aria-label="Check SEO in YouTube Studio — drag this to your bookmarks bar"
                    className="inline-flex items-center bg-navy-600 text-white text-sm font-semibold rounded-lg hover:bg-navy-700 transition-colors cursor-grab active:cursor-grabbing"
                    style={{ height: 44, paddingInline: 20, gap: 8 }}
                  >
                    <Bookmark size={15} /> Check SEO in Studio
                  </a>
                  <button
                    type="button"
                    onClick={copyBookmarklet}
                    className="text-sm font-medium text-sky-700 underline underline-offset-2 hover:text-navy-600"
                  >
                    {copied ? 'Copied — paste it as a bookmark URL' : 'Copy the bookmarklet instead'}
                  </button>
                  <p className="text-xs text-gray-500 text-left md:text-right">
                    Works on watch pages and in YouTube Studio.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {result && (
        <section className="border-b border-gray-100" aria-label="SEO analysis results">
          <div className="site-container" style={{ maxWidth: 760, paddingTop: 48, paddingBottom: 64 }}>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-8 shadow-sm">
              {/* Video preview header */}
              <div
                className="flex items-center border-b border-gray-100 bg-[#FAFBFC]"
                style={{ gap: 16, padding: 24 }}
              >
                <img
                  src={`https://i.ytimg.com/vi/${result.video_id}/hqdefault.jpg`}
                  alt=""
                  width={480}
                  height={360}
                  loading="lazy"
                  decoding="async"
                  style={{ width: 112, height: 63 }}
                  className="object-cover rounded-md flex-shrink-0 bg-gray-200"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-600 truncate">{result.video.title}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><Eye size={12} /> {fmtCompact(result.video.views)} views</span>
                    <span>{fmtDuration(result.video.duration_secs)}</span>
                    {result.video.is_short && <span className="px-1.5 py-0.5 bg-gray-200 rounded text-gray-500">Short</span>}
                  </div>
                </div>
              </div>

              {/* Score */}
              <div className="flex items-center justify-between px-6 py-6">
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">SEO Score</p>
                  <p className={`text-5xl font-bold ${scoreColor(result.score)}`}>
                    {result.score}<span className="text-lg text-gray-500">/100</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{passCount} of {checklist.length} checks passed</p>
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
                          <Icon size={13} className="text-gray-500" />
                          {item.label}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{item.detail}</p>
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
        <section>
          <div
            className="site-container grid grid-cols-1 sm:grid-cols-3 text-center"
            style={{ paddingTop: 56, paddingBottom: 64, gap: 32 }}
          >
            {[
              { step: '1', title: 'Paste a link', desc: 'Any public YouTube watch, Shorts, or youtu.be URL.' },
              { step: '2', title: 'We check the real data', desc: 'Tags, description, title length, chapters, and category via the YouTube Data API.' },
              { step: '3', title: 'Get a scored checklist', desc: 'See exactly what to fix - no vague advice, just concrete issues.' },
            ].map((s) => (
              <div key={s.step}>
                <div className="w-9 h-9 rounded-full bg-navy-600 text-white text-sm font-bold flex items-center justify-center mx-auto mb-4">
                  {s.step}
                </div>
                <h2 className="font-semibold text-navy-600 mb-1.5" style={{ fontSize: '1.25rem' }}>{s.title}</h2>
                <p className="text-sm text-gray-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      </main>
      <Footer />
    </div>
  )
}

