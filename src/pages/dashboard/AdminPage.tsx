import React, { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Activity, Brain, RefreshCw, Key, Clock, Layers,
  DollarSign, CheckCircle2, XCircle, AlertCircle, Zap,
  BarChart2, ArrowRight, ChevronDown, ChevronUp,
} from 'lucide-react'
import { analyticsApi, schedulerApi, byokApi } from '@api/services'
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

const fmtDate = (iso: string | undefined) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })
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

  const digest = data?.digest ?? data?.summary ?? data

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
        <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          Digest unavailable — YouTube Analytics sync may be needed.
        </div>
      ) : typeof digest === 'string' ? (
        <div className="prose-sm">
          {digest.split('\n').filter(Boolean).map((line: string, i: number) => {
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
                    {line.replace(/^[\•\-\*]\s*/, '')}
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
      ) : digest?.text || digest?.content ? (
        <p className="text-[13px] text-[#525252] leading-relaxed whitespace-pre-wrap">
          {digest.text ?? digest.content}
        </p>
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] py-4">
          <BarChart2 size={13} strokeWidth={1.5} />
          No digest available yet. Sync YouTube Analytics to generate insights.
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

  const insights: any[] = Array.isArray(data?.insights)
    ? data.insights
    : Array.isArray(data)
      ? data
      : data?.insight
        ? [{ text: data.insight }]
        : []

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
      ) : isError || insights.length === 0 ? (
        <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3] py-4">
          <AlertCircle size={13} strokeWidth={1.5} />
          {isError ? 'Insights unavailable — sync YouTube Analytics to enable.' : 'No insights yet. Sync to generate AI analysis.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((item: any, i: number) => {
            const text = typeof item === 'string' ? item : item.text ?? item.insight ?? item.content ?? JSON.stringify(item)
            const priority = item.priority ?? item.severity ?? 'info'
            const dotColor = priority === 'high' ? '#DC2626' : priority === 'medium' ? '#D97706' : '#A3A3A3'
            return (
              <div key={i} className="flex items-start gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: dotColor }}
                />
                <p className="text-[13px] text-[#525252] leading-relaxed">{text}</p>
              </div>
            )
          })}
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
    onError: () => setSyncMsg('Sync failed — check channel authentication'),
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

// ─── Admin Page ───────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { user } = useAuthStore()
  const { data: channels = [] } = useChannels()
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
  }

  // Client-side gate — the nav link is already hidden for non-admins, this
  // blocks direct URL navigation too. Placed after all hooks (Rules of
  // Hooks) so the guard doesn't change hook-call order across renders.
  // The backend endpoints this page calls are intentionally shared with
  // regular per-channel Analytics/Settings pages (see TEST.md §25), so this
  // is a UI-level guard, not a data-layer fix.
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
                  {ch.name ?? ch.slug}
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
