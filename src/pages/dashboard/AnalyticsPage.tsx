import React, { useState } from 'react'
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
      <td className="px-4 py-3 text-[12px] text-[#525252] text-right">{fmtUSD(video.cost ?? video.total_cost)}</td>
    </tr>
  )
}

// ─── YPP Progress ─────────────────────────────────────────────────────────────

function YppProgress({ ypp }: { ypp: any }) {
  const hours    = ypp?.watch_hours ?? 0
  const subs     = ypp?.subscribers ?? 0
  const hoursPct = Math.min(Math.round((hours / 4000) * 100), 100)
  const subsPct  = Math.min(Math.round((subs  / 1000) * 100), 100)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-4">YPP Progress</p>
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
  const [insightsOpen,   setInsightsOpen]   = useState(false)
  const [digestOpen,     setDigestOpen]     = useState(false)
  const [insightsLoaded, setInsightsLoaded] = useState(false)
  const [digestLoaded,   setDigestLoaded]   = useState(false)

  const statsQuery = useQuery({
    queryKey: ['analytics-stats'],
    queryFn:  analyticsApi.channelStats,
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
    queryKey: ['analytics-ypp'],
    queryFn:  analyticsApi.ypp,
    staleTime: 60_000,
  })
  const syncStatusQuery = useQuery({
    queryKey: ['analytics-sync-status'],
    queryFn:  () => analyticsApi.syncStatus(),
    staleTime: 120_000,
  })
  const insightsQuery = useQuery({
    queryKey: ['analytics-insights'],
    queryFn:  () => analyticsApi.insights(),
    staleTime: 300_000,
    enabled:  insightsLoaded,
  })
  const digestQuery = useQuery({
    queryKey: ['analytics-digest'],
    queryFn:  () => analyticsApi.digest(),
    staleTime: 300_000,
    enabled:  digestLoaded,
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
    onError: () => toast.error('Sync failed — check YouTube OAuth in Channels'),
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
          label="Total Views"
          value={loading ? '—' : fmt(stats.total_views ?? ypp.views)}
          sub={stats.views_30d ? `+${fmt(stats.views_30d)} this month` : undefined}
          icon={<Eye size={16} strokeWidth={1.5} />}
          trend={stats.views_trend}
        />
        <StatCard
          label="Subscribers"
          value={loading ? '—' : fmt(stats.subscribers ?? ypp.subscribers)}
          sub={stats.subs_gained_30d ? `+${fmt(stats.subs_gained_30d)} this month` : undefined}
          icon={<Users size={16} strokeWidth={1.5} />}
          trend={stats.subs_trend}
        />
        <StatCard
          label="Watch Hours"
          value={loading ? '—' : fmt(stats.watch_hours ?? ypp.watch_hours)}
          sub="total"
          icon={<Clock size={16} strokeWidth={1.5} />}
        />
      </div>

      {/* ── Middle row: costs + YPP ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

        {/* API cost breakdown (2/3 width) */}
        <div className="lg:col-span-2 bg-white border border-[#E5E5E5] rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">API Cost Breakdown</p>
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
          <YppProgress ypp={ypp} />
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
              onChange={(e) => setChannelFilter(e.target.value)}
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
                  {['Topic', 'Date', 'Status', 'Views', 'Cost'].map((h, i) => (
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

      {/* ── AI Insights ─────────────────────────────────────────────────── */}
      <div className="mt-4 bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => {
            setInsightsOpen(!insightsOpen)
            if (!insightsLoaded) setInsightsLoaded(true)
          }}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#FAFAFA] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles size={13} strokeWidth={1.5} className="text-[#0A0A0A]" />
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">AI Insights</p>
            {insightsLoaded && insightsQuery.isLoading && (
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            )}
          </div>
          {insightsOpen
            ? <ChevronUp size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
            : <ChevronDown size={13} strokeWidth={1.5} className="text-[#A3A3A3]" />
          }
        </button>
        {insightsOpen && (
          <div className="border-t border-[#E5E5E5] px-5 py-4">
            {!insightsLoaded || insightsQuery.isLoading ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                <span className="text-[12px] text-[#A3A3A3]">Generating insights…</span>
              </div>
            ) : insightPoints.length === 0 ? (
              <p className="text-[12px] text-[#A3A3A3] py-2">
                No insights yet — sync from YouTube first to generate performance data.
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
                No digest available — sync from YouTube to generate a weekly summary.
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
