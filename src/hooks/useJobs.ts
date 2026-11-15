import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, channelsApi, queueApi, byokApi } from '@api/services'
import { apiErrorMessage } from '@lib/apiError'
import { useToast } from '@components/Toast'

// ── Jobs list (JobsList + DashboardHome) ─────────────────────────────────────
export function useJobs(params?: { search?: string; status?: string }) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => jobsApi.list(params),
    staleTime: 15_000,
  })
}

// ── Single job by ID - reads from cached list, overlays live status if running ──
export function useJob(jobId: string | undefined) {
  const { data: allJobs = [], isLoading } = useJobs()
  const { data: live } = usePipelineStatus()

  const base = (allJobs as any[]).find((j) => j.job_id === jobId)

  // If this exact job is currently in the pipeline, overlay live progress
const isLive = Boolean(
  jobId && (live?.run_id === jobId || live?.job_id === jobId)
)
  const job = base
    ? isLive
      ? { ...base, ...live, job_id: jobId }
      : base
    : undefined

  return { job, isLoading, isLive }
}

// ── Active pipeline status (DashboardHome stat card, JobDetail progress) ────
export function usePipelineStatus() {
  return useQuery({
    queryKey: ['pipeline', 'status'],
    queryFn: () => jobsApi.getStatus(),
    refetchInterval: 3_000,
    staleTime: 0,
  })
}

// ── Job action (cancel / retry / resume) ────────────────────────────────────
export function useJobAction() {
  const queryClient = useQueryClient()
  const toast = useToast()
  return useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: 'cancel' | 'retry' | 'resume-from-merge' }) =>
      jobsApi.action(jobId, action),
    onSuccess: (
      res: { ok?: boolean; message?: string | null } | undefined,
      variables: { jobId: string; action: 'cancel' | 'retry' | 'resume-from-merge' },
    ) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
      // The backend explains what it actually did. For long-form, a "resume" is a rerun because
      // checkpoints do not exist there, and saying so beats a success that means something other
      // than what the button implied.
      if (res?.message) {
        toast.info(res.message)
      } else if (variables.action === 'resume-from-merge') {
        toast.success('Resumed')
      } else if (variables.action === 'retry') {
        toast.success('Restarted from the beginning')
      } else {
        toast.success('Cancel requested')
      }
    },
    onError: (err: unknown) => {
      // This had no onError at all, so a failed action was silent -- and every long-form retry
      // failed with a 500, which is why the buttons looked like they did nothing.
      toast.error(apiErrorMessage(err, 'That action failed'))
    },
  })
}

// ── Channels (NewJob Step 1 + Channels page) ─────────────────────────────────
export function useChannels(all = false) {
  return useQuery({
    // Keyed by scope so the two views never share a cache entry. Invalidations elsewhere use the
    // ['channels'] prefix, which matches both variants -- that is deliberate, so a mutation refreshes
    // whichever view is on screen.
    queryKey: ['channels', { all }],
    queryFn: () => channelsApi.list(all),
    staleTime: 60_000,
  })
}

// ── Create job (NewJob Step 4 submit) ────────────────────────────────────────
export function useCreateJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (config: Record<string, any>) => jobsApi.create(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    },
  })
}

// ── Topic queue ──────────────────────────────────────────────────────────────
export function useQueue(channelSlug?: string) {
  return useQuery({
    queryKey: ['queue', channelSlug ?? 'all'],
    queryFn: () => queueApi.list(channelSlug),
    staleTime: 15_000,
  })
}

export function useQueueAdd() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ topic, channelSlug, contentType, payload }: {
      topic: string
      channelSlug?: string
      contentType?: string
      payload?: Record<string, unknown>
    }) => queueApi.add(topic, channelSlug, undefined, contentType, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'], exact: false }),
  })
}

export function useQueueRemove() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string | number) => queueApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'], exact: false }),
  })
}

export function useQueueReorder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) => queueApi.reorder(ids),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queue'], exact: false }),
  })
}

// ── BYOK API keys status ──────────────────────────────────────────────────────
export function useByokStatus() {
  return useQuery({
    queryKey: ['byok'],
    queryFn: () => byokApi.status(),
    staleTime: 30_000,
  })
}

export function useByokSave() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ service, key }: { service: string; key: string }) => byokApi.save(service, key),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['byok'] }),
  })
}

export function useByokRemove() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (service: string) => byokApi.remove(service),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['byok'] }),
  })
}
