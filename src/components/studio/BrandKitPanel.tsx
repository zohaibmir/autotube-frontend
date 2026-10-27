import { useCallback, useState, useEffect } from 'react'
import { Video, Mic, Image, Palette, Save } from 'lucide-react'
import { brandKitApi, type BrandKit } from '@/api/services'
import { useToast } from '@/components/Toast'

export interface BrandKitPanelProps {
  channel?: string
  className?: string
  load?: () => void
}

export function BrandKitPanel({ channel, load }: BrandKitPanelProps) {
  const [kit, setKit] = useState<BrandKit>({
    channel_slug: channel ?? '',
    avatar_url: '',
    watermark_url: '',
    intro_video_id: '',
    outro_video_id: '',
    thumbnail_template: 'default',
    voice_id: '',
  })
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const toast = useToast()

  const fetchKit = useCallback(async () => {
    try {
      const data = await brandKitApi.get(channel)
      setKit(data)
      setDirty(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load brand kit')
    }
  }, [channel, toast])

  useEffect(() => {
    if (load) fetchKit()
  }, [load, fetchKit])

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setSaving(true)
    try {
      const next = await brandKitApi.upsert({
        channel,
        avatar_url: kit.avatar_url || null,
        watermark_url: kit.watermark_url || null,
        intro_video_id: kit.intro_video_id || null,
        outro_video_id: kit.outro_video_id || null,
        thumbnail_template: kit.thumbnail_template || 'default',
        voice_id: kit.voice_id || null,
      })
      setKit(next)
      setDirty(false)
      toast.success('Brand kit saved')
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save brand kit')
    } finally {
      setSaving(false)
    }
  }

  const THUMBNAIL_TEMPLATES = [
    { value: 'default', label: 'Default' },
    { value: 'kids-fun', label: 'Kids Fun' },
    { value: 'minimal-clean', label: 'Minimal Clean' },
    { value: 'bold-news', label: 'Bold News' },
    { value: 'premium-dark', label: 'Premium Dark' },
    { value: 'pastel-soft', label: 'Pastel Soft' },
  ]

  return (
    <section className="bg-white border border-[#E5E5E5] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">Brand Kit</h3>
        <p className="text-[11px] text-[#A3A3A3]">
          Consistent look across all videos — avatar, watermark, intro/outro,
          thumbnail style, and voice.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
            <Image size={12} strokeWidth={1.5} className="flex-shrink-0" />
            Avatar URL
          </label>
          <input
            value={kit.avatar_url ?? ''}
            onChange={(e) => {
              setKit({ ...kit, avatar_url: e.target.value })
              setDirty(true)
            }}
            placeholder="https://…/avatar.png"
            className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
            <Image size={12} strokeWidth={1.5} className="flex-shrink-0" />
            Watermark URL
          </label>
          <input
            value={kit.watermark_url ?? ''}
            onChange={(e) => {
              setKit({ ...kit, watermark_url: e.target.value })
              setDirty(true)
            }}
            placeholder="https://…/watermark.png"
            className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
              <Video size={12} strokeWidth={1.5} className="flex-shrink-0" />
              Intro Video ID
            </label>
            <input
              value={kit.intro_video_id ?? ''}
              onChange={(e) => {
                setKit({ ...kit, intro_video_id: e.target.value })
                setDirty(true)
              }}
              placeholder="youtube_video_id"
              className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
              <Video size={12} strokeWidth={1.5} className="flex-shrink-0" />
              Outro Video ID
            </label>
            <input
              value={kit.outro_video_id ?? ''}
              onChange={(e) => {
                setKit({ ...kit, outro_video_id: e.target.value })
                setDirty(true)
              }}
              placeholder="youtube_video_id"
              className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
            <Palette size={12} strokeWidth={1.5} className="flex-shrink-0" />
            Thumbnail Template
          </label>
          <select
            value={kit.thumbnail_template ?? 'default'}
            onChange={(e) => {
              setKit({ ...kit, thumbnail_template: e.target.value })
              setDirty(true)
            }}
            className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          >
            {THUMBNAIL_TEMPLATES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
            <Mic size={12} strokeWidth={1.5} className="flex-shrink-0" />
            Default Voice ID
          </label>
          <input
            value={kit.voice_id ?? ''}
            onChange={(e) => {
              setKit({ ...kit, voice_id: e.target.value })
              setDirty(true)
            }}
            placeholder="voice_id (e.g. alloy, echo, …)"
            className="w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F5F5F5]">
          <span className="text-[11px] text-[#A3A3A3]">
            {dirty ? 'Unsaved changes' : 'Up to date'}
          </span>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`flex items-center gap-2 h-9 px-4 rounded-md font-medium text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              saving
                ? 'bg-[#F5F5F5] text-[#A3A3A3]'
                : 'bg-[#0A0A0A] text-white hover:bg-[#262626]'
            }`}
          >
            <Save size={13} strokeWidth={1.5} className={`flex-shrink-0 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Saving…' : dirty ? 'Save brand kit' : 'Saved'}
          </button>
        </div>
      </div>
    </section>
  )
}