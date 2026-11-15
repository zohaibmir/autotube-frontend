import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  FileText,
  Film,
  Loader2,
  Plus,
  Puzzle,
  RefreshCw,
  Scissors,
  Search,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { studioApi, jobsApi } from '@api/services'
import { apiErrorMessage } from '@lib/apiError'
import { useToast } from '@components/Toast'
import StatusChip from '@components/studio/StatusChip'
import AssetDrawer from '@components/studio/AssetDrawer'
import {
  formatBytes,
  formatDuration,
  relativeTime,
  useStudioAssets,
  type StudioAsset,
} from '@hooks/useStudioAssets'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Drafts' },
  { id: 'ready', label: 'Ready' },
  { id: 'archived', label: 'Archived' },
] as const

const ACCEPTED = ['.mp4', '.mov', '.webm', '.mkv', '.m4v']
const MAX_BYTES = 2 * 1024 * 1024 * 1024

// Phase 2 (Create hub): every AI mode behind one button. Each item navigates to an existing flow —
// the wizards themselves are unchanged, only where the creator starts them from.
const CREATE_ITEMS = [
  { label: 'AI long-form video', desc: 'Topic → script → video', icon: Wand2, to: '/app/jobs/new' },
  { label: 'AI Short — animated', desc: 'Kling / MiniMax', icon: Sparkles, to: '/app/shorts' },
  { label: 'AI Short — from a script', desc: 'Stock / Pexels', icon: FileText, to: '/app/create/script' },
  { label: 'Assemble from my clips', desc: 'Custom Studio', icon: Puzzle, to: '/app/studio/custom' },
  { label: 'Repurpose a video', desc: 'Import & clip', icon: Scissors, to: '/app/studio?tab=tools&tool=import' },
  { label: 'Kids video', desc: 'Kids niche flow', icon: Clapperboard, to: '/app/kids' },
] as const

type QueueStatus = 'uploading' | 'done' | 'error' | 'cancelled'
interface QueueItem {
  id: string
  file: File
  progress: number
  status: QueueStatus
  error?: string
}

function extOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

/**
 * The creator's library. Phase 1 of the Creator Studio plan: upload a file, see it as an asset,
 * edit its details. Publishing is the next slice and deliberately absent here.
 *
 * Owner scoping is the server's job; this component never assumes a file path exists.
 */
