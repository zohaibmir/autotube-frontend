import React, { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Sparkles, Copy, Check, Bookmark, BookmarkCheck,
  Trash2, Loader2, RefreshCw, Info, Filter,
} from 'lucide-react'
import { useChannels } from '@hooks/useJobs'
import { communityApi, type CommunityPost } from '@api/services'
import { useToast } from '@components/Toast'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function charCount(text: string): string {
  const n = text.length
  const color = n > 500 ? '#DC2626' : n > 350 ? '#D97706' : '#16A34A'
  return `<span style="color:${color}">${n}</span>`
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'sm' | 'xs' }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  const cls = size === 'xs'
    ? 'h-6 px-2 text-[10px] gap-1'
    : 'h-7 px-2.5 text-[11px] gap-1.5'
  return (
    <button
      onClick={copy}
      aria-label={copied ? 'Copied' : 'Copy post text'}
      className={`flex items-center font-medium rounded border transition-colors ${cls} ${
        copied
          ? 'bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]'
          : 'bg-white text-[#525252] border-[#E5E5E5] hover:border-[#0A0A0A] hover:text-[#0A0A0A]'
      }`}
    >
      {copied ? <Check size={10} strokeWidth={2} /> : <Copy size={10} strokeWidth={1.5} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({
  post,
  onMarkPosted,
  onDelete,
}: {
  post: CommunityPost
  onMarkPosted: (id: number) => void
  onDelete: (id: number) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isPosted = post.posted === 1
  const MAX = 220

  return (
    <div className={`border rounded-lg bg-white overflow-hidden transition-colors ${
      isPosted ? 'border-[#DCFCE7]' : 'border-[#E5E5E5]'
    }`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-[#FAFAFA] border-b border-[#F5F5F5]">
        {post.channel_slug && (
          <span className="text-[10px] font-medium bg-[#0A0A0A] text-white px-2 py-0.5 rounded-full">
            {post.channel_slug}
          </span>
        )}
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          isPosted
            ? 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]'
            : 'bg-[#FFF7ED] text-[#C2410C] border border-[#FDBA74]'
        }`}>
          {isPosted ? '✓ Posted' : 'Draft'}
        </span>
        <span className="ml-auto text-[11px] text-[#A3A3A3]">{timeAgo(post.created_at)}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        <p
          className="text-[13px] text-[#0A0A0A] leading-relaxed whitespace-pre-wrap cursor-pointer"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded || post.text.length <= MAX
            ? post.text
            : post.text.slice(0, MAX) + '…'}
        </p>
        {post.text.length > MAX && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="text-[11px] text-[#A3A3A3] hover:text-[#525252] mt-1 transition-colors"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
        <p className="text-[10px] text-[#A3A3A3] mt-1.5">{post.text.length} characters</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-[#F5F5F5]">
        <CopyButton text={post.text} size="xs" />
        {!isPosted && (
          <button
            onClick={() => onMarkPosted(post.id)}
            aria-label="Mark as posted"
            className="h-6 px-2 text-[10px] font-medium flex items-center gap-1 rounded border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#16A34A] hover:text-[#16A34A] transition-colors"
          >
            <BookmarkCheck size={10} strokeWidth={1.5} />
            Mark posted
          </button>
        )}
        <button
          onClick={() => onDelete(post.id)}
          aria-label="Delete post"
          className="ml-auto h-6 w-6 flex items-center justify-center text-[#A3A3A3] hover:text-[#DC2626] transition-colors"
        >
          <Trash2 size={12} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CommunityPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data: channels = [] } = useChannels()

  // ── Generate form state ────────────────────────────────────────────────────
  const [genChannel, setGenChannel]     = useState('')
  const [genTitle, setGenTitle]         = useState('')
  const [genContext, setGenContext]     = useState('')
  const [draftText, setDraftText]       = useState('')
  const [generating, setGenerating]     = useState(false)
  const [saving, setSaving]             = useState(false)

  // ── History filter state ───────────────────────────────────────────────────
  const [filterChannel, setFilterChannel] = useState('')
  const [filterStatus, setFilterStatus]   = useState<'all' | 'draft' | 'posted'>('all')

  const draftRef = useRef<HTMLTextAreaElement>(null)

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: postsData, isLoading: postsLoading, refetch: refetchPosts } = useQuery({
    queryKey: ['community-posts', filterChannel],
    queryFn: () => communityApi.list({ channel_slug: filterChannel || undefined, limit: 100 }),
  })

  const posts = (postsData?.posts ?? []).filter(p => {
    if (filterStatus === 'draft') return p.posted === 0
    if (filterStatus === 'posted') return p.posted === 1
    return true
  })

  // ── Mutations ─────────────────────────────────────────────────────────────
  const markPostedMutation = useMutation({
    mutationFn: (id: number) => communityApi.markPosted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'], exact: false })
      toast.success('Marked as posted')
    },
    onError: () => toast.error('Failed to update post'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => communityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-posts'], exact: false })
      toast.success('Post deleted')
    },
    onError: () => toast.error('Failed to delete post'),
  })

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!genTitle.trim()) { toast.error('Enter a topic or video title'); return }
    setGenerating(true)
    setDraftText('')
    try {
      const res = await communityApi.generate({
        title: genTitle.trim(),
        description: genContext.trim() || undefined,
        channel_slug: genChannel || undefined,
      })
      if (res.ok && res.post) {
        setDraftText(res.post)
        setTimeout(() => draftRef.current?.focus(), 100)
      } else {
        toast.error(res.error ?? 'Generation failed')
      }
    } catch { toast.error('Generation failed') }
    finally { setGenerating(false) }
  }

  const handleSave = async () => {
    if (!draftText.trim()) return
    setSaving(true)
    try {
      const res = await communityApi.save({
        text: draftText.trim(),
        channel_slug: genChannel || undefined,
      })
      if (res.ok) {
        toast.success('Saved to library')
        queryClient.invalidateQueries({ queryKey: ['community-posts'], exact: false })
        setDraftText('')
        setGenTitle('')
        setGenContext('')
      } else {
        toast.error('Failed to save')
      }
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  const draftLen = draftText.length
  const draftColor = draftLen > 500 ? '#DC2626' : draftLen > 350 ? '#D97706' : '#16A34A'

  return (
    <div className="p-6 max-w-3xl">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold text-[#0A0A0A]">Community Posts</h1>
        <p className="text-[13px] text-[#525252] mt-0.5">
          Generate AI-crafted post drafts, copy to clipboard, and paste into YouTube Studio.
        </p>
      </div>

      {/* ── Generate section ──────────────────────────────────────────────── */}
      <section className="border border-[#E5E5E5] rounded-lg bg-white mb-6" aria-label="Generate post">
        <div className="px-5 py-3.5 border-b border-[#E5E5E5] flex items-center gap-2">
          <Sparkles size={13} strokeWidth={1.5} className="text-[#7C3AED]" />
          <h2 className="text-[13px] font-semibold text-[#0A0A0A]">Generate a Post</h2>
        </div>

        <div className="p-5 space-y-4">
          {/* Channel + Title row */}
          <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3">
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                Channel
              </label>
              <select
                value={genChannel}
                onChange={e => setGenChannel(e.target.value)}
                className="w-full h-8 px-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
              >
                <option value="">Any channel</option>
                {channels.map(ch => (
                  <option key={ch.slug} value={ch.slug}>{ch.name || ch.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                Topic / Video Title <span className="text-[#DC2626]">*</span>
              </label>
              <input
                value={genTitle}
                onChange={e => setGenTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !generating && handleGenerate()}
                placeholder="e.g. 5 Tips for Better Sleep"
                className="w-full h-8 px-3 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4]"
              />
            </div>
          </div>

          {/* Context */}
          <div>
            <label className="block text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
              Context <span className="font-normal normal-case tracking-normal">(optional — paste script excerpt or description)</span>
            </label>
            <textarea
              value={genContext}
              onChange={e => setGenContext(e.target.value)}
              placeholder="Paste your video description or key talking points for a more relevant post…"
              rows={3}
              className="w-full px-3 py-2 text-[12px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:ring-1 focus:ring-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4] resize-none"
            />
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !genTitle.trim()}
            className="h-9 px-5 text-[13px] font-medium bg-[#0A0A0A] text-white rounded hover:bg-[#262626] transition-colors disabled:opacity-40 flex items-center gap-2"
          >
            {generating
              ? <><Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Generating…</>
              : <><Sparkles size={13} strokeWidth={1.5} /> Generate with AI</>
            }
          </button>

          {/* Generated draft ─────────────────────────────────────────────── */}
          {(draftText || generating) && (
            <div className="border border-[#E5E5E5] rounded-lg overflow-hidden mt-2">
              <div className="px-4 py-2 bg-[#FAFAFA] border-b border-[#E5E5E5] flex items-center justify-between">
                <span className="text-[11px] font-medium text-[#525252]">Generated Draft</span>
                <span
                  className="text-[11px] font-mono"
                  style={{ color: draftColor }}
                >
                  {draftLen} chars
                </span>
              </div>
              <textarea
                ref={draftRef}
                value={draftText}
                onChange={e => setDraftText(e.target.value)}
                placeholder={generating ? 'Generating…' : ''}
                disabled={generating}
                rows={6}
                aria-label="Edit generated post"
                className="w-full px-4 py-3 text-[13px] text-[#0A0A0A] leading-relaxed resize-none bg-white focus:outline-none focus:ring-1 focus:ring-[#0A0A0A] transition-colors placeholder:text-[#D4D4D4] disabled:opacity-50"
              />
              <div className="px-4 py-2.5 bg-[#FAFAFA] border-t border-[#E5E5E5] flex items-center gap-2 flex-wrap">
                {draftText && (
                  <>
                    <CopyButton text={draftText} />
                    <button
                      onClick={handleSave}
                      disabled={saving || !draftText.trim()}
                      className="h-7 px-2.5 text-[11px] font-medium flex items-center gap-1.5 rounded border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors disabled:opacity-40"
                    >
                      {saving
                        ? <Loader2 size={10} strokeWidth={1.5} className="animate-spin" />
                        : <Bookmark size={10} strokeWidth={1.5} />
                      }
                      Save to library
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={generating}
                      aria-label="Regenerate post"
                      className="h-7 px-2.5 text-[11px] font-medium flex items-center gap-1.5 rounded border border-[#E5E5E5] bg-white text-[#525252] hover:border-[#0A0A0A] hover:text-[#0A0A0A] transition-colors disabled:opacity-40"
                    >
                      <RefreshCw size={10} strokeWidth={1.5} />
                      Regenerate
                    </button>
                  </>
                )}
                <span className="ml-auto flex items-center gap-1 text-[10px] text-[#A3A3A3]">
                  <Info size={10} strokeWidth={1.5} />
                  YouTube API doesn't support auto-posting — copy and paste into YouTube Studio
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── History section ───────────────────────────────────────────────── */}
      <section aria-label="Post history">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15px] font-semibold text-[#0A0A0A]">Library</h2>
          <div className="flex items-center gap-2">
            {/* Status filter */}
            <div className="flex border border-[#E5E5E5] rounded overflow-hidden">
              {(['all', 'draft', 'posted'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  aria-label={`Show ${s} posts`}
                  className={[
                    'px-2.5 h-7 text-[11px] font-medium capitalize transition-colors',
                    filterStatus === s ? 'bg-[#0A0A0A] text-white' : 'text-[#525252] hover:bg-[#F5F5F5]',
                  ].join(' ')}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Channel filter */}
            <select
              value={filterChannel}
              onChange={e => setFilterChannel(e.target.value)}
              aria-label="Filter by channel"
              className="h-7 px-2 text-[11px] bg-white border border-[#E5E5E5] rounded focus:outline-none focus:border-[#0A0A0A] transition-colors"
            >
              <option value="">All channels</option>
              {channels.map(ch => (
                <option key={ch.slug} value={ch.slug}>{ch.name || ch.slug}</option>
              ))}
            </select>

            <button
              onClick={() => refetchPosts()}
              aria-label="Refresh post library"
              className="h-7 w-7 flex items-center justify-center text-[#A3A3A3] hover:text-[#0A0A0A] border border-[#E5E5E5] rounded transition-colors"
            >
              <RefreshCw size={12} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {postsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-[#F5F5F5] rounded-lg animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="border border-dashed border-[#E5E5E5] rounded-lg py-16 text-center">
            <Sparkles size={24} strokeWidth={1} className="text-[#D4D4D4] mx-auto mb-3" />
            <p className="text-[13px] font-medium text-[#525252]">No posts yet</p>
            <p className="text-[12px] text-[#A3A3A3] mt-1">
              Generate your first community post using the form above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onMarkPosted={id => markPostedMutation.mutate(id)}
                onDelete={id => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
