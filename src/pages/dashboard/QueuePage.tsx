import React, { useState, useEffect, useRef } from 'react'
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
  Clapperboard, Film, AlignLeft, CalendarClock, Sparkles, History, Check, ListChecks,
} from 'lucide-react'
import { useQueue, useQueueAdd, useQueueRemove, useQueueReorder } from '@hooks/useJobs'
import { useChannels } from '@hooks/useJobs'
import { calendarApi, schedulerApi } from '@api/services'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@components/Toast'
import { apiErrorMessage } from '@lib/apiError'
import AIIdeasModal from './AIIdeasModal'
import HistoryPanel from './HistoryPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueItem {
  id: number
  topic: string
  channel_slug?: string
  position?: number
  status?: string
  type?: string
  payload?: string | null  // JSON string from DB
  // When this item becomes runnable (timestamptz). NULL means "as soon as the queue reaches it".
  scheduled?: string | null
}

function toLocalInput(value?: string | null): string {
  // datetime-local wants local wall time; a bare date is read at noon so the day never shifts.
  if (!value) return ''
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
    + `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function formatScheduled(value?: string | null): string {
  if (!value) return ''
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function parsePayload(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { return {} }
}

function isShortItem(item: QueueItem): boolean {
  // Both labels are live data: `/api/queue/add` writes "Shorts" (plural) but `scripts/seed_channel_queue.py`
  // wrote "Short", and the seeded rows carry no payload. Matching only "Shorts" made 100 Shorts render as
  // "Video" — and, worse, "Run" fired the long-form pipeline. Compare case-insensitively and accept both.
  const p = parsePayload(item.payload)
  const contentType = String(p.content_type ?? '').toLowerCase()
  const typeLabel    = String(item.type ?? '').toLowerCase()
  return contentType === 'shorts' || contentType === 'short'
      || typeLabel === 'shorts' || typeLabel === 'short'
}

// ─── Sortable row ─────────────────────────────────────────────────────────────

function QueueRow({
  item,
  index,
  channels,
  onRemove,
  onRunNow,
  onSchedule,
  removing,
  runningId,
  flash,
  selectable,
  selected,
  onToggleSelect,
}: {
  item: QueueItem
  index: number
  channels: Array<{ slug: string; name?: string }>
  onRemove: (id: number) => void
  onRunNow: (item: QueueItem) => void
  onSchedule: (item: QueueItem) => void
  removing: number | null
  runningId: number | null
  flash?: boolean
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: number) => void
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

  // Show the channel's display name, not its slug. "truthnevershared" is the live slug behind
  // WildFactBook (the channel was renamed), so the raw slug read as a channel that no longer exists.
  // An unrecognised slug is called out instead of being silently printed as if it were a name.
  const channel = item.channel_slug
    ? channels.find(c => c.slug === item.channel_slug)
    : undefined
  const channelLabel   = channel?.name || item.channel_slug
  const channelUnknown = !!item.channel_slug && !channel

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-flash={flash ? 'true' : 'false'}
      className={[
        'group flex items-center gap-3 px-4 h-11 border-b border-[#E5E5E5] bg-white',
        'last:border-b-0 transition-colors',
        isDragging ? 'shadow-[0_4px_12px_rgba(0,0,0,0.10)] rounded-lg' : '',
        selected ? 'bg-[#FAFAFA]' : '',
        flash ? 'bg-[#ECFDF5] ring-1 ring-inset ring-[#A7F3D0]' : '',
      ].join(' ')}
    >
      {selectable && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(item.id) }}
          aria-label={selected ? 'Deselect topic' : 'Select topic'}
          className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            selected ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white' : 'bg-white border-[#D4D4D4] text-transparent hover:border-[#A3A3A3]'
          }`}
        >
          <Check size={11} strokeWidth={2} />
        </button>
      )}

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

      {/* Scheduled time, when set */}
      {item.scheduled && (
        <span
          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-medium text-[#7C3AED] bg-[#F5F3FF] border border-[#DDD6FE] px-1.5 py-0.5 rounded-sm"
          title={`Runs at ${new Date(item.scheduled).toLocaleString()}`}
        >
          <CalendarClock size={9} strokeWidth={2} />
          {formatScheduled(item.scheduled)}
        </span>
      )}

      {/* Channel badge — display name, slug on hover */}
      {item.channel_slug && (
        <span
          title={channelUnknown
            ? `Unknown channel slug "${item.channel_slug}" — it is not in your channel list`
            : item.channel_slug}
          className={[
            'flex-shrink-0 text-[10px] font-medium border px-2 py-0.5 rounded-sm',
            channelUnknown
              ? 'text-[#B45309] bg-[#FFFBEB] border-[#FDE68A]'
              : 'text-[#525252] bg-[#F5F5F5] border-[#E5E5E5]',
          ].join(' ')}
        >
          {channelUnknown ? `${channelLabel} (unknown)` : channelLabel}
        </span>
      )}

      {/* Actions - visible on hover */}
      {!selectable && (
      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onSchedule(item)}
          title="Add to calendar (choose date and time)"
          className="w-7 h-7 flex items-center justify-center rounded text-[#525252] bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#E5E5E5] transition-colors"
        >
          <CalendarClock size={11} strokeWidth={1.5} />
        </button>
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
      )}
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
  onAdd: (topic: string, channelSlug?: string, contentType?: string, scheduledDate?: string) => void
  channels: Array<{ slug: string; name?: string }>
  onCancel: () => void
  defaultChannelSlug?: string
}) {
  const [topic, setTopic] = useState('')
  const [channelSlug, setChannelSlug] = useState(defaultChannelSlug ?? '')
  const [contentType, setContentType] = useState<'video' | 'shorts'>('video')
  const [scheduledDate, setScheduledDate] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!topic.trim()) return
    onAdd(topic.trim(), channelSlug || undefined, contentType, scheduledDate || undefined)
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

      {/* Schedule (optional) */}
      <div className="flex items-center gap-2">
        <CalendarClock size={12} strokeWidth={1.5} className="text-[#A3A3A3]" />
        <input
          type="datetime-local"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
        />
        {scheduledDate && (
          <button
            type="button"
            onClick={() => setScheduledDate('')}
            className="text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-[10px] text-[#A3A3A3]">Optional — the topic stays queued and runs at this time.</span>
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
  channels: Array<{ slug: string; name?: string }>
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

// Stable empty-array reference - using an inline `[]` default in the `useQuery`
// destructure below creates a NEW array on every render whenever `data` is
// undefined, which changes identity every render. Combined with the
// `useEffect(..., [rawQueue])` further down, that caused an infinite
// render loop ("Maximum update depth exceeded") on this page.
const EMPTY_QUEUE: QueueItem[] = []

export default function QueuePage() {
  const navigate = useNavigate()
  const toast = useToast()

  const { data: rawChannels = [] } = useChannels()
  const channels = rawChannels as Array<{ slug: string; name?: string }>

  // Per-channel filter - '' means all channels
  const [filterSlug, setFilterSlug] = useState<string>('')

  const { data: rawQueue = EMPTY_QUEUE, isLoading, isError, refetch } = useQueue(filterSlug || undefined)
  const addMutation    = useQueueAdd()
  const removeMutation = useQueueRemove()
  const reorderMutation = useQueueReorder()
  const queryClient = useQueryClient()

  // Local copy for optimistic reorder
  const [items, setItems] = useState<QueueItem[]>([])
  const [showAddForm, setShowAddForm]   = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [view, setView] = useState<'queue' | 'history'>('queue')
  const [showAiModal, setShowAiModal] = useState(false)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [removingBulk, setRemovingBulk] = useState(false)
  const emptyStateOpen = !isLoading && items.length === 0 && !showAddForm && view === 'queue'
  const [flashing, setFlashing] = useState<Set<number>>(new Set())
  const prevCountRef = useRef(0)
  const [removingId, setRemovingId]     = useState<number | null>(null)
  const [runningId, setRunningId]       = useState<number | null>(null)
  // "Add to calendar" draft: which row is open, and the datetime-local value in the user's zone.
  const [scheduling, setScheduling]     = useState<{ id: number; value: string } | null>(null)
  const [savingSchedule, setSavingSchedule] = useState(false)

  // Sync server data into local state
  useEffect(() => {
    setItems(rawQueue as QueueItem[])
  }, [rawQueue])

  // Flash rows that were just appended so the creator sees where they landed (at the end),
  // and scroll the last one into view.
  useEffect(() => {
    const prev = prevCountRef.current
    prevCountRef.current = items.length
    if (items.length <= prev || prev <= 0) return
    const ids = items.slice(-(items.length - prev)).map((i) => i.id)
    setFlashing(new Set(ids))
    const raf = requestAnimationFrame(() => {
      const rows = document.querySelectorAll<HTMLElement>('[data-flash="true"]')
      rows[rows.length - 1]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
    const t = setTimeout(() => setFlashing(new Set()), 1600)
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [items])

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

  const toggleSelectionMode = () => {
    setSelectionMode((m) => {
      if (m) setSelectedIds(new Set())
      return !m
    })
  }

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)))

  const handleBulkRemove = async () => {
    if (!selectedIds.size) return
    const ids = [...selectedIds]
    setRemovingBulk(true)
    let removed = 0
    for (const id of ids) {
      try {
        await removeMutation.mutateAsync(id)
        removed++
      } catch {
        // keep going through the rest
      }
    }
    setRemovingBulk(false)
    setSelectedIds(new Set())
    setSelectionMode(false)
    if (removed) toast.success(`${removed} topic${removed !== 1 ? 's' : ''} removed`)
    else toast.error('Nothing was removed')
  }

  const handleAdd = async (topic: string, channelSlug?: string, contentType?: string, scheduledDate?: string) => {
    try {
      const payload = contentType ? { content_type: contentType } : undefined
      const res = await addMutation.mutateAsync({
        topic,
        channelSlug: channelSlug || filterSlug || undefined,
        contentType,
        payload,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
      })
      setShowAddForm(false)
      if (res?.duplicate) {
        toast.info(
          res.existing_status === 'in_queue'
            ? `"${topic}" is already in the queue`
            : `"${topic}" was already produced — use History → Re-add to run it again`,
          5000,
        )
      } else {
        toast.success(`"${topic}" added to the end of the queue`)
      }
    } catch {
      toast.error('Failed to add topic')
    }
  }

  const handleBulkAdd = async (topics: string[], channelSlug?: string, contentType?: string) => {
    let added = 0
    let skipped = 0
    const payload = contentType ? { content_type: contentType } : undefined
    for (const topic of topics) {
      try {
        const res = await addMutation.mutateAsync({
          topic,
          channelSlug: channelSlug || filterSlug || undefined,
          contentType,
          payload,
        })
        if (res?.duplicate) skipped++
        else added++
      } catch {
        // skip failed topics
      }
    }
    if (added && skipped) {
      toast.info(`${added} added · ${skipped} skipped as duplicates`)
    } else if (added) {
      toast.success(`${added} topic${added !== 1 ? 's' : ''} added to the end of the queue`)
    } else if (skipped) {
      toast.info(`${skipped} topic${skipped !== 1 ? 's' : ''} were duplicates, so nothing was added`)
    } else {
      toast.error('No topics added')
    }
  }

  const handleRunNow = async (item: QueueItem) => {
    const isShort = isShortItem(item)
    setRunningId(item.id)
    try {
      // Dequeue-and-run through the scheduler, NOT the pipeline endpoints directly.
      // The scheduler claims THIS row, routes a Short to the vertical-Short worker (not the
      // animated Kling pipeline) and a video to the long-form pipeline, then marks the row
      // done/failed. Calling `/api/shorts/pipeline/run` / `/api/pipeline/run` here rendered
      // the video but never touched the queue, so the row stayed pending forever — which is
      // what made "Run" look broken for Shorts.
      const started = await schedulerApi.runNext(item.channel_slug || undefined, item.id)
      toast.success(started?.topic ? `Running: ${started.topic}` : 'Run started')
      // Drop the claimed row from the list immediately instead of waiting for a refetch.
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      queryClient.invalidateQueries({ queryKey: ['queue'], exact: false })
      if (started?.job_id) {
        navigate(isShort
          ? `/app/shorts?job=${encodeURIComponent(started.job_id)}`
          : `/app/jobs/${started.job_id}`)
      } else {
        navigate(isShort ? '/app/shorts' : '/app/jobs')
      }
    } catch (err: any) {
      // Report every failure, not just 402 — a 404 ("no longer pending") or 503 is real.
      toast.error(apiErrorMessage(err, 'Failed to start run'))
      queryClient.invalidateQueries({ queryKey: ['queue'], exact: false })
    } finally {
      setRunningId(null)
    }
  }

  const handleRunNext = () => {
    if (items.length === 0) return
    handleRunNow(items[0])
  }

  // ── Add to calendar ─────────────────────────────────────────────────────
  const openScheduler = (item: QueueItem) => {
    setScheduling({
      id: item.id,
      // Default to today at the same wall-clock time as now, rounded up to the next half hour.
      value: toLocalInput(item.scheduled) || (() => {
        const d = new Date()
        d.setMinutes(d.getMinutes() + (30 - (d.getMinutes() % 30)), 0, 0)
        return toLocalInput(d.toISOString())
      })(),
    })
  }

  const saveScheduled = async (iso: string | null) => {
    if (!scheduling) return
    setSavingSchedule(true)
    try {
      await calendarApi.updateScheduled(scheduling.id, iso)
      toast.success(iso ? 'Added to your calendar' : 'Removed from the calendar')
      setScheduling(null)
      await refetch()
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not update the schedule'))
    } finally {
      setSavingSchedule(false)
    }
  }

  // ── Error state ──────────────────────────────────────────────────────────────
  // Must be checked before the empty-state fallback below - otherwise a failed
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
  if (emptyStateOpen) {
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
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <Sparkles size={13} strokeWidth={1.5} /> AI Ideas
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
            <button
              onClick={() => setView('history')}
              className="mt-1 text-[12px] font-medium text-[#A3A3A3] underline underline-offset-2 hover:text-[#525252] transition-colors"
            >
              View history →
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
        {/* The title is real, not a skeleton: it must be present from the first paint,
            so the page is never a nameless grey block (and an "is the page up?" check
            cannot race the data fetch). */}
        <div className="mb-6">
          <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Queue</h1>
          <div className="h-4 w-52 bg-[#F5F5F5] rounded animate-pulse mt-1.5" />
        </div>
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
              onClick={toggleSelectionMode}
              className={`flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded transition-colors ${
                selectionMode
                  ? 'bg-[#0A0A0A] text-white hover:bg-[#262626]'
                  : 'border border-[#E5E5E5] text-[#525252] hover:bg-[#F5F5F5]'
              }`}
            >
              {selectionMode ? <X size={13} strokeWidth={1.5} /> : <ListChecks size={13} strokeWidth={1.5} />}
              {selectionMode ? 'Cancel' : 'Select'}
            </button>
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <AlignLeft size={13} strokeWidth={1.5} /> Bulk Add
            </button>
            <button
              onClick={() => setShowAiModal(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
            >
              <Sparkles size={13} strokeWidth={1.5} /> AI Ideas
            </button>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors"
            >
              <Plus size={13} strokeWidth={1.5} /> Add Topic
            </button>
          </div>
        </div>

      {/* Queue / History tabs */}
      <div className="flex items-center gap-1 p-0.5 bg-[#F5F5F5] rounded w-fit mb-4">
        <button
          onClick={() => setView('queue')}
          className={`flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded transition-colors ${view === 'queue' ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#A3A3A3] hover:text-[#525252]'}`}
        >
          <ListOrdered size={12} strokeWidth={1.5} /> Queue
        </button>
        <button
          onClick={() => setView('history')}
          className={`flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded transition-colors ${view === 'history' ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#A3A3A3] hover:text-[#525252]'}`}
        >
          <History size={12} strokeWidth={1.5} /> History
        </button>
      </div>

      {/* Bulk selection bar */}
      {view === 'queue' && selectionMode && items.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 mb-4 bg-[#0A0A0A] text-white rounded-lg">
          <span className="text-[12px] font-medium">{selectedIds.size} selected</span>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAll}
              className="h-7 px-2.5 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
            >
              Select all
            </button>
            <button
              onClick={toggleSelectionMode}
              className="h-7 px-2.5 text-[11px] font-medium text-white/80 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkRemove}
              disabled={removingBulk || selectedIds.size === 0}
              className="h-7 px-2.5 text-[11px] font-semibold bg-[#DC2626] text-white rounded hover:bg-[#B91C1C] disabled:opacity-50 flex items-center gap-1 transition-colors"
            >
              {removingBulk ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <Trash2 size={11} strokeWidth={1.5} />}
              Delete selected
            </button>
          </div>
        </div>
      )}

      {/* Run Next banner */}
      {view === 'queue' && !selectionMode && items.length > 0 && (
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
      {view === 'queue' && (
      <div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
            {items.map((item, index) => (
              <React.Fragment key={item.id}>
                <QueueRow
                  item={item}
                  index={index}
                  channels={channels}
                  onRemove={handleRemove}
                  onRunNow={handleRunNow}
                  onSchedule={openScheduler}
                  removing={removingId}
                  runningId={runningId}
                  flash={flashing.has(item.id)}
                  selectable={selectionMode}
                  selected={selectedIds.has(item.id)}
                  onToggleSelect={toggleSelect}
                />

                {/* Add-to-calendar editor, inline under the row */}
                {scheduling?.id === item.id && (
                  <div className="flex items-end gap-2 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5]">
                    <div>
                      <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1">
                        Runs at (your time)
                      </label>
                      <input
                        type="datetime-local"
                        value={scheduling.value}
                        onChange={(e) => setScheduling({ ...scheduling, value: e.target.value })}
                        className="h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                    <button
                      onClick={() => saveScheduled(
                        scheduling.value ? new Date(scheduling.value).toISOString() : null)}
                      disabled={savingSchedule || !scheduling.value}
                      className="h-8 px-3 text-[11px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40 flex items-center gap-1.5"
                    >
                      {savingSchedule && <Loader2 size={11} strokeWidth={1.5} className="animate-spin" />}
                      Save
                    </button>
                    <button
                      onClick={() => saveScheduled(null)}
                      disabled={savingSchedule || !item.scheduled}
                      title="Take this topic off the calendar"
                      className="h-8 px-3 text-[11px] font-medium text-[#525252] border border-[#E5E5E5] bg-white rounded hover:border-[#D4D4D4] disabled:opacity-40"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => setScheduling(null)}
                      className="h-8 px-2 text-[11px] text-[#A3A3A3] hover:text-[#0A0A0A]"
                    >
                      Cancel
                    </button>
                    <p className="text-[10px] text-[#A3A3A3] pb-1.5">
                      It stays queued and runs at this time once your scheduler slot is reached.
                    </p>
                  </div>
                )}
              </React.Fragment>
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
      )}

      {/* History tab */}
      {view === 'history' && (
        <HistoryPanel channels={channels} defaultChannelSlug={filterSlug || undefined} />
      )}

      {/* Hint */}
      {view === 'queue' && (
        <p className="text-[11px] text-[#A3A3A3] mt-3">
          New topics are added to the end of the queue · Drag rows to reorder · Run to start now
        </p>
      )}

      {showAiModal && (
        <AIIdeasModal
          channels={channels}
          defaultChannelSlug={filterSlug || undefined}
          onClose={() => setShowAiModal(false)}
        />
      )}

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
