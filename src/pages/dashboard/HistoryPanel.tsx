import { useState } from 'react'
import { Loader2, Trash2, RotateCcw, Search, X, Clapperboard, Film, History as HistoryIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { queueApi } from '@api/services'
import { useQueueHistory, useQueueHistoryRemove, useQueueHistoryClear } from '@hooks/useJobs'
import { useToast } from '@components/Toast'
import { apiErrorMessage } from '@lib/apiError'

interface HistoryItem {
  id: number
  topic: string
  channel_slug?: string | null
  type?: string | null
  status?: string
  payload?: string | null
  scheduled?: string | null
  added_at?: string | null
  topic_key?: string | null
}

type Channels = Array<{ slug: string; name?: string }>

function parsePayload(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {}
  try { return typeof raw === 'string' ? JSON.parse(raw) : raw } catch { return {} }
}

function formatDate(value?: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function isShort(item: HistoryItem): boolean {
  const p = parsePayload(item.payload)
  const contentType = String(p.content_type ?? '').toLowerCase()
  const typeLabel = String(item.type ?? '').toLowerCase()
  return contentType === 'shorts' || contentType === 'short' || typeLabel === 'shorts' || typeLabel === 'short'
}

export default function HistoryPanel({
  channels,
  defaultChannelSlug,
}: {
  channels: Channels
  defaultChannelSlug?: string
}) {
  const [channelSlug, setChannelSlug] = useState(defaultChannelSlug ?? '')
  const [status, setStatus] = useState<string>('')
  const [q, setQ] = useState('')
  const [reAddingId, setReAddingId] = useState<number | null>(null)
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [limit, setLimit] = useState(50)
  const toast = useToast()
  const qc = useQueryClient()

  const { data = { items: [] as HistoryItem[], total: 0 }, isLoading, isError, refetch } = useQueueHistory({
    channelSlug: channelSlug || undefined,
    status: status || undefined,
    q: q.trim() || undefined,
    limit,
  })
  const history = data.items ?? []
  const total = data.total ?? 0

  const removeMutation = useQueueHistoryRemove()
  const clearMutation = useQueueHistoryClear()

  const channelName = (slug?: string | null) => {
    if (!slug) return null
    const c = channels.find((x) => x.slug === slug)
    return c?.name || slug
  }

  const handleRemove = async (id: number) => {
    try {
      await removeMutation.mutateAsync(id)
      toast.success('History entry deleted')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete'))
    }
  }

  const handleClear = async () => {
    try {
      await clearMutation.mutateAsync({ channelSlug: channelSlug || undefined, status: status || undefined })
      toast.success('History cleared')
      setConfirmingClear(false)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not clear history'))
    }
  }

  const handleReAdd = async (item: HistoryItem) => {
    setReAddingId(item.id)
    try {
      const contentType = isShort(item) ? 'shorts' : 'video'
      // Force past the dedup guard: re-running a previously-published topic is the explicit intent here.
      await queueApi.add(item.topic, item.channel_slug || undefined, undefined, contentType, { content_type: contentType }, false)
      qc.invalidateQueries({ queryKey: ['queue'], exact: false })
      toast.success('Re-added to queue')
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not re-add'))
    } finally {
      setReAddingId(null)
    }
  }

  return (
    <div>
      {/* History toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={13} strokeWidth={1.5} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#A3A3A3]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search topics…"
            className="h-8 pl-8 pr-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] w-56 placeholder:text-[#D4D4D4]"
          />
        </div>

        {channels.length > 1 && (
          <select
            value={channelSlug}
            onChange={(e) => setChannelSlug(e.target.value)}
            className="h-8 pl-3 pr-7 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] text-[#525252]"
          >
            <option value="">All channels</option>
            {channels.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>
            ))}
          </select>
        )}

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 pl-3 pr-7 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] text-[#525252]"
        >
          <option value="">Done + failed</option>
          <option value="done">Done</option>
          <option value="failed">Failed</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          {confirmingClear ? (
            <>
              <button
                onClick={handleClear}
                disabled={clearMutation.isPending}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-white bg-[#DC2626] rounded hover:bg-[#B91C1C] disabled:opacity-40 transition-colors"
              >
                {clearMutation.isPending && <Loader2 size={12} strokeWidth={1.5} className="animate-spin" />}
                Confirm clear
              </button>
              <button
                onClick={() => setConfirmingClear(false)}
                className="h-8 px-2 text-[12px] text-[#525252] hover:text-[#0A0A0A]"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmingClear(true)}
              disabled={history.length === 0}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#DC2626] border border-[#FEE2E2] rounded hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors"
            >
              <Trash2 size={12} strokeWidth={1.5} /> Clear history
            </button>
          )}
        </div>
      </div>
<div className="border border-[#E5E5E5] rounded-lg overflow-hidden bg-white">
        {isLoading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={20} strokeWidth={1.5} className="animate-spin text-[#A3A3A3]" />
          </div>
        ) : isError ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <HistoryIcon size={28} strokeWidth={1} className="text-[#DC2626]" />
            <p className="text-[14px] font-medium text-[#525252]">Couldn't load history</p>
            <button onClick={() => refetch()} className="text-[12px] font-medium text-[#0A0A0A] underline underline-offset-2">Retry</button>
          </div>
        ) : history.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3">
            <HistoryIcon size={28} strokeWidth={1} className="text-[#D4D4D4]" />
            <p className="text-[14px] font-medium text-[#525252]">No history yet</p>
            <p className="text-[12px] text-[#A3A3A3]">Completed and failed topics will appear here.</p>
          </div>
        ) : (
          history.map((item) => {
            const short = isShort(item)
            return (
              <div key={item.id} className="group flex items-center gap-3 px-4 h-12 border-b border-[#E5E5E5] bg-white last:border-b-0">
                <span
                  className={`w-2 h-2 rounded-full ${item.status === 'failed' ? 'bg-[#DC2626]' : 'bg-[#16A34A]'}`}
                  title={item.status}
                />
                <span
                  className={`flex-shrink-0 flex items-center gap-1 text-[9px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded ${
                    short ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]' : 'bg-[#F5F5F5] text-[#A3A3A3] border border-[#E5E5E5]'
                  }`}
                >
                  {short ? <Clapperboard size={9} strokeWidth={2} /> : <Film size={9} strokeWidth={2} />}
                  {short ? 'Short' : 'Video'}
                </span>
                <span className="flex-1 text-[13px] text-[#0A0A0A] truncate" title={item.topic}>{item.topic}</span>
                {item.channel_slug && (
                  <span className="flex-shrink-0 text-[10px] font-medium text-[#525252] bg-[#F5F5F5] border border-[#E5E5E5] px-2 py-0.5 rounded-sm">
                    {channelName(item.channel_slug)}
                  </span>
                )}
                <span className="flex-shrink-0 text-[10px] text-[#A3A3A3]">{formatDate(item.added_at)}</span>
                <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleReAdd(item)}
                    disabled={reAddingId === item.id}
                    title="Re-add to queue"
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium text-[#0A0A0A] bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#E5E5E5] transition-colors disabled:opacity-40"
                  >
                    {reAddingId === item.id ? <Loader2 size={11} strokeWidth={1.5} className="animate-spin" /> : <RotateCcw size={11} strokeWidth={1.5} />}
                    Re-add
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    disabled={removeMutation.isPending}
                    title="Delete from history"
                    className="p-1 rounded text-[#A3A3A3] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors disabled:opacity-40"
                  >
                    <X size={13} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {total > history.length && (
        <div className="flex justify-center mt-3">
          <button
            onClick={() => setLimit((l) => l + 50)}
            className="h-8 px-4 text-[12px] font-medium border border-[#E5E5E5] text-[#525252] rounded hover:bg-[#F5F5F5] transition-colors"
          >
            Load more · {history.length} of {total}
          </button>
        </div>
      )}
    </div>
  )
}