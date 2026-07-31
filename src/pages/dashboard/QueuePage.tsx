import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  GripVertical, Play, Trash2, Plus, X, Loader2, ListOrdered,
  Clapperboard, Film, AlignLeft, ChevronDown,
} from 'lucide-react'
import { useQueue, useQueueAdd, useQueueRemove, useQueueReorder } from '@hooks/useJobs'
import { useChannels } from '@hooks/useJobs'
import { jobsApi, shortsApi } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: number
  topic: string
  channel_slug?: string
  position?: number
  status?: string
  type?: string
  payload?: string | null  // JSON string from DB
}

function parsePayload(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function isShortItem(item: QueueItem): boolean {
  const p = parsePayload(item.payload)
  return p.content_type === 'shorts' || item.type === 'Shorts'
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function QueueRow({
  item,
  index,
  onRemove,
  onRunNow,
  removing,
  runningId,
}: {
  item: QueueItem
  index: number
  onRemove: (id: number) => void
  onRunNow: (item: QueueItem) => void
  removing: number | null
  runningId: number | null
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.85 : 1,
  }

  const isRemoving = removing === item.id
  const isRunning  = runningId === item.id
  const isShort    = isShortItem(item)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group flex items-center gap-3 px-4 h-11 border-b border-[#E5E5E5] bg-white',
        'last:border-b-0 transition-colors',
        isDragging ? 'shadow-[0_4px_12px_rgba(0,0,0,0.10)] rounded-lg' : '',
      ].join(' ')}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 text-[#D4D4D4] hover:text-[#A3A3A3] cursor-grab active:cursor-grabbing transition-colors"
        aria-label="Drag to reorder"
        tabIndex={-1}
      >
        <GripVertical size={14} strokeWidth={1.5} />
      </button>

      {/* Position */}
      <span className="w-5 flex-shrink-0 text-[11px] font-medium text-[#A3A3A3] text-right">
        {index + 1}
      </span>

      {/* Content type badge */}
      {isShort ? (
        <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0] px-1.5 py-0.5 rounded">
          <Clapperboard size={9} strokeWidth={2} /> Short
        </span>
      ) : (
        <span className="flex-shrink-0 flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase bg-[#F5F5F5] text-[#A3A3A3] border border-[#E5E5E5] px-1.5 py-0.5 rounded">
          <Film size={9} strokeWidth={2} /> Video
        </span>
      )}

      {/* Topic */}
      <span className="flex-1 text-[13px] text-[#0A0A0A] truncate" title={item.topic}>
        {item.topic}
      </span>

      {/* Channel badge */}
      {item.channel_slug && (
        <span className="flex-shrink-0 text-[10px] font-medium text-[#525252] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 rounded-sm">
          {item.channel_slug}
        </span>
      )}

      {/* Actions — visible on hover */}
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onRunNow(item)}
          disabled={!!isRunning}
          title="Run now"
          className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#0A0A0A] bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#E5E5E5] transition-colors disabled:opacity-40"
        >
          {isRunning ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <Play size={11} strokeWidth={1.5} />}
          Run
        </button>
        <button
          onClick={() => onRemove(item.id)}
          disabled={!!isRemoving}
          title="Remove from queue"
          className="p-1 rounded text-[#A3A3A3] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-40"
        >
          {isRemoving
            ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" />
            : <Trash2 size={13} strokeWidth={1.5} />
          }
        </button>
      </div>
    </div>
  )
}

// ─── Add topic form ───────────────────────────────────────────────────────────

function AddTopicForm({
  onAdd,
  channels,
  onCancel,
  defaultChannelSlug,
}: {
  onAdd: (topic: string, channelSlug?: string, contentType?: string) => void
  channels: Array<{ channel_slug: string; display_name?: string; name?: string }>
  onCancel: () => void
  defaultChannelSlug?: string
}) {
  const [topic, setTopic] = useState('')
  const [channelSlug, setChannelSlug] = useState(defaultChannelSlug ?? '')
  const [contentType, setContentType] = useState<'video' | 'shorts'>('video')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    onAdd(topic.trim(), channelSlug || undefined, contentType)
  }

  return (
    <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-[#E5E5E5] bg-[#FAFAFA] space-y-2">
      {/* Content type toggle */}
      <div className="flex items-center gap-1 p-0.5 bg-[#F5F5F5] rounded w-fit">
        {(['video', 'shorts'] as const).map((ct) => (
          <button
            key={ct}
            type="button"
            onClick={() => setContentType(ct)}
            className={`flex items-center gap-1.5 h-6 px-2.5 text-[11px] font-medium rounded transition-colors ${
              contentType === ct
                ? 'bg-white text-[#0A0A0A] shadow-sm'
                : 'text-[#A3A3A3] hover:text-[#525252]'
            }`}
          >
            {ct === 'shorts'
              ? <Clapperboard size={10} strokeWidth={1.5} />
              : <Film size={10} strokeWidth={1.5} />
            }
            {ct === 'shorts' ? 'Short' : 'Video'}
          </button>
        ))}
      </div>

      {/* Topic + channel row */}
      <div className="flex items-center gap-2">
        <input
          autoFocus
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder={contentType === 'shorts' ? 'Short idea or hook...' : 'Topic or video title...'}
          className="flex-1 h-8 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#A3A3A3]"
        />
        {channels.length > 1 && (
          <select
            value={channelSlug}
            onChange={(e) => setChannelSlug(e.target.value)}
            className="h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-[#525252]"
          >
            <option value="">Default channel</option>
            {channels.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name || c.slug}
              </option>
            ))}
          </select>
        )}
        <button
          type="submit"
          disabled={!topic.trim()}
          className="h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-8 w-8 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors rounded"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </form>
  )
}

