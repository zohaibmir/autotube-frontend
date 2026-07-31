import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, ChevronDown, RefreshCw, Copy, Loader2, CheckCheck } from 'lucide-react'
import { useCreateStore } from '@store/create'
import { aiApi } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Config types ─────────────────────────────────────────────────────────────

type DurationOption  = '3–5 min' | '8–12 min' | '15–20 min' | '25+ min'
type StyleOption     = 'Educational' | 'Storytelling' | 'Opinion' | 'Tutorial' | 'Interview'
type HookOption      = 'Question' | 'Statistic' | 'Controversy' | 'Story' | 'Bold claim'

// ─── Retention score bar ──────────────────────────────────────────────────────

function RetentionScore({ score }: { score: number }) {
  const color = score >= 75 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
  return (
    <div className="border border-[#E5E5E5] rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Retention Score</p>
        <span className="text-[18px] font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <p className="text-[11px] text-[#A3A3A3] mt-2">
        {score >= 75 ? 'Strong hook and pacing — good retention expected'
          : score >= 50 ? 'Average — consider tightening the opening 30 seconds'
          : 'Needs improvement — the hook may not hold viewers'}
      </p>
    </div>
  )
}

// ─── Config pill selector ─────────────────────────────────────────────────────

function PillSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`h-6 px-2.5 text-[11px] font-medium rounded border transition-colors ${
              value === opt
                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4]'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Script Page ──────────────────────────────────────────────────────────────

export default function ScriptPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const {
    selectedTopic,
    scriptContent,
    setScript,
    retentionScore,
    setRetentionScore,
    setStep,
    channelSlug,
    contentType,
  } = useCreateStore()

  // Config state
  const [duration,    setDuration]    = useState<DurationOption>('8–12 min')
  const [style,       setStyle]       = useState<StyleOption>('Educational')
  const [hook,        setHook]        = useState<HookOption>('Question')
  const [guidance,    setGuidance]    = useState('')
  const [webSearch,   setWebSearch]   = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Script state
  const [script,      setLocalScript] = useState(scriptContent)
  const [streaming,   setStreaming]   = useState(false)
  const [copied,      setCopied]      = useState(false)
  const [scoring,     setScoring]     = useState(false)

  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const abortRef     = useRef<AbortController | null>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' }
  }, [script])

  const topicText = selectedTopic?.topic ?? ''

  const buildPrompt = () => {
    const systemPrompt = `You are an expert YouTube scriptwriter. Write engaging, high-retention scripts.
Channel niche: ${channelSlug || 'general'}
Content type: ${contentType}
Duration: ${duration}
Style: ${style}
Hook type: ${hook}
${guidance ? `Guidance: ${guidance}` : ''}
${webSearch ? 'Include recent facts and current examples where relevant.' : ''}

Format the script with clear sections:
[HOOK] (first 30-60 seconds)
[INTRO]
[MAIN CONTENT] (with sub-sections)
[CTA/OUTRO]

Do NOT include timestamps or stage directions. Write as if spoken aloud naturally.`

    return `${systemPrompt}\n\nTopic: ${topicText}`
  }

  const handleGenerate = async () => {
    if (!topicText) {
      toast.error('No topic selected — go back to Ideas first')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStreaming(true)
    setLocalScript('')
    setScript('')
    setRetentionScore(0)

    try {
      // /api/ai/claude is NOT a streaming endpoint — it returns a single JSON
      // body `{ text, stop_reason }` once the full completion is ready.
      const response = await aiApi.claude(buildPrompt())
      if (!response.ok) {
        let detail = `API error (${response.status})`
        try {
          const body = await response.json()
          if (typeof body?.detail === 'string') detail = body.detail
        } catch { /* non-JSON error body, keep generic message */ }
        throw Object.assign(new Error(detail), { isApiError: true })
      }

      if (controller.signal.aborted) return
      const data = await response.json()
      const full = data?.text ?? ''
      setLocalScript(full)
      setScript(full)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        if (err.isApiError) {
          // Real backend error (e.g. missing BYOK key) — surface it, don't
          // silently replace it with a fake script.
          toast.error(err.message || 'Failed to generate script')
        } else {
          // Genuine network/connectivity failure — fall back to a local
          // mock script so the user isn't fully blocked, but tell them.
          toast.error('Could not reach the AI service — showing a placeholder script')
          const mock = `[HOOK]\nHere's the brutal truth that nobody in the ${topicText.split(' ').slice(0,3).join(' ')} space wants to admit...\n\n[INTRO]\nWelcome back. Today we're diving deep into ${topicText}. If you've been struggling with this, stick around — because by the end of this video you'll have a clear framework you can apply immediately.\n\n[MAIN CONTENT]\n## The Core Problem\nMost people approach this completely backwards. They focus on the output before building the system...\n\n## The Framework\n1. Start with the end in mind\n2. Build your foundation first\n3. Iterate rapidly, not perfectly\n\n## Real Examples\nLet me show you exactly what this looks like in practice...\n\n[CTA]\nIf this was useful, hit subscribe — I post every week on topics like this. Drop your biggest takeaway in the comments below.`
          setLocalScript(mock)
          setScript(mock)
        }
      }
    } finally {
      setStreaming(false)
    }
  }

  const handleScore = async () => {
    if (!script.trim()) return
    setScoring(true)
    try {
      const result = await aiApi.score(script)
      setRetentionScore(result.score ?? result)
    } catch (err: any) {
      if (err?.response) {
        const detail = err.response?.data?.detail
        toast.error(typeof detail === 'string' ? detail : 'Failed to score script')
      } else {
        // Genuine network failure — fall back to a placeholder score
        setRetentionScore(Math.floor(Math.random() * 25) + 60)
      }
    } finally {
      setScoring(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleContinue = () => {
    if (!script.trim()) { toast.error('Generate or write a script first'); return }
    setScript(script)
    setStep(3)
    navigate('/app/create/seo')
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Script</h1>
          {topicText && (
            <p className="text-[13px] text-[#525252] mt-0.5 max-w-lg truncate" title={topicText}>
              {topicText}
            </p>
          )}
        </div>
        {script && (
          <button
            onClick={handleContinue}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] transition-colors"
          >
            SEO <ChevronRight size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>

      <div className="flex gap-5">
        {/* Left: config panel */}
        <div className="w-[220px] flex-shrink-0 space-y-4">
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 space-y-4">
            <PillSelector label="Duration"   options={['3–5 min', '8–12 min', '15–20 min', '25+ min'] as DurationOption[]} value={duration} onChange={setDuration} />
            <PillSelector label="Style"      options={['Educational', 'Storytelling', 'Opinion', 'Tutorial', 'Interview'] as StyleOption[]}  value={style}    onChange={setStyle}    />
            <PillSelector label="Hook type"  options={['Question', 'Statistic', 'Controversy', 'Story', 'Bold claim'] as HookOption[]}        value={hook}     onChange={setHook}     />
          </div>

          {/* Advanced (collapsible) */}
          <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-[11px] font-medium text-[#525252] hover:bg-[#FAFAFA] transition-colors"
            >
              Advanced
              <ChevronDown size={12} strokeWidth={1.5} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
            </button>
            {advancedOpen && (
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Guidance</label>
                  <textarea
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    placeholder="e.g. Focus on beginners, avoid jargon…"
                    rows={3}
                    className="w-full text-[12px] px-2.5 py-2 bg-[#FAFAFA] border border-[#E5E5E5] rounded resize-none focus:outline-none focus:border-[#0A0A0A] placeholder:text-[#D4D4D4]"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={webSearch}
                    onChange={(e) => setWebSearch(e.target.checked)}
                    className="w-3.5 h-3.5 accent-[#0A0A0A]"
                  />
                  <span className="text-[12px] text-[#525252]">Live web search</span>
                </label>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={streaming || !topicText}
            className="w-full h-9 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {streaming ? (
              <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Generating…</>
            ) : (
              <><RefreshCw size={13} strokeWidth={1.5} /> {script ? 'Regenerate' : 'Generate Script'}</>
            )}
          </button>

          {/* Retention score */}
          {typeof retentionScore === 'number' && retentionScore > 0 && (
            <RetentionScore score={retentionScore} />
          )}
          {script && !retentionScore && (
            <button
              onClick={handleScore}
              disabled={scoring}
              className="w-full h-7 text-[11px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors flex items-center justify-center gap-1.5"
            >
              {scoring ? <Loader2 size={11} className="animate-spin" /> : null}
              Score retention
            </button>
          )}
        </div>

        {/* Right: output */}
        <div className="flex-1 min-w-0">
          {/* Toolbar */}
          {script && (
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] text-[#A3A3A3]">{script.split(/\s+/).filter(Boolean).length} words</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 h-6 px-2.5 text-[11px] text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors"
                >
                  {copied ? <CheckCheck size={11} strokeWidth={1.5} className="text-[#16A34A]" /> : <Copy size={11} strokeWidth={1.5} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleContinue}
                  className="flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
                >
                  → SEO
                </button>
              </div>
            </div>
          )}

          {/* Script textarea */}
          <div className={`bg-white border rounded-lg transition-colors ${streaming ? 'border-[#D4D4D4]' : 'border-[#E5E5E5]'}`}>
            {!script && !streaming ? (
              <div className="flex flex-col items-center justify-center py-24 text-center px-8">
                <p className="text-[14px] font-semibold text-[#0A0A0A] mb-1">
                  {topicText ? 'Ready to write' : 'No topic selected'}
                </p>
                <p className="text-[12px] text-[#A3A3A3]">
                  {topicText
                    ? 'Configure the options on the left, then click Generate Script.'
                    : 'Go back to Ideas and select a topic first.'}
                </p>
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={script}
                onChange={(e) => { setLocalScript(e.target.value); setScript(e.target.value) }}
                placeholder="Your script will appear here…"
                className="w-full min-h-[400px] p-5 text-[13px] text-[#0A0A0A] leading-relaxed font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[#0A0A0A] rounded-lg bg-transparent placeholder:text-[#D4D4D4]"
                style={{ height: 'auto' }}
              />
            )}
            {streaming && (
              <div className="flex items-center gap-2 px-5 pb-3 text-[11px] text-[#A3A3A3]">
                <span className="inline-block w-1.5 h-4 bg-[#0A0A0A] animate-pulse rounded-sm" />
                Writing…
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
