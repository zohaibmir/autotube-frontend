import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { jobsApi, channelsApi, queueApi, byokApi } from '@api/services'

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

// ── Job action (cancel / retry) ─────────────────────────────────────────────
export function useJobAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ jobId, action }: { jobId: string; action: 'cancel' | 'retry' | 'resume-from-merge' }) =>
      jobsApi.action(jobId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['pipeline'] })
    },
  })
}

// ── Channels (NewJob Step 1 + Channels page) ─────────────────────────────────
export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: () => channelsApi.list(),
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
