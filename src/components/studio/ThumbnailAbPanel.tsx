import { useState } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { analyticsApi } from '@/api/services'
import { useToast } from '@/components/Toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiErrorMessage } from '@/lib/apiError'
import { useChannels } from '@/hooks/useJobs'

type AbVariant = {
  variant_id: number | null
  label: string
  set_at: string | null
  retired_at: string | null
  impressions: number | null
  clicks: number | null
  ctr_percent: number | null
  partial: boolean
  image_data?: string | null
}

type AbVerdict = {
  state: 'no_data' | 'collecting' | 'no_difference' | 'winner'
  winner_variant_id: number | null
  confidence: number | null
  needed_per_variant: number | null
  note: string
}

export interface ThumbnailAbPanelProps {
  videoId?: string
  embedded?: boolean
  onReportChange?: () => void
}

export function ThumbnailAbPanel(props: ThumbnailAbPanelProps) {
  return <ThumbnailAbVideoPanel key={props.videoId || ''} {...props} />
}

function ThumbnailAbVideoPanel({ videoId, onReportChange, embedded = false }: ThumbnailAbPanelProps) {
  const toast = useToast()
  const qc = useQueryClient()

  const [busy, setBusy] = useState(false)
  const { data: channels = [] } = useChannels()
  const [channelSlug, setChannelSlug] = useState('')
  const selectedChannel = channelSlug || channels.find(channel => channel.is_default)?.slug ||
    (channels.length === 1 ? channels[0].slug : '')

  const [variantImagePath, setVariantImagePath] = useState<string | null>(null)
  const [variantLabel, setVariantLabel] = useState('')
  const [variantBusy, setVariantBusy] = useState(false)

  const reportQuery = useQuery({
    queryKey: ['thumb-ab', videoId],
    queryFn: () => analyticsApi.thumbnailAb(videoId || ''),
    enabled: !!videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId),
    retry: false,
  })

  const report = reportQuery.data as
    | { variants?: AbVariant[]; verdict?: AbVerdict; readings?: number; message?: string }
    | undefined
  const variants = report?.variants ?? []
  const verdict = report?.verdict

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try {
      await fn()
      await qc.invalidateQueries({ queryKey: ['thumb-ab', videoId] })
      toast.success(ok)
      onReportChange?.()
    } catch (e) {
      toast.error(apiErrorMessage(e, 'That did not work'))
    } finally {
      setBusy(false)
    }
  }

  const registerBaseline = async () => {
    if (!videoId) return
    await run(() => analyticsApi.thumbnailAbBaseline(videoId), 'Baseline registered')
  }

  const stopTest = async () => {
    if (!videoId) return
    await run(() => analyticsApi.thumbnailAbStop(videoId), 'Test stopped')
  }

  const applyVariant = async (variantId: number) => {
    if (!videoId) return
    await run(
      () => analyticsApi.thumbnailAbSelect(videoId, variantId),
      'Selected cover accepted; display updates may take time',
    )
  }

  const setChallenger = async () => {
    if (!variantImagePath || !videoId) return
    setVariantBusy(true)
    try {
      await analyticsApi.thumbnailAbChallenger(videoId, variantImagePath, variantLabel || undefined)
      await qc.invalidateQueries({ queryKey: ['thumb-ab', videoId] })
      toast.success('YouTube accepted the cover; display updates may take time')
      onReportChange?.()
    } catch (e) {
      toast.error(apiErrorMessage(e, 'That did not work'))
    } finally {
      setVariantBusy(false)
    }
  }

  const abState = verdict ? AB_STATE[verdict.state] ?? AB_STATE.no_data : null
  const hasLive = variants.some((v) => !v.retired_at)
  const winner = variants.find(variant => variant.variant_id === verdict?.winner_variant_id)

  return (
    <div className={embedded ? 'mt-[16px]' : 'mt-[16px] bg-white border border-[#E5E5E5] rounded-xl p-[16px] sm:p-[24px]'}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-[#0A0A0A]">Thumbnail A/B</h3>
          <p className="text-[11px] text-[#A3A3A3]">
            Sequential cover rotation, not YouTube's native simultaneous A/B test.
            Requires captured impressions/CTR readings; Shorts-feed views are not thumbnail clicks.
          </p>
          <p className="text-xs text-[#525252] mt-2">1. Load your video · 2. Register baseline · 3. Upload a challenger · 4. Review measured results</p>
        </div>
        {verdict?.winner_variant_id != null && (
          <button
            type="button"
            onClick={() => applyVariant(verdict.winner_variant_id!)}
            disabled={busy || variantBusy || !winner?.image_data || !winner.retired_at}
            className="flex items-center gap-1.5 h-7 px-2.5 rounded border border-[#E5E5E5] text-[11px] font-medium text-[#16A34A] hover:bg-[#F0FFF4] disabled:opacity-40 transition-colors"
          >
            <CheckCircle size={11} strokeWidth={1.5} />
            Apply winning cover
          </button>
        )}
      </div>

      {!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId) ? (
        <div className="px-4 py-5 text-[12px] text-[#525252]">
          Load a video to register its current thumbnail as the baseline, then add challenger
          variants and let the data decide the winner.
        </div>
      ) : reportQuery.isLoading ? (
        <div className="px-4 py-6 flex items-center gap-2 text-[12px] text-[#A3A3A3]">
          <Loader2 size={13} strokeWidth={1.5} className="animate-spin" /> Loading…
        </div>
      ) : reportQuery.isError ? (
        <div className="px-4 py-5 text-[12px] text-[#B42318]">
          {apiErrorMessage(reportQuery.error, 'Could not load that video. It must be one of yours.')}
          <div className="mt-3 space-y-2 text-[#525252]">
            <p>Already on YouTube? Import this video from its connected channel. This does not change its thumbnail.</p>
            <select aria-label="Thumbnail test channel" value={selectedChannel}
              onChange={event => setChannelSlug(event.target.value)} className="border rounded p-2 w-full">
              <option value="">Select a channel</option>
              {channels.map(channel => <option key={channel.slug} value={channel.slug}>{channel.name || channel.slug}</option>)}
            </select>
            <button type="button" disabled={busy || !selectedChannel}
              onClick={() => run(() => analyticsApi.thumbnailAbImport(videoId!, selectedChannel), 'Video imported; live cover unchanged')}
              className="border rounded px-3 py-2 disabled:opacity-40">
              {busy ? 'Importing…' : 'Import existing YouTube video'}
            </button>
          </div>
        </div>
      ) : variants.length === 0 ? (
        <div className="px-4 py-5 text-[12px] text-[#525252]">
          No variants yet. Register the thumbnail that is live now as the baseline — that does not
          change anything on YouTube.
          <button type="button" disabled={busy} onClick={registerBaseline}
            className="block mt-3 rounded border px-3 py-2 disabled:opacity-40">
            Register current as baseline
          </button>
        </div>
      ) : (

        <>
          {verdict && (
            <div className="mt-3 rounded border border-[#F5F5F5] bg-[#FAFAFA] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`text-[11px] font-semibold ${abState?.cls ?? ''}`}>
                  {abState?.label ?? verdict.state}
                </span>
                {verdict.confidence !== null && (
                  <span className="text-[11px] text-[#A3A3A3] ml-1.5">
                    {(verdict.confidence * 100).toFixed(1)}% confidence
                  </span>
                )}
              </div>
              <p className="text-[11.5px] text-[#525252] mt-1">{verdict.note}</p>
            </div>
          )}

          <div className="rounded border border-[#E5E5E5] overflow-x-auto" role="region" aria-label="Thumbnail comparison results" tabIndex={0}>
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-[#F5F5F5]">
                  {['Thumbnail', 'Live from', 'Impressions', 'Clicks', 'CTR', 'Status'].map((h, i) => (
                    <th key={h} className={`py-2 text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest ${i >= 2 ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variants.map((v) => (
                  <tr key={v.variant_id ?? v.label} className="border-b border-[#F5F5F5] last:border-b-0">
                    <td className="py-2">
                      <div className="w-10 h-10 rounded overflow-hidden border border-[#E5E5E5] flex-shrink-0">
                        {v.image_data
                          ? <img src={v.image_data} alt={v.label || 'Thumbnail variant'} className="w-full h-full object-cover" />
                          : <div className="w-full h-full bg-[#F5F5F4]" title="No saved cover image" />}
                      </div>
                      <p className="text-[11px] mt-1">{v.label}</p>
                    </td>
                    <td className="py-2 text-[12px] text-[#0A0A0A]">
                      {v.set_at ? new Date(v.set_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.impressions === null ? '—' : v.impressions.toLocaleString()}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.clicks === null ? '—' : v.clicks.toFixed(0)}
                    </td>
                    <td className="py-2 text-[12px] text-right tabular-nums">
                      {v.ctr_percent === null ? '—' : v.ctr_percent.toFixed(2) + '%'}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                        v.retired_at && v.retired_at !== null
                          ? 'text-[#A3A3A3] line-through'
                          : v.ctr_percent !== null && v.ctr_percent >= 8
                          ? 'text-[#16A34A]'
                          : 'text-[#525252]'
                      }`}>
                        {v.retired_at ? 'Retired' : 'Active window'}
                      </span>
                      {v.retired_at && v.image_data && v.variant_id != null && (
                        <button type="button" className="block text-[11px] underline"
                          disabled={busy || variantBusy} onClick={() => applyVariant(v.variant_id!)}>
                          Apply cover: {v.label}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={busy || variantBusy || hasLive}
              onClick={registerBaseline}
              className="flex-1 h-8 px-3 rounded border border-[#0A0A0A] text-[11px] font-medium text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white disabled:opacity-40 transition-colors"
            >
              Register current as baseline
            </button>
            {hasLive && (
              <button
                type="button"
                disabled={busy || variantBusy}
                onClick={stopTest}
                className="h-8 px-3 rounded border border-[#E5E5E5] text-[11px] font-medium text-[#B42318] hover:bg-[#FEF2F2] disabled:opacity-40 transition-colors"
              >
                Stop test
              </button>
            )}
          </div>

          {variants.length > 0 && (
            <div className="mt-3 pt-3 border-t border-[#F5F5F5]">
              <p className="text-[10px] font-medium text-[#A3A3A3] uppercase tracking-widest mb-1.5">
                Add challenger
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1 relative">
                  <input
                    type="file"
                    aria-label="Challenger cover"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      setVariantImagePath(null)
                      if (file) {
                        if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > 2_000_000) {
                          toast.error('Choose a JPEG or PNG cover under 2 MB.')
                          return
                        }
                        const reader = new FileReader()
                        reader.onerror = () => toast.error('Could not read the selected cover.')
                        reader.onload = () => {
                          setVariantImagePath(reader.result as string)
                        }
                        reader.readAsDataURL(file)
                      }
                    }}
                    className="block w-full px-3 py-2 text-[13px] text-[#0A0A0A] bg-white border border-[#E5E5E5] rounded-md file:text-[#0A0A0A] focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
                <input
                  value={variantLabel}
                  onChange={(e) => setVariantLabel(e.target.value)}
                  placeholder="Variant label (e.g. Blue text)"
                  className="h-8 px-3 rounded border border-[#E5E5E5] text-[12px] focus:outline-none focus:border-[#0A0A0A]"
                />
                <button
                  type="button"
                  disabled={!variantImagePath || variantBusy || busy}
                  onClick={setChallenger}
                  className="h-8 px-3 rounded bg-[#0A0A0A] text-white text-[11px] font-medium hover:bg-[#262626] disabled:opacity-40 transition-colors"
                >
                  {variantBusy ? 'Applying cover…' : 'Apply challenger'}
                </button>
              </div>
              <p className="text-[10.5px] text-[#A3A3A3] mt-1.5">
                Upload a JPEG/PNG (up to 2 MB). Applying changes this existing video's cover, not the video
                or its visibility. YouTube processing must finish first; grid updates may take time.
                The original baseline is measurement-only: upload its original image if you want to restore it.
              </p>
              {variantImagePath && <img src={variantImagePath} alt="Challenger cover preview" className="mt-2 max-h-48 rounded" />}
            </div>
          )}

        </>
      )}
    </div>
  )
}

const AB_STATE: Record<string, { label: string; cls: string }> = {
  no_data:       { label: 'No readings yet', cls: 'text-[#A3A3A3]' },
  collecting:    { label: 'Collecting',      cls: 'text-[#B45309]' },
  no_difference: { label: 'No difference',   cls: 'text-[#525252]' },
  winner:        { label: 'Winner',          cls: 'text-[#16A34A]' },
}
