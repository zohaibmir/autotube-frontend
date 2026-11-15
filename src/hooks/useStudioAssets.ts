import { useQuery } from '@tanstack/react-query'
import { studioApi } from '@api/services'
import type { AssetStatus } from '@components/studio/StatusChip'

export interface StudioAsset {
  id: number
  public_id: string
  user_id: string
  kind: string
  origin: string
  title: string | null
  description: string | null
  tags: string[]
  status: AssetStatus
  duration_s: number | null
  width: number | null
  height: number | null
  source_bytes: number | null
  mime: string | null
  channel_slug: string | null
  job_id: string | null
  error: string | null
  created_at: string | null
  updated_at: string | null
  file_url: string
}

export interface StudioPublication {
  id: number
  asset_id: number
  platform: string
  channel_slug: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  external_id: string | null
  job_id: string | null
  attempt_count: number | null
  last_error: string | null
  published_at: string | null
  scheduled_at: string | null
  views: number | null
  watch_time_minutes: number | null
  avg_view_duration_seconds: number | null
  analytics_fetched_at: string | null
}

export interface AssetsResponse {
  ok: boolean
  count: number
  assets: StudioAsset[]
}

// One cache key per filter, so switching chips does not throw away a page that is already loaded.
export function useStudioAssets(params: { status?: string; limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ['studio-assets', params],
    queryFn: () => studioApi.assets(params) as Promise<AssetsResponse>,
    staleTime: 15_000,
  })
}

export function useStudioAsset(publicId: string | null) {
  return useQuery({
    queryKey: ['studio-asset', publicId],
    queryFn: () => studioApi.asset(publicId as string) as Promise<{
      ok: boolean
      asset: StudioAsset
      publications: StudioPublication[]
    }>,
    enabled: !!publicId,
  })
}

// ── Formatting shared by the list and the drawer ──────────────────────────────

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return '—'
  const total = Math.round(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${s.toString().padStart(2, '0')}s` : `${s}s`
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return '—'
  const diff = Math.max(0, Date.now() - then)
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
