import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Filter,
} from 'lucide-react'
import { socialApi } from '@api/services'
import { useToast } from '@components/Toast'

// ── Platform config ───────────────────────────────────────────────────────────

type Platform = 'instagram' | 'tiktok' | 'facebook' | 'reddit' | 'telegram' | string

const PLATFORM_META: Record<string, { label: string; dot: string }> = {
  instagram: { label: 'Instagram', dot: 'bg-[#E1306C]' },
  tiktok:    { label: 'TikTok',    dot: 'bg-[#010101]' },
  facebook:  { label: 'Facebook',  dot: 'bg-[#1877F2]' },
  reddit:    { label: 'Reddit',    dot: 'bg-[#FF4500]' },
  telegram:  { label: 'Telegram',  dot: 'bg-[#26A5E4]' },
  twitter:   { label: 'Twitter',   dot: 'bg-[#1DA1F2]' },
  youtube:   { label: 'YouTube',   dot: 'bg-[#FF0000]' },
}

function platformMeta(p: string) {
  return PLATFORM_META[p.toLowerCase()] ?? { label: p, dot: 'bg-[#A3A3A3]' }
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md px-5 py-4">
      <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[#0A0A0A] leading-none">{value}</p>
      {sub && <p className="text-xs text-[#A3A3A3] mt-1">{sub}</p>}
    </div>
  )
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
  queued:    'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]',
  failed:    'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]',
  pending:   'bg-[#F5F5FF] text-[#6366F1] border-[#C7D2FE]',
}

