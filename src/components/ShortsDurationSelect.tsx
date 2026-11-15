import { useQuery } from '@tanstack/react-query'
import { channelProfilesApi } from '@api/services'
import { useChannels } from '@hooks/useJobs'

export const SHORTS_DURATIONS = [30, 45, 60, 90, 120, 150, 180]

export function useShortsDuration(channelSlug: string, override: number | null) {
  const { data: channels = [], isLoading: channelsLoading, error: channelsError } = useChannels()
  const slug = channelSlug || channels.find(channel => channel.is_default)?.slug ||
    (channels.length === 1 ? channels[0].slug : '')
  const profile = useQuery({
    queryKey: ['channel-profile', slug],
    queryFn: () => channelProfilesApi.get(slug),
    enabled: !!slug,
  })
  const saved = profile.data?.profile.shorts_duration_seconds
  const channelDefault = typeof saved === 'number' ? saved : 120
  return {
    seconds: override ?? channelDefault,
    channelDefault,
    loading: override === null && (channelsLoading || (!!slug && profile.isLoading)),
    error: override === null ? (channelsError || profile.error) : null,
  }
}

export default function ShortsDurationSelect({
  value, onChange, channelDefault = 120,
}: {
  value: number | null
  onChange: (seconds: number | null) => void
  channelDefault?: number
}) {
  return (
    <label className="block text-xs">
      Shorts length
      <select aria-label="Shorts length" value={value ?? ''}
        onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}
        className="block w-full border rounded p-2 mt-1">
        <option value="">Channel default ({channelDefault}s)</option>
        {value !== null && !SHORTS_DURATIONS.includes(value) && <option value={value}>{value}s</option>}
        {SHORTS_DURATIONS.map(seconds => <option key={seconds} value={seconds}>{seconds}s</option>)}
      </select>
      <span className="block text-[11px] text-[#737373] mt-1">
        Target, not padding. Actual narration/render must be within 15% (maximum 180s).
        Longer stories need more verified substance and visuals.
      </span>
    </label>
  )
}
