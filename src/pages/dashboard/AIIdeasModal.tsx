import { useMemo, useState } from 'react'
import {
  Loader2, Sparkles, X, Clapperboard, Film, Check, RefreshCw, AlertCircle, Plus,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { aiApi, queueApi, channelProfilesApi } from '@api/services'
import { useToast } from '@components/Toast'
import { apiErrorMessage } from '@lib/apiError'

interface Idea {
  topic: string
  score?: number
  type?: string
  cpm_estimate?: string
  competition?: string
  hook?: string
  angle?: string
  topic_key?: string
  duplicate?: boolean
  status?: 'new' | 'in_queue' | 'already_used'
}

type Channels = Array<{ slug: string; name?: string }>

export default function AIIdeasModal({
  channels,
  defaultChannelSlug,
  onClose,
}: {
  channels: Channels
  defaultChannelSlug?: string
  onClose: () => void
}) {
  const [contentType, setContentType] = useState<'video' | 'shorts'>('video')
  const [channelSlug, setChannelSlug] = useState(defaultChannelSlug ?? '')
  const [count, setCount] = useState(9)
  const [prompt, setPrompt] = useState('')
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [generating, setGenerating] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const qc = useQueryClient()
  const toast = useToast()

  const { data: profileData } = useQuery({
    queryKey: ['channel-profile', channelSlug],
    queryFn: () => channelProfilesApi.get(channelSlug),
    enabled: !!channelSlug,
  })
  const niche = String(profileData?.profile?.niche ?? '').trim()
  const audience = String(profileData?.profile?.audience ?? '').trim()
  const language = String(profileData?.profile?.language ?? '').trim()

  const selectedIdeas = useMemo(
    () => ideas.filter((i) => i.topic_key && selected.has(i.topic_key)),
    [ideas, selected],
  )

  const allSelectable = useMemo(
    () => ideas.filter((i) => i.status !== 'in_queue' && i.status !== 'already_used' && i.topic_key),
    [ideas],
  )
  const allSelected = allSelectable.length > 0 && allSelectable.every((i) => selected.has(i.topic_key as string))
  const toggleAll = () => {
    setSelected(() => {
      if (allSelected) return new Set()
      return new Set(allSelectable.map((i) => i.topic_key as string))
    })
  }

  const generate = async () => {
    setGenerating(true)
    setSelected(new Set())
    try {
      const data = await aiApi.trending({
        channel_slug: channelSlug || undefined,
        content_type: contentType,
        count,
        prompt: prompt.trim() || undefined,
        dedupe: true,
      })
      setIdeas((data?.topics ?? []) as Idea[])
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not generate ideas'))
    } finally {
      setGenerating(false)
    }
  }

  const toggle = (key?: string) => {
    if (!key) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const addIdea = (idea: Idea, force: boolean) =>
    queueApi.add(
      idea.topic,
      channelSlug || undefined,
      undefined,
      contentType,
      { content_type: contentType },
      force ? false : true,
    )

  const addSelected = async () => {
    if (!selectedIdeas.length) return
    setAdding(true)
    let added = 0
    let skipped = 0
    for (const idea of selectedIdeas) {
      try {
        const res = await addIdea(idea, false)
        if (res?.duplicate !== true) added++
        else skipped++
      } catch { /* skip failed adds */ }
    }
    qc.invalidateQueries({ queryKey: ['queue'], exact: false })
    qc.invalidateQueries({ queryKey: ['queue-history'], exact: false })
    setAdding(false)
    if (added && skipped) {
      toast.info(`${added} added · ${skipped} skipped as duplicates`)
    } else if (added) {
      toast.success(`${added} idea${added !== 1 ? 's' : ''} added to the end of the queue`)
    } else if (skipped) {
      toast.info(`${skipped} skipped as duplicates`)
    }
    setIdeas((prev) => prev.filter((i) => !selected.has(i.topic_key ?? '')))
    setSelected(new Set())
  }

  const reAdd = async (idea: Idea) => {
    if (!idea.topic) return
    try {
      await addIdea(idea, true)
      qc.invalidateQueries({ queryKey: ['queue'], exact: false })
      qc.invalidateQueries({ queryKey: ['queue-history'], exact: false })
      toast.success(`Re-added: ${idea.topic}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not re-add'))
    }
  }

return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-label="AI topic ideas">
      <div className="bg-white rounded-xl border border-[#E5E5E5] w-full max-w-2xl max-h-[88vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#E5E5E5]">
          <div>
            <h3 className="text-[15px] font-semibold text-[#0A0A0A] flex items-center gap-1.5">
              <Sparkles size={15} strokeWidth={1.5} className="text-[#7C3AED]" /> AI Topic Ideas
            </h3>
            <p className="text-[12px] text-[#A3A3A3] mt-0.5">
              {niche
                ? `Niche: ${niche}${audience ? ` · Audience: ${audience}` : ''}${language ? ` · ${language}` : ''}`
                : 'Niche, audience & language are pulled from the channel profile.'}
            </p>
          </div>
          <button onClick={onClose} className="text-[#A3A3A3] hover:text-[#0A0A0A] transition-colors">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Controls */}
        <div className="px-6 py-4 border-b border-[#E5E5E5] space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Content</label>
              <div className="flex items-center gap-1 p-0.5 bg-[#F5F5F5] rounded w-fit">
                {(['video', 'shorts'] as const).map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setContentType(ct)}
                    className={`flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded transition-colors ${
                      contentType === ct ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#A3A3A3] hover:text-[#525252]'
                    }`}
                  >
                    {ct === 'shorts' ? <Clapperboard size={11} strokeWidth={1.5} /> : <Film size={11} strokeWidth={1.5} />}
                    {ct === 'shorts' ? 'Shorts' : 'Videos'}
                  </button>
                ))}
              </div>
            </div>

            {channels.length > 1 && (
              <div>
                <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Channel</label>
                <select
                  value={channelSlug}
                  onChange={(e) => setChannelSlug(e.target.value)}
                  className="h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] text-[#525252]"
                >
                  <option value="">Default channel</option>
                  {channels.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">Ideas</label>
              <div className="flex items-center gap-1 p-0.5 bg-[#F5F5F5] rounded w-fit">
                {countOptions.map((n) => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    className={`h-7 px-2.5 text-[12px] font-medium rounded transition-colors ${
                      count === n ? 'bg-white text-[#0A0A0A] shadow-sm' : 'text-[#A3A3A3] hover:text-[#525252]'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
              Theme / direction <span className="normal-case font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) generate() }}
              placeholder='e.g. "mysteries of the deep ocean" or "beginner budgeting tips"'
              className="w-full h-8 px-3 text-[13px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] placeholder:text-[#D4D4D4]"
            />
          </div>

          <button
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40"
          >
            {generating ? <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> : <Sparkles size={13} strokeWidth={1.5} />}
            {generating ? 'Asking Claude…' : 'Generate ideas'}
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
          {ideas.length === 0 && !generating && (
            <div className="py-10 flex flex-col items-center gap-2 text-center">
              <Sparkles size={22} strokeWidth={1} className="text-[#D4D4D4]" />
              <p className="text-[13px] font-medium text-[#525252]">No ideas yet</p>
              <p className="text-[12px] text-[#A3A3A3]">Pick a channel, add an optional theme, and generate a fresh set.</p>
            </div>
          )}

          {ideas.map((idea, idx) => {
            const key = idea.topic_key ?? `idea-${idx}`
            const isNew = idea.status !== 'in_queue' && idea.status !== 'already_used'
            const checked = Boolean(idea.topic_key && selected.has(idea.topic_key))
            return (
              <div
                key={key}
                className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                  isNew ? 'bg-white border-[#E5E5E5] hover:border-[#D4D4D4]' : 'bg-[#FAFAFA] border-[#F0F0F0] opacity-70'
                }`}
              >
                {isNew ? (
                  <button
                    onClick={() => toggle(idea.topic_key)}
                    aria-label={checked ? 'Deselect' : 'Select'}
                    className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      checked ? 'bg-[#0A0A0A] border-[#0A0A0A] text-white' : 'bg-white border-[#D4D4D4] text-transparent hover:border-[#A3A3A3]'
                    }`}
                  >
                    <Check size={11} strokeWidth={2} />
                  </button>
                ) : (
                  <span className="flex-shrink-0 mt-0.5 w-4 h-4 flex items-center justify-center text-[#A3A3A3]">
                    <AlertCircle size={13} strokeWidth={1.5} />
                  </span>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-bold text-[#A3A3A3]">{idx + 1}</span>
                    {typeof idea.score === 'number' && (
                      <span className="text-[11px] font-bold text-[#0A0A0A]">{idea.score}</span>
                    )}
                    {idea.type && (
                      <span className="text-[9px] font-bold tracking-widest uppercase bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE] px-1.5 py-0.5 rounded">
                        {idea.type}
                      </span>
                    )}
                    {idea.cpm_estimate && <span className="text-[10px] text-[#525252]">{idea.cpm_estimate}</span>}
                    {idea.competition && <span className="text-[10px] text-[#A3A3A3]">· {idea.competition}</span>}
                  </div>
                  <p className="text-[13px] font-medium text-[#0A0A0A] leading-snug">{idea.topic}</p>
                  {idea.hook && <p className="text-[12px] text-[#525252] mt-1 leading-snug">▸ {idea.hook}</p>}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                  {isNew ? (
                    <button
                      onClick={() => toggle(idea.topic_key)}
                      className="text-[11px] font-medium text-[#0A0A0A] bg-[#F5F5F5] hover:bg-[#E5E5E5] border border-[#E5E5E5] rounded px-2 py-1 transition-colors"
                    >
                      {checked ? 'Selected' : 'Add'}
                    </button>
                  ) : (
                    <>
                      <span className="text-[10px] font-medium text-[#A3A3A3]">
                        {idea.status === 'in_queue' ? 'In queue' : 'Used before'}
                      </span>
                      <button
                        onClick={() => reAdd(idea)}
                        className="text-[11px] font-medium text-[#7C3AED] hover:text-[#6D28D9] transition-colors"
                      >
                        Re-add
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        {ideas.length > 0 && (
          <div className="px-6 py-3 border-t border-[#E5E5E5] flex items-center justify-between gap-2">
            <button
              onClick={generate}
              disabled={generating}
              className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#F5F5F5] disabled:opacity-40"
            >
              {generating ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : <RefreshCw size={12} strokeWidth={1.5} />}
              More ideas
            </button>
            <button
              onClick={toggleAll}
              disabled={allSelectable.length === 0}
              className="h-8 px-3 text-[12px] font-medium text-[#525252] border border-[#E5E5E5] rounded hover:bg-[#F5F5F5] disabled:opacity-40"
            >
              {allSelected ? 'Clear selection' : `Select all (${allSelectable.length})`}
            </button>
            <button
              onClick={addSelected}
              disabled={adding || !selectedIdeas.length}
              className="flex items-center gap-1.5 h-9 px-4 text-[12px] font-semibold bg-[#0A0A0A] text-white rounded hover:bg-[#262626] disabled:opacity-40"
            >
              {adding ? <Loader2 size={12} strokeWidth={1.5} className="animate-spin" /> : <Plus size={12} strokeWidth={1.5} />}
              Add {selectedIdeas.length || ''} to queue
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
  const countOptions = [9, 12, 15]