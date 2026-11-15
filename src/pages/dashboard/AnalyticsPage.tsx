import React, { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Eye, Users, Clock, Play,
  BarChart2, RefreshCw, Sparkles, Zap, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { analyticsApi, thumbnailApi } from '@api/services'
import { useChannels } from '@hooks/useJobs'
import { useToast } from '@components/Toast'
import { apiErrorMessage } from '@lib/apiError'
import { CTR_COLUMN_NOTE, ctrAsOf, ctrTooltip, fmtCtr } from '@lib/ctrReading'
import { ThumbnailAbPanel as SharedThumbnailAbPanel } from '@/components/studio/ThumbnailAbPanel'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null, decimals = 0) => {
  if (n === undefined || n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toFixed(decimals)
}

const fmtUSD = (n: number | undefined | null) =>
  n === undefined || n === null ? '—' : `$${n.toFixed(2)}`

const fmtDate = (s: string | undefined) => {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  trend,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  trend?: number
}) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">{label}</p>
        <span className="text-[#D4D4D4]">{icon}</span>
      </div>
      <p className="text-[24px] font-semibold text-[#0A0A0A] leading-none mb-1">{value}</p>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-2 mt-1.5">
          {trend !== undefined && (
            <span className={`text-[11px] font-medium ${trend >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'}`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
          {sub && <span className="text-[11px] text-[#A3A3A3]">{sub}</span>}
        </div>
      )}
    </div>
  )
}

// ─── Cost bar row ─────────────────────────────────────────────────────────────

const SERVICE_COLORS: Record<string, string> = {
  anthropic:  '#7C3AED',
  elevenlabs: '#2563EB',
  suno:       '#D97706',
  mureka:     '#0891B2',
  kling:      '#DC2626',
  minimax:    '#16A34A',
  pexels:     '#525252',
  openai:     '#10B981',
  other:      '#A3A3A3',
}

function CostRow({ service, cost, total }: { service: string; cost: number; total: number }) {
  const pct  = total > 0 ? Math.round((cost / total) * 100) : 0
  const color = SERVICE_COLORS[service.toLowerCase()] ?? SERVICE_COLORS.other

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[#F5F5F5] last:border-b-0">
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <span className="text-[13px] text-[#0A0A0A] capitalize flex-1">{service}</span>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="w-24 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
        <span className="text-[11px] text-[#A3A3A3] w-8 text-right">{pct}%</span>
        <span className="text-[12px] font-medium text-[#0A0A0A] w-16 text-right">{fmtUSD(cost)}</span>
      </div>
    </div>
  )
}

// ─── Video row ────────────────────────────────────────────────────────────────

