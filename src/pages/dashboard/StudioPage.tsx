import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  RefreshCw, Film, Upload, Scissors, Plus, Trash2,
  Loader2, Sparkles, Play, Paintbrush, Image,
} from 'lucide-react'
import { studioApi, channelsApi, youtubeApi } from '@api/services'
import type { Channel } from '@/types/api'
import { BrandKitPanel } from '@/components/studio/BrandKitPanel'
import { ThumbnailAbPanel } from '@/components/studio/ThumbnailAbPanel'
import { ClipPreview } from '@/components/studio/ClipPreview'
import { apiErrorMessage } from '@lib/apiError'
import { useToast } from '@components/Toast'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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

interface ExtractedClip {
  label: string
  path?: string
  duration?: number
  size_mb?: number
  error?: string
  asset_id?: string
}

interface ClipResult {
  ok: boolean
  clips?: ExtractedClip[]
  error?: string
}

interface ImportAnalysis {
  ok: boolean
  title?: string
  error?: string
  suggested_clips?: Array<{ start: number; end: number; label: string; reason: string }>
}

type ActiveTab = 'upload' | 'extract' | 'import' | 'brandkit' | 'thumbnailAb'

// Tool cards shown above the active tool panel. Declared as data (not five
// near-identical JSX blocks) so the grid, height and hover styling stay in sync
// across all five — the uneven `grid-cols-3` layout with a fixed `h-11` was
// clipping the icon + title + subtitle on the last two cards.
const TOOLS: Array<{
  id: ActiveTab
  icon: typeof Upload
  label: string
  desc: string
}> = [
  { id: 'upload',      icon: Upload,     label: 'Upload to YouTube', desc: 'Upload video file' },
  { id: 'extract',     icon: Scissors,   label: 'Extract Clips',     desc: 'Clip time ranges' },
  { id: 'import',      icon: Sparkles,   label: 'Import & Clip',     desc: 'Import from URL' },
  { id: 'brandkit',    icon: Paintbrush, label: 'Brand Kit',         desc: 'Channel style preferences' },
  { id: 'thumbnailAb', icon: Image,      label: 'Thumbnail A/B',     desc: 'Variant testing' },
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const toolParam = searchParams.get('tool')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const activeTab = TOOLS.find(tool => tool.id === toolParam)?.id ?? 'upload'
  function setActiveTab(tool: ActiveTab) {
    const params = new URLSearchParams(searchParams)
    params.set('tab', 'tools')
    params.set('tool', tool)
    setSearchParams(params)
  }

  // Toast
  const toast = useToast()

  // Confirm dialogs
  const [confirmDeleteClip, setConfirmDeleteClip] = useState<{ id: string } | null>(null)

  // Upload tab state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadChannel, setUploadChannel] = useState('')
  const [selectedAbVideoId, setSelectedAbVideoId] = useState<string | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCover, setUploadCover] = useState<{ data: string; name: string } | null>(null)
  const [coverError, setCoverError] = useState<string | null>(null)
  const [readingCover, setReadingCover] = useState(false)
  const [coverRetry, setCoverRetry] = useState<{ videoId: string; channel: string; data: string } | null>(null)
  const [retryingCover, setRetryingCover] = useState(false)
  const [visibility, setVisibility] = useState<'default' | 'public' | 'unlisted' | 'private'>('default')
  const [notifySubscribers, setNotifySubscribers] = useState(true)
  const [addingFile, setAddingFile] = useState(false)
  const [fileProgress, setFileProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; text: string; url?: string } | null>(null)

  // Extract tab state
  const [clipRows, setClipRows] = useState<ClipRow[]>([
    { id: '1', start: '0', end: '60', label: 'clip-1' },
  ])
  const [extractResult, setExtractResult] = useState<ClipResult | null>(null)
  const [importExtractResult, setImportExtractResult] = useState<ClipResult | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [uploadingShorts, setUploadingShorts] = useState(false)
  const [shortsResult, setShortsResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Import & Clip tab state
  const [importUrl, setImportUrl] = useState('')
  const [importAnalysis, setImportAnalysis] = useState<ImportAnalysis | null>(null)
  const [analyzedUrl, setAnalyzedUrl] = useState('')
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

  const { data: videoInfoData, isFetching: infoLoading, error: infoError } = useQuery({
    queryKey: ['studio-info', selectedPath],
    queryFn: () => studioApi.info(selectedPath!),
    enabled: !!selectedPath,
  })

  const { data: channelsData, error: channelsError } = useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.list(),
  })

  const videos: VideoFile[] = videosData?.videos ?? []
  const channels: Channel[] = channelsData ?? []
  const selectedChannel = uploadChannel || channels.find(channel => channel.is_default)?.slug ||
    (channels.length === 1 ? channels[0].slug : '')
  const info: VideoInfo | null = videoInfoData ?? null
  const busy = uploading || extracting || uploadingShorts || importExtracting || addingFile || readingCover || retryingCover
  const successfulClips = (extractResult?.clips ?? []).filter(clip => clip.path && !clip.error)
  const shortsEligible = !!info?.ok && info.width <= info.height &&
    successfulClips.length > 0 && successfulClips.every(clip => (clip.duration ?? 0) > 0 && (clip.duration ?? 0) <= 180)
  const visibleVideos = videos.filter(video =>
    video.name.toLowerCase().includes(videoSearch.toLowerCase()) &&
    (videoFilter === 'all' || dirBadge(video.dir) === videoFilter),
  )

  async function addComputerFile(file: File) {
    if (!/\.(mp4|mov|webm|mkv|m4v)$/i.test(file.name) || file.size === 0 || file.size > 2 * 1024 ** 3) {
      setUploadResult({ type: 'error', text: 'Choose a non-empty MP4, MOV, WebM, MKV or M4V up to 2 GB.' })
      return
    }
    setAddingFile(true)
    setFileProgress(0)
    setUploadResult(null)
    try {
      const result = await studioApi.createAsset(file, {
        title: uploadTitle.trim() || file.name.replace(/\.[^.]+$/, ''),
        channelSlug: selectedChannel || undefined,
        onProgress: setFileProgress,
      })
      if (!result.ok || !result.asset?.public_id) throw new Error(result.error || 'Could not add video to your library.')
      navigate(`/app/studio?asset=${encodeURIComponent(result.asset.public_id)}`)
    } catch (error) {
      setUploadResult({ type: 'error', text: apiErrorMessage(error, 'Could not add video to your library.') })
    } finally {
      setAddingFile(false)
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function chooseCover(file: File) {
    setCoverError(null)
    setUploadCover(null)
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size === 0 || file.size > 2_000_000) {
      setCoverError('Choose a non-empty JPEG or PNG under 2 MB.')
      return
    }
    setReadingCover(true)
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image.'))
        reader.onerror = () => reject(new Error('Could not read image.'))
        reader.readAsDataURL(file)
      })
      await new Promise<void>((resolve, reject) => {
        const image = new window.Image()
        image.onload = () => resolve()
        image.onerror = () => reject(new Error('This file is not a readable image.'))
        image.src = data
      })
      setUploadCover({ data, name: file.name })
    } catch (error) {
      setCoverError(apiErrorMessage(error, 'Could not read thumbnail.'))
    } finally {
      setReadingCover(false)
    }
  }

  async function retryCover() {
    if (!coverRetry) return
    setRetryingCover(true)
    setCoverError(null)
    try {
      const result = await youtubeApi.setThumbnail(coverRetry.videoId, coverRetry.data, coverRetry.channel)
      if (!result.ok) throw new Error('YouTube did not accept the thumbnail.')
      setCoverRetry(null)
      setUploadResult(previous => previous ? { ...previous, text: 'Video uploaded; thumbnail accepted by YouTube. Display updates may take time.' } : previous)
    } catch (error) {
      setCoverError(apiErrorMessage(error, 'Thumbnail retry failed. Your video is already uploaded; do not upload it again.'))
    } finally {
      setRetryingCover(false)
    }
  }

  async function handleAiGenerate() {
    if (!uploadTitle.trim()) return
    setAiGenerating(true)
    try {
      const result = await studioApi.generateMetadata(uploadTitle.trim(), selectedChannel)
      if (result.ok) {
        if (result.description) setUploadDesc(result.description)
        if (result.tags?.length) setUploadTags(result.tags.join(', '))
        toast.success('AI metadata generated')
      } else {
        toast.error(result.error || 'Metadata generation failed')
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'AI generation failed'))
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleUploadMain() {
    if (!selectedPath || !uploadTitle.trim() || !selectedChannel) {
      setUploadResult({ type: 'error', text: 'Select a rendered video, destination channel and title first.' })
      return
    }
    setUploading(true)
    setUploadResult(null)
    try {
      const tagsArr = uploadTags.split(',').map(t => t.trim()).filter(Boolean)
      const result = await studioApi.uploadMain({
        video_path: selectedPath,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        tags: tagsArr,
        channel: selectedChannel,
        thumbnail_data: uploadCover?.data,
        privacy_status: visibility === 'default' ? undefined : visibility,
        notify_subscribers: notifySubscribers,
      })
      if (result.ok) {
        const coverFailed = uploadCover && result.thumbnail?.ok !== true
        setCoverRetry(coverFailed ? { videoId: result.video_id, channel: selectedChannel, data: uploadCover.data } : null)
        setUploadResult({ type: 'success', text: coverFailed
          ? `Video uploaded, but thumbnail was not applied. ${result.thumbnail?.detail || 'YouTube did not confirm the thumbnail.'} Retry only the thumbnail below.`
          : uploadCover ? 'Video uploaded; thumbnail accepted by YouTube. Display updates may take time.' : 'Uploaded to YouTube.', url: result.url })
        toast.success('Video uploaded to YouTube')
      } else {
        setUploadResult({ type: 'error', text: result.error ?? 'Upload failed' })
        toast.error(result.error ?? 'Upload failed')
      }
    } catch (e) {
      setUploadResult({ type: 'error', text: apiErrorMessage(e, 'Upload failed') })
      toast.error(apiErrorMessage(e, 'Upload failed'))
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
    if (!selectedPath) {
      setExtractResult({ ok: false, error: 'Select a rendered video first.' })
      return
    }
    const clips = clipRows.map(row => ({ start: Number(row.start), end: Number(row.end), label: row.label.trim() || 'clip' }))
    if (clipRows.some(row => !row.start.trim() || !row.end.trim()) ||
        clips.some(clip => !Number.isFinite(clip.start) || !Number.isFinite(clip.end) ||
          clip.start < 0 || clip.end <= clip.start || clip.end - clip.start > 600 ||
          (info?.ok && clip.end > info.duration))) {
      setExtractResult({ ok: false, error: 'Use valid start/end seconds within the video, with end after start (maximum 600 seconds per clip).' })
      return
    }
    setExtracting(true)
    setExtractResult(null)
    setShortsResult(null)
    try {
      const result = await studioApi.extractClips(selectedPath, clips)
      setExtractResult(result)
      if (result.ok) {
        toast.success('Clips extracted successfully')
      } else {
        toast.error(result.error ?? 'Extract failed')
      }
    } catch (e) {
      setExtractResult({ ok: false, error: apiErrorMessage(e, 'Extract failed') })
      toast.error(apiErrorMessage(e, 'Extract failed'))
    } finally {
      setExtracting(false)
    }
  }

  async function handleUploadShorts() {
    if (!extractResult?.clips) return
    const successPaths = extractResult.clips
      .filter(c => c.path && !c.error)
      .flatMap(c => c.path ? [c.path] : [])
    if (!successPaths.length) return

    setUploadingShorts(true)
    setShortsResult(null)
    try {
      const result = await studioApi.uploadClips({
        clip_paths: successPaths,
        title: uploadTitle.trim() || 'Clip',
        description: uploadDesc.trim(),
        tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
        channel: selectedChannel,
        youtube_shorts: true,
        social_platforms: false,
        privacy_status: visibility === 'default' ? undefined : visibility,
        notify_subscribers: notifySubscribers,
      })
      const outcomes: Array<{ video_id?: string; error?: string }> = result.results?.youtube_shorts ?? []
      const published = outcomes.filter(outcome => outcome.video_id && !outcome.error).length
      if (result.ok && published === successPaths.length) {
        setShortsResult({ type: 'success', text: `Uploaded ${published} clip(s) to YouTube Shorts` })
        toast.success(`Uploaded ${published} clip(s) to YouTube Shorts`)
      } else {
        const message = `${published}/${successPaths.length} uploaded. ${result.error || ''} ${outcomes.map(outcome => outcome.error).filter(Boolean).join(' ')} Review in Content before retrying to avoid duplicate uploads.`
        setShortsResult({ type: 'error', text: message })
        toast.error(message)
      }
    } catch (e) {
      setShortsResult({ type: 'error', text: apiErrorMessage(e, 'Upload failed') })
      toast.error(apiErrorMessage(e, 'Upload failed'))
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
    setImportExtractResult(null)
    setShortsResult(null)
    try {
      const result = await studioApi.importAnalyze(importUrl.trim())
      setImportAnalysis(result)
      setAnalyzedUrl(importUrl.trim())
      if (result.ok && result.suggested_clips?.length) {
        setSelectedClips(new Set(result.suggested_clips.map((_: unknown, i: number) => i)))
        toast.success(`Found ${result.suggested_clips.length} suggested clip(s)`)
      } else if (result.ok) {
        toast.info('No suggested clips found')
      } else {
        toast.error(result.error || 'Analysis failed')
      }
    } catch (e) {
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
    setImportExtractResult(null)
    setShortsResult(null)
    try {
      const clips = (importAnalysis.suggested_clips ?? [])
        .filter((_, i) => selectedClips.has(i))
        .map((c) => ({ start: c.start, end: c.end, label: c.label }))
      const result = await studioApi.importExtract(analyzedUrl, clips)
      setImportExtractResult(result)
      if (result.ok) {
        refetchVideos()
        toast.success('Imported clips extracted successfully')
      } else {
        toast.error(result.error ?? 'Extract failed')
      }
    } catch (e: any) {
      setImportExtractResult({ ok: false, error: apiErrorMessage(e, 'Extract failed') })
      toast.error(apiErrorMessage(e, 'Extract failed'))
    } finally {
      setImportExtracting(false)
    }
  }


// ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col lg:flex-row overflow-y-auto lg:overflow-hidden bg-[#FAFAFA]">

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
      {(activeTab === 'upload' || activeTab === 'extract') && <aside className="w-full lg:w-[280px] max-h-72 lg:max-h-none flex-shrink-0 bg-white border-b lg:border-r border-[#E5E5E5] flex flex-col">
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
              subtitle="Generate a render, or add your own video in Content."
              action={
                <StudioButton variant="ghost" size="sm" onClick={() => refetchVideos()}>
                  <RefreshCw size={12} strokeWidth={1.5} />
                  Refresh
                </StudioButton>
              }
            />
          ) : visibleVideos.length === 0 ? (
            <p className="p-5 text-sm text-[#525252]">No videos match these filters.</p>
          ) : (
            <ul className="py-1">
              {visibleVideos
                .map((v) => {
                  const isSelected = v.path === selectedPath
                  return (
                    <li key={v.path}>
                      <button
                        disabled={busy}
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedPath(v.path)
                          setUploadCover(null)
                          setCoverError(null)
                          setCoverRetry(null)
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
                          {isSelected && info?.ok && (
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
      </aside>}

      {/* ── Main: Tool cards + active tool panel ─────────────────────────────── */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Tool cards — 5 across on wide screens so the row is even (no orphan cell),
            h-auto so the icon + title + subtitle are never clipped, and a plain
            <button> rather than StudioButton (whose base items-center/justify-center
            would win over a card's left-aligned flex-col layout). */}
        <div className="px-[16px] sm:px-[24px] pt-[20px] pb-[16px] border-b border-[#E5E5E5] bg-white">
          <h2 className="text-xl font-semibold text-[#0A0A0A]">Creator tools</h2>
          <p className="mt-[4px] mb-[16px] text-sm text-[#525252]">Prepare, repurpose and publish. Choose a tool to see its required inputs.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-[8px]" role="tablist" aria-label="Studio tools">
            {TOOLS.map(({ id, icon: Icon, label, desc }) => {
              const active = activeTab === id
              return (
                <button
                  key={id}
                  role="tab"
                  tabIndex={active ? 0 : -1}
                  aria-selected={active}
                  aria-controls={`studio-tool-${id}`}
                  id={`studio-tab-${id}`}
                  disabled={busy}
                  onKeyDown={event => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                    event.preventDefault()
                    const index = TOOLS.findIndex(tool => tool.id === activeTab)
                    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TOOLS.length - 1
                      : (index + (event.key === 'ArrowRight' ? 1 : -1) + TOOLS.length) % TOOLS.length
                    const next = TOOLS[nextIndex].id
                    setActiveTab(next)
                    document.getElementById(`studio-tab-${next}`)?.focus()
                  }}
                  onClick={() => setActiveTab(id)}
                  className={[
                    'w-full flex flex-row sm:flex-col items-start gap-[8px] rounded-md border p-[12px] text-left transition-colors',
                    active
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#0A0A0A] border-[#E5E5E5] hover:bg-[#F5F5F5]',
                  ].join(' ')}
                >
                  <Icon size={18} strokeWidth={1.5} className="shrink-0" />
                  <div className="w-full min-w-0">
                    <p className="text-[13px] font-semibold leading-snug">{label}</p>
                    <p className={`hidden sm:block text-[11px] mt-0.5 leading-snug ${active ? 'text-white/70' : 'text-[#A3A3A3]'}`}>
                      {desc}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Active tool panel */}
        <div className="flex-1 lg:overflow-y-auto px-[12px] sm:px-[24px] py-[20px]" role="tabpanel"
          id={`studio-tool-${activeTab}`} aria-labelledby={`studio-tab-${activeTab}`}>
          {activeTab !== 'thumbnailAb' && <div className="max-w-3xl mb-[20px] rounded-xl border border-[#E5E5E5] bg-white p-[16px] space-y-[12px]">
            <div>
              <label htmlFor="studio-channel" className="block text-xs font-medium text-[#525252] mb-1">Destination channel</label>
              <select id="studio-channel" value={selectedChannel} disabled={busy}
                onChange={event => { setUploadChannel(event.target.value); setUploadResult(null); setShortsResult(null); setCoverRetry(null); setCoverError(null) }}
                className="w-full max-w-sm rounded-md border border-[#D4D4D4] bg-white px-3 py-2 text-sm">
                <option value="">Select a connected channel</option>
                {channels.map(channel => <option key={channel.slug} value={channel.slug}>{channel.name || channel.slug}</option>)}
              </select>
              {channelsError && <p role="alert" className="text-sm text-red-700 mt-2">{apiErrorMessage(channelsError, 'Could not load channels.')}</p>}
              {!selectedChannel && <p className="text-xs text-amber-800 mt-2">Select a channel before saving brand settings or publishing. <Link className="underline" to="/app/channels">Manage channels</Link></p>}
            </div>
            {(activeTab === 'upload' || activeTab === 'extract') && <div className="text-sm" aria-live="polite">
              <p className="font-medium">Source video</p>
              {selectedPath ? <p className="break-all mt-1 text-[#525252]">{videos.find(video => video.path === selectedPath)?.name || selectedPath}</p>
                : <p className="mt-1 text-amber-800">Choose a rendered video from the video list{activeTab === 'upload' ? ', or add a file below.' : ' to extract clips.'}</p>}
              {infoLoading && <p className="text-xs mt-1">Reading video details...</p>}
              {info?.ok && <p className="text-xs text-[#737373] mt-1">{info.duration_str} · {info.width} x {info.height} · {info.size_mb} MB</p>}
              {(infoError || info?.ok === false) && <p role="alert" className="text-xs text-red-700 mt-1">{info?.error || apiErrorMessage(infoError, 'Could not read this video.')}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <label className="text-xs">YouTube visibility
                  <select aria-label="YouTube visibility" value={visibility} disabled={busy}
                    onChange={event => setVisibility(event.target.value as typeof visibility)}
                    className="block w-full max-w-full rounded border bg-white p-[8px] mt-[4px] text-sm">
                    <option value="default">Configured default (may be public)</option>
                    <option value="private">Private — review first</option>
                    <option value="unlisted">Unlisted</option>
                    <option value="public">Public</option>
                  </select>
                </label>
                <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={notifySubscribers} disabled={busy}
                  onChange={event => setNotifySubscribers(event.target.checked)} /> Notify subscribers</label>
              </div>
            </div>}
          </div>}

          {activeTab === 'upload' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-[16px] sm:p-[24px]">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">Upload settings</h3>
                <p className="text-xs text-[#525252] mb-4">1. Choose a video · 2. Add details and a cover · 3. Check visibility and upload</p>
                <div className="mb-5 rounded-lg border border-dashed border-[#A3A3A3] bg-[#FAFAFA] p-4">
                  <label htmlFor="studio-computer-file" className="block text-sm font-medium mb-1">Add a video from your computer</label>
                  <p className="text-xs text-[#525252] mb-3">MP4, MOV, WebM, MKV or M4V, up to 2 GB. Opens the Content review screen before publishing; adding a file does not upload it to YouTube.</p>
                  <input id="studio-computer-file" type="file" accept=".mp4,.mov,.webm,.mkv,.m4v"
                    disabled={busy} className="block w-full text-sm"
                    onChange={event => { const file = event.target.files?.[0]; if (file) void addComputerFile(file); event.target.value = '' }} />
                  {addingFile && <div role="status" className="mt-3 text-sm">Adding to library: {fileProgress}%{fileProgress >= 99 ? ' — validating video...' : ''}<progress className="block w-full mt-2" max={100} value={fileProgress} /></div>}
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg border p-[12px]">
                    <label htmlFor="studio-upload-cover" className="block text-sm font-medium mb-1">YouTube thumbnail (optional)</label>
                    <p className="text-xs text-[#525252] mb-3">For the selected rendered video: JPEG or PNG under 2 MB. Use 16:9 for long videos or 9:16 for Shorts. YouTube may display Shorts covers differently across surfaces. Computer uploads use the separate Content review workflow.</p>
                    <input id="studio-upload-cover" type="file" accept="image/jpeg,image/png" disabled={busy || uploadResult?.type === 'success'}
                      className="block w-full text-sm" onChange={event => {
                        const file = event.target.files?.[0]
                        if (file) void chooseCover(file)
                        event.target.value = ''
                      }} />
                    {readingCover && <p role="status" className="text-xs mt-2">Reading thumbnail...</p>}
                    {uploadCover && <div className="mt-3">
                      <img src={uploadCover.data} alt="Selected YouTube thumbnail" className="max-h-48 max-w-full rounded object-contain" />
                      <p className="text-xs mt-1 break-all">{uploadCover.name}</p>
                      <button type="button" disabled={busy || uploadResult?.type === 'success'} className="underline text-xs mt-2"
                        onClick={() => { setUploadCover(null); setCoverError(null) }}>Remove thumbnail</button>
                    </div>}
                    {coverError && <p role="alert" className="text-sm text-red-700 mt-2">{coverError}</p>}
                  </div>
                  <div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Title</label>
                      <input
                        aria-label="Video title"
                        maxLength={100}
                        value={uploadTitle}
                        onChange={(e) => setUploadTitle(e.target.value)}
                        placeholder="Video title"
                        className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      />
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
                      disabled={aiGenerating || !uploadTitle.trim() || !selectedChannel}
                      className="flex items-center gap-2 h-8 px-3 bg-[#F5F5F5] text-[#0A0A0A] text-[11px] font-medium rounded-md hover:bg-[#EFEFF4] disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      {aiGenerating
                        ? <><Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> Generating…</>
                        : <><Sparkles size={12} strokeWidth={1.5} /> AI Generate</>}</button>
                    <span className="px-2 py-0.5 rounded bg-[#F5F5F5] text-[10px] text-[#737373]">AI description + tags</span>
                  </div>
                  {uploadResult && (
                    <div role={uploadResult.type === 'error' ? 'alert' : 'status'} className={`px-3 py-2 rounded-md text-[12px] font-medium ${uploadResult.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {uploadResult.text}
                      {uploadResult.url && <a className="block mt-1 underline" href={uploadResult.url} target="_blank" rel="noreferrer">Open video on YouTube</a>}
                      {coverRetry && <button type="button" onClick={retryCover} disabled={retryingCover} className="block mt-2 underline">
                        {retryingCover ? 'Retrying thumbnail...' : 'Retry thumbnail only'}
                      </button>}
                    </div>
                  )}
                  <button
                    onClick={handleUploadMain}
                    disabled={busy || !selectedPath || !uploadTitle.trim() || !selectedChannel || info?.ok === false || uploadResult?.type === 'success'}
                    className="flex items-center gap-2 h-10 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                  >
                    {uploading
                      ? <><Loader2 size={14} strokeWidth={1.8} className="animate-spin" /> Uploading…</>
                      : <><Upload size={14} strokeWidth={1.8} /> Upload to YouTube</>}</button>
                  <p className="text-xs text-[#525252]">Requires a source video, title and channel. Review visibility and notifications above. Uploading may take several minutes; keep this page open.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'extract' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-[16px] sm:p-[24px]">
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
                <p className="text-xs text-[#525252] mb-4">Trims the video without changing its framing. For Shorts, use square/vertical footage and clips no longer than 180 seconds. Review saved clips in Content before publishing.</p>

                <div className="space-y-2">
                  {clipRows.map((row, idx) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-[8px] p-[8px] bg-[#FAFAFA] rounded-lg">
                      <span className="text-[10px] text-[#A3A3A3] w-4 flex-shrink-0 text-center">{idx + 1}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          type="number"
                          aria-label={`Clip ${idx + 1} start seconds`}
                          value={row.start}
                          onChange={(e) => updateClipRow(row.id, 'start', e.target.value)}
                          placeholder="0"
                          className="w-[72px] h-[40px] px-[8px] text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                          min="0"
                        />
                        <span className="text-[10px] text-[#A3A3A3]">–</span>
                        <input
                          type="number"
                          aria-label={`Clip ${idx + 1} end seconds`}
                          value={row.end}
                          onChange={(e) => updateClipRow(row.id, 'end', e.target.value)}
                          placeholder="60"
                          className="w-[72px] h-[40px] px-[8px] text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                          min="0"
                        />
                        <span className="text-[10px] text-[#A3A3A3]">s</span>
                      </div>
                      <input
                        type="text"
                        aria-label={`Clip ${idx + 1} label`}
                        value={row.label}
                        onChange={(e) => updateClipRow(row.id, 'label', e.target.value)}
                        placeholder="clip label"
                        className="flex-1 min-w-24 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      />
                      <button
                        onClick={() => setConfirmDeleteClip({ id: row.id })}
                        disabled={clipRows.length === 1}
                        className="w-[40px] h-[40px] flex items-center justify-center text-[#A3A3A3] hover:text-[#DC2626] transition-colors rounded"
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
                    {extractResult.ok === false && !extractResult.clips?.length ? (
                      <p className="text-[12px] text-[#DC2626] font-medium">{extractResult.error ?? 'Extract failed'}</p>
                    ) : (
                      <div>
                        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-2">Extracted Clips</p>
                        {extractResult.error && <p role="alert" className="text-sm text-red-700 mb-2">{extractResult.error}</p>}
                        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
                          {(extractResult.clips ?? []).map((clip, i) => (
                            <div
                              key={i}
                              className={`px-3 py-3 text-[13px] ${i !== 0 ? 'border-t border-[#E5E5E5]' : ''}`}
                            >
                              <span className="text-[#0A0A0A] font-medium">{clip.label}</span>
                              {clip.asset_id && <Link className="text-xs underline" to={`/app/studio?asset=${encodeURIComponent(clip.asset_id)}`}>Review in Content</Link>}
                              {clip.error ? (
                                <span className="text-[12px] text-[#DC2626]">{clip.error}</span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.duration}s</span>
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.size_mb} MB</span>
                                </div>
                              )}
                              {clip.asset_id && !clip.error && <ClipPreview key={clip.asset_id} assetId={clip.asset_id} label={clip.label} />}
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
                          disabled={uploadingShorts || !shortsEligible || !selectedChannel || !!shortsResult}
                          className="mt-3 flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                        >
                          {uploadingShorts
                            ? <><Loader2 size={13} strokeWidth={1.8} className="animate-spin" /> Uploading…</>
                            : <><Upload size={13} strokeWidth={1.8} /> Upload to Shorts</>}</button>
                        {!shortsEligible && <p className="text-xs text-amber-800 mt-2">Direct Shorts upload needs square/vertical clips of 180 seconds or less. Review in Content for other publishing options.</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'import' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-[16px] sm:p-[24px]">
                <h3 className="text-sm font-semibold text-[#0A0A0A] mb-4">YouTube URL</h3>
                <p className="text-xs text-[#525252] mb-4">Analyze captions, select moments, then play the extracted clips before publishing. Only import content you have permission to reuse.</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={importUrl}
                    aria-label="YouTube import URL"
                    disabled={analyzing || importExtracting}
                    onChange={(e) => { setImportUrl(e.target.value); setImportAnalysis(null); setImportExtractResult(null); setSelectedClips(new Set()) }}
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
                  Use a video you own or have permission to reuse. We'll read its real captions and suggest moments to clip.
                  Needs existing captions (auto or uploaded); doesn't transcribe audio itself.
                  Max 10/hour, 60 min video length.
                </p>
                {importAnalysis?.error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{importAnalysis.error}</p>}
                {importAnalysis?.ok && !importAnalysis.suggested_clips?.length && <p role="status" className="mt-3 text-sm">No suggested clips found. Try a video with available captions.</p>}
                {importAnalysis?.ok && (!importAnalysis.error) && (
                  <div>
                    <p className="text-[13px] font-medium text-[#0A0A0A] mb-1 truncate">{importAnalysis.title}</p>
                    <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-2 mt-3">
                      Suggested clips - pick which to extract
                    </p>
                    <div className="border border-[#E5E5E5] rounded-md divide-y divide-[#E5E5E5]">
                      {importAnalysis.suggested_clips?.map((c, i) => (
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
                {importExtractResult && <div role={importExtractResult.ok ? 'status' : 'alert'} className="mt-4 rounded-lg border p-3 text-sm">
                  {importExtractResult.error || 'Extraction results'}
                  {(importExtractResult.clips ?? []).map((clip, index) => <div key={index} className="mt-3 border-t pt-3">
                    <p className={clip.error ? 'text-red-700' : 'text-[#525252]'}>{clip.label}: {clip.error || `${clip.duration}s · ${clip.size_mb} MB`}</p>
                    {clip.asset_id && !clip.error && <>
                      <ClipPreview key={clip.asset_id} assetId={clip.asset_id} label={clip.label} />
                      <Link to={`/app/studio?asset=${encodeURIComponent(clip.asset_id)}`} className="block mt-2 underline">Review {clip.label} in Content</Link>
                    </>}
                  </div>)}
                </div>}
              </div>
            </div>
          )}

          {activeTab === 'brandkit' && (
            <div className="max-w-2xl">
                {selectedChannel ? <BrandKitPanel
                  channel={selectedChannel}
                  channelName={channels.find(channel => channel.slug === selectedChannel)?.name || selectedChannel}
                /> : <p className="text-sm text-[#525252]">Choose a connected channel above to load its brand kit.</p>}
            </div>
          )}

          {activeTab === 'thumbnailAb' && (
            <div className="max-w-2xl">
              <div className="bg-white rounded-xl border border-[#E5E5E5] p-[16px] sm:p-[24px]">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                  <div>
                    <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                      YouTube video ID
                    </p>
                    <input
                      type="text"
                      aria-label="Thumbnail test video ID"
                      value={selectedAbVideoId ?? ''}
                      onChange={(e) => setSelectedAbVideoId(e.target.value.trim() || null)}
                      maxLength={11}
                      placeholder="e.g. dQw4w9WgXcQ"
                      className="w-full h-[40px] px-[12px] rounded border border-[#E5E5E5] text-[12px] text-[#0A0A0A] bg-white focus:outline-none focus:border-[#0A0A0A] transition-colors"
                    />
                    <p className="text-[10.5px] text-[#A3A3A3] mt-1.5">
                      Enter the YouTube video ID (11 chars) to register its thumbnail as baseline,
                      then add challenger variants.
                    </p>
                  </div>
                </div>
                <ThumbnailAbPanel embedded
                  videoId={selectedAbVideoId ?? undefined}
                  onReportChange={() => refetchVideos()}
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
