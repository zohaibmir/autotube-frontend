import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ArrowLeft, ArrowRight, Tv, Clapperboard, Music, Sparkles, Loader,
} from 'lucide-react'
import { useChannels, useCreateJob } from '@hooks/useJobs'

// ── Types ─────────────────────────────────────────────────────────────────────
interface JobConfig {
  channel_id: string
  channel_slug: string
  type: string
  topic: string
  language: string
  duration: string
  style: string
}

const CONTENT_TYPES = [
  { id: 'youtube_short', label: 'YouTube Short', desc: 'Vertical 60 s — great for reach', icon: <Sparkles size={18} strokeWidth={1.5} /> },
  { id: 'youtube_long',  label: 'YouTube Long',  desc: 'Full 5–15 min educational video', icon: <Tv size={18} strokeWidth={1.5} /> },
  { id: 'tiktok',        label: 'TikTok',        desc: 'Short-form vertical for TikTok',  icon: <Music size={18} strokeWidth={1.5} /> },
  { id: 'reel',          label: 'Instagram Reel', desc: 'Reels for Instagram distribution', icon: <Clapperboard size={18} strokeWidth={1.5} /> },
]

const LANGUAGES = ['English', 'Arabic', 'Urdu', 'Spanish', 'French', 'Hindi', 'German']
const DURATIONS = ['30s', '60s', '3 min', '5 min', '10 min', '15 min']
const STYLES    = ['Educational', 'Storytelling', 'Q&A', 'Documentary', 'Kids Animated']

const STEPS = ['Channel', 'Content Type', 'Configure', 'Review']

// ── Step indicator ─────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex items-center mb-10">
      {STEPS.map((label, idx) => {
        const done   = idx < current
        const active = idx === current
        return (
          <React.Fragment key={label}>
            <li className="flex flex-col items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                done   ? 'bg-[#0A0A0A] text-white'
                : active ? 'bg-[#0A0A0A] text-white ring-4 ring-[#E5E5E5]'
                : 'bg-[#F5F5F5] text-[#A3A3A3] border border-[#E5E5E5]'
              }`}>
                {done ? <Check size={13} strokeWidth={2.5} /> : idx + 1}
              </div>
              <span className={`mt-1.5 text-[11px] font-medium whitespace-nowrap ${
                active ? 'text-[#0A0A0A]' : done ? 'text-[#525252]' : 'text-[#A3A3A3]'
              }`}>{label}</span>
            </li>
            {idx < STEPS.length - 1 && (
              <div className={`flex-1 h-px mx-3 mb-4 transition-colors ${done ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]'}`} />
            )}
          </React.Fragment>
        )
      })}
    </ol>
  )
}

