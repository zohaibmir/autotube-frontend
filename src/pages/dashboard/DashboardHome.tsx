import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Video, Upload, AlertCircle, Activity, Plus, ArrowRight,
  Clock, CheckCircle, XCircle, Loader, Zap, ChevronRight,
  Sparkles, ListOrdered, PenLine, X, Check, PartyPopper, RefreshCw,
  Search,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useJobs, usePipelineStatus, useChannels } from '@hooks/useJobs'
import { byokApi, analyticsApi } from '@api/services'
import { useAuthStore } from '@store/auth'

// ── Helpers ───────────────────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  running:     'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]',
  done:        'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]',
  error:       'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]',
  interrupted: 'bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]',
  queued:      'bg-[#F5F5F5] text-[#525252] border border-[#E5E5E5]',
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  running:     <Loader     size={11} strokeWidth={1.5} className="animate-spin" />,
  done:        <CheckCircle size={11} strokeWidth={1.5} />,
  error:       <XCircle    size={11} strokeWidth={1.5} />,
  interrupted: <AlertCircle size={11} strokeWidth={1.5} />,
  queued:      <Clock      size={11} strokeWidth={1.5} />,
}

function topicLabel(job: any) {
  return job.topic?.replace(/^\[Short\]\s*/i, '') || job.job_id || '—'
}
// "3h ago" plus a staleness flag. Older than 48h means the dashboard is describing an old week — the exact
// condition the fleet sync exists to prevent, so it renders amber instead of quietly looking fine.
function syncAge(iso: string | null): { label: string; stale: boolean } {
  if (!iso) return { label: 'never', stale: true }
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return { label: 'never', stale: true }
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000))
  const label = mins < 60 ? `${mins}m ago`
    : mins < 1440 ? `${Math.round(mins / 60)}h ago`
      : `${Math.round(mins / 1440)}d ago`
  return { label, stale: mins > 48 * 60 }
}

function isShortJob(job: any) {
  // Matches "[Short] ..." as well as prefixed variants like
  // "Shorts pipeline rerun: [Short] ..." (job.topic gets a rerun prefix
  // prepended, which used to break the anchored ^[short] check below).
  return /\[short\]/i.test(job.topic || '')
}

// ── Onboarding checklist ───────────────────────────────────────────────────────────

type ChecklistStep = {
  id: string
  label: string
  sub: string
  done: boolean
  href: string
}