// ─── Bulk add modal ───────────────────────────────────────────────────────────

function BulkAddModal({
  onAdd,
  channels,
  onClose,
  defaultChannelSlug,
}: {
  onAdd: (topics: string[], channelSlug?: string, contentType?: string) => Promise<void>
  channels: Array<{ channel_slug: string; display_name?: string; name?: string }>
  onClose: () => void
  defaultChannelSlug?: string
}) {
  const [text, setText] = useState('')
  const [channelSlug, setChannelSlug] = useState(defaultChannelSlug ?? '')
  const [contentType, setContentType] = useState<'video' | 'shorts'>('video')
  const [busy, setBusy] = useState(false)

  const topics = text.split('\n').map(t => t.trim()).filter(Boolean)

  const handle = async () => {
    if (!topics.length) return
    setBusy(true)
    await onAdd(topics.slice(0, 50), channelSlug || undefined, contentType)
    setBusy(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Bulk add topics"
    >
      <div className="bg-white rounded-xl border border-[#E5E5E5] w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-[#0A0A0A]">Bulk Add Topics</h3>
          <button onClick={onClose} className="text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Content type */}
        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Content type</label>
          <div className="flex items-center gap-1 p-0.5 bg-[#F5F5F5] rounded w-fit">
            {(['video', 'shorts'] as const).map((ct) => (
              <button
                key={ct}
                onClick={() => setContentType(ct)}
                className={`flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded transition-colors ${
                  contentType === ct
                    ? 'bg-white text-[#0A0A0A] shadow-sm'
                    : 'text-[#A3A3A3] hover:text-[#525252]'
                }`}
              >
                {ct === 'shorts'
                  ? <Clapperboard size={11} strokeWidth={1.5} />
                  : <Film size={11} strokeWidth={1.5} />
                }
                {ct === 'shorts' ? 'Shorts' : 'Videos'}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
            Topics <span className="normal-case font-normal">(one per line, max 50)</span>
          </label>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={contentType === 'shorts'
              ? 'Morning routine in 60 seconds\nBest productivity hacks\nHow to meditate daily\n...'
              : 'Why AI will change the world\nTop 10 productivity tips\nHow to invest in 2026\n...'}
            className="w-full px-3 py-2 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4] resize-none font-mono"
          />
          {topics.length > 0 && (
            <p className="mt-1 text-[11px] text-[#A3A3A3]">
              {topics.length} topic{topics.length !== 1 ? 's' : ''} detected
              {topics.length > 50 && <span className="text-[#B45309] ml-1">· first 50 will be added</span>}
            </p>
          )}
        </div>

        {/* Channel */}
        {channels.length > 1 && (
          <div className="mb-5">
            <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Channel</label>
            <select
              value={channelSlug}
              onChange={(e) => setChannelSlug(e.target.value)}
              className="w-full h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-[#525252]"
            >
              <option value="">Default channel</option>
              {channels.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name || c.slug}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 h-9 text-[12px] font-medium rounded border border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handle}
            disabled={busy || !topics.length}
            className="flex-1 h-9 text-[12px] font-medium rounded bg-[#0A0A0A] text-white hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
          >
            {busy
              ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />
              : <><AlignLeft size={12} strokeWidth={1.5} /> Add {Math.min(topics.length, 50) || ''} topics</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

// Stable empty-array reference — using an inline `[]` default in the `useQuery`
// destructure below creates a NEW array on every render whenever `data` is
// undefined, which changes identity every render. Combined with the
// `useEffect(..., [rawQueue])` further down, that caused an infinite
// render loop ("Maximum update depth exceeded") on this page.
const EMPTY_QUEUE: QueueItem[] = []

export default function QueuePage() {
  const navigate = useNavigate()
  const toast = useToast()

  const { data: rawChannels = [] } = useChannels()
  const channels = rawChannels as Array<{ channel_slug: string; display_name?: string; name?: string }>

  // Per-channel filter — '' means all channels
  const [filterSlug, setFilterSlug] = useState<string>('')

  const { data: rawQueue = EMPTY_QUEUE, isLoading, isError, refetch } = useQueue(filterSlug || undefined)
  const addMutation    = useQueueAdd()
  const removeMutation = useQueueRemove()
  const reorderMutation = useQueueReorder()

  // Local copy for optimistic reorder
  const [items, setItems] = useState<QueueItem[]>([])
  const [showAddForm, setShowAddForm]   = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [removingId, setRemovingId]     = useState<number | null>(null)
  const [runningId, setRunningId]       = useState<number | null>(null)

  // Sync server data into local state
  useEffect(() => {
    setItems(rawQueue as QueueItem[])
  }, [rawQueue])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = items.findIndex((i) => i.id === active.id)
    const newIdx = items.findIndex((i) => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx)
    setItems(reordered) // optimistic
    reorderMutation.mutate(reordered.map((i) => i.id))
  }

  const handleRemove = async (id: number) => {
    setRemovingId(id)
    try {
      await removeMutation.mutateAsync(id)
      toast.success('Topic removed from queue')
    } catch {
      toast.error('Failed to remove topic')
    } finally {
      setRemovingId(null)
    }
  }

  const handleAdd = async (topic: string, channelSlug?: string, contentType?: string) => {
    try {
      const payload = contentType ? { content_type: contentType } : undefined
      await addMutation.mutateAsync({
        topic,
        channelSlug: channelSlug || filterSlug || undefined,
        contentType,
        payload,
      })
      setShowAddForm(false)
      toast.success(`"${topic}" added to queue`)
    } catch {
      toast.error('Failed to add topic')
    }
  }

  const handleBulkAdd = async (topics: string[], channelSlug?: string, contentType?: string) => {
    let added = 0
    const payload = contentType ? { content_type: contentType } : undefined
    for (const topic of topics) {
      try {
        await addMutation.mutateAsync({
          topic,
          channelSlug: channelSlug || filterSlug || undefined,
          contentType,
          payload,
        })
        added++
      } catch {
        // skip failed topics
      }
    }
    toast.success(`${added} topic${added !== 1 ? 's' : ''} added to queue`)
  }

  const handleRunNow = async (item: QueueItem) => {
    const meta    = parsePayload(item.payload)
    const isShort = isShortItem(item)
    setRunningId(item.id)
    try {
      if (isShort) {
        await shortsApi.pipelineRun({
          topic: item.topic,
          aspect_ratio: (meta.aspect_ratio as string) || '9:16',
          channel_slug: item.channel_slug,
        })
        toast.success('Shorts pipeline started')
        navigate('/app/shorts')
      } else {
        const result = await jobsApi.run({ topic: item.topic, channel_slug: item.channel_slug })
        toast.success('Pipeline started')
        if ((result as any)?.job_id) navigate(`/app/jobs/${(result as any).job_id}`)
        else navigate('/app/jobs')
      }
    } catch (err: any) {
      const status = err?.response?.status
      const detail = err?.response?.data?.detail
      if (status === 402 && detail?.code === 'plan_limit_reached') {
        toast.error(`Plan limit reached (${detail.used}/${detail.limit})`)
      } else {
        toast.error(err?.response?.data?.detail ?? 'Failed to start pipeline')
      }
    } finally {
      setRunningId(null)
    }
  }

  const handleRunNext = () => {
    if (items.length === 0) return
    handleRunNow(items[0])
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  // Must be checked before the empty-state fallback below — otherwise a failed
  // fetch silently renders "Queue is empty", misleading the user into thinking
  // they have no pending topics when the real issue is a network/server error.
  if (isError && !isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A] mb-6">Queue</h1>
        <div className="border border-[#E5E5E5] rounded-lg bg-white py-16 flex flex-col items-center gap-3">
          <ListOrdered size={28} strokeWidth={1} className="text-[#DC2626]" />
          <p className="text-[14px] font-medium text-[#525252]">Couldn't load the queue</p>
          <p className="text-[12px] text-[#A3A3A3]">The server didn't respond in time. Check your connection and try again.</p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-[12px] font-medium text-[#0A0A0A] underline underline-offset-2 hover:text-[#525252] transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!isLoading && items.length === 0 && !showAddForm) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Queue</h1>
            <p className="text-[13px] text-[#525252] mt-0.5">Topics waiting to be turned into videos</p>
          </div>
          <div className="flex items-center gap-2">
            {channels.length > 1 && (
              <select
                value={filterSlug}
                onChange={(e) => setFilterSlug(e.target.value)}
                className="h-8 pl-3 pr-7 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-[#525252] appearance-none"
              >
                <option value="">All channels</option>
                {channels.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name || c.slug}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <AlignLeft size={13} strokeWidth={1.5} /> Bulk Add
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
            >
              <Plus size={13} strokeWidth={1.5} /> Add Topic
            </button>
          </div>
        </div>

        <div className="border border-[#E5E5E5] rounded-lg bg-white">
          {showAddForm && (
            <AddTopicForm
              onAdd={handleAdd}
              channels={channels}
              onCancel={() => setShowAddForm(false)}
              defaultChannelSlug={filterSlug || undefined}
            />
          )}
          <div className="py-16 flex flex-col items-center gap-3">
            <ListOrdered size={28} strokeWidth={1} className="text-[#D4D4D4]" />
            <p className="text-[14px] font-medium text-[#525252]">Queue is empty</p>
            <p className="text-[12px] text-[#A3A3A3]">Add topics here and run them one by one, or set up the scheduler to run automatically.</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-[12px] font-medium text-[#0A0A0A] underline underline-offset-2 hover:text-[#525252] transition-colors"
            >
              Add your first topic →
            </button>
          </div>
        </div>

        {showBulkModal && (
          <BulkAddModal
            onAdd={handleBulkAdd}
            channels={channels}
            onClose={() => setShowBulkModal(false)}
            defaultChannelSlug={filterSlug || undefined}
          />
        )}
      </div>
    )
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="h-7 w-24 bg-[#F5F5F5] rounded animate-pulse mb-6" />
        <div className="border border-[#E5E5E5] rounded-lg overflow-hidden">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-11 border-b border-[#E5E5E5] bg-white px-4 flex items-center gap-3 last:border-b-0">
              <div className="w-3.5 h-3.5 bg-[#F5F5F5] rounded animate-pulse" />
              <div className="w-5 h-3 bg-[#F5F5F5] rounded animate-pulse" />
              <div className="flex-1 h-3 bg-[#F5F5F5] rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Main view ────────────────────────────────────────────────────────────────
  const videoCount  = items.filter(i => !isShortItem(i)).length
  const shortsCount = items.filter(i => isShortItem(i)).length

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Queue</h1>
          <p className="text-[13px] text-[#525252] mt-0.5">
            {videoCount > 0 && <span>{videoCount} video{videoCount !== 1 ? 's' : ''}</span>}
            {videoCount > 0 && shortsCount > 0 && <span className="mx-1 text-[#D4D4D4]">·</span>}
            {shortsCount > 0 && <span>{shortsCount} short{shortsCount !== 1 ? 's' : ''}</span>}
            {filterSlug && <span className="ml-1 text-[#A3A3A3]">in <span className="text-[#525252] font-medium">{filterSlug}</span></span>}
          </p>
        </div>
          <div className="flex items-center gap-2">
            {channels.length > 1 && (
              <select
                value={filterSlug}
                onChange={(e) => setFilterSlug(e.target.value)}
                className="h-8 pl-3 pr-7 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors text-[#525252] appearance-none"
              >
                <option value="">All channels</option>
                {channels.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name || c.slug}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <AlignLeft size={13} strokeWidth={1.5} /> Bulk Add
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
            >
              <Plus size={13} strokeWidth={1.5} /> Add Topic
            </button>
          </div>
        </div>

      {/* Run Next banner */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 mb-4 bg-[#0A0A0A] text-white rounded-lg">
          <button
            onClick={handleRunNext}
            disabled={!!runningId}
            className="flex-shrink-0 flex items-center gap-1.5 h-7 px-3 text-[11px] font-semibold border border-white/30 rounded hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {runningId === items[0]?.id
              ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />
              : <Play size={11} strokeWidth={1.5} />
            }
            Run Next
          </button>
          <span className="text-[12px] text-white/60 truncate">
            Next: <span className="text-white font-medium">{items[0]?.topic}</span>
            {isShortItem(items[0]) && (
              <span className="ml-2 text-[9px] font-bold tracking-widest text-amber-400">SHORT</span>
            )}
          </span>
        </div>
      )}

      {/* Queue list */}
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <QueueRow
                key={item.id}
                item={item}
                index={index}
                onRemove={handleRemove}
                onRunNow={handleRunNow}
                removing={removingId}
                runningId={runningId}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Add form inline at bottom */}
        {showAddForm && (
          <AddTopicForm
            onAdd={handleAdd}
            channels={channels}
            onCancel={() => setShowAddForm(false)}
            defaultChannelSlug={filterSlug || undefined}
          />
        )}
      </div>

      {/* Hint + bulk modal */}
      <p className="text-[11px] text-[#A3A3A3] mt-3">
        Drag rows to reorder · Click Run to start the pipeline immediately
      </p>

      {showBulkModal && (
        <BulkAddModal
          onAdd={handleBulkAdd}
          channels={channels}
          onClose={() => setShowBulkModal(false)}
          defaultChannelSlug={filterSlug || undefined}
        />
      )}
    </div>
  )
}
