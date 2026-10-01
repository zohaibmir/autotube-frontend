import React, { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  TrendingUp, Eye, Users, Clock, DollarSign, Play,
  BarChart2, AlertCircle, RefreshCw, Sparkles, Zap, ChevronDown, ChevronUp, Loader2,
} from 'lucide-react'
import { analyticsApi } from '@api/services'
import { useChannels } from '@hooks/useJobs'
import { useToast } from '@components/Toast'

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

  // Insights data
  const insightPoints: any[] = (insightsQuery.data as any)?.insights ?? []
  const digestText: string    = (digestQuery.data as any)?.digest ?? ''
  const bestTimes: any[] = (bestTimesQuery.data as any)?.recommendations ?? []
  const bestTimesHasEnoughData = !!(bestTimesQuery.data as any)?.has_enough_data
  const trafficSources: [string, number][] = Object.entries((trafficQuery.data as any)?.sources ?? {})
    .sort((a: any, b: any) => b[1] - a[1]) as [string, number][]
  const trafficTotal = trafficSources.reduce((s, [, v]) => s + v, 0)

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
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F5F5F5]">
                  {['Topic', 'Date', 'Status', 'Views', 'Retention', 'Cost'].map((h, i) => (
                    <th
                      key={h}
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
            ) : insightPoints.length === 0 ? (
              <p className="text-[12px] text-[#A3A3A3] py-2">
                No insights yet - sync from YouTube first to generate performance data.
              </p>
            ) : (
              <div className="space-y-4">
                {insightPoints.map((pt: any, i: number) => (
                  <div key={i} className="border-l-2 border-[#E5E5E5] pl-3">
                    {pt.label && (
                      <p className="text-[11px] font-semibold text-[#0A0A0A] uppercase tracking-widest mb-0.5">
                        {pt.label}
                      </p>
                    )}
                    <p className="text-[13px] text-[#525252] leading-relaxed">
                      {pt.text ?? pt.insight ?? pt.message ?? JSON.stringify(pt)}
                    </p>
                    {pt.action && (
                      <p className="text-[11px] text-[#2563EB] mt-1">{pt.action}</p>
                    )}
                  </div>
                ))}
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
            ) : !digestText ? (
              <p className="text-[12px] text-[#A3A3A3] py-2">
                No digest available - sync from YouTube to generate a weekly summary.
              </p>
            ) : (
              <div>
                <p className="text-[13px] text-[#525252] leading-relaxed whitespace-pre-wrap">{digestText}</p>
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