function VideoRow({ video }: { video: any }) {
  const status = video.upload_status ?? video.status ?? 'unknown'
  const statusStyle: Record<string, string> = {
    uploaded: 'text-[#16A34A] bg-[rgba(22,163,74,0.08)]',
    done:     'text-[#16A34A] bg-[rgba(22,163,74,0.08)]',
    error:    'text-[#DC2626] bg-[rgba(220,38,38,0.08)]',
    failed:   'text-[#DC2626] bg-[rgba(220,38,38,0.08)]',
    running:  'text-[#2563EB] bg-[rgba(37,99,235,0.08)]',
  }

  return (
    <tr className="border-b border-[#F5F5F5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors">
      <td className="px-4 py-3 max-w-[260px]">
        <p className="text-[13px] text-[#0A0A0A] truncate" title={video.topic ?? video.title}>
          {video.topic ?? video.title ?? '—'}
        </p>
        {video.channel_slug && (
          <p className="text-[11px] text-[#A3A3A3] mt-0.5">{video.channel_slug}</p>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] text-[#525252]">{fmtDate(video.created_at ?? video.start_time)}</td>
      <td className="px-4 py-3">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded capitalize ${statusStyle[status] ?? 'text-[#A3A3A3] bg-[#F5F5F5]'}`}>
          {status}
        </span>
      </td>
      <td className="px-4 py-3 text-[12px] text-[#525252] text-right">{fmt(video.views)}</td>
      <td className="px-4 py-3 text-[12px] text-right whitespace-nowrap">
        {video.ctr_percent != null ? (
          <span title={ctrTooltip(video)}>
            <span className="text-[#0A0A0A]">{fmtCtr(video.ctr_percent)}</span>
            {video.ctr_captured_at && (
              <span className="block text-[10px] text-[#A3A3A3]">{ctrAsOf(video.ctr_captured_at)}</span>
            )}
          </span>
        ) : (
          <span
            className="text-[#A3A3A3]"
            title="No click-through reading captured for this video. It needs the browser extension and a visit to your own Studio."
          >—</span>
        )}
      </td>
      <td className="px-4 py-3 text-[12px] text-[#525252] text-right">
        {video.retention_pct !== undefined && video.retention_pct !== null && video.retention_pct > 0
          ? `${video.retention_pct.toFixed(0)}%`
          : '—'}
      </td>
      <td className="px-4 py-3 text-[12px] text-[#525252] text-right">{fmtUSD(video.cost ?? video.total_cost)}</td>
    </tr>
  )
}

// ─── YPP Progress ─────────────────────────────────────────────────────────────

function YppProgress({
  lifetime,
  lifetimeLoading,
  lifetimeErrored,
  windowed,
}: {
  lifetime: any
  lifetimeLoading: boolean
  lifetimeErrored: boolean
  windowed: any
}) {
  // Prefer real lifetime totals fetched live from YouTube; only fall back to our
  // local rolling-30-days snapshot if the live call is still loading or failed outright.
  const useLifetime = !lifetimeLoading && !lifetimeErrored && lifetime
  const hours    = useLifetime ? (lifetime.watch_hours ?? 0) : (windowed?.watch_hours ?? 0)
  const subs     = useLifetime ? (lifetime.subs ?? 0)        : (windowed?.subs ?? 0)
  const hoursPct = Math.min(Math.round((hours / 4000) * 100), 100)
  const subsPct  = Math.min(Math.round((subs  / 1000) * 100), 100)

  let note = 'Approximate - based on the last 30 days synced, not full channel lifetime'
  if (lifetimeLoading) {
    note = 'Fetching real lifetime totals from YouTube…'
  } else if (useLifetime) {
    note = lifetime.error || (lifetime.skipped_channels?.length > 0)
      ? 'Live lifetime totals from YouTube (partial - some channels/metrics unavailable)'
      : 'Live lifetime totals from YouTube'
  } else if (lifetimeErrored) {
    note = 'Could not reach YouTube for lifetime totals - showing last 30 days synced instead'
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">YPP Progress</p>
      <p className="text-[10px] text-[#D4D4D4] mb-3">{note}</p>
      <div className="space-y-4">
        {[
          { label: 'Watch Hours', value: fmt(hours), target: '4,000', pct: hoursPct },
          { label: 'Subscribers', value: fmt(subs),  target: '1,000', pct: subsPct  },
        ].map(({ label, value, target, pct }) => (
          <div key={label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[12px] text-[#525252]">{label}</span>
              <span className="text-[12px] font-medium text-[#0A0A0A]">
                {value} <span className="font-normal text-[#A3A3A3]">/ {target}</span>
              </span>
            </div>
            <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct}%`,
                  background: pct >= 100 ? '#16A34A' : '#0A0A0A',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Empty / Error states ─────────────────────────────────────────────────────

function NoData({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center py-10 text-[12px] text-[#A3A3A3]">
      <BarChart2 size={16} strokeWidth={1} className="mr-2" /> No {label} data yet
    </div>
  )
}

// ─── Analytics Page ───────────────────────────────────────────────────────────

// ─── Click-through read from Studio (COMPETITOR_FEATURES_AI_STRATEGY.md 2.9, phase 3) ──
//
// These numbers come from the browser extension, not the YouTube API: Google's Analytics API lists
// `videoThumbnailImpressions` / `videoThumbnailImpressionsClickRate` and then rejects both with
// HTTP 400 "The query is not supported". They exist only inside Studio's own UI, so the extension
// reads them off the page -- opt-in, Studio-only -- and they land here.
//
// The delta is the point. A single CTR number tells a creator very little; the same number next to
// where it was before a thumbnail change is the whole reason this exists. That is also why a video
// with one reading shows "—" for the change rather than "0.0": those mean different things.

type CtrRow = {
  youtube_id: string
  readings: number
  latest_impressions: number | null
  latest_ctr_percent: number | null
  first_ctr_percent: number | null
  ctr_delta: number | null
  last_captured_at: string | null
}

function CtrPanel() {
  const ctrQuery = useQuery({
    queryKey: ['ctr-summary'],
    queryFn: () => analyticsApi.ctrSummary(100),
    staleTime: 60_000,
  })

  const rows: CtrRow[] = ctrQuery.data?.videos ?? []

  return (
    <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
          Click-through from Studio
          {rows.length > 0 && (
            <span className="normal-case text-[#D4D4D4] ml-1.5">({rows.length})</span>
          )}
        </p>
        <p className="text-[11px] text-[#A3A3A3] mt-1">
          Read by the Vidora browser extension from your own YouTube Studio analytics.
        </p>
      </div>

      {ctrQuery.isLoading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[#A3A3A3]">
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Loading readings…
        </div>
      ) : rows.length === 0 ? (
        // Not a failure state: this is what the panel shows until the extension is installed and
        // capture is switched on, so the empty state explains the why rather than saying "no data".
        <div className="px-4 py-5">
          <p className="text-[12px] text-[#525252]">
            No readings yet. Click-through is not available through YouTube's API — it exists only
            inside Studio — so it has to be read from the page.
          </p>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">
            Install the Vidora browser extension, create a token under{' '}
            <strong>Settings → Integrations</strong>, and turn on analytics capture. Readings appear
            here as you browse your own Studio.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F5F5F5]">
                {['Video', 'Readings', 'Impressions', 'CTR', 'Change', 'Last read'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.youtube_id}
                    className="border-b border-[#F5F5F5] last:border-b-0 hover:bg-[#FAFAFA] transition-colors">
                  <td className="px-4 py-2.5">
                    <a
                      href={`https://www.youtube.com/watch?v=${r.youtube_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-mono text-[#0A0A0A] hover:underline"
                    >
                      {r.youtube_id}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[#525252]">{r.readings}</td>
                  <td className="px-4 py-2.5 text-[12px] text-[#0A0A0A] text-right tabular-nums">
                    {r.latest_impressions === null ? '—' : fmt(r.latest_impressions)}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-[#0A0A0A] text-right tabular-nums">
                    {r.latest_ctr_percent === null ? '—' : r.latest_ctr_percent.toFixed(2) + '%'}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-right tabular-nums">
                    {r.ctr_delta === null ? (
                      <span className="text-[#A3A3A3]" title="Needs two readings to compare">—</span>
                    ) : (
                      <span className={r.ctr_delta >= 0 ? 'text-[#16A34A]' : 'text-[#B42318]'}>
                        {r.ctr_delta >= 0 ? '+' : ''}{r.ctr_delta.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-[#A3A3A3] text-right">
                    {r.last_captured_at ? String(r.last_captured_at).slice(0, 16) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Thumbnail A/B (§2.3) ─────────────────────────────────────────────────────
//
// The verdict is **rendered, never computed here**. The server refuses to name a winner below a
// sample floor and runs a two-proportion test above it, so this panel's job is to display the state
// it is given — including "not enough data", which is the honest answer most of the time and is not
// a failure state.
//
type AbVariant = {
  variant_id: number | null
  label: string
  set_at: string | null
  retired_at: string | null
  impressions: number | null
  clicks: number | null
  ctr_percent: number | null
  partial: boolean
}

type AbVerdict = {
  state: 'no_data' | 'collecting' | 'no_difference' | 'winner'
  winner_variant_id: number | null
  confidence: number | null
  needed_per_variant: number | null
  note: string
}

const AB_STATE: Record<string, { label: string; cls: string }> = {
  no_data:       { label: 'No readings yet', cls: 'text-[#A3A3A3]' },
  collecting:    { label: 'Collecting',      cls: 'text-[#B45309]' },
  no_difference: { label: 'No difference',   cls: 'text-[#525252]' },
  winner:        { label: 'Winner',          cls: 'text-[#16A34A]' },
}

function ThumbnailAbPanel() {
  const toast = useToast()
  const qc = useQueryClient()
  const [input, setInput]         = useState('')
  const [videoId, setVideoId]     = useState('')
  const [imagePath, setImagePath] = useState('')
  const [busy, setBusy]           = useState(false)

  // Thumbnail generator state
  const [genTopic, setGenTopic]      = useState('')
  const [genHeadline, setGenHeadline] = useState('')
  const [genSubhead, setGenSubhead]   = useState('')
  const [genBadge, setGenBadge]       = useState('')
  const [genChannel, setGenChannel]   = useState('')
  const [genMode, setGenMode]         = useState<'faceless' | 'hybrid'>('faceless')
  const [genProvider, setGenProvider] = useState<'stock' | 'pollinations'>('stock')
  const [genAspect, setGenAspect]     = useState<'landscape' | 'vertical'>('landscape')
  const [genPreview, setGenPreview]   = useState<string | null>(null)
  const [genBusy, setGenBusy]         = useState(false)

  const reportQuery = useQuery({
    queryKey: ['thumb-ab', videoId],
    queryFn: () => analyticsApi.thumbnailAb(videoId),
    enabled: videoId.length === 11,
    retry: false,
  })

  const report = reportQuery.data as
    | { variants?: AbVariant[]; verdict?: AbVerdict; readings?: number; message?: string }
    | undefined
  const variants = report?.variants ?? []
  const verdict  = report?.verdict

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['thumb-ab', videoId] })
      toast.success(ok)
    } catch (e) {
      toast.error(apiErrorMessage(e, 'That did not work'))
    } finally {
      setBusy(false)
    }
  }

  const generateThumbnail = async () => {
    if (!genTopic.trim()) return
    setGenBusy(true)
    try {
      const result = await thumbnailApi.generate({
        topic: genTopic,
        thumbnail_text: genHeadline || genTopic,
        thumbnail_subtext: genSubhead || undefined,
        badge: genBadge || undefined,
        channel_name: genChannel || undefined,
        mode: genMode,
        provider: genProvider,
        aspect: genAspect,
      })
      if (result.ok && result.b64) {
        setGenPreview(`data:${result.mime};base64,${result.b64}`)
        setImagePath(`data:${result.mime};base64,${result.b64}`)
        toast.success('Thumbnail generated — set it as challenger below')
      }
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Generation failed'))
    } finally {
      setGenBusy(false)
    }
  }

  const state = verdict ? AB_STATE[verdict.state] ?? AB_STATE.no_data : null
  const hasLive = variants.some((v) => !v.retired_at)

  return (
    <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
          Thumbnail A/B
        </p>
        <p className="text-[11px] text-[#A3A3A3] mt-1">
          Sequential cover rotation, not native simultaneous YouTube A/B testing. Requires captured
          CTR readings; Shorts-feed views are not thumbnail clicks.
        </p>
      </div>

      <div className="px-4 py-3 border-b border-[#F5F5F5] flex flex-col sm:flex-row gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.trim())}
          placeholder="Paste a video ID (11 characters)"
          maxLength={64}
          className="flex-1 h-8 px-3 rounded border border-[#E5E5E5] text-[12px] focus:outline-none focus:border-[#0A0A0A]"
        />
        <button
          type="button"
          onClick={() => { setVideoId(input); setImagePath(''); setGenPreview(null) }}
          disabled={input.length !== 11}
          className="h-8 px-3 rounded bg-[#0A0A0A] text-white text-[11px] font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors"
        >
          Load
        </button>
      </div>

      {!videoId ? (
        <div className="px-4 py-5 text-[12px] text-[#525252]">
          Load a video to register its current thumbnail as the baseline, then add a challenger.
        </div>
      ) : reportQuery.isLoading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[#A3A3A3]">
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Loading…
        </div>
      ) : reportQuery.isError ? (
        <SharedThumbnailAbPanel videoId={videoId} />
      ) : (
        <div className="px-4">
          {/* ── Thumbnail generator ───────────────────────────────────────── */}
          <div className="mb-4 border border-[#F5F5F5] rounded-lg p-4">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-3">
              Generate thumbnail
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Topic / video title</label>
                <input
                  value={genTopic}
                  onChange={(e) => setGenTopic(e.target.value)}
                  placeholder="e.g. How to grow tomatoes"
                  className="h-8 px-2 rounded border border-[#E5E5E5] text-[11px] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Headline (big text)</label>
                <input
                  value={genHeadline}
                  onChange={(e) => setGenHeadline(e.target.value)}
                  placeholder="WATCH THIS"
                  className="h-8 px-2 rounded border border-[#E5E5E5] text-[11px] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Subhead</label>
                <input
                  value={genSubhead}
                  onChange={(e) => setGenSubhead(e.target.value)}
                  placeholder="Step by step"
                  className="h-8 px-2 rounded border border-[#E5E5E5] text-[11px] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Badge</label>
                <input
                  value={genBadge}
                  onChange={(e) => setGenBadge(e.target.value)}
                  placeholder="NEW"
                  className="h-8 px-2 rounded border border-[#E5E5E5] text-[11px] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Channel</label>
                <input
                  value={genChannel}
                  onChange={(e) => setGenChannel(e.target.value)}
                  placeholder="@channel"
                  className="h-8 px-2 rounded border border-[#E5E5E5] text-[11px] focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Mode</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setGenMode('faceless')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genMode === 'faceless'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Faceless
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenMode('hybrid')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genMode === 'hybrid'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Hybrid
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Background</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setGenProvider('stock')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genProvider === 'stock'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenProvider('pollinations')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genProvider === 'pollinations'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    AI
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-[#A3A3A3]">Aspect</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setGenAspect('landscape')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genAspect === 'landscape'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    16:9
                  </button>
                  <button
                    type="button"
                    onClick={() => setGenAspect('vertical')}
                    className={`px-2 py-1.5 rounded text-[10px] border ${
                      genAspect === 'vertical'
                        ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                        : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
                    }`}
                  >
                    9:16
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={generateThumbnail}
                disabled={genBusy || !genTopic.trim()}
                className="flex-1 h-8 rounded bg-[#0A0A0A] text-white text-[11px] font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {genBusy ? 'Generating…' : 'Generate thumbnail'}
              </button>
              {genPreview && (
                <div className="w-16 h-10 rounded overflow-hidden border border-[#E5E5E5]">
                  <img src={genPreview} alt="preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
            {genPreview && (
              <p className="text-[10px] text-[#A3A3A3] mt-1.5">
                Preview ready. Cover image selected below — click “Set live” to make it the
                challenger.
              </p>
            )}
          </div>
          {variants.length === 0 ? (
            <p className="text-[12px] text-[#525252]">
              No variants yet. Register the thumbnail that is live now as the baseline — that does not
              change anything on YouTube.
            </p>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F5F5F5]">
                  {['Thumbnail', 'Live from', 'Impressions', 'Clicks', 'CTR'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-2 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.variant_id ?? v.label} className="border-b border-[#F5F5F5] last:border-b-0">
                    <td className="py-2 text-[12px] text-[#0A0A0A]">
                      {v.label || 'Untitled'}
                      {!v.retired_at && <span className="ml-1.5 text-[10px] text-[#16A34A]">live</span>}
                      {v.partial && <span className="ml-1.5 text-[10px] text-[#B45309]">partial</span>}
                    </td>
                    <td className="py-2 text-[11px] text-[#A3A3A3]">
                      {v.set_at ? String(v.set_at).slice(0, 16) : 'from the start'}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.impressions === null ? '—' : fmt(v.impressions)}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.clicks === null ? '—' : v.clicks.toFixed(0)}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.ctr_percent === null ? '—' : v.ctr_percent.toFixed(2) + '%'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {verdict && (
            <div className="mt-3 rounded border border-[#F5F5F5] bg-[#FAFAFA] px-3 py-2.5">
              <p className={`text-[11px] font-semibold ${state?.cls ?? ''}`}>
                {state?.label ?? verdict.state}
                {verdict.confidence !== null && (
                  <span className="font-normal text-[#A3A3A3] ml-1.5">
                    {(verdict.confidence * 100).toFixed(1)}% confidence
                  </span>
                )}
              </p>
              <p className="text-[11.5px] text-[#525252] mt-1">{verdict.note}</p>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2 items-center">
              <button
                type="button"
                disabled={busy || hasLive}
                onClick={() =>
                  run(() => analyticsApi.thumbnailAbBaseline(videoId), 'Baseline registered')
                }
                className="h-7 px-3 rounded border border-[#0A0A0A] text-[11px] font-medium text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-40 transition-colors"
              >
                Register current as baseline
              </button>
              {hasLive && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(() => analyticsApi.thumbnailAbStop(videoId), 'Test stopped')}
                  className="h-7 px-3 rounded border border-[#E5E5E5] text-[11px] font-medium text-[#525252] hover:border-[#B42318] hover:text-[#B42318] disabled:opacity-40 transition-colors"
                >
                  Stop test
                </button>
              )}
            </div>

          {variants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F5F5F5]">
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                Add a challenger
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="file"
                  aria-label="Analytics challenger cover"
                  accept="image/jpeg,image/png"
                  onChange={event => {
                    setImagePath('')
                    const file = event.target.files?.[0]
                    if (!file) return
                    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2_000_000) {
                      toast.error('Choose a JPEG or PNG cover under 2 MB.')
                      return
                    }
                    const reader = new FileReader()
                    reader.onerror = () => toast.error('Could not read the selected cover.')
                    reader.onload = () => {
                      const data = String(reader.result || '')
                      setImagePath(data)
                      setGenPreview(data)
                    }
                    reader.readAsDataURL(file)
                  }}
                  className="flex-1 h-8 px-3 rounded border border-[#E5E5E5] text-[12px] font-mono focus:outline-none focus:border-[#0A0A0A]"
                />
                <button
                  type="button"
                  disabled={busy || !imagePath}
                  onClick={() =>
                    run(
                      () => analyticsApi.thumbnailAbChallenger(videoId, imagePath),
                      'YouTube accepted the cover; display updates may take time',
                    )
                  }
                  className="h-8 px-3 rounded bg-[#0A0A0A] text-white text-[11px] font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  Set live
                </button>
              </div>
              <p className="text-[10.5px] text-[#A3A3A3] mt-1.5">
                Generate a cover above or choose a JPEG/PNG under 2 MB. Applying updates this existing
                video's cover only after YouTube accepts it; grid changes may take time. The original
                baseline is measurement-only: upload the original image to restore it.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Packaging or content? (§5.2) ────────────────────────────────────────────
//
// The pairing the extension made possible, and the only one of its kind: the click-through it read
// off the creator's own Studio page against the retention the Analytics API returns, per video. It
// separates a *packaging* problem from a *content* problem from a *topic* problem — the question a
// creator asks and, until now, had nowhere to ask.
//
// The split is against the creator's **own** median, never a published benchmark: there is no
// universal good click-through rate, and no cross-creator dataset to source one from, because every
// creator's click-through is private to their own Studio. So this panel prints where a video sits
// relative to the channel it is on, and never a "target".
//
// "Not enough data" is a first-class state, not a failure. Below the floor the server returns the
// count still needed, and this renders that instead of an empty chart — a chart that always has
// something to show will always show something.
//
// The verdict is rendered, never computed here: the quadrant, its label and its advice all come from
// the server, so the threshold and the wording cannot drift apart.

type CtrRetentionVideo = {
  youtube_id: string
  title: string | null
  ctr_percent: number
  retention_percent: number
  quadrant: string
  label: string
  advice: string
  vs_median_ctr: number
  vs_median_retention: number
}

type CtrRetention = {
  state: 'ok' | 'not_enough_data'
  have: number
  needed: number
  min_videos: number
  videos: CtrRetentionVideo[]
  counts: Record<string, number>
  median_ctr: number | null
  median_retention: number | null
  headline: string
  is_screening: boolean
  caveats: string[]
  dropped?: { paired?: number; ctr_only?: number; retention_only?: number }
}

// Most actionable first, matching the server's ordering: the two quadrants that name a fixable
// problem, then the one that says "stop", then the one that says "keep doing this".
const QUADRANT_ORDER = ['clickbait', 'packaging', 'topic', 'working']

// Amber warns (the promise outran the video), blue is the opportunity (nobody clicked a video that
// holds), grey is the "stop" (not a packaging problem at all), green is the one to repeat.
const QUADRANT_CLS: Record<string, string> = {
  clickbait: 'text-[#B45309]',
  packaging: 'text-[#2563EB]',
  topic:     'text-[#525252]',
  working:   'text-[#16A34A]',
}

// Which half is missing matters, because the fix differs: no click-through means "browse your own
// Studio with the extension installed"; no retention means "sync from YouTube". Saying "not enough
// data" without saying which half leaves the creator with nothing to do about it.
function shortfallNote(dropped: CtrRetention['dropped']): string {
  const ctrOnly = dropped?.ctr_only ?? 0
  const retOnly = dropped?.retention_only ?? 0
  const plural = (n: number) => `${n} video${n !== 1 ? 's' : ''}`
  if (ctrOnly === 0 && retOnly === 0) {
    return 'Both readings arrive from different places, so this fills in as each side accumulates.'
  }
  if (ctrOnly > 0 && retOnly === 0) {
    return `${plural(ctrOnly)} have a click-through reading but no retention yet — sync from YouTube to pull the other half.`
  }
  if (retOnly > 0 && ctrOnly === 0) {
    return `${plural(retOnly)} have retention but no click-through yet — install the extension and browse your own Studio to capture it.`
  }
  return `${plural(ctrOnly)} are waiting on a retention sync and ${plural(retOnly)} on a click-through capture.`
}

function CtrRetentionPanel({ channelSlug }: { channelSlug?: string }) {
  const query = useQuery({
    queryKey: ['ctr-retention', channelSlug ?? ''],
    queryFn:  () => analyticsApi.ctrRetention(channelSlug || undefined),
    staleTime: 300_000,
  })

  const data: CtrRetention | undefined = query.data

  return (
    <div
      data-testid="ctr-retention-panel"
      className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
          Packaging or content?
        </p>
        <p className="text-[11px] text-[#A3A3A3] mt-1">
          Click-through from Studio against retention from YouTube, per video — split on your own
          median, not a benchmark.
        </p>
      </div>

      {query.isLoading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[#A3A3A3]">
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Comparing…
        </div>
      ) : query.isError || !data ? (
        <div className="px-4 py-5">
          <p className="text-[12px] text-[#525252]">Could not load the comparison.</p>
        </div>
      ) : data.state === 'not_enough_data' ? (
        // Not a failure state: this is what the panel shows until enough videos have both readings,
        // so it explains what is missing rather than reporting an error.
        <div data-ctr-retention-state="not_enough_data" className="px-4 py-5">
          <p className="text-[12px] text-[#525252]">{data.headline}</p>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">{shortfallNote(data.dropped)}</p>
        </div>
      ) : (
        <div data-ctr-retention-state="ok">
          <div className="px-4 py-3 border-b border-[#F5F5F5]">
            <p className="text-[13px] text-[#0A0A0A]">{data.headline}</p>
            <p className="text-[11px] text-[#A3A3A3] mt-1">
              Median across {data.have} videos: {data.median_ctr?.toFixed(2)}% click-through ·{' '}
              {data.median_retention?.toFixed(1)}% retention
            </p>
          </div>

          <div className="flex items-center gap-3 px-4 pt-3 pb-1.5 border-b border-[#F5F5F5]">
            <span className="flex-1 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">
              Video
            </span>
            <span className="w-24 flex-shrink-0 text-right text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">
              Click-through
            </span>
            <span className="w-24 flex-shrink-0 text-right text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">
              Retention
            </span>
          </div>

          {QUADRANT_ORDER.map((quadrant) => {
            const rows = data.videos.filter((v) => v.quadrant === quadrant)
            if (rows.length === 0) return null
            return (
              <div key={quadrant} className="border-b border-[#F5F5F5] last:border-b-0">
                {/* The advice is per quadrant, not per video — the module says so — so it is stated
                    once above the group rather than repeated on every row. */}
                <div className="px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-medium uppercase tracking-widest ${QUADRANT_CLS[quadrant] ?? 'text-[#525252]'}`}>
                      {rows[0].label}
                    </span>
                    <span className="text-[10px] text-[#A3A3A3]">
                      {rows.length} video{rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#525252] mt-1">{rows[0].advice}</p>
                </div>
                {rows.map((v) => (
                  <div
                    key={v.youtube_id}
                    className="flex items-center gap-3 px-4 py-2 border-t border-[#F5F5F5] hover:bg-[#FAFAFA] transition-colors"
                  >
                    <a
                      href={`https://www.youtube.com/watch?v=${v.youtube_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-w-0 text-[12px] text-[#0A0A0A] hover:underline truncate"
                      title={v.title ?? v.youtube_id}
                    >
                      {v.title || v.youtube_id}
                    </a>
                    <div className="w-24 flex-shrink-0 text-right">
                      <p className="text-[12px] tabular-nums text-[#0A0A0A]">
                        {v.ctr_percent.toFixed(2)}%
                      </p>
                      <p className="text-[10px] tabular-nums text-[#A3A3A3]">
                        {v.vs_median_ctr >= 0 ? '+' : ''}{v.vs_median_ctr.toFixed(2)}
                      </p>
                    </div>
                    <div className="w-24 flex-shrink-0 text-right">
                      <p className="text-[12px] tabular-nums text-[#0A0A0A]">
                        {v.retention_percent.toFixed(1)}%
                      </p>
                      <p className="text-[10px] tabular-nums text-[#A3A3A3]">
                        {v.vs_median_retention >= 0 ? '+' : ''}{v.vs_median_retention.toFixed(1)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          {/* The limits are rendered rather than buried in the docs: a median split over a handful of
              videos is a rough instrument, and calling it a verdict would be dishonest. */}
          <div className="px-4 py-3 bg-[#FAFAFA] border-t border-[#E5E5E5]">
            <p className="text-[10.5px] text-[#A3A3A3] mb-1">
              Screening signal, not a verdict. The figure under each number is against your own median.
            </p>
            {data.caveats.map((c) => (
              <p key={c} className="text-[10.5px] text-[#A3A3A3] leading-relaxed">{c}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── What the script generator is told (§5.4) ────────────────────────────────
//
// This panel is not a chart, and the line it prints is not decoration: it is the instruction that goes
// into the prompt before the next script is written. A measured rule that changes what the product
// *produces*, with nowhere for the creator to see it, is a quiet editorial hand — they would have no way
// to disagree with it, or even to know it was happening.
//
// So both refusals are rendered as plainly as the pattern itself: too few videos to say anything, and
// enough videos with no shared shape. In both cases the generator is being told *nothing*, and the panel
// says that outright rather than leaving the creator to wonder whether feedback is active this week.

type RetentionPattern = {
  state: 'ok' | 'not_enough_data' | 'no_pattern'
  videos: number
  examined: number
  needed: number
  window: [number, number] | null
  share: number | null
  is_intro: boolean | null
  advice: string | null
  headline: string
}

function RetentionFeedbackPanel({ channelSlug }: { channelSlug?: string }) {
  const query = useQuery({
    queryKey: ['retention-pattern', channelSlug ?? ''],
    queryFn:  () => analyticsApi.retentionPattern(channelSlug || undefined),
    staleTime: 300_000,
  })

  const data: RetentionPattern | undefined = query.data

  return (
    <div
      data-testid="retention-feedback-panel"
      className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
          What your next script is told
        </p>
        <p className="text-[11px] text-[#A3A3A3] mt-1">
          Measured on your own recent videos and added to every new script before it is written.
        </p>
      </div>

      {query.isLoading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[#A3A3A3]">
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Checking your videos…
        </div>
      ) : query.isError || !data ? (
        <div className="px-4 py-5">
          <p className="text-[12px] text-[#525252]">Could not load the retention pattern.</p>
        </div>
      ) : data.state === 'ok' ? (
        <div data-retention-pattern-state="ok">
          <div className="px-4 py-3 border-b border-[#F5F5F5]">
            <p className="text-[13px] text-[#0A0A0A]">{data.headline}</p>
            <p className="text-[11px] text-[#A3A3A3] mt-1">
              Based on {data.videos} of your last {data.examined} videos with a retention curve.
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
              In every new script prompt
            </p>
            {/* Quoted, not paraphrased: this is the sentence the model receives, so showing anything
                else would make the panel a description of the feature rather than a view of it. */}
            <p className="text-[12px] text-[#525252] leading-relaxed border-l-2 border-[#E5E5E5] pl-3">
              {data.advice}
            </p>
          </div>
        </div>
      ) : (
        // Both refusals land here, and the important half is that the creator is told the feedback is
        // *off* — not that it is broken, and not left to infer it from an absence.
        <div data-retention-pattern-state={data.state} className="px-4 py-5">
          <p className="text-[12px] text-[#525252]">{data.headline}</p>
          <p className="text-[11px] text-[#A3A3A3] mt-1.5">
            Nothing is being added to your scripts. They are written exactly as they were before.
          </p>
        </div>
      )}
    </div>
  )
}

export default function AnalyticsPage() {
  const { data: channels = [] } = useChannels()
  const queryClient = useQueryClient()
  const toast = useToast()
  const [channelFilter,  setChannelFilter]  = useState('')
  const [channelFilterTouched, setChannelFilterTouched] = useState(false)
  const [insightsOpen,   setInsightsOpen]   = useState(true)
  const [digestOpen,     setDigestOpen]     = useState(false)
  const [bestTimesOpen,  setBestTimesOpen]  = useState(false)
  const [trafficOpen,    setTrafficOpen]    = useState(false)
  const [insightsLoaded, setInsightsLoaded] = useState(true)
  const [digestLoaded,   setDigestLoaded]   = useState(false)
  const [bestTimesLoaded, setBestTimesLoaded] = useState(false)
  const [trafficLoaded,  setTrafficLoaded]  = useState(false)
  const [retentionOpen,  setRetentionOpen]  = useState(false)
  const [retentionLoaded, setRetentionLoaded] = useState(false)
  const [retentionVideoId, setRetentionVideoId] = useState('')

  // Default the channel filter to the user's default channel once channels load,
  // unless the user has already made an explicit selection (including "All channels").
  useEffect(() => {
    if (channelFilterTouched || channels.length === 0) return
    const defaultChannel: any = channels.find((ch: any) => ch.is_default)
    if (defaultChannel) setChannelFilter(defaultChannel.slug)
  }, [channels, channelFilterTouched])

  const statsQuery = useQuery({
    queryKey: ['analytics-stats', channelFilter],
    queryFn:  () => analyticsApi.channelStats(channelFilter || undefined),
    staleTime: 60_000,
  })
  const costsQuery = useQuery({
    queryKey: ['analytics-costs'],
    queryFn:  analyticsApi.costs,
    staleTime: 60_000,
  })
  const videosQuery = useQuery({
    queryKey: ['analytics-videos'],
    queryFn:  () => analyticsApi.videos(30),
    staleTime: 60_000,
  })
  const yppQuery = useQuery({
    queryKey: ['analytics-ypp', channelFilter],
    queryFn:  () => analyticsApi.ypp(channelFilter || undefined),
    staleTime: 60_000,
  })
  // Live call to YouTube for real lifetime totals (see analytics_sync.get_lifetime_ypp_progress) --
  // slower than the DB-derived yppQuery above, so it gets a longer staleTime and its own
  // loading/error state that YppProgress falls back on gracefully.
  const yppLifetimeQuery = useQuery({
    queryKey: ['analytics-ypp-lifetime', channelFilter],
    queryFn:  () => analyticsApi.yppLifetime(channelFilter || undefined),
    staleTime: 15 * 60_000,
    retry: 1,
  })
  const syncStatusQuery = useQuery({
    queryKey: ['analytics-sync-status'],
    queryFn:  () => analyticsApi.syncStatus(),
    staleTime: 120_000,
  })
  const insightsQuery = useQuery({
    queryKey: ['analytics-insights', channelFilter],
    queryFn:  () => analyticsApi.insights(channelFilter || undefined),
    staleTime: 300_000,
    enabled:  insightsLoaded,
  })
  const digestQuery = useQuery({
    queryKey: ['analytics-digest', channelFilter],
    queryFn:  () => analyticsApi.digest(channelFilter || undefined),
    staleTime: 300_000,
    enabled:  digestLoaded,
  })
  const bestTimesQuery = useQuery({
    queryKey: ['analytics-best-times', channelFilter],
    queryFn:  () => analyticsApi.bestTimes(channelFilter || undefined),
    staleTime: 300_000,
    enabled:  bestTimesLoaded,
  })
  const trafficQuery = useQuery({
    queryKey: ['analytics-traffic-sources', channelFilter],
    queryFn:  () => analyticsApi.trafficSources(channelFilter),
    staleTime: 300_000,
    enabled:  trafficLoaded && !!channelFilter,
    retry: 1,
  })
  // Retention post-mortem (TEST.md §29.43): YouTube's curve says *where* viewers
  // left; the script we stored at upload says which line was playing. Fetched per
  // video and cached server-side, so switching back to a video is free.
  const retentionQuery = useQuery({
    queryKey: ['analytics-retention', retentionVideoId],
    queryFn:  () => analyticsApi.retention(retentionVideoId),
    staleTime: 300_000,
    enabled:  retentionLoaded && !!retentionVideoId,
    retry: 0,
  })
  const explainMutation = useMutation<any, any, void>({
    mutationFn: () => analyticsApi.explainRetention(retentionVideoId),
    onError: (err: any) => {
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Could not reach the AI reporter')
    },
  })

  const syncMutation = useMutation({
    mutationFn: () => analyticsApi.triggerSync(),
    onSuccess: (res) => {
      const count = (res as any)?.synced ?? 0
      toast.success(`Synced ${count} video${count !== 1 ? 's' : ''} from YouTube`)
      queryClient.invalidateQueries({ queryKey: ['analytics-stats'],   exact: false })
      queryClient.invalidateQueries({ queryKey: ['analytics-videos'],  exact: false })
      queryClient.invalidateQueries({ queryKey: ['analytics-ypp'],     exact: false })
      queryClient.invalidateQueries({ queryKey: ['analytics-sync-status'], exact: false })
    },
    onError: () => toast.error('Sync failed - check YouTube OAuth in Channels'),
  })

  const stats  = statsQuery.data  ?? {}
  const costs  = costsQuery.data  ?? []
  const videos = videosQuery.data ?? []
  const ypp    = yppQuery.data    ?? {}

  // Total cost for bar proportions
  const totalCost = Array.isArray(costs)
    ? costs.reduce((s: number, r: any) => s + (r.cost ?? r.total ?? 0), 0)
    : 0

  // Filtered videos
  const filteredVideos = channelFilter
    ? videos.filter((v: any) => v.channel_slug === channelFilter)
    : videos

  const loading = statsQuery.isLoading || costsQuery.isLoading || videosQuery.isLoading

  const refetchAll = () => {
    statsQuery.refetch()
    costsQuery.refetch()
    videosQuery.refetch()
    yppQuery.refetch()
  }

  // Insights data (R1). `status` distinguishes a provider failure, a channel with too little data, and a
  // legitimately empty result — all three used to render as the same "sync from YouTube first" sentence.
  // A missing status means a backend older than this change, which behaved like 'ok'.
  const insightsData    = insightsQuery.data
  const insightPoints   = insightsData?.insights ?? []
  const insightActions  = insightsData?.actions ?? []
  const insightsStatus  = insightsData?.status ?? 'ok'

  // Weekly digest (R1). There is no `digest` string on this payload — there never was, which is why the
  // panel was permanently empty. The digest is `top_patterns` + `action_items` + `insights`.
  const digestData      = digestQuery.data
  const digestStatus    = digestData?.status ?? 'ok'
  const digestPatterns  = digestData?.top_patterns ?? []
  const digestActions   = digestData?.action_items ?? []
  const bestTimes: any[] = (bestTimesQuery.data as any)?.recommendations ?? []
  const bestTimesHasEnoughData = !!(bestTimesQuery.data as any)?.has_enough_data
  const trafficSources: [string, number][] = Object.entries((trafficQuery.data as any)?.sources ?? {})
    .sort((a: any, b: any) => b[1] - a[1]) as [string, number][]
  const trafficTotal = trafficSources.reduce((s, [, v]) => s + v, 0)

  // Retention: default to the best-performing video, since that is the one whose
  // retention is worth learning from. Re-runs only while nothing is selected.
  const retentionVideos = (filteredVideos as any[]).filter((v: any) => v.youtube_id).slice(0, 30)
  useEffect(() => {
    if (retentionVideoId || retentionVideos.length === 0) return
    setRetentionVideoId(retentionVideos[0].youtube_id)
  }, [retentionVideos, retentionVideoId])
  const retentionReport: any = retentionQuery.data ?? null

  // Sync status
  const lastSynced: string | null = (syncStatusQuery.data as any)?.last_sync ?? null
  const fmtLastSynced = lastSynced
    ? `Synced ${new Date(lastSynced).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : 'Never synced'

  return (
    <div className="p-6 max-w-[1200px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Analytics</h1>
          <p className="text-[13px] text-[#525252] mt-0.5">Channel performance, API costs, and video history.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Last synced indicator */}
          <span className="text-[11px] text-[#A3A3A3]">{fmtLastSynced}</span>
          {/* Sync from YouTube */}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
          >
            {syncMutation.isPending
              ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
              : <Zap size={11} strokeWidth={1.5} />
            }
            {syncMutation.isPending ? 'Syncing…' : 'Sync from YouTube'}
          </button>
          <button
            onClick={refetchAll}
            disabled={loading}
            className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} strokeWidth={1.5} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Videos"
          value={loading ? '—' : fmt(stats.total_videos ?? videos.length)}
          sub="all time"
          icon={<Play size={16} strokeWidth={1.5} />}
        />
        <StatCard
          label="Views"
          value={loading ? '—' : fmt(stats.total_views)}
          sub="last 30 days synced"
          icon={<Eye size={16} strokeWidth={1.5} />}
        />
        <StatCard
          label="Subscribers Gained"
          value={loading ? '—' : fmt(stats.total_subs ?? ypp.subs)}
          sub="last 30 days synced"
          icon={<Users size={16} strokeWidth={1.5} />}
        />
        <StatCard
          label="Watch Hours"
          value={loading ? '—' : fmt(stats.total_watch_hours ?? ypp.watch_hours)}
          sub="last 30 days synced"
          icon={<Clock size={16} strokeWidth={1.5} />}
        />
      </div>

      {/* ── Middle row: costs + YPP ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* API cost breakdown (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E5E5] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">API Cost Breakdown</p>
              <p className="text-[10px] text-[#D4D4D4] mt-0.5">All channels (costs aren't tracked per channel)</p>
            </div>
            <span className="text-[13px] font-semibold text-[#0A0A0A]">{fmtUSD(totalCost)} total</span>
          </div>
          {costsQuery.isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map((i) => (
                <div key={i} className="flex items-center gap-3 py-2">
                  <div className="w-2 h-2 rounded-full bg-[#F5F5F5] animate-pulse" />
                  <div className="flex-1 h-3 bg-[#F5F5F5] rounded animate-pulse" />
                  <div className="w-16 h-3 bg-[#F5F5F5] rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : !Array.isArray(costs) || costs.length === 0 ? (
            <NoData label="cost" />
          ) : (
            <div>
              {costs.map((row: any) => (
                <CostRow
                  key={row.service ?? row.name}
                  service={row.service ?? row.name ?? 'Other'}
                  cost={row.cost ?? row.total ?? 0}
                  total={totalCost}
                />
              ))}
            </div>
          )}
        </div>

        {/* YPP Progress (1/3 width) */}
        {yppQuery.isLoading ? (
          <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 animate-pulse">
            <div className="h-3 w-24 bg-[#F5F5F5] rounded mb-4" />
            <div className="space-y-4">
              <div className="h-4 bg-[#F5F5F5] rounded" />
              <div className="h-4 bg-[#F5F5F5] rounded" />
            </div>
          </div>
        ) : (
          <YppProgress
            lifetime={yppLifetimeQuery.data}
            lifetimeLoading={yppLifetimeQuery.isLoading}
            lifetimeErrored={yppLifetimeQuery.isError}
            windowed={ypp}
          />
        )}
      </div>

      {/* ── Video history table ────────────────────────────────────────── */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">
            Video History
            {filteredVideos.length > 0 && (
              <span className="normal-case text-[#D4D4D4] ml-1.5">({filteredVideos.length})</span>
            )}
          </p>
          {channels.length > 0 && (
            <select
              value={channelFilter}
              onChange={(e) => { setChannelFilter(e.target.value); setChannelFilterTouched(true) }}
              className="h-6 pl-2 pr-5 text-[11px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
            >
              <option value="">All channels</option>
              {channels.map((ch: any) => (
                <option key={ch.slug} value={ch.slug}>
                  {ch.name ?? ch.slug}
                </option>
              ))}
            </select>
          )}
        </div>

        {videosQuery.isLoading ? (
          <div className="divide-y divide-[#F5F5F5]">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 animate-pulse">
                <div className="flex-1 h-3 bg-[#F5F5F5] rounded" />
                <div className="w-20 h-3 bg-[#F5F5F5] rounded" />
                <div className="w-14 h-3 bg-[#F5F5F5] rounded" />
                <div className="w-10 h-3 bg-[#F5F5F5] rounded" />
              </div>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <NoData label="video" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" data-testid="video-history-table">
              <thead>
                <tr className="border-b border-[#F5F5F5]">
                  {['Topic', 'Date', 'Status', 'Views', 'Click-through', 'Retention', 'Cost'].map((h, i) => (
                    <th
                      key={h}
                      title={h === 'Click-through' ? CTR_COLUMN_NOTE : undefined}
                      className={`px-4 py-2.5 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest ${i >= 3 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVideos.map((v: any, i: number) => (
                  <VideoRow key={v.id ?? v.job_id ?? i} video={v} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <CtrPanel />

      <ThumbnailAbPanel />

      {/* The pairing the extension made possible. Placed after the raw click-through table so the
          numbers it reads are directly above the reading of them. */}
      <CtrRetentionPanel channelSlug={channelFilter || undefined} />

      {/* §5.4 — the surface for what the generator is told. Placed with the other analytics panels because
          it is the same data read a different way: packaging vs content above, format over time here. */}
      <RetentionFeedbackPanel channelSlug={channelFilter || undefined} />
      {/* ── Best Time to Publish ───────────────────────────────────── */}
      <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setBestTimesOpen(!bestTimesOpen)
            if (!bestTimesLoaded) setBestTimesLoaded(true)
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Clock size={13} strokeWidth={1.5} className="text-[#0A0A0A]" />
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Best Time to Publish</p>
            {bestTimesLoaded && bestTimesQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            )}
          </div>
          {bestTimesOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
          }
        </button>
        {bestTimesOpen && (
          <div className="border-t border-[#E5E5E5] px-5 py-4">
            {!bestTimesLoaded || bestTimesQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Analyzing publish history…</span>
              </div>
            ) : bestTimes.length === 0 ? (
              <p className="text-[12px] text-[#A3A3A3] py-2">
                No publish history yet - sync from YouTube first, or publish a few videos to build a recommendation.
              </p>
            ) : (
              <div className="space-y-3">
                {!bestTimesHasEnoughData && (
                  <p className="text-[11px] text-[#D97706] bg-[#FFFBEB] rounded px-2.5 py-1.5">
                    Early estimate - based on a small sample so far. Recommendations will sharpen as you publish more.
                  </p>
                )}
                <p className="text-[12px] text-[#525252]">
                  Ranked by views-per-day-since-publish (not raw views), so newer videos aren't unfairly outranked by older ones that simply had more time to accumulate views.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bestTimes.map((bt: any, i: number) => (
                    <div key={i} className="flex items-center justify-between border border-[#E5E5E5] rounded-lg px-3 py-2.5">
                      <div>
                        <p className="text-[13px] font-semibold text-[#0A0A0A]">{bt.day} · {bt.time_block}</p>
                        <p className="text-[10px] text-[#A3A3A3]">{bt.sample_size} video{bt.sample_size !== 1 ? 's' : ''}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[#525252]">{bt.avg_velocity} views/day</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── Traffic Sources ───────────────────────────────────────── */}
      <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setTrafficOpen(!trafficOpen)
            if (!trafficLoaded) setTrafficLoaded(true)
          }}
          disabled={!channelFilter}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={13} strokeWidth={1.5} className="text-[#0A0A0A]" />
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Traffic Sources</p>
            {trafficLoaded && trafficQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            )}
          </div>
          {trafficOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
          }
        </button>
        {!channelFilter && (
          <p className="px-5 pb-3 text-[11px] text-[#A3A3A3]">Select a specific channel above to see its traffic sources.</p>
        )}
        {trafficOpen && channelFilter && (
          <div className="border-t border-[#E5E5E5] px-5 py-4">
            {!trafficLoaded || trafficQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Fetching traffic sources from YouTube…</span>
              </div>
            ) : trafficSources.length === 0 ? (
              <p className="text-[12px] text-[#A3A3A3] py-2">
                No traffic source data yet - this channel may need more views in the last 30 days.
              </p>
            ) : (
              <div className="space-y-2.5">
                <p className="text-[11px] text-[#A3A3A3] mb-1">Channel-wide, last 30 days - live from YouTube</p>
                {trafficSources.map(([source, views]: [string, number]) => {
                  const pct = trafficTotal > 0 ? Math.round((views / trafficTotal) * 100) : 0
                  return (
                    <div key={source} className="flex items-center gap-3">
                      <span className="text-[12px] text-[#0A0A0A] w-36 flex-shrink-0 capitalize">
                        {source.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      <div className="flex-1 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#0A0A0A]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-[#A3A3A3] w-16 text-right">{fmt(views)} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {/* ── Retention Post-Mortem (§29.43) ──────────────────────────────
           YouTube's retention curve says where viewers left. We generated the
           script, so we can name the sentence they left during — the one thing
           vidIQ/TubeBuddy cannot do, because they never had the script. ── */}
      <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setRetentionOpen(!retentionOpen)
            if (!retentionLoaded) setRetentionLoaded(true)
          }}
          disabled={!channelFilter}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <BarChart2 size={13} strokeWidth={1.5} className="text-[#0A0A0A]" />
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Retention Post-Mortem</p>
            {retentionLoaded && retentionQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            )}
          </div>
          {retentionOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
          }
        </button>
        {!channelFilter && (
          <p className="px-5 pb-3 text-[11px] text-[#A3A3A3]">Select a specific channel above to see where viewers left.</p>
        )}
        {retentionOpen && channelFilter && (
          <div className="border-t border-[#E5E5E5] px-5 py-4 space-y-4">
            {retentionVideos.length === 0 ? (
              <p className="text-[12px] text-[#A3A3A3]">No published videos for this channel yet.</p>
            ) : (
              <select
                value={retentionVideoId}
                onChange={(e) => { setRetentionVideoId(e.target.value); explainMutation.reset() }}
                className="w-full text-[12px] text-[#0A0A0A] border border-[#E5E5E5] rounded-md px-3 py-2 bg-white"
              >
                {retentionVideos.map((v: any) => (
                  <option key={v.youtube_id} value={v.youtube_id}>
                    {String(v.title || v.youtube_id).slice(0, 70)} — {fmt(v.views)} views
                  </option>
                ))}
              </select>
            )}

            {retentionQuery.isError ? (
              <p className="text-[12px] text-[#B45309]">
                {(retentionQuery.error as any)?.response?.data?.detail
                  || 'No retention data for this video yet — YouTube publishes the curve once it has watch time.'}
              </p>
            ) : retentionQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Fetching the retention curve from YouTube…</span>
              </div>
            ) : retentionReport ? (
              <>
                {/* One point per 1% of the video; shaded bands are the cliffs. */}
                <div>
                  <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="w-full h-24 bg-[#FAFAFA] rounded-md">
                    {(retentionReport.dropoffs ?? []).map((d: any, i: number) => (
                      <rect
                        key={i}
                        x={d.start_ratio * 100}
                        y={0}
                        width={Math.max((d.end_ratio - d.start_ratio) * 100, 0.5)}
                        height={30}
                        fill="#BE123C"
                        opacity={0.12}
                      />
                    ))}
                    <polyline
                      fill="none"
                      stroke="#0A0A0A"
                      strokeWidth={0.7}
                      points={(retentionReport.points ?? [])
                        .filter((p: any) => typeof p.watch_ratio === 'number')
                        .map((p: any) => `${p.ratio * 100},${30 - p.watch_ratio * 30}`)
                        .join(' ')}
                    />
                  </svg>
                  <p className="text-[11px] text-[#A3A3A3] mt-1">
                    Share of viewers still watching: {Math.round((retentionReport.curve?.start ?? 0) * 100)}% at the
                    start → {Math.round((retentionReport.curve?.end ?? 0) * 100)}% at the end.
                    {retentionReport.source === 'cache' ? ' Cached.' : ' Live from YouTube.'}
                  </p>
                </div>

                {(retentionReport.dropoffs ?? []).length > 0 && (
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Where they left</p>
                    {(retentionReport.dropoffs ?? []).map((d: any, i: number) => (
                      <div key={i} className="border-l-2 border-[#FECDD3] pl-3">
                        <p className="text-[12px] text-[#0A0A0A]">
                          {d.segment_position} — {Math.round((d.loss_pct ?? 0) * 100)}% of the viewers still watching
                          left
                          {d.segment_index !== null && d.segment_index !== undefined
                            ? ` (segment ${d.segment_index + 1}, ${d.segment_type})`
                            : ''}
                        </p>
                        {d.segment_excerpt && (
                          <p className="text-[11px] text-[#737373] mt-0.5 italic">“{d.segment_excerpt}”</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {!retentionReport.segments_matched && (
                  <p className="text-[11px] text-[#A3A3A3]">
                    No script is stored for this video, so cliffs are named by position only. Scripts are kept from
                    the next render onwards.
                  </p>
                )}

                {(retentionReport.advice ?? []).length > 0 && (
                  <ul className="space-y-1.5">
                    {(retentionReport.advice ?? []).map((a: string, i: number) => (
                      <li key={i} className="text-[12px] text-[#525252]">• {a}</li>
                    ))}
                  </ul>
                )}

                <div className="pt-1">
                  <button
                    onClick={() => explainMutation.mutate()}
                    disabled={explainMutation.isPending}
                    className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md bg-[#0A0A0A] text-white hover:bg-[#171717] disabled:opacity-50"
                  >
                    {explainMutation.isPending
                      ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                      : <Sparkles size={12} strokeWidth={1.5} />}
                    Explain what to change
                  </button>
                  {explainMutation.data && (
                    <div className="mt-3 text-[12px] text-[#0A0A0A] whitespace-pre-wrap leading-5">
                      {(explainMutation.data as any).ok
                        ? (explainMutation.data as any).narrative
                        : (explainMutation.data as any).error}
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {/* ── AI Growth Coach (headline feature - auto-expanded, visually distinct
           from the other collapsible cards below; this is the differentiator vs.
           vidIQ/TubeBuddy's static checklists, see FEATURE_PRIORITY_ROADMAP.md P2 #18) ── */}
      <div className="mt-4 bg-[#0A0A0A] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setInsightsOpen(!insightsOpen)
            if (!insightsLoaded) setInsightsLoaded(true)
          }}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#171717] transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles size={12} strokeWidth={1.5} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-[12px] font-semibold text-white">AI Growth Coach</p>
              <p className="text-[10px] text-white/50">Personalized, data-grounded recommendations - not a generic checklist</p>
            </div>
            {insightsLoaded && insightsQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-white/50" />
            )}
          </div>
          {insightsOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-white/50" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-white/50" />
          }
        </button>
        {insightsOpen && (
          <div className="border-t border-white/10 px-5 py-4 bg-white">
            {!insightsLoaded || insightsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Generating insights…</span>
              </div>
            ) : insightsQuery.isError ? (
              <p className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">
                Could not reach the insights service. That is a request failure, not missing data.
              </p>
            ) : insightsStatus === 'error' ? (
              <p className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">
                {insightsData?.error || 'Insight generation failed.'}
              </p>
            ) : insightsStatus === 'insufficient_data' ? (
              <p className="text-[12px] text-[#525252] bg-[#FAFAFA] rounded px-3 py-2">
                {insightsData?.message
                  || 'Not enough performance data yet — at least three videos with synced analytics are needed.'}
              </p>
            ) : (
              <div className="space-y-4">
                {insightPoints.length === 0 && (
                  <p className="text-[12px] text-[#A3A3A3] py-2">
                    No patterns stood out in this period. That is a result, not a failure.
                  </p>
                )}
                {/* The heading is `title`. The page used to read `pt.label` and fall back to
                    JSON.stringify(pt), so every card rendered as raw JSON with no heading (R1/F5). */}
                {insightPoints.map((pt, i) => (
                  <div key={i} className="border-l-2 border-[#E5E5E5] pl-3">
                    <p className="text-[11px] font-semibold text-[#0A0A0A] uppercase tracking-widest mb-0.5">
                      {pt.icon ? `${pt.icon} ` : ''}{pt.title || 'Untitled pattern'}
                    </p>
                    {(pt.metric || pt.effect) && (
                      <p className="text-[12px] text-[#525252]">
                        {pt.metric}{pt.metric && pt.effect ? ' · ' : ''}{pt.effect}
                      </p>
                    )}
                    {typeof pt.confidence === 'number' && (
                      <p className="text-[11px] text-[#A3A3A3]">
                        {Math.round(pt.confidence * 100)}% confidence
                      </p>
                    )}
                  </div>
                ))}
                {insightsData?.summary && (
                  <p className="text-[13px] text-[#525252] leading-relaxed border-t border-[#F5F5F5] pt-3">
                    {insightsData.summary}
                  </p>
                )}
                {/* Actions live in a separate top-level list and were never rendered at all. */}
                {insightActions.length > 0 && (
                  <div className="border-t border-[#F5F5F5] pt-3">
                    <p className="text-[11px] font-semibold text-[#0A0A0A] uppercase tracking-widest mb-1.5">
                      Suggested actions
                    </p>
                    <ul className="space-y-1">
                      {insightActions.map((a, i) => (
                        <li key={i} className="text-[12px] text-[#525252] flex gap-2">
                          <span className="text-[#A3A3A3]">–</span>
                          <span>{a.action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  onClick={() => insightsQuery.refetch()}
                  className="flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0A0A0A] transition-colors mt-1"
                >
                  <RefreshCw size={10} strokeWidth={1.5} /> Refresh insights
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Weekly Digest ──────────────────────────────────────────────── */}
      <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setDigestOpen(!digestOpen)
            if (!digestLoaded) setDigestLoaded(true)
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Zap size={13} strokeWidth={1.5} className="text-[#0A0A0A]" />
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Weekly Digest</p>
            {digestLoaded && digestQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            )}
          </div>
          {digestOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
          }
        </button>
        {digestOpen && (
          <div className="border-t border-[#E5E5E5] px-5 py-4">
            {!digestLoaded || digestQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Generating digest…</span>
              </div>
            ) : digestQuery.isError ? (
              <p className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">
                Could not reach the digest service. That is a request failure, not an empty digest.
              </p>
            ) : digestStatus === 'error' ? (
              <p className="text-[12px] text-[#B45309] bg-[#FFFBEB] rounded px-3 py-2">
                {digestData?.error || 'Digest generation failed.'}
              </p>
            ) : digestStatus === 'insufficient_data' ? (
              <p className="text-[12px] text-[#525252] bg-[#FAFAFA] rounded px-3 py-2">
                {digestData?.message
                  || 'Not enough performance data yet — at least three videos with synced analytics are needed.'}
              </p>
            ) : (
              <div className="space-y-3">
                {/* The digest is `top_patterns` + `action_items` + `insights`. The page used to read a
                    `digest` string that the backend has never produced, so this panel was permanently
                    empty and told fully-synced channels to "sync from YouTube" (R1/F5). */}
                {digestData?.subject && (
                  <p className="text-[12px] font-semibold text-[#0A0A0A]">
                    {digestData.subject}
                    {digestData.period ? <span className="text-[#A3A3A3] font-normal"> · {digestData.period}</span> : null}
                  </p>
                )}
                {digestData?.insights && (
                  <p className="text-[13px] text-[#525252] leading-relaxed whitespace-pre-wrap">
                    {digestData.insights}
                  </p>
                )}
                {digestPatterns.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#0A0A0A] uppercase tracking-widest mb-1.5">
                      Patterns
                    </p>
                    <ul className="space-y-1">
                      {digestPatterns.map((p, i) => (
                        <li key={i} className="text-[12px] text-[#525252]">
                          <span className="font-medium text-[#0A0A0A]">{p.name || 'Pattern'}</span>
                          {p.metric ? <span> — {p.metric}</span> : null}
                          {p.effect ? <span> ({p.effect})</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {digestActions.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-[#0A0A0A] uppercase tracking-widest mb-1.5">
                      Action items
                    </p>
                    <ul className="space-y-1">
                      {digestActions.map((a, i) => (
                        <li key={i} className="text-[12px] text-[#525252] flex gap-2">
                          <span className="text-[#A3A3A3]">–</span>
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {digestPatterns.length === 0 && digestActions.length === 0 && !digestData?.insights && (
                  <p className="text-[12px] text-[#A3A3A3] py-2">
                    No digest content in this period. That is a result, not a failure.
                  </p>
                )}
                <button
                  onClick={() => digestQuery.refetch()}
                  className="flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0A0A0A] transition-colors mt-3"
                >
                  <RefreshCw size={10} strokeWidth={1.5} /> Refresh digest
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
