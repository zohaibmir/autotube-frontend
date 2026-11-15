import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { CheckCircle2, Loader2, ListOrdered, Plus, Zap, ArrowRight, Clapperboard } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useCreateStore } from '@store/create'
import { queueApi, jobsApi, shortsApi, billingApi } from '@api/services'
import { useToast } from '@components/Toast'
import ShortsDurationSelect, { useShortsDuration } from '@components/ShortsDurationSelect'

export default function SubmitPage() {
  const navigate  = useNavigate()
  const toast     = useToast()
  const {
    selectedTopic, scriptContent, seoPackage, channelSlug, contentType,
    thumbnailData, voiceId, visualSource, visualCustomVideoPath, artStyle, imageProvider, bgMusicPath, reset,
    shortsDurationSeconds, setShortsDurationSeconds,
  } = useCreateStore()

  const isShort = contentType === 'short'
  const shortDuration = useShortsDuration(channelSlug, shortsDurationSeconds)
  const [mode, setMode] = useState<'run' | 'queue'>('run')
  const [shortsCount, setShortsCount] = useState(1)
  const [shortsMode, setShortsMode] = useState<'separate' | 'extract'>('separate')
  const [done, setDone]  = useState(false)
  // Snapshot of isShort at the moment of successful submission - the done
  // screen below reads this instead of the live `isShort` because the store
  // (and its contentType) gets reset right after success (see onSuccess).
  const [doneWasShort, setDoneWasShort] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  // W8: backend 402 insufficient_credits → full-page upgrade gate.
  const [creditGate, setCreditGate] = useState<{
    cost_credits: number
    credits_remaining: number
    message?: string
  } | null>(null)

  // W8: balance + the pre-render quote under the submit button.
  //
  // The quote is computed server-side from the effective configuration (R7), because the number depends on
  // things this screen cannot see: the channel's visual mode and the platform's TTS model decide the recipe
  // that will actually be charged. Reading `recipe_costs.longform_stock` here -- what this used to do --
  // showed a *recipe* as if it were a price, and was wrong for a premium voice and meaningless for an
  // animated channel, where no fixed price exists until the script does.
  const { data: usageData } = useQuery({
    queryKey: ['billing-usage'],
    queryFn: () => billingApi.usage(),
    staleTime: 30_000,
    retry: false,
  })
  const quotePayload = {
    topic: (selectedTopic?.topic ?? '') || 'quote',
    channel_slug: channelSlug || undefined,
    shortsCount,
    shortsMode,
    visualSource: visualSource !== 'stock' ? visualSource : undefined,
    bgMusicPath: bgMusicPath || undefined,
    voice_id: voiceId || undefined,
    language: undefined as string | undefined,
  }
  const { data: quote, isLoading: quoteLoading } = useQuery({
    queryKey: ['pipeline-quote', quotePayload],
    queryFn: () => jobsApi.quote(quotePayload),
    // Re-quote only when the configuration changes: the server resolves it from channel profile and
    // platform config, so nothing on this screen invalidates it.
    staleTime: 60_000,
    retry: false,
    // A quote that fails to load must not block submitting -- `/run` is the real gate.
    enabled: !isShort && !!selectedTopic?.topic,
  })

  // The Shorts path is a different pipeline (`shortsApi.scriptRun`) with its own recipe, so the long-form
  // quote does not describe it. Kept as-is rather than replaced with a number that would be about the wrong
  // job; wiring Shorts into the quote is separate work.
  const shortCost = usageData?.recipe_costs?.short_stock ?? null

  // `mode === 'measured'` means the figure is a floor, not a total, and `affordable: null` means the
  // balance could not be read. Neither is rendered as a fact below.
  const quotedCredits = quote?.pricing.credits ?? null
  const pricedCredits = isShort ? shortCost : quotedCredits
  const isMeasured = !isShort && quote?.pricing.mode === 'measured'
  const creditsRemaining = quote?.pricing.credits_remaining ?? usageData?.credits_remaining ?? null
  const cannotAfford =
    mode === 'run' &&
    !isShort &&
    quote?.pricing.affordable === false

  const topic = selectedTopic?.topic ?? ''
  const title = seoPackage?.selectedTitle ?? topic

  const thumbDataUrl = (thumbnailData as any)?.dataUrl as string | undefined

  const submitMutation = useMutation({
    mutationFn: async () => {
      if ((isShort || (shortsCount > 0 && shortsMode === 'separate')) &&
          (shortDuration.loading || shortDuration.error)) {
        throw new Error('Load the channel default or select an explicit Shorts length first.')
      }
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
          duration_seconds: shortDuration.seconds,
          seoTitle:       seoPackage?.selectedTitle || undefined,
          seoDescription: seoPackage?.description   || undefined,
          seoTags:        seoPackage?.tags?.join(', ') || undefined,
          thumbDataUrl:   thumbDataUrl || undefined,
          visualSource: visualSource !== 'stock' ? visualSource : undefined,
          artStyle: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
          imageProvider: visualSource === 'ai_image' ? (imageProvider || undefined) : undefined,
          bgMusicPath: bgMusicPath || undefined,
        })
      } else if (mode === 'queue') {
        // Send the reviewed configuration, not just the topic (F3/R3). `queueApi.add` has accepted a
        // structured `payload` since the queue gained one, and `pipeline.run()` accepts every field
        // below — but this branch passed only the topic, so a creator who wrote a script and designed
        // SEO and a thumbnail watched the scheduler discard all of it and regenerate its own.
        //
        // Keep these keys in step with the Run branch above and with
        // `scheduler.pipeline_kwargs_from_payload()`, which is what reads them back.
        await queueApi.add(topic, channelSlug || undefined, undefined, contentType, {
          scriptText:    scriptContent || undefined,
          seoTitle:      seoPackage?.selectedTitle || undefined,
          seoDescription: seoPackage?.description   || undefined,
          seoTags:       seoPackage?.tags?.join(', ') || undefined,
          thumbDataUrl:  thumbDataUrl || undefined,
          voice_id:      voiceId || undefined,
          shortsCount:   shortsCount || undefined,
          shortsMode:    shortsMode || undefined,
          shorts_duration_seconds: shortDuration.seconds,
        })
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
          shorts_duration_seconds: shortDuration.seconds,
          visualSource: visualSource !== 'stock' ? visualSource : undefined,
          visualCustomVideoPath: visualSource === 'custom_video' ? (visualCustomVideoPath || undefined) : undefined,
          artStyle: visualSource === 'ai_image' ? (artStyle || undefined) : undefined,
          imageProvider: visualSource === 'ai_image' ? (imageProvider || undefined) : undefined,
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
      // 402 = blocked by a billing gate - show the matching upgrade gate
      const detail = err?.response?.data?.detail
      if (err?.response?.status === 402 && detail?.code === 'insufficient_credits') {
        // W8: structured credits 402 from the pre-render gate
        setCreditGate({
          cost_credits: detail.cost_credits,
          credits_remaining: detail.credits_remaining,
          message: detail.message,
        })
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
            ? 'Your vertical Short has started building and will upload to YouTube Shorts automatically. It will appear in Content when it finishes.'
            : mode === 'queue'
            ? 'Your topic has been added to the queue. It will run on the next scheduled slot.'
            : 'Your video pipeline has started. It will appear in Content when it finishes.'}
        </p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate(mode === 'queue' ? '/app/queue' : '/app/studio')}
            className="h-8 px-4 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
          >
            {mode === 'queue' ? 'View Queue' : 'View in Content'}
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

  // ── Credit gate (W8) ─────────────────────────────────────────────────────────
  if (creditGate) {
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
        <h1 className="text-[18px] font-semibold text-[#0A0A0A] mb-2">Not enough credits</h1>
        <p className="text-[13px] text-[#525252] mb-6 max-w-xs">
          {creditGate.message ??
            `This render costs ${creditGate.cost_credits} credits and you have ${creditGate.credits_remaining}.`}{' '}
          Upgrade to <strong>Pro</strong> for 900 credits/month, 5 channels, and all social platforms.
        </p>

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
          to="/app/billing"
          className="text-[12px] text-[#A3A3A3] hover:text-[#525252] transition-colors"
        >
          View billing & usage →
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
              <p className="text-[12px] text-[#525252]">Applied after YouTube finishes processing; check cover status on the job page.</p>
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
                    desc: `AI writes a purpose-built ${shortDuration.seconds}s script with its own hook and payoff.`,
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
              {shortsMode === 'separate' && <div className="mt-3">
                <ShortsDurationSelect value={shortsDurationSeconds} onChange={setShortsDurationSeconds}
                  channelDefault={shortDuration.channelDefault} />
                {shortDuration.error && <p role="alert" className="text-xs text-red-600">Could not load the channel default. Retry or select an explicit length.</p>}
              </div>}
            </div>
          )}
        </div>
      )}

      {/* W8/R7: the pre-render quote — the user knows what this costs before clicking, and the number is
          the one the server's gate will apply (both read the same recipe decision). A *measured* job shows
          a floor with "from", because its clip count is not known until the script exists; quoting a total
          there would be inventing precision. */}
      {(pricedCredits != null || quoteLoading) && (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 border rounded-md mb-3 text-[12px] ${
          cannotAfford
            ? 'bg-red-50 border-red-100 text-red-700'
            : 'bg-[#FAFAFA] border-[#E5E5E5] text-[#525252]'
        }`}>
          <span className="flex items-center gap-1.5">
            <Zap size={12} strokeWidth={1.5} className="flex-shrink-0" />
            {quoteLoading && pricedCredits == null
              ? 'Checking what this job costs…'
              : mode === 'queue' && !isShort
                ? `Queued items spend ${isMeasured ? 'at least ' : ''}${pricedCredits} credits when they render on schedule.`
                : `${isMeasured ? 'From ' : 'Uses '}${pricedCredits} credits${
                    creditsRemaining != null ? ` of your ${creditsRemaining}` : ''}${
                    isMeasured ? ' — the final total depends on the render' : ''}`}
          </span>
          {cannotAfford && (
            <Link to="/app/billing" className="text-[12px] font-medium underline hover:opacity-80 flex-shrink-0">
              Upgrade
            </Link>
          )}
        </div>
      )}

      {/* A blocker the server already knows about (a revoked channel, a missing credential). Shown before
          the button rather than after it fails, because the alternative is discovering it once the
          expensive work has started. */}
      {!!quote?.readiness.blockers.length && (
        <div className="flex items-start gap-2 px-3 py-2 border border-amber-200 bg-amber-50 text-amber-800 rounded-md mb-3 text-[12px]">
          <span>
            {quote.readiness.blockers[0]?.error || 'This configuration is not ready to run yet.'}
          </span>
        </div>
      )}

      <button
        onClick={() => submitMutation.mutate()}
        disabled={submitMutation.isPending || !topic || cannotAfford}
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
