import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Upload, Sparkles, Music, CheckCircle2, Loader2, X, ChevronRight } from 'lucide-react'
import { useCreateStore, type VisualSource, type ArtStyle } from '@store/create'
import { visualsApi } from '@api/services'
import { useToast } from '@components/Toast'

const ART_STYLES: { id: ArtStyle; label: string; bestFor: string; image: string }[] = [
  { id: 'anime',          label: 'Anime Dream',      bestFor: 'Anime, fantasy & action stories',        image: '/art-styles/anime.jpg' },
  { id: 'comic',          label: 'Comic Pop',        bestFor: 'Bold storytelling, drama, true crime',    image: '/art-styles/comic.jpg' },
  { id: 'watercolor',     label: 'Soft Watercolor',  bestFor: 'Calm, reflective, poetic topics',         image: '/art-styles/watercolor.jpg' },
  { id: 'photorealistic', label: 'Cinematic Real',   bestFor: 'History, documentary, news-style videos', image: '/art-styles/photorealistic.jpg' },
  { id: 'storybook',      label: 'Storybook Magic',  bestFor: 'Kids content, fairy tales, wholesome',    image: '/art-styles/storybook.jpg' },
  { id: 'gothic',         label: 'Midnight Gothic',  bestFor: 'Horror, mystery, dark folklore',          image: '/art-styles/gothic.jpg' },
]

