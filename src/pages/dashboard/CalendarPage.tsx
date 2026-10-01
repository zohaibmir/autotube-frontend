import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft, ChevronRight, X, ExternalLink, Plus,
  Calendar, Loader2, Check,
} from 'lucide-react'
import { calendarApi, queueApi, channelsApi } from '@api/services'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalendarEvent {
  id: string
  source: 'queue' | 'video'
  type: string
  title: string
  status: string
  scheduled_date?: string
  published_date?: string
  youtube_id?: string
  channel_slug?: string
  queue_id?: number
  video_id?: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildGrid(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  // Monday-first: Mon=0, Sun=6
  const leadDays = (first.getDay() + 6) % 7

  const cells: Date[] = []
  for (let i = leadDays - 1; i >= 0; i--) {
    cells.push(new Date(year, month, -i))
  }
  for (let d = 1; d <= last.getDate(); d++) {
    cells.push(new Date(year, month, d))
  }
  // Fill trailing to complete last week
  while (cells.length % 7 !== 0) {
    cells.push(new Date(year, month + 1, cells.length - last.getDate() - leadDays + 1))
  }

  const grid: Date[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    grid.push(cells.slice(i, i + 7))
  }
  return grid
}

function isToday(d: Date): boolean {
  const t = new Date()
  return d.getDate() === t.getDate() &&
    d.getMonth() === t.getMonth() &&
    d.getFullYear() === t.getFullYear()
}

function isCurrentMonth(d: Date, year: number, month: number): boolean {
  return d.getFullYear() === year && d.getMonth() === month
}

// ── Event Pill ────────────────────────────────────────────────────────────────

function EventPill({
  event,
  onClick,
  isActive,
}: {
  event: CalendarEvent
  onClick: (e: React.MouseEvent) => void
  isActive: boolean
}) {
  const isPublished = event.source === 'video'
  return (
    <button
      onClick={onClick}
      title={event.title}
      className={[
        'w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium border transition-colors mb-0.5 leading-tight',
        isActive
          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
          : isPublished
          ? 'bg-green-50 text-green-800 border-green-200 hover:bg-green-100'
          : 'bg-[#F5F5F5] text-[#525252] border-[#E5E5E5] hover:bg-[#EFEFEF]',
      ].join(' ')}
    >
      {event.title}
    </button>
  )
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  event,
  onClose,
  onReschedule,
  rescheduling,
}: {
  event: CalendarEvent
  onClose: () => void
  onReschedule: (queueId: number, date: string | null) => void
  rescheduling: boolean
}) {
  const [newDate, setNewDate] = useState(event.scheduled_date ?? '')
  const isPublished = event.source === 'video'
  const date = event.published_date ?? event.scheduled_date ?? ''

  return (
    <aside className="w-[260px] flex-shrink-0 bg-white border-l border-[#E5E5E5] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E5E5]">
        <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">
          {isPublished ? 'Published Video' : 'Planned Topic'}
        </p>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors rounded"
        >
          <X size={13} strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* Title */}
        <div>
          <p className="text-[14px] font-semibold text-[#0A0A0A] leading-snug">{event.title}</p>
        </div>

        {/* Meta */}
        <div className="space-y-1.5">
          {event.channel_slug && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#A3A3A3] w-16">Channel</span>
              <span className="text-[12px] text-[#525252] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 rounded">
                {event.channel_slug}
              </span>
            </div>
          )}
          {date && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[#A3A3A3] w-16">
                {isPublished ? 'Published' : 'Scheduled'}
              </span>
              <span className="text-[12px] text-[#525252]">{date}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[#A3A3A3] w-16">Status</span>
            <span className={[
              'text-[10px] font-medium px-1.5 py-0.5 rounded border',
              isPublished
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-[#F5F5F5] text-[#525252] border-[#E5E5E5]',
            ].join(' ')}>
              {event.status}
            </span>
          </div>
        </div>

        {/* Actions */}
        {isPublished && event.youtube_id && (
          <a
            href={`https://www.youtube.com/watch?v=${event.youtube_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[12px] text-[#2563EB] hover:underline"
          >
            <ExternalLink size={12} strokeWidth={1.5} />
            View on YouTube
          </a>
        )}

        {!isPublished && event.queue_id && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium text-[#A3A3A3] uppercase tracking-wide">Reschedule</p>
            <input
              type="date"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="w-full h-8 px-2 text-[12px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => event.queue_id && onReschedule(event.queue_id, newDate || null)}
                disabled={rescheduling}
                className="flex items-center gap-1.5 h-7 px-3 bg-[#0A0A0A] text-white text-[11px] font-medium rounded hover:bg-[#262626] disabled:opacity-40 transition-colors"
              >
                {rescheduling
                  ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
                  : <Check size={10} strokeWidth={1.5} />
                }
                Save
              </button>
              <button
                onClick={() => event.queue_id && onReschedule(event.queue_id, null)}
                disabled={rescheduling}
                className="text-[11px] text-[#A3A3A3] hover:text-red-600 disabled:opacity-40 transition-colors"
              >
                Remove date
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

// ── Quick Add Form ─────────────────────────────────────────────────────────────

function QuickAddForm({
  date,
  channels,
  onSubmit,
  onCancel,
  loading,
}: {
  date: string
  channels: any[]
  onSubmit: (topic: string, channelSlug: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [topic, setTopic] = useState('')
  const [channel, setChannel] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && topic.trim()) {
      onSubmit(topic.trim(), channel)
    }
    if (e.key === 'Escape') {
      onCancel()
    }
  }

  return (
    <div className="mt-1 p-1.5 bg-white border border-[#0A0A0A] rounded-md shadow-dropdown z-10">
      <input
        ref={inputRef}
        type="text"
        value={topic}
        onChange={e => setTopic(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Topic..."
        className="w-full text-[11px] text-[#0A0A0A] placeholder-[#A3A3A3] bg-transparent border-none outline-none"
      />
      {channels.length > 0 && (
        <select
          value={channel}
          onChange={e => setChannel(e.target.value)}
          className="w-full mt-1 text-[10px] text-[#525252] bg-transparent border-none outline-none"
        >
          <option value="">Default channel</option>
          {channels.map(c => (
            <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>
          ))}
        </select>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <button
          onClick={() => topic.trim() && onSubmit(topic.trim(), channel)}
          disabled={loading || !topic.trim()}
          className="flex items-center gap-1 h-5 px-2 bg-[#0A0A0A] text-white text-[10px] rounded disabled:opacity-40"
        >
          {loading ? <Loader2 size={9} strokeWidth={1.5} className="animate-spin" /> : null}
          Add
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] text-[#A3A3A3] hover:text-[#525252]"
        >
          Esc
        </button>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const qc = useQueryClient()

  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [channelFilter, setChannelFilter] = useState('')
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null)
  const [addingToDay, setAddingToDay] = useState<string | null>(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const grid  = buildGrid(year, month)

  // Date range for API: full grid (includes leading/trailing days)
  const startDate = fmt(grid[0][0])
  const endDate   = fmt(grid[grid.length - 1][6])

  // ── Data ──────────────────────────────────────────────────────────────────

  const { data: eventsData, isLoading, isFetching } = useQuery({
    queryKey: ['calendar-events', startDate, endDate, channelFilter],
    queryFn: () => calendarApi.events(startDate, endDate, channelFilter || undefined),
  })

  const { data: channelsData } = useQuery({
    queryKey: ['channels'],
    queryFn: channelsApi.list,
  })

  const channels: any[] = channelsData ?? []
  const allEvents: CalendarEvent[] = eventsData?.events ?? []

  // Build a map: dateStr → CalendarEvent[]
  const eventMap = new Map<string, CalendarEvent[]>()
  for (const ev of allEvents) {
    const key = ev.scheduled_date ?? ev.published_date ?? ''
    if (!key) continue
    const d = key.slice(0, 10) // normalize to YYYY-MM-DD
    if (!eventMap.has(d)) eventMap.set(d, [])
    eventMap.get(d)!.push(ev)
  }

  // Stats
  const queueCount = eventsData?.queue_count ?? 0
  const videoCount = eventsData?.video_count ?? 0
  const activeDays = eventMap.size

  // ── Mutations ─────────────────────────────────────────────────────────────

  const [rescheduling, setRescheduling] = useState(false)

  async function handleReschedule(queueId: number, date: string | null) {
    setRescheduling(true)
    try {
      await calendarApi.updateScheduled(queueId, date)
      qc.invalidateQueries({ queryKey: ['calendar-events'], exact: false })
      if (date === null) setActiveEvent(null)
    } finally {
      setRescheduling(false)
    }
  }

  const [addingLoading, setAddingLoading] = useState(false)

  async function handleQuickAdd(topic: string, channelSlug: string) {
    if (!addingToDay) return
    setAddingLoading(true)
    try {
      await queueApi.add(topic, channelSlug || undefined, addingToDay)
      qc.invalidateQueries({ queryKey: ['calendar-events'], exact: false })
      qc.invalidateQueries({ queryKey: ['queue'], exact: false })
      setAddingToDay(null)
    } finally {
      setAddingLoading(false)
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function prevMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    setActiveEvent(null)
    setAddingToDay(null)
  }
  function nextMonth() {
    setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    setActiveEvent(null)
    setAddingToDay(null)
  }
  function goToday() {
    setCurrentDate(new Date())
    setActiveEvent(null)
    setAddingToDay(null)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#FAFAFA]">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-[#E5E5E5] px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Month nav */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                aria-label="Previous month"
                className="w-7 h-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
              </button>
              <button
                onClick={nextMonth}
                aria-label="Next month"
                className="w-7 h-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] hover:bg-[#F5F5F5] rounded transition-colors"
              >
                <ChevronRight size={14} strokeWidth={1.5} />
              </button>
            </div>
            <h1 className="text-[15px] font-semibold text-[#0A0A0A] min-w-[140px]">
              {MONTHS[month]} {year}
            </h1>
            <button
              onClick={goToday}
              className="h-6 px-2.5 text-[11px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:border-[#D4D4D4] hover:text-[#0A0A0A] transition-colors"
            >
              Today
            </button>
            {isFetching && <Loader2 size={13} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-3 text-[12px] text-[#A3A3A3]">
              <span>
                <span className="font-medium text-[#525252]">{queueCount}</span> planned
              </span>
              <span className="text-[#E5E5E5]">·</span>
              <span>
                <span className="font-medium text-green-700">{videoCount}</span> published
              </span>
              <span className="text-[#E5E5E5]">·</span>
              <span>
                <span className="font-medium text-[#525252]">{activeDays}</span> active days
              </span>
            </div>
            {/* Channel filter */}
            <select
              value={channelFilter}
              onChange={e => { setChannelFilter(e.target.value); setActiveEvent(null) }}
              className="h-7 pl-2 pr-6 text-[11px] text-[#525252] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
            >
              <option value="">All channels</option>
              {channels.map(c => (
                <option key={c.slug} value={c.slug}>{c.name ?? c.slug}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Calendar + optional detail panel ────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Calendar grid ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto">
          <table className="w-full h-full border-collapse table-fixed">
            {/* Day headers */}
            <thead>
              <tr>
                {DAYS.map(day => (
                  <th
                    key={day}
                    className="py-2 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest text-center border-b border-[#E5E5E5] bg-white"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {isLoading && allEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <div className="flex items-center justify-center gap-2 text-[13px] text-[#A3A3A3]">
                      <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
                      Loading calendar...
                    </div>
                  </td>
                </tr>
              ) : (
                grid.map((week, wi) => (
                  <tr key={wi}>
                    {week.map((day, di) => {
                      const dayStr    = fmt(day)
                      const inMonth   = isCurrentMonth(day, year, month)
                      const today     = isToday(day)
                      const dayEvents = eventMap.get(dayStr) ?? []
                      const overflow  = dayEvents.length > 3
                      const visible   = dayEvents.slice(0, 3)
                      const isAdding  = addingToDay === dayStr

                      return (
                        <td
                          key={di}
                          className={[
                            'border border-[#E5E5E5] align-top p-1.5 min-h-[100px]',
                            inMonth ? 'bg-white' : 'bg-[#FAFAFA]',
                          ].join(' ')}
                          style={{ verticalAlign: 'top' }}
                        >
                          {/* Day number row */}
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className={[
                                'inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-medium',
                                today
                                  ? 'bg-[#0A0A0A] text-white'
                                  : inMonth
                                  ? 'text-[#0A0A0A]'
                                  : 'text-[#D4D4D4]',
                              ].join(' ')}
                            >
                              {day.getDate()}
                            </span>

                            {/* Add button - only for current month days */}
                            {inMonth && !isAdding && (
                              <button
                                onClick={() => {
                                  setAddingToDay(dayStr)
                                  setActiveEvent(null)
                                }}
                                className="w-4 h-4 flex items-center justify-center text-[#D4D4D4] hover:text-[#0A0A0A] opacity-0 group-hover:opacity-100 transition-all rounded hover:bg-[#F5F5F5]"
                                title={`Add topic for ${dayStr}`}
                              >
                                <Plus size={10} strokeWidth={1.5} />
                              </button>
                            )}
                          </div>

                          {/* Event pills */}
                          {visible.map(ev => (
                            <EventPill
                              key={ev.id}
                              event={ev}
                              isActive={activeEvent?.id === ev.id}
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveEvent(prev => prev?.id === ev.id ? null : ev)
                                setAddingToDay(null)
                              }}
                            />
                          ))}

                          {overflow && (
                            <p className="text-[9px] text-[#A3A3A3] pl-1">
                              +{dayEvents.length - 3} more
                            </p>
                          )}

                          {/* Quick-add form */}
                          {isAdding && (
                            <QuickAddForm
                              date={dayStr}
                              channels={channels}
                              onSubmit={handleQuickAdd}
                              onCancel={() => setAddingToDay(null)}
                              loading={addingLoading}
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Detail panel (slides in when event selected) ─────────────── */}
        {activeEvent && (
          <DetailPanel
            event={activeEvent}
            onClose={() => setActiveEvent(null)}
            onReschedule={handleReschedule}
            rescheduling={rescheduling}
          />
        )}
      </div>

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!isLoading && allEvents.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <Calendar size={28} strokeWidth={1.5} className="text-[#D4D4D4]" />
          <p className="text-[14px] text-[#525252]">No content scheduled this month</p>
          <p className="text-[12px] text-[#A3A3A3]">Click a day to add a topic, or schedule items from the Queue page</p>
        </div>
      )}
    </div>
  )
}