export default function StudioLibrary({ onOpenTools }: { onOpenTools?: () => void }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [recovering, setRecovering] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [createMenuOpen, setCreateMenuOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragDepth = useRef(0)
  const aborters = useRef<Record<string, AbortController>>({})
  const createMenuRef = useRef<HTMLDivElement>(null)

  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const openAssetId = searchParams.get('asset')

  const { data, isLoading, isFetching, isError, error, refetch } = useStudioAssets({
    status: filter === 'all' ? undefined : filter,
    limit,
    offset: 0,
  })

  const assets = data?.assets ?? []
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return assets
    return assets.filter(
      (a) =>
        (a.title ?? '').toLowerCase().includes(q) ||
        (a.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    )
  }, [assets, search])

  const uploadingCount = queue.filter((q) => q.status === 'uploading').length

  const { data: recoversData } = useQuery({
    queryKey: ['studio-recoverable-renders'],
    queryFn: () => studioApi.recoverableRenders() as Promise<{ ok: boolean; count: number; renders: Array<{ job_id: string; title: string; status: string; channel_slug: string | null; youtube_id: string | null; start_time: string | null; size_bytes: number }> }>,
  })

  // Phase 2 (Create hub): a render in flight is shown as a "Rendering" row, so a creator who just
  // submitted a video from the + Create menu sees it land here — first as a row, then as an asset.
  const { data: jobsData } = useQuery<any[]>({
    queryKey: ['studio-rendering-jobs'],
    queryFn: () => jobsApi.list(),
    refetchInterval: 5000,
  })
  const renderingJobs = useMemo(() => {
    const all = jobsData ?? []
    return all.filter((j) => ['running', 'processing', 'queued'].includes(j?.status ?? ''))
  }, [jobsData])

  // Keep the library fresh while a render is in flight: a finished render auto-registers as an asset
  // server-side, so refetch assets on the same cadence and once more after the last job ends.
  const prevRendering = useRef(0)
  useEffect(() => {
    const active = renderingJobs.length > 0
    if (!active && prevRendering.current > 0) {
      queryClient.invalidateQueries({ queryKey: ['studio-assets'] })
    }
    prevRendering.current = renderingJobs.length
    if (!active) return
    const id = window.setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['studio-assets'] })
    }, 5000)
    return () => window.clearInterval(id)
  }, [renderingJobs.length, queryClient])


  const openAsset = useCallback(
    (publicId: string) => {
      const next = new URLSearchParams(searchParams)
      next.set('asset', publicId)
      setSearchParams(next)
    },
    [searchParams, setSearchParams],
  )

  const closeAsset = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete('asset')
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  const uploadOne = useCallback(
    async (item: QueueItem) => {
      const controller = new AbortController()
      aborters.current[item.id] = controller
      setQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'uploading', progress: 0 } : q)),
      )
      try {
        await studioApi.createAsset(item.file, {
          title: item.file.name.replace(/\.[^.]+$/, ''),
          signal: controller.signal,
          onProgress: (percent) =>
            setQueue((prev) =>
              prev.map((q) => (q.id === item.id ? { ...q, progress: percent } : q)),
            ),
        })
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'done', progress: 100 } : q)),
        )
        await queryClient.invalidateQueries({ queryKey: ['studio-assets'] })
        toast.success(`${item.file.name} added to your library`)
        window.setTimeout(() => {
          setQueue((prev) => prev.filter((q) => q.id !== item.id))
        }, 3000)
      } catch (err) {
        if (controller.signal.aborted) {
          setQueue((prev) => prev.filter((q) => q.id !== item.id))
          return
        }
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: 'error', error: apiErrorMessage(err, 'Upload failed') }
              : q,
          ),
        )
      } finally {
        delete aborters.current[item.id]
      }
    },
    [queryClient, toast],
  )

  const recover = useCallback(
    async (render: { job_id: string; title: string }) => {
      setRecovering(render.job_id)
      try {
        const result = await studioApi.recoverRender(render.job_id)
        await queryClient.invalidateQueries({ queryKey: ['studio-assets'] })
        await queryClient.invalidateQueries({ queryKey: ['studio-recoverable-renders'] })
        if (result.ok) {
          toast.success(
            result.already_in_library
              ? `${render.title} was already in your library`
              : `${render.title} recovered and ready to publish`,
          )
        } else {
          toast.error(`Could not recover ${render.title}`)
        }
      } catch (err) {
        toast.error(apiErrorMessage(err, `Failed to recover ${render.title}`))
      } finally {
        setRecovering(null)
      }
    },
    [queryClient, toast],
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
      const accepted: QueueItem[] = []
      for (const file of list) {
        if (!ACCEPTED.includes(extOf(file.name))) {
          toast.error(`${file.name} is not a supported video (${ACCEPTED.join(', ')})`)
          continue
        }
        if (file.size > MAX_BYTES) {
          toast.error(`${file.name} is larger than the 2 GB upload limit`)
          continue
        }
        accepted.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file,
          progress: 0,
          status: 'uploading',
        })
      }
      if (!accepted.length) return
      setQueue((prev) => [...prev, ...accepted])
      accepted.forEach((item) => void uploadOne(item))
    },
    [toast, uploadOne],
  )

  // A drop that ends outside the list must not leave the overlay stuck on.
  useEffect(() => {
    const reset = () => {
      dragDepth.current = 0
      setDragging(false)
    }
    window.addEventListener('dragend', reset)
    window.addEventListener('drop', reset)
    return () => {
      window.removeEventListener('dragend', reset)
      window.removeEventListener('drop', reset)
    }
  }, [])

  // Close the + Create menu on any click outside it.
  useEffect(() => {
    if (!createMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(e.target as Node)) {
        setCreateMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [createMenuOpen])

  const retry = (item: QueueItem) => {
    setQueue((prev) => prev.map((q) => (q.id === item.id ? { ...q, error: undefined } : q)))
    void uploadOne(item)
  }

  return (
    <div
      className="relative flex h-full flex-col"
      onDragEnter={(e) => {
        e.preventDefault()
        dragDepth.current += 1
        if (e.dataTransfer?.types?.includes('Files')) setDragging(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files)
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E5E5] bg-white px-6 py-4">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Your videos</h1>
          <p className="mt-0.5 text-[12px] text-[#A3A3A3]">
            Everything you have uploaded or created, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={createMenuRef}>
            <button
              onClick={() => setCreateMenuOpen((v) => !v)}
              aria-expanded={createMenuOpen}
              aria-haspopup="menu"
              className="flex items-center gap-1.5 rounded-md border border-[#E5E5E5] px-3 py-2 text-[12px] font-medium text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5]"
            >
              <Plus size={13} strokeWidth={1.8} />
              Create
              <ChevronDown
                size={12}
                strokeWidth={1.8}
                className={`transition-transform ${createMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {createMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-40 mt-1 w-[264px] overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-lg"
              >
                <p className="px-3 pb-1.5 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-[#A3A3A3]">
                  Create with AI
                </p>
                {CREATE_ITEMS.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={() => {
                        setCreateMenuOpen(false)
                        navigate(item.to)
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[#F5F5F5]"
                    >
                      <Icon size={14} strokeWidth={1.6} className="flex-shrink-0 text-[#525252]" />
                      <span className="min-w-0">
                        <span className="block text-[12px] font-medium text-[#0A0A0A]">
                          {item.label}
                        </span>
                        <span className="block text-[10px] text-[#A3A3A3]">{item.desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {onOpenTools && (
            <button
              onClick={onOpenTools}
              className="rounded-md border border-[#E5E5E5] px-3 py-2 text-[12px] text-[#525252] transition-colors hover:bg-[#F5F5F5]"
            >
              Upload a finished render
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 rounded-md bg-[#0A0A0A] px-3.5 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#262626]"
          >
            <Upload size={13} strokeWidth={1.8} />
            Upload video
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*,.mkv,.m4v"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5E5E5] bg-white px-6 py-2.5">
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={[
                'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                filter === f.id
                  ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                  : 'border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]',
              ].join(' ')}
            >
              {f.label}
              {filter === f.id && f.id !== 'all' && data ? ` · ${data.count}` : ''}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search
              size={13}
              strokeWidth={1.6}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search titles and tags"
              className="w-[220px] rounded-md border border-[#E5E5E5] py-1.5 pl-8 pr-2.5 text-[12px] text-[#0A0A0A] outline-none transition-colors focus:border-[#5B8CAA]"
            />
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh"
            className="flex h-7 w-7 items-center justify-center rounded text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5] hover:text-[#0A0A0A] disabled:opacity-40"
          >
            <RefreshCw size={13} strokeWidth={1.6} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>


      <div className="flex-1 overflow-y-auto">
        {renderingJobs.length > 0 && (
          <div className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
            <div className="flex items-center justify-between px-6 pb-1.5 pt-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[#525252]">
                Rendering
              </h2>
              <p className="text-[11px] text-[#A3A3A3]">
                {renderingJobs.length} in flight
              </p>
            </div>
            <ul className="divide-y divide-[#F0F0F0]">
              {renderingJobs.map((job) => (
                <li key={job.job_id} className="flex items-center gap-4 px-6 py-3">
                  <div className="flex h-[54px] w-[96px] flex-shrink-0 items-center justify-center rounded border border-[#E5E5E5] bg-white">
                    <Loader2 size={18} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                      {job.topic || 'Untitled video'}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#A3A3A3]">
                      {job.status === 'queued' ? 'Queued' : `Rendering · ${Math.max(0, Math.min(100, job.progress ?? 0))}%`}
                    </p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded bg-[#E5E5E5]">
                      <div
                        className="h-full rounded bg-[#0A0A0A] transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, job.progress ?? 0))}%` }}
                      />
                    </div>
                  </div>
                  <span className="flex-shrink-0 rounded-full border border-[#E5E5E5] bg-white px-2 py-0.5 text-[10px] font-medium text-[#525252]">
                    {job.status === 'queued' ? 'Queued' : 'Rendering'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {isLoading ? (
          <ul className="divide-y divide-[#F0F0F0]" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="flex items-center gap-4 px-6 py-3.5">
                <div className="h-[54px] w-[96px] flex-shrink-0 animate-pulse rounded bg-[#F0F0F0]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded bg-[#F0F0F0]" />
                  <div className="h-2.5 w-1/4 animate-pulse rounded bg-[#F5F5F5]" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-[#F0F0F0]" />
              </li>
            ))}
          </ul>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <AlertCircle size={22} strokeWidth={1.5} className="text-[#D4D4D4]" />
            <p className="text-[13px] text-[#525252]">Your videos could not be loaded.</p>
            <p className="max-w-md text-[11px] text-[#A3A3A3]">
              {apiErrorMessage(error, 'The server did not answer.')}
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 rounded-md border border-[#E5E5E5] px-3 py-1.5 text-[12px] text-[#525252] transition-colors hover:bg-[#F5F5F5]"
            >
              Try again
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-20 text-center">
            <Film size={24} strokeWidth={1.5} className="text-[#D4D4D4]" />
            {search ? (
              <>
                <p className="text-[13px] text-[#525252]">No videos match “{search}”.</p>
                <button
                  onClick={() => setSearch('')}
                  className="text-[12px] text-[#525252] underline-offset-2 hover:underline"
                >
                  Clear the search
                </button>
              </>
            ) : filter !== 'all' ? (
              <>
                <p className="text-[13px] text-[#525252]">No {filter} videos yet.</p>
                <button
                  onClick={() => setFilter('all')}
                  className="text-[12px] text-[#525252] underline-offset-2 hover:underline"
                >
                  Show all videos
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-[#525252]">Upload your first video</p>
                <p className="max-w-sm text-[11px] text-[#A3A3A3]">
                  Drag a file anywhere on this page, or use Upload video. MP4, MOV, WebM, MKV and
                  M4V are supported, up to 2 GB.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[#F0F0F0]">
            {visible.map((asset: StudioAsset) => (
              <li key={asset.public_id}>
                <button
                  onClick={() => openAsset(asset.public_id)}
                  className="group flex w-full items-center gap-4 px-6 py-3 text-left transition-colors hover:bg-[#F5F5F5]"
                >
                  <div className="relative flex h-[54px] w-[96px] flex-shrink-0 items-center justify-center overflow-hidden rounded border border-[#E5E5E5] bg-[#FAFAFA]">
                    <Film size={18} strokeWidth={1.4} className="text-[#D4D4D4]" />
                    {asset.duration_s ? (
                      <span className="absolute bottom-1 right-1 rounded bg-[#0A0A0A]/75 px-1 py-px text-[9px] font-medium text-white">
                        {formatDuration(asset.duration_s)}
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#0A0A0A]">
                      {asset.title || 'Untitled video'}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#A3A3A3]">
                      {[
                        asset.origin,
                        asset.channel_slug || 'no channel',
                        formatBytes(asset.source_bytes),
                        asset.width && asset.height ? `${asset.width}×${asset.height}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <StatusChip status={asset.status} />
                  <span className="w-[86px] flex-shrink-0 text-right text-[11px] text-[#A3A3A3]">
                    {relativeTime(asset.created_at)}
                  </span>
                  <ChevronRight
                    size={14}
                    strokeWidth={1.6}
                    className="flex-shrink-0 text-[#D4D4D4] transition-colors group-hover:text-[#525252]"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}


        {visible.length > 0 && assets.length >= limit && limit < 200 && (
          <div className="flex justify-center px-6 py-4">
            <button
              onClick={() => setLimit((l) => Math.min(200, l + 50))}
              disabled={isFetching}
              className="flex items-center gap-2 rounded-md border border-[#E5E5E5] px-3 py-1.5 text-[12px] text-[#525252] transition-colors hover:bg-[#F5F5F5] disabled:opacity-40"
            >
              {isFetching && <Loader2 size={12} className="animate-spin" />}
              Load more
            </button>
          </div>
        )}

        {/* Recovery renders: finished pipeline jobs whose upload failed or never happened */}
        {recoversData?.ok && recoversData.renders.length > 0 && (
          <div className="border-t border-[#E5E5E5] bg-[#F5F5F5] px-6 py-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[#525252]">
                Recoverable renders
              </h2>
              <p className="text-[11px] text-[#525252]">
                {recoversData.count} render{recoversData.count !== 1 ? 's' : ''} on disk
              </p>
            </div>
            <ul className="divide-y divide-[#E5E5E5]">
              {recoversData.renders.map((r: { job_id: string; title: string; status: string; channel_slug: string | null; youtube_id: string | null; start_time: string | null; size_bytes: number }) => (
                <li key={r.job_id} className="flex items-center gap-4 px-3 py-2.5">
                  <div className="relative flex h-[44px] w-[76px] flex-shrink-0 items-center justify-center overflow-hidden rounded border border-[#E5E5E5] bg-[#FAFAFA]">
                    <Film size={14} strokeWidth={1.4} className="text-[#D4D4D4]" />
                    {r.status === 'error' ? (
                      <span className="absolute bottom-1 right-1 rounded bg-[#BE123C] px-1 py-px text-[9px] font-medium text-white">
                        Failed
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium text-[#0A0A0A]">
                      {r.title || 'Untitled video'}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#A3A3A3]">
                      {[
                        r.channel_slug || 'no channel',
                        formatBytes(r.size_bytes),
                        relativeTime(r.start_time),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    onClick={() => recover(r)}
                    disabled={recovering === r.job_id}
                    className="flex-shrink-0 rounded-md border border-[#E5E5E5] bg-white px-3 py-1 text-[11px] font-medium text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5] disabled:opacity-40"
                  >
                    {recovering === r.job_id && <Loader2 size={11} className="animate-spin" />}
                    Recover
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Drop overlay: the whole page is the dropzone, so it is drawn above the list. */}
      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#FAFAFA]/85">
          <div className="rounded-lg border-2 border-dashed border-[#0A0A0A]/30 px-10 py-8 text-center">
            <Upload size={22} strokeWidth={1.5} className="mx-auto text-[#525252]" />
            <p className="mt-2 text-[13px] font-medium text-[#0A0A0A]">Drop to add your videos</p>
            <p className="mt-0.5 text-[11px] text-[#A3A3A3]">
              MP4, MOV, WebM, MKV, M4V · up to 2 GB each
            </p>
          </div>
        </div>
      )}

      {/* Upload tray: survives navigation, one row per file, never blocks the list. */}
      {queue.length > 0 && (
        <div className="absolute bottom-4 right-4 z-30 w-[320px] overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-[#E5E5E5] px-3 py-2">
            <p className="text-[12px] font-medium text-[#0A0A0A]">
              {uploadingCount > 0 ? `Uploading ${uploadingCount}…` : 'Uploads finished'}
            </p>
            <button
              onClick={() => setQueue((prev) => prev.filter((q) => q.status === 'uploading'))}
              className="rounded p-1 text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5] hover:text-[#0A0A0A]"
              aria-label="Clear finished uploads"
            >
              <X size={12} strokeWidth={1.8} />
            </button>
          </div>
          <ul className="max-h-[240px] overflow-y-auto divide-y divide-[#F5F5F5]">
            {queue.map((item) => (
              <li key={item.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] text-[#0A0A0A]">{item.file.name}</p>
                  <span className="flex-shrink-0 text-[10px] text-[#A3A3A3]">
                    {item.status === 'uploading' ? `${item.progress}%` : formatBytes(item.file.size)}
                  </span>
                </div>
                {item.status === 'uploading' && (
                  <div className="mt-1 h-1 overflow-hidden rounded bg-[#F0F0F0]">
                    <div
                      className="h-full rounded bg-[#0A0A0A] transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === 'error' && (
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="truncate text-[10px] text-[#BE123C]">{item.error}</p>
                    <button
                      onClick={() => retry(item)}
                      className="flex-shrink-0 text-[10px] font-medium text-[#525252] underline-offset-2 hover:underline"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {openAssetId && <AssetDrawer publicId={openAssetId} onClose={closeAsset} />}
    </div>
  )
}

