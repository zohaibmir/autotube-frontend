import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ChevronLeft, RefreshCw, Loader2, ExternalLink, CheckCircle2,
  XCircle, AlertCircle, Wand2, Wrench, Video, BarChart2, KeyRound, ShieldCheck,
  ImageIcon, Film, Upload, Search, Sparkles, Type,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useChannels } from '@hooks/useJobs'
import { channelOpsApi, analyticsApi, channelsApi, brandingApi, channelProfilesApi } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
      <div className="px-5 py-3 border-b border-[#E5E5E5] bg-[#FAFAFA]">
        <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{title}</p>
      </div>
      {children}
    </div>
  )
}

// ─── Video Defaults panel (per-channel visual source / art style / captions) ──

const _ART_STYLE_OPTIONS = [
  { id: 'anime',          label: 'Anime Dream',      bestFor: 'anime, fantasy & action' },
  { id: 'comic',          label: 'Comic Pop',        bestFor: 'bold storytelling & drama' },
  { id: 'watercolor',     label: 'Soft Watercolor',  bestFor: 'calm, reflective topics' },
  { id: 'photorealistic', label: 'Cinematic Real',   bestFor: 'history & documentary' },
  { id: 'storybook',      label: 'Storybook Magic',  bestFor: 'kids & wholesome content' },
  { id: 'gothic',         label: 'Midnight Gothic',  bestFor: 'horror & mystery' },
]

function VideoDefaultsPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['channel-profile', slug],
    queryFn: () => channelProfilesApi.get(slug),
    staleTime: 30_000,
  })
  const profile = data?.profile ?? {}

  const [visualSource, setVisualSource] = useState<string>('stock')
  const [artStyle, setArtStyle] = useState<string>('')
  const [captionsEnabled, setCaptionsEnabled] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  if (!isLoading && !hydrated && data) {
    setVisualSource(profile.default_visual_source || 'stock')
    setArtStyle(profile.default_art_style || '')
    setCaptionsEnabled(profile.captions_enabled !== false)
    setHydrated(true)
  }

  const save = useMutation({
    mutationFn: (fields: Parameters<typeof channelProfilesApi.update>[1]) =>
      channelProfilesApi.update(slug, fields),
    onSuccess: () => {
      toast.success('Video defaults saved')
      queryClient.invalidateQueries({ queryKey: ['channel-profile', slug] })
    },
    onError: () => toast.error('Save failed - try again'),
  })

  return (
    <SectionCard title="Video Defaults">
      <div className="px-5 py-4 space-y-4">
        <p className="text-[11px] text-[#A3A3A3] -mt-1">
          Defaults for new videos on this channel. Can still be overridden per-video in the Visuals step.
        </p>

        {/* Default visual source */}
        <div>
          <p className="text-[11px] font-medium text-[#525252] mb-2">Default video source</p>
          <div className="flex gap-2">
            {[
              { id: 'stock', label: 'Stock', icon: <Film size={12} strokeWidth={1.5} /> },
              { id: 'custom_video', label: 'Custom video', icon: <Upload size={12} strokeWidth={1.5} /> },
              { id: 'ai_image', label: 'AI images', icon: <Sparkles size={12} strokeWidth={1.5} /> },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setVisualSource(opt.id)}
                className={[
                  'flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-medium rounded border transition-colors',
                  visualSource === opt.id
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4]',
                ].join(' ')}
              >
                {opt.icon} {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Default art style (only relevant when AI images is the default) */}
        {visualSource === 'ai_image' && (
          <div>
            <p className="text-[11px] font-medium text-[#525252] mb-2">Default art style</p>
            <select
              value={artStyle}
              onChange={(e) => setArtStyle(e.target.value)}
              className="h-8 px-2 text-[12px] border border-[#E5E5E5] rounded bg-white text-[#0A0A0A]"
            >
              <option value="">Choose per video</option>
              {_ART_STYLE_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>{s.label} — {s.bestFor}</option>
              ))}
            </select>
          </div>
        )}

        {/* Captions toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F5F5F5]">
          <div className="flex items-center gap-1.5">
            <Type size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span className="text-[12px] font-medium text-[#0A0A0A]">Burned-in captions</span>
          </div>
          <button
            onClick={() => setCaptionsEnabled((v) => !v)}
            className={[
              'h-[20px] w-[36px] rounded-full transition-colors relative flex-shrink-0',
              captionsEnabled ? 'bg-[#16A34A]' : 'bg-[#D4D4D4]',
            ].join(' ')}
          >
            <span
              className={[
                'absolute top-[2px] w-[16px] h-[16px] bg-white rounded-full transition-transform shadow-sm',
                captionsEnabled ? 'translate-x-[18px]' : 'translate-x-[2px]',
              ].join(' ')}
            />
          </button>
        </div>

        <button
          onClick={() => save.mutate({
            default_visual_source: visualSource,
            default_art_style: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
            captions_enabled: captionsEnabled,
          })}
          disabled={save.isPending}
          className="h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          {save.isPending ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : null}
          Save defaults
        </button>
      </div>
    </SectionCard>
  )
}

function ScoreBadge({ score }: { score?: number | null }) {
  if (score == null) return <span className="text-[#A3A3A3] text-[12px]">—</span>
  const color = score >= 80 ? 'text-[#16A34A]' : score >= 50 ? 'text-[#D97706]' : 'text-[#DC2626]'
  return <span className={`text-[13px] font-semibold ${color}`}>{score}/100</span>
}

function AuditRow({ label, value, status }: { label: string; value?: string; status?: 'ok' | 'warn' | 'error' | null }) {
  const icon = status === 'ok'
    ? <CheckCircle2 size={12} strokeWidth={1.5} className="text-[#16A34A]" />
    : status === 'warn'
    ? <AlertCircle size={12} strokeWidth={1.5} className="text-[#D97706]" />
    : status === 'error'
    ? <XCircle size={12} strokeWidth={1.5} className="text-[#DC2626]" />
    : null

  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-[#F5F5F5] last:border-b-0">
      <div className="w-4 flex-shrink-0 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[#0A0A0A]">{label}</p>
        {value && <p className="text-[11px] text-[#A3A3A3] mt-0.5 truncate">{value}</p>}
      </div>
    </div>
  )
}

// ─── Audit panel ─────────────────────────────────────────────────────────────

function AuditPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['channel-audit', slug],
    queryFn: () => channelOpsApi.audit(slug),
    staleTime: 5 * 60_000,
    retry: false,
  })

  const fixAll = useMutation({
    mutationFn: () => channelOpsApi.fixAll(slug),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success(`Fixed ${res.fixed ?? 0} videos`)
        queryClient.invalidateQueries({ queryKey: ['channel-audit', slug] })
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Fix all failed')
      }
    },
    onError: () => toast.error('Fix all failed'),
  })

  if (isLoading) return (
    <SectionCard title="SEO Audit">
      <div className="space-y-1 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#F5F5F5] rounded animate-pulse" />
        ))}
      </div>
    </SectionCard>
  )

  const audit = data?.audit ?? data ?? {}
  const issues: any[] = audit.issues ?? []
  const score = audit.score ?? null
  const hasIssues = issues.length > 0

  return (
    <SectionCard title="SEO Audit">
      {/* Score + actions row */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#F5F5F5]">
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#A3A3A3]">Overall score</span>
          <ScoreBadge score={score} />
        </div>
        <div className="flex items-center gap-2">
          {hasIssues && (
            <button
              onClick={() => fixAll.mutate()}
              disabled={fixAll.isPending}
              className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {fixAll.isPending
                ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                : <Wrench size={11} strokeWidth={1.5} />
              }
              Fix all
            </button>
          )}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh channel data"
            className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
          >
            <RefreshCw size={11} strokeWidth={1.5} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {data?.ok === false && (
        <div className="px-5 py-4 text-[12px] text-[#DC2626] bg-[#FFF1F2]">
          {data.error ?? 'Audit failed'}
        </div>
      )}

      {issues.length === 0 && data?.ok !== false && (
        <div className="px-5 py-8 text-center text-[12px] text-[#A3A3A3]">
          <CheckCircle2 size={20} strokeWidth={1.5} className="text-[#16A34A] mx-auto mb-2" />
          No issues found
        </div>
      )}

      {issues.map((issue: any, i: number) => (
        <AuditRow
          key={i}
          label={issue.message ?? issue.title ?? issue.type ?? JSON.stringify(issue)}
          value={issue.detail ?? issue.video_title ?? undefined}
          status={issue.severity === 'error' ? 'error' : issue.severity === 'warn' ? 'warn' : 'ok'}
        />
      ))}
    </SectionCard>
  )
}

