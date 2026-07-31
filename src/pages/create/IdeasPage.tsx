import React, { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, TrendingUp, Leaf, Newspaper, Pen, ChevronRight, Bookmark, BookmarkCheck, Loader2, AlertCircle, RefreshCw, ListPlus, Check } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCreateStore, type TopicIdea } from '@store/create'
import { useChannels } from '@hooks/useJobs'
import { aiApi, queueApi } from '@api/services'
import { useToast } from '@components/Toast'
import { useAuthStore } from '@store/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

type RecencyOption = 'today' | '48h' | '7d' | '30d'
type TopicType     = 'viral' | 'evergreen' | 'news' | 'custom'

const RECENCY_OPTIONS: { id: RecencyOption; label: string }[] = [
  { id: 'today', label: 'Today'  },
  { id: '48h',   label: '48h'    },
  { id: '7d',    label: '7 days' },
  { id: '30d',   label: '30 days'},
]

const TOPIC_BUTTONS: { id: TopicType; label: string; icon: React.ReactNode }[] = [
  { id: 'viral',      label: "Today's Trending", icon: <TrendingUp size={13} strokeWidth={1.5} />    },
  { id: 'evergreen',  label: 'Evergreen',         icon: <Leaf size={13} strokeWidth={1.5} />          },
  { id: 'news',       label: 'News',              icon: <Newspaper size={13} strokeWidth={1.5} />     },
  { id: 'custom',     label: 'Custom',            icon: <Pen size={13} strokeWidth={1.5} />           },
]

