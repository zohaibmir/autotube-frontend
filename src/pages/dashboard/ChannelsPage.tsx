import React from 'react'
import {
  Tv, CheckCircle2, XCircle, AlertCircle, Star,
  ExternalLink, Loader, RefreshCw, Plus, RotateCcw, Pin, ChevronRight,
} from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useChannels, useJobs } from '@hooks/useJobs'
import { channelsApi } from '@api/services'
import { useToast } from '@components/Toast'

// ── Auth status config ────────────────────────────────────────────────────────
const authConfig: Record<string, { label: string; pill: string; icon: React.ReactNode }> = {
  ok:      { label: 'Connected',    pill: 'bg-[#F0FDF4] text-[#16A34A] border border-[#BBF7D0]', icon: <CheckCircle2 size={11} strokeWidth={2} /> },
  warning: { label: 'Warning',      pill: 'bg-[#FFFBEB] text-[#B45309] border border-[#FDE68A]', icon: <AlertCircle size={11} strokeWidth={1.5} /> },
  error:   { label: 'Error',        pill: 'bg-[#FFF1F2] text-[#BE123C] border border-[#FECDD3]', icon: <XCircle size={11} strokeWidth={1.5} /> },
  missing: { label: 'Disconnected', pill: 'bg-[#FAFAFA] text-[#525252] border border-[#E5E5E5]', icon: <XCircle size={11} strokeWidth={1.5} /> },
}

// ── Avatar ────────────────────────────────────────────────────────────────────
function ChannelAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
  return (
    <div className="w-10 h-10 rounded-md bg-[#0A0A0A] text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
      {initials || <Tv size={14} strokeWidth={1.5} />}
    </div>
  )
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-md p-5 space-y-4 animate-pulse">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-md bg-[#F5F5F5]" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 bg-[#F5F5F5] rounded w-3/4" />
          <div className="h-2.5 bg-[#F5F5F5] rounded w-1/2" />
        </div>
      </div>
      <div className="h-6 bg-[#F5F5F5] rounded-full w-28" />
      <div className="border-t border-[#F5F5F5] pt-3 flex gap-3">
        <div className="h-2.5 bg-[#F5F5F5] rounded w-20" />
        <div className="h-2.5 bg-[#F5F5F5] rounded w-20" />
      </div>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-[#0A0A0A] leading-none">{value}</p>
      <p className="text-[10px] text-[#A3A3A3] mt-0.5">{label}</p>
    </div>
  )
}

