import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity, Brain, RefreshCw, Key, Layers,
  DollarSign, CheckCircle2, XCircle, AlertCircle, Zap,
  BarChart2, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { analyticsApi, schedulerApi, byokApi, adminApi } from '@api/services'
import type { InsightCard } from '@api/services'
import { useChannels } from '@hooks/useJobs'
import { useAuthStore } from '@store/auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number | undefined | null, dec = 0) => {
  if (n === undefined || n === null) return '—'
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K'
  return n.toFixed(dec)
}

const fmtUSD = (n: number | undefined | null) =>
  n === undefined || n === null ? '—' : `$${n.toFixed(2)}`

const fmtRelative = (iso: string | undefined) => {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  sub,
  icon,
  state,
  linkLabel,
  linkPath,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ReactNode
  state: 'ok' | 'warn' | 'error' | 'neutral'
  linkLabel?: string
  linkPath?: string
}) {
  const stateColor = {
    ok:      'text-[#16A34A]',
    warn:    'text-[#D97706]',
    error:   'text-[#DC2626]',
    neutral: 'text-[#A3A3A3]',
  }[state]

  const dotColor = {
    ok:      'bg-[#16A34A]',
    warn:    'bg-[#D97706]',
    error:   'bg-[#DC2626]',
    neutral: 'bg-[#D4D4D4]',
  }[state]

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">{label}</span>
        <span className="text-[#D4D4D4]">{icon}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <span className="text-[20px] font-semibold text-[#0A0A0A] leading-none">{value}</span>
      </div>
      {sub && <span className="text-[11px] text-[#A3A3A3]">{sub}</span>}
      {linkLabel && linkPath && (
        <a
          href={linkPath}
          onClick={(e) => { e.preventDefault(); window.location.hash = linkPath }}
          className={`text-[11px] font-medium flex items-center gap-0.5 ${stateColor} hover:underline`}
        >
          {linkLabel} <ArrowRight size={10} strokeWidth={1.5} />
        </a>
      )}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-[#F5F5F5] rounded animate-pulse ${className}`} />
}

// ─── AI Digest Card ───────────────────────────────────────────────────────────

function DigestSection({ channelSlug }: { channelSlug: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-digest', channelSlug],
    queryFn:  () => analyticsApi.digest(channelSlug || undefined, 7),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // R1: same contract as AnalyticsPage. There is no `digest` string on this payload and never was, so
  // `data?.digest ?? data?.summary ?? data` fell through to the whole object, matched neither `.text` nor
  // `.content`, and rendered "No digest available yet" for every channel — including synced ones.
  const digestStatus   = data?.status ?? 'ok'
  const digestPatterns = data?.top_patterns ?? []
  const digestActions  = data?.action_items ?? []

  // Render the payload the API actually returns, rather than guessing at a `digest` string.
  const digestLines: string[] = []
  if (digestStatus === 'ok') {
    if (data?.subject) digestLines.push(`# ${data.subject}${data.period ? ` — ${data.period}` : ''}`)
    if (data?.insights) digestLines.push(data.insights)
    for (const p of digestPatterns) {
      const suffix = [p.metric, p.effect ? `(${p.effect})` : ''].filter(Boolean).join(' ')
      digestLines.push(`• ${p.name || 'Pattern'}${suffix ? ` — ${suffix}` : ''}`)
    }
    for (const a of digestActions) digestLines.push(`• ${a}`)
  }

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain size={14} strokeWidth={1.5} className="text-[#7C3AED]" />
          <p className="text-[11px] font-medium text-[#0A0A0A] uppercase tracking-widest">Weekly AI Digest</p>
        </div>
        <button
          onClick={() => refetch()}
          aria-label="Refresh digest"
          className="text-[#A3A3A3] hover:text-[#525252] transition-colors"
          title="Refresh digest"
        >
          <RefreshCw size={12} strokeWidth={1.5} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
          <Skeleton className="h-3 w-full mt-4" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-[12px] text-[#B45309] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          Could not reach the digest service. That is a request failure, not an empty digest.
        </div>
      ) : digestStatus === 'error' ? (
        <div className="flex items-center gap-2 text-[12px] text-[#B45309] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          {data?.error || 'Digest generation failed.'}
        </div>
      ) : digestStatus === 'insufficient_data' ? (
        <div className="flex items-center gap-2 text-[12px] text-[#525252] py-4">
          <BarChart2 size={13} strokeWidth={1.5} />
          {data?.message || 'Not enough performance data yet — at least three videos with synced analytics are needed.'}
        </div>
      ) : (
        <div className="prose-sm">
          {digestLines.length === 0 ? (
            <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] py-4">
              <BarChart2 size={13} strokeWidth={1.5} />
              No digest content in this period. That is a result, not a failure.
            </div>
          ) : digestLines.map((line: string, i: number) => {
            const isBullet  = line.trimStart().startsWith('•') || line.trimStart().startsWith('-') || line.trimStart().startsWith('*')
            const isHeading = /^#{1,3}\s/.test(line) || (/^[A-Z]/.test(line) && line.endsWith(':'))
            if (isHeading) {
              return (
                <p key={i} className="text-[12px] font-semibold text-[#0A0A0A] mt-3 mb-1 first:mt-0">
                  {line.replace(/^#{1,3}\s/, '')}
                </p>
              )
            }
            if (isBullet) {
              return (
                <div key={i} className="flex items-start gap-1.5 mb-1">
                  <span className="text-[#D4D4D4] mt-1 flex-shrink-0">•</span>
                  <span className="text-[13px] text-[#525252] leading-relaxed">
                    {line.replace(/^[•\-*]\s*/, '')}
                  </span>
                </div>
              )
            }
            return (
              <p key={i} className="text-[13px] text-[#525252] leading-relaxed mb-2">
                {line}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── AI Insights Card ─────────────────────────────────────────────────────────

function InsightsSection({ channelSlug }: { channelSlug: string }) {
  const [expanded, setExpanded] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-insights', channelSlug],
    queryFn:  () => analyticsApi.insights(channelSlug || undefined),
    staleTime: 5 * 60_000,
    retry: 1,
  })

  // R1: `insights` is always an array of cards on this payload. The old fallbacks — `Array.isArray(data)`
  // and `data.insight` — coped with shapes this endpoint has never returned, and the render below then
  // read `item.text`, which the card does not have, so every card printed as raw JSON.
  const insights: InsightCard[] = data?.insights ?? []
  const insightsStatus = data?.status ?? 'ok'

  const visible = expanded ? insights : insights.slice(0, 3)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap size={14} strokeWidth={1.5} className="text-[#D97706]" />
          <p className="text-[11px] font-medium text-[#0A0A0A] uppercase tracking-widest">AI Performance Insights</p>
        </div>
        {insights.length > 3 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-[#525252] hover:text-[#0A0A0A] flex items-center gap-0.5 transition-colors"
          >
            {expanded ? 'Show less' : `+${insights.length - 3} more`}
            {expanded ? <ChevronUp size={11} strokeWidth={1.5} /> : <ChevronDown size={11} strokeWidth={1.5} />}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map((i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Skeleton className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="flex items-center gap-2 text-[12px] text-[#B45309] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          Could not reach the insights service. That is a request failure, not missing data.
        </div>
      ) : insightsStatus === 'error' ? (
        <div className="flex items-center gap-2 text-[12px] text-[#B45309] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          {data?.error || 'Insight generation failed.'}
        </div>
      ) : insightsStatus === 'insufficient_data' ? (
        <div className="flex items-center gap-2 text-[12px] text-[#525252] py-4">
          <BarChart2 size={13} strokeWidth={1.5} />
          {data?.message || 'Not enough performance data yet — at least three videos with synced analytics are needed.'}
        </div>
      ) : insights.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          No patterns stood out in this period. That is a result, not a failure.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((card, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                style={{ background: typeof card.confidence === 'number' && card.confidence >= 0.7 ? '#DC2626' : '#A3A3A3' }}
              />
              <div className="flex-1">
                <p className="text-[13px] text-[#0A0A0A] leading-relaxed">
                  {card.icon ? `${card.icon} ` : ''}{card.title}
                </p>
                {(card.metric || card.effect) && (
                  <p className="text-[12px] text-[#525252]">
                    {card.metric}{card.metric && card.effect ? ' · ' : ''}{card.effect}
                  </p>
                )}
                {typeof card.confidence === 'number' && (
                  <p className="text-[11px] text-[#A3A3A3]">{Math.round(card.confidence * 100)}% confidence</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sync Control ─────────────────────────────────────────────────────────────

function SyncSection({ channelSlug }: { channelSlug: string }) {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  const statusQuery = useQuery({
    queryKey: ['admin-sync-status', channelSlug],
    queryFn:  () => analyticsApi.syncStatus(channelSlug || undefined),
    staleTime: 30_000,
    retry: 1,
  })

  const historyQuery = useQuery({
    queryKey: ['admin-sync-history', channelSlug],
    queryFn:  () => analyticsApi.syncHistory(channelSlug || undefined),
    staleTime: 60_000,
    retry: 1,
  })

  const syncMutation = useMutation({
    mutationFn: () => analyticsApi.triggerSync(channelSlug || undefined),
    onMutate: () => { setSyncing(true); setSyncMsg('') },
    onSuccess: (result) => {
      setSyncMsg(`Synced ${result?.synced ?? 0} records`)
      queryClient.invalidateQueries({ queryKey: ['admin-sync-status'] })
      queryClient.invalidateQueries({ queryKey: ['admin-sync-history'] })
      queryClient.invalidateQueries({ queryKey: ['admin-digest'] })
      queryClient.invalidateQueries({ queryKey: ['admin-insights'] })
    },
    onError: () => setSyncMsg('Sync failed - check channel authentication'),
    onSettled: () => setSyncing(false),
  })

  const status = statusQuery.data
  const history: any[] = historyQuery.data?.history ?? historyQuery.data ?? []

  const lastSync = status?.last_sync ?? status?.synced_at
  const nextSync = status?.next_sync
  const syncFreq = status?.sync_frequency ?? status?.settings?.sync_frequency ?? '—'

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E5E5]">
        <div className="flex items-center gap-2">
          <RefreshCw size={13} strokeWidth={1.5} className="text-[#2563EB]" />
          <p className="text-[11px] font-medium text-[#0A0A0A] uppercase tracking-widest">YouTube Analytics Sync</p>
        </div>
        <div className="flex items-center gap-2">
          {syncMsg && (
            <span className={`text-[11px] font-medium ${syncMsg.includes('failed') ? 'text-[#DC2626]' : 'text-[#16A34A]'}`}>
              {syncMsg}
            </span>
          )}
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncing}
            className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40"
          >
            <RefreshCw size={11} strokeWidth={1.5} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>
      </div>

      {/* Status row */}
      {statusQuery.isLoading ? (
        <div className="px-5 py-4 flex gap-6">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : (
        <div className="px-5 py-4 flex flex-wrap gap-6 border-b border-[#F5F5F5]">
          <div>
            <p className="text-[10px] text-[#A3A3A3] uppercase tracking-widest mb-1">Last Sync</p>
            <p className="text-[12px] text-[#0A0A0A] font-medium">{fmtRelative(lastSync)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#A3A3A3] uppercase tracking-widest mb-1">Next Sync</p>
            <p className="text-[12px] text-[#0A0A0A] font-medium">{nextSync ? fmtRelative(nextSync) : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#A3A3A3] uppercase tracking-widest mb-1">Frequency</p>
            <p className="text-[12px] text-[#0A0A0A] font-medium capitalize">{syncFreq}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#A3A3A3] uppercase tracking-widest mb-1">Status</p>
            <div className="flex items-center gap-1.5">
              {status?.status === 'ok' || status?.ok ? (
                <>
                  <CheckCircle2 size={11} strokeWidth={1.5} className="text-[#16A34A]" />
                  <span className="text-[12px] text-[#16A34A] font-medium">Active</span>
                </>
              ) : status?.status === 'error' ? (
                <>
                  <XCircle size={11} strokeWidth={1.5} className="text-[#DC2626]" />
                  <span className="text-[12px] text-[#DC2626] font-medium">Error</span>
                </>
              ) : (
                <>
                  <AlertCircle size={11} strokeWidth={1.5} className="text-[#A3A3A3]" />
                  <span className="text-[12px] text-[#A3A3A3] font-medium">Not configured</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sync history */}
      {historyQuery.isLoading ? (
        <div className="divide-y divide-[#F5F5F5]">
          {[1,2,3].map((i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4 animate-pulse">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20 ml-auto" />
            </div>
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="px-5 py-5 text-[12px] text-[#A3A3A3] text-center">
          No sync history yet. Run a sync to start tracking.
        </div>
      ) : (
        <div className="divide-y divide-[#F5F5F5]">
          {history.slice(0, 8).map((row: any, i: number) => {
            const ok = row.status === 'ok' || row.ok || row.success
            return (
              <div key={i} className="px-5 py-2.5 flex items-center gap-3">
                {ok
                  ? <CheckCircle2 size={12} strokeWidth={1.5} className="text-[#16A34A] flex-shrink-0" />
                  : <XCircle size={12} strokeWidth={1.5} className="text-[#DC2626] flex-shrink-0" />
                }
                <span className="text-[12px] text-[#525252] flex-1">
                  {row.channel_slug ?? row.channel ?? channelSlug ?? 'All channels'}
                </span>
                <span className="text-[11px] text-[#A3A3A3]">{fmt(row.synced ?? row.records)} records</span>
                <span className="text-[11px] text-[#A3A3A3] ml-auto">{fmtRelative(row.created_at ?? row.synced_at ?? row.timestamp)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Margin section (W9) ──────────────────────────────────────────────────────

function MarginSection({
  data,
  isLoading,
}: {
  data?: Awaited<ReturnType<typeof adminApi.margin>>
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="border border-[#E5E5E5] rounded-lg p-5 mb-6">
        <p className="text-[12px] text-[#A3A3A3]">Loading margin…</p>
      </div>
    )
  }
  if (!data?.ok) return null

  const t = data.totals
  const marginState = t.margin_pct === null ? 'neutral'
    : t.margin_pct >= 50 ? 'ok' : t.margin_pct >= 20 ? 'warn' : 'error'

  return (
    <div className="border border-[#E5E5E5] rounded-lg mb-6">
      <div className="px-4 py-3 border-b border-[#E5E5E5] flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#0A0A0A]">Gross margin by customer</p>
          <p className="text-[11px] text-[#A3A3A3] mt-0.5">
            Last {data.days} days · cost is our provider exposure (BYOK spend is the customer's)
          </p>
        </div>
        {t.custom_priced_users > 0 && (
          <span className="text-[10px] text-[#A3A3A3]">
            {t.custom_priced_users} custom-priced user{t.custom_priced_users !== 1 ? 's' : ''} excluded from margin
          </span>
        )}
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-[#F5F5F5] border-b border-[#E5E5E5]">
        {[
          { label: 'Revenue', value: fmtUSD(t.revenue_usd), sub: `${t.paying_users} paying of ${t.users}` },
          { label: 'Provider cost', value: fmtUSD(t.cost_usd), sub: 'all users incl. free' },
          { label: 'Gross margin', value: t.margin_pct === null ? '—' : `${t.margin_pct.toFixed(1)}%`,
            sub: t.margin_pct === null ? 'no paying customers yet' : 'priced accounts only',
            state: marginState },
          { label: 'Throttle trigger', value: `${(data.throttle_ratio * 100).toFixed(0)}%`,
            sub: 'cost vs plan revenue' },
        ].map((c) => (
          <div key={c.label} className="px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest text-[#A3A3A3] font-medium">{c.label}</p>
            <p className={`text-[16px] font-semibold mt-0.5 ${
              c.state === 'error' ? 'text-[#DC2626]'
              : c.state === 'warn' ? 'text-[#B45309]' : 'text-[#0A0A0A]'
            }`}>{c.value}</p>
            <p className="text-[10px] text-[#A3A3A3] mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* By plan */}
      <div className="px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#525252] uppercase tracking-wide mb-2">By plan</p>
        <div className="space-y-1">
          {data.by_plan.map((p) => (
            <div key={p.plan} className="flex items-center justify-between text-[12px] py-1">
              <span className="text-[#0A0A0A] capitalize w-24">{p.plan}</span>
              <span className="text-[#A3A3A3] w-16">{p.users} user{p.users !== 1 ? 's' : ''}</span>
              <span className="text-[#525252] w-20">{fmtUSD(p.revenue_usd)} rev</span>
              <span className="text-[#525252] w-20">{fmtUSD(p.cost_usd)} cost</span>
              <span className={`w-16 text-right ${
                p.margin_pct === null ? 'text-[#A3A3A3]'
                : p.margin_pct < 20 ? 'text-[#DC2626]' : 'text-[#16A34A]'
              }`}>
                {p.margin_pct === null ? (p.custom_pricing ? 'custom' : '—') : `${p.margin_pct.toFixed(1)}%`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Top spenders */}
      <div className="px-4 py-3">
        <p className="text-[11px] font-medium text-[#525252] uppercase tracking-wide mb-2">
          Top spenders
        </p>
        {data.top_spenders.length === 0 || data.top_spenders.every((u) => u.cost_usd === 0) ? (
          <p className="text-[12px] text-[#A3A3A3]">
            No provider spend recorded yet. This fills in once real renders run through the meter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-[#A3A3A3]">
                  <th className="text-left font-medium pb-1.5">Customer</th>
                  <th className="text-left font-medium pb-1.5">Plan</th>
                  <th className="text-right font-medium pb-1.5">Cost</th>
                  <th className="text-right font-medium pb-1.5">Margin</th>
                  <th className="text-right font-medium pb-1.5">Credits</th>
                  <th className="text-left font-medium pb-1.5 pl-3">Top provider</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F5F5]">
                {data.top_spenders.map((u) => (
                  <tr key={u.user_id}>
                    <td className="py-1.5 text-[#525252] truncate max-w-[180px]">
                      {u.email ?? u.user_id.slice(0, 8)}
                      {u.throttled && (
                        <span className="ml-2 text-[9px] font-bold uppercase tracking-widest bg-[#FEF2F2] text-[#DC2626] px-1.5 py-0.5 rounded">
                          Throttled
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 text-[#A3A3A3] capitalize">{u.plan}</td>
                    <td className="py-1.5 text-right text-[#0A0A0A]">{fmtUSD(u.cost_usd)}</td>
                    <td className={`py-1.5 text-right ${
                      u.margin_pct === null ? 'text-[#A3A3A3]'
                      : u.margin_pct < 20 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                    }`}>
                      {u.margin_pct === null ? '—' : `${u.margin_pct.toFixed(1)}%`}
                    </td>
                    <td className="py-1.5 text-right text-[#A3A3A3]">
                      {u.credits_remaining ?? '—'}
                    </td>
                    <td className="py-1.5 pl-3 text-[#525252]">{u.top_provider ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuthStore()
  // The job filter spans every account, so it asks for the deployment-wide channel list explicitly --
  // this is the one place that legitimately wants it.
  const { data: channels = [] } = useChannels(true)
  const [channelSlug, setChannelSlug] = useState('')

  // System health queries
  const byokQuery = useQuery({
    queryKey: ['admin-byok'],
    queryFn:  byokApi.status,
    staleTime: 5 * 60_000,
  })

  const schedulerQuery = useQuery({
    queryKey: ['admin-scheduler'],
    queryFn:  () => schedulerApi.status(channelSlug || undefined),
    staleTime: 60_000,
  })

  const costsQuery = useQuery({
    queryKey: ['admin-costs'],
    queryFn:  analyticsApi.costs,
    staleTime: 5 * 60_000,
  })

  // W9: per-user margin. Cross-user, so the endpoint is require_admin-gated
  // server-side -- the client gate below is only a convenience.
  const marginQuery = useQuery({
    queryKey: ['admin-margin'],
    queryFn:  () => adminApi.margin(30),
    staleTime: 5 * 60_000,
  })

  // Derived health values
  const byokStatus = byokQuery.data ?? {}
  const connectedCount = Object.values(byokStatus as Record<string, boolean>).filter(Boolean).length
  const totalServices  = 8 // anthropic, elevenlabs, pexels, suno, mureka, kling, kling_secret, minimax
  const byokState: 'ok' | 'warn' | 'error' =
    connectedCount === totalServices ? 'ok' : connectedCount >= 4 ? 'warn' : 'error'

  const scheduler      = schedulerQuery.data
  const schedulerOk    = scheduler?.status?.running || scheduler?.ok
  const schedulerState: 'ok' | 'warn' | 'error' | 'neutral' = schedulerOk ? 'ok' : scheduler ? 'warn' : 'neutral'
  const queueDepth     = scheduler?.queue?.pending_count ?? scheduler?.queue_count ?? null

  const costs = costsQuery.data ?? []
  const totalCost = Array.isArray(costs)
    ? costs.reduce((s: number, r: any) => s + (r.cost ?? r.total ?? 0), 0)
    : 0

  const refetchAll = () => {
    byokQuery.refetch()
    schedulerQuery.refetch()
    costsQuery.refetch()
    marginQuery.refetch()
  }

  // Client-side gate - the nav link is already hidden for non-admins, this
  // blocks direct URL navigation too. Placed after all hooks (Rules of
  // Hooks) so the guard doesn't change hook-call order across renders.
  // The backend endpoints this page calls are shared with the regular per-channel Analytics/Settings
  // pages, so this is a UI-level guard -- but it is no longer the *only* guard. TEST.md §29.22/§29.23
  // scoped those endpoints: `resolve_owned_channel()` returns a channel the caller owns or refuses,
  // and never `None` (which is what used to widen a query to every channel on the deployment). So a
  // customer who reaches one of them directly gets their own channel's data or a 404, not the
  // platform's. This redirect is the courtesy on top of that.
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  if (user && !isAdmin) return <Navigate to="/app" replace />

  return (
    <div className="p-6 max-w-[1200px]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Admin</h1>
          <p className="text-[13px] text-[#525252] mt-0.5">Platform intelligence, AI insights, and system health.</p>
        </div>
        <div className="flex items-center gap-2">
          {channels.length > 0 && (
            <select
              value={channelSlug}
              onChange={(e) => setChannelSlug(e.target.value)}
              className="h-7 pl-2 pr-7 text-[11px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors appearance-none"
            >
              <option value="">All channels</option>
              {channels.map((ch: any) => (
                <option key={ch.slug} value={ch.slug}>
                  {ch.name ?? ch.slug}{ch.is_mine === false && ch.owner_email ? ` — ${ch.owner_email}` : ''}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={refetchAll}
            className="flex items-center gap-1.5 h-7 px-3 text-[11px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors"
          >
            <RefreshCw size={11} strokeWidth={1.5} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── System Health ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <HealthCard
          label="API Keys"
          value={byokQuery.isLoading ? '—' : `${connectedCount}/${totalServices}`}
          sub={connectedCount < totalServices ? `${totalServices - connectedCount} service${totalServices - connectedCount !== 1 ? 's' : ''} missing` : 'All services connected'}
          icon={<Key size={14} strokeWidth={1.5} />}
          state={byokQuery.isLoading ? 'neutral' : byokState}
          linkLabel="Manage in Settings"
          linkPath="/app/settings"
        />
        <HealthCard
          label="Scheduler"
          value={schedulerQuery.isLoading ? '—' : schedulerOk ? 'Running' : 'Idle'}
          sub={
            scheduler?.status?.last_run
              ? `Last run ${fmtRelative(scheduler.status.last_run)}`
              : scheduler?.metrics?.last_run_at
                ? `Last run ${fmtRelative(scheduler.metrics.last_run_at)}`
                : 'No recent runs'
          }
          icon={<Activity size={14} strokeWidth={1.5} />}
          state={schedulerQuery.isLoading ? 'neutral' : schedulerState}
        />
        <HealthCard
          label="Queue Depth"
          value={schedulerQuery.isLoading ? '—' : queueDepth !== null ? String(queueDepth) : '—'}
          sub="pending topics"
          icon={<Layers size={14} strokeWidth={1.5} />}
          state={queueDepth === null ? 'neutral' : queueDepth > 0 ? 'ok' : 'warn'}
          linkLabel="View Queue"
          linkPath="/app/queue"
        />
        <HealthCard
          label="Cost This Month"
          value={costsQuery.isLoading ? '—' : fmtUSD(totalCost)}
          sub="across all services"
          icon={<DollarSign size={14} strokeWidth={1.5} />}
          state={totalCost > 50 ? 'warn' : totalCost > 0 ? 'ok' : 'neutral'}
          linkLabel="Full breakdown"
          linkPath="/app/analytics"
        />
      </div>

      {/* ── Gross margin (W9) ─────────────────────────────────────────── */}
      <MarginSection data={marginQuery.data} isLoading={marginQuery.isLoading} />

      {/* ── AI Intelligence ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <DigestSection channelSlug={channelSlug} />
        <InsightsSection channelSlug={channelSlug} />
      </div>

      {/* ── Analytics Sync ────────────────────────────────────────────── */}
      <SyncSection channelSlug={channelSlug} />
    </div>
  )
}
