import { useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  UploadCloud,
  X,
} from 'lucide-react'
import { studioApi } from '@api/services'
import { apiClient } from '@api/client'
import { apiErrorMessage } from '@lib/apiError'
import { useToast } from '@components/Toast'
import { useChannels } from '@hooks/useJobs'
import StatusChip from '@components/studio/StatusChip'
import {
  formatBytes,
  formatDuration,
  relativeTime,
  useStudioAsset,
} from '@hooks/useStudioAssets'

/**
 * One asset's whole life, in place.
 *
 * Read and edit only in this phase. Publishing becomes a job-backed action with its own progress
 * states, so there is deliberately no "Publish" button yet — a button that cannot publish is worse
 * than no button (plan §15.4, preflight rule).
 */
export default function AssetDrawer({
  publicId,
  onClose,
}: {
  publicId: string
  onClose: () => void
}) {
  const { data, isLoading, isError, error, refetch } = useStudioAsset(publicId)
  const { data: channels = [] } = useChannels()
  const queryClient = useQueryClient()
  const toast = useToast()

  const asset = data?.asset
  const titleRef = useRef<HTMLInputElement>(null)
  const previouslyFocused = useRef<HTMLElement | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [channelSlug, setChannelSlug] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [generatingThumb, setGeneratingThumb] = useState(false)
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')
  const [publishing, setPublishing] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [scheduleInput, setScheduleInput] = useState('')
  const [generating, setGenerating] = useState(false)
  const [analytics, setAnalytics] = useState<{
    views: number | null
    watch_time_minutes: number | null
    avg_view_duration_seconds: number | null
    analytics_fetched_at: string | null
    available: boolean
    reason: string | null
  } | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)

  const publication = data?.publications?.[0]

  // A <video> cannot send the bearer header, so ask the server for a short-lived signed URL.
  useEffect(() => {
    let cancelled = false
    setPreviewUrl(null)
    setThumbnailUrl(null)
    studioApi
      .previewUrl(publicId)
      .then((res) => {
        if (cancelled || !res?.url) return
        const base = (apiClient.defaults.baseURL || '').replace(/\/$/, '')
        setPreviewUrl(`${base}${res.url}`)
        if (res?.thumbnail_url) setThumbnailUrl(`${base}${res.thumbnail_url}`)
      })
      .catch(() => {
        // Preview is a convenience; the facts grid below carries the same information.
      })
    return () => {
      cancelled = true
    }
  }, [publicId])

  // While a publish runs, the publication row is the source of truth: poll it, do not guess.
  useEffect(() => {
    if (publication?.status !== 'publishing') return
    const timer = window.setInterval(() => void refetch(), 3000)
    return () => window.clearInterval(timer)
  }, [publication?.status, refetch])

  // Reset the form when a different asset opens, or the server value changes after a save.
  useEffect(() => {
    if (!asset) return
    setTitle(asset.title ?? '')
    setDescription(asset.description ?? '')
    setTags((asset.tags ?? []).join(', '))
    setChannelSlug(asset.channel_slug ?? '')
    setConfirmDiscard(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?.public_id, asset?.updated_at])

  // Sync the schedule field with the server's scheduled publication (if any): pre-fill the input
  // so the creator can edit or clear a scheduled time, and clear it when nothing is scheduled.
  useEffect(() => {
    if (publication?.status === 'scheduled' && publication?.scheduled_at) {
      setScheduleInput(publication.scheduled_at)
    } else if (publication?.status !== 'scheduled') {
      setScheduleInput('')
    }
  }, [publication?.status, publication?.scheduled_at])

  // Fetch YouTube Analytics for a published publication: views, watch time, average view duration.
  // Refetch only when the publication row changes (published → new external_id, or analytics cached).
  useEffect(() => {
    if (!publication || publication.status !== 'published' || !publication.external_id) {
      setAnalytics(null)
      return
    }
    // Don't refetch if we already have fresh cached data.
    if (
      analytics &&
      analytics.available &&
      publication.analytics_fetched_at &&
      analytics.analytics_fetched_at === publication.analytics_fetched_at
    ) {
      return
    }
    setAnalyticsLoading(true)
    studioApi
      .publicationAnalytics(publication.id)
      .then((data) => {
        setAnalytics(data)
      })
      .catch((err) => {
        setAnalytics({
          available: false,
          reason: apiErrorMessage(err, 'Could not load analytics'),
          views: null,
          watch_time_minutes: null,
          avg_view_duration_seconds: null,
          analytics_fetched_at: null,
        })
      })
      .finally(() => setAnalyticsLoading(false))
  }, [publication?.id, publication?.status, publication?.external_id, publication?.analytics_fetched_at, analytics])

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null
    const timer = window.setTimeout(() => titleRef.current?.focus(), 60)
    return () => {
      window.clearTimeout(timer)
      previouslyFocused.current?.focus?.()
    }
  }, [publicId])

  const dirty = useMemo(() => {
    if (!asset) return false
    return (
      title !== (asset.title ?? '') ||
      description !== (asset.description ?? '') ||
      tags !== (asset.tags ?? []).join(', ') ||
      channelSlug !== (asset.channel_slug ?? '')
    )
  }, [asset, title, description, tags, channelSlug])

  const requestClose = () => {
    if (dirty) {
      setConfirmDiscard(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (confirmDiscard) setConfirmDiscard(false)
      else requestClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }) // no dependency array on purpose: close over the current dirty state every render

  const save = async () => {
    if (!asset) return
    setSaving(true)
    try {
      // Send only what changed. A full-object PUT-style update would let a stale drawer overwrite a
      // field someone edited elsewhere (e.g. the channel), and it turns one edit into four writes.
      const payload: {
        title?: string
        description?: string
        tags?: string[]
        channel_slug?: string | null
      } = {}
      if (title !== (asset.title ?? '')) payload.title = title.trim()
      if (description !== (asset.description ?? '')) payload.description = description.trim()
      if (tags !== (asset.tags ?? []).join(', ')) {
        payload.tags = tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 30)
      }
      if (channelSlug !== (asset.channel_slug ?? '')) payload.channel_slug = channelSlug || null

      const updated = await studioApi.updateAsset(asset.public_id, payload)
      // The PATCH response is authoritative for this asset: put it in the cache instead of relying
      // on a refetch, so the form cannot flip back to "unsaved" if the list query wins the race.
      if (updated?.asset) {
        queryClient.setQueryData(
          ['studio-asset', asset.public_id],
          (prev: { ok: boolean; asset: unknown; publications: unknown[] } | undefined) =>
            prev ? { ...prev, asset: updated.asset } : prev,
        )
      }
      await queryClient.invalidateQueries({ queryKey: ['studio-assets'] })
      toast.success('Video saved')
      setConfirmDiscard(false)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not save those changes'))
    } finally {
      setSaving(false)
    }
  }

  const discard = () => {
    if (!asset) return
    setTitle(asset.title ?? '')
    setDescription(asset.description ?? '')
    setTags((asset.tags ?? []).join(', '))
    setChannelSlug(asset.channel_slug ?? '')
    setConfirmDiscard(false)
  }

  // ── Enhance: regenerate description + tags with AI ─────────────────────────
  const regenerateMetadata = async () => {
    if (!title.trim()) {
      toast.error('Add a title first — AI generates from it')
      return
    }
    setGenerating(true)
    try {
      const result = await studioApi.generateMetadata(title.trim(), channelSlug || undefined)
      if (result?.ok) {
        if (result.description) setDescription(result.description)
        if (result.tags?.length) setTags(result.tags.slice(0, 30).join(', '))
        toast.success('Description and tags regenerated')
      } else {
        toast.error(result?.error || 'Could not generate metadata')
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not generate metadata'))
    } finally {
      setGenerating(false)
    }
  }

  // ── Thumbnail: the cover image YouTube shows ───────────────────────────────
  const generateThumbnail = async () => {
    if (!asset) return
    setGeneratingThumb(true)
    try {
      const res = await studioApi.generateThumbnail(asset.public_id)
      if (res?.asset) {
        queryClient.setQueryData(
          ['studio-asset', asset.public_id],
          (prev: { ok: boolean; asset: unknown; publications: unknown[] } | undefined) =>
            prev ? { ...prev, asset: res.asset } : prev,
        )
      }
      const preview = await studioApi.previewUrl(asset.public_id)
      const base = (apiClient.defaults.baseURL || '').replace(/\/$/, '')
      if (preview?.thumbnail_url) setThumbnailUrl(`${base}${preview.thumbnail_url}`)
      toast.success('Thumbnail generated')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not generate a thumbnail'))
    } finally {
      setGeneratingThumb(false)
    }
  }

  // ── Publish ────────────────────────────────────────────────────────────────
  // The blockers are computed before the click, never after: a disabled button with the reason
  // next to it beats a request that fails on the server (plan §15.4).
  const published = publication?.status === 'published'
  const inFlight = publication?.status === 'publishing'
  const isScheduled = publication?.status === 'scheduled'
  const publishBlockers: string[] = []
  if (!asset) publishBlockers.push('loading the video')
  else {
    if (!title.trim()) publishBlockers.push('add a title')
    if (!channelSlug) publishBlockers.push('choose a channel')
    if (asset.status === 'archived') publishBlockers.push('this video is archived')
  }
  const canPublish =
    !!asset && publishBlockers.length === 0 && !published && !inFlight && !isScheduled && !publishing && !scheduling

  const publish = async () => {
    if (!asset || !canPublish) return
    const scheduledAt = scheduleInput.trim() || undefined
    if (scheduledAt) {
      setScheduling(true)
      try {
        await studioApi.publishAsset(asset.public_id, {
          channel_slug: channelSlug || undefined,
          title: title.trim() || undefined,
          description: description.trim(),
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 30),
          privacy_status: privacy,
          scheduled_at: scheduledAt,
        })
        toast.success('Scheduled to publish')
        await refetch()
      } catch (err) {
        toast.error(apiErrorMessage(err, 'Could not schedule the publish'))
      } finally {
        setScheduling(false)
      }
      return
    }
    setPublishing(true)
    try {
      // Publish what is on screen, not what was last saved: the drawer is allowed to publish
      // unsaved edits, and the backend takes them as per-publication overrides.
      await studioApi.publishAsset(asset.public_id, {
        channel_slug: channelSlug || undefined,
        title: title.trim() || undefined,
        description: description.trim(),
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 30),
        privacy_status: privacy,
      })
      toast.success('Publishing to YouTube…')
      await refetch()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not start the publish'))
    } finally {
      setPublishing(false)
    }
  }


  const fieldClass =
    'w-full rounded-md border border-[#E5E5E5] px-3 py-2 text-[13px] text-[#0A0A0A] outline-none transition-colors focus:border-[#5B8CAA]'

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="presentation">
      <div className="absolute inset-0 bg-[#0A0A0A]/20" onClick={requestClose} aria-hidden="true" />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="asset-drawer-title"
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[#E5E5E5] bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E5E5E5] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
              {asset?.kind === 'video' ? 'Video' : 'Asset'}
              {asset?.origin ? ` · ${asset.origin}` : ''}
            </p>
            <h2 id="asset-drawer-title" className="truncate text-[16px] font-semibold text-[#0A0A0A]">
              {asset?.title || 'Untitled video'}
            </h2>
            {asset && (
              <div className="mt-1.5 flex items-center gap-2">
                <StatusChip status={asset.status} />
                <span className="text-[11px] text-[#A3A3A3]">
                  Added {relativeTime(asset.created_at)}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={requestClose}
            className="rounded p-1.5 text-[#A3A3A3] transition-colors hover:bg-[#F5F5F5] hover:text-[#0A0A0A]"
            aria-label="Close"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <div className="flex items-center gap-2 py-10 text-[13px] text-[#A3A3A3]">
              <Loader2 size={14} className="animate-spin" strokeWidth={1.5} />
              Loading video…
            </div>
          )}

          {isError && (
            <div className="flex items-start gap-2 rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2.5 text-[12px] text-[#BE123C]">
              <AlertCircle size={14} strokeWidth={1.8} className="mt-0.5 flex-shrink-0" />
              <span>{apiErrorMessage(error, 'This video could not be loaded.')}</span>
            </div>
          )}

          {asset && (
            <div className="space-y-5">
              {previewUrl ? (
                <video
                  src={previewUrl}
                  controls
                  preload="metadata"
                  className="aspect-video w-full rounded-md border border-[#E5E5E5] bg-black"
                />
              ) : null}

              {/* Facts: always shown, and the fallback when the preview cannot be minted. */}
              <div className="grid grid-cols-2 gap-2 rounded-md border border-[#E5E5E5] bg-[#FAFAFA] px-3 py-2.5">
                {[
                  ['Duration', formatDuration(asset.duration_s)],
                  ['Size', formatBytes(asset.source_bytes)],
                  ['Resolution', asset.width && asset.height ? `${asset.width}×${asset.height}` : '—'],
                  ['Format', (asset.mime || 'video').replace('video/', '').toUpperCase()],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wide text-[#A3A3A3]">{label}</p>
                    <p className="text-[12px] text-[#0A0A0A]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Thumbnail: the cover image YouTube shows. Generate a frame; regenerate to re-pick. */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                    Thumbnail
                  </label>
                  <button
                    type="button"
                    onClick={generateThumbnail}
                    disabled={generatingThumb}
                    title="Generate the cover image from a frame of the video"
                    className="flex items-center gap-1 rounded-md border border-[#E5E5E5] px-2 py-0.5 text-[10px] font-medium text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {generatingThumb ? (
                      <Loader2 size={11} className="animate-spin" strokeWidth={2} />
                    ) : (
                      <ImageIcon size={11} strokeWidth={1.8} />
                    )}
                    {thumbnailUrl ? 'Regenerate' : 'Generate'}
                  </button>
                </div>
                {thumbnailUrl ? (
                  <img
                    src={thumbnailUrl}
                    alt="Thumbnail"
                    className="aspect-video w-full rounded-md border border-[#E5E5E5] bg-black object-cover"
                  />
                ) : (
                  <div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed border-[#E5E5E5] bg-[#FAFAFA] text-[12px] text-[#A3A3A3]">
                    No thumbnail yet
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="asset-title" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                  Title
                </label>
                <input
                  id="asset-title"
                  ref={titleRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                  className={fieldClass}
                  placeholder="Video title"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="asset-description" className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                    Description
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#A3A3A3]">{description.length}/5000</span>
                    <button
                      type="button"
                      onClick={regenerateMetadata}
                      disabled={generating}
                      title="Regenerate description and tags with AI from the title"
                      className="flex items-center gap-1 rounded-md border border-[#E5E5E5] px-2 py-0.5 text-[10px] font-medium text-[#0A0A0A] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {generating ? (
                        <Loader2 size={11} className="animate-spin" strokeWidth={2} />
                      ) : (
                        <Sparkles size={11} strokeWidth={1.8} />
                      )}
                      Regenerate with AI
                    </button>
                  </div>
                </div>
                <textarea
                  id="asset-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={5000}
                  rows={5}
                  className={`${fieldClass} resize-y`}
                  placeholder="What is this video about?"
                />
              </div>


              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="asset-tags" className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                    Tags
                  </label>
                  <span className="text-[10px] text-[#A3A3A3]">
                    {tags.split(',').filter((t) => t.trim()).length}/30
                  </span>
                </div>
                <input
                  id="asset-tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className={fieldClass}
                  placeholder="comma separated, e.g. antarctica, lakes, science"
                />
              </div>

              <div>
                <label htmlFor="asset-channel" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                  Channel
                </label>
                <select
                  id="asset-channel"
                  value={channelSlug}
                  onChange={(e) => setChannelSlug(e.target.value)}
                  className={`${fieldClass} bg-white`}
                >
                  <option value="">Not chosen yet</option>
                  {(channels as Array<{ slug: string; name?: string }>).map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name || c.slug}
                    </option>
                  ))}
                </select>
              </div>

              {/* Publish. The status shown here is the publication row, never a local guess. */}
              <div className="rounded-md border border-[#E5E5E5] px-3 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3]">
                    Publish
                  </p>
                  {publication && (
                    <span className="text-[10px] text-[#A3A3A3]">
                      attempt {(publication.attempt_count ?? 0) + 1}
                    </span>
                  )}
                </div>

                {published && publication?.external_id ? (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-[12px] text-[#16A34A]">
                        <CheckCircle2 size={13} strokeWidth={1.8} />
                        Live on YouTube
                      </span>
                      <a
                        href={`https://youtu.be/${publication.external_id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-[12px] font-medium text-[#0A0A0A] underline-offset-2 hover:underline"
                      >
                        Watch <ExternalLink size={11} strokeWidth={1.8} />
                      </a>
                    </div>
                    {analyticsLoading ? (
                      <p className="text-[11px] text-[#A3A3A3]">Loading stats…</p>
                    ) : analytics?.available ? (
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div className="flex items-center gap-1 text-[#0A0A0A]">
                          <span className="text-[#A3A3A3]">Views</span>
                          <span>{analytics.views?.toLocaleString() ?? '—'}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[#0A0A0A]">
                          <span className="text-[#A3A3A3]">Watch time</span>
                          <span>
                            {analytics.watch_time_minutes != null
                              ? `${analytics.watch_time_minutes} min`
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[#0A0A0A]">
                          <span className="text-[#A3A3A3]">Avg. view duration</span>
                          <span>
                            {analytics.avg_view_duration_seconds != null
                              ? `${Math.round(analytics.avg_view_duration_seconds / 60)} min`
                              : '—'}
                          </span>
                        </div>
                        {analytics.analytics_fetched_at && (
                          <div className="col-span-2 flex justify-end">
                            <span className="text-[10px] text-[#A3A3A3]">
                              Updated {relativeTime(analytics.analytics_fetched_at)}
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-[#A3A3A3]">
                        <span>Not available yet</span>
                        {analytics?.reason && (
                          <span>— {analytics.reason}</span>
                        )}
                      </div>
                    )}
                  </div>
                ) : inFlight ? (
                  <p className="mt-2 flex items-center gap-2 text-[12px] text-[#B45309]">
                    <Loader2 size={13} className="animate-spin" strokeWidth={1.8} />
                    Uploading to YouTube… this can take a minute.
                  </p>
                ) : publication?.status === 'failed' ? (
                  <div className="mt-2 space-y-1">
                    <p className="flex items-start gap-1.5 text-[12px] text-[#BE123C]">
                      <AlertCircle size={13} strokeWidth={1.8} className="mt-0.5 flex-shrink-0" />
                      <span>{publication.last_error || 'The upload failed.'}</span>
                    </p>
                    <p className="text-[11px] text-[#A3A3A3]">
                      Your video is safe here. Retry upload only re-sends it — nothing is re-rendered.
                    </p>
                  </div>
                ) : isScheduled ? (
                  <div className="mt-2 flex items-center gap-2 text-[12px] text-[#5B8CAA]">
                    <Clock size={13} strokeWidth={1.8} />
                    <span>
                      Scheduled to publish{' '}
                      {new Date(publication.scheduled_at!).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label htmlFor="asset-privacy" className="text-[12px] text-[#525252]">
                        Visibility
                      </label>
                      <select
                        id="asset-privacy"
                        value={privacy}
                        onChange={(e) => setPrivacy(e.target.value as typeof privacy)}
                        className="rounded-md border border-[#E5E5E5] bg-white px-2 py-1 text-[12px] text-[#0A0A0A] outline-none focus:border-[#5B8CAA]"
                      >
                        <option value="public">Public</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="private">Private</option>
                      </select>
                    </div>

                    <div>
                      <label htmlFor="asset-schedule" className="block text-[11px] font-medium uppercase tracking-wide text-[#A3A3A3] mb-1">
                        Publish at
                      </label>
                      <input
                        id="asset-schedule"
                        type="datetime-local"
                        value={scheduleInput}
                        onChange={(e) => setScheduleInput(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  </div>
                )}

                {publishBlockers.length > 0 && !published && !inFlight && (
                  <p className="mt-2 text-[11px] text-[#B45309]">
                    To publish: {publishBlockers.join(', ')}.
                  </p>
                )}
              </div>

              {asset.error && (
                <p className="rounded-md border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2 text-[12px] text-[#BE123C]">
                  {asset.error}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#E5E5E5] px-5 py-3">
          {confirmDiscard ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] text-[#525252]">You have unsaved changes.</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={discard}
                  className="rounded-md border border-[#E5E5E5] px-3 py-1.5 text-[12px] text-[#525252] transition-colors hover:bg-[#F5F5F5]"
                >
                  Discard
                </button>
                <button
                  onClick={onClose}
                  className="rounded-md bg-[#0A0A0A] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#262626]"
                >
                  Close anyway
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-[#A3A3A3]">
                {published
                  ? 'Published — details stay editable'
                  : dirty
                    ? 'Unsaved changes'
                    : 'Details are up to date'}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={save}
                  disabled={!dirty || saving || !asset}
                  className="rounded-md border border-[#E5E5E5] px-3 py-2 text-[12px] text-[#525252] transition-colors hover:bg-[#F5F5F5] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                {published && publication?.external_id ? (
                  <a
                    href={`https://youtu.be/${publication.external_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-md bg-[#0A0A0A] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#262626]"
                  >
                    View on YouTube
                    <ExternalLink size={12} strokeWidth={1.8} />
                  </a>
                ) : (
                  <button
                    onClick={publish}
                    disabled={!canPublish}
                    title={
                      publishBlockers.length
                        ? `To publish: ${publishBlockers.join(', ')}`
                        : 'Publish this video to YouTube'
                    }
                    className="flex items-center gap-2 rounded-md bg-[#0A0A0A] px-4 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#262626] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {publishing || inFlight || scheduling ? (
                      <Loader2 size={12} className="animate-spin" strokeWidth={2} />
                    ) : (
                      <UploadCloud size={12} strokeWidth={1.8} />
                    )}
                    {publishing || inFlight
                      ? 'Publishing…'
                      : scheduling
                        ? 'Scheduling…'
                        : publication?.status === 'failed'
                          ? 'Retry upload'
                          : scheduleInput.trim()
                            ? 'Schedule'
                            : 'Publish now'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

