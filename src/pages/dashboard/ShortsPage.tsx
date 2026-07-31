import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Clapperboard, Sparkles, Play, Loader2, Plus, Trash2,
  Youtube, Globe, Share2, RefreshCw, CheckCircle2, XCircle,
  ChevronDown, ChevronRight, Upload, ExternalLink,
} from 'lucide-react'
import { useChannels } from '@hooks/useJobs'
import {
  shortsApi,
  type ShortsScenePrompt,
  type ShortsAnimatedJob,
  type ShortsScriptJob,
  type ShortsLibraryItem,
} from '@api/services'
import { useToast } from '@components/Toast'

// ─── Constants ────────────────────────────────────────────────────────────────

const ASPECT_OPTIONS = [
  { value: '9:16', label: '9:16  Vertical' },
  { value: '1:1',  label: '1:1  Square' },
  { value: '16:9', label: '16:9  Wide' },
]

const PLATFORM_OPTIONS = [
  { id: 'youtube',   label: 'YT Shorts', icon: <Youtube size={11} strokeWidth={1.5} /> },
  { id: 'tiktok',   label: 'TikTok',    icon: <Clapperboard size={11} strokeWidth={1.5} /> },
  { id: 'instagram', label: 'Instagram', icon: <Share2 size={11} strokeWidth={1.5} /> },
  { id: 'facebook',  label: 'Facebook',  icon: <Globe size={11} strokeWidth={1.5} /> },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function ProgressBar({ pct, phase }: { pct: number; phase: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[#525252] capitalize">{phase || 'Processing…'}</span>
        <span className="text-[11px] font-mono text-[#525252]">{pct}%</span>
      </div>
      <div className="h-1.5 bg-[#F5F5F5] rounded-full overflow-hidden">
        <div
          className="h-full bg-[#0A0A0A] rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    generating: 'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
    running:    'bg-[#FFF7ED] text-[#C2410C] border-[#FDBA74]',
    ready:      'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
    done:       'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]',
    failed:     'bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]',
  }
  const cls = map[status] ?? 'bg-[#F5F5F5] text-[#525252] border-[#E5E5E5]'
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  )
}

// ─── Distribute modal ─────────────────────────────────────────────────────────

function DistributeModal({
  item,
  onClose,
}: {
  item: ShortsLibraryItem
  onClose: () => void
}) {
  const toast = useToast()
  const [platforms, setPlatforms] = useState<string[]>(['youtube'])
  const [title, setTitle]         = useState('')
  const [busy, setBusy]           = useState(false)

  const toggle = (p: string) =>
    setPlatforms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p])

  const handle = async () => {
    if (!platforms.length) { toast.error('Select at least one platform'); return }
    setBusy(true)
    try {
      const res = await shortsApi.distribute({
        paths: item.clips,
        platforms,
        title: title.trim() || `Short: ${item.job_id}`,
      })
      if (res.ok) {
        toast.success(`Distributed ${item.clips.length} clip(s) to ${platforms.join(', ')}`)
        onClose()
      } else {
        toast.error('Distribution failed')
      }
    } catch { toast.error('Distribution failed') }
    finally { setBusy(false) }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Distribute clips"
    >
      <div className="bg-white rounded-xl border border-[#E5E5E5] w-full max-w-sm p-6 shadow-xl">
        <h3 className="text-[15px] font-semibold text-[#0A0A0A] mb-1">Distribute Clips</h3>
        <p className="text-[12px] text-[#A3A3A3] mb-4">{item.clips.length} clip(s) · Job {item.job_id}</p>

        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Title</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={`Short: ${item.job_id}`}
            className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
        </div>

        <div className="mb-5">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-2">Platforms</label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORM_OPTIONS.map(p => (
              <button
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`h-9 flex items-center gap-2 px-3 text-[12px] font-medium rounded border transition-colors ${
                  platforms.includes(p.id)
                    ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                    : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#0A0A0A]'
                }`}
              >
                {p.icon}{p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 text-[12px] font-medium rounded border border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy || !platforms.length}
            className="flex-1 h-9 text-[12px] font-medium rounded bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : <Upload size={12} strokeWidth={1.5} />}
            Distribute
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Library card ─────────────────────────────────────────────────────────────