function OnboardingChecklist({
  steps,
  onDismiss,
}: {
  steps: ChecklistStep[]
  onDismiss: () => void
}) {
  const done  = steps.filter((s) => s.done).length
  const total = steps.length
  const pct   = Math.round((done / total) * 100)

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Get started</h2>
          <span className="text-xs text-[#A3A3A3] tabular-nums">{done}/{total}</span>
          <div className="w-24 h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A0A0A] rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
          aria-label="Dismiss onboarding checklist"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
      <div className="divide-y divide-[#F5F5F5]">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`flex items-center gap-4 px-5 py-3 transition-opacity ${
              step.done ? 'opacity-40' : ''
            }`}
          >
            {/* Circle check */}
            <div
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                step.done
                  ? 'bg-[#0A0A0A] border-[#0A0A0A]'
                  : 'border-[#D4D4D4] bg-white'
              }`}
            >
              {step.done && <Check size={10} strokeWidth={2.5} className="text-white" />}
            </div>

            {/* Labels */}
            <div className="flex-1 min-w-0">
              <p
                className={`text-[13px] font-medium ${
                  step.done ? 'line-through text-[#A3A3A3]' : 'text-[#0A0A0A]'
                }`}
              >
                {step.label}
              </p>
              <p className="text-[11px] text-[#A3A3A3]">{step.sub}</p>
            </div>

            {/* Action link */}
            {!step.done && (
              <Link
                to={step.href}
                className="flex-shrink-0 flex items-center gap-0.5 text-[11px] font-medium text-[#525252] hover:text-[#0A0A0A] transition-colors"
              >
                Go <ChevronRight size={11} strokeWidth={1.5} />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DashboardHome() {
  const user     = useAuthStore((s) => s.user)
  const userId   = user?.id ?? 'anon'
  const queryClient = useQueryClient()

  const { data: allJobs = [], isLoading } = useJobs()
  const { data: pipeline }                = usePipelineStatus()
  const { data: channels = [] }           = useChannels()
  // `keys` = what the account has stored; `readiness` = what will actually work (R4/F1).
  const { data: providerReadiness = {} }  = useQuery({
    queryKey: ['byok-readiness'],
    queryFn: () => byokApi.readiness(),
    staleTime: 120_000,
  })

  // Per-channel sync health. The fleet sync runs server-side; this panel is how a creator finds out it
  // worked, and how an admin notices the one channel whose token expired.
  const { data: fleet, isLoading: fleetLoading } = useQuery({
    queryKey: ['fleet-health'],
    queryFn: () => analyticsApi.fleet(),
    staleTime: 60_000,
  })
  const fleetSync = useMutation({
    mutationFn: () => analyticsApi.syncAll(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fleet-health'] })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin'
  const fleetChannels = fleet?.channels ?? []

  const jobs       = allJobs as any[]
  const isActive   = pipeline?.status === 'running'
  const totalJobs  = jobs.length
  const doneJobs   = jobs.filter((j) => j.status === 'done').length
  const errorJobs  = jobs.filter((j) => j.status === 'error' || j.status === 'interrupted').length
  const runningNow = jobs.filter((j) => j.status === 'running').length

  // ── Onboarding state (localStorage, per user) ──────────────────────────────
  const _ckKey   = `vidora_checklist_dismissed_${userId}`
  const _fvKey   = `vidora_first_video_celebrated_${userId}`

  const [checklistDismissed, setChecklistDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(_ckKey) === '1' } catch { return false }
  })
  const [firstVideoCelebrated, setFirstVideoCelebrated] = useState<boolean>(() => {
    try { return localStorage.getItem(_fvKey) === '1' } catch { return false }
  })

  // Detect first completed video (transition from 0 → ≥1)
  const prevDoneRef = useRef(doneJobs)
  useEffect(() => {
    if (prevDoneRef.current === 0 && doneJobs > 0 && !firstVideoCelebrated) {
      setFirstVideoCelebrated(false) // show banner
    }
    prevDoneRef.current = doneJobs
  }, [doneJobs, firstVideoCelebrated])

  const dismissChecklist = () => {
    setChecklistDismissed(true)
    try { localStorage.setItem(_ckKey, '1') } catch {}
  }

  const dismissFirstVideo = () => {
    setFirstVideoCelebrated(true)
    try { localStorage.setItem(_fvKey, '1') } catch {}
  }

  // ── Checklist steps ───────────────────────────────────────────────────────
  //
  // Two corrections here, both from PRODUCT_IMPROVEMENT_DEEP_ANALYSIS (F1, F2/R4).
  //
  // F1: `hasApiKey` was `Object.values(byokStatus).some(Boolean)` — "is *any* provider key stored". A
  // stored **Pexels** key satisfied a step labelled "Add your Anthropic API key", and a customer whose
  // work the platform funds was told to supply a key they did not need. Readiness asks the question the
  // label asks: can *Anthropic* be used, on the account's key or the platform's?
  //
  // F2: the publish step and the celebration banner were driven by `doneJobs > 0` — a completed *render*
  // — and the banner said "First video published". Nothing in the system records an upload's privacy
  // (public / unlisted / private); the strongest evidence available is a job carrying a `youtube_id`,
  // which means uploaded. So the step and the banner now say "uploaded", and the third rung is not
  // claimed because it cannot be evidenced.
  const hasChannel  = (channels as any[]).length > 0
  const anthropicReadiness = providerReadiness['anthropic']
  const hasApiKey   = anthropicReadiness?.usable === true
  const hasRunJob   = totalJobs > 0
  // A render finished. Not the same as a video being on YouTube.
  const hasCreated  = doneJobs > 0
  // The render reached YouTube. `youtube_id` is written when the upload succeeds.
  const hasUploaded = jobs.some((j: any) => !!j.youtube_id)

  const providerNote = !anthropicReadiness
    ? 'Powers script generation and idea scoring'
    : anthropicReadiness.usable && anthropicReadiness.funding === 'platform'
      ? 'Included with your plan — no key needed'
      : anthropicReadiness.usable
        ? 'Using your own key'
        // The readiness answer now names the *specific* fix (R4 criterion 2): "add your own key" when this
        // deployment cannot provide one, "top up credits" when it can but the balance cannot cover it. The
        // old copy offered both and called it one state.
        : (anthropicReadiness.why || 'Needed for script generation — add one, or top up credits')

  // R4 criterion 1: a bundled-credit user must not be told to add a key. The readiness answer now says *which*
  // of the four situations applies, so this step's wording follows it instead of describing every user's
  // problem at once. Before this, the label read "Give Vidora a way to write scripts" even when the plan
  // already provided one — an unnecessary BYOK instruction for exactly the cohort that needs nothing.
  const anthropicState = anthropicReadiness?.state
  const scriptStep = anthropicState === 'platform'
    ? { label: 'Scripts are included with your plan', sub: 'No key needed — nothing to set up' }
    : anthropicState === 'user_key'
      ? { label: 'Using your own Anthropic key', sub: 'Your key pays for script generation' }
      : anthropicState === 'needs_credits'
        ? { label: 'Top up credits, or add your own key', sub: providerNote }
        : { label: 'Give Vidora a way to write scripts', sub: providerNote }

  const checklistSteps: ChecklistStep[] = [
    {
      id:    'account',
      label: 'Create your account',
      sub:   'Welcome to Vidora',
      done:  true,
      href:  '/app',
    },
    {
      id:    'channel',
      label: 'Connect a YouTube channel',
      sub:   'Required to upload videos automatically',
      done:  hasChannel,
      href:  '/app/channels',
    },
    {
      id:    'apikey',
      // The wording follows the readiness state (R4 criterion 1/2), so a bundled user sees "included" and a
      // short-balance user sees "top up" rather than everyone being told to add a key.
      label: scriptStep.label,
      sub:   scriptStep.sub,
      done:  hasApiKey,
      href:  '/app/settings',
    },
    {
      id:    'job',
      label: 'Start your first pipeline run',
      sub:   'Pick a topic and let Vidora build the video',
      done:  hasRunJob,
      href:  '/app/create/ideas',
    },
    {
      id:    'publish',
      // "Publish" overclaimed: the pipeline uploads, and the upload's privacy is not recorded anywhere,
      // so this step cannot tell a public video from a private one.
      label: 'Upload your first video to YouTube',
      sub:   'Your pipeline uploads it automatically when the render finishes',
      done:  hasUploaded,
      href:  '/app/jobs',
    },
  ]

  const allStepsDone      = checklistSteps.every((s) => s.done)
  const showChecklist     = !checklistDismissed && !allStepsDone
  const showFirstVidBanner = hasCreated && !firstVideoCelebrated

  const stats = [
    { label: 'Total Jobs',  value: String(totalJobs),  sub: `${doneJobs} completed`,  icon: <Video      size={16} strokeWidth={1.5} /> },
    { label: 'Successful',  value: String(doneJobs),   sub: totalJobs > 0 ? `${Math.round((doneJobs / totalJobs) * 100)}% success` : 'No jobs yet', icon: <Upload   size={16} strokeWidth={1.5} /> },
    { label: 'Running Now', value: String(runningNow), sub: isActive ? (pipeline?.stage || 'In pipeline') : 'Pipeline idle', icon: <Activity size={16} strokeWidth={1.5} /> },
    { label: 'Failed',      value: String(errorJobs),  sub: errorJobs > 0 ? 'Need attention' : 'All clear', icon: <AlertCircle size={16} strokeWidth={1.5} /> },
  ]

  const recentJobs = [...jobs]
    .sort((a, b) => {
      const ta = a.start_time ? new Date(a.start_time).getTime() : 0
      const tb = b.start_time ? new Date(b.start_time).getTime() : 0
      return tb - ta
    })
    .slice(0, 5)

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#0A0A0A]">Dashboard</h1>
          <p className="text-sm text-[#A3A3A3] mt-0.5">Overview of your automation workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          {/* R4: the two intents, side by side. "Create" needs a channel and a provider; "Improve" must not
              — a public-video score should be reachable without either, which is why it links to the public
              analyzer rather than to the create wizard. */}
          <Link
            to="/tools/seo-analyzer"
            className="border border-[#E5E5E5] text-[#0A0A0A] hover:bg-[#FAFAFA] px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Search size={14} strokeWidth={1.5} /> Improve a video
          </Link>
          <Link
            to="/app/jobs/new"
            className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
          >
            <Plus size={14} strokeWidth={1.5} /> New Job
          </Link>
        </div>
      </div>

      {/* Onboarding checklist - only shown until dismissed or all complete */}
      {showChecklist && (
        <OnboardingChecklist
          steps={checklistSteps}
          onDismiss={dismissChecklist}
        />
      )}

      {/* First-render banner. The heading used to read "First video published" while being driven by a
          finished render — a video that may not have been uploaded at all. It now says which of the two
          actually happened. */}
      {showFirstVidBanner && (
        <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-md px-5 py-4 flex items-start gap-3">
          <PartyPopper size={18} strokeWidth={1.5} className="text-[#16A34A] flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            {hasUploaded ? (
              <>
                <p className="text-[13px] font-semibold text-[#15803D]">Your first video is on YouTube</p>
                <p className="text-[12px] text-[#166534] mt-0.5">
                  The pipeline rendered it and uploaded it. Keep the queue full to grow your channel
                  consistently - check the Jobs page for the link.
                </p>
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold text-[#15803D]">Your first video is rendered</p>
                <p className="text-[12px] text-[#166534] mt-0.5">
                  It has not been uploaded to YouTube yet. Open the Jobs page to publish it, or check
                  that your channel is still connected.
                </p>
              </>
            )}
          </div>
          <button
            onClick={dismissFirstVideo}
            className="text-[#16A34A] hover:text-[#15803D] transition-colors flex-shrink-0"
            aria-label="Dismiss"
          >
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Active pipeline banner */}
      {isActive && (
        <div className="bg-white border border-[#E5E5E5] rounded-md px-5 py-4 flex items-center gap-4">
          <div className="w-8 h-8 bg-[#0A0A0A] rounded-md flex items-center justify-center flex-shrink-0">
            <Zap size={14} strokeWidth={1.5} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[#0A0A0A] truncate">
              {pipeline?.topic || 'Pipeline running'}
            </p>
            <div className="flex items-center gap-3 mt-1.5">
              <p className="text-xs text-[#A3A3A3]">{pipeline?.stage || 'Processing'}</p>
              <div className="flex-1 h-1 bg-[#F5F5F5] rounded-full overflow-hidden max-w-[140px]">
                <div
                  className="h-full bg-[#0A0A0A] rounded-full transition-all duration-500"
                  style={{ width: `${pipeline?.progress || 0}%` }}
                />
              </div>
              <span className="text-xs text-[#A3A3A3] font-medium tabular-nums">{pipeline?.progress || 0}%</span>
            </div>
          </div>
          {pipeline?.run_id && (
            <Link
              to={`/app/jobs/${pipeline.run_id}`}
              className="flex items-center gap-1 text-xs font-medium text-[#525252] hover:text-[#0A0A0A] flex-shrink-0 transition-colors"
            >
              View <ChevronRight size={13} strokeWidth={1.5} />
            </Link>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-[#E5E5E5] rounded-md px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase">{s.label}</p>
              <span className="text-[#A3A3A3]">{s.icon}</span>
            </div>
            <p className="text-2xl font-semibold text-[#0A0A0A] tabular-nums leading-none">{s.value}</p>
            <p className="text-xs text-[#A3A3A3] mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-3">
        {/* Ideas Engine */}
        <Link
          to="/app/create/ideas"
          className="group bg-white border border-[#E5E5E5] rounded-md px-5 py-4 hover:border-[#D4D4D4] hover:shadow-sm transition-all flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-[#FAFAFA] border border-[#E5E5E5] rounded-md flex items-center justify-center">
              <Sparkles size={14} strokeWidth={1.5} className="text-[#525252]" />
            </div>
            <ChevronRight size={13} strokeWidth={1.5} className="text-[#D4D4D4] group-hover:text-[#A3A3A3] transition-colors" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0A0A0A]">Generate Ideas</p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">AI-scored topics for your channel</p>
          </div>
        </Link>

        {/* Add to Queue */}
        <Link
          to="/app/queue"
          className="group bg-white border border-[#E5E5E5] rounded-md px-5 py-4 hover:border-[#D4D4D4] hover:shadow-sm transition-all flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-[#FAFAFA] border border-[#E5E5E5] rounded-md flex items-center justify-center">
              <ListOrdered size={14} strokeWidth={1.5} className="text-[#525252]" />
            </div>
            <ChevronRight size={13} strokeWidth={1.5} className="text-[#D4D4D4] group-hover:text-[#A3A3A3] transition-colors" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0A0A0A]">Topic Queue</p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">Manage and run queued topics</p>
          </div>
        </Link>

        {/* Write Script */}
        <Link
          to="/app/create/script"
          className="group bg-white border border-[#E5E5E5] rounded-md px-5 py-4 hover:border-[#D4D4D4] hover:shadow-sm transition-all flex flex-col gap-2"
        >
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 bg-[#FAFAFA] border border-[#E5E5E5] rounded-md flex items-center justify-center">
              <PenLine size={14} strokeWidth={1.5} className="text-[#525252]" />
            </div>
            <ChevronRight size={13} strokeWidth={1.5} className="text-[#D4D4D4] group-hover:text-[#A3A3A3] transition-colors" />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-[#0A0A0A]">Write Script</p>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">Generate script, SEO + thumbnail</p>
          </div>
        </Link>
      </div>

      {/* Channel health — the fleet sync's answer, per channel */}
      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#0A0A0A]">Channel health</h2>
            <p className="text-[11px] text-[#A3A3A3] mt-0.5">
              Whether each channel&apos;s dashboard is showing current numbers.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {fleetSync.isSuccess && !fleetSync.isPending && (
              <span className="text-[11px] text-[#16A34A]">
                Synced {fleetSync.data.channels} channel{fleetSync.data.channels === 1 ? '' : 's'}
                {fleetSync.data.failed?.length ? `, ${fleetSync.data.failed.length} failed` : ''}
              </span>
            )}
            {isAdmin && (
              <button
                onClick={() => fleetSync.mutate()}
                disabled={fleetSync.isPending}
                className="h-8 px-3 text-[12px] font-medium bg-white border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                {fleetSync.isPending
                  ? <Loader size={12} strokeWidth={1.5} className="animate-spin" />
                  : <RefreshCw size={12} strokeWidth={1.5} />}
                Sync all
              </button>
            )}
          </div>
        </div>

        {fleetLoading ? (
          <div className="px-5 py-6 text-[12px] text-[#A3A3A3] flex items-center gap-2">
            <Loader size={12} strokeWidth={1.5} className="animate-spin" /> Reading channel health…
          </div>
        ) : fleetChannels.length === 0 ? (
          <div className="px-5 py-6">
            <p className="text-[12px] text-[#525252]">No channels yet.</p>
            <Link to="/app/channels" className="text-[12px] text-[#0A0A0A] underline mt-1 inline-block">
              Connect a channel
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#F0F0F0]">
            {fleetChannels.map((c) => {
              const age = syncAge(c.last_sync)
              const coverage = c.videos > 0 ? Math.round((c.measured / c.videos) * 100) : 0
              return (
                <Link
                  key={c.channel_slug}
                  to={`/app/channels/${c.channel_slug}`}
                  className="px-5 py-3 flex items-center gap-4 hover:bg-[#FAFAFA] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-[#0A0A0A] truncate">
                      {c.channel_name || c.channel_slug}
                    </p>
                    <p className="text-[11px] text-[#A3A3A3] truncate">
                      {c.channel_slug}
                      {c.category_id ? ` · category ${c.category_id}` : ''}
                    </p>
                  </div>

                  <div className="w-28 text-right">
                    <p className="text-[12px] text-[#0A0A0A] tabular-nums">{coverage}%</p>
                    <p className="text-[10px] text-[#A3A3A3] tabular-nums">
                      {c.measured}/{c.videos} measured
                    </p>
                  </div>

                  <div className="w-24 text-right">
                    <p className="text-[12px] text-[#0A0A0A] tabular-nums">{c.views.toLocaleString()}</p>
                    <p className="text-[10px] text-[#A3A3A3]">views</p>
                  </div>

                  <div className="w-20 text-right">
                    <p className="text-[12px] text-[#0A0A0A] tabular-nums">{c.pending_topics}</p>
                    <p className="text-[10px] text-[#A3A3A3]">queued</p>
                  </div>

                  <div className="w-24 text-right">
                    <span className={[
                      'inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border',
                      age.stale
                        ? 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]'
                        : 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
                    ].join(' ')}>
                      {age.stale ? <AlertCircle size={10} strokeWidth={1.5} /> : <CheckCircle size={10} strokeWidth={1.5} />}
                      {age.label}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {fleetSync.isError && (
          <div className="px-5 py-2.5 bg-[#FFF1F2] border-t border-[#FECDD3] text-[11px] text-[#BE123C]">
            Fleet sync failed — try again.
          </div>
        )}
        {fleetSync.isSuccess && fleetSync.data.failed?.length > 0 && (
          <div className="px-5 py-2.5 bg-[#FFFBEB] border-t border-[#FDE68A] text-[11px] text-[#B45309]">
            {fleetSync.data.failed.map((f) => `${f.channel}: ${f.error}`).join(' · ')}
          </div>
        )}
      </div>

      {/* Recent jobs */}
      <div className="bg-white border border-[#E5E5E5] rounded-md overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#0A0A0A]">Recent Jobs</h2>
          <Link
            to="/app/jobs"
            className="text-xs text-[#525252] hover:text-[#0A0A0A] flex items-center gap-1 transition-colors"
          >
            View all <ArrowRight size={12} strokeWidth={1.5} />
          </Link>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 flex justify-center">
            <Loader size={18} strokeWidth={1.5} className="text-[#D4D4D4] animate-spin" />
          </div>
        ) : recentJobs.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="w-12 h-12 bg-[#F5F5F5] rounded-md flex items-center justify-center mx-auto mb-4">
              <Video size={18} strokeWidth={1.5} className="text-[#A3A3A3]" />
            </div>
            <p className="text-sm font-medium text-[#0A0A0A] mb-1">No jobs yet</p>
            <p className="text-xs text-[#A3A3A3] mb-5">Create your first video to get started.</p>
            <Link
              to="/app/jobs/new"
              className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-4 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-colors"
            >
              <Plus size={13} strokeWidth={1.5} /> Create First Job
            </Link>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFAFA] border-b border-[#E5E5E5]">
                {['Topic', 'Type', 'Status', 'Date', ''].map((h) => (
                  <th key={h} scope="col" className="px-5 py-2.5 text-left text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F5F5]">
              {recentJobs.map((job) => {
                const pill = STATUS_PILL[job.status]  ?? STATUS_PILL.queued
                const icon = STATUS_ICON[job.status] ?? STATUS_ICON.queued
                const label = job.status ? job.status.charAt(0).toUpperCase() + job.status.slice(1) : 'Queued'
                return (
                  <tr key={job.job_id} className="hover:bg-[#FAFAFA] transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-[#0A0A0A] max-w-[260px] truncate" title={topicLabel(job)}>
                      {topicLabel(job)}
                    </td>
                    <td className="px-5 py-3 text-xs text-[#A3A3A3]">
                      {isShortJob(job) ? 'Short' : 'Long-form'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${pill}`}>
                        {icon} {label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-[#A3A3A3]">
                      {job.start_time ? new Date(job.start_time).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/app/jobs/${job.job_id}`}
                        className="text-xs text-[#525252] hover:text-[#0A0A0A] font-medium transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