// ── OAuth popup helper ────────────────────────────────────────────────────────
// The backend's OAuth callback page posts { type: 'yt_channel_added', ok } back
// to window.opener and closes itself - wait for that message (or the popup
// being closed manually) before resolving.
function openOAuthPopup(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const popup = window.open(url, 'yt-oauth', 'width=520,height=640')
    if (!popup) { resolve(false); return }

    let settled = false
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'yt_channel_added') return
      settled = true
      window.removeEventListener('message', onMessage)
      clearInterval(poll)
      resolve(Boolean(event.data.ok))
    }
    window.addEventListener('message', onMessage)

    // Fallback: if the user closes the popup without completing OAuth
    const poll = window.setInterval(() => {
      if (popup.closed && !settled) {
        clearInterval(poll)
        window.removeEventListener('message', onMessage)
        resolve(false)
      }
    }, 500)
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ChannelsPage() {
  const qc = useQueryClient()
  const { addToast } = useToast()

  const { data: channels = [], isLoading, refetch, isFetching } = useChannels()
  const { data: allJobs = [] } = useJobs()
  const ch = channels as any[]
  const jobs = allJobs as any[]

  // Mutations
  const resetAuthMutation = useMutation({
    mutationFn: (slug: string) => channelsApi.resetAuth(slug),
    onSuccess: async (data: any) => {
      if (data?.requires_oauth && data?.oauth_url) {
        const ok = await openOAuthPopup(data.oauth_url)
        addToast(ok ? 'Channel reconnected' : 'Reconnect cancelled', ok ? 'success' : 'error')
      } else {
        addToast('Channel reconnected', 'success')
      }
      qc.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: () => addToast('Reset failed', 'error'),
  })

  const connectMutation = useMutation({
    mutationFn: (name: string) => channelsApi.add(name),
    onSuccess: async (data: any) => {
      if (data?.requires_oauth && data?.oauth_url) {
        const ok = await openOAuthPopup(data.oauth_url)
        addToast(ok ? 'Channel connected' : 'Connection cancelled', ok ? 'success' : 'error')
      } else {
        addToast('Channel connected', 'success')
      }
      qc.invalidateQueries({ queryKey: ['channels'] })
    },
    onError: (err: any) => addToast(err?.response?.data?.detail || 'Failed to connect channel', 'error'),
  })

  const handleConnect = () => {
    const name = window.prompt('Name this channel (e.g. "Main Channel"):')
    if (name && name.trim()) connectMutation.mutate(name.trim())
  }

  const setDefaultMutation = useMutation({
    mutationFn: (slug: string) => channelsApi.setDefault(slug),
    onSuccess: () => { addToast('Default channel updated', 'success'); qc.invalidateQueries({ queryKey: ['channels'] }) },
    onError: () => addToast('Update failed', 'error'),
  })

  const refreshMutation = useMutation({
    mutationFn: () => channelsApi.refreshTokens(),
    onSuccess: () => { addToast('Tokens refreshed', 'success'); qc.invalidateQueries({ queryKey: ['channels'] }) },
    onError: () => addToast('Refresh failed', 'error'),
  })

  // Per-channel job stats derived from cached jobs list
  function channelStats(slug: string) {
    const channelJobs = jobs.filter((j) => j.channel_slug === slug)
    const total = channelJobs.length
    const done = channelJobs.filter((j) => j.status === 'done').length
    const lastJob = channelJobs
      .filter((j) => j.start_time)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime())[0]
    const lastDate = lastJob?.start_time
      ? new Date(lastJob.start_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
      : '—'
    return { total, done, lastDate }
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#0A0A0A]">Channels</h1>
          <p className="text-sm text-[#A3A3A3] mt-0.5">Manage your connected YouTube channels.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={isFetching || refreshMutation.isPending}
            className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#E5E5E5] bg-white text-[#525252] hover:bg-[#F5F5F5] text-sm font-medium transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} strokeWidth={1.5} className={isFetching || refreshMutation.isPending ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleConnect}
            disabled={connectMutation.isPending}
            className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <Plus size={13} strokeWidth={1.5} /> {connectMutation.isPending ? 'Connecting…' : 'Connect Channel'}
          </button>
        </div>
      </div>

      <div className="px-8 pb-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : ch.length === 0 ? (
          <div className="bg-white border border-[#E5E5E5] rounded-md py-20 text-center">
            <div className="w-12 h-12 bg-[#F5F5F5] rounded-md flex items-center justify-center mx-auto mb-4">
              <Tv size={18} strokeWidth={1.5} className="text-[#A3A3A3]" />
            </div>
            <p className="font-semibold text-[#0A0A0A] text-sm mb-1">No channels connected</p>
            <p className="text-xs text-[#A3A3A3] mb-6 max-w-xs mx-auto">
              Connect a YouTube channel to start creating and publishing videos automatically.
            </p>
            <button
              onClick={handleConnect}
              disabled={connectMutation.isPending}
              className="bg-[#0A0A0A] hover:bg-[#262626] text-white px-5 py-2 rounded-md text-sm font-medium inline-flex items-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus size={13} strokeWidth={1.5} /> {connectMutation.isPending ? 'Connecting…' : 'Connect your first channel'}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {ch.map((channel: any) => {
              const auth = authConfig[channel.auth_status] || authConfig.missing
              const stats = channelStats(channel.slug)
              const isAuthBad = channel.auth_status === 'error' || channel.auth_status === 'missing'

              return (
                <div
                  key={channel.slug}
                  className={`bg-white rounded-md border p-5 flex flex-col gap-4 transition-colors ${
                    isAuthBad ? 'border-[#FECDD3]' : 'border-[#E5E5E5] hover:border-[#A3A3A3]'
                  }`}
                >
                  {/* Identity */}
                  <div className="flex items-start gap-3">
                    <ChannelAvatar name={channel.name || channel.slug} />
                    <div className="min-w-0 flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-[#0A0A0A] truncate">
                          {channel.name || channel.slug}
                        </p>
                        {channel.is_default && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[#FFFBEB] text-[#B45309] text-[10px] font-medium border border-[#FDE68A]">
                            <Star size={9} className="fill-[#F59E0B] text-[#F59E0B]" /> Default
                          </span>
                        )}
                      </div>
                      {channel.handle && (
                        <p className="text-xs text-[#A3A3A3] mt-0.5">{channel.handle}</p>
                      )}
                    </div>
                  </div>

                  {/* Auth status */}
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${auth.pill}`}>
                      {auth.icon} {auth.label}
                    </span>
                    {channel.channel_id && (
                      <a
                        href={`https://youtube.com/channel/${channel.channel_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-1 transition-colors"
                      >
                        YouTube <ExternalLink size={10} strokeWidth={1.5} />
                      </a>
                    )}
                  </div>

                  {/* Job stats */}
                  <div className="bg-[#FAFAFA] rounded-md px-4 py-3 grid grid-cols-3 gap-2 border border-[#F5F5F5]">
                    <StatChip label="Total jobs" value={stats.total} />
                    <StatChip label="Published" value={stats.done} />
                    <StatChip label="Last job" value={stats.lastDate} />
                  </div>

                  {/* Footer actions */}
                  <div className="border-t border-[#F5F5F5] pt-3 flex items-center justify-between">
                    <code className="text-xs text-[#A3A3A3] bg-[#F5F5F5] px-2 py-1 rounded-md">
                      {channel.slug}
                    </code>
                    <div className="flex items-center gap-2">
                      {!channel.is_default && (
                        <button
                          onClick={() => setDefaultMutation.mutate(channel.slug)}
                          disabled={setDefaultMutation.isPending}
                          title="Set as default"
                          className="text-xs text-[#A3A3A3] hover:text-[#0A0A0A] flex items-center gap-1 transition-colors disabled:opacity-40"
                        >
                          <Pin size={11} strokeWidth={1.5} /> Set default
                        </button>
                      )}
                      {isAuthBad && (
                        <button
                          onClick={() => resetAuthMutation.mutate(channel.slug)}
                          disabled={resetAuthMutation.isPending}
                          className="text-xs text-[#BE123C] hover:text-[#9F1239] font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw size={11} strokeWidth={1.5} /> Reconnect
                        </button>
                      )}
                      <Link
                        to={`/app/channels/${channel.slug}`}
                        className="text-xs text-[#525252] hover:text-[#0A0A0A] flex items-center gap-0.5 transition-colors font-medium"
                      >
                        Details <ChevronRight size={11} strokeWidth={1.5} />
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
