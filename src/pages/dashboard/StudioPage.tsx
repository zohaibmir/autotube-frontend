import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, Film, Upload, Scissors, Plus, Trash2,
  Loader2, Sparkles, Play, Paintbrush,
} from 'lucide-react'
import { studioApi, channelsApi, brandKitApi } from '@api/services'
import { BrandKitPanel } from '@/components/studio/BrandKitPanel'
import { apiErrorMessage } from '@lib/apiError'
import { useToast } from '@components/Toast'
import { useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoFile {
  name: string
  path: string
  size_mb: number
  dir: string
  mtime: number
}

interface VideoInfo {
  ok: boolean
  name: string
  path: string
  duration: number
  duration_str: string
  width: number
  height: number
  codec: string
  fps: number
  size_mb: number
  error?: string
}

interface ClipRow {
  id: string
  start: string
  end: string
  label: string
}

type ActiveTab = 'upload' | 'extract' | 'import' | 'brandkit'

// ── Helper ────────────────────────────────────────────────────────────────────

function dirBadge(dir: string): string {
  if (dir.includes('shorts')) return 'shorts'
  if (dir.includes('clips')) return 'clips'
  return 'output'
}

function relTime(mtime: number): string {
  const diff = Math.floor((Date.now() / 1000) - mtime)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function fmtDuration(d: number): string {
  const m = Math.floor((d / 60) % 60)
  const s = Math.floor(d % 60)
  return m > 0 ? `${m}:${s < 10 ? '0' : ''}${s}` : `${s}s`
}

function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${mb} MB`
}

// ── Design Tokens ─────────────────────────────────────────────────────────────

const TOKENS = {
  primary: 'bg-[#0A0A0A] text-white hover:bg-[#262626]',
  secondary: 'bg-white border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5]',
  ghost: 'text-[#525252] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]',
  danger: 'bg-[#DC2626] text-white hover:bg-[#B91C1C]',
  success: 'bg-[#16A34A] text-white hover:bg-[#15803d]',
} as const

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

// ── Reusable Sub-components ──────────────────────────────────────────────────=

function StudioButton({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  size = 'md',
  className = '',
  iconLeft,
  iconRight,
}: {
  children: React.ReactNode
  onClick?: () => void
  variant?: ButtonVariant
  disabled?: boolean
  loading?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
}) {
  const variants: Record<ButtonVariant, string> = {
    primary: TOKENS.primary,
    secondary: TOKENS.secondary,
    ghost: TOKENS.ghost,
    danger: TOKENS.danger,
    success: TOKENS.success,
  }
  const sizes: Record<string, string> = {
    sm: 'h-8 px-3 text-[12px]',
    md: 'h-10 px-4 text-[13px]',
    lg: 'h-11 px-5 text-[14px]',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-md transition-all duration-200 active:scale-[0.98]',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {loading && <Loader2 size={14} strokeWidth={1.8} className="animate-spin" />}
      {!loading && iconLeft && <span className="flex-shrink-0">{iconLeft}</span>}
      {children}
      {!loading && iconRight && <span className="flex-shrink-0">{iconRight}</span>}
    </button>
  )
}

function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-8 text-center">
      <div className="w-16 h-16 rounded-full bg-[#F5F5F5] flex items-center justify-center mb-4 text-[#A3A3A3]">
        {icon}
      </div>
      <h3 className="text-[14px] font-semibold text-[#0A0A0A] mb-1">{title}</h3>
      <p className="text-[13px] text-[#A3A3A3] mb-6">{subtitle}</p>
      {action}
    </div>
  )
}

function ConfirmDialog({
  open,
  onConfirm,
  onCancel,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
}: {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="bg-white rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-6 w-full max-w-md">
        <h3 className="text-[14px] font-semibold text-[#0A0A0A] mb-1">{title}</h3>
        <p className="text-[13px] text-[#525252] mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <StudioButton variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </StudioButton>
          <StudioButton variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </StudioButton>
        </div>
      </div>
    </div>
  )
}

function TagInput({
  value,
  onChange,
  placeholder = 'Add a tag…',
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  const tags = value.split(',').map(t => t.trim()).filter(Boolean)
  const [inputValue, setInputValue] = useState('')

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const trimmed = inputValue.trim()
      if (trimmed) {
        onChange([...tags, trimmed].join(', '))
        setInputValue('')
      }
    }
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onChange(tags.slice(0, -1).join(', '))
    }
  }

  const removeTag = (idx: number) => {
    const next = tags.filter((_, i) => i !== idx)
    onChange(next.join(', '))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag, idx) => (
        <span key={idx} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[#E5E5E5] bg-[#F5F5F5] text-[11px] text-[#0A0A0A]">
          {tag}
          <button
            onClick={() => removeTag(idx)}
            className="text-[#A3A3A3] hover:text-[#DC2626] transition-colors"
          >
            <Trash2 size={10} strokeWidth={1.5} />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 min-w-[120px] h-8 px-2 text-[12px] border-none focus:outline-none placeholder-[#A3A3A3]"
      />
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudioPage() {
  const [searchParams] = useSearchParams()
  const toolParam = searchParams.get('tool')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    toolParam === 'extract' || toolParam === 'import' ? toolParam : 'upload',
  )

  // Toast
  const toast = useToast()

  // Confirm dialogs
  const [confirmDeleteClip, setConfirmDeleteClip] = useState<{ id: string } | null>(null)

  // Upload tab state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadChannel, setUploadChannel] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Extract tab state
  const [clipRows, setClipRows] = useState<ClipRow[]>([
    { id: '1', start: '0', end: '60', label: 'clip-1' },
  ])
  const [extractResult, setExtractResult] = useState<any>(null)
  const [extracting, setExtracting] = useState(false)
  const [uploadingShorts, setUploadingShorts] = useState(false)
  const [shortsResult, setShortsResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Import & Clip tab state
  const [importUrl, setImportUrl] = useState('')
  const [importAnalysis, setImportAnalysis] = useState<any>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [selectedClips, setSelectedClips] = useState<Set<number>>(new Set())
  const [importExtracting, setImportExtracting] = useState(false)

  // Video browser state
  const [videoSearch, setVideoSearch] = useState('')
  const [videoFilter, setVideoFilter] = useState<'all' | 'shorts' | 'clips' | 'output'>('all')

  // Data queries
  const {
    data: videosData,
    isFetching: videosLoading,
    refetch: refetchVideos,
    isError: videosFailed,
    error: videosFailure,
  } = useQuery({
    queryKey: ['studio-videos'],
    queryFn: studioApi.videos,
  })
  // The listing is owner-scoped: files carry no owner metadata, so ownership is resolved through
  // `videos.file_path` (TEST.md §29.37) and a customer sees their own renders rather than a 403. The branch
  // below is kept as a safety net -- if the route is ever gated again, saying so beats the empty state, which
  // reads as "you have no videos" and would send someone looking for a missing render.
  const videosForbidden = (videosFailure as { response?: { status?: number } } | undefined)
    ?.response?.status === 403

  const { data: videoInfoData } = useQuery({
    queryKey: ['studio-info', selectedPath],
    queryFn: () => studioApi.info(selectedPath!),
    enabled: !!selectedPath,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.list(),
  })

  const videos: VideoFile[] = videosData?.videos ?? []
  const channels: any[] = channelsData ?? []
  const info: VideoInfo | null = videoInfoData ?? null

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleAiGenerate() {
    if (!uploadTitle.trim()) return
    setAiGenerating(true)
    try {
      const result = await studioApi.generateMetadata(uploadTitle.trim(), uploadChannel || undefined)
      if (result.ok) {
        if (result.description) setUploadDesc(result.description)
        if (result.tags?.length) setUploadTags(result.tags.join(', '))
        toast.success('AI metadata generated')
      }
    } catch {
      toast.error('AI generation failed')
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleUploadMain() {
    if (!selectedPath || !uploadTitle.trim()) return
    setUploading(true)
    setUploadResult(null)
    try {
      const tagsArr = uploadTags.split(',').map(t => t.trim()).filter(Boolean)
      const result = await studioApi.uploadMain({
        video_path: selectedPath,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        tags: tagsArr,
        channel: uploadChannel || undefined,
      })
      if (result.ok) {
        setUploadResult({ type: 'success', text: `Uploaded! ${result.url ?? ''}` })
        toast.success('Video uploaded to YouTube')
      } else {
        setUploadResult({ type: 'error', text: result.error ?? 'Upload failed' })
        toast.error(result.error ?? 'Upload failed')
      }
    } catch (e: any) {
      setUploadResult({ type: 'error', text: e?.message ?? 'Upload failed' })
      toast.error(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function addClipRow() {
    const id = String(Date.now())
    const num = clipRows.length + 1
    setClipRows(rows => [...rows, { id, start: '0', end: '60', label: `clip-${num}` }])
  }

  function confirmDeleteClipRow() {
    if (!confirmDeleteClip) return
    setClipRows(rows => rows.filter(r => r.id !== confirmDeleteClip.id))
    setConfirmDeleteClip(null)
  }

  function updateClipRow(id: string, field: 'start' | 'end' | 'label', value: string) {
    setClipRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleExtract() {
    if (!selectedPath) return
    setExtracting(true)
    setExtractResult(null)
    setShortsResult(null)
    try {
      const clips = clipRows.map(r => ({
        start: parseFloat(r.start) || 0,
        end: parseFloat(r.end) || 60,
        label: r.label.trim() || 'clip',
      }))
      const result = await studioApi.extractClips(selectedPath, clips)
      setExtractResult(result)
      if (result.ok) {
        toast.success('Clips extracted successfully')
      } else {
        toast.error(result.error ?? 'Extract failed')
      }
    } catch (e: any) {
      setExtractResult({ ok: false, error: e?.message ?? 'Extract failed' })
      toast.error(e?.message ?? 'Extract failed')
    } finally {
      setExtracting(false)
    }
  }

  async function fetchBrandKit(channel: string) {
    try {
      await brandKitApi.get(channel)
      toast.success('Brand kit loaded')
    } catch (e: any) {
      toast.error(apiErrorMessage(e, 'Failed to load brand kit'))
    }
  }

  async function handleUploadShorts() {
    if (!extractResult?.clips) return
    const successPaths = (extractResult.clips as any[])
      .filter(c => c.path && !c.error)
      .map(c => c.path)
    if (!successPaths.length) return

    setUploadingShorts(true)
    setShortsResult(null)
    try {
      const result = await studioApi.uploadClips({
        clip_paths: successPaths,
        title: uploadTitle.trim() || 'Clip',
        description: uploadDesc.trim(),
        tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
        channel: uploadChannel || undefined,
        youtube_shorts: true,
        social_platforms: false,
      })
      if (result.ok) {
        setShortsResult({ type: 'success', text: `Uploaded ${successPaths.length} clip(s) to YouTube Shorts` })
        toast.success(`Uploaded ${successPaths.length} clip(s) to YouTube Shorts`)
      } else {
        setShortsResult({ type: 'error', text: result.error ?? 'Upload failed' })
        toast.error(result.error ?? 'Upload failed')
      }
    } catch (e: any) {
      setShortsResult({ type: 'error', text: e?.message ?? 'Upload failed' })
      toast.error(e?.message ?? 'Upload failed')
    } finally {
      setUploadingShorts(false)
    }
  }

  // ── Import & Clip handlers ───────────────────────────────────────────────

  async function handleAnalyzeImport() {
    if (!importUrl.trim()) return
    setAnalyzing(true)
    setImportAnalysis(null)
    setSelectedClips(new Set())
    setExtractResult(null)
    setShortsResult(null)
    try {
      const result = await studioApi.importAnalyze(importUrl.trim())
      setImportAnalysis(result)
      if (result.ok && result.suggested_clips?.length) {
        setSelectedClips(new Set(result.suggested_clips.map((_: any, i: number) => i)))
        toast.success(`Found ${result.suggested_clips.length} suggested clip(s)`)
      } else if (result.ok) {
        toast.info('No suggested clips found')
      }
    } catch (e: any) {
      setImportAnalysis({ ok: false, error: apiErrorMessage(e, 'Analysis failed') })
      toast.error(apiErrorMessage(e, 'Analysis failed'))
    } finally {
      setAnalyzing(false)
    }
  }

  function toggleClipSelection(i: number) {
    setSelectedClips(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  async function handleExtractImportedClips() {
    if (!importAnalysis?.ok || selectedClips.size === 0) return
    setImportExtracting(true)
    setExtractResult(null)
    setShortsResult(null)
    try {
      const clips = (importAnalysis.suggested_clips as any[])
        .filter((_, i) => selectedClips.has(i))
        .map((c) => ({ start: c.start, end: c.end, label: c.label }))
      const result = await studioApi.importExtract(importUrl.trim(), clips)
      setExtractResult(result)
      if (result.ok) {
        refetchVideos()
        toast.success('Imported clips extracted successfully')
      } else {
        toast.error(result.error ?? 'Extract failed')
      }
    } catch (e: any) {
      setExtractResult({ ok: false, error: apiErrorMessage(e, 'Extract failed') })
      toast.error(apiErrorMessage(e, 'Extract failed'))
    } finally {
      setImportExtracting(false)
    }
  }


// ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-[#FAFAFA]">

      {/* ── Confirm Dialogs ──────────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!confirmDeleteClip}
        onConfirm={confirmDeleteClipRow}
        onCancel={() => setConfirmDeleteClip(null)}
        title="Delete clip"
        description="Remove this clip from the extraction list?"
        confirmLabel="Delete"
        cancelLabel="Cancel"
      />

      {/* ── Left: Video browser ────────────────────────────────────────────── */}
      <aside className="w-[320px] flex-shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Video Files</h2>
          <button
            onClick={() => refetchVideos()}
            disabled={videosLoading}
            className="w-8 h-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded-md transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={videosLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search + filter */}
        <div className="px-3 py-2 border-b border-[#E5E5E5]">
          <div className="relative">
            <Play size={14} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
            <input
              value={videoSearch}
              onChange={(e) => setVideoSearch(e.target.value)}
              placeholder="Search videos…"
              className="w-full pl-7 pr-2 h-8 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
          </div>
          <div className="flex gap-1 mt-1.5">
            {(['all', 'shorts', 'clips', 'output'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setVideoFilter(f)}
                className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors whitespace-nowrap ${
                  videoFilter === f
                    ? 'bg-[#0A0A0A] text-white'
                    : 'bg-[#F5F5F5] text-[#A3A3A3] hover:bg-[#EFEFF4]'
                }`}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {videosLoading && !videos.length ? (
            <div className="flex items-center justify-center h-24 text-[12px] text-[#A3A3A3]">Loading…</div>
          ) : videosFailed ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 px-4 text-center">
              <Film size={20} strokeWidth={1.5} className="text-[#D4D4D4]" />
              <p className="text-[12px] text-[#A3A3A3]">
                {videosForbidden ? 'Video list unavailable for this account' : 'Could not load video files'}
              </p>
              <p className="text-[11px] text-[#D4D4D4]">
                {videosForbidden
                  ? 'This endpoint refused the request. Seeing this means the studio listing has been restricted again.'
                  : 'Try Refresh, then check the server logs.'}
              </p>
            </div>
          ) : videos.length === 0 ? (
            <EmptyState
              icon={<Film size={24} strokeWidth={1.5} />}
              title="No video files found"
              subtitle="Run a pipeline to generate videos"
              action={
                <StudioButton variant="ghost" size="sm" onClick={() => refetchVideos()}>
                  <RefreshCw size={12} strokeWidth={1.5} />
                  Refresh
                </StudioButton>
              }
            />
          ) : (
            <ul className="py-1">
              {videos
                .filter((v) => {
                  const matchesSearch = v.name.toLowerCase().includes(videoSearch.toLowerCase())
                  const matchesFilter = videoFilter === 'all' || v.dir.includes(videoFilter)
                  return matchesSearch && matchesFilter
                })
                .map((v) => {
                  const isSelected = v.path === selectedPath
                  return (
                    <li key={v.path}>
                      <button
                        onClick={() => {
                          setSelectedPath(v.path)
                          setUploadResult(null)
                          setExtractResult(null)
                          setShortsResult(null)
                        }}
                        className={[
                          'w-full text-left px-3 py-2.5 transition-colors group border-l-[3px] rounded-t-md',
                          isSelected
                            ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                            : 'border-transparent hover:bg-[#F5F5F5]',
                        ].join(' ')}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-[12px] truncate ${isSelected ? 'font-semibold text-[#0A0A0A]' : 'text-[#0A0A0A]'}`}>
                            {v.name}
                          </p>
                          {info && (
                            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#F5F5F5] text-[#525252]">
                              <Play size={9} strokeWidth={2} />
                              <span>{fmtDuration(info.duration)}</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-[#A3A3A3]">{fmtSize(v.size_mb)}</span>
                          <span className="text-[9px] font-medium rounded-sm px-1.5 py-0.5 border text-[#0A0A0A]">
                            {dirBadge(v.dir)}
                          </span>
                          <span className="text-[10px] text-[#A3A3A3]">{relTime(v.mtime)}</span>
                        </div>
                      </button>
                    </li>
                  )
                })}
            </ul>
          )}
        </div>
      </aside>

      {/* ── Main: Tool cards + active tool panel ─────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Tool cards */}
        <div className="px-6 pt-4 pb-2 border-b border-[#E5E5E5]">
          <div className="grid grid-cols-3 gap-3">
            <StudioButton
              variant={activeTab === 'upload' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('upload')}
              size="lg"
              className="flex flex-col items-start text-left gap-2"
            >
              <Upload size={18} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-[13px] font-semibold">Upload to YouTube</p>
                <p className="text-[11px] text-[#A3A3A3] mt-0.5">Upload video file</p>
              </div>
            </StudioButton>
            <StudioButton
              variant={activeTab === 'extract' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('extract')}
              size="lg"
              className="flex flex-col items-start text-left gap-2"
            >
              <Scissors size={18} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-[13px] font-semibold">Extract Clips</p>
                <p className="text-[11px] text-[#A3A3A3] mt-0.5">Clip time ranges</p>
              </div>
            </StudioButton>
            <StudioButton
              variant={activeTab === 'import' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('import')}
              size="lg"
              className="flex flex-col items-start text-left gap-2"
            >
              <Sparkles size={18} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-[13px] font-semibold">Import & Clip</p>
                <p className="text-[11px] text-[#A3A3A3] mt-0.5">Import from URL</p>
              </div>
            </StudioButton>
            <StudioButton
              variant={activeTab === 'brandkit' ? 'primary' : 'secondary'}
              onClick={() => setActiveTab('brandkit')}
              size="lg"
              className="flex flex-col items-start gap-2"
            >
              <Paintbrush size={18} strokeWidth={1.5} />
              <div className="text-left">
                <p className="text-[13px] font-semibold">Brand Kit</p>
                <p className="text-[11px] text-[#A3A3A3] mt-0.5">Avatar, voice, music</p>
              </div>
            </StudioButton>
          </div>
        </div>

        {/* Active tool panel */}
        <div className="flex-1 overflow-y-auto px-6 py-4">

          {activeTab === 'upload' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Upload settings</h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Title</label>
                      <input
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Video title"
                        className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Channel</label>
                      <select
                        value={uploadChannel}
                        onChange={(e) => setUploadChannel(e.target.value)}
                        className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      >
                        <option value="">Default channel</option>
                        {channels.map(c => (
                          <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Description</label>
                    <textarea
                      value={uploadDesc}
                      onChange={(e) => setUploadDesc(e.target.value)}
                      placeholder="Video description"
                      rows={3}
                      className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md resize-none focus:outline-none focus:border-[#0A0A0A] transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Tags</label>
                    <TagInput value={uploadTags} onChange={setUploadTags} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleAiGenerate}
                      disabled={aiGenerating || !uploadTitle.trim()}
                      className="flex items-center gap-2 h-8 px-3 bg-[#F5F5F5] text-[#0A0A0A] text-[11px] font-medium rounded-md hover:bg-[#EFEFF4] disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {aiGenerating
                        ? <><Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> Generating…</>
                        : <><Sparkles size={12} strokeWidth={1.5} /> AI Generate</>}</button>
                    <span className="px-2 py-0.5 rounded bg-[#F5F5F5] text-[10px] text-[#A3A3A3]">AI title + description</span>
                  </div>
                  {uploadResult && (
                    <div className={`px-3 py-2 rounded-md text-[12px] font-medium ${uploadResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {uploadResult.text}
                    </div>
                  )}
                  <button
                    onClick={handleUploadMain}
                    disabled={uploading || !uploadTitle.trim()}
                    className="flex items-center gap-2 h-10 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                  >
                    {uploading
                      ? <><Loader2 size={14} strokeWidth={1.8} className="animate-spin" /> Uploading…</>
                      : <><Upload size={14} strokeWidth={1.8} /> Upload to YouTube</>}</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'extract' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-[#0A0A0A]">Clip time ranges</h3>
                  <button
                    onClick={addClipRow}
                    className="flex items-center gap-2 h-8 px-3 text-[11px] text-[#525252] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded-md transition-colors"
                  >
                    <Plus size={12} strokeWidth={1.5} />
                    Add clip
                  </button>
                </div>

                <div className="space-y-2">
                  {clipRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-2 p-2 bg-[#FAFAFA] rounded-lg">
                      <span className="text-[10px] text-[#A3A3A3] w-4 flex-shrink-0 text-center">{idx + 1}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          value={row.start}
                          onChange={(e) => updateClipRow(row.id, 'start', e.target.value)}
                          placeholder="0"
                          className="w-16 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                          min="0"
                        />
                        <span className="text-[10px] text-[#A3A3A3]">–</span>
                        <input
                          type="number"
                          value={row.end}
                          onChange={(e) => updateClipRow(row.id, 'end', e.target.value)}
                          placeholder="60"
                          className="w-16 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                          min="0"
                        />
                        <span className="text-[10px] text-[#A3A3A3]">s</span>
                      </div>
                      <input
                        type="text"
                        value={row.label}
                        onChange={(e) => updateClipRow(row.id, 'label', e.target.value)}
                        placeholder="clip label"
                        className="flex-1 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      />
                      <button
                        onClick={() => setConfirmDeleteClip({ id: row.id })}
                        disabled={clipRows.length === 1}
                        className="w-8 h-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#DC2626] transition-colors rounded"
                        title="Delete clip"
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleExtract}
                  disabled={extracting || !selectedPath}
                  className="mt-4 flex items-center gap-2 h-10 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {extracting
                    ? <><Loader2 size={14} strokeWidth={1.8} className="animate-spin" /> Extracting…</>
                    : <><Scissors size={14} strokeWidth={1.8} /> Extract Clips</>}</button>
                {extractResult && (
                  <div className="mt-4 p-3 rounded-lg border border-[#E5E5E5] bg-[#F5F5F5]">
                    {extractResult.ok === false ? (
                      <p className="text-[12px] text-[#DC2626] font-medium">{extractResult.error ?? 'Extract failed'}</p>
                    ) : (
                      <div>
                        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-2">Extracted Clips</p>
                        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
                          {(extractResult.clips as any[]).map((clip, i) => (
                            <div
                              key={i}
                              className={`flex items-center justify-between px-3 py-2 text-[13px] ${i !== 0 ? 'border-t border-[#E5E5E5]' : ''}`}
                            >
                              <span className="text-[#0A0A0A] font-medium">{clip.label}</span>
                              {clip.error ? (
                                <span className="text-[12px] text-[#DC2626]">{clip.error}</span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.duration}s</span>
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.size_mb} MB</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        {shortsResult && (
                          <div className={`mt-3 px-3 py-2 rounded-md text-[12px] font-medium ${shortsResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                            {shortsResult.text}
                          </div>
                        )}
                        <button
                          onClick={handleUploadShorts}
                          disabled={uploadingShorts || !shortsResult}
                          className="mt-3 flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                        >
                          {uploadingShorts
                            ? <><Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> Uploading…</>
                            : <><Upload size={13} strokeWidth={1.8} /> Upload to Shorts</>}</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">YouTube URL</h3>
                <div className="flex gap-2">
                  <input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=…"
                    className="flex-1 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  />
                  <button
                    onClick={handleAnalyzeImport}
                    disabled={analyzing || !importUrl.trim()}
                    className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {analyzing
                      ? <><Loader2 size={14} strokeWidth={1.8} className="animate-spin" /> Analyzing…</>
                      : <><Sparkles size={14} strokeWidth={1.8} /> Analyze</>}</button>
                </div>
                <p className="text-[11px] text-[#A3A3A3] mt-1.5">
                  Paste any public YouTube video - we'll read its real captions and suggest the best moments to clip.
                  Needs existing captions (auto or uploaded); doesn't transcribe audio itself.
                  Max 10/hour, 60 min video length.
                </p>
                {importAnalysis?.ok && (!importAnalysis.error) && (
                  <div>
                    <p className="text-[13px] font-medium text-[#0A0A0A] mb-1 truncate">{importAnalysis.title}</p>
                    <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-2 mt-3">
                      Suggested clips - pick which to extract
                    </p>
                    <div className="border border-[#E5E5E5] rounded-md divide-y divide-[#E5E5E5]">
                      {importAnalysis.suggested_clips?.map((c: any, i: number) => (
                        <label key={i} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-[#FAFAFA] transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedClips.has(i)}
                            onChange={() => toggleClipSelection(i)}
                            className="mt-0.5 w-4 h-4 text-[#0A0A0A] border-[#E5E5E5] rounded focus:ring-[#0A0A0A]"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-medium text-[#0A0A0A]">{c.label}</span>
                              <span className="text-[11px] text-[#A3A3A3]">{Math.round(c.start)}s–{Math.round(c.end)}s</span>
                            </div>
                            <p className="text-[12px] text-[#525252] mt-0.5">{c.reason}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handleExtractImportedClips}
                      disabled={importExtracting || selectedClips.size === 0}
                      className="mt-3 flex items-center gap-2 h-10 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                    >
                      {importExtracting
                        ? <><Loader2 size={14} strokeWidth={1.8} className="animate-spin" /> Downloading & extracting…</>
                        : <><Scissors size={14} strokeWidth={1.8} /> Extract Selected ({selectedClips.size})</>}</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'brandkit' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-5">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Brand Kit</h3>
                <BrandKitPanel
                  channel={uploadChannel}
                  load={() => fetchBrandKit(uploadChannel)}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
