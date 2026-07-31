import React, { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Film, Sparkles, Loader2, Upload, Trash2,
  Mic, Bot, ExternalLink, CheckCircle, AlertCircle, ArrowLeft,
} from 'lucide-react'
import { customStudioApi, studioApi, channelsApi } from '@api/services'

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = 1 | 2 | 3

interface UploadedClip {
  name: string
  size_mb: number
}

interface PipelineStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  step?: string
  pct?: number
  message?: string
  youtube_url?: string
  error?: string
}

// ── Step indicator ────────────────────────────────────────────────────────────

function StepNav({ current }: { current: Step }) {
  const steps: { n: Step; label: string }[] = [
    { n: 1, label: 'Script' },
    { n: 2, label: 'Clips' },
    { n: 3, label: 'SEO & Run' },
  ]
  return (
    <div className="flex items-center gap-6 border-b border-[#E5E5E5] pb-3 mb-6">
      {steps.map(({ n, label }) => (
        <span
          key={n}
          className={[
            'text-[13px] font-medium pb-2 -mb-3 border-b-2 transition-colors',
            current === n
              ? 'text-[#0A0A0A] border-[#0A0A0A]'
              : current > n
              ? 'text-[#525252] border-transparent'
              : 'text-[#A3A3A3] border-transparent',
          ].join(' ')}
        >
          {label}
        </span>
      ))}
    </div>
  )
}

// ── Status Panel ──────────────────────────────────────────────────────────────