const COMPETITION_COLOR: Record<string, string> = {
  low:    'text-[#16A34A]',
  medium: 'text-[#D97706]',
  high:   'text-[#DC2626]',
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#16A34A' : score >= 50 ? '#D97706' : '#DC2626'
  return (
    <span
      className="inline-flex items-center justify-center w-9 h-9 rounded-full text-[12px] font-bold flex-shrink-0"
      style={{ background: `${color}14`, color }}
    >
      {score}
    </span>
  )
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({
  idea,
  onSelect,
  onBookmark,
  bookmarked,
  onAddToQueue,
  queued,
}: {
  idea: TopicIdea
  onSelect: (idea: TopicIdea) => void
  onBookmark: (id: string) => void
  bookmarked: boolean
  onAddToQueue: (idea: TopicIdea) => void
  queued: boolean
}) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 hover:border-[#D4D4D4] hover:shadow-dropdown transition-all group">
      <div className="flex items-start gap-3">
        <ScoreBadge score={idea.score} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-[#0A0A0A] leading-snug mb-1">{idea.topic}</p>
          <p className="text-[12px] text-[#525252] leading-relaxed mb-3">{idea.angle}</p>

          <div className="flex items-center gap-3 mb-3">
            <span className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide bg-[#F5F5F5] px-2 py-0.5 rounded">
              {idea.type}
            </span>
            <span className="text-[11px] text-[#A3A3A3]">CPM {idea.cpmEstimate}</span>
            <span className={`text-[11px] font-medium capitalize ${COMPETITION_COLOR[idea.competition]}`}>
              {idea.competition} competition
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onSelect(idea)}
              className="flex items-center gap-1.5 h-7 px-3 bg-[#0A0A0A] text-white text-[11px] font-medium rounded hover:bg-[#262626] transition-colors"
            >
              Use this topic <ChevronRight size={11} strokeWidth={1.5} />
            </button>
            <button
              onClick={() => onAddToQueue(idea)}
              disabled={queued}
              className={`flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium rounded border transition-colors disabled:cursor-default ${
                queued
                  ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
                  : 'border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4] hover:text-[#0A0A0A]'
              }`}
              title={queued ? 'Already in queue' : 'Add to Queue'}
            >
              {queued
                ? <><Check size={10} strokeWidth={2.5} /> Queued</>
                : <><ListPlus size={10} strokeWidth={1.5} /> Queue</>
              }
            </button>
            <button
              onClick={() => onBookmark(idea.id)}
              className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
              title={bookmarked ? 'Remove from watchlist' : 'Save to watchlist'}
            >
              {bookmarked
                ? <BookmarkCheck size={12} strokeWidth={1.5} className="text-[#0A0A0A]" />
                : <Bookmark size={12} strokeWidth={1.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function DetailPanel({ idea, onUse }: { idea: TopicIdea; onUse: () => void }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 sticky top-4">
      <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-3">Selected Topic</p>
      <p className="text-[14px] font-semibold text-[#0A0A0A] mb-4 leading-snug">{idea.topic}</p>

      {[
        { label: 'Hook',            value: idea.hook          },
        { label: 'Thumbnail text',  value: idea.thumbnailText },
        { label: 'Shorts angle',    value: idea.shortsAngle   },
      ].map(({ label, value }) => (
        <div key={label} className="mb-4">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">{label}</p>
          <p className="text-[12px] text-[#525252] leading-relaxed">{value}</p>
        </div>
      ))}

      <button
        onClick={onUse}
        className="w-full h-9 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors flex items-center justify-center gap-2"
      >
        Continue to Script <ChevronRight size={13} strokeWidth={1.5} />
      </button>
    </div>
  )
}

// ─── Mock topic generator (fallback when API not available) ───────────────────

function buildMockTopics(type: TopicType, channel: string): TopicIdea[] {
  const bases = {
    viral:     ['10 AI Tools That Will Replace Your Job in 2026', 'Why Everyone Is Quitting Social Media', 'The Brutal Truth About Online Business'],
    evergreen: ['How to Build a Morning Routine That Actually Works', 'The Science of Getting Rich', 'Why Most People Never Achieve Their Goals'],
    news:      ['Breaking: New AI Model Beats GPT-5 on Every Benchmark', 'YouTube Changes Its Algorithm Again — What You Need to Know', 'Tech Layoffs 2026: The Real Reason Behind the Cuts'],
    custom:    ['Your Custom Topic Here — Type in the box below', 'Untapped Niche: Nobody Is Talking About This', 'Deep Dive: The Subject Your Audience Actually Wants'],
  }
  return bases[type].map((topic, i) => ({
    id:            `mock-${type}-${i}`,
    topic,
    score:         [82, 71, 65][i] ?? 60,
    type,
    angle:         'A compelling angle that hooks viewers in the first 5 seconds and delivers high retention throughout.',
    hook:          "Did you know that 90% of people who try this fail? Here's the one thing that actually works...",
    thumbnailText: topic.split(':')[0].toUpperCase().slice(0, 30),
    shortsAngle:   `Quick version: ${topic.slice(0, 50)}...`,
    cpmEstimate:   ['$8–12', '$12–18', '$6–10'][i] ?? '$8–12',
    competition:   (['low', 'medium', 'high'][i] ?? 'medium') as 'low' | 'medium' | 'high',
  }))
}

// ─── Ideas Page ───────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const user      = useAuthStore((s) => s.user)
  const { selectTopic, setChannel, channelSlug, contentType, setContentType, setStep } = useCreateStore()
  const { data: channels = [] } = useChannels()

  const [topicType,   setTopicType]   = useState<TopicType>('viral')
  const [recency,     setRecency]     = useState<RecencyOption>('7d')
  const [ideas,       setIdeas]       = useState<TopicIdea[]>([])
  const [panelTopic,  setPanelTopic]  = useState<TopicIdea | null>(null)
  const [bookmarks,   setBookmarks]   = useState<Set<string>>(new Set())
  const [queued,      setQueued]      = useState<Set<string>>(new Set())
  const [customTopic, setCustomTopic] = useState('')

  // Persist bookmarks to localStorage, keyed by user so they survive reload
  const _bmKey = `vidora_bookmarks_${user?.id ?? 'anon'}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(_bmKey)
      if (raw) setBookmarks(new Set(JSON.parse(raw)))
    } catch {}
  }, [_bmKey])

  useEffect(() => {
    try {
      localStorage.setItem(_bmKey, JSON.stringify([...bookmarks]))
    } catch {}
  }, [bookmarks, _bmKey])

  // Fetch ideas via API (falls back to mock only when the endpoint is
  // genuinely unreachable — real API errors, e.g. 402 Payment Required when
  // no BYOK/Anthropic key is configured, are surfaced to the user instead of
  // being silently replaced with fake placeholder topics).
  const generateMutation = useMutation({
    mutationFn: async () => {
      let result: any
      try {
        result = await aiApi.trending({
          channel_slug:  channelSlug || undefined,
          recency,
          content_type:  contentType,
          count:         9,
        })
      } catch (err: any) {
        // Only fall back to mock data when the request never reached a real
        // API response (e.g. endpoint not wired / network failure). A real
        // HTTP error response (401/402/403/500...) means the backend is
        // there and rejected the request for a real reason — surface it.
        if (err?.response) throw err
        return buildMockTopics(topicType, channelSlug)
      }
      // Normalise API response shape (backend may return {topics: [...]} or just [...])
      const raw: any[] = Array.isArray(result) ? result : (result.topics ?? [])
      if (!raw.length) return buildMockTopics(topicType, channelSlug)
      return raw.map((t: any, i: number): TopicIdea => ({
        id:            t.id ?? `api-${i}`,
        topic:         t.topic ?? t.title ?? t.text ?? String(t),
        score:         t.score ?? t.viral_score ?? 70,
        type:          t.type ?? topicType,
        angle:         t.angle ?? t.description ?? '',
        hook:          t.hook ?? '',
        thumbnailText: t.thumbnail_text ?? t.thumbnail ?? (t.topic ?? '').slice(0, 30),
        shortsAngle:   t.shorts_angle ?? t.short_angle ?? '',
        cpmEstimate:   t.cpm_estimate ?? t.cpm ?? '$8–12',
        competition:   t.competition ?? 'medium',
      }))
    },
    onSuccess: (data) => {
      setIdeas(data)
      if (data.length) setPanelTopic(data[0])
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Failed to generate ideas')
    },
  })

  const handleSelect = useCallback((idea: TopicIdea) => {
    setPanelTopic(idea)
  }, [])

  const handleUse = useCallback((idea: TopicIdea) => {
    selectTopic(idea)
    setStep(2)
    navigate('/app/create/script')
  }, [selectTopic, setStep, navigate])

  const handleAddToQueue = useCallback(async (idea: TopicIdea) => {
    try {
      await queueApi.add(idea.topic, channelSlug || undefined)
      setQueued((prev) => new Set([...prev, idea.id]))
      toast.success(`"${idea.topic.slice(0, 45)}${idea.topic.length > 45 ? '…' : ''}" added to queue`)
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? 'Failed to add to queue')
    }
  }, [channelSlug, toast])

  const handleCustomSubmit = () => {
    if (!customTopic.trim()) return
    const idea: TopicIdea = {
      id:            `custom-${Date.now()}`,
      topic:         customTopic.trim(),
      score:         0,
      type:          'custom',
      angle:         'Your custom topic — script will be tailored to your exact vision.',
      hook:          '',
      thumbnailText: customTopic.trim().slice(0, 30).toUpperCase(),
      shortsAngle:   '',
      cpmEstimate:   'N/A',
      competition:   'medium',
    }
    handleUse(idea)
  }

  const toggleBookmark = (id: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Ideas</h1>
        <p className="text-[13px] text-[#525252] mt-0.5">Generate and score video topic ideas for your channel.</p>
      </div>

      {/* Config bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5 p-4 bg-white border border-[#E5E5E5] rounded-lg">
        {/* Channel selector */}
        <div className="flex items-center gap-2">
          <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Channel</label>
          <select
            value={channelSlug}
            onChange={(e) => setChannel(e.target.value)}
            className="h-7 pl-2 pr-6 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
          >
            <option value="">Any channel</option>
            {channels.map((ch: any) => (
              <option key={ch.slug} value={ch.slug}>{ch.name ?? ch.slug}</option>
            ))}
          </select>
        </div>

        <div className="w-px h-5 bg-[#E5E5E5]" />

        {/* Content type */}
        <div className="flex items-center gap-1.5">
          {(['longform', 'short', 'kids'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setContentType(t)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded capitalize transition-colors ${
                contentType === t
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#525252] hover:bg-[#F5F5F5]'
              }`}
            >
              {t === 'longform' ? 'Long-form' : t === 'short' ? 'Shorts' : 'Kids'}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-[#E5E5E5]" />

        {/* Recency */}
        <div className="flex items-center gap-1.5">
          {RECENCY_OPTIONS.map((r) => (
            <button
              key={r.id}
              onClick={() => setRecency(r.id)}
              className={`h-7 px-2.5 text-[11px] font-medium rounded transition-colors ${
                recency === r.id
                  ? 'bg-[#0A0A0A] text-white'
                  : 'text-[#525252] hover:bg-[#F5F5F5]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick-launch topic type buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        {TOPIC_BUTTONS.map((btn) => (
          <button
            key={btn.id}
            onClick={() => {
              setTopicType(btn.id)
              if (btn.id !== 'custom') generateMutation.mutate()
            }}
            className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded border transition-colors ${
              topicType === btn.id
                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4] hover:text-[#0A0A0A]'
            }`}
          >
            {btn.icon} {btn.label}
          </button>
        ))}

        {ideas.length > 0 && (
          <button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#D4D4D4] hover:text-[#0A0A0A] transition-colors disabled:opacity-40 ml-auto"
          >
            <RefreshCw size={12} strokeWidth={1.5} className={generateMutation.isPending ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {/* Custom topic input */}
      {topicType === 'custom' && (
        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
            placeholder="Enter your topic idea…"
            autoFocus
            className="flex-1 h-9 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
          <button
            onClick={handleCustomSubmit}
            disabled={!customTopic.trim()}
            className="h-9 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <ChevronRight size={13} strokeWidth={1.5} /> Use this
          </button>
        </div>
      )}

      {/* Loading state */}
      {generateMutation.isPending && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[1,2,3,4,5,6].map((i) => (
            <div key={i} className="bg-white border border-[#E5E5E5] rounded-lg p-4 h-[148px] animate-pulse">
              <div className="flex gap-3">
                <div className="w-9 h-9 rounded-full bg-[#F5F5F5]" />
                <div className="flex-1 space-y-2 pt-1">
                  <div className="h-3 bg-[#F5F5F5] rounded w-3/4" />
                  <div className="h-3 bg-[#F5F5F5] rounded w-full" />
                  <div className="h-3 bg-[#F5F5F5] rounded w-2/3" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state — prompt to generate */}
      {!generateMutation.isPending && ideas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Sparkles size={32} strokeWidth={1} className="text-[#D4D4D4] mb-4" />
          <p className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Generate topic ideas</p>
          <p className="text-[13px] text-[#525252] mb-6 max-w-xs">
            Pick a category above and click to generate AI-scored topic ideas for your channel.
          </p>
          <button
            onClick={() => generateMutation.mutate()}
            className="h-9 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors flex items-center gap-2"
          >
            <Sparkles size={13} strokeWidth={1.5} />
            Generate Ideas
          </button>
        </div>
      )}

      {/* Results grid + detail panel */}
      {!generateMutation.isPending && ideas.length > 0 && (
        <div className="flex gap-5">
          {/* Grid — 60% */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
                {ideas.length} ideas · {topicType}
              </p>
              <div className="flex items-center gap-3">
                {queued.size > 0 && (
                  <span className="text-[11px] text-[#16A34A] font-medium">{queued.size} queued</span>
                )}
                {bookmarks.size > 0 && (
                  <span className="text-[11px] text-[#525252]">{bookmarks.size} saved</span>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {ideas.map((idea) => (
                <TopicCard
                  key={idea.id}
                  idea={idea}
                  onSelect={handleSelect}
                  onBookmark={toggleBookmark}
                  bookmarked={bookmarks.has(idea.id)}
                  onAddToQueue={handleAddToQueue}
                  queued={queued.has(idea.id)}
                />
              ))}
            </div>
          </div>

          {/* Detail panel — 280px */}
          {panelTopic && (
            <div className="w-[280px] flex-shrink-0">
              <DetailPanel
                idea={panelTopic}
                onUse={() => handleUse(panelTopic)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