function StatusPill({ status }: { status: string }) {
  const s = status?.toLowerCase() ?? 'queued'
  const cls = STATUS_STYLES[s] ?? STATUS_STYLES.queued
  const icons: Record<string, React.ReactNode> = {
    published: <CheckCircle2 size={11} strokeWidth={2} />,
    failed:    <XCircle size={11} strokeWidth={2} />,
    queued:    <Clock size={11} strokeWidth={2} />,
    pending:   <Send size={11} strokeWidth={2} />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${cls}`}>
      {icons[s]}
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="border-b border-[#E5E5E5]">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-3 bg-[#F5F5F5] rounded animate-pulse" style={{ width: `${50 + i * 10}%` }} />
        </td>
      ))}
    </tr>
  )
}

// ── Format date ───────────────────────────────────────────────────────────────

function fmtDate(d?: string | null) {
  if (!d) return '—'
  const dt = new Date(d)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Empty state ───────────────────────────────────────────────────────────────

function NoData() {
  return (
    <tr>
      <td colSpan={6} className="text-center py-16 text-[#A3A3A3] text-sm">
        No social posts yet. Posts appear here after a pipeline run uploads to social platforms.
      </td>
    </tr>
  )
}

// ── Platform filter pill ──────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  dot,
  onClick,
}: {
  label: string
  active: boolean
  dot?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
        active
          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
          : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#A3A3A3]'
      }`}
    >
      {dot && !active && <span className={`w-2 h-2 rounded-full ${dot}`} />}
      {label}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SocialPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()
  const [platformFilter, setPlatformFilter] = useState<string>('all')

  // ── Queries
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['social-stats'],
    queryFn: () => socialApi.stats(),
    staleTime: 60_000,
  })

  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['social-posts', platformFilter],
    queryFn: () =>
      socialApi.posts({
        platform: platformFilter === 'all' ? undefined : platformFilter,
        limit: 100,
      }),
    staleTime: 30_000,
  })

  // ── Sync mutation
  const syncMutation = useMutation({
    mutationFn: () => socialApi.syncMetrics({ platform: platformFilter === 'all' ? undefined : platformFilter }),
    onSuccess: () => {
      addToast('Metrics synced', 'success')
      qc.invalidateQueries({ queryKey: ['social-posts'] })
      qc.invalidateQueries({ queryKey: ['social-stats'] })
    },
    onError: () => addToast('Sync failed', 'error'),
  })

  // ── Derived data
  const stats = statsData?.stats ?? {}
  const today = statsData?.today ?? {}
  const posts: any[] = postsData?.posts ?? []

  const totalPosts = Object.values(stats).reduce<number>((acc, v: any) => acc + (v?.total ?? 0), 0)
  const totalPublished = Object.values(stats).reduce<number>((acc, v: any) => acc + (v?.published ?? 0), 0)
  const totalFailed = Object.values(stats).reduce<number>((acc, v: any) => acc + (v?.failed ?? 0), 0)
  const todayCount = Object.values(today).reduce<number>((acc, v: any) => acc + (v ?? 0), 0)

  // Known platforms for filter bar (from stats + hardcoded common ones)
  const activePlatforms = Object.keys(stats).filter((p) => (stats[p]?.total ?? 0) > 0)
  const filterPlatforms = activePlatforms.length > 0 ? activePlatforms : ['instagram', 'tiktok', 'facebook']

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]">Social</h1>
          <p className="text-sm text-[#A3A3A3] mt-0.5">Posts distributed across social platforms</p>
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-[#E5E5E5] bg-white text-sm text-[#0A0A0A] hover:bg-[#F5F5F5] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} strokeWidth={1.5} className={syncMutation.isPending ? 'animate-spin' : ''} />
          Sync Metrics
        </button>
      </div>

      <div className="px-8 space-y-6 pb-12">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white border border-[#E5E5E5] rounded-md px-5 py-4 animate-pulse">
                <div className="h-3 bg-[#F5F5F5] rounded w-2/3 mb-3" />
                <div className="h-6 bg-[#F5F5F5] rounded w-1/2" />
              </div>
            ))
          ) : (
            <>
              <StatCard label="Total Posts"  value={totalPosts}     sub="all time" />
              <StatCard label="Published"    value={totalPublished} sub={`${totalPosts > 0 ? Math.round((totalPublished / totalPosts) * 100) : 0}% success rate`} />
              <StatCard label="Failed"       value={totalFailed}    sub="need attention" />
              <StatCard label="Today"        value={todayCount}     sub="posts distributed" />
            </>
          )}
        </div>

        {/* Platform breakdown bar */}
        {!statsLoading && activePlatforms.length > 0 && (
          <div className="bg-white border border-[#E5E5E5] rounded-md px-5 py-4">
            <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-3">By Platform</p>
            <div className="flex flex-wrap gap-4">
              {activePlatforms.map((p) => {
                const { label, dot } = platformMeta(p)
                const pStats = stats[p] ?? {}
                return (
                  <div key={p} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full ${dot}`} />
                    <span className="font-medium text-[#0A0A0A]">{label}</span>
                    <span className="text-[#A3A3A3]">
                      {pStats.published ?? 0} published · {pStats.failed ?? 0} failed
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Post history */}
        <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
          {/* Table header + filters */}
          <div className="px-5 py-4 border-b border-[#E5E5E5] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter size={14} strokeWidth={1.5} className="text-[#A3A3A3]" />
              <span className="text-sm font-medium text-[#0A0A0A]">Post History</span>
            </div>
            <div className="flex items-center gap-2">
              <FilterPill
                label="All"
                active={platformFilter === 'all'}
                onClick={() => setPlatformFilter('all')}
              />
              {filterPlatforms.map((p) => {
                const { label, dot } = platformMeta(p)
                return (
                  <FilterPill
                    key={p}
                    label={label}
                    dot={dot}
                    active={platformFilter === p}
                    onClick={() => setPlatformFilter(p)}
                  />
                )
              })}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Platform</th>
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Title</th>
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Status</th>
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Published</th>
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Channel</th>
                  <th scope="col" className="text-left px-4 py-3 text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">Actions</th>
                </tr>
              </thead>
              <tbody>
                {postsLoading ? (
                  Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                ) : posts.length === 0 ? (
                  <NoData />
                ) : (
                  posts.map((post) => {
                    const { label, dot } = platformMeta(post.platform ?? '')
                    return (
                      <tr
                        key={post.id}
                        className="border-b border-[#E5E5E5] hover:bg-[#FAFAFA] transition-colors"
                      >
                        {/* Platform */}
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#0A0A0A]">
                            <span className={`w-2 h-2 rounded-full ${dot}`} />
                            {label}
                          </span>
                        </td>

                        {/* Title */}
                        <td className="px-4 py-3 max-w-[260px]">
                          <span className="block truncate text-[#0A0A0A]" title={post.title ?? ''}>
                            {post.title ?? <span className="text-[#A3A3A3]">Untitled</span>}
                          </span>
                          {post.youtube_video_id && (
                            <span className="text-[10px] text-[#A3A3A3]">yt:{post.youtube_video_id}</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusPill status={post.status} />
                        </td>

                        {/* Published date */}
                        <td className="px-4 py-3 text-[#525252] text-xs whitespace-nowrap">
                          {fmtDate(post.published_at ?? post.created_at)}
                        </td>

                        {/* Channel */}
                        <td className="px-4 py-3 text-[#525252] text-xs">
                          {post.channel_slug ?? <span className="text-[#A3A3A3]">—</span>}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {post.post_url && (
                              <a
                                href={post.post_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-[#525252] hover:text-[#0A0A0A] transition-colors"
                              >
                                <ExternalLink size={12} strokeWidth={1.5} />
                                View
                              </a>
                            )}
                            {post.status === 'failed' && (
                              <button
                                className="inline-flex items-center gap-1 text-xs text-[#BE123C] hover:text-[#9F1239] transition-colors"
                                onClick={() => {
                                  syncMutation.mutate()
                                }}
                              >
                                <RotateCcw size={12} strokeWidth={1.5} />
                                Retry
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          {!postsLoading && posts.length > 0 && (
            <div className="px-5 py-3 border-t border-[#E5E5E5] text-xs text-[#A3A3A3]">
              {posts.length} post{posts.length !== 1 ? 's' : ''} shown
              {platformFilter !== 'all' && ` · filtered by ${platformMeta(platformFilter).label}`}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