function StatusPanel({ channelSlug }: { channelSlug: string }) {
  const { data } = useQuery<PipelineStatus>({
    queryKey: ['cs-status'],
    queryFn: customStudioApi.status,
    refetchInterval: (query) => {
      const d = query.state.data as PipelineStatus | undefined
      return d?.status === 'running' ? 3000 : false
    },
  })

  if (!data || data.status === 'idle') return null

  return (
    <div className="mt-6 border border-[#E5E5E5] rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-[#FAFAFA] border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Pipeline Status</p>
      </div>
      <div className="px-4 py-4">
        {data.status === 'running' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#0A0A0A]" />
                <span className="text-[13px] font-medium text-[#0A0A0A]">
                  {data.step ?? 'Running...'}
                </span>
              </div>
              {typeof data.pct === 'number' && (
                <span className="text-[12px] text-[#A3A3A3]">{data.pct}%</span>
              )}
            </div>
            {typeof data.pct === 'number' && (
              <div className="h-0.5 bg-[#E5E5E5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#0A0A0A] transition-all duration-500"
                  style={{ width: `${data.pct}%` }}
                />
              </div>
            )}
            {data.message && (
              <p className="text-[12px] text-[#525252]">{data.message}</p>
            )}
          </div>
        )}

        {data.status === 'done' && (
          <div className="flex items-start gap-3">
            <CheckCircle size={16} strokeWidth={1.5} className="text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[#0A0A0A]">Pipeline complete</p>
              {data.youtube_url && (
                <a
                  href={data.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1 text-[12px] text-[#2563EB] hover:underline"
                >
                  <ExternalLink size={12} strokeWidth={1.5} />
                  View on YouTube
                </a>
              )}
            </div>
          </div>
        )}

        {data.status === 'error' && (
          <div className="flex items-start gap-3">
            <AlertCircle size={16} strokeWidth={1.5} className="text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[13px] font-medium text-[#0A0A0A]">Pipeline failed</p>
              {data.error && (
                <p className="text-[12px] text-red-600 mt-0.5">{data.error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CustomStudioPage() {
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const narrationInputRef = useRef<HTMLInputElement>(null)

  // Step state
  const [step, setStep] = useState<Step>(1)

  // Step 1: Script
  const [topic, setTopic] = useState('')
  const [scriptText, setScriptText] = useState('')

  // Step 2: Clips + narration
  const [narrationMode, setNarrationMode] = useState<'ai' | 'upload'>('ai')
  const [narrationFile, setNarrationFile] = useState<string | null>(null)
  const [voiceId, setVoiceId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Step 3: SEO + Run
  const [seoTitle, setSeoTitle] = useState('')
  const [seoDesc, setSeoDesc] = useState('')
  const [seoTags, setSeoTags] = useState('')
  const [channelSlug, setChannelSlug] = useState('')
  const [aiGenerating, setAiGenerating] = useState(false)
  const [runError, setRunError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  // Data
  const { data: clipsData, refetch: refetchClips } = useQuery({
    queryKey: ['cs-clips'],
    queryFn: customStudioApi.listClips,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const clips: UploadedClip[] = clipsData?.clips ?? []
  const channels: any[] = channelsData ?? []

  // ── File upload ────────────────────────────────────────────────────────────

  async function uploadFiles(files: FileList | File[]) {
    const fileArr = Array.from(files)
    if (!fileArr.length) return
    setUploading(true)
    setUploadError(null)
    try {
      const fd = new FormData()
      fileArr.forEach(f => fd.append('file', f, f.name))
      const result = await customStudioApi.uploadClips(fd)
      if (result.ok) {
        await refetchClips()
      } else {
        setUploadError(result.error ?? 'Upload failed')
      }
    } catch (e: any) {
      setUploadError(e?.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function uploadNarration(file: File) {
    const fd = new FormData()
    fd.append('file', file, file.name)
    try {
      const result = await customStudioApi.uploadNarration(fd)
      if (result.ok) {
        setNarrationFile(result.filename ?? file.name)
      }
    } catch {
      // silent
    }
  }

  async function handleDeleteClip(name: string) {
    await customStudioApi.deleteClip(name)
    await refetchClips()
  }

  // ── Drag & drop ────────────────────────────────────────────────────────────

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) {
      await uploadFiles(e.dataTransfer.files)
    }
  }, [])

  // ── AI generate metadata ───────────────────────────────────────────────────

  async function handleAiGenerate() {
    const titleSrc = seoTitle.trim() || topic.trim()
    if (!titleSrc) return
    setAiGenerating(true)
    try {
      const result = await studioApi.generateMetadata(titleSrc, channelSlug || undefined)
      if (result.ok) {
        if (!seoTitle.trim() && result.description) setSeoTitle(titleSrc)
        if (result.description) setSeoDesc(result.description)
        if (result.tags?.length) setSeoTags(result.tags.join(', '))
      }
    } catch {
      // silent
    } finally {
      setAiGenerating(false)
    }
  }

  // ── Run pipeline ───────────────────────────────────────────────────────────

  async function handleRun() {
    if (!topic.trim() || !scriptText.trim()) return
    setRunError(null)
    setRunning(true)
    try {
      const result = await customStudioApi.run({
        topic: topic.trim(),
        scriptText: scriptText.trim(),
        clips: clips.map(c => c.name),
        voice_id: voiceId.trim() || undefined,
        narration_audio: narrationFile ?? undefined,
        channel_slug: channelSlug || undefined,
        seoTitle: seoTitle.trim() || undefined,
        seoDescription: seoDesc.trim() || undefined,
        seoTags: seoTags.trim() || undefined,
      })
      if (!result.ok) {
        setRunError(result.error ?? 'Pipeline failed to start')
      } else {
        qc.invalidateQueries({ queryKey: ['cs-status'] })
      }
    } catch (e: any) {
      const msg: string = e?.response?.data?.detail ?? e?.message ?? 'Failed to start'
      if (e?.response?.status === 409) {
        setRunError('Another pipeline is currently running. Wait for it to finish before starting a new one.')
      } else {
        setRunError(msg)
      }
    } finally {
      setRunning(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-full bg-[#FAFAFA] py-6 px-6">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <a
            href="/app/studio"
            className="flex items-center gap-1 text-[12px] text-[#A3A3A3] hover:text-[#525252] transition-colors"
          >
            <ArrowLeft size={12} strokeWidth={1.5} />
            Studio
          </a>
          <span className="text-[#D4D4D4]">/</span>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Custom Studio</h1>
        </div>

        {/* Step nav */}
        <StepNav current={step} />

        {/* ── Step 1: Script ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Topic
              </label>
              <input
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="What is this video about?"
                className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Script
              </label>
              <textarea
                value={scriptText}
                onChange={e => setScriptText(e.target.value)}
                placeholder="Write your full script here. The AI will generate narration from this text using your uploaded clips as visuals."
                rows={10}
                className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] font-mono bg-white border border-[#E5E5E5] rounded-md resize-none focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
              <p className="mt-1 text-[11px] text-[#A3A3A3]">
                {scriptText.trim().split(/\s+/).filter(Boolean).length} words
              </p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                disabled={!topic.trim() || !scriptText.trim()}
                className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                Continue
                <span className="text-[#A3A3A3]">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Clips ─────────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5">

            {/* Drop zone */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Video Clips
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={[
                  'relative flex flex-col items-center justify-center h-28 border-2 border-dashed rounded-lg cursor-pointer transition-colors',
                  dragOver
                    ? 'border-[#0A0A0A] bg-[#F5F5F5]'
                    : 'border-[#E5E5E5] hover:border-[#D4D4D4] bg-white',
                ].join(' ')}
              >
                {uploading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
                    <span className="text-[13px] text-[#A3A3A3]">Uploading...</span>
                  </div>
                ) : (
                  <>
                    <Upload size={18} strokeWidth={1.5} className="text-[#D4D4D4] mb-1.5" />
                    <p className="text-[13px] text-[#525252]">Drop clips here or <span className="underline">browse</span></p>
                    <p className="text-[11px] text-[#A3A3A3] mt-0.5">MP4, MOV, WebM, JPG, PNG</p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="video/*,image/*"
                className="hidden"
                onChange={e => e.target.files && uploadFiles(e.target.files)}
              />
              {uploadError && (
                <p className="mt-1.5 text-[12px] text-red-600">{uploadError}</p>
              )}
            </div>

            {/* Clip list */}
            {clips.length > 0 && (
              <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
                {clips.map((clip, i) => (
                  <div
                    key={clip.name}
                    className={`flex items-center justify-between px-3 py-2 ${i !== 0 ? 'border-t border-[#E5E5E5]' : ''}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Film size={12} strokeWidth={1.5} className="text-[#A3A3A3] flex-shrink-0" />
                      <span className="text-[13px] text-[#0A0A0A] truncate">{clip.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[12px] text-[#A3A3A3]">{clip.size_mb} MB</span>
                      <button
                        onClick={() => handleDeleteClip(clip.name)}
                        className="w-6 h-6 flex items-center justify-center text-[#A3A3A3] hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {clips.length === 0 && !uploading && (
              <p className="text-[12px] text-[#A3A3A3]">No clips uploaded yet. Add at least one clip to continue.</p>
            )}

            {/* Narration section */}
            <div className="border-t border-[#E5E5E5] pt-4">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-3">Narration</p>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => setNarrationMode('ai')}
                  className={[
                    'flex items-center gap-1.5 h-8 px-3 rounded text-[12px] font-medium border transition-colors',
                    narrationMode === 'ai'
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4]',
                  ].join(' ')}
                >
                  <Bot size={12} strokeWidth={1.5} />
                  AI Voice
                </button>
                <button
                  onClick={() => setNarrationMode('upload')}
                  className={[
                    'flex items-center gap-1.5 h-8 px-3 rounded text-[12px] font-medium border transition-colors',
                    narrationMode === 'upload'
                      ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                      : 'text-[#525252] border-[#E5E5E5] hover:border-[#D4D4D4]',
                  ].join(' ')}
                >
                  <Mic size={12} strokeWidth={1.5} />
                  Upload Audio
                </button>
              </div>

              {narrationMode === 'ai' && (
                <div>
                  <label className="block text-[11px] text-[#A3A3A3] mb-1.5">
                    Voice ID <span className="font-normal">(optional — leave blank for default)</span>
                  </label>
                  <input
                    type="text"
                    value={voiceId}
                    onChange={e => setVoiceId(e.target.value)}
                    placeholder="e.g. en-US-GuyNeural"
                    className="w-full h-8 px-3 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  />
                </div>
              )}

              {narrationMode === 'upload' && (
                <div>
                  <label className="block text-[11px] text-[#A3A3A3] mb-1.5">Audio file (MP3, WAV, M4A)</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => narrationInputRef.current?.click()}
                      className="flex items-center gap-1.5 h-8 px-3 text-[12px] text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] transition-colors"
                    >
                      <Upload size={12} strokeWidth={1.5} />
                      Choose file
                    </button>
                    {narrationFile && (
                      <span className="text-[12px] text-[#525252] truncate max-w-[200px]">{narrationFile}</span>
                    )}
                  </div>
                  <input
                    ref={narrationInputRef}
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && uploadNarration(e.target.files[0])}
                  />
                </div>
              )}
            </div>

            {/* Nav buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1 h-8 px-3 text-[12px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
              >
                <ArrowLeft size={12} strokeWidth={1.5} />
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={clips.length === 0}
                className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                Continue
                <span className="text-[#A3A3A3]">→</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: SEO & Run ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">

            {/* SEO Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">SEO Title</label>
                <button
                  onClick={handleAiGenerate}
                  disabled={aiGenerating}
                  className="flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0A0A0A] disabled:opacity-40 transition-colors"
                >
                  {aiGenerating
                    ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
                    : <Sparkles size={11} strokeWidth={1.5} />
                  }
                  AI Generate
                </button>
              </div>
              <input
                type="text"
                value={seoTitle}
                onChange={e => setSeoTitle(e.target.value)}
                placeholder={topic.trim() || 'Video title for YouTube'}
                className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Description
              </label>
              <textarea
                value={seoDesc}
                onChange={e => setSeoDesc(e.target.value)}
                placeholder="YouTube video description"
                rows={4}
                className="w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md resize-none focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Tags <span className="normal-case font-normal">(comma-separated)</span>
              </label>
              <input
                type="text"
                value={seoTags}
                onChange={e => setSeoTags(e.target.value)}
                placeholder="tag1, tag2, tag3"
                className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
              />
            </div>

            {/* Channel */}
            <div>
              <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                Channel
              </label>
              <select
                value={channelSlug}
                onChange={e => setChannelSlug(e.target.value)}
                className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
              >
                <option value="">Default channel</option>
                {channels.map(c => (
                  <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>
                ))}
              </select>
            </div>

            {/* Summary */}
            <div className="bg-[#F5F5F5] rounded-md px-3 py-3 space-y-1">
              <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1">Summary</p>
              <p className="text-[12px] text-[#525252]">
                <span className="font-medium text-[#0A0A0A]">Topic:</span> {topic}
              </p>
              <p className="text-[12px] text-[#525252]">
                <span className="font-medium text-[#0A0A0A]">Script:</span>{' '}
                {scriptText.trim().split(/\s+/).filter(Boolean).length} words
              </p>
              <p className="text-[12px] text-[#525252]">
                <span className="font-medium text-[#0A0A0A]">Clips:</span> {clips.length} uploaded
              </p>
              <p className="text-[12px] text-[#525252]">
                <span className="font-medium text-[#0A0A0A]">Narration:</span>{' '}
                {narrationMode === 'upload' && narrationFile ? narrationFile : 'AI voice'}
              </p>
            </div>

            {runError && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-md text-[12px] text-red-700">
                {runError}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1 h-8 px-3 text-[12px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
              >
                <ArrowLeft size={12} strokeWidth={1.5} />
                Back
              </button>
              <button
                onClick={handleRun}
                disabled={running || !topic.trim() || !scriptText.trim() || clips.length === 0}
                className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {running
                  ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Starting...</>
                  : <><Film size={13} strokeWidth={1.5} /> Run Pipeline</>
                }
              </button>
            </div>
          </div>
        )}

        {/* Status panel — always visible below when active */}
        <StatusPanel channelSlug={channelSlug} />

      </div>
    </div>
  )
}