// Hard cap enforced server-side too (config.MAX_AI_IMAGES_PER_VIDEO) — shown here
// so the cost/quality tradeoff is never a surprise after a run has started.
const MAX_AI_IMAGES_PER_VIDEO = 8

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({
  active,
  disabled,
  icon,
  label,
  description,
  badge,
  onClick,
}: {
  active: boolean
  disabled?: boolean
  icon: React.ReactNode
  label: string
  description: string
  badge?: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'text-left border rounded-lg p-4 transition-colors relative',
        disabled
          ? 'border-[#E5E5E5] bg-[#FAFAFA] opacity-50 cursor-not-allowed'
          : active
          ? 'border-[#0A0A0A] bg-[#FAFAFA]'
          : 'border-[#E5E5E5] hover:border-[#D4D4D4]',
      ].join(' ')}
    >
      {badge && (
        <span className="absolute top-3 right-3 text-[9px] font-bold tracking-widest uppercase bg-[#F5F5F5] text-[#A3A3A3] px-1.5 py-0.5 rounded">
          {badge}
        </span>
      )}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-3 ${active ? 'bg-[#0A0A0A] text-white' : 'bg-[#F5F5F5] text-[#525252]'}`}>
        {icon}
      </div>
      <p className="text-[13px] font-semibold text-[#0A0A0A] mb-1">{label}</p>
      <p className="text-[11px] text-[#737373] leading-snug">{description}</p>
    </button>
  )
}

// ─── Upload dropzone (shared by video + audio) ────────────────────────────────

function UploadDropzone({
  accept,
  uploading,
  uploadedLabel,
  placeholder,
  onPick,
  onClear,
}: {
  accept: string
  uploading: boolean
  uploadedLabel: string | null
  placeholder: string
  onPick: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="border border-dashed border-[#D4D4D4] rounded-lg p-5">
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onPick(file)
          if (inputRef.current) inputRef.current.value = ''
        }}
      />
      {uploadedLabel ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} strokeWidth={1.5} className="text-[#16A34A]" />
            <span className="text-[12px] text-[#0A0A0A]">{uploadedLabel}</span>
          </div>
          <button onClick={onClear} className="text-[#A3A3A3] hover:text-[#DC2626] transition-colors">
            <X size={14} strokeWidth={1.5} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full flex flex-col items-center gap-2 py-4 text-[#737373] hover:text-[#0A0A0A] transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 size={20} strokeWidth={1.5} className="animate-spin" /> : <Upload size={20} strokeWidth={1.5} />}
          <span className="text-[12px] font-medium">{uploading ? 'Uploading…' : placeholder}</span>
        </button>
      )}
    </div>
  )
}

// ─── Visuals Page ─────────────────────────────────────────────────────────────

export default function VisualsPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const {
    visualSource, visualCustomVideoPath, artStyle, bgMusicPath,
    setVisualSource, setVisualCustomVideoPath, setArtStyle, setBgMusicPath, setStep,
  } = useCreateStore()

  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName]   = useState<string | null>(null)
  const [musicOn, setMusicOn]     = useState(!!bgMusicPath)
  const [musicUploading, setMusicUploading] = useState(false)
  const [musicFileName, setMusicFileName]   = useState<string | null>(null)

  const handlePick = (source: VisualSource) => {
    setVisualSource(source)
    if (source !== 'custom_video') {
      // Switching away from custom video clears any previously uploaded file
      // reference so a stale path can't silently get attached to a later run.
      setVisualCustomVideoPath(null)
      setFileName(null)
    }
    if (source !== 'ai_image') {
      setArtStyle(null)
    } else if (!artStyle) {
      setArtStyle('photorealistic')
    }
  }

  const handleContinue = () => {
    if (visualSource === 'custom_video' && !visualCustomVideoPath) {
      toast.error('Upload a background video first, or switch to Stock footage')
      return
    }
    if (visualSource === 'ai_image' && !artStyle) {
      toast.error('Pick an art style first, or switch to Stock footage')
      return
    }
    if (musicOn && !bgMusicPath) {
      toast.error('Upload a music track, or switch background music back to None')
      return
    }
    setStep(4)
    navigate('/app/create/seo')
  }

  return (
    <div className="max-w-[900px] mx-auto px-6 py-6">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A] mb-1">Visuals</h1>
        <p className="text-[13px] text-[#737373]">
          Choose what plays behind your narration. Stock footage matches each scene automatically -
          or bring your own background video.
        </p>
      </div>

      {/* Video source picker */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <SourceCard
          active={visualSource === 'stock'}
          icon={<Film size={16} strokeWidth={1.5} />}
          label="Stock footage"
          description="Auto-matched photos/clips per scene. Default, no setup needed."
          onClick={() => handlePick('stock')}
        />
        <SourceCard
          active={visualSource === 'custom_video'}
          icon={<Upload size={16} strokeWidth={1.5} />}
          label="Upload your own video"
          description="Loops your footage under the whole narration - your content, your rights."
          onClick={() => handlePick('custom_video')}
        />
        <SourceCard
          active={visualSource === 'ai_image'}
          icon={<Sparkles size={16} strokeWidth={1.5} />}
          label="AI-generated images"
          description={`Consistent art style, generated once per scene group (max ${MAX_AI_IMAGES_PER_VIDEO}/video) — cost stays predictable no matter how long the video is.`}
          onClick={() => handlePick('ai_image')}
        />
      </div>

      {/* Inline art-style picker for AI-generated images */}
      {visualSource === 'ai_image' && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-medium text-[#525252]">Art style</p>
            <p className="text-[11px] text-[#A3A3A3]">
              Up to {MAX_AI_IMAGES_PER_VIDEO} images/video · ~$0.04 each · ≈${(MAX_AI_IMAGES_PER_VIDEO * 0.04).toFixed(2)} max
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {ART_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setArtStyle(s.id)}
                title={s.bestFor}
                className={[
                  'relative rounded-lg overflow-hidden border-2 transition-colors group text-left',
                  artStyle === s.id ? 'border-[#0A0A0A]' : 'border-transparent hover:border-[#D4D4D4]',
                ].join(' ')}
              >
                <img
                  src={s.image}
                  alt={s.label}
                  className="w-full aspect-[4/3] object-cover"
                  loading="lazy"
                />
                {artStyle === s.id && (
                  <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#0A0A0A] text-white flex items-center justify-center">
                    <CheckCircle2 size={13} strokeWidth={2} />
                  </span>
                )}
                <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 py-2 text-left">
                  <span className="block text-[12px] font-semibold text-white leading-tight">{s.label}</span>
                  <span className="block text-[10px] text-white/80 leading-snug mt-0.5">{s.bestFor}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Inline dropzone for custom video */}
      {visualSource === 'custom_video' && (
        <div className="mb-6">
          <UploadDropzone
            accept="video/mp4,video/quicktime,video/webm,video/x-matroska"
            uploading={uploading}
            uploadedLabel={visualCustomVideoPath ? (fileName || 'Background video uploaded') : null}
            placeholder="Click to upload a background video (MP4, MOV, WebM, MKV)"
            onPick={async (file) => {
              setUploading(true)
              try {
                const { path } = await visualsApi.uploadVideo(file)
                setVisualCustomVideoPath(path)
                setFileName(file.name)
                toast.success('Background video uploaded')
              } catch (err: any) {
                toast.error(err?.message || 'Upload failed - try a different file')
              } finally {
                setUploading(false)
              }
            }}
            onClear={() => { setVisualCustomVideoPath(null); setFileName(null) }}
          />
        </div>
      )}

      {/* Background music (secondary control - independent of video source) */}
      <div className="border-t border-[#E5E5E5] pt-5 mb-6">
        <p className="text-[13px] font-semibold text-[#0A0A0A] mb-1 flex items-center gap-1.5">
          <Music size={14} strokeWidth={1.5} /> Background music
        </p>
        <p className="text-[11px] text-[#737373] mb-3">Optional. Plays quietly under your narration for the whole video.</p>
        <div className="flex gap-2 mb-3">
          {(['none', 'upload'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => {
                const on = opt === 'upload'
                setMusicOn(on)
                if (!on) { setBgMusicPath(null); setMusicFileName(null) }
              }}
              className={[
                'h-8 px-3 text-[12px] font-medium rounded border transition-colors',
                (opt === 'upload') === musicOn
                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                  : 'bg-white border-[#E5E5E5] text-[#525252] hover:border-[#D4D4D4]',
              ].join(' ')}
            >
              {opt === 'none' ? 'None' : 'Upload your own'}
            </button>
          ))}
        </div>
        {musicOn && (
          <UploadDropzone
            accept="audio/mpeg,audio/wav,audio/mp4,audio/aac"
            uploading={musicUploading}
            uploadedLabel={bgMusicPath ? (musicFileName || 'Background music uploaded') : null}
            placeholder="Click to upload a music track (MP3, WAV, M4A, AAC)"
            onPick={async (file) => {
              setMusicUploading(true)
              try {
                const { path } = await visualsApi.uploadAudio(file)
                setBgMusicPath(path)
                setMusicFileName(file.name)
                toast.success('Background music uploaded')
              } catch (err: any) {
                toast.error(err?.message || 'Upload failed - try a different file')
              } finally {
                setMusicUploading(false)
              }
            }}
            onClear={() => { setBgMusicPath(null); setMusicFileName(null) }}
          />
        )}
      </div>

      {/* Continue */}
      <div className="flex justify-end">
        <button
          onClick={handleContinue}
          disabled={uploading || musicUploading}
          className="h-9 px-5 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          Continue <ChevronRight size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