// ── Step 1: Channel ────────────────────────────────────────────────────────────
function StepChannel({ config, setConfig }: { config: JobConfig; setConfig: (c: JobConfig) => void }) {
  const { data: channels = [], isLoading } = useChannels()
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">Step 1</p>
      <h2 className="text-lg font-semibold text-[#0A0A0A] mb-1">Select a channel</h2>
      <p className="text-sm text-[#A3A3A3] mb-6">Choose the YouTube channel to publish this video to.</p>
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader size={18} strokeWidth={1.5} className="text-[#D4D4D4] animate-spin" />
        </div>
      ) : channels.length === 0 ? (
        <p className="text-sm text-[#A3A3A3] text-center py-10">
          No channels found. Add a channel in{' '}
          <a href="/app/channels" className="text-[#0A0A0A] underline">Channels</a> first.
        </p>
      ) : (
        <div className="space-y-2">
          {channels.map((ch: any) => {
            const slug = ch.slug || ch.id
            const selected = config.channel_slug === slug
            return (
              <button
                key={slug}
                onClick={() => setConfig({ ...config, channel_id: slug, channel_slug: slug })}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-md border text-left transition-colors ${
                  selected ? 'border-[#0A0A0A] bg-[#FAFAFA]' : 'border-[#E5E5E5] hover:border-[#A3A3A3] bg-white'
                }`}
              >
                <div className="w-9 h-9 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                  {(ch.name || slug)[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0A0A0A] truncate">{ch.name || slug}</p>
                  <p className="text-xs text-[#A3A3A3]">{slug}</p>
                </div>
                {selected && <Check size={15} strokeWidth={2.5} className="text-[#0A0A0A] flex-shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Step 2: Content Type ───────────────────────────────────────────────────────
function StepContentType({ config, setConfig }: { config: JobConfig; setConfig: (c: JobConfig) => void }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">Step 2</p>
      <h2 className="text-lg font-semibold text-[#0A0A0A] mb-1">Content type</h2>
      <p className="text-sm text-[#A3A3A3] mb-6">What kind of video do you want to generate?</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {CONTENT_TYPES.map((ct) => {
          const selected = config.type === ct.id
          return (
            <button
              key={ct.id}
              onClick={() => setConfig({ ...config, type: ct.id })}
              className={`flex items-start gap-3 px-4 py-4 rounded-md border text-left transition-colors ${
                selected ? 'border-[#0A0A0A] bg-[#FAFAFA]' : 'border-[#E5E5E5] hover:border-[#A3A3A3] bg-white'
              }`}
            >
              <span className={`mt-0.5 ${selected ? 'text-[#0A0A0A]' : 'text-[#A3A3A3]'}`}>{ct.icon}</span>
              <div>
                <p className="text-sm font-medium text-[#0A0A0A]">{ct.label}</p>
                <p className="text-xs text-[#A3A3A3] mt-0.5">{ct.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Step 3: Configure ──────────────────────────────────────────────────────────
function StepConfigure({ config, setConfig }: { config: JobConfig; setConfig: (c: JobConfig) => void }) {
  const inputCls = 'w-full bg-white border border-[#E5E5E5] rounded-md px-3 py-2.5 text-sm text-[#0A0A0A] placeholder-[#D4D4D4] focus:outline-none focus:border-[#0A0A0A] transition-colors'
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">Step 3</p>
      <h2 className="text-lg font-semibold text-[#0A0A0A] mb-1">Configure video</h2>
      <p className="text-sm text-[#A3A3A3] mb-6">Set the topic and style.</p>
      <div className="space-y-4 max-w-lg">
        <div>
          <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase block mb-1.5">
            Topic <span className="text-[#DC2626] normal-case tracking-normal font-normal">*</span>
          </label>
          <input
            type="text"
            value={config.topic}
            onChange={(e) => setConfig({ ...config, topic: e.target.value })}
            placeholder="e.g. The water cycle explained for kids"
            className={inputCls}
          />
        </div>
        {([
          { label: 'Language', key: 'language' as const, options: LANGUAGES },
          { label: 'Duration', key: 'duration' as const, options: DURATIONS },
          { label: 'Style',    key: 'style'    as const, options: STYLES },
        ] as const).map(({ label, key, options }) => (
          <div key={key}>
            <label className="text-[11px] font-medium tracking-widest text-[#A3A3A3] uppercase block mb-1.5">{label}</label>
            <select
              value={config[key]}
              onChange={(e) => setConfig({ ...config, [key]: e.target.value })}
              className={`${inputCls} appearance-none`}
            >
              <option value="">Select {label}</option>
              {options.map((o) => <option key={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Step 4: Review ─────────────────────────────────────────────────────────────
function StepReview({ config }: { config: JobConfig }) {
  const contentLabel = CONTENT_TYPES.find((c) => c.id === config.type)?.label || config.type
  const rows = [
    ['Channel',      config.channel_slug || '—'],
    ['Content Type', contentLabel],
    ['Topic',        config.topic],
    ['Language',     config.language],
    ['Duration',     config.duration],
    ['Style',        config.style],
  ]
  return (
    <div>
      <p className="text-xs font-medium tracking-widest text-[#A3A3A3] uppercase mb-1">Step 4</p>
      <h2 className="text-lg font-semibold text-[#0A0A0A] mb-1">Review &amp; submit</h2>
      <p className="text-sm text-[#A3A3A3] mb-6">Check your configuration before queuing the job.</p>
      <div className="border border-[#E5E5E5] rounded-md divide-y divide-[#F5F5F5] overflow-hidden">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-[#A3A3A3]">{label}</span>
            <span className="text-sm font-medium text-[#0A0A0A]">
              {value || <span className="text-[#D4D4D4]">—</span>}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs text-[#A3A3A3] mt-4">
        Once submitted, the job will be queued and start processing within seconds.
      </p>
    </div>
  )
}

// ── Wizard root ────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: JobConfig = {
  channel_id: '', channel_slug: '', type: '',
  topic: '', language: 'English', duration: '60s', style: 'Educational',
}

export default function NewJob() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [config, setConfig] = useState<JobConfig>(DEFAULT_CONFIG)
  const { mutate: createJob, isPending: submitting } = useCreateJob()

  const canAdvance = () => {
    if (step === 0) return !!config.channel_id
    if (step === 1) return !!config.type
    if (step === 2) return !!config.topic.trim() && !!config.language && !!config.duration && !!config.style
    return true
  }

  const handleSubmit = () => {
    createJob(
      {
        channel_slug: config.channel_slug,
        topic: config.topic,
        language: config.language.toLowerCase(),
        duration_hint: config.duration,
        style: config.style.toLowerCase(),
        type: config.type,
      },
      {
        onSuccess: () => navigate('/app/jobs'),
        onError:   () => navigate('/app/jobs'),
      }
    )
  }

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => (step === 0 ? navigate('/app/jobs') : setStep(step - 1))}
        className="inline-flex items-center gap-1.5 text-sm text-[#A3A3A3] hover:text-[#0A0A0A] mb-6 transition-colors"
      >
        <ArrowLeft size={15} strokeWidth={1.5} />
        {step === 0 ? 'Back to Jobs' : 'Previous step'}
      </button>

      <div className="bg-white rounded-md border border-[#E5E5E5] p-8">
        <StepIndicator current={step} />

        {step === 0 && <StepChannel      config={config} setConfig={setConfig} />}
        {step === 1 && <StepContentType  config={config} setConfig={setConfig} />}
        {step === 2 && <StepConfigure    config={config} setConfig={setConfig} />}
        {step === 3 && <StepReview       config={config} />}

        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#F5F5F5]">
          <button
            onClick={() => step > 0 && setStep(step - 1)}
            disabled={step === 0}
            className="px-4 py-2 border border-[#E5E5E5] text-[#525252] rounded-md text-sm font-medium disabled:opacity-30 hover:border-[#A3A3A3] transition-colors"
          >
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!canAdvance()}
              className="bg-[#0A0A0A] hover:bg-[#262626] disabled:bg-[#D4D4D4] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
            >
              Next <ArrowRight size={14} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !canAdvance()}
              className="bg-[#0A0A0A] hover:bg-[#262626] disabled:bg-[#D4D4D4] text-white px-5 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition-colors"
            >
              {submitting
                ? <><Loader size={14} strokeWidth={1.5} className="animate-spin" /> Submitting...</>
                : <><Sparkles size={14} strokeWidth={1.5} /> Create Job</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
