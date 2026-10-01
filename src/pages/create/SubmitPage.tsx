import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, Loader2, ListOrdered, Plus, Zap, ArrowRight, Clapperboard } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCreateStore } from '@store/create'
import { useChannels } from '@hooks/useJobs'
import { queueApi, jobsApi, shortsApi, billingApi } from '@api/services'
import { useToast } from '@components/Toast'

export default function SubmitPage() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const { data: channels = [] } = useChannels()
  const {
    selectedTopic, scriptContent, seoPackage, channelSlug, contentType,
    thumbnailData, voiceId, visualSource, visualCustomVideoPath, artStyle, bgMusicPath, setStep, reset,
  } = useCreateStore()

  const isShort = contentType === 'short'
  const [mode, setMode] = useState<'run' | 'queue'>('run')
  const [shortsCount, setShortsCount] = useState(1)
  const [shortsMode, setShortsMode] = useState<'separate' | 'extract'>('separate')
  const [done, setDone]  = useState(false)
  // Snapshot of isShort at the moment of successful submission - the done
  // screen below reads this instead of the live `isShort` because the store
  // (and its contentType) gets reset right after success (see onSuccess).
  const [doneWasShort, setDoneWasShort] = useState(false)
  const [planGate, setPlanGate] = useState<{ used: number; limit: number; plan: string } | null>(null)
  const [checkingOut, setCheckingOut] = useState(false)

  const topic = selectedTopic?.topic ?? ''
  const title = seoPackage?.selectedTitle ?? topic

  const thumbDataUrl = (thumbnailData as any)?.dataUrl as string | undefined

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (isShort) {
        // Shorts content-type: the script written in this wizard IS the whole
        // Short - build it directly via the standalone vertical-Short pipeline
        // instead of the long-form pipeline (which would narrate the entire
        // script as an 8-12 min video regardless of the Shorts selection).
        await shortsApi.scriptRun({
          topic,
          scriptText:     scriptContent,
          channel_slug:   channelSlug || undefined,
          voice_id:       voiceId || undefined,
          seoTitle:       seoPackage?.selectedTitle || undefined,
          seoDescription: seoPackage?.description   || undefined,
          seoTags:        seoPackage?.tags?.join(', ') || undefined,
          thumbDataUrl:   thumbDataUrl || undefined,
          visualSource: visualSource !== 'stock' ? visualSource : undefined,
          artStyle: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
          bgMusicPath: bgMusicPath || undefined,
        })
      } else if (mode === 'queue') {
        await queueApi.add(topic, channelSlug || undefined)
      } else {
        await jobsApi.run({
          topic,
          channel_slug:   channelSlug || undefined,
          content_type:   contentType,
          scriptText:     scriptContent || undefined,
          seoTitle:       seoPackage?.selectedTitle || undefined,
          seoDescription: seoPackage?.description   || undefined,
          seoTags:        seoPackage?.tags?.join(', ') || undefined,
          thumbDataUrl:   thumbDataUrl || undefined,
          voice_id:       voiceId || undefined,
          shortsCount,
          shortsMode: shortsMode,
          visualSource: visualSource !== 'stock' ? visualSource : undefined,
          visualCustomVideoPath: visualSource === 'custom_video' ? (visualCustomVideoPath || undefined) : undefined,
          artStyle: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
          bgMusicPath: bgMusicPath || undefined,
        })
      }
    },
    onSuccess: () => {
      setDoneWasShort(isShort)
      setDone(true)
      toast.success(isShort ? 'Short pipeline started!' : (mode === 'queue' ? 'Added to queue' : 'Pipeline started!'))
      // Clear the draft store right away - not only when the user explicitly
      // clicks "New Video" below. Otherwise clicking "View Jobs" (the primary
      // button) leaves this topic's script/SEO/thumbnail data in localStorage,
      // where it can get silently attached to the NEXT topic submitted.
      reset()
    },
    onError: (err: any) => {
      // 402 = plan limit reached - show upgrade gate instead of generic toast
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 402 && detail?.code === 'plan_limit_reached') {
        setPlanGate({ used: detail.used, limit: detail.limit, plan: detail.plan })
      } else {
        toast.error('Submission failed - try again')
      }
    },
  })

  if (done) {
    return (
      <div className="max-w-[600px] mx-auto px-6 py-16 flex flex-col items-center text-center">
        <CheckCircle2 size={40} strokeWidth={1} className="text-[#16A34A] mb-5" />
        <h1 className="text-[20px] font-semibold text-[#0A0A0A] mb-2">
          {doneWasShort ? 'Short Building' : mode === 'queue' ? 'Added to Queue' : 'Pipeline Running'}
        </h1>
        <p className="text-[13px] text-[#525252] max-w-xs mb-8">
          {doneWasShort
            ? 'Your vertical Short has started building and will upload to YouTube Shorts automatically. You can track progress in Jobs.'
            : mode === 'queue'
            ? 'Your topic has been added to the queue. It will run on the next scheduled slot.'
            : 'Your video pipeline has started. You can track progress in Jobs.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(mode === 'queue' ? '/app/queue' : '/app/jobs')}
            className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
          >
            {mode === 'queue' ? 'View Queue' : 'View Jobs'}
          </button>
          <button
            onClick={() => { reset(); navigate('/app/create/ideas') }}
            className="h-8 px-4 text-[12px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors"
          >
            New Video
          </button>
        </div>
      </div>
    )
  }

  // ── Plan limit gate ────────────────────────────────────────────────────────
  if (planGate) {
    const handleUpgrade = async () => {
      setCheckingOut(true)
      try {
        const { checkout_url } = await billingApi.checkout('pro')
        window.location.href = checkout_url
      } catch {
        toast.error('Could not start checkout - try again')
        setCheckingOut(false)
      }
    }

    return (
      <div className="max-w-[480px] mx-auto px-6 py-16 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-[#FEF3C7] flex items-center justify-center mb-5">
          <Zap size={22} strokeWidth={1.5} className="text-[#D97706]" />
        </div>
        <h1 className="text-[18px] font-semibold text-[#0A0A0A] mb-2">Monthly limit reached</h1>
        <p className="text-[13px] text-[#525252] mb-6 max-w-xs">
          You've used all <strong>{planGate.limit}</strong> free videos this month.
          Upgrade to <strong>Pro</strong> for 50 videos/month, 5 channels, and all social platforms.
        </p>

        {/* Plan comparison */}
        <div className="w-full grid grid-cols-2 gap-3 mb-6 text-left">
          <div className="border border-[#E5E5E5] rounded-lg p-4">
            <p className="text-[10px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-2">Free</p>
            <p className="text-xl font-semibold text-[#0A0A0A] mb-3">$0<span className="text-sm font-normal text-[#A3A3A3]">/mo</span></p>
            <ul className="space-y-1">
              {['5 videos/month', '1 channel', 'YouTube only'].map(f => (
                <li key={f} className="flex items-center gap-1.5 text-[11px] text-[#A3A3A3]">
                  <CheckCircle2 size={10} strokeWidth={2} /> {f}
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-[#0A0A0A] rounded-lg p-4 relative">
            <span className="absolute -top-2.5 left-3 text-[9px] font-bold tracking-widest uppercase bg-[#0A0A0A] text-white px-2 py-0.5 rounded-full">
              Recommended
            </span>
            <p className="text-[10px] font-medium tracking-widest text-[#A3A3A3] uppercase mb-2">Pro</p>
            <p className="text-xl font-semibold text-[#0A0A0A] mb-3">$49<span className="text-sm font-normal text-[#A3A3A3]">/mo</span></p>
            <ul className="space-y-1">
              {['50 videos/month', '5 channels', 'All social platforms'].map(f => (
                <li key={f} className="flex items-center gap-1.5 text-[11px] text-[#0A0A0A]">
                  <CheckCircle2 size={10} strokeWidth={2} className="text-[#16A34A]" /> {f}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          onClick={handleUpgrade}
          disabled={checkingOut}
          className="w-full h-10 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center justify-center gap-2 mb-3"
        >
          {checkingOut
            ? <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
            : <><Zap size={14} strokeWidth={1.5} /> Upgrade to Pro <ArrowRight size={13} strokeWidth={1.5} /></>
          }
        </button>
        <Link
          to="/app/queue"
          className="text-[12px] text-[#A3A3A3] hover:text-[#525252] transition-colors"
          onClick={() => {
            // Queue the topic instead so work isn't lost
            queueApi.add(topic, channelSlug || undefined).catch(() => {})
          }}
        >
          Queue for later instead →
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-[700px] mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Submit</h1>
        <p className="text-[13px] text-[#525252] mt-0.5">Review and launch your video.</p>
      </div>

      {/* Summary card */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg divide-y divide-[#E5E5E5] mb-6">
        {[
          { label: 'Topic',       value: topic },
          { label: 'Title',       value: title },
          { label: 'Channel',     value: channelSlug || 'Default' },
          { label: 'Type',        value: contentType },
          { label: 'Tags',        value: seoPackage?.tags?.slice(0, 6).join(', ') || '—' },
          ...(scriptContent
            ? [{ label: 'Script', value: `${scriptContent.split(/\s+/).filter(Boolean).length} words - will be used by pipeline` }]
            : []),
        ].map(({ label, value }) => (
          <div key={label} className="flex items-start gap-4 px-5 py-3">
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest w-20 flex-shrink-0 pt-0.5">{label}</p>
            <p className="text-[13px] text-[#0A0A0A] flex-1 min-w-0 truncate">{value || '—'}</p>
          </div>
        ))}

        {/* Thumbnail preview row */}
        {thumbDataUrl && (
          <div className="flex items-start gap-4 px-5 py-3">
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest w-20 flex-shrink-0 pt-0.5">Thumbnail</p>
            <div className="flex items-center gap-3">
              <div className="w-24 aspect-video rounded overflow-hidden border border-[#E5E5E5] bg-[#F5F5F5]">
                <img src={thumbDataUrl} alt="Thumbnail" className="w-full h-full object-cover" />
              </div>
              <p className="text-[12px] text-[#525252]">Will be applied after upload</p>
            </div>
          </div>
        )}
      </div>

      {/* Mode selector - Shorts always run immediately via the standalone Short pipeline */}
      {!isShort && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {([
            { id: 'run',   icon: <Plus size={16} strokeWidth={1.5} />,         label: 'Run Now',       desc: 'Start the pipeline immediately' },
            { id: 'queue', icon: <ListOrdered size={16} strokeWidth={1.5} />,  label: 'Add to Queue',  desc: 'Queue for next scheduled slot'  },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setMode(opt.id)}
              className={`flex flex-col items-start gap-1.5 p-4 border rounded-lg text-left transition-colors ${
                mode === opt.id
                  ? 'border-[#0A0A0A] bg-white'
                  : 'border-[#E5E5E5] bg-white hover:border-[#D4D4D4]'
              }`}
            >
              <span className={mode === opt.id ? 'text-[#0A0A0A]' : 'text-[#A3A3A3]'}>{opt.icon}</span>
              <p className={`text-[13px] font-semibold ${mode === opt.id ? 'text-[#0A0A0A]' : 'text-[#525252]'}`}>
                {opt.label}
              </p>
              <p className="text-[11px] text-[#A3A3A3]">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}

      {isShort && (
        <div className="bg-[#EFF6FF] border border-[#BFDBFE] rounded-lg p-4 mb-6">
          <p className="text-[12px] text-[#1E40AF]">
            This will build a standalone vertical Short directly from the script above and upload it to YouTube Shorts - no long-form video is created.
          </p>
        </div>
      )}

      {/* Shorts configuration (Run Now only, long-form content type only - a "Companion Short"
          alongside the main video doesn't apply when the submission IS already a Short) */}
      {mode === 'run' && !isShort && (
        <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clapperboard size={14} strokeWidth={1.5} className="text-[#525252]" />
            <p className="text-[12px] font-semibold text-[#0A0A0A] uppercase tracking-widest">Companion Short</p>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <label className="text-[12px] text-[#525252]">Generate Shorts</label>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setShortsCount(n)}
                  className={`h-7 w-7 text-[12px] font-medium rounded border transition-colors ${
                    shortsCount === n
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            {shortsCount === 0 && (
              <span className="text-[11px] text-[#A3A3A3]">No Short will be generated</span>
            )}
          </div>

          {shortsCount > 0 && (
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-2">Short Style</label>
              <div className="grid grid-cols-2 gap-2.5">
                {([
                  {
                    val: 'separate' as const,
                    label: 'Dedicated script',
                    desc: 'AI writes a purpose-built 60s script for this Short - native short-form hook, better engagement.',
                  },
                  {
                    val: 'extract' as const,
                    label: 'Extract from main video',
                    desc: 'Clips are sliced from the main video\'s segments. No extra AI cost, but written for long-form.',
                  },
                ]).map(({ val, label, desc }) => (
                  <button
                    key={val}
                    onClick={() => setShortsMode(val)}
                    className={`flex flex-col items-start gap-1 p-3 border rounded-lg text-left transition-colors ${
                      shortsMode === val
                        ? 'border-[#0A0A0A] bg-white'
                        : 'border-[#E5E5E5] bg-[#FAFAFA] hover:border-[#D4D4D4]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${shortsMode === val ? 'bg-[#0A0A0A]' : 'bg-[#D4D4D4]'}`} />
                      <p className={`text-[12px] font-medium ${shortsMode === val ? 'text-[#0A0A0A]' : 'text-[#525252]'}`}>{label}</p>
                      {val === 'separate' && <span className="text-[9px] font-bold uppercase tracking-widest bg-[#F0FDF4] text-[#16A34A] px-1.5 py-0.5 rounded">Recommended</span>}
                    </div>
                    <p className="text-[11px] text-[#A3A3A3] leading-relaxed pl-3">{desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || !topic}
        className="w-full h-10 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {submitMutation.isPending
          ? <><Loader2 size={14} strokeWidth={1.5} className="animate-spin" /> Submitting…</>
          : isShort ? 'Build Short' : mode === 'queue' ? 'Add to Queue' : 'Start Pipeline'
        }
      </button>
    </div>
  )
}
