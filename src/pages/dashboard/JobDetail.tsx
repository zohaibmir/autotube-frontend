import React, { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, CheckCircle, Circle, Loader, XCircle,
  RotateCcw, X, ExternalLink, AlertCircle, Clock,
  Copy, Check, FastForward, Timer, UploadCloud,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useJob, useJobAction, useChannels } from '@hooks/useJobs'
import { jobsApi } from '@api/services'
import { useToast } from '@components/Toast'

// ── Pipeline stages - keyed to job.current_step values ───────────────────────
const STAGES = [
  { key: 'script',  label: 'Script Generation', keys: ['script', 'content', 'prompt'] },
  { key: 'audio',   label: 'Audio & Voiceover',  keys: ['audio', 'voice', 'tts', 'music'] },
  { key: 'visuals', label: 'Visuals Assembly',   keys: ['visual', 'pexels', 'image', 'b-roll'] },
  { key: 'render',  label: 'Final Render',       keys: ['render', 'ffmpeg', 'encode', 'compose', 'building video', 'thumbnail'] },
  { key: 'upload',  label: 'YouTube Upload',     keys: ['upload', 'youtube', 'publish'] },
]

function matchStage(currentStep: string | undefined): number {
  if (!currentStep) return -1
  const step = currentStep.toLowerCase()
  return STAGES.findIndex((s) => s.keys.some((k) => step.includes(k)))
}

// ── Stage icon - Nordic tokens only ─────────────────────────────────────────
type StageState = 'done' | 'active' | 'error' | 'pending'

function StageIcon({ state }: { state: StageState }) {
  if (state === 'done')    return <CheckCircle size={18} strokeWidth={1.5} className="text-[#16A34A]" />
  if (state === 'active')  return <Loader      size={18} strokeWidth={1.5} className="text-[#0A0A0A] animate-spin" />
  if (state === 'error')   return <XCircle     size={18} strokeWidth={1.5} className="text-[#BE123C]" />
  return <Circle size={18} strokeWidth={1.5} className="text-[#E5E5E5]" />
}

// ── Duration / ETA helpers ────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  if (seconds < 60)  return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${h}h ${m}m`
}

function computeDuration(job: any): string | null {
  if (job.duration_seconds) return formatDuration(job.duration_seconds)
  if (job.start_time && job.end_time) {
    const diff = (new Date(job.end_time).getTime() - new Date(job.start_time).getTime()) / 1000
    return formatDuration(Math.round(diff))
  }
  if (job.status === 'running' && job.start_time) {
    const elapsed = (Date.now() - new Date(job.start_time).getTime()) / 1000
    return formatDuration(Math.round(elapsed)) + ' elapsed'
  }
  return null
}

// ── Error insight - maps known error patterns to friendly guidance ─────────────
function errorInsight(errorMsg: string): string {
  const msg = (errorMsg || '').toLowerCase()
  if (msg.includes('api key') || msg.includes('anthropic') || msg.includes('401') || msg.includes('invalid key'))
    return 'Your Anthropic API key may be missing or invalid. Check Settings → API Keys.'
  if (msg.includes('quota') || msg.includes('rate limit') || msg.includes('429'))
    return 'API rate limit hit. Wait a few minutes and retry.'
  if (msg.includes('upload') || msg.includes('youtube') || msg.includes('oauth') || msg.includes('token'))
    return 'YouTube auth may need refreshing. Go to Channels and reset auth.'
  if (msg.includes('ffmpeg') || msg.includes('render') || msg.includes('encode'))
    return 'Render failed - usually a disk space or corrupt clip issue. Retry or check server logs.'
  if (msg.includes('pexels') || msg.includes('visual') || msg.includes('download'))
    return 'Failed fetching video clips. Check your Pexels API key or network connectivity.'
  return 'Review the error below and retry. If it persists, check the server logs.'
}

