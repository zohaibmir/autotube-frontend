import { useCallback, useState, useEffect } from 'react'
import {
  Mic,
  Image,
  Palette,
  Save,
  Play,
  Trash2,
  RefreshCw,
  Film,
} from 'lucide-react'
import { brandKitApi, voiceApi, studioApi, type BrandKit } from '@/api/services'
import { useToast } from '@/components/Toast'

export interface BrandKitPanelProps {
  channel?: string
  className?: string
  load?: () => void
}

const TEMPLATE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  default: { bg: 'bg-white', text: 'text-[#0A0A0A]', label: 'Default' },
  'kids-fun': { bg: 'bg-[#FCE7F3] text-[#BE185D]', text: 'text-[#BE185D]', label: 'Kids Fun' },
  'minimal-clean': { bg: 'bg-[#F5F5F4] text-[#18181b]', text: 'text-[#18181b]', label: 'Minimal Clean' },
  'bold-news': { bg: 'bg-[#FEF2F2] text-[#DC2626]', text: 'text-[#DC2626]', label: 'Bold News' },
  'premium-dark': { bg: 'bg-[#0A0A0A] text-white', text: 'text-white', label: 'Premium Dark' },
  'pastel-soft': { bg: 'bg-[#FDF2F8] text-[#C026D3]', text: 'text-[#C026D3]', label: 'Pastel Soft' },
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
  const [loading, setLoading] = useState(false)
  const [voices, setVoices] = useState<Array<{ id: string; label: string }>>([])
  const [videos, setVideos] = useState<Array<{ id: string; label: string }>>([])
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string | null>(null)
  const toast = useToast()

  const fetchKit = useCallback(async () => {
    setLoading(true)
    try {
      const data = await brandKitApi.get(channel)
      setKit(data)
      setDirty(false)
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to load brand kit')
    } finally {
      setLoading(false)
    }
  }, [channel, toast])

  useEffect(() => {
    if (load) fetchKit()
  }, [load, fetchKit])

  useEffect(() => {
    voiceApi
      .list()
      .then((data) => {
        const allVoices: Array<{ id: string; label: string }> = []
        data.groups.forEach((g) => {
          g.voices.forEach((v) => {
            const label = v.locale ? `${v.name} (${v.locale})` : v.name
            allVoices.push({ id: v.id, label })
          })
        })
        setVoices(allVoices)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    studioApi
      .videos()
      .then((data) => {
        const list: Array<{ id: string; label: string }> = (data.videos ?? []).map((v: any) => ({
          id: v.path,
          label: `${v.name} (${v.size_mb} MB)`,
        }))
        setVideos(list)
      })
      .catch(() => {})
  }, [])

  const clearField = useCallback((field: keyof BrandKit) => {
    setKit((prev) => ({ ...prev, [field]: '' }))
    setDirty(true)
  }, [])

  const resetAll = useCallback(() => {
    setKit({
      channel_slug: channel ?? '',
      avatar_url: '',
      watermark_url: '',
      intro_video_id: '',
      outro_video_id: '',
      thumbnail_template: 'default',
      voice_id: '',
    })
    setDirty(true)
  }, [channel])

  const handleVoicePreview = useCallback(async (voiceId: string) => {
    try {
      const url = await voiceApi.preview(voiceId)
      setVoicePreviewUrl(url)
      const audio = new Audio(url)
      audio.play()
    } catch {
      // preview is optional
    }
  }, [])

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

  const inputClass =
    'w-full h-9 px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors'

  return (
    <section className="bg-white border border-[#E5E5E5] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Brand Kit</h3>
          <p className="text-[11px] text-[#A3A3A3]">
            Consistent look across all videos — avatar, watermark, intro/outro,
            thumbnail style, and voice.
          </p>
        </div>
        {loading && (
          <div className="flex items-center gap-2 text-[11px] text-[#A3A3A3]">
            <RefreshCw size={12} strokeWidth={1.5} className="animate-spin" />
            Loading…
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Visual Identity ── */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#525252] mb-3">
            Visual Identity
          </h4>
          <div className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
                  <Image size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  Avatar URL
                </label>
                {kit.avatar_url && (
                  <button
                    onClick={() => clearField('avatar_url')}
                    className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                    title="Clear"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <input
                value={kit.avatar_url ?? ''}
                onChange={(e) => {
                  setKit({ ...kit, avatar_url: e.target.value })
                  setDirty(true)
                }}
                placeholder="https://…/avatar.png"
                className={inputClass}
              />
              {kit.avatar_url && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-16 h-16 rounded-full border border-[#E5E5E5] overflow-hidden bg-[#F5F5F5]">
                    <img
                      src={kit.avatar_url}
                      alt="Avatar preview"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.currentTarget.src = ''
                        e.currentTarget.style.display = 'none'
                        ;(e.currentTarget.parentElement as HTMLElement).innerHTML =
                          '<div class="w-full h-full flex items-center justify-center text-[10px] text-[#A3A3A3]">Invalid image</div>'
                      }}
                    />
                  </div>
                  <div className="flex-1 text-[11px] text-[#A3A3A3]">
                    Image will appear as the channel avatar across all videos.
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
                  <Image size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  Watermark URL
                </label>
                {kit.watermark_url && (
                  <button
                    onClick={() => clearField('watermark_url')}
                    className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                    title="Clear"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              <input
                value={kit.watermark_url ?? ''}
                onChange={(e) => {
                  setKit({ ...kit, watermark_url: e.target.value })
                  setDirty(true)
                }}
                placeholder="https://…/watermark.png"
                className={inputClass}
              />
              {kit.watermark_url && (
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-16 h-16 border border-[#E5E5E5] rounded-md bg-[#F5F5F5] overflow-hidden">
                    <img
                      src={kit.watermark_url}
                      alt="Watermark preview"
                      className="w-full h-full object-cover"
                      onError={(e: any) => {
                        e.currentTarget.src = ''
                        e.currentTarget.style.display = 'none'
                        ;(e.currentTarget.parentElement as HTMLElement).innerHTML =
                          '<div class="w-full h-full flex items-center justify-center text-[10px] text-[#A3A3A3]">Invalid image</div>'
                      }}
                    />
                  </div>
                  <div className="flex-1 text-[11px] text-[#A3A3A3]">
                    Watermark appears in the corner of every video frame.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Video Bookends ── */}
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#525252] mb-3">
            Video Bookends
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
                  <Film size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  Intro Video
                </label>
                {kit.intro_video_id && (
                  <button
                    onClick={() => clearField('intro_video_id')}
                    className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                    title="Clear"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {videos.length > 0 ? (
                <select
                  value={kit.intro_video_id || ''}
                  onChange={(e) => {
                    setKit({ ...kit, intro_video_id: e.target.value })
                    setDirty(true)
                  }}
                  className={inputClass}
                >
                  <option value="">Select a video…</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={kit.intro_video_id ?? ''}
                  onChange={(e) => {
                    setKit({ ...kit, intro_video_id: e.target.value })
                    setDirty(true)
                  }}
                  placeholder="YouTube video ID"
                  className={inputClass}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-[#525252]">
                  <Film size={12} strokeWidth={1.5} className="flex-shrink-0" />
                  Outro Video
                </label>
                {kit.outro_video_id && (
                  <button
                    onClick={() => clearField('outro_video_id')}
                    className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                    title="Clear"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                )}
              </div>
              {videos.length > 0 ? (
                <select
                  value={kit.outro_video_id || ''}
                  onChange={(e) => {
                    setKit({ ...kit, outro_video_id: e.target.value })
                    setDirty(true)
                  }}
                  className={inputClass}
                >
                  <option value="">Select a video…</option>
                  {videos.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={kit.outro_video_id ?? ''}
                  onChange={(e) => {
                    setKit({ ...kit, outro_video_id: e.target.value })
                    setDirty(true)
                  }}
                  placeholder="YouTube video ID"
                  className={inputClass}
                />
              )}
            </div>
          </div>
        </div>

        {/* ── Thumbnail Template ── */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-[#525252]">
              <Palette size={12} strokeWidth={1.5} className="flex-shrink-0" />
              Thumbnail Template
            </label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {THUMBNAIL_TEMPLATES.map((t) => {
              const style = TEMPLATE_STYLES[t.value]
              const isSelected = kit.thumbnail_template === t.value
              return (
                <button
                  key={t.value}
                  onClick={() => {
                    setKit({ ...kit, thumbnail_template: t.value })
                    setDirty(true)
                  }}
                  className={`flex flex-col items-center justify-center gap-1 p-2 rounded-md border transition-colors ${
                    isSelected
                      ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                      : 'border-[#E5E5E5] bg-white hover:bg-[#F5F5F5] hover:border-[#A3A3A3]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded ${style.bg} ${style.text} flex items-center justify-center text-[10px] font-medium mb-1`}>
                    {t.label.charAt(0)}
                  </div>
                  <span className={`text-[10px] font-medium ${isSelected ? 'text-[#0A0A0A]' : 'text-[#525252]'}`}>
                    {t.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Audio ── */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <label className="text-[11px] font-medium uppercase tracking-wider text-[#525252]">
              <Mic size={12} strokeWidth={1.5} className="flex-shrink-0" />
              Default Voice
            </label>
          </div>
          <div className="space-y-2">
            {voices.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <select
                  value={kit.voice_id || ''}
                  onChange={(e) => {
                    setKit({ ...kit, voice_id: e.target.value })
                    setDirty(true)
                  }}
                  className={inputClass}
                >
                  <option value="">Select a voice…</option>
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
                {kit.voice_id && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleVoicePreview(kit.voice_id!)}
                      disabled={!voicePreviewUrl}
                      className="flex items-center gap-2 h-8 px-3 text-[11px] font-medium rounded-md border border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F5F5F5] disabled:opacity-40 transition-colors"
                    >
                      <Play size={12} strokeWidth={1.5} />
                      Preview voice
                    </button>
                    <button
                      onClick={() => clearField('voice_id')}
                      className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                      title="Clear"
                    >
                      <Trash2 size={10} strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <input
                  value={kit.voice_id ?? ''}
                  onChange={(e) => {
                    setKit({ ...kit, voice_id: e.target.value })
                    setDirty(true)
                  }}
                  placeholder="voice_id (e.g. alloy, echo, …)"
                  className={inputClass}
                />
                {kit.voice_id && (
                  <button
                    onClick={() => clearField('voice_id')}
                    className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-1 py-0.5 rounded hover:bg-[#FEF2F2]"
                    title="Clear"
                  >
                    <Trash2 size={10} strokeWidth={1.5} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        <div className="pt-3 border-t border-[#F5F5F5]">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] text-[#A3A3A3]">
              {dirty ? 'Unsaved changes' : 'Up to date'}
            </span>
            <button
              onClick={resetAll}
              disabled={!dirty || saving}
              className="text-[10px] text-[#DC2626] hover:text-[#B91C1C] px-2 py-1 rounded hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              Reset all
            </button>
          </div>
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md font-medium text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
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
