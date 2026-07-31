import React, { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, ChevronRight, Loader2, Check, X, Plus, Trash2,
  ExternalLink, RefreshCw, AlertCircle, Music2, Mic, User, Image,
  ChevronDown, ChevronUp, Wand2,
} from 'lucide-react'
import { kidsApi, characterApi, channelsApi } from '@api/services'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | 'setup'
  | 'gen_loading'
  | 'review'
  | 'media_loading'
  | 'publish_form'
  | 'publishing'
  | 'done'

type PageTab = 'video' | 'characters'

interface GenData {
  status: string
  step: string
  message?: string
  title?: string
  suno_prompt?: string
  kling_prompt?: {
    consistency_lock?: string
    animation_style?: string
    main_character?: string
    world_description?: string
    segments?: { segment_number: number; narration: string; visual_keyword: string }[]
  }
  result?: Record<string, any>
  youtube_url?: string
  error?: string
  character_profile_name?: string
}

interface CharProfile {
  id: number
  channel_slug: string
  profile_name: string
  style_lock?: string
  world_lock?: string
  character_lock?: string
  continuity_notes?: string
  image_data_url?: string
  is_active?: boolean
}

// ── Step indicator data ───────────────────────────────────────────────────────

const STEPS = [
  { label: 'Setup', phases: ['setup'] },
  { label: 'Review Prompts', phases: ['gen_loading', 'review'] },
  { label: 'Generate Media', phases: ['media_loading'] },
  { label: 'Publish', phases: ['publish_form', 'publishing', 'done'] },
]

const MEDIA_STEPS: Record<string, string> = {
  claude: 'Writing script & animation prompts',
  audio: 'Creating song / narration',
  kling: 'Generating animation (Kling AI)',
  compose: 'Composing final video',
  reel: 'Building vertical reel',
  media_ready: 'Video ready!',
  upload: 'Uploading to YouTube',
  done: 'Published!',
}

const MEDIA_STEP_ORDER = ['audio', 'kling', 'compose', 'reel']

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepIndex(phase: Phase): number {
  return STEPS.findIndex(s => s.phases.includes(phase))
}

function cn(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

// ── Step Nav ─────────────────────────────────────────────────────────────────

function StepNav({ phase }: { phase: Phase }) {
  const current = stepIndex(phase)
  return (
    <div className="flex items-center gap-0 mb-5">
      {STEPS.map((step, i) => {
        const done    = i < current
        const active  = i === current
        const pending = i > current
        return (
          <React.Fragment key={step.label}>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold border transition-colors',
                  done    && 'bg-[#0A0A0A] border-[#0A0A0A] text-white',
                  active  && 'bg-white border-[#0A0A0A] text-[#0A0A0A]',
                  pending && 'bg-white border-[#D4D4D4] text-[#A3A3A3]',
                )}
              >
                {done ? <Check size={9} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={cn(
                'text-[11px] font-medium',
                active  && 'text-[#0A0A0A]',
                done    && 'text-[#525252]',
                pending && 'text-[#A3A3A3]',
              )}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-px mx-2',
                i < current ? 'bg-[#0A0A0A]' : 'bg-[#E5E5E5]',
              )} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ── Setup Form ────────────────────────────────────────────────────────────────

function SetupForm({
  channels,
  onSubmit,
  loading,
}: {
  channels: any[]
  onSubmit: (form: SetupValues) => void
  loading: boolean
}) {
  const [form, setForm] = useState<SetupValues>({
    title: '', style: 'bright kids-friendly animation',
    outline: '', channel: '', audioMode: 'music',
  })

  const set = (k: keyof SetupValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Title */}
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-[#525252] mb-1">
            Video title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.title}
            onChange={set('title')}
            placeholder="e.g. Wheels on the Bus, Old MacDonald, Twinkle Twinkle"
            className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder-[#A3A3A3]"
          />
        </div>

        {/* Style */}
        <div>
          <label className="block text-[11px] font-medium text-[#525252] mb-1">Animation style</label>
          <input
            type="text"
            value={form.style}
            onChange={set('style')}
            placeholder="bright kids-friendly animation"
            className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder-[#A3A3A3]"
          />
        </div>

        {/* Channel */}
        <div>
          <label className="block text-[11px] font-medium text-[#525252] mb-1">Channel</label>
          <select
            value={form.channel}
            onChange={set('channel')}
            className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            <option value="">Default channel</option>
            {channels.map(c => <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>)}
          </select>
        </div>

        {/* Audio mode */}
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-[#525252] mb-1">Audio type</label>
          <div className="flex gap-2">
            {[
              { value: 'music', icon: Music2, label: 'Song', desc: 'AI-generated music via Suno / Mureka' },
              { value: 'voice', icon: Mic,    label: 'Narration', desc: 'TTS voice narration (ElevenLabs / Edge TTS)' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setForm(p => ({ ...p, audioMode: opt.value }))}
                className={cn(
                  'flex-1 flex items-center gap-2.5 p-3 rounded-md border text-left transition-colors',
                  form.audioMode === opt.value
                    ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                    : 'border-[#E5E5E5] bg-white hover:border-[#D4D4D4]',
                )}
              >
                <opt.icon size={14} strokeWidth={1.5} className={form.audioMode === opt.value ? 'text-[#0A0A0A]' : 'text-[#A3A3A3]'} />
                <div>
                  <p className="text-[12px] font-medium text-[#0A0A0A]">{opt.label}</p>
                  <p className="text-[10px] text-[#A3A3A3]">{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Outline */}
        <div className="col-span-2">
          <label className="block text-[11px] font-medium text-[#525252] mb-1">
            Outline <span className="text-[#A3A3A3] font-normal">(optional — helps Claude include all animals/verses)</span>
          </label>
          <textarea
            value={form.outline}
            onChange={set('outline')}
            rows={2}
            placeholder="e.g. Old MacDonald with cow (moo), pig (oink), duck (quack), sheep (baa), horse (neigh), chicken (cluck)"
            className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder-[#A3A3A3] resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <p className="text-[11px] text-[#A3A3A3]">Claude will generate song lyrics + {'>'}24 animation segments</p>
        <button
          onClick={() => form.title.trim() && onSubmit(form)}
          disabled={loading || !form.title.trim()}
          className="flex items-center gap-2 h-9 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
        >
          {loading
            ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            : <Sparkles size={13} strokeWidth={1.5} />
          }
          Generate Prompts
        </button>
      </div>
    </div>
  )
}

interface SetupValues {
  title: string
  style: string
  outline: string
  channel: string
  audioMode: string
}

// ── Loading Card ──────────────────────────────────────────────────────────────

function LoadingCard({ message, onCancel }: { message: string; onCancel?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-3">
      <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-[#525252]" />
      <p className="text-[13px] text-[#525252]">{message}</p>
      {onCancel && (
        <button onClick={onCancel} className="text-[11px] text-[#A3A3A3] hover:text-[#525252] mt-1">
          Cancel
        </button>
      )}
    </div>
  )
}

// ── Error Card ────────────────────────────────────────────────────────────────

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <AlertCircle size={22} strokeWidth={1.5} className="text-red-400" />
      <p className="text-[13px] text-[#0A0A0A] text-center max-w-sm">{message}</p>
      <button
        onClick={onRetry}
        className="flex items-center gap-1.5 h-8 px-4 border border-[#E5E5E5] text-[12px] text-[#525252] rounded hover:border-[#D4D4D4] transition-colors"
      >
        <RefreshCw size={12} strokeWidth={1.5} /> Try again
      </button>
    </div>
  )
}

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({
  genData,
  onApprove,
  onBack,
  approving,
}: {
  genData: GenData
  onApprove: () => void
  onBack: () => void
  approving: boolean
}) {
  const [showSegments, setShowSegments] = useState(false)
  const segments = genData.kling_prompt?.segments ?? []
  const kp = genData.kling_prompt

  return (
    <div className="space-y-4">
      {/* Character profile used */}
      {genData.character_profile_name && (
        <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 border border-purple-100 rounded-md">
          <User size={12} strokeWidth={1.5} className="text-purple-600" />
          <p className="text-[11px] text-purple-700 font-medium">
            Character profile applied: <span className="font-semibold">{genData.character_profile_name}</span>
          </p>
        </div>
      )}

      {/* Song / Narration prompt */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-medium text-[#525252] uppercase tracking-wide">
            Song / Narration Script
          </p>
          <span className="text-[10px] text-[#A3A3A3]">{segments.length} animation segments</span>
        </div>
        <textarea
          readOnly
          value={genData.suno_prompt ?? ''}
          rows={6}
          className="w-full px-3 py-2 text-[12px] text-[#0A0A0A] bg-[#FAFAFA] border border-[#E5E5E5] rounded-md resize-none font-mono leading-relaxed"
        />
        <p className="text-[10px] text-[#A3A3A3] mt-1">
          This script will be sent to Suno/Mureka for AI music generation. Read-only — regenerate to change.
        </p>
      </div>

      {/* Animation info */}
      {kp && (
        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
          <div className="px-3 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5]">
            <p className="text-[11px] font-medium text-[#525252] uppercase tracking-wide">Animation Plan</p>
          </div>
          <div className="p-3 space-y-2 text-[12px]">
            {kp.animation_style && (
              <div className="flex gap-2">
                <span className="text-[#A3A3A3] w-20 flex-shrink-0">Style</span>
                <span className="text-[#0A0A0A]">{kp.animation_style}</span>
              </div>
            )}
            {kp.main_character && (
              <div className="flex gap-2">
                <span className="text-[#A3A3A3] w-20 flex-shrink-0">Characters</span>
                <span className="text-[#0A0A0A]">{kp.main_character}</span>
              </div>
            )}
            {kp.world_description && (
              <div className="flex gap-2">
                <span className="text-[#A3A3A3] w-20 flex-shrink-0">World</span>
                <span className="text-[#0A0A0A]">{kp.world_description}</span>
              </div>
            )}
            {segments.length > 0 && (
              <div>
                <button
                  onClick={() => setShowSegments(v => !v)}
                  className="flex items-center gap-1 text-[#525252] hover:text-[#0A0A0A] transition-colors mt-1"
                >
                  {showSegments ? <ChevronUp size={12} strokeWidth={1.5} /> : <ChevronDown size={12} strokeWidth={1.5} />}
                  {showSegments ? 'Hide' : 'Preview'} all {segments.length} segments
                </button>
                {showSegments && (
                  <div className="mt-2 max-h-48 overflow-y-auto space-y-1 pr-1">
                    {segments.map(seg => (
                      <div key={seg.segment_number} className="flex gap-2 text-[11px] py-1 border-b border-[#F5F5F5]">
                        <span className="text-[#A3A3A3] w-6 flex-shrink-0 font-mono">{seg.segment_number}.</span>
                        <div>
                          <p className="text-[#525252] italic">{seg.narration}</p>
                          <p className="text-[#0A0A0A] mt-0.5">{seg.visual_keyword?.slice(0, 120)}{(seg.visual_keyword?.length ?? 0) > 120 ? '…' : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cost warning */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-100 rounded-md">
        <AlertCircle size={12} strokeWidth={1.5} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-amber-700">
          Approving will generate audio (Suno/Mureka) and animation (Kling AI) — this consumes API credits.
          Review carefully before proceeding.
        </p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[12px] text-[#A3A3A3] hover:text-[#525252] transition-colors"
        >
          <ChevronRight size={12} strokeWidth={1.5} className="rotate-180" /> Regenerate
        </button>
        <button
          onClick={onApprove}
          disabled={approving}
          className="flex items-center gap-2 h-9 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
        >
          {approving
            ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            : <Check size={13} strokeWidth={1.5} />
          }
          Approve & Create Video
        </button>
      </div>
    </div>
  )
}

// ── Media Progress Card ───────────────────────────────────────────────────────

function MediaProgressCard({ genData }: { genData: GenData }) {
  const currentStep = genData.step ?? ''
  const currentIdx = MEDIA_STEP_ORDER.indexOf(currentStep)

  return (
    <div className="py-4 space-y-5">
      <div className="flex flex-col gap-3">
        {MEDIA_STEP_ORDER.map((step, i) => {
          const done    = i < currentIdx || currentStep === 'media_ready'
          const active  = step === currentStep
          const pending = !done && !active
          return (
            <div key={step} className="flex items-center gap-3">
              <span className={cn(
                'inline-flex items-center justify-center w-6 h-6 rounded-full border transition-colors',
                done    && 'bg-[#0A0A0A] border-[#0A0A0A]',
                active  && 'border-[#0A0A0A] bg-white',
                pending && 'border-[#E5E5E5] bg-white',
              )}>
                {done
                  ? <Check size={11} strokeWidth={2.5} className="text-white" />
                  : active
                  ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin text-[#0A0A0A]" />
                  : <span className="w-1.5 h-1.5 rounded-full bg-[#D4D4D4]" />
                }
              </span>
              <span className={cn(
                'text-[13px]',
                done    && 'text-[#525252]',
                active  && 'text-[#0A0A0A] font-medium',
                pending && 'text-[#A3A3A3]',
              )}>
                {MEDIA_STEPS[step] ?? step}
              </span>
            </div>
          )
        })}
      </div>

      {genData.message && (
        <p className="text-[12px] text-[#A3A3A3] text-center">{genData.message}</p>
      )}
      <p className="text-[11px] text-[#A3A3A3] text-center">
        This can take 3–8 minutes. You can leave this page — the job runs in the background.
      </p>
    </div>
  )
}

// ── Publish Form ──────────────────────────────────────────────────────────────

function PublishForm({
  genData,
  channels,
  onPublish,
  publishing,
}: {
  genData: GenData
  channels: any[]
  onPublish: (form: PublishValues) => void
  publishing: boolean
}) {
  const result = genData.result ?? {}
  const [form, setForm] = useState<PublishValues>({
    title: genData.title ?? result.title ?? '',
    description: result.description ?? '',
    tags: result.tags ?? '',
    channel: genData.result?.channel ?? '',
  })

  const set = (k: keyof PublishValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 px-3 py-2.5 bg-green-50 border border-green-100 rounded-md">
        <Check size={12} strokeWidth={1.5} className="text-green-600 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-green-700 font-medium">
          Video generated successfully. Review the metadata below and upload to YouTube.
        </p>
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#525252] mb-1">YouTube Title</label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
        />
      </div>

      <div>
        <label className="block text-[11px] font-medium text-[#525252] mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={set('description')}
          rows={4}
          className="w-full px-3 py-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors resize-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-[11px] font-medium text-[#525252] mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={form.tags}
            onChange={set('tags')}
            className="w-full h-9 px-3 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-[#525252] mb-1">Channel</label>
          <select
            value={form.channel}
            onChange={set('channel')}
            className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            <option value="">Default channel</option>
            {channels.map(c => <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1">
        <button
          onClick={() => onPublish(form)}
          disabled={publishing || !form.title.trim()}
          className="flex items-center gap-2 h-9 px-6 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
        >
          {publishing
            ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            : <ChevronRight size={13} strokeWidth={1.5} />
          }
          Upload to YouTube
        </button>
      </div>
    </div>
  )
}

interface PublishValues {
  title: string
  description: string
  tags: string
  channel: string
}

// ── Success Card ──────────────────────────────────────────────────────────────

function SuccessCard({ genData, onNew }: { genData: GenData; onNew: () => void }) {
  return (
    <div className="flex flex-col items-center py-10 gap-4">
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
        <Check size={18} strokeWidth={2} className="text-green-600" />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold text-[#0A0A0A]">Published to YouTube!</p>
        <p className="text-[12px] text-[#A3A3A3] mt-1">{genData.title}</p>
      </div>
      {genData.youtube_url && (
        <a
          href={genData.youtube_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-8 px-4 border border-[#E5E5E5] text-[12px] text-[#525252] rounded-md hover:border-[#D4D4D4] transition-colors"
        >
          <ExternalLink size={12} strokeWidth={1.5} /> View on YouTube
        </a>
      )}
      <button
        onClick={onNew}
        className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] rounded-md hover:bg-[#262626] transition-colors"
      >
        <Plus size={12} strokeWidth={1.5} /> New Video
      </button>
    </div>
  )
}

// ── Character Card ────────────────────────────────────────────────────────────

function CharCard({
  profile,
  channelSlug,
  onEdit,
  onToggleActive,
  onDelete,
  isActive,
}: {
  profile: CharProfile
  channelSlug: string
  onEdit: () => void
  onToggleActive: () => void
  onDelete: () => void
  isActive: boolean
}) {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-lg overflow-hidden hover:border-[#D4D4D4] transition-colors">
      {/* Image */}
      <div className="relative w-full aspect-square bg-[#F5F5F5] flex items-center justify-center overflow-hidden">
        {profile.image_data_url ? (
          <img src={profile.image_data_url} alt={profile.profile_name} className="w-full h-full object-cover" />
        ) : (
          <User size={28} strokeWidth={1} className="text-[#D4D4D4]" />
        )}
        {isActive && (
          <span className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[9px] font-medium px-1.5 py-0.5 rounded-full">
            Active
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-2.5">
        <p className="text-[12px] font-semibold text-[#0A0A0A] truncate">{profile.profile_name}</p>
        {profile.character_lock && (
          <p className="text-[10px] text-[#A3A3A3] truncate mt-0.5">{profile.character_lock}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex border-t border-[#F5F5F5]">
        <button
          onClick={onToggleActive}
          title={isActive ? 'Deactivate' : 'Set as active'}
          className={cn(
            'flex-1 py-1.5 text-[10px] font-medium transition-colors',
            isActive
              ? 'text-green-600 hover:bg-green-50'
              : 'text-[#A3A3A3] hover:bg-[#F5F5F5] hover:text-[#525252]',
          )}
        >
          {isActive ? 'Active' : 'Activate'}
        </button>
        <button
          onClick={onEdit}
          className="flex-1 py-1.5 text-[10px] text-[#525252] hover:bg-[#F5F5F5] transition-colors border-l border-[#F5F5F5]"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="py-1.5 px-2.5 text-[#A3A3A3] hover:bg-red-50 hover:text-red-600 transition-colors border-l border-[#F5F5F5]"
        >
          <Trash2 size={10} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

// ── Character Edit Panel ──────────────────────────────────────────────────────

function CharEditPanel({
  profile,
  channelSlug,
  onSave,
  onClose,
  onGenerateImage,
  saving,
  generatingImage,
}: {
  profile: CharProfile | null
  channelSlug: string
  onSave: (data: Partial<CharProfile>) => void
  onClose: () => void
  onGenerateImage: (characterLock: string, styleLock: string) => void
  saving: boolean
  generatingImage: boolean
}) {
  const isNew = !profile?.id
  const [form, setForm] = useState({
    profile_name: profile?.profile_name ?? '',
    character_lock: profile?.character_lock ?? '',
    style_lock: profile?.style_lock ?? '',
    world_lock: profile?.world_lock ?? '',
    continuity_notes: profile?.continuity_notes ?? '',
  })

  // Reset form when profile changes
  useEffect(() => {
    setForm({
      profile_name: profile?.profile_name ?? '',
      character_lock: profile?.character_lock ?? '',
      style_lock: profile?.style_lock ?? '',
      world_lock: profile?.world_lock ?? '',
      continuity_notes: profile?.continuity_notes ?? '',
    })
  }, [profile?.id])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-l border-[#E5E5E5] flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-semibold text-[#0A0A0A]">
          {isNew ? 'New Character' : 'Edit Character'}
        </p>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] rounded transition-colors"
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Character image preview */}
        {profile?.image_data_url && (
          <div className="w-full aspect-square rounded-md overflow-hidden bg-[#F5F5F5]">
            <img src={profile.image_data_url} alt="Character" className="w-full h-full object-cover" />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">Name</label>
          <input
            type="text"
            value={form.profile_name}
            onChange={set('profile_name')}
            placeholder="e.g. Ayra"
            className="w-full h-8 px-2.5 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">Character appearance</label>
          <textarea
            value={form.character_lock}
            onChange={set('character_lock')}
            rows={3}
            placeholder="e.g. 3-year-old girl, curly brown hair, coral sweater, bright eyes"
            className="w-full px-2.5 py-1.5 text-[11px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">Animation style</label>
          <textarea
            value={form.style_lock}
            onChange={set('style_lock')}
            rows={2}
            placeholder="e.g. Pixar-style 3D animation, warm lighting, bright colors"
            className="w-full px-2.5 py-1.5 text-[11px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">World / setting</label>
          <textarea
            value={form.world_lock}
            onChange={set('world_lock')}
            rows={2}
            placeholder="e.g. colorful classroom, sunny playground, magical forest"
            className="w-full px-2.5 py-1.5 text-[11px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">Continuity notes</label>
          <textarea
            value={form.continuity_notes}
            onChange={set('continuity_notes')}
            rows={2}
            placeholder="e.g. always wears red shoes, has a pet dog named Biscuit"
            className="w-full px-2.5 py-1.5 text-[11px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors resize-none"
          />
        </div>

        {/* Generate image */}
        {form.character_lock && (
          <button
            onClick={() => onGenerateImage(form.character_lock, form.style_lock)}
            disabled={generatingImage}
            className="w-full flex items-center justify-center gap-1.5 h-8 border border-[#E5E5E5] text-[11px] text-[#525252] rounded hover:border-[#D4D4D4] disabled:opacity-40 transition-colors"
          >
            {generatingImage
              ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
              : <Image size={11} strokeWidth={1.5} />
            }
            {profile?.image_data_url ? 'Regenerate image' : 'Generate character image'}
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-t border-[#E5E5E5]">
        <button
          onClick={() => onSave(form)}
          disabled={saving || !form.profile_name.trim()}
          className="w-full flex items-center justify-center gap-1.5 h-8 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
        >
          {saving
            ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
            : <Check size={11} strokeWidth={1.5} />
          }
          {isNew ? 'Create Character' : 'Save Changes'}
        </button>
      </div>
    </aside>
  )
}

// ── AI Generate Character Modal ───────────────────────────────────────────────

function AIGenerateModal({
  onGenerate,
  onClose,
  loading,
}: {
  onGenerate: (params: any) => void
  onClose: () => void
  loading: boolean
}) {
  const [form, setForm] = useState({ characterName: '', characterDescription: '', age: '', personality: '' })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-[90vw]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E5E5E5]">
          <p className="text-[14px] font-semibold text-[#0A0A0A]">AI Generate Character</p>
          <button onClick={onClose} className="text-[#A3A3A3] hover:text-[#0A0A0A]">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-[11px] text-[#525252] mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.characterName} onChange={set('characterName')}
              placeholder="e.g. Ayra"
              className="w-full h-8 px-2.5 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]" />
          </div>
          <div>
            <label className="block text-[11px] text-[#525252] mb-1">Description <span className="text-red-500">*</span></label>
            <textarea value={form.characterDescription} onChange={set('characterDescription')} rows={2}
              placeholder="e.g. A curious 3-year-old girl who loves animals and singing"
              className="w-full px-2.5 py-1.5 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] text-[#525252] mb-1">Age</label>
              <input type="text" value={form.age} onChange={set('age')} placeholder="e.g. 3 years"
                className="w-full h-8 px-2.5 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]" />
            </div>
            <div>
              <label className="block text-[11px] text-[#525252] mb-1">Personality</label>
              <input type="text" value={form.personality} onChange={set('personality')} placeholder="e.g. playful, brave"
                className="w-full h-8 px-2.5 text-[12px] border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-[#E5E5E5]">
          <button onClick={onClose} className="h-8 px-4 text-[12px] text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onGenerate(form)}
            disabled={loading || !form.characterName.trim() || !form.characterDescription.trim()}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <Wand2 size={11} strokeWidth={1.5} />}
            Generate with Claude
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function KidsPage() {
  const qc = useQueryClient()

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<PageTab>('video')

  // ── Video wizard state ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('setup')
  const [genId, setGenId] = useState<string | null>(null)
  const [genData, setGenData] = useState<GenData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [approving, setApproving] = useState(false)
  const [publishing, setPublishing] = useState(false)

  // ── Characters state ───────────────────────────────────────────────────────
  const [charChannel, setCharChannel] = useState('')
  const [editChar, setEditChar] = useState<CharProfile | null | 'new'>('new' as any)
  const [showEditPanel, setShowEditPanel] = useState(false)
  const [charSaving, setCharSaving] = useState(false)
  const [charGeneratingImage, setCharGeneratingImage] = useState(false)
  const [showAIModal, setShowAIModal] = useState(false)
  const [aiGenerating, setAIGenerating] = useState(false)

  // ── Shared data ────────────────────────────────────────────────────────────
  const { data: channelsData } = useQuery({ queryKey: ['channels'], queryFn: channelsApi.list })
  const channels: any[] = channelsData ?? []

  const { data: charData, refetch: refetchChars } = useQuery({
    queryKey: ['character-profiles', charChannel],
    queryFn: () => characterApi.list(charChannel || ''),
    enabled: tab === 'characters',
  })
  const profiles: CharProfile[] = charData ?? []

  // ── Polling ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!genId) return
    if (phase !== 'gen_loading' && phase !== 'media_loading' && phase !== 'publishing') return

    const interval = setInterval(async () => {
      try {
        const data: GenData = await kidsApi.poll(genId)
        setGenData(data)

        if (data.status === 'failed') {
          setError(data.message ?? data.error ?? 'Generation failed')
          setPhase('setup')
          clearInterval(interval)
          return
        }
        if (phase === 'gen_loading' && data.status === 'prompts_ready') {
          setPhase('review')
          clearInterval(interval)
        } else if (phase === 'media_loading' && data.status === 'media_ready') {
          setPhase('publish_form')
          clearInterval(interval)
        } else if (phase === 'publishing' && data.status === 'published') {
          setPhase('done')
          clearInterval(interval)
        }
      } catch (e) {
        // transient — keep polling
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [genId, phase])

  // ── Handlers — Video ───────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (form: SetupValues) => {
    setError(null)
    setPhase('gen_loading')
    try {
      const res = await kidsApi.generate({
        title: form.title,
        style: form.style,
        outline: form.outline,
        channel: form.channel,
        audioMode: form.audioMode,
      })
      if (!res.ok || !res.gen_id) throw new Error(res.error ?? 'No gen_id returned')
      setGenId(res.gen_id)
    } catch (e: any) {
      setError(e.message ?? 'Failed to start generation')
      setPhase('setup')
    }
  }, [])

  const handleApprove = useCallback(async () => {
    if (!genId) return
    setApproving(true)
    try {
      await kidsApi.approve(genId)
      setPhase('media_loading')
    } catch (e: any) {
      setError(e.message ?? 'Approve failed')
    } finally {
      setApproving(false)
    }
  }, [genId])

  const handlePublish = useCallback(async (form: PublishValues) => {
    if (!genId) return
    setPublishing(true)
    try {
      await kidsApi.publish({ genId, ...form })
      setPhase('publishing')
    } catch (e: any) {
      setError(e.message ?? 'Publish failed')
    } finally {
      setPublishing(false)
    }
  }, [genId])

  const handleReset = useCallback(() => {
    setPhase('setup')
    setGenId(null)
    setGenData(null)
    setError(null)
  }, [])

  // ── Handlers — Characters ──────────────────────────────────────────────────
  const handleSaveChar = useCallback(async (data: any) => {
    const isNew = !(editChar as CharProfile)?.id
    setCharSaving(true)
    try {
      if (isNew) {
        await characterApi.create({ channelSlug: charChannel, profileName: data.profile_name, ...data })
      } else {
        await characterApi.update((editChar as CharProfile).id, {
          profileName: data.profile_name,
          characterLock: data.character_lock,
          styleLock: data.style_lock,
          worldLock: data.world_lock,
          continuityNotes: data.continuity_notes,
        })
      }
      refetchChars()
      setShowEditPanel(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCharSaving(false)
    }
  }, [editChar, charChannel, refetchChars])

  const handleToggleActive = useCallback(async (profile: CharProfile) => {
    try {
      await characterApi.activate(profile.id, charChannel, !profile.is_active)
      refetchChars()
    } catch (e: any) {
      setError(e.message)
    }
  }, [charChannel, refetchChars])

  const handleDeleteChar = useCallback(async (profile: CharProfile) => {
    if (!window.confirm(`Delete "${profile.profile_name}"?`)) return
    try {
      await characterApi.delete(profile.id)
      refetchChars()
      if ((editChar as CharProfile)?.id === profile.id) setShowEditPanel(false)
    } catch (e: any) {
      setError(e.message)
    }
  }, [editChar, refetchChars])

  const handleGenerateImage = useCallback(async (characterLock: string, styleLock: string) => {
    setCharGeneratingImage(true)
    try {
      const res = await characterApi.generateImage({
        characterLock,
        styleLock,
        characterName: (editChar as CharProfile)?.profile_name,
        profileId: (editChar as CharProfile)?.id,
      })
      if (res.image_data_url && (editChar as CharProfile)?.id) {
        await characterApi.update((editChar as CharProfile).id, { imageDataUrl: res.image_data_url })
        refetchChars()
      }
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCharGeneratingImage(false)
    }
  }, [editChar, refetchChars])

  const handleAIGenerate = useCallback(async (params: any) => {
    setAIGenerating(true)
    try {
      const res = await characterApi.generateWithClaude({
        characterName: params.characterName,
        characterDescription: params.characterDescription,
        storyContext: params.storyContext,
        age: params.age,
        personality: params.personality,
      })
      // Pre-fill the edit panel with AI-generated values
      const generated = res.profile ?? res
      setEditChar({
        id: 0,
        channel_slug: charChannel,
        profile_name: params.characterName,
        character_lock: generated.character_lock ?? '',
        style_lock: generated.style_lock ?? '',
        world_lock: generated.world_lock ?? '',
        continuity_notes: generated.continuity_notes ?? '',
      } as CharProfile)
      setShowEditPanel(true)
      setShowAIModal(false)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAIGenerating(false)
    }
  }, [charChannel])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E5E5] px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-md bg-[#F5F5F5] border border-[#E5E5E5] flex items-center justify-center">
              <Sparkles size={13} strokeWidth={1.5} className="text-[#525252]" />
            </div>
            <div>
              <h1 className="text-[14px] font-semibold text-[#0A0A0A]">Kids Studio</h1>
              <p className="text-[11px] text-[#A3A3A3]">Animated video pipeline — Kling + Suno + Claude</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-[#F5F5F5] rounded-md">
            {(['video', 'characters'] as PageTab[]).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'h-7 px-3 text-[12px] font-medium rounded transition-colors',
                  tab === t ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#A3A3A3] hover:text-[#525252]',
                )}
              >
                {t === 'video' ? 'New Video' : 'Characters'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {tab === 'video' ? (
        <div className="flex-1 overflow-auto p-5">
          {/* Wizard card */}
          <div className="max-w-2xl mx-auto">
            <StepNav phase={phase} />

            <div className="bg-white border border-[#E5E5E5] rounded-xl p-5">
              {error && phase === 'setup' && (
                <div className="flex items-start gap-2 mb-4 px-3 py-2.5 bg-red-50 border border-red-100 rounded-md">
                  <AlertCircle size={12} strokeWidth={1.5} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-red-700">{error}</p>
                </div>
              )}

              {phase === 'setup' && (
                <SetupForm channels={channels} onSubmit={handleGenerate} loading={false} />
              )}

              {phase === 'gen_loading' && (
                <LoadingCard
                  message={genData?.message ?? 'Claude is writing the script and animation plan…'}
                  onCancel={handleReset}
                />
              )}

              {phase === 'review' && genData && (
                <ReviewCard genData={genData} onApprove={handleApprove} onBack={handleReset} approving={approving} />
              )}

              {phase === 'media_loading' && genData && (
                <MediaProgressCard genData={genData} />
              )}

              {phase === 'publish_form' && genData && (
                <PublishForm genData={genData} channels={channels} onPublish={handlePublish} publishing={publishing} />
              )}

              {phase === 'publishing' && (
                <LoadingCard message="Uploading to YouTube…" />
              )}

              {phase === 'done' && genData && (
                <SuccessCard genData={genData} onNew={handleReset} />
              )}
            </div>
          </div>
        </div>
      ) : (
        /* ── Characters Tab ────────────────────────────────────────────── */
        <div className="flex flex-1 overflow-hidden">
          {/* Left: grid */}
          <div className="flex-1 overflow-auto p-5">
            {/* Controls */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <select
                  value={charChannel}
                  onChange={e => setCharChannel(e.target.value)}
                  className="h-8 pl-2 pr-6 text-[12px] text-[#525252] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="">All channels</option>
                  {channels.map(c => <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>)}
                </select>
                <span className="text-[11px] text-[#A3A3A3]">{profiles.length} character{profiles.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAIModal(true)}
                  className="flex items-center gap-1.5 h-8 px-3 border border-[#E5E5E5] bg-white text-[12px] text-[#525252] rounded hover:border-[#D4D4D4] transition-colors"
                >
                  <Wand2 size={12} strokeWidth={1.5} /> AI Generate
                </button>
                <button
                  onClick={() => {
                    setEditChar({ id: 0, channel_slug: charChannel, profile_name: '' } as CharProfile)
                    setShowEditPanel(true)
                  }}
                  className="flex items-center gap-1.5 h-8 px-3 bg-[#0A0A0A] text-white text-[12px] rounded hover:bg-[#262626] transition-colors"
                >
                  <Plus size={12} strokeWidth={1.5} /> New Character
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-100 rounded text-[11px] text-red-700">
                <AlertCircle size={11} strokeWidth={1.5} className="flex-shrink-0" />
                {error}
                <button onClick={() => setError(null)} className="ml-auto"><X size={11} /></button>
              </div>
            )}

            {/* Grid */}
            {profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-12 h-12 rounded-full bg-[#F5F5F5] flex items-center justify-center">
                  <User size={20} strokeWidth={1} className="text-[#D4D4D4]" />
                </div>
                <p className="text-[13px] text-[#525252]">No characters yet</p>
                <p className="text-[11px] text-[#A3A3A3]">Create characters to maintain visual consistency across videos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {profiles.map(p => (
                  <CharCard
                    key={p.id}
                    profile={p}
                    channelSlug={charChannel}
                    isActive={p.is_active ?? false}
                    onEdit={() => { setEditChar(p); setShowEditPanel(true) }}
                    onToggleActive={() => handleToggleActive(p)}
                    onDelete={() => handleDeleteChar(p)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right: edit panel */}
          {showEditPanel && (
            <CharEditPanel
              profile={editChar as CharProfile}
              channelSlug={charChannel}
              onSave={handleSaveChar}
              onClose={() => setShowEditPanel(false)}
              onGenerateImage={handleGenerateImage}
              saving={charSaving}
              generatingImage={charGeneratingImage}
            />
          )}
        </div>
      )}

      {/* AI Generate Modal */}
      {showAIModal && (
        <AIGenerateModal
          onGenerate={handleAIGenerate}
          onClose={() => setShowAIModal(false)}
          loading={aiGenerating}
        />
      )}
    </div>
  )
}
