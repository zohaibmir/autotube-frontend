/** Whether one provider can actually be used by the caller, and on whose key (R4/F1).
 *  Produced by `api/key_resolver.provider_readiness()`. */
export interface ProviderReadiness {
  /** The account has stored its own key for this service. */
  user_key: boolean
  /** The deployment lends its key for this service *and* the account has the credits to pay for it. */
  platform_available: boolean
  /** Either of the above. */
  usable: boolean
  funding: 'byok' | 'platform' | null
  /** One canonical classification of the four booleans (R4 criterion 2). The two "not usable" cases are
   *  distinct because they have different fixes: `needs_key` (this deployment cannot provide it) vs
   *  `needs_credits` (included, but the balance cannot cover it). */
  state: 'user_key' | 'platform' | 'needs_key' | 'needs_credits'
  /** A human sentence naming the specific fix, so a UI does not have to derive one. */
  why: string
}

/** One event line on a job record, appended by `pipeline._add_job_event()`. */
export interface JobEvent {
  timestamp?: string
  level?: string
  message?: string
}

/** One pipeline job record — what `GET /api/pipeline/jobs` returns.
 *
 *  Shaped by `pipeline._JOB_FIELDS` (`pipeline.py`), which is the single list of what a record holds.
 *
 *  This interface previously declared `{ id, channel_id, type, status: 'pending' | 'processing' |
 *  'completed', config, output }` — **none** of which the endpoint returns, and it described a
 *  vocabulary (`completed`) the pipeline has never used (`done`). It was asserted at the API boundary
 *  (`apiClient.get<{ ok: boolean; jobs: Job[] }>`) and then overridden with `as any[]` at every consumer,
 *  so it neither described the payload nor checked anything. Corrected in R4 because the publication
 *  states below depend on `status` and `youtube_id` actually being typed.
 */
export interface Job {
  job_id: string
  topic?: string
  /** `running` / `done` / `error` are written by the pipeline. `interrupted` is set on startup for a
   *  job whose process is gone, `stale` is added by `list_jobs()` at read time for a `running` record
   *  whose pid is dead, and `queued` / `processing` appear on rows that have not started. */
  status: 'running' | 'done' | 'error' | 'interrupted' | 'stale' | 'queued' | 'processing'
  progress?: number
  current_step?: string
  pid?: number
  user_id?: string
  channel_slug?: string
  start_time?: string
  end_time?: string
  duration_seconds?: number
  /** Present once the render has been **uploaded** to YouTube. Its presence is the only upload evidence
   *  a job record carries — the upload's privacy (public / unlisted / private) is not recorded, on the
   *  job or on `videos`, so nothing here can claim a video is publicly visible. */
  youtube_id?: string
  youtube_url?: string
  error?: string
  events?: JobEvent[]
  multilingual_variants?: Record<string, { youtube_id?: string; youtube_url?: string }>
}

// Exactly what GET /api/channels returns -- one entry built by
// youtube_uploader.list_channels().
//
// This interface previously declared `{ id, channel_slug, channel_name,
// platform, account_id, connected_at, is_active }`, a payload the server has
// never returned. The pages correctly read `.slug` / `.name` (matching the
// server), so the TYPE was wrong, not the code -- and the previous tsconfig
// error (TS5070) was aborting `tsc` before it could report this.
export interface Channel {
  slug: string
  name: string
  handle?: string
  channel_id?: string
  is_default?: boolean
  has_token?: boolean
  auth_status?: string
  auth_message?: string
  token_refreshed?: boolean
  auth_scopes?: string[]
}

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  created_at: string
  plan: 'free' | 'pro' | 'enterprise'
  role?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  per_page: number
  has_more: boolean
}