// ─── AI Coach panel ───────────────────────────────────────────────────────────

function AICoachPanel({ slug }: { slug: string }) {
  const toast = useToast()

  const coach = useMutation({
    mutationFn: () => channelOpsApi.auditCoach(slug),
    onError: () => toast.error('AI coaching failed'),
  })

  const result = coach.data
  const priorities: any[] = result?.priorities ?? []

  return (
    <SectionCard title="AI Coach">
      <div className="px-5 py-4">
        {!coach.data && !coach.isPending && (
          <div className="text-center py-4">
            <Wand2 size={20} strokeWidth={1.5} className="text-[#D4D4D4] mx-auto mb-2" />
            <p className="text-[12px] text-[#525252] mb-3">
              Get a plain-English read on this channel's health and prioritized, channel-specific next steps - not just a checklist.
            </p>
            <button
              onClick={() => coach.mutate()}
              className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors inline-flex items-center gap-1.5"
            >
              <Wand2 size={11} strokeWidth={1.5} />
              Get AI coaching
            </button>
          </div>
        )}

        {coach.isPending && (
          <div className="space-y-2 py-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-8 bg-[#F5F5F5] rounded animate-pulse" />
            ))}
          </div>
        )}

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] -mx-5 -my-4 px-5 py-4">
            {result.error ?? 'AI coaching failed'}
          </div>
        )}

        {result?.ok && (
          <div className="space-y-4">
            <p className="text-[12px] text-[#0A0A0A] leading-relaxed">{result.summary}</p>

            {priorities.length > 0 && (
              <div className="space-y-2.5">
                {priorities.map((p: any, i: number) => (
                  <div key={i} className="border border-[#E5E5E5] rounded-lg p-3">
                    <p className="text-[12px] font-semibold text-[#0A0A0A] mb-1">{i + 1}. {p.title}</p>
                    {p.why && <p className="text-[11px] text-[#525252] mb-1"><span className="font-medium text-[#A3A3A3]">Why:</span> {p.why}</p>}
                    {p.action && <p className="text-[11px] text-[#525252]"><span className="font-medium text-[#A3A3A3]">Do:</span> {p.action}</p>}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => coach.mutate()}
              disabled={coach.isPending}
              className="h-6 px-2.5 text-[10px] font-medium border border-[#E5E5E5] rounded text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors inline-flex items-center gap-1"
            >
              <RefreshCw size={9} strokeWidth={1.5} />
              Regenerate
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Competitor Benchmark panel ────────────────────────────────────────────────

function BenchmarkPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [compareValue, setCompareValue] = useState('')

  const benchmark = useMutation({
    mutationFn: (compare: string) => channelOpsApi.benchmark(compare, slug),
    onError: () => toast.error('Benchmark failed'),
  })

  const result = benchmark.data
  const mine = result?.your_channel
  const theirs = result?.compared_channel

  const fmtNum = (n?: number) => n == null ? '—' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : String(n)

  return (
    <SectionCard title="Competitor Benchmark">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">Compare your channel against any public YouTube channel - paste a handle, URL, or channel ID.</p>
        <div className="flex gap-2">
          <input
            value={compareValue}
            onChange={(e) => setCompareValue(e.target.value)}
            placeholder="@channelname or youtube.com/@channelname"
            className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <button
            onClick={() => compareValue.trim() && benchmark.mutate(compareValue.trim())}
            disabled={benchmark.isPending || !compareValue.trim()}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {benchmark.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <BarChart2 size={11} strokeWidth={1.5} />}
            Compare
          </button>
        </div>

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">
            {result.error ?? 'Benchmark failed'}
          </div>
        )}

        {result?.ok && mine && theirs && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Channel', mine: mine.title, theirs: theirs.title },
                { label: 'Subscribers', mine: fmtNum(mine.subscribers), theirs: fmtNum(theirs.subscribers) },
                { label: 'Videos', mine: fmtNum(mine.videos), theirs: fmtNum(theirs.videos) },
                { label: 'Total views', mine: fmtNum(mine.views), theirs: fmtNum(theirs.views) },
                { label: 'Avg days/upload', mine: mine.avg_days_between_uploads ?? '—', theirs: theirs.avg_days_between_uploads ?? '—' },
              ].map((row) => (
                <React.Fragment key={row.label}>
                  <div className="text-[11px] text-[#A3A3A3] col-span-2 uppercase tracking-widest pt-1 first:pt-0">{row.label}</div>
                  <div className="text-[12px] text-[#0A0A0A] font-medium -mt-2">{row.mine}</div>
                  <div className="text-[12px] text-[#525252] -mt-2">{row.theirs}</div>
                </React.Fragment>
              ))}
            </div>
            {result.narrative && (
              <p className="text-[12px] text-[#0A0A0A] leading-relaxed border-t border-[#F5F5F5] pt-3 whitespace-pre-line">{result.narrative}</p>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Keyword Clusters panel ────────────────────────────────────────────────────

function KeywordClustersPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [topic, setTopic] = useState('')

  const clusters = useMutation({
    mutationFn: (t: string) => channelOpsApi.keywordClusters(t, slug),
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Keyword lookup failed')
    },
  })

  const result = clusters.data
  const competitionColor = (level: string) =>
    level === 'low' ? 'text-[#16A34A] bg-[#F0FDF4] border-[#BBF7D0]'
    : level === 'high' ? 'text-[#BE123C] bg-[#FFF1F2] border-[#FECDD3]'
    : 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]'

  return (
    <SectionCard title="Keyword Clusters">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">
          Enter a video topic - we'll pull real top-ranking titles and YouTube's own approximate
          result count for a few real search phrases, then group them by intent with a recommendation.
          Limited to 5 lookups/hour (each one uses real YouTube API quota).
        </p>
        <div className="flex gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. how to save money as a student"
            className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <button
            onClick={() => topic.trim() && clusters.mutate(topic.trim())}
            disabled={clusters.isPending || !topic.trim()}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {clusters.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <Search size={11} strokeWidth={1.5} />}
            Analyze
          </button>
        </div>

        {result && !result.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">
            {result.error ?? 'Keyword lookup failed'}
          </div>
        )}

        {result?.ok && (result.clusters || []).length > 0 && (
          <div className="space-y-3">
            {result.clusters.map((c: any, i: number) => (
              <div key={i} className="border border-[#F5F5F5] rounded-md p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[12px] font-semibold text-[#0A0A0A]">{c.name}</p>
                  <span className={`text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded border ${competitionColor(c.competition)}`}>
                    {c.competition} competition
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {(c.keywords || []).map((k: string) => (
                    <span key={k} className="text-[10px] text-[#525252] bg-[#FAFAFA] border border-[#E5E5E5] rounded px-1.5 py-0.5">{k}</span>
                  ))}
                </div>
                <p className="text-[11px] text-[#525252] leading-relaxed">{c.recommendation}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── Rank Tracking panel ───────────────────────────────────────────────────────

function RankTrackingPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const [videoId, setVideoId] = useState('')
  const [keyword, setKeyword] = useState('')

  const check = useMutation({
    mutationFn: () => channelOpsApi.rankCheck(videoId.trim(), keyword.trim(), slug),
    onSuccess: () => {
      history.refetch()
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Rank check failed')
    },
  })

  const history = useQuery({
    queryKey: ['rank-history', videoId, keyword],
    queryFn: () => channelOpsApi.rankHistory(videoId.trim(), keyword.trim()),
    enabled: false, // only fetch on demand - refetched after a successful check
  })

  const narrative = useMutation({
    mutationFn: () => channelOpsApi.rankNarrative(videoId.trim(), keyword.trim()),
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not explain rank movement')
    },
  })

  const canQuery = videoId.trim().length > 0 && keyword.trim().length > 0
  const historyRows = history.data?.history || []

  return (
    <SectionCard title="Rank Tracking">
      <div className="px-5 py-4 space-y-3">
        <p className="text-[12px] text-[#525252]">
          Track where one of your videos ranks in real YouTube search results for a keyword over time.
          Each check is a real search - history builds as you check again later. Limited to 5 checks/hour.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={videoId}
            onChange={(e) => setVideoId(e.target.value)}
            placeholder="Video ID (from the video's URL)"
            className="h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Keyword to track"
            className="h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => canQuery && check.mutate()}
            disabled={check.isPending || !canQuery}
            className="h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
          >
            {check.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <BarChart2 size={11} strokeWidth={1.5} />}
            Check rank now
          </button>
          <button
            onClick={() => canQuery && narrative.mutate()}
            disabled={narrative.isPending || !canQuery}
            className="h-7 px-3 text-[11px] font-medium border border-[#E5E5E5] text-[#0A0A0A] rounded hover:border-[#A3A3A3] disabled:opacity-40 transition-colors"
          >
            {narrative.isPending ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin inline" /> : null} Explain movement
          </button>
        </div>

        {check.data && !check.data.ok && (
          <div className="text-[12px] text-[#DC2626] bg-[#FFF1F2] rounded px-3 py-2">{check.data.error}</div>
        )}
        {check.data?.ok && (
          <div className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] rounded px-3 py-2">
            {check.data.rank
              ? <>Rank <strong>#{check.data.rank}</strong> of {check.data.checked_out_of} scanned</>
              : <>Not found in the top {check.data.checked_out_of} results</>}
            <span className="text-[#A3A3A3]"> · ~{check.data.total_results_estimate?.toLocaleString()} results (approximate)</span>
          </div>
        )}

        {narrative.data && !narrative.data.ok && (
          <div className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">{narrative.data.error}</div>
        )}
        {narrative.data?.ok && (
          <p className="text-[12px] text-[#0A0A0A] leading-relaxed border-t border-[#F5F5F5] pt-3">{narrative.data.narrative}</p>
        )}

        {historyRows.length > 0 && (
          <div className="pt-2 border-t border-[#F5F5F5]">
            <p className="text-[11px] text-[#A3A3A3] uppercase tracking-widest mb-1.5">History</p>
            <div className="space-y-1">
              {historyRows.map((h: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-[11px] text-[#525252]">
                  <span>{new Date(h.checked_at).toLocaleString()}</span>
                  <span className="font-medium text-[#0A0A0A]">{h.rank ? `#${h.rank}` : 'not found'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  )
}

// ─── OAuth Diagnostics panel ──────────────────────────────────────────────────

function OAuthDiagnosticsPanel() {
  const [open, setOpen] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['oauth-diagnostics'],
    queryFn: () => channelsApi.oauthDiagnostics(),
    enabled: open,
    staleTime: 60_000,
    retry: false,
  })

  const diag = data ?? {}
  const tips: string[] = diag.tips ?? []
  const channels: any[] = diag.channels ?? []

  return (
    <SectionCard title="YouTube Auth">
      <div className="px-5 py-3.5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <KeyRound size={13} strokeWidth={1.5} className="text-[#525252]" />
            <span className="text-[12px] font-medium text-[#0A0A0A]">OAuth Diagnostics</span>
          </div>
          <div className="flex items-center gap-1.5">
            {open && (
              <button
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label="Refresh OAuth diagnostics"
                className="h-6 w-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
              >
                <RefreshCw size={10} strokeWidth={1.5} className={isFetching ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={() => setOpen(v => !v)}
              className="h-6 px-2.5 text-[10px] font-medium border border-[#E5E5E5] rounded text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
            >
              {open ? 'Hide' : 'Run check'}
            </button>
          </div>
        </div>

        {open && (
          <>
            {isLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-6 bg-[#F5F5F5] rounded animate-pulse" />)}
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Credential status */}
                <div className="space-y-1.5">
                  {[
                    ['Web Client ID', diag.web_client_id?.present, diag.web_client_id?.masked],
                    ['Web Client Secret', diag.web_client_secret?.present, undefined],
                    ['client_secrets.json', diag.desktop_client_secrets?.exists, diag.desktop_client_secrets?.path],
                  ].map(([label, ok, detail]) => (
                    <div key={label as string} className="flex items-center gap-2">
                      {ok
                        ? <CheckCircle2 size={11} strokeWidth={1.5} className="text-[#16A34A] shrink-0" />
                        : <XCircle size={11} strokeWidth={1.5} className="text-[#DC2626] shrink-0" />
                      }
                      <span className="text-[11px] text-[#0A0A0A]">{label as string}</span>
                      {detail && <span className="text-[10px] text-[#A3A3A3] font-mono truncate">{detail as string}</span>}
                    </div>
                  ))}
                </div>

                {/* Channel token status */}
                {channels.length > 0 && (
                  <div className="border border-[#F5F5F5] rounded overflow-hidden mt-3">
                    {channels.map((ch: any) => {
                      // `has_token` only means a token *file* exists on disk - it
                      // doesn't mean Google still honors it. Use auth_status (the
                      // same field the Channels list page uses) so this panel
                      // doesn't claim "Token OK" for a revoked/expired channel.
                      const isOk = ch.auth_status ? ch.auth_status === 'ok' : ch.has_token
                      const label = ch.auth_status === 'revoked' ? 'Revoked'
                        : ch.auth_status === 'missing' ? 'No token'
                        : ch.auth_status === 'ok' ? 'Token OK'
                        : (ch.has_token ? 'Token OK' : 'No token')
                      return (
                        <div key={ch.slug} className="flex items-center gap-2 px-3 py-2 border-b border-[#F5F5F5] last:border-b-0" title={ch.auth_message || undefined}>
                          {isOk
                            ? <ShieldCheck size={11} strokeWidth={1.5} className="text-[#16A34A] shrink-0" />
                            : <XCircle size={11} strokeWidth={1.5} className="text-[#DC2626] shrink-0" />
                          }
                          <span className="text-[11px] text-[#0A0A0A] font-medium truncate flex-1">{ch.name || ch.slug}</span>
                          <span className={`text-[10px] font-medium ${isOk ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
                            {label}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Tips */}
                {tips.length > 0 && (
                  <div className="mt-2.5 space-y-1.5">
                    {tips.map((tip, i) => (
                      <div key={i} className="flex items-start gap-1.5">
                        <AlertCircle size={10} strokeWidth={1.5} className="text-[#D97706] mt-0.5 shrink-0" />
                        <p className="text-[10px] text-[#525252]">{tip}</p>
                      </div>
                    ))}
                  </div>
                )}

                {tips.length === 0 && channels.every((c: any) => c.has_token) && (
                  <p className="text-[11px] text-[#16A34A] flex items-center gap-1.5 mt-1">
                    <CheckCircle2 size={11} strokeWidth={1.5} /> All credentials look good
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </SectionCard>
  )
}

// ─── SEO suggest panel ────────────────────────────────────────────────────────

function BrandingPanel({ slug, channel }: { slug: string; channel: any }) {
  const toast = useToast()
  const queryClient = useQueryClient()

  // ── SEO sub-state ────────────────────────────────────────────────────────
  const [seoSuggestions, setSeoSuggestions] = useState<{ description?: string; keywords?: string } | null>(null)
  const [seoApplied, setSeoApplied] = useState(false)

  // ── Visual Assets sub-state ──────────────────────────────────────────────
  const [brandTab,      setBrandTab]      = useState<'seo' | 'visual'>('seo')
  const [channelName,   setChannelName]   = useState<string>(channel?.name ?? slug)
  const [tagline,       setTagline]       = useState<string>(channel?.description?.slice(0, 80) ?? '')
  const [stylePreset,   setStylePreset]   = useState('default')
  const [trailerVideoId, setTrailerVideoId] = useState('')
  const [trailerDone,   setTrailerDone]   = useState(false)
  const [bannerDone,    setBannerDone]    = useState(false)

  const STYLE_PRESETS = ['default', 'dark dramatic', 'minimalist', 'vibrant', 'gradient', 'neon']

  // ── Assets query ─────────────────────────────────────────────────────────
  const assetsQuery = useQuery({
    queryKey: ['branding-assets', slug],
    queryFn:  () => brandingApi.listAssets(slug),
    staleTime: 30_000,
    enabled: brandTab === 'visual',
  })

  const assets = assetsQuery.data?.assets ?? []
  const banner    = assets.find((a) => a.name.includes('banner'))
  const avatar    = assets.find((a) => a.name.includes('avatar'))
  const watermark = assets.find((a) => a.name.includes('watermark'))

  // ── SEO mutations ─────────────────────────────────────────────────────────
  const suggest = useMutation({
    mutationFn: () => channelOpsApi.suggestBranding({
      channel: slug,
      title: channel?.name ?? slug,
      description: channel?.description,
      keywords: channel?.keywords,
    }),
    onSuccess: (res) => {
      if (res?.ok) setSeoSuggestions(res.suggestions)
      else toast.error(res?.error ?? 'Suggest failed')
    },
    onError: () => toast.error('Suggest failed'),
  })

  const apply = useMutation({
    mutationFn: () => channelOpsApi.update({
      channel: slug,
      description: seoSuggestions?.description,
      keywords: seoSuggestions?.keywords,
    }),
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Channel updated'); setSeoApplied(true) }
      else toast.error(res?.error ?? 'Update failed')
    },
    onError: () => toast.error('Update failed'),
  })

  // ── Branding mutations ────────────────────────────────────────────────────
  const generateAssets = useMutation({
    mutationFn: () => brandingApi.generate({
      channel:     slug,
      channelName: channelName.trim() || (channel?.name ?? slug),
      tagline:     tagline.trim(),
      stylePreset,
    }),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success('Branding assets generated')
        queryClient.invalidateQueries({ queryKey: ['branding-assets', slug], exact: false })
      } else {
        toast.error(res?.error ?? 'Generation failed')
      }
    },
    onError: () => toast.error('Generation failed'),
  })

  const uploadBanner = useMutation({
    mutationFn: () => brandingApi.uploadBanner(slug),
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Banner uploaded to YouTube'); setBannerDone(true) }
      else toast.error(res?.error ?? 'Upload failed')
    },
    onError: () => toast.error('Banner upload failed'),
  })

  const setTrailer = useMutation({
    mutationFn: () => {
      if (!trailerVideoId.trim()) throw new Error('Enter a YouTube Video ID')
      return brandingApi.setTrailer(trailerVideoId.trim(), slug)
    },
    onSuccess: (res) => {
      if (res?.ok) { toast.success('Channel trailer set'); setTrailerDone(true) }
      else toast.error(res?.error ?? 'Set trailer failed')
    },
    onError: (err: any) => toast.error(err?.message ?? 'Set trailer failed'),
  })

  return (
    <SectionCard title="Branding">
      {/* Tab strip */}
      <div className="flex border-b border-[#E5E5E5]">
        {(['seo', 'visual'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setBrandTab(tab)}
            className={`flex-1 py-2 text-[11px] font-medium transition-colors ${
              brandTab === tab
                ? 'text-[#0A0A0A] border-b-2 border-[#0A0A0A] -mb-px bg-white'
                : 'text-[#A3A3A3] hover:text-[#525252]'
            }`}
          >
            {tab === 'seo' ? 'SEO Copy' : 'Visual Assets'}
          </button>
        ))}
      </div>

      {/* SEO Tab */}
      {brandTab === 'seo' && (
        <div className="px-5 py-4 space-y-3">
          <p className="text-[12px] text-[#525252]">
            Generate an SEO-optimised description and keyword set using AI, then apply it directly to the channel.
          </p>
          {!seoSuggestions ? (
            <button
              onClick={() => suggest.mutate()}
              disabled={suggest.isPending}
              className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {suggest.isPending
                ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                : <Wand2 size={11} strokeWidth={1.5} />
              }
              Generate suggestions
            </button>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Description</p>
                <p className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] border border-[#E5E5E5] rounded p-3 whitespace-pre-wrap">{seoSuggestions.description}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Keywords</p>
                <p className="text-[12px] text-[#0A0A0A] bg-[#FAFAFA] border border-[#E5E5E5] rounded p-3">{seoSuggestions.keywords}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => apply.mutate()}
                  disabled={apply.isPending || seoApplied}
                  className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
                >
                  {apply.isPending && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
                  {seoApplied ? 'Applied' : 'Apply to channel'}
                </button>
                <button
                  onClick={() => { setSeoSuggestions(null); setSeoApplied(false) }}
                  className="h-8 px-3 text-[12px] text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#FAFAFA] transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Visual Assets Tab */}
      {brandTab === 'visual' && (
        <div className="px-5 py-4 space-y-4">
          {/* Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Channel Name</p>
              <input
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
              />
            </div>
            <div>
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Style Preset</p>
              <select
                value={stylePreset}
                onChange={(e) => setStylePreset(e.target.value)}
                className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
              >
                {STYLE_PRESETS.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Tagline</p>
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Short tagline displayed on the banner…"
              className="w-full h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
            />
          </div>

          <button
            onClick={() => generateAssets.mutate()}
            disabled={generateAssets.isPending}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
          >
            {generateAssets.isPending
              ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
              : <Wand2 size={11} strokeWidth={1.5} />
            }
            {generateAssets.isPending ? 'Generating…' : 'Generate Assets'}
          </button>

          {/* Asset previews */}
          {assetsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-2">
              <Loader2 size={12} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
              <span className="text-[12px] text-[#A3A3A3]">Loading assets…</span>
            </div>
          ) : assets.length > 0 ? (
            <div className="space-y-3">
              {/* Banner */}
              {banner && (
                <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                  <div className="bg-[#F5F5F5] px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Banner</span>
                    <span className="text-[10px] text-[#A3A3A3]">2160×1080</span>
                  </div>
                  {banner.url && (
                    <div className="aspect-[2/1] bg-[#F5F5F5] overflow-hidden">
                      <img src={banner.url} alt="Channel banner" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="px-3 py-2 flex justify-end">
                    <button
                      onClick={() => { setBannerDone(false); uploadBanner.mutate() }}
                      disabled={uploadBanner.isPending}
                      className="flex items-center gap-1 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
                    >
                      {bannerDone ? (
                        <><CheckCircle2 size={11} strokeWidth={1.5} /> Uploaded</>
                      ) : uploadBanner.isPending ? (
                        <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Uploading…</>
                      ) : (
                        <><Upload size={11} strokeWidth={1.5} /> Upload to YouTube</>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Avatar + Watermark row */}
              <div className="grid grid-cols-2 gap-3">
                {avatar && (
                  <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                    <div className="bg-[#F5F5F5] px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Avatar</span>
                      <span className="text-[10px] text-[#A3A3A3]">800×800</span>
                    </div>
                    {avatar.url && (
                      <div className="aspect-square bg-[#F5F5F5] overflow-hidden">
                        <img src={avatar.url} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                )}
                {watermark && (
                  <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
                    <div className="bg-[#F5F5F5] px-3 py-1.5">
                      <span className="text-[10px] font-medium text-[#525252] uppercase tracking-widest">Watermark</span>
                    </div>
                    {watermark.url && (
                      <div className="aspect-square bg-[#F5F5F5] overflow-hidden flex items-center justify-center p-4">
                        <img src={watermark.url} alt="Watermark" className="max-w-full max-h-full object-contain" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center gap-2 text-center">
              <ImageIcon size={24} strokeWidth={1} className="text-[#D4D4D4]" />
              <p className="text-[12px] text-[#A3A3A3]">No assets yet - click Generate Assets above</p>
            </div>
          )}

          {/* Trailer section */}
          <div className="pt-3 border-t border-[#F5F5F5]">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Channel Trailer</p>
            <p className="text-[11px] text-[#525252] mb-2">Set an existing YouTube video as the channel trailer for non-subscribers.</p>
            <div className="flex gap-2">
              <input
                value={trailerVideoId}
                onChange={(e) => { setTrailerVideoId(e.target.value); setTrailerDone(false) }}
                placeholder="YouTube Video ID…"
                className="flex-1 h-7 px-2.5 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3] font-mono"
              />
              <button
                onClick={() => setTrailer.mutate()}
                disabled={setTrailer.isPending || !trailerVideoId.trim() || trailerDone}
                className="flex items-center gap-1 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {trailerDone ? (
                  <><CheckCircle2 size={11} strokeWidth={1.5} /> Set</>
                ) : setTrailer.isPending ? (
                  <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Setting…</>
                ) : (
                  <><Film size={11} strokeWidth={1.5} /> Set Trailer</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  )
}

// ─── Video history ────────────────────────────────────────────────────────────

function VideosPanel({ slug }: { slug: string }) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data, isLoading } = useQuery({
    queryKey: ['channel-videos', slug],
    queryFn: () => analyticsApi.videos(50),
    staleTime: 60_000,
  })

  const fixVideo = useMutation({
    mutationFn: (videoId: string) => channelOpsApi.fixVideo(videoId, slug),
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success('Video SEO updated')
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Fix failed')
      }
    },
    onError: () => toast.error('Fix failed'),
  })

  const fixSelected = useMutation({
    mutationFn: () => channelOpsApi.fixSelected(Array.from(selected), slug),
    onSuccess: (res) => {
      if (res?.ok) {
        const contentNote = res.content_improved ? `, ${res.content_improved} with AI-improved tags/description` : ''
        toast.success(`Fixed ${res.fixed ?? 0} of ${res.attempted ?? selected.size} selected videos${contentNote}`)
        setSelected(new Set())
        queryClient.invalidateQueries({ queryKey: ['channel-videos', slug] })
      } else {
        toast.error(res?.error ?? 'Bulk fix failed')
      }
    },
    onError: () => toast.error('Bulk fix failed'),
  })

  const allVideos: any[] = Array.isArray(data) ? data : (data?.videos ?? [])
  // Filter to this channel where possible
  const videos = allVideos.filter((v: any) => !v.channel_slug || v.channel_slug === slug).slice(0, 30)
  const fixableIds = videos.map((v: any) => v.youtube_id ?? v.video_id).filter(Boolean)
  const allSelected = fixableIds.length > 0 && fixableIds.every((id: string) => selected.has(id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(fixableIds))
  }
  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (isLoading) return (
    <SectionCard title="Videos">
      <div className="space-y-1 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 bg-[#F5F5F5] rounded animate-pulse" />
        ))}
      </div>
    </SectionCard>
  )

  return (
    <SectionCard title="Videos">
      {selected.size > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5]">
          <span className="text-[11px] font-medium text-[#0A0A0A]">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(new Set())}
              className="h-6 px-2.5 text-[10px] font-medium text-[#525252] hover:text-[#0A0A0A] transition-colors"
            >
              Clear
            </button>
            <button
              onClick={() => fixSelected.mutate()}
              disabled={fixSelected.isPending}
              className="h-6 px-2.5 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors flex items-center gap-1.5"
            >
              {fixSelected.isPending
                ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
                : <Wrench size={10} strokeWidth={1.5} />
              }
              Fix selected ({selected.size})
            </button>
          </div>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="px-5 py-10 text-center text-[12px] text-[#A3A3A3]">
          <Video size={20} strokeWidth={1.5} className="mx-auto mb-2 text-[#D4D4D4]" />
          No videos found for this channel
        </div>
      ) : (
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-[#E5E5E5]">
              <th scope="col" className="w-9 px-4 py-2.5 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Select all videos"
                  className="w-3.5 h-3.5 rounded border-[#D4D4D4] accent-[#0A0A0A]"
                />
              </th>
              {['Title', 'Published', 'Views', 'Status', ''].map((h) => (
                <th key={h} scope="col" className="px-4 py-2.5 text-left text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F5F5F5]">
            {videos.map((v: any) => {
              const ytId = v.youtube_id ?? v.video_id
              return (
              <tr key={ytId ?? v.id} className="hover:bg-[#FAFAFA]">
                <td className="px-4 py-2.5">
                  {ytId && (
                    <input
                      type="checkbox"
                      checked={selected.has(ytId)}
                      onChange={() => toggleOne(ytId)}
                      aria-label={`Select ${v.title ?? v.topic ?? ytId}`}
                      className="w-3.5 h-3.5 rounded border-[#D4D4D4] accent-[#0A0A0A]"
                    />
                  )}
                </td>
                <td className="px-4 py-2.5 max-w-[260px]">
                  <p className="text-[#0A0A0A] truncate font-medium">{v.title ?? v.topic ?? '(no title)'}</p>
                  {ytId && (
                    <a
                      href={`https://youtube.com/watch?v=${ytId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-0.5 mt-0.5"
                    >
                      {ytId} <ExternalLink size={9} strokeWidth={1.5} />
                    </a>
                  )}
                </td>
                <td className="px-4 py-2.5 text-[#A3A3A3] whitespace-nowrap">
                  {v.published_at ? new Date(v.published_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                </td>
                <td className="px-4 py-2.5 text-[#525252]">
                  {v.views != null ? Number(v.views).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-2.5">
                  {v.status ? (
                    <span className={`text-[11px] font-medium ${
                      v.status === 'published' || v.status === 'public' ? 'text-[#16A34A]'
                      : v.status === 'error' ? 'text-[#DC2626]'
                      : v.status === 'private' ? 'text-[#A3A3A3]'
                      : 'text-[#D97706]'
                    }`}>{v.status}</span>
                  ) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {ytId && (
                    <button
                      onClick={() => fixVideo.mutate(ytId)}
                      disabled={fixVideo.isPending}
                      title="Fix SEO"
                      className="h-6 w-6 inline-flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors disabled:opacity-40"
                    >
                      <Wrench size={10} strokeWidth={1.5} />
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </SectionCard>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ChannelDetailPage() {
  const { slug } = useParams<{ slug: string }>()
  const { data: channels = [] } = useChannels()

  const channel = (channels as any[]).find((c: any) => c.slug === slug)

  // Same queryKey as AuditPanel's audit query below -- React Query dedupes this,
  // so reading live YouTube subscriber/video/view stats here costs zero extra
  // network calls. The /api/channels list endpoint is purely local registry data
  // (slug/name/auth status) and never fetches YouTube stats -- audit_channel()
  // already does, on this same page, so reuse it instead of adding a new call.
  const { data: auditData } = useQuery({
    queryKey: ['channel-audit', slug],
    queryFn: () => channelOpsApi.audit(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
    retry: false,
  })
  const auditChannelInfo = auditData?.channel

  if (!slug) return null

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-8 pt-8 pb-5">
        <Link
          to="/app/channels"
          className="inline-flex items-center gap-1 text-[12px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors mb-4"
        >
          <ChevronLeft size={13} strokeWidth={1.5} /> Channels
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#0A0A0A]">
              {channel?.name ?? slug}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <code className="text-[11px] text-[#A3A3A3] bg-[#F5F5F5] px-2 py-0.5 rounded">{slug}</code>
              {channel?.handle && (
                <span className="text-[12px] text-[#A3A3A3]">{channel.handle}</span>
              )}
              {channel?.channel_id && (
                <a
                  href={`https://youtube.com/channel/${channel.channel_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-1 transition-colors"
                >
                  YouTube <ExternalLink size={10} strokeWidth={1.5} />
                </a>
              )}
            </div>
          </div>

          {/* Stats chips */}
          {channel && (
            <div className="flex items-center gap-5 bg-white border border-[#E5E5E5] rounded-md px-5 py-3">
              {[
                ['Subscribers', auditChannelInfo?.subscriber_count != null ? Number(auditChannelInfo.subscriber_count).toLocaleString() : '—'],
                ['Videos', auditChannelInfo?.video_count != null ? Number(auditChannelInfo.video_count).toLocaleString() : '—'],
                ['Views', auditChannelInfo?.view_count != null ? Number(auditChannelInfo.view_count).toLocaleString() : '—'],
              ].map(([label, value]) => (
                <div key={label} className="text-center">
                  <p className="text-[14px] font-semibold text-[#0A0A0A] leading-none">{value}</p>
                  <p className="text-[10px] text-[#A3A3A3] mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Body - 2-col layout */}
      <div className="px-8 pb-12 grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Left col: audit + branding */}
        <div className="xl:col-span-1 space-y-5">
          <AuditPanel slug={slug} />
          <VideoDefaultsPanel slug={slug} />
          <AICoachPanel slug={slug} />
          <BenchmarkPanel slug={slug} />
          <KeywordClustersPanel slug={slug} />
          <RankTrackingPanel slug={slug} />
          <OAuthDiagnosticsPanel />
          <BrandingPanel slug={slug} channel={channel} />
        </div>

        {/* Right col: videos */}
        <div className="xl:col-span-2">
          <VideosPanel slug={slug} />
        </div>
      </div>
    </div>
  )
}