const statusConfig: Record<string, { label: string; pill: string; icon: React.ReactNode }> = {
  running:     { label: 'Running',     pill: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',  icon: <Loader size={12} strokeWidth={1.5} className="animate-spin" /> },
  ready:       { label: 'Ready for review', pill: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]', icon: <UploadCloud size={12} strokeWidth={1.5} /> },
  uploading:   { label: 'Uploading',   pill: 'bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]',  icon: <Loader size={12} strokeWidth={1.5} className="animate-spin" /> },
  done:        { label: 'Done',        pill: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]', icon: <CheckCircle size={12} strokeWidth={1.5} /> },
  error:       { label: 'Error',       pill: 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]', icon: <XCircle size={12} strokeWidth={1.5} /> },
  interrupted: { label: 'Interrupted', pill: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]', icon: <AlertCircle size={12} strokeWidth={1.5} /> },
  queued:      { label: 'Queued',      pill: 'bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]', icon: <Clock size={12} strokeWidth={1.5} /> },
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function JobDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const { job, isLoading } = useJob(jobId)
  const { mutate: runAction, isPending: acting } = useJobAction()
  const [copied, setCopied] = useState(false)
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: channels = [] } = useChannels()
  const [uploadChannel, setUploadChannel] = useState('')
  const [uploadPrivacy, setUploadPrivacy] = useState<'public' | 'unlisted' | 'private'>('public')

  const uploadMutation = useMutation({
    mutationFn: () => jobsApi.upload({ channel_slug: uploadChannel || undefined, privacy_status: uploadPrivacy, job_id: jobId }),
    onSuccess: () => {
      toast.success('Uploaded to YouTube!')
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline', 'status'] })
    },
    onError: (err: any) => {
      // Surface the real backend reason (e.g. "No video ready (status: done)"
      // when this job is no longer the server's active in-memory pipeline run)
      // instead of a generic message that hides why it failed.
      const detail = err?.response?.data?.detail
      toast.error(typeof detail === 'string' ? detail : 'Upload failed - check the server logs')
    },
  })

  const currentStep = job?.current_step || job?.stage || ''
  // The live overlay (/api/pipeline/status) has no current_step/progress fields —
  // only a free-text `message` (e.g. "Building video…", "Generating audio…").
  // The job-list entry's current_step also isn't updated in real time during a run
  // (stays "initialization" the whole time). Prefer the live message for anything
  // shown to the user while running, and use it as a fallback for stage matching
  // so the tracker actually advances instead of staying stuck on step 1.
  const displayStep = (job?.status === 'running' && job?.message) ? job.message : currentStep
  const activeIdx = job?.status === 'done'
    // A "done" job has all pipeline work complete. But YouTube Upload (the last
    // stage) should only be marked ✅ if there is actually a youtube_id - it's
    // legitimately skipped when the job ran without a channel_slug.
    // STAGES.length   → marks every stage (including upload) complete
    // STAGES.length-1 → marks only stages 0-3 complete, upload stays pending
    ? (job?.youtube_id ? STAGES.length : STAGES.length - 1)
    : (() => {
        const fromStep = matchStage(currentStep)
        if (fromStep >= 0) return fromStep
        return matchStage(job?.message)
      })()

  const sc = statusConfig[job?.status] || statusConfig.queued
  const topicLabel = job?.topic?.replace(/^\[Short\]\s*/i, '') || job?.job_id || '—'
  const isLive = job?.status === 'running'
  const ytUrl = job?.youtube_id ? `https://youtube.com/watch?v=${job.youtube_id}` : null
  const duration = job ? computeDuration(job) : null

  // ETA label for running jobs
  let etaLabel: string | null = null
  if (job?.status === 'running') {
    if (job.eta_seconds != null) etaLabel = `~${formatDuration(job.eta_seconds)} remaining`
    else if (job.eta_minutes != null) etaLabel = `~${job.eta_minutes}m remaining`
  }

  const copyError = () => {
    navigator.clipboard.writeText(job?.error ?? '')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  useEffect(() => {
    if (job?.channel_slug && !uploadChannel) setUploadChannel(job.channel_slug)
  }, [job?.channel_slug, uploadChannel])

  // Show the manual upload panel whenever there's a built video with no
  // youtube_id yet - either explicitly "ready for review", or a "done" job
  // that completed without uploading (e.g. no channel was assigned at run
  // time, or the upload step failed/was skipped for some other reason).
  // A channel being assigned now (job.channel_slug, or one picked here) is
  // enough to upload - we don't gate the option on why it didn't happen.
  const readyToUpload = job?.status === 'ready' || (job?.status === 'done' && !job?.youtube_id)

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      <div className="px-8 pt-8 pb-2">
      <Link to="/app/jobs" className="inline-flex items-center gap-1.5 text-sm text-[#A3A3A3] hover:text-[#0A0A0A] mb-6 transition-colors">
        <ArrowLeft size={13} strokeWidth={1.5} /> Back to Jobs
      </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-28">
          <Loader size={20} strokeWidth={1.5} className="text-[#D4D4D4] animate-spin" />
        </div>
      ) : !job ? (
        <div className="mx-8 bg-white border border-[#E5E5E5] rounded-md p-16 text-center">
          <XCircle size={32} strokeWidth={1.5} className="text-[#D4D4D4] mx-auto mb-4" />
          <p className="font-semibold text-[#0A0A0A] mb-1">Job not found</p>
          <p className="text-[#A3A3A3] text-sm mb-6">
            Job <code className="font-mono text-xs bg-[#F5F5F5] px-1.5 py-0.5 rounded">{jobId}</code> does not exist or you don't have access.
          </p>
          <Link to="/app/jobs" className="bg-[#0A0A0A] text-white px-6 py-2 rounded-md text-sm font-medium">
            Back to Jobs
          </Link>
        </div>
      ) : (
        <div className="px-8 pb-12 grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: Pipeline progress */}
          <div className="lg:col-span-2 space-y-5">
            {/* Topic + status header */}
            <div className="bg-white border border-[#E5E5E5] rounded-md px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-widest mb-1">
                    {/\[short\]/i.test(job.topic || '') ? 'Short' : 'Long-form'}
                  </p>
                  <h2 className="text-lg font-semibold text-[#0A0A0A] leading-snug truncate" title={topicLabel}>
                    {topicLabel}
                  </h2>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {isLive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold tracking-widest uppercase text-[#2563EB]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#2563EB] animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.pill}`}>
                    {sc.icon} {sc.label}
                  </span>
                </div>
              </div>
              {job.status === 'running' && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-[#A3A3A3] mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Timer size={11} strokeWidth={1.5} />
                      {displayStep || 'Processing…'}
                    </span>
                    <div className="flex items-center gap-3">
                      {etaLabel && <span className="text-[#525252]">{etaLabel}</span>}
                      {!!job.progress && (
                        <span className="tabular-nums font-medium text-[#0A0A0A]">{job.progress}%</span>
                      )}
                    </div>
                  </div>
                  {job.progress ? (
                    <div className="h-1 bg-[#F5F5F5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0A0A0A] rounded-full transition-all duration-500"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  ) : (
                    // No numeric progress is reported by the backend for a running
                    // job (see comment above `displayStep`) - show an indeterminate
                    // pulsing bar instead of a misleading static "0%" fill.
                    <div className="h-1 bg-[#F5F5F5] rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-[#0A0A0A] rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Stage timeline */}
            <div className="bg-white border border-[#E5E5E5] rounded-md p-6">
              <h3 className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-5">Pipeline Stages</h3>
              <div className="space-y-0">
                {STAGES.map((stage, idx) => {
                  let state: StageState = 'pending'
                  if (job.status === 'done') {
                    // Upload stage is only "done" when a youtube_id is recorded;
                    // without one the pipeline completed but the upload hasn't
                    // happened yet (channel may or may not be assigned - see
                    // the sub-label below, which reflects the real reason).
                    if (idx < STAGES.length - 1) {
                      state = 'done'
                    } else {
                      state = job.youtube_id ? 'done' : 'pending'
                    }
                  } else if (idx < activeIdx) {
                    state = 'done'
                  } else if (idx === activeIdx) {
                    state = job.status === 'error' || job.status === 'interrupted' ? 'error' : 'active'
                  }

                  const isLast = idx === STAGES.length - 1
                  // Human-readable sub-label for the upload stage when not yet
                  // uploaded - only claim "no channel assigned" when that's
                  // actually true; otherwise point at the upload panel below.
                  const uploadSkipped = stage.key === 'upload' && job.status === 'done' && !job.youtube_id

                  return (
                    <div key={stage.key} className="flex gap-4">
                      {/* Icon + connector */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <StageIcon state={state} />
                        {!isLast && (
                          <div className={`w-px flex-grow mt-1 mb-1 ${
                            state === 'done' ? 'bg-[#BBF7D0]' : 'bg-[#F5F5F5]'
                          }`} style={{ minHeight: '20px' }} />
                        )}
                      </div>
                      {/* Label + active step text */}
                      <div className={`pb-5 ${isLast ? 'pb-0' : ''}`}>
                        <p className={`text-sm font-medium leading-5 ${
                          state === 'pending' ? 'text-[#D4D4D4]' : 'text-[#0A0A0A]'
                        }`}>
                          {stage.label}
                        </p>
                        {state === 'active' && (
                          <p className="text-xs text-[#525252] mt-0.5">
                            {displayStep || 'In progress…'}
                          </p>
                        )}
                        {state === 'done' && (
                          <p className="text-xs text-[#A3A3A3] mt-0.5">Complete</p>
                        )}
                        {uploadSkipped && (
                          <p className="text-xs text-[#B45309] mt-0.5">
                            {job.channel_slug
                              ? 'Not uploaded yet - publish it below'
                              : 'Skipped - no channel assigned. Pick one below to publish.'}
                          </p>
                        )}
                        {state === 'error' && (
                          <p className="text-xs text-[#BE123C] mt-0.5">{job.error || 'Failed at this stage'}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Error detail card - shown when job errored or was interrupted */}
            {(job.status === 'error' || job.status === 'interrupted') && job.error && (
              <div className="bg-white border border-[#FECDD3] rounded-md p-5">
                <div className="flex items-start gap-3 mb-3">
                  <AlertCircle size={16} strokeWidth={1.5} className="text-[#BE123C] flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#BE123C] mb-0.5">Pipeline stopped</p>
                    <p className="text-[12px] text-[#525252]">{errorInsight(job.error)}</p>
                  </div>
                </div>
                <div className="relative">
                  <pre className="text-[11px] text-[#525252] bg-[#FFF1F2] border border-[#FECDD3] rounded p-3 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-32">
                    {job.error}
                  </pre>
                  <button
                    onClick={copyError}
                    className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium text-[#A3A3A3] hover:text-[#0A0A0A] bg-white border border-[#E5E5E5] px-1.5 py-0.5 rounded transition-colors"
                  >
                    {copied
                      ? <><Check size={9} strokeWidth={2} /> Copied</>
                      : <><Copy size={9} strokeWidth={1.5} /> Copy</>
                    }
                  </button>
                </div>
              </div>
            )}

            {/* Upload to YouTube - shown once the video is built and awaiting review/publish */}
            {readyToUpload && (
              <div className="bg-white border border-[#FDE68A] rounded-md p-5">
                <div className="flex items-start gap-3 mb-4">
                  <UploadCloud size={16} strokeWidth={1.5} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[13px] font-semibold text-[#0A0A0A] mb-0.5">
                      {job.status === 'done' ? 'Video not yet uploaded' : 'Video ready for review'}
                    </p>
                    <p className="text-[12px] text-[#525252]">Pick a channel and privacy setting, then publish to YouTube.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Channel</label>
                    <select
                      value={uploadChannel}
                      onChange={(e) => setUploadChannel(e.target.value)}
                      className="w-full h-8 px-2 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                    >
                      <option value="">Default channel</option>
                      {(channels as any[]).map((ch) => (
                        <option key={ch.slug} value={ch.slug}>{ch.name ?? ch.slug}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Privacy</label>
                    <select
                      value={uploadPrivacy}
                      onChange={(e) => setUploadPrivacy(e.target.value as any)}
                      className="w-full h-8 px-2 text-[12px] bg-[#FAFAFA] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                </div>
                <button
                  onClick={() => uploadMutation.mutate()}
                  disabled={uploadMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#0A0A0A] text-white hover:bg-[#262626] text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {uploadMutation.isPending
                    ? <><Loader size={13} strokeWidth={1.5} className="animate-spin" /> Uploading…</>
                    : <><UploadCloud size={13} strokeWidth={1.5} /> Upload to YouTube</>
                  }
                </button>
              </div>
            )}

            {/* Output */}
            {ytUrl && (
              <div className="bg-white border border-[#E5E5E5] rounded-md px-6 py-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-[#A3A3A3] font-medium uppercase tracking-widest mb-0.5">Output</p>
                  <p className="text-sm font-semibold text-[#0A0A0A]">Video published to YouTube</p>
                </div>
                <a
                  href={ytUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-[#FF0000] hover:bg-[#CC0000] text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                >
                  Watch <ExternalLink size={12} strokeWidth={1.5} />
                </a>
              </div>
            )}
          </div>

          {/* Right sidebar: Details + Actions */}
          <div className="space-y-5">
            <div className="bg-white border border-[#E5E5E5] rounded-md p-5">
              <h3 className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-4">Details</h3>
              <dl className="space-y-3">
                {[
                  { label: 'Job ID',   value: job.job_id },
                  { label: 'Channel',  value: job.channel_slug || '—' },
                  { label: 'Progress', value: `${job.progress || 0}%` },
                  { label: 'Started',  value: job.start_time ? new Date(job.start_time).toLocaleString() : '—' },
                  { label: 'Ended',    value: job.end_time ? new Date(job.end_time).toLocaleString() : '—' },
                  ...(duration ? [{ label: 'Duration', value: duration }] : []),
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2 text-sm">
                    <dt className="text-[#A3A3A3] flex-shrink-0">{label}</dt>
                    <dd className="text-[#0A0A0A] font-medium text-right truncate max-w-[150px]" title={String(value)}>
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* Actions */}
            {(job.status === 'error' || job.status === 'interrupted' || job.status === 'running') && (
              <div className="bg-white border border-[#E5E5E5] rounded-md p-5 space-y-2">
                <h3 className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-3">Actions</h3>
                {(job.status === 'error' || job.status === 'interrupted') && (
                  <>
                    {job.status === 'interrupted' && (
                      <button
                        disabled={acting}
                        onClick={() => runAction({ jobId: job.job_id, action: 'resume-from-merge' })}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-[#0A0A0A] text-white hover:bg-[#262626] text-sm font-medium transition-colors disabled:opacity-50"
                      >
                        <FastForward size={13} strokeWidth={1.5} /> Resume from checkpoint
                      </button>
                    )}
                    <button
                      disabled={acting}
                      onClick={() => runAction({ jobId: job.job_id, action: 'retry' })}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#F5F5F5] text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      <RotateCcw size={13} strokeWidth={1.5} /> Retry from start
                    </button>
                  </>
                )}
                {job.status === 'running' && (
                  <button
                    disabled={acting}
                    onClick={() => runAction({ jobId: job.job_id, action: 'cancel' })}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border border-[#FECDD3] text-[#BE123C] hover:bg-[#FFF1F2] text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <X size={13} strokeWidth={1.5} /> Cancel Job
                  </button>
                )}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
