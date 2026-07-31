import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  RefreshCw, Film, Info, Upload, Scissors, Plus, Trash2,
  ExternalLink, Loader2, Sparkles, ChevronRight,
} from 'lucide-react'
import { studioApi, channelsApi } from '@api/services'
import { Link } from 'react-router-dom'

// ── Types ─────────────────────────────────────────────────────────────────────

interface VideoFile {
  name: string
  path: string
  size_mb: number
  dir: string
  mtime: number
}

interface VideoInfo {
  ok: boolean
  name: string
  path: string
  duration: number
  duration_str: string
  width: number
  height: number
  codec: string
  fps: number
  size_mb: number
  error?: string
}

interface ClipRow {
  id: string
  start: string
  end: string
  label: string
}

type ActiveTab = 'upload' | 'extract'

// ── Helper ────────────────────────────────────────────────────────────────────

function dirBadge(dir: string): string {
  if (dir.includes('shorts')) return 'shorts'
  if (dir.includes('clips')) return 'clips'
  return 'output'
}

function relTime(mtime: number): string {
  const diff = Math.floor((Date.now() / 1000) - mtime)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusMsg({ type, text }: { type: 'success' | 'error'; text: string }) {
  return (
    <div className={`mt-3 px-3 py-2 rounded-md text-[13px] ${
      type === 'success'
        ? 'bg-green-50 text-green-800 border border-green-200'
        : 'bg-red-50 text-red-700 border border-red-200'
    }`}>
      {text}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function StudioPage() {
  const qc = useQueryClient()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload')

  // Upload tab state
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDesc, setUploadDesc] = useState('')
  const [uploadTags, setUploadTags] = useState('')
  const [uploadChannel, setUploadChannel] = useState('')
  const [uploadResult, setUploadResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [uploading, setUploading] = useState(false)

  // Extract tab state
  const [clipRows, setClipRows] = useState<ClipRow[]>([
    { id: '1', start: '0', end: '60', label: 'clip-1' },
  ])
  const [extractResult, setExtractResult] = useState<any>(null)
  const [extracting, setExtracting] = useState(false)
  const [uploadingShorts, setUploadingShorts] = useState(false)
  const [shortsResult, setShortsResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Data queries
  const { data: videosData, isFetching: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ['studio-videos'],
    queryFn: studioApi.videos,
  })

  const { data: videoInfo, isLoading: infoLoading } = useQuery({
    queryKey: ['studio-info', selectedPath],
    queryFn: () => studioApi.info(selectedPath!),
    enabled: !!selectedPath,
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const videos: VideoFile[] = videosData?.videos ?? []
  const channels: any[] = channelsData ?? []
  const info: VideoInfo | null = videoInfo ?? null

  // ── Handlers ───────────────────────────────────────────────────────────────

  async function handleAiGenerate() {
    if (!uploadTitle.trim()) return
    setAiGenerating(true)
    try {
      const result = await studioApi.generateMetadata(uploadTitle.trim(), uploadChannel || undefined)
      if (result.ok) {
        if (result.description) setUploadDesc(result.description)
        if (result.tags?.length) setUploadTags(result.tags.join(', '))
      }
    } catch {
      // silent
    } finally {
      setAiGenerating(false)
    }
  }

  async function handleUploadMain() {
    if (!selectedPath || !uploadTitle.trim()) return
    setUploading(true)
    setUploadResult(null)
    try {
      const tagsArr = uploadTags.split(',').map(t => t.trim()).filter(Boolean)
      const result = await studioApi.uploadMain({
        video_path: selectedPath,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        tags: tagsArr,
        channel: uploadChannel || undefined,
      })
      if (result.ok) {
        setUploadResult({ type: 'success', text: `Uploaded! ${result.url ?? ''}` })
      } else {
        setUploadResult({ type: 'error', text: result.error ?? 'Upload failed' })
      }
    } catch (e: any) {
      setUploadResult({ type: 'error', text: e?.message ?? 'Upload failed' })
    } finally {
      setUploading(false)
    }
  }

  function addClipRow() {
    const id = String(Date.now())
    const num = clipRows.length + 1
    setClipRows(rows => [...rows, { id, start: '0', end: '60', label: `clip-${num}` }])
  }

  function removeClipRow(id: string) {
    setClipRows(rows => rows.filter(r => r.id !== id))
  }

  function updateClipRow(id: string, field: 'start' | 'end' | 'label', value: string) {
    setClipRows(rows => rows.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function handleExtract() {
    if (!selectedPath) return
    setExtracting(true)
    setExtractResult(null)
    setShortsResult(null)
    try {
      const clips = clipRows.map(r => ({
        start: parseFloat(r.start) || 0,
        end: parseFloat(r.end) || 60,
        label: r.label.trim() || 'clip',
      }))
      const result = await studioApi.extractClips(selectedPath, clips)
      setExtractResult(result)
    } catch (e: any) {
      setExtractResult({ ok: false, error: e?.message ?? 'Extract failed' })
    } finally {
      setExtracting(false)
    }
  }

  async function handleUploadShorts() {
    if (!extractResult?.clips) return
    const successPaths = (extractResult.clips as any[])
      .filter(c => c.path && !c.error)
      .map(c => c.path)
    if (!successPaths.length) return

    setUploadingShorts(true)
    setShortsResult(null)
    try {
      const result = await studioApi.uploadClips({
        clip_paths: successPaths,
        title: uploadTitle.trim() || 'Clip',
        description: uploadDesc.trim(),
        tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
        channel: uploadChannel || undefined,
        youtube_shorts: true,
        social_platforms: false,
      })
      if (result.ok) {
        setShortsResult({ type: 'success', text: `Uploaded ${successPaths.length} clip(s) to YouTube Shorts` })
      } else {
        setShortsResult({ type: 'error', text: result.error ?? 'Upload failed' })
      }
    } catch (e: any) {
      setShortsResult({ type: 'error', text: e?.message ?? 'Upload failed' })
    } finally {
      setUploadingShorts(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-[#FAFAFA]">

      {/* ── Left: Video browser ────────────────────────────────────────────── */}
      <aside className="w-[280px] flex-shrink-0 bg-white border-r border-[#E5E5E5] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Video Files</h2>
          <button
            onClick={() => refetchVideos()}
            disabled={videosLoading}
            className="w-7 h-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded transition-colors disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={videosLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {videosLoading && !videos.length ? (
            <div className="flex items-center justify-center h-24 text-[12px] text-[#A3A3A3]">Loading...</div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Film size={20} strokeWidth={1.5} className="text-[#D4D4D4]" />
              <p className="text-[12px] text-[#A3A3A3]">No video files found</p>
              <p className="text-[11px] text-[#D4D4D4]">Run a pipeline to generate videos</p>
            </div>
          ) : (
            <ul className="py-1">
              {videos.map((v) => {
                const isSelected = v.path === selectedPath
                return (
                  <li key={v.path}>
                    <button
                      onClick={() => {
                        setSelectedPath(v.path)
                        setUploadResult(null)
                        setExtractResult(null)
                        setShortsResult(null)
                      }}
                      className={[
                        'w-full text-left px-4 py-2.5 transition-colors group',
                        isSelected
                          ? 'border-l-[3px] border-[#0A0A0A] bg-[#F5F5F5]'
                          : 'border-l-[3px] border-transparent hover:bg-[#F5F5F5]',
                      ].join(' ')}
                    >
                      <p className={`text-[13px] truncate ${isSelected ? 'font-semibold text-[#0A0A0A]' : 'text-[#0A0A0A]'}`}>
                        {v.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-[#A3A3A3]">{v.size_mb} MB</span>
                        <span className="text-[#D4D4D4]">·</span>
                        <span className="text-[10px] text-[#A3A3A3] bg-[#F5F5F5] border border-[#E5E5E5] px-1.5 py-px rounded-sm">
                          {dirBadge(v.dir)}
                        </span>
                        <span className="text-[11px] text-[#A3A3A3]">{relTime(v.mtime)}</span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Custom Studio link */}
        <div className="px-4 py-3 border-t border-[#E5E5E5]">
          <Link
            to="/app/studio/custom"
            className="flex items-center gap-1.5 text-[12px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
          >
            <Scissors size={12} strokeWidth={1.5} />
            <span>Custom Studio</span>
            <ChevronRight size={12} strokeWidth={1.5} className="ml-auto" />
          </Link>
        </div>
      </aside>

      {/* ── Right: Main content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto p-6">
        {!selectedPath ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Film size={32} strokeWidth={1.5} className="text-[#D4D4D4]" />
            <p className="text-[14px] text-[#525252]">Select a video from the list</p>
            <p className="text-[12px] text-[#A3A3A3]">Browse your local output/ files on the left</p>
          </div>
        ) : (
          <div className="max-w-2xl">

            {/* Video metadata row */}
            <div className="mb-5">
              <h1 className="text-[18px] font-semibold text-[#0A0A0A] mb-2 truncate">
                {info?.name ?? videos.find(v => v.path === selectedPath)?.name}
              </h1>
              {infoLoading ? (
                <div className="flex items-center gap-2 text-[12px] text-[#A3A3A3]">
                  <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
                  Probing metadata...
                </div>
              ) : info?.ok ? (
                <div className="flex flex-wrap items-center gap-3">
                  {[
                    `${info.width}×${info.height}`,
                    info.duration_str,
                    info.codec?.toUpperCase(),
                    `${info.fps} fps`,
                    `${info.size_mb} MB`,
                  ].map((val, i) => (
                    <span key={i} className="text-[12px] text-[#525252] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 rounded">
                      {val}
                    </span>
                  ))}
                </div>
              ) : info && !info.ok ? (
                <p className="text-[12px] text-red-600">{info.error}</p>
              ) : null}
            </div>

            {/* Tab nav */}
            <div className="flex gap-6 border-b border-[#E5E5E5] mb-5">
              {(['upload', 'extract'] as ActiveTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={[
                    'pb-2.5 text-[13px] font-medium transition-colors capitalize',
                    activeTab === tab
                      ? 'text-[#0A0A0A] border-b-2 border-[#0A0A0A]'
                      : 'text-[#A3A3A3] hover:text-[#525252]',
                  ].join(' ')}
                >
                  {tab === 'upload' ? 'Upload to YouTube' : 'Extract Clips'}
                </button>
              ))}
            </div>

            {/* ── Upload tab ──────────────────────────────────────────────── */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                {/* Title + AI generate */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Title</label>
                    <button
                      onClick={handleAiGenerate}
                      disabled={aiGenerating || !uploadTitle.trim()}
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
                    value={uploadTitle}
                    onChange={e => setUploadTitle(e.target.value)}
                    placeholder="Video title"
                    className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-1.5">
                    Description
                  </label>
                  <textarea
                    value={uploadDesc}
                    onChange={e => setUploadDesc(e.target.value)}
                    placeholder="Video description"
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
                    value={uploadTags}
                    onChange={e => setUploadTags(e.target.value)}
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
                    value={uploadChannel}
                    onChange={e => setUploadChannel(e.target.value)}
                    className="w-full h-9 px-3 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md focus:outline-none focus:border-[#0A0A0A] transition-colors"
                  >
                    <option value="">Default channel</option>
                    {channels.map(c => (
                      <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>
                    ))}
                  </select>
                </div>

                {uploadResult && <StatusMsg type={uploadResult.type} text={uploadResult.text} />}

                {uploadResult?.type === 'success' && uploadResult.text.includes('youtube.com') && (
                  <a
                    href={uploadResult.text.split(' ').find(w => w.startsWith('http'))}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-[#2563EB] hover:underline"
                  >
                    <ExternalLink size={13} strokeWidth={1.5} />
                    View on YouTube
                  </a>
                )}

                <button
                  onClick={handleUploadMain}
                  disabled={uploading || !uploadTitle.trim()}
                  className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {uploading
                    ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Uploading...</>
                    : <><Upload size={13} strokeWidth={1.5} /> Upload to YouTube</>
                  }
                </button>
              </div>
            )}

            {/* ── Extract Clips tab ────────────────────────────────────────── */}
            {activeTab === 'extract' && (
              <div className="space-y-4">
                {/* Clip rows */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Time Ranges</p>
                    <button
                      onClick={addClipRow}
                      className="flex items-center gap-1 text-[11px] text-[#525252] hover:text-[#0A0A0A] transition-colors"
                    >
                      <Plus size={11} strokeWidth={1.5} />
                      Add clip
                    </button>
                  </div>
                  <div className="space-y-2">
                    {clipRows.map((row, idx) => (
                      <div key={row.id} className="flex items-center gap-2">
                        <span className="text-[11px] text-[#A3A3A3] w-4 flex-shrink-0">{idx + 1}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input
                            type="number"
                            value={row.start}
                            onChange={e => updateClipRow(row.id, 'start', e.target.value)}
                            placeholder="0"
                            className="w-16 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                            min="0"
                          />
                          <span className="text-[11px] text-[#A3A3A3]">–</span>
                          <input
                            type="number"
                            value={row.end}
                            onChange={e => updateClipRow(row.id, 'end', e.target.value)}
                            placeholder="60"
                            className="w-16 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-center"
                            min="0"
                          />
                          <span className="text-[11px] text-[#A3A3A3]">s</span>
                        </div>
                        <input
                          type="text"
                          value={row.label}
                          onChange={e => updateClipRow(row.id, 'label', e.target.value)}
                          placeholder="clip label"
                          className="flex-1 h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
                        />
                        <button
                          onClick={() => removeClipRow(row.id)}
                          disabled={clipRows.length === 1}
                          className="w-7 h-7 flex items-center justify-center text-[#A3A3A3] hover:text-red-500 disabled:opacity-30 transition-colors rounded"
                        >
                          <Trash2 size={12} strokeWidth={1.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleExtract}
                  disabled={extracting}
                  className="flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {extracting
                    ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Extracting...</>
                    : <><Scissors size={13} strokeWidth={1.5} /> Extract Clips</>
                  }
                </button>

                {/* Extracted clips result */}
                {extractResult && (
                  <div className="mt-4">
                    {extractResult.ok === false ? (
                      <StatusMsg type="error" text={extractResult.error ?? 'Extract failed'} />
                    ) : (
                      <div>
                        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide mb-2">
                          Extracted Clips
                        </p>
                        <div className="border border-[#E5E5E5] rounded-md overflow-hidden">
                          {(extractResult.clips as any[]).map((clip, i) => (
                            <div
                              key={i}
                              className={`flex items-center justify-between px-3 py-2 text-[13px] ${
                                i !== 0 ? 'border-t border-[#E5E5E5]' : ''
                              }`}
                            >
                              <span className="text-[#0A0A0A] font-medium">{clip.label}</span>
                              {clip.error ? (
                                <span className="text-[12px] text-red-600">{clip.error}</span>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.duration}s</span>
                                  <span className="text-[12px] text-[#A3A3A3]">{clip.size_mb} MB</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {shortsResult && <StatusMsg type={shortsResult.type} text={shortsResult.text} />}

                        <button
                          onClick={handleUploadShorts}
                          disabled={uploadingShorts}
                          className="mt-3 flex items-center gap-2 h-9 px-4 bg-[#0A0A0A] text-white text-[13px] font-medium rounded-md hover:bg-[#262626] disabled:opacity-40 transition-colors"
                        >
                          {uploadingShorts
                            ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Uploading...</>
                            : <><Upload size={13} strokeWidth={1.5} /> Upload to YouTube Shorts</>
                          }
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  )
}
