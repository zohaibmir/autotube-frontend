import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ImageIcon, ChevronRight, Wand2, Camera, Upload,
  Loader2, CheckCircle, Youtube, Copy, RefreshCw, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { useCreateStore } from '@store/create'
import { thumbnailApi, youtubeApi } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

type BgMode = 'ai' | 'pexels' | 'upload'

// ─── Title overlay helper ─────────────────────────────────────────────────────

function ThumbnailPreview({
  dataUrl,
  title,
  showOverlay,
}: {
  dataUrl: string | null
  title: string
  showOverlay: boolean
}) {
  return (
    <div className="relative w-full aspect-video bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg overflow-hidden">
      {dataUrl ? (
        <img src={dataUrl} alt="Thumbnail preview" className="w-full h-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <ImageIcon size={40} strokeWidth={1} className="text-[#D4D4D4]" />
        </div>
      )}
      {showOverlay && title && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 py-5">
          <p className="text-white text-[13px] font-semibold leading-tight line-clamp-2">{title}</p>
        </div>
      )}
    </div>
  )
}

// ─── Mode tab ─────────────────────────────────────────────────────────────────

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded transition-colors ${
        active
          ? 'bg-[#0A0A0A] text-white'
          : 'bg-white border border-[#E5E5E5] text-[#525252] hover:bg-[#FAFAFA]'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

// ─── Thumbnail Page ───────────────────────────────────────────────────────────

export default function ThumbnailPage() {
  const navigate    = useNavigate()
  const toast       = useToast()
  const {
    seoPackage, selectedTopic, setThumbnailData, setStep,
  } = useCreateStore()

  const title    = seoPackage?.selectedTitle ?? selectedTopic?.topic ?? ''
  const topic    = selectedTopic?.topic ?? title

  // Background state
  const [bgMode,        setBgMode]        = useState<BgMode>('ai')
  const [dataUrl,       setDataUrl]       = useState<string | null>(null)
  const [pexelsQuery,   setPexelsQuery]   = useState(topic)
  const [showOverlay,   setShowOverlay]   = useState(true)

  // Push to YouTube state
  const [videoId,     setVideoId]     = useState('')
  const [pushDone,    setPushDone]    = useState(false)

  const fileRef = useRef<HTMLInputElement>(null)

  // ── AI background mutation ─────────────────────────────────────────────────

  const aiBgMutation = useMutation({
    mutationFn: () => thumbnailApi.generateBg({
      topic,
      niche:    seoPackage?.tags?.[0],
      audience: 'general',
    }),
    onSuccess: (res) => {
      if (res?.ok && res.b64) {
        setDataUrl(`data:${res.mime ?? 'image/jpeg'};base64,${res.b64}`)
      } else {
        toast.error('AI background generation failed')
      }
    },
    onError: () => toast.error('AI background generation failed'),
  })

  // ── Pexels background mutation ─────────────────────────────────────────────

  const pexelsMutation = useMutation({
    mutationFn: () => thumbnailApi.pexelsBg(pexelsQuery || topic),
    onSuccess: (res) => {
      if (res?.ok && res.b64) {
        setDataUrl(`data:${res.mime ?? 'image/jpeg'};base64,${res.b64}`)
      } else {
        toast.error('No Pexels images found - check your Pexels API key in Settings')
      }
    },
    onError: () => toast.error('Pexels search failed'),
  })

  // ── File upload handler ────────────────────────────────────────────────────

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    const reader = new FileReader()
    reader.onload = (e) => setDataUrl(e.target?.result as string)
    reader.readAsDataURL(file)
  }, [toast])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ── Push thumbnail to YouTube ──────────────────────────────────────────────

  const pushMutation = useMutation({
    mutationFn: () => {
      if (!dataUrl) throw new Error('Generate a thumbnail first')
      if (!videoId.trim()) throw new Error('Enter a YouTube Video ID')
      return youtubeApi.setThumbnail(videoId.trim(), dataUrl)
    },
    onSuccess: (res) => {
      if (res?.ok) {
        toast.success('Thumbnail pushed to YouTube')
        setPushDone(true)
      } else {
        toast.error('Failed to push thumbnail to YouTube')
      }
    },
    onError: (err: any) => toast.error(err?.message ?? 'Push failed'),
  })

  // ── Continue to Submit ─────────────────────────────────────────────────────

  const handleContinue = () => {
    if (dataUrl) {
      setThumbnailData({ dataUrl, title, mode: bgMode })
    }
    setStep(6)
    navigate('/app/create/submit')
  }

  const isGenerating = aiBgMutation.isPending || pexelsMutation.isPending

  return (
    <div className="max-w-[700px] mx-auto px-6 py-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Thumbnail</h1>
          <p className="text-[13px] text-[#525252] mt-0.5">
            Generate or upload a thumbnail for your video
          </p>
        </div>
        <button
          onClick={handleContinue}
          className="flex items-center gap-1.5 h-9 px-5 text-[13px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#FAFAFA] transition-colors"
        >
          {dataUrl ? 'Continue' : 'Skip'} <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Topic context */}
      {title && (
        <div className="bg-white border border-[#E5E5E5] rounded-lg px-4 py-3 mb-6">
          <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">Title</p>
          <p className="text-[13px] text-[#0A0A0A]">{title}</p>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex items-center gap-2 mb-4">
        <ModeTab
          active={bgMode === 'ai'}
          onClick={() => setBgMode('ai')}
          icon={<Wand2 size={12} strokeWidth={1.5} />}
          label="AI Background"
        />
        <ModeTab
          active={bgMode === 'pexels'}
          onClick={() => setBgMode('pexels')}
          icon={<Camera size={12} strokeWidth={1.5} />}
          label="Pexels Stock"
        />
        <ModeTab
          active={bgMode === 'upload'}
          onClick={() => setBgMode('upload')}
          icon={<Upload size={12} strokeWidth={1.5} />}
          label="Upload Image"
        />
      </div>

      {/* Mode panels */}
      <div className="bg-white border border-[#E5E5E5] rounded-lg p-5 mb-5">

        {bgMode === 'ai' && (
          <div className="space-y-3">
            <p className="text-[12px] text-[#525252]">
              Generate a dramatic AI background using Pollinations - no API key required.
            </p>
            <button
              onClick={() => aiBgMutation.mutate()}
              disabled={aiBgMutation.isPending}
              className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
            >
              {aiBgMutation.isPending
                ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                : <Wand2 size={12} strokeWidth={1.5} />
              }
              {aiBgMutation.isPending ? 'Generating…' : 'Generate AI Background'}
            </button>
            {dataUrl && bgMode === 'ai' && (
              <button
                onClick={() => aiBgMutation.mutate()}
                disabled={aiBgMutation.isPending}
                className="flex items-center gap-1.5 h-7 px-3 text-[11px] text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#FAFAFA] transition-colors"
              >
                <RefreshCw size={11} strokeWidth={1.5} /> Regenerate
              </button>
            )}
          </div>
        )}

        {bgMode === 'pexels' && (
          <div className="space-y-3">
            <p className="text-[12px] text-[#525252]">
              Search Pexels for a high-quality landscape photo. Requires a Pexels API key in Settings.
            </p>
            <div className="flex gap-2">
              <input
                value={pexelsQuery}
                onChange={(e) => setPexelsQuery(e.target.value)}
                placeholder="Search query…"
                className="flex-1 h-8 px-3 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3]"
                onKeyDown={(e) => e.key === 'Enter' && pexelsMutation.mutate()}
              />
              <button
                onClick={() => pexelsMutation.mutate()}
                disabled={pexelsMutation.isPending}
                className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {pexelsMutation.isPending
                  ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                  : <Camera size={12} strokeWidth={1.5} />
                }
                {pexelsMutation.isPending ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
        )}

        {bgMode === 'upload' && (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-[#E5E5E5] rounded-lg p-8 flex flex-col items-center gap-2 cursor-pointer hover:border-[#A3A3A3] hover:bg-[#FAFAFA] transition-colors"
          >
            <Upload size={24} strokeWidth={1} className="text-[#A3A3A3]" />
            <p className="text-[12px] text-[#525252] text-center">
              Drag &amp; drop an image or <span className="text-[#0A0A0A] font-medium">click to browse</span>
            </p>
            <p className="text-[10px] text-[#A3A3A3]">PNG, JPEG, WEBP - 1280×720 recommended</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest">Preview</p>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className="flex items-center gap-1.5 text-[11px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
          >
            {showOverlay
              ? <ToggleRight size={14} strokeWidth={1.5} className="text-[#0A0A0A]" />
              : <ToggleLeft size={14} strokeWidth={1.5} />
            }
            Title overlay
          </button>
        </div>

        {isGenerating ? (
          <div className="w-full aspect-video bg-[#F5F5F5] border border-[#E5E5E5] rounded-lg flex flex-col items-center justify-center gap-2">
            <Loader2 size={24} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
            <p className="text-[12px] text-[#A3A3A3]">Generating background…</p>
          </div>
        ) : (
          <ThumbnailPreview dataUrl={dataUrl} title={title} showOverlay={showOverlay} />
        )}
      </div>

      {/* Push to YouTube */}
      <div className="mt-6 bg-white border border-[#E5E5E5] rounded-lg p-5">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">
          Push to YouTube (optional)
        </p>
        <p className="text-[12px] text-[#525252] mb-3">
          If this video is already uploaded, paste the YouTube Video ID to set the thumbnail now.
        </p>
        <div className="flex gap-2">
          <input
            value={videoId}
            onChange={(e) => { setVideoId(e.target.value); setPushDone(false) }}
            placeholder="e.g. dQw4w9WgXcQ"
            className="flex-1 h-8 px-3 text-[12px] border border-[#E5E5E5] rounded bg-[#FAFAFA] focus:outline-none focus:border-[#A3A3A3] font-mono"
          />
          <button
            onClick={() => pushMutation.mutate()}
            disabled={pushMutation.isPending || !dataUrl || !videoId.trim() || pushDone}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#0A0A0A] text-white text-[12px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
          >
            {pushDone ? (
              <><CheckCircle size={12} strokeWidth={1.5} /> Pushed</>
            ) : pushMutation.isPending ? (
              <><Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> Pushing…</>
            ) : (
              <><Youtube size={12} strokeWidth={1.5} /> Push Thumbnail</>
            )}
          </button>
        </div>
        {!dataUrl && (
          <p className="text-[11px] text-[#A3A3A3] mt-2">Generate a thumbnail first to enable push.</p>
        )}
      </div>

      {/* Continue CTA */}
      <div className="flex justify-end mt-6">
        <button
          onClick={handleContinue}
          className="flex items-center gap-2 h-9 px-6 bg-[#0A0A0A] text-white text-[13px] font-medium rounded hover:bg-[#262626] transition-colors"
        >
          {dataUrl ? 'Continue to Submit' : 'Skip to Submit'} <ChevronRight size={13} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