function LibraryCard({
  item,
  onDistribute,
}: {
  item: ShortsLibraryItem
  onDistribute: (item: ShortsLibraryItem) => void
}) {
  return (
    <div className="border border-[#E5E5E5] rounded-lg bg-white overflow-hidden">
      {/* Clip previews */}
      <div className="flex gap-1.5 p-2.5 bg-[#F5F5F5] overflow-x-auto">
        {item.clips.slice(0, 3).map((clip, i) => (
          <video
            key={i}
            src={clip}
            muted
            playsInline
            preload="metadata"
            className="h-24 w-14 object-cover rounded border border-[#E5E5E5] shrink-0 cursor-pointer"
            onMouseEnter={e => (e.currentTarget as HTMLVideoElement).play()}
            onMouseLeave={e => { const v = e.currentTarget as HTMLVideoElement; v.pause(); v.currentTime = 0 }}
            aria-label={`Clip ${i + 1}`}
          />
        ))}
        {item.clips.length > 3 && (
          <div className="h-24 w-14 flex items-center justify-center bg-[#E5E5E5] rounded text-[10px] text-[#525252] font-medium shrink-0">
            +{item.clips.length - 3}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <span className="text-[11px] font-medium text-[#0A0A0A]">{item.clips.length} clip{item.clips.length !== 1 ? 's' : ''}</span>
          <span className="text-[10px] text-[#A3A3A3] ml-2 font-mono">{item.job_id}</span>
        </div>
        <button
          onClick={() => onDistribute(item)}
          className="h-6 px-2.5 text-[10px] font-medium flex items-center gap-1 border border-[#E5E5E5] rounded text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors"
        >
          <Upload size={9} strokeWidth={1.5} />
          Distribute
        </button>
      </div>
    </div>
  )
}

// ─── Active animated job strip ────────────────────────────────────────────────

function AnimatedJobStrip({
  jobId,
  onDone,
}: {
  jobId: string
  onDone: () => void
}) {
  const [job, setJob] = useState<ShortsAnimatedJob | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    const poll = async () => {
      try {
        const data = await shortsApi.status(jobId)
        if (cancelled) return
        setJob(data)
        if (data.status === 'ready' || data.status === 'failed') {
          if (!doneRef.current) { doneRef.current = true; onDone() }
          return
        }
        setTimeout(poll, 2500)
      } catch { if (!cancelled) setTimeout(poll, 4000) }
    }
    poll()
    return () => { cancelled = true }
  }, [jobId, onDone])

  if (!job) return null

  return (
    <div className="mt-4 border border-[#E5E5E5] rounded-lg p-4 bg-[#FAFAFA]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#0A0A0A]">Job {jobId}</span>
          <StatusBadge status={job.status} />
        </div>
        {job.status === 'ready' && (
          <span className="text-[11px] text-[#16A34A] flex items-center gap-1">
            <CheckCircle2 size={11} strokeWidth={1.5} /> {job.paths.length} clips ready
          </span>
        )}
        {job.status === 'failed' && (
          <span className="text-[11px] text-[#BE123C] flex items-center gap-1">
            <XCircle size={11} strokeWidth={1.5} /> {job.error}
          </span>
        )}
      </div>
      {job.status === 'generating' && (
        <ProgressBar pct={job.progress} phase={job.phase} />
      )}
    </div>
  )
}

// ─── Script Short mode ────────────────────────────────────────────────────────

