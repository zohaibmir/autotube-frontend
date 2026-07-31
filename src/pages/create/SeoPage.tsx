import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Copy, CheckCheck, Loader2, RefreshCw, X, Plus } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCreateStore } from '@store/create'
import { aiApi } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SeoResult {
  titles:           string[]
  selectedTitle:    string
  description:      string
  tags:             string[]
  uploadTimingHint: string
  chapters:         { time: string; label: string }[]
}

const REGIONS   = ['Global', 'US', 'UK', 'CA', 'AU', 'IN', 'PK', 'AE']
const CATEGORIES = ['Education', 'Entertainment', 'How-to', 'News', 'Science', 'Finance', 'Health', 'Gaming', 'Travel', 'Food']

// ─── Tag chip ─────────────────────────────────────────────────────────────────

function TagChip({ tag, onRemove }: { tag: string; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 bg-[#F5F5F5] border border-[#E5E5E5] text-[11px] text-[#525252] rounded">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="text-[#A3A3A3] hover:text-[#DC2626] transition-colors ml-0.5">
          <X size={9} strokeWidth={2} />
        </button>
      )}
    </span>
  )
}

// ─── SEO Page ─────────────────────────────────────────────────────────────────

export default function SeoPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const {
    selectedTopic,
    scriptContent,
    setSeoPackage,
    setStep,
  } = useCreateStore()

  const [region,    setRegion]    = useState('Global')
  const [category,  setCategory]  = useState('Education')
  const [result,    setResult]    = useState<SeoResult | null>(null)
  const [newTag,    setNewTag]    = useState('')
  const [copied,    setCopied]    = useState<Record<string, boolean>>({})

  const copy = (key: string, text: string) => {
    navigator.clipboard.writeText(text)
    setCopied((p) => ({ ...p, [key]: true }))
    setTimeout(() => setCopied((p) => ({ ...p, [key]: false })), 2000)
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      try {
        const data = await aiApi.seo({
          topic:    selectedTopic?.topic ?? '',
          script:   scriptContent || undefined,
          region:   region !== 'Global' ? region : undefined,
          category,
        })
        return data as SeoResult
      } catch (err: any) {
        // Only fall back to a mock SEO result for genuine network/wiring
        // failures — a real HTTP error response (e.g. 402 missing BYOK key)
        // is re-thrown so the user sees what actually happened.
        if (err?.response) throw err
        const topic = selectedTopic?.topic ?? 'Your Video Topic'
        return {
          titles: [
            `${topic} (The Complete Guide)`,
            `I Tried ${topic} for 30 Days — Here's What Happened`,
            `Why Most People Get ${topic} Wrong`,
          ],
          selectedTitle: `${topic} (The Complete Guide)`,
          description:  `In this video, we explore ${topic} in depth — covering everything from the fundamentals to advanced strategies you can use today.\n\nWhether you're a complete beginner or looking to level up, this guide has you covered.\n\n📌 Chapters below\n⬇️ Subscribe for weekly content`,
          tags:         [topic.split(' ')[0], 'YouTube', 'Tutorial', 'HowTo', 'Guide', '2026', region !== 'Global' ? region : '', category].filter(Boolean),
          uploadTimingHint: 'Best upload windows: Tuesday 2–4 PM or Friday 12–2 PM (your audience timezone)',
          chapters: [
            { time: '0:00', label: 'Intro' },
            { time: '1:30', label: 'The Core Problem' },
            { time: '5:00', label: 'The Framework' },
            { time: '12:00', label: 'Real Examples' },
            { time: '18:30', label: 'Action Steps' },
            { time: '22:00', label: 'Outro' },
          ],
        } satisfies SeoResult
      }
    },
    onSuccess: (data) => {
      setResult(data)
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'SEO generation failed')
    },
  })

  const handleContinue = () => {
    if (!result) { toast.error('Generate SEO first'); return }
    setSeoPackage(result)
    setStep(4)
    navigate('/app/create/thumbnail')
  }

  const removeTag = (tag: string) => {
    if (!result) return
    setResult({ ...result, tags: result.tags.filter((t) => t !== tag) })
  }

  const addTag = () => {
    if (!newTag.trim() || !result) return
    setResult({ ...result, tags: [...result.tags, newTag.trim()] })
    setNewTag('')
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">SEO</h1>
          {selectedTopic && (
            <p className="text-[13px] text-[#525252] mt-0.5 max-w-lg truncate" title={selectedTopic.topic}>
              {selectedTopic.topic}
            </p>
          )}
        </div>
        {result && (
          <button
            onClick={handleContinue}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] transition-colors"
          >
            Thumbnail <ChevronRight size={12} strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Config row */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-white border border-[#E5E5E5] rounded-lg">
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Region</label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="h-7 pl-2 pr-6 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            {REGIONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
        <div className="w-px h-5 bg-[#E5E5E5]" />
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-7 pl-2 pr-6 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="ml-auto flex items-center gap-1.5 h-7 px-3 bg-[#0A0A0A] text-white text-[11px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40"
        >
          {generateMutation.isPending
            ? <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Generating…</>
            : <><RefreshCw size={11} strokeWidth={1.5} /> {result ? 'Regenerate' : 'Generate SEO'}</>}
        </button>
      </div>

      {/* Empty state */}
      {!result && !generateMutation.isPending && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-[14px] font-semibold text-[#0A0A0A] mb-1">Generate your SEO package</p>
          <p className="text-[12px] text-[#A3A3A3] mb-6">
            Select your region and category, then click Generate SEO.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            className="h-9 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors"
          >
            Generate SEO
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {generateMutation.isPending && (
        <div className="space-y-4">
          {[120, 80, 200, 60].map((h, i) => (
            <div key={i} className="bg-white border border-[#E5E5E5] rounded-lg p-5 animate-pulse">
              <div className="h-3 w-24 bg-[#F5F5F5] rounded mb-3" />
              <div className={`bg-[#F5F5F5] rounded`} style={{ height: h }} />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {result && !generateMutation.isPending && (
        <div className="space-y-4">

          {/* A/B Titles */}
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Title (A/B Options)</p>
              <button
                onClick={() => copy('titles', result.titles.join('\n'))}
                className="flex items-center gap-1 text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
              >
                {copied.titles ? <CheckCheck size={11} strokeWidth={1.5} className="text-[#16A34A]" /> : <Copy size={11} strokeWidth={1.5} />}
                Copy all
              </button>
            </div>
            <div className="space-y-2">
              {result.titles.map((title, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    result.selectedTitle === title
                      ? 'border-[#0A0A0A] bg-[#FAFAFA]'
                      : 'border-[#E5E5E5] hover:border-[#D4D4D4]'
                  }`}
                >
                  <input
                    type="radio"
                    name="title"
                    checked={result.selectedTitle === title}
                    onChange={() => setResult({ ...result, selectedTitle: title })}
                    className="mt-0.5 accent-[#0A0A0A]"
                  />
                  <span className="text-[13px] text-[#0A0A0A] leading-snug flex-1">{title}</span>
                  <span className="text-[10px] text-[#A3A3A3] flex-shrink-0">{title.length} chars</span>
                </label>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Description</p>
              <button
                onClick={() => copy('desc', result.description)}
                className="flex items-center gap-1 text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
              >
                {copied.desc ? <CheckCheck size={11} strokeWidth={1.5} className="text-[#16A34A]" /> : <Copy size={11} strokeWidth={1.5} />}
                Copy
              </button>
            </div>
            <textarea
              value={result.description}
              onChange={(e) => setResult({ ...result, description: e.target.value })}
              rows={6}
              className="w-full text-[13px] text-[#0A0A0A] leading-relaxed bg-[#FAFAFA] border border-[#E5E5E5] rounded p-3 resize-none focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
          </div>

          {/* Tags */}
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
                Tags <span className="normal-case text-[#D4D4D4] ml-1">({result.tags.length})</span>
              </p>
              <button
                onClick={() => copy('tags', result.tags.join(', '))}
                className="flex items-center gap-1 text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
              >
                {copied.tags ? <CheckCheck size={11} strokeWidth={1.5} className="text-[#16A34A]" /> : <Copy size={11} strokeWidth={1.5} />}
                Copy all
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {result.tags.map((tag) => (
                <TagChip key={tag} tag={tag} onRemove={() => removeTag(tag)} />
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTag()}
                placeholder="Add tag…"
                className="h-6 px-2 text-[11px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4] flex-1 max-w-[160px]"
              />
              <button
                onClick={addTag}
                disabled={!newTag.trim()}
                className="h-6 w-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors disabled:opacity-40"
              >
                <Plus size={11} strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Upload timing + Chapters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-3">Upload Timing</p>
              <p className="text-[13px] text-[#0A0A0A] leading-relaxed">{result.uploadTimingHint}</p>
            </div>
            <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Chapters</p>
                <button
                  onClick={() => copy('chapters', result.chapters.map((c) => `${c.time} ${c.label}`).join('\n'))}
                  className="flex items-center gap-1 text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
                >
                  {copied.chapters ? <CheckCheck size={11} strokeWidth={1.5} className="text-[#16A34A]" /> : <Copy size={11} strokeWidth={1.5} />}
                  Copy
                </button>
              </div>
              <div className="space-y-1">
                {result.chapters.map((ch, i) => (
                  <div key={i} className="flex items-center gap-3 text-[12px]">
                    <span className="font-mono text-[#A3A3A3] w-10 flex-shrink-0">{ch.time}</span>
                    <span className="text-[#0A0A0A]">{ch.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Continue CTA */}
          <div className="flex justify-end pt-2 pb-4">
            <button
              onClick={handleContinue}
              className="flex items-center gap-2 h-9 px-6 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors"
            >
              Continue to Thumbnail <ChevronRight size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