function ScriptMode({ channels }: { channels: Array<{ slug: string; name?: string }> }) {
  const toast = useToast()

  const [channel,  setChannel]  = useState('')
  const [topic,    setTopic]    = useState('')
  const [script,   setScript]   = useState('')
  const [voice,    setVoice]    = useState('')
  const [language, setLanguage] = useState('')
  const [seoOpen,  setSeoOpen]  = useState(false)
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDsc,   setSeoDsc]   = useState('')
  const [seoTags,  setSeoTags]  = useState('')
  const [busy,     setBusy]     = useState(false)
  const [job,      setJob]      = useState<ShortsScriptJob | null>(null)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startPolling = useCallback(() => {
    const poll = async () => {
      try {
        const data = await shortsApi.scriptStatus()
        setJob(data)
        if (data.status === 'running') {
          pollRef.current = setTimeout(poll, 2500)
        } else {
          setBusy(false)
        }
      } catch { pollRef.current = setTimeout(poll, 4000) }
    }
    poll()
  }, [])

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current) }, [])

  const handleBuild = async () => {
    if (!topic.trim() || !script.trim()) { toast.error('Topic and script are required'); return }
    setBusy(true)
    setJob(null)
    try {
      const res = await shortsApi.scriptRun({
        topic: topic.trim(),
        scriptText: script.trim(),
        voice_id: voice || undefined,
        language: language || undefined,
        channel_slug: channel || undefined,
        seoTitle: seoTitle || undefined,
        seoDescription: seoDsc || undefined,
        seoTags: seoTags || undefined,
      })
      if (res.ok) {
        toast.success('Short build started')
        startPolling()
      } else {
        toast.error('Failed to start build')
        setBusy(false)
      }
    } catch { toast.error('Failed to start build'); setBusy(false) }
  }

  return (
    <div className="space-y-4">
      {/* Channel / Voice / Language */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Channel</label>
          <select
            value={channel}
            onChange={e => setChannel(e.target.value)}
            className="w-full h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            <option value="">Any channel</option>
            {channels.map(ch => <option key={ch.slug} value={ch.slug}>{ch.name || ch.slug}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Voice ID <span className="font-normal normal-case tracking-normal">(optional)</span></label>
          <input
            value={voice}
            onChange={e => setVoice(e.target.value)}
            placeholder="e.g. en-GB-RyanNeural"
            className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Language</label>
          <input
            value={language}
            onChange={e => setLanguage(e.target.value)}
            placeholder="e.g. en, ar, fr"
            className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
        </div>
      </div>

      {/* Topic */}
      <div>
        <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Topic <span className="text-[#DC2626]">*</span></label>
        <input
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. 3 Facts About the Ocean"
          className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
        />
      </div>

      {/* Script */}
      <div>
        <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
          Script <span className="text-[#DC2626]">*</span>
          <span className="ml-2 font-normal normal-case tracking-normal text-[#A3A3A3]">Keep under 300 words for a 60s Short</span>
        </label>
        <textarea
          value={script}
          onChange={e => setScript(e.target.value)}
          placeholder="Write or paste your Short's script here…&#10;&#10;Hook: Start with a bold statement or question.&#10;Body: Deliver 2-3 punchy facts or steps.&#10;CTA: End with 'Like & subscribe for more!'"
          rows={8}
          className="w-full px-3 py-2.5 text-[13px] border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-[#0A0A0A] transition-colors resize-none placeholder:text-[#D4D4D4]"
        />
        <p className="text-[10px] text-[#A3A3A3] mt-1">
          <span style={{ color: script.split(/\s+/).filter(Boolean).length > 300 ? '#DC2626' : '#A3A3A3' }}>
            {script.split(/\s+/).filter(Boolean).length} words
          </span>
          {' '}· ~{Math.round(script.split(/\s+/).filter(Boolean).length / 2.5)}s spoken
        </p>
      </div>

      {/* SEO accordion */}
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
        <button
          onClick={() => setSeoOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[12px] font-medium text-[#525252] hover:bg-[#FAFAFA] transition-colors"
        >
          <span>SEO — Title, Description, Tags</span>
          {seoOpen ? <ChevronDown size={13} strokeWidth={1.5} /> : <ChevronRight size={13} strokeWidth={1.5} />}
        </button>
        {seoOpen && (
          <div className="border-t border-[#E5E5E5] p-4 space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Title</label>
              <input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Override video title" className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Description</label>
              <textarea value={seoDsc} onChange={e => setSeoDsc(e.target.value)} rows={2} placeholder="YouTube description" className="w-full px-3 py-2 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-[#0A0A0A] resize-none placeholder:text-[#D4D4D4]" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Tags <span className="font-normal normal-case tracking-normal">(comma-separated)</span></label>
              <input value={seoTags} onChange={e => setSeoTags(e.target.value)} placeholder="shorts, facts, education" className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]" />
            </div>
          </div>
        )}
      </div>

      {/* Build button */}
      <button
        onClick={handleBuild}
        disabled={busy || !topic.trim() || !script.trim()}
        className="h-9 px-5 text-[13px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-2"
      >
        {busy
          ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Building…</>
          : <><Play size={13} strokeWidth={1.5} /> Build &amp; Upload Short</>
        }
      </button>

      {/* Job progress */}
      {job && (
        <div className="border border-[#E5E5E5] rounded-lg p-4 bg-[#FAFAFA] space-y-2">
          <div className="flex items-center justify-between">
            <StatusBadge status={job.status} />
            {job.youtube_url && (
              <a
                href={job.youtube_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-[#0A0A0A] flex items-center gap-1 hover:underline"
              >
                <Youtube size={11} strokeWidth={1.5} />
                View on YouTube
                <ExternalLink size={9} strokeWidth={1.5} />
              </a>
            )}
          </div>
          {job.message && <p className="text-[12px] text-[#525252]">{job.message}</p>}
          {job.error && <p className="text-[11px] text-[#BE123C]">{job.error}</p>}
          {job.status === 'running' && (
            <div className="flex items-center gap-2 text-[11px] text-[#A3A3A3]">
              <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Processing…
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Animated Short mode ──────────────────────────────────────────────────────

function AnimatedMode() {
  const toast = useToast()
  const queryClient = useQueryClient()

  const [topic,        setTopic]        = useState('')
  const [aspect,       setAspect]       = useState('9:16')
  const [context,      setContext]      = useState('')
  const [scenes,       setScenes]       = useState<ShortsScenePrompt[]>([])
  const [platforms,    setPlatforms]    = useState<string[]>(['youtube'])
  const [title,        setTitle]        = useState('')
  const [description,  setDescription]  = useState('')
  const [tags,         setTags]         = useState('')
  const [generatingScenes, setGeneratingScenes] = useState(false)
  const [generatingClips,  setGeneratingClips]  = useState(false)
  const [activeJobs,   setActiveJobs]   = useState<string[]>([])

  const togglePlatform = (p: string) =>
    setPlatforms(ps => ps.includes(p) ? ps.filter(x => x !== p) : [...ps, p])

  const handleGenerateScenes = async () => {
    if (!topic.trim()) { toast.error('Enter a topic first'); return }
    setGeneratingScenes(true)
    try {
      const res = await shortsApi.scenePrompts({ topic: topic.trim(), context: context.trim() || undefined })
      if (res.ok && res.prompts?.length) {
        setScenes(res.prompts)
      } else {
        toast.error(res.error ?? 'Scene generation failed')
      }
    } catch { toast.error('Scene generation failed') }
    finally { setGeneratingScenes(false) }
  }

  const handleGenerateClips = async () => {
    if (!topic.trim()) { toast.error('Enter a topic'); return }
    if (!scenes.length) { toast.error('Generate or add at least one scene first'); return }
    setGeneratingClips(true)
    try {
      const res = await shortsApi.generateAnimated({
        topic: topic.trim(),
        hooks: scenes.map(s => s.prompt),
        aspect_ratio: aspect,
      })
      if (res.ok && res.job_id) {
        setActiveJobs(j => [...j, res.job_id])
        toast.success(`Clip generation started — job ${res.job_id}`)
      } else {
        toast.error('Failed to start generation')
      }
    } catch { toast.error('Failed to start generation') }
    finally { setGeneratingClips(false) }
  }

  const updateScene = (i: number, field: keyof ShortsScenePrompt, value: string | number) =>
    setScenes(ss => ss.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

  const removeScene = (i: number) =>
    setScenes(ss => ss.filter((_, idx) => idx !== i))

  const addScene = () =>
    setScenes(ss => [...ss, { scene: ss.length + 1, prompt: '', duration_sec: 6 }])

  const handleJobDone = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shorts-library'], exact: false })
  }, [queryClient])

  return (
    <div className="space-y-4">
      {/* Topic + Aspect */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Topic <span className="text-[#DC2626]">*</span></label>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. The Power of Compound Interest"
            className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Aspect Ratio</label>
          <select
            value={aspect}
            onChange={e => setAspect(e.target.value)}
            className="w-full h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            {ASPECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {/* Context hint */}
      <div>
        <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Context <span className="font-normal normal-case tracking-normal">(optional — improves scene quality)</span></label>
        <input
          value={context}
          onChange={e => setContext(e.target.value)}
          placeholder="e.g. targeting 18-35 year-olds interested in personal finance"
          className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
        />
      </div>

      {/* Scene generator */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleGenerateScenes}
          disabled={generatingScenes || !topic.trim()}
          className="h-8 px-3.5 text-[12px] font-medium flex items-center gap-1.5 border border-[#E5E5E5] rounded bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors disabled:opacity-40"
        >
          {generatingScenes
            ? <><Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> Generating…</>
            : <><Sparkles size={11} strokeWidth={1.5} /> Generate Scenes with AI</>
          }
        </button>
        <span className="text-[11px] text-[#A3A3A3]">or add scenes manually below</span>
      </div>

      {/* Scene cards */}
      {(scenes.length > 0 || true) && (
        <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
          {scenes.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-[#A3A3A3]">
              No scenes yet — click "Generate Scenes with AI" or add manually
            </div>
          ) : (
            <div className="divide-y divide-[#F5F5F5]">
              {scenes.map((s, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3">
                  <span className="text-[10px] font-mono text-[#A3A3A3] mt-2 w-4 shrink-0">{i + 1}</span>
                  <input
                    value={s.prompt}
                    onChange={e => updateScene(i, 'prompt', e.target.value)}
                    placeholder="Describe this scene…"
                    className="flex-1 h-8 px-2.5 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
                    aria-label={`Scene ${i + 1} prompt`}
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min={2}
                      max={30}
                      value={s.duration_sec}
                      onChange={e => updateScene(i, 'duration_sec', Number(e.target.value))}
                      className="w-12 h-8 px-2 text-[12px] border border-[#E5E5E5] rounded text-center focus:outline-none focus:border-[#0A0A0A] transition-colors"
                      aria-label={`Scene ${i + 1} duration`}
                    />
                    <span className="text-[10px] text-[#A3A3A3]">s</span>
                  </div>
                  <button
                    onClick={() => removeScene(i)}
                    aria-label={`Remove scene ${i + 1}`}
                    className="h-8 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#DC2626] transition-colors"
                  >
                    <Trash2 size={12} strokeWidth={1.5} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-[#F5F5F5] px-4 py-2">
            <button
              onClick={addScene}
              className="text-[11px] text-[#525252] flex items-center gap-1 hover:text-[#0A0A0A] transition-colors"
            >
              <Plus size={11} strokeWidth={1.5} /> Add Scene
            </button>
          </div>
        </div>
      )}

      {/* Platform checkboxes */}
      <div>
        <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-2">Distribute To</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORM_OPTIONS.map(p => (
            <button
              key={p.id}
              onClick={() => togglePlatform(p.id)}
              className={`h-8 px-3 text-[12px] font-medium flex items-center gap-1.5 rounded border transition-colors ${
                platforms.includes(p.id)
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#525252]'
              }`}
            >
              {p.icon}{p.label}
            </button>
          ))}
        </div>
        {platforms.length === 0 && (
          <p className="text-[10px] text-[#D97706] mt-1">Select at least one platform — clips will be generated but not distributed automatically</p>
        )}
      </div>

      {/* SEO row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr] gap-3">
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="AI Animated Short" className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Short description" className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Tags</label>
          <input value={tags} onChange={e => setTags(e.target.value)} placeholder="shorts, animated" className="w-full h-8 px-3 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]" />
        </div>
      </div>

      {/* Generate Clips button */}
      <button
        onClick={handleGenerateClips}
        disabled={generatingClips || !topic.trim() || !scenes.length}
        className="h-9 px-5 text-[13px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-2"
      >
        {generatingClips
          ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Starting…</>
          : <><Clapperboard size={13} strokeWidth={1.5} /> Generate Clips</>
        }
      </button>

      {/* Active jobs */}
      {activeJobs.map(jid => (
        <AnimatedJobStrip key={jid} jobId={jid} onDone={handleJobDone} />
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Mode = 'script' | 'animated'

export default function ShortsPage() {
  const { data: channels = [] } = useChannels()
  const [mode, setMode] = useState<Mode>('animated')
  const [distributeItem, setDistributeItem] = useState<ShortsLibraryItem | null>(null)

  const { data: libraryData, isLoading: libraryLoading, refetch: refetchLibrary } = useQuery({
    queryKey: ['shorts-library'],
    queryFn: () => shortsApi.list(),
    refetchInterval: 30000,
  })

  const library = libraryData?.shorts ?? []

  return (
    <div className="p-6 max-w-3xl">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Shorts Studio</h1>
        <p className="text-[13px] text-[#525252] mt-0.5">
          Create vertical short-form content for YouTube Shorts, TikTok, Instagram Reels, and Facebook.
        </p>
      </div>

      {/* ── Mode toggle ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 border border-[#E5E5E5] rounded-lg p-1 mb-6 bg-[#FAFAFA] w-fit">
        {([
          { id: 'animated', label: '🎬  Animated Short', desc: 'AI visual clips · multi-platform' },
          { id: 'script',   label: '📜  Script Short',   desc: 'Voice narration · YouTube Shorts' },
        ] as { id: Mode; label: string; desc: string }[]).map(m => (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            className={`px-4 py-2 rounded text-left transition-colors ${
              mode === m.id
                ? 'bg-white text-[#0A0A0A] shadow-sm border border-[#E5E5E5]'
                : 'text-[#525252] hover:text-[#0A0A0A]'
            }`}
          >
            <div className="text-[12px] font-medium">{m.label}</div>
            <div className="text-[10px] text-[#A3A3A3] mt-0.5">{m.desc}</div>
          </button>
        ))}
      </div>

      {/* ── Creator panel ─────────────────────────────────────────────────── */}
      <section className="border border-[#E5E5E5] rounded-lg bg-white mb-8" aria-label={mode === 'script' ? 'Script Short creator' : 'Animated Short creator'}>
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center gap-2">
          {mode === 'animated'
            ? <Clapperboard size={13} strokeWidth={1.5} className="text-[#7C3AED]" />
            : <Play size={13} strokeWidth={1.5} className="text-[#0369A1]" />
          }
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">
            {mode === 'animated' ? 'Animated Short' : 'Script Short'}
          </h2>
          {mode === 'animated' && (
            <span className="ml-auto text-[10px] text-[#A3A3A3]">
              Powered by Kling AI / Minimax
            </span>
          )}
          {mode === 'script' && (
            <span className="ml-auto text-[10px] text-[#A3A3A3]">
              Voice narration → vertical video → YouTube upload
            </span>
          )}
        </div>
        <div className="p-5">
          {mode === 'script'
            ? <ScriptMode channels={channels} />
            : <AnimatedMode />
          }
        </div>
      </section>

      {/* ── Shorts Library ────────────────────────────────────────────────── */}
      <section aria-label="Shorts library">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Shorts Library</h2>
          <button
            onClick={() => refetchLibrary()}
            aria-label="Refresh shorts library"
            className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
          >
            <RefreshCw size={12} strokeWidth={1.5} />
          </button>
        </div>

        {libraryLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => <div key={i} className="h-40 bg-[#F5F5F5] rounded-lg animate-pulse" />)}
          </div>
        ) : library.length === 0 ? (
          <div className="border border-dashed border-[#E5E5E5] rounded-lg py-16 text-center">
            <Clapperboard size={24} strokeWidth={1} className="text-[#D4D4D4] mx-auto mb-3" />
            <p className="text-[13px] font-medium text-[#525252]">No clips generated yet</p>
            <p className="text-[12px] text-[#A3A3A3] mt-1">Generate your first animated short above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {library.map(item => (
              <LibraryCard key={item.job_id} item={item} onDistribute={setDistributeItem} />
            ))}
          </div>
        )}
      </section>

      {/* ── Distribute modal ──────────────────────────────────────────────── */}
      {distributeItem && (
        <DistributeModal
          item={distributeItem}
          onClose={() => setDistributeItem(null)}
        />
      )}
    </div>
  )
}
