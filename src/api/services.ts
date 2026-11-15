import apiClient from './client'
import { tokenStore } from '@lib/tokenStore'
import { Job, Channel, ProviderReadiness } from '@/types/api'

// ── Analytics AI contracts (R1) ───────────────────────────────────────────────
//
// These mirror what `analytics_ai.py` returns. They are **declared** rather than inferred, which is the
// whole point: the previous mismatch between these two files was invisible to the compiler and rendered
// every insight card as raw JSON while leaving the weekly digest permanently empty. With types, changing
// one side without the other is a build error.

/** Three states the UI must not merge. `insufficient_data` is not a failure, and neither is a
 *  legitimately-empty result — but `error` is, and all three used to read as "sync from YouTube first". */
export type AiStatus = 'ok' | 'insufficient_data' | 'error'

/** One insight card. `analytics_ai.generate_insights_summary` builds exactly these keys. */
export interface InsightCard {
  /** Pattern name — this is the card heading. */
  title: string
  metric?: string
  effect?: string
  /** 0–1. */
  confidence?: number
  icon?: string
}

/** A recommended next step. Returned as a **top-level list**, not attached to a card. */
export interface InsightAction {
  action: string
  /** 0-based, lower is more important. */
  priority?: number
  status?: string
}

export interface InsightsResponse {
  /** Absent only from a backend older than this change; treat as 'ok'. */
  status?: AiStatus
  insights: InsightCard[]
  actions?: InsightAction[]
  summary?: string
  confidence?: number
  generated_at?: string
  /** Present when `status === 'error'`. */
  error?: string
  /** Present when `status === 'insufficient_data'`; `summary` carries the same text. */
  message?: string
}

/** A raw pattern as the model returns it, before `generate_insights_summary` maps it into a card.
 *  The digest returns these **unmapped** (no `title`, no `icon`), which is why the panel must read
 *  `name` rather than the card's `title`. */
export interface InsightPattern {
  name?: string
  metric?: string
  effect?: string
  confidence?: number
}

export interface DigestResponse {
  status?: AiStatus
  channel?: string
  period?: string
  generated_at?: string
  subject?: string
  top_patterns?: InsightPattern[]
  action_items?: string[]
  /** Prose summary. */
  insights?: string
  confidence?: number
  error?: string
  message?: string
}

const _apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const _authFetch = (url: string, init: RequestInit) => {
  const token = tokenStore.getAccess()
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
}

// The effective-configuration quote (R7). Field names and their meaning are pinned server-side in
// `core/quote.py`; this mirrors `PipelineQuoteResponse`.
export interface JobQuote {
  version: number
  issued_at: number
  expires_at: number
  outputs: {
    format?: string
    shorts_count?: number
    shorts_mode?: string
    output_count?: number
    visual_source?: string
    languages?: string[]
    target_languages?: string[]
    duration_hint?: string | null
  }
  pricing: {
    /** `fixed` = the credits below are what will be charged. `measured` = they are a floor. */
    mode: 'fixed' | 'measured'
    /** The recipe the charge will use; `null` for a measured job. */
    recipe: string | null
    credits: number
    credits_remaining: number | null
    /** Allowance plus purchased credits. Distinct from `credits_remaining`, which is null both for a
     *  never-seeded account and for an unmetered one. */
    credits_total: number | null
    /** False when the balance read reported failure. It does not raise, so this flag is the only signal. */
    balance_known: boolean
    /** **The credit gate's own answer**, not a comparison done here. `null` means the gate could not be
     *  asked — render that as "checked when you start", never as "yes". */
    affordable: boolean | null
    reservation: string
    provider_cost_usd: number | null
    /** False means the cost is not knowable yet — do not print a figure. */
    provider_cost_known: boolean
  }
  funding: Array<{
    operation: string
    service: string
    model: string | null
    /** `user_key` = the creator's own invoice; `platform` = included; `free` = no key, no cost. */
    source: 'user_key' | 'platform' | 'free' | 'unavailable'
    usable: boolean
  }>
  readiness: {
    ok: boolean
    blockers: Array<{ error?: string; error_code?: string; channel?: string }>
    channel: string | null
  }
  publishing: {
    mode: string | null
    channel: string | null
    render_ready: boolean
  }
}

// Route paths mirror the FastAPI router prefixes (which already include /api/)
export const jobsApi = {
  // GET /api/pipeline/jobs
  list: async (params?: { search?: string; status?: string }) => {
    const response = await apiClient.get<{ ok: boolean; jobs: Job[] }>('/api/pipeline/jobs', { params })
    return response.data.jobs ?? []
  },

  // GET /api/pipeline/status (single active job state)
  getStatus: async () => {
    const response = await apiClient.get('/api/pipeline/status')
    return response.data
  },

  // POST /api/pipeline/run
  create: async (config: Record<string, any>) => {
    const response = await apiClient.post('/api/pipeline/run', config)
    return response.data
  },

  // POST /api/pipeline/quote — the effective-configuration quote (R7). Lives on jobsApi with the other
  // /api/pipeline/* routes.
  //
  // Everything the submit screen needs to describe a job honestly, computed server-side from the same
  // decision the credit gate and the completion charge use. `pricing.mode === 'measured'` means the job has
  // no fixed price (an animated channel's clip count is not known until the script exists), so
  // `pricing.credits` is a *floor* — render it as "from N credits", never as a total.
  //
  // `pricing.affordable` is `null` when the balance could not be read, which is not the same as `true`.
  quote: async (config: Record<string, unknown>): Promise<JobQuote> => {
    const response = await apiClient.post<JobQuote>('/api/pipeline/quote', config)
    return response.data
  },

  // POST /api/pipeline/run (alias used by Create flow SubmitPage)
  run: async (config: {
    topic: string
    channel_slug?: string
    content_type?: string
    scriptText?: string
    seoTitle?: string
    seoDescription?: string
    seoTags?: string
    thumbDataUrl?: string
    [key: string]: unknown
  }) => {
    const response = await apiClient.post('/api/pipeline/run', config)
    return response.data
  },

  // POST /api/pipeline/jobs/action { job_id, action: cancel | retry | resume-from-merge }
  // POST /api/pipeline/jobs/delete — remove job RECORDS only (never videos, never running jobs).
  deleteMany: async (jobIds: string[]) => {
    const response = await apiClient.post('/api/pipeline/jobs/delete', { job_ids: jobIds })
    return response.data as {
      ok: boolean
      deleted: number
      deleted_ids: string[]
      skipped: Array<{ job_id: string; reason: string }>
    }
  },

  action: async (jobId: string, action: 'cancel' | 'retry' | 'resume-from-merge') => {
    if (action === 'cancel') {
      // Cancel a SPECIFIC job by ID via the kill endpoint (marks the persisted
      // .jobs/*.json record as killed) instead of the old global /cancel call,
      // which only reset an in-memory singleton unrelated to this job_id and
      // never touched the job's actual persisted status.
      // NOTE: this still cannot forcibly stop the in-process background thread
      // doing the actual work (script/TTS/render) - see IMPROVEMENTS.md §1 B8.
      const response = await apiClient.post(`/api/pipeline/kill/${jobId}`)
      return response.data
    }
    // retry → 'rerun', resume-from-merge → 'continue'
    const apiAction = action === 'retry' ? 'rerun' : 'continue'
    const response = await apiClient.post('/api/pipeline/jobs/action', { job_id: jobId, action: apiAction })
    return response.data
  },

  // POST /api/pipeline/cancel
  cancel: async () => {
    const response = await apiClient.post('/api/pipeline/cancel')
    return response.data
  },

  // GET /api/pipeline/lock-status
  lockStatus: async () => {
    const r = await apiClient.get('/api/pipeline/lock-status')
    return r.data
  },

  // POST /api/pipeline/upload - publish the currently-ready pipeline video to YouTube.
  // job_id lets the backend recover the video's file paths from disk (runs/<job_id>/)
  // when the in-memory pipeline singleton no longer matches this job - e.g. after a
  // server restart, or once a later run has reset it.
  upload: async (payload: { channel_slug?: string; privacy_status?: 'public' | 'unlisted' | 'private'; job_id?: string }) => {
    const response = await apiClient.post('/api/pipeline/upload', payload)
    return response.data
  },
}

export const channelsApi = {
  // GET /api/channels[?all=true]
  // Scoped to the caller's own channels by default -- for admins too. `all` is the explicit
  // deployment-wide view an admin can ask for (the Admin page's job filter uses it); the server ignores
  // it for everyone else.
  list: async (all = false) => {
    const response = await apiClient.get<{ ok: boolean; channels: Channel[]; scope?: string }>(
      '/api/channels', all ? { params: { all: true } } : undefined,
    )
    return response.data.channels ?? []
  },

  // POST /api/channels/add  { name } → { ok, slug, channel_id } (local) or
  // { ok, requires_oauth: true, oauth_url } (hosted - open in a popup)
  add: async (name: string) => {
    const response = await apiClient.post('/api/channels/add', { name })
    return response.data
  },

  // POST /api/channels/{slug}/reset-auth - same dual local/hosted-OAuth response shape as `add`
  resetAuth: async (slug: string) => {
    const response = await apiClient.post(`/api/channels/${slug}/reset-auth`)
    return response.data
  },

  // DELETE /api/channels/{slug} - removes the channel for the calling account. The server allows an admin
  // to remove any channel (the listing is unfiltered for them), which is how a stale or foreign entry is
  // cleaned up without touching the database by hand.
  remove: async (slug: string): Promise<{ ok: boolean }> => {
    const response = await apiClient.delete(`/api/channels/${encodeURIComponent(slug)}`)
    return response.data
  },

  // POST /api/channels/refresh-tokens
  refreshTokens: async () => {
    const response = await apiClient.post('/api/channels/refresh-tokens')
    return response.data
  },

  // POST /api/channels/default  { slug }
  setDefault: async (slug: string) => {
    const response = await apiClient.post('/api/channels/default', { slug })
    return response.data
  },

  // GET /api/channels/oauth-diagnostics
  oauthDiagnostics: async () => {
    const r = await apiClient.get('/api/channels/oauth-diagnostics')
    return r.data
  },
}

export const settingsApi = {
  getApiKeys: async () => {
    const response = await apiClient.get('/api/settings/api-keys')
    return response.data
  },
  createApiKey: async (name: string) => {
    const response = await apiClient.post('/api/settings/api-keys', { name })
    return response.data
  },
  deleteApiKey: async (keyId: string) => {
    const response = await apiClient.delete(`/api/settings/api-keys/${keyId}`)
    return response.data
  },
}

// ── Topic Queue ──────────────────────────────────────────────────────────────
export const queueApi = {
  // GET /api/queue/pending?channel_slug=
  list: async (channelSlug?: string) => {
    const response = await apiClient.get<{ ok: boolean; items: any[] }>('/api/queue/pending', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data.items ?? []
  },

  // POST /api/queue/add  { topic, channel_slug?, scheduled_date?, content_type?, payload? }
  add: async (topic: string, channelSlug?: string, scheduledDate?: string, contentType?: string, payload?: Record<string, unknown>) => {
    // `scheduled` is a timestamptz. A bare "2026-10-18" is read as 00:00 UTC, which is the evening of the
    // 17th west of Greenwich and put the topic on the wrong calendar day. Anchor a bare date to local
    // noon instead; a full ISO instant is passed through untouched.
    const scheduled = scheduledDate && /^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)
      ? new Date(`${scheduledDate}T12:00:00`).toISOString()
      : (scheduledDate ?? null)
    const response = await apiClient.post('/api/queue/add', {
      topic,
      channel_slug: channelSlug ?? null,
      scheduled_date: scheduled,
      content_type: contentType ?? null,
      payload: payload ?? null,
    })
    return response.data
  },

  // DELETE /api/queue/delete/:id
  remove: async (id: string | number) => {
    const response = await apiClient.delete(`/api/queue/delete/${id}`)
    return response.data
  },

  // POST /api/queue/reorder  { ordered_ids: number[] }
  reorder: async (ids: number[]) => {
    const response = await apiClient.post('/api/queue/reorder', { ordered_ids: ids })
    return response.data
  },
}

// ── Voice API ─────────────────────────────────────────────────────────────────

export type VoiceEntry = {
  id: string
  name: string
  locale?: string
  gender?: 'male' | 'female' | null
  desc?: string | null
  lang?: string
  region?: string
  accent?: string
  multilingual?: boolean
}

export type VoiceGroup = {
  id: string
  label: string
  voices: VoiceEntry[]
}

export type VoiceListResponse = {
  ok: boolean
  groups: VoiceGroup[]
  elevenlabs_configured: boolean
  elevenlabs_voice_id: string
  elevenlabs_stability: number
  elevenlabs_similarity: number
  elevenlabs_style: number
  tts_provider: 'edge' | 'elevenlabs' | 'gtts'
}

export const voiceApi = {
  // GET /api/voices/list - all Edge TTS groups + EL settings
  list: async (): Promise<VoiceListResponse> => {
    const r = await apiClient.get<VoiceListResponse>('/api/voices/list')
    return r.data
  },

  // GET /api/voices/languages - canonical dubbing languages
  // (voice_config.LANGUAGE_VOICES, so the UI never hardcodes a second list)
  languages: async (): Promise<string[]> => {
    const r = await apiClient.get<{ ok: boolean; languages: string[] }>('/api/voices/languages')
    return r.data.languages ?? []
  },

  // GET /api/voices/assignments - { slug: voice_id } map
  assignments: async (): Promise<Record<string, string>> => {
    const r = await apiClient.get<{ ok: boolean; assignments: Record<string, string> }>('/api/voices/assignments')
    return r.data.assignments ?? {}
  },

  // GET /api/channels/:slug/voice
  channelVoice: async (slug: string): Promise<{ voice_id: string | null }> => {
    const r = await apiClient.get<{ ok: boolean; voice_id: string | null }>(`/api/channels/${slug}/voice`)
    return r.data
  },

  // POST /api/channels/:slug/voice  { voice_id }
  setChannelVoice: async (slug: string, voiceId: string) => {
    const r = await apiClient.post(`/api/channels/${slug}/voice`, { voice_id: voiceId })
    return r.data
  },

  // POST /api/voices/elevenlabs/settings
  saveElevenLabsSettings: async (settings: {
    voice_id?: string
    stability?: number
    similarity?: number
    style?: number
    tts_provider?: 'edge' | 'elevenlabs' | 'gtts'
  }) => {
    const r = await apiClient.post('/api/voices/elevenlabs/settings', settings)
    return r.data
  },

  // GET /api/voices/preview/:voiceId — a short synthesised sample, cached server-side.
  // Fetched as a blob because the endpoint needs the bearer token, which an <audio src> cannot send.
  preview: async (voiceId: string): Promise<string> => {
    const r = await apiClient.get(`/api/voices/preview/${encodeURIComponent(voiceId)}`, {
      responseType: 'blob',
    })
    return URL.createObjectURL(r.data as Blob)
  },
}

// ── Admin API (W9 margin) ─────────────────────────────────────────────────────
// Cross-user platform intelligence, gated server-side by require_admin.
export const adminApi = {
  // GET /api/admin/margin?days=30
  margin: async (days = 30): Promise<{
    ok: boolean
    days: number
    generated_at: string
    throttle_ratio: number
    totals: {
      users: number
      paying_users: number
      revenue_usd: number
      cost_usd: number
      priced_cost_usd: number
      margin_pct: number | null
      custom_priced_users: number
    }
    by_plan: Array<{
      plan: string
      users: number
      revenue_usd: number
      cost_usd: number
      margin_pct: number | null
      custom_pricing: boolean
    }>
    top_spenders: MarginUser[]
    users: MarginUser[]
  }> => {
    const r = await apiClient.get('/api/admin/margin', { params: { days } })
    return r.data
  },
}

export interface MarginUser {
  user_id: string
  email: string | null
  plan: string
  credits_remaining: number | null
  cost_usd: number
  events: number
  byok_events: number
  revenue_usd: number | null
  margin_pct: number | null
  custom_pricing: boolean
  throttled: boolean
  top_provider: string | null
}

// ── BYOK API Keys ─────────────────────────────────────────────────────────────
export const byokApi = {
  // Backend returns { keys: { anthropic: bool, elevenlabs: bool, ... } } - normalise
  // to a flat Record<string, boolean> here so every consumer (DashboardHome onboarding
  // checklist, Settings → API Keys tab, AdminPage system-health widget) can keep using
  // simple Object.values(status).some/filter(Boolean) checks without re-implementing
  // the unwrap themselves. Previously each consumer read the raw nested shape directly,
  // which made Object.values(status) return a single (always-truthy) nested object —
  // so the Settings API Keys tab showed every provider as "Not set" regardless of
  // actual state, and the onboarding checklist / admin health widget were similarly wrong.
  status: async (): Promise<Record<string, boolean>> => {
    const response = await apiClient.get<{ keys?: Record<string, boolean> } | Record<string, boolean>>('/api/user/api-keys')
    const data = response.data as any
    return data && typeof data === 'object' && data.keys && typeof data.keys === 'object'
      ? data.keys
      : data
  },

  // Whether each provider will actually work for this caller, and on whose key (R4/F1).
  // `status` above answers "what have I stored", which cannot tell a bundled-credit customer (funded by
  // the platform, nothing stored) apart from an account with nothing configured at all. The onboarding
  // checklist needs this one.
  readiness: async (): Promise<Record<string, ProviderReadiness>> => {
    const response = await apiClient.get<{ readiness?: Record<string, ProviderReadiness> }>(
      '/api/user/api-keys',
    )
    return response.data?.readiness ?? {}
  },

  // POST /api/user/api-keys  { service, key }
  save: async (service: string, key: string) => {
    const response = await apiClient.post('/api/user/api-keys', { service, key })
    return response.data
  },

  // DELETE /api/user/api-keys/:service
  remove: async (service: string) => {
    const response = await apiClient.delete(`/api/user/api-keys/${service}`)
    return response.data
  },
}

// ── Community Posts API ───────────────────────────────────────────────────────

export type CommunityPost = {
  id: number
  text: string
  channel_slug: string | null
  youtube_id: string | null
  job_id: string | null
  posted: number  // 0 = draft, 1 = posted
  posted_at: string | null
  created_at: string
}

export const communityApi = {
  // GET /api/community-posts?channel_slug=&limit=
  list: async (params?: { channel_slug?: string; limit?: number }): Promise<{ ok: boolean; posts: CommunityPost[] }> => {
    const r = await apiClient.get('/api/community-posts', { params })
    return r.data
  },

  // POST /api/community-posts/generate - returns text, does NOT save
  generate: async (payload: {
    title: string
    description?: string
    tags?: string[]
    channel_slug?: string
  }): Promise<{ ok: boolean; post?: string; source?: string; error?: string }> => {
    const r = await apiClient.post('/api/community-posts/generate', payload)
    return r.data
  },

  // POST /api/community-posts - save a draft to the library
  save: async (payload: {
    text: string
    channel_slug?: string
    youtube_id?: string
    job_id?: string
  }): Promise<{ ok: boolean; id?: number }> => {
    const r = await apiClient.post('/api/community-posts', payload)
    return r.data
  },

  // POST /api/community-posts/:id/mark-posted
  markPosted: async (id: number): Promise<{ ok: boolean }> => {
    const r = await apiClient.post(`/api/community-posts/${id}/mark-posted`)
    return r.data
  },

  // DELETE /api/community-posts/:id
  delete: async (id: number): Promise<{ ok: boolean }> => {
    const r = await apiClient.delete(`/api/community-posts/${id}`)
    return r.data
  },
}

// ─── Shorts ───────────────────────────────────────────────────────────────────

export type ShortsScenePrompt = {
  scene: number
  prompt: string
  duration_sec: number
}

export type ShortsAnimatedJob = {
  status: 'generating' | 'ready' | 'failed' | 'not_found'
  phase: string
  progress: number
  topic: string
  paths: string[]
  results: Array<{ path: string; uploaded: Record<string, string>; errors: Record<string, string> }>
  error?: string | null
}

export type ShortsScriptJob = {
  duration_seconds?: number
  measured_duration_seconds?: number
  status: 'idle' | 'running' | 'done' | 'failed'
  topic?: string
  message?: string
  video_path?: string | null
  video_url?: string | null
  youtube_url?: string | null
  error?: string | null
  job_id?: string
  youtube_id?: string
  channel_slug?: string
  privacy_status?: 'private' | 'unlisted' | 'public'
  thumbnail_data_url?: string | null
  thumbnail?: { ok: boolean; reason?: string | null; detail: string; retryable?: boolean }
}

export type ShortsLibraryItem = {
  job_id: string
  clips: string[]
  count: number
}

export const shortsApi = {
  // POST /api/shorts/scene-prompts
  scenePrompts: async (payload: { topic: string; context?: string }): Promise<{ ok: boolean; prompts: ShortsScenePrompt[]; model_used?: string; error?: string }> => {
    const r = await apiClient.post('/api/shorts/scene-prompts', payload)
    return r.data
  },

  // POST /api/shorts/generate-animated
  generateAnimated: async (payload: { topic: string; hooks?: string[]; aspect_ratio?: string }): Promise<{ ok: boolean; job_id: string }> => {
    const r = await apiClient.post('/api/shorts/generate-animated', payload)
    return r.data
  },

  // GET /api/shorts/status?job_id=
  status: async (jobId: string): Promise<ShortsAnimatedJob> => {
    const r = await apiClient.get('/api/shorts/status', { params: { job_id: jobId } })
    return r.data
  },

  // POST /api/shorts/distribute
  distribute: async (payload: { paths: string[]; platforms: string[]; title?: string; description?: string; tags?: string[] }): Promise<{ ok: boolean; results: any[] }> => {
    const r = await apiClient.post('/api/shorts/distribute', payload)
    return r.data
  },

  // GET /api/shorts/list
  list: async (): Promise<{ ok: boolean; shorts: ShortsLibraryItem[] }> => {
    const r = await apiClient.get('/api/shorts/list')
    return r.data
  },

  // POST /api/shorts/script/run
  scriptRun: async (payload: {
    topic: string
    scriptText: string
    voice_id?: string
    language?: string
    channel_slug?: string
    seoTitle?: string
    seoDescription?: string
    seoTags?: string
    thumbDataUrl?: string
    visualSource?: string
    artStyle?: string
    imageProvider?: string
    bgMusicPath?: string
    privacy_status?: 'private' | 'unlisted' | 'public'
    publish_approved?: boolean
    thumbnail_text?: string
    tts_provider?: 'edge' | 'gtts' | 'elevenlabs'
    captions_enabled?: boolean
    duration_seconds?: number
  }): Promise<{ ok: boolean }> => {
    const r = await apiClient.post('/api/shorts/script/run', payload)
    return r.data
  },

  // POST /api/shorts/script/status
  scriptStatus: async (): Promise<ShortsScriptJob> => {
    const r = await apiClient.get('/api/shorts/script/status')
    return r.data
  },

  // POST /api/shorts/pipeline-run { topic, aspect_ratio?, platforms? }
  pipelineRun: async (payload: {
    topic: string
    aspect_ratio?: string
    platforms?: string[]
    channel_slug?: string
  }): Promise<{ ok: boolean; job_id?: string }> => {
    // `/api/shorts/pipeline/run` — the old "/pipeline-run" never existed, so every "Run" on a Short queued
    // item 404'd and the catch below (which only reports 402s) swallowed it: the button looked dead.
    const r = await apiClient.post('/api/shorts/pipeline/run', payload)
    return r.data
  },
}

export const billingApi = {
  // GET /api/auth/me - real plan + usage data
  getMe: async () => {
    const response = await apiClient.get('/api/auth/me')
    return response.data
  },

  // POST /api/billing/checkout { plan_id } → { checkout_url }
  checkout: async (planId: string): Promise<{ checkout_url: string }> => {
    const response = await apiClient.post('/api/billing/checkout', { plan_id: planId })
    return response.data
  },

  // GET /api/billing/portal → { portal_url }
  portal: async (): Promise<{ portal_url: string }> => {
    const response = await apiClient.get('/api/billing/portal')
    return response.data
  },

  // GET /api/billing/usage → { plan, used, limit, pct, credits_remaining?, plan_credits?, recipe_costs? }
  usage: async (): Promise<{
    plan: string
    used: number
    limit: number
    pct: number
    credits_remaining?: number | null
    plan_credits?: number | null
    credits_topup?: number | null
    credits_total?: number | null
    recipe_costs?: Record<string, number>
    channels_used?: number | null
    channels_limit?: number | null
  }> => {
    const response = await apiClient.get('/api/billing/usage')
    return response.data
  },

  // GET /api/billing/packages → { stripe_configured, packages }
  // Only packages whose Stripe price ID is configured are returned, so this can
  // legitimately be empty. `stripe_configured` says whether that is why.
  packages: async (): Promise<{
    stripe_configured: boolean
    packages: { id: string; credits: number; price_usd: number; label: string }[]
  }> => {
    const response = await apiClient.get('/api/billing/packages')
    return response.data
  },

  // POST /api/billing/topup { package_id } → { checkout_url }
  topup: async (packageId: string): Promise<{ checkout_url: string }> => {
    const response = await apiClient.post('/api/billing/topup', { package_id: packageId })
    return response.data
  },
}

// ── Social API ────────────────────────────────────────────────────────────────
export const socialApi = {
  // GET /api/social/posts?channel_slug&platform&limit
  posts: async (params?: { channel_slug?: string; platform?: string; limit?: number }) => {
    const response = await apiClient.get('/api/social/posts', { params })
    return response.data
  },

  // GET /api/social/posts/stats?channel_slug
  stats: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/social/posts/stats', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },

  // GET /api/social/platforms?channel
  platforms: async (channel?: string) => {
    const response = await apiClient.get('/api/social/platforms', {
      params: channel ? { channel } : {},
    })
    return response.data
  },

  // POST /api/social/posts/sync-metrics  { channel_slug?, platform?, post_id? }
  syncMetrics: async (params?: { channel_slug?: string; platform?: string; post_id?: string }) => {
    const response = await apiClient.post('/api/social/posts/sync-metrics', params ?? {})
    return response.data
  },

  // GET /api/social/status?channel_slug - platforms with connection status + stats
  status: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/social/status', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },

  // POST /api/social/config - save platform credentials
  saveConfig: async (platform: string, data: Record<string, string>, channelSlug?: string) => {
    const response = await apiClient.post('/api/social/config', {
      platform,
      channel_slug: channelSlug ?? null,
      ...data,
    })
    return response.data
  },

  // DELETE /api/social/platforms/:platform?channel=slug
  removePlatform: async (platform: string, channelSlug?: string) => {
    const response = await apiClient.delete(`/api/social/platforms/${platform}`, {
      params: channelSlug ? { channel: channelSlug } : {},
    })
    return response.data
  },
}

// ── Analytics API ─────────────────────────────────────────────────────────────
export const analyticsApi = {
  // POST /api/analytics/sync — pull metrics for one channel (writes rows, so it is scoped server-side).
  sync: async (channelSlug?: string, lookbackDays = 30) => {
    const response = await apiClient.post('/api/analytics/sync', {
      channel_slug: channelSlug,
      lookback_days: lookbackDays,
    })
    return response.data as {
      success: boolean
      synced: number
      errors: number
      imported?: number
      message?: string
      error?: string
    }
  },
  // GET /api/analytics/fleet — per-channel sync health (admins see all, users see their own).
  fleet: async () => {
    const response = await apiClient.get('/api/analytics/fleet')
    return response.data as {
      ok: boolean
      channels: Array<{
        channel_slug: string
        channel_name: string | null
        category_id: string | null
        videos: number
        measured: number
        views: number
        last_sync: string | null
        pending_topics: number
      }>
    }
  },
  // POST /api/analytics/sync-all — admin-only fleet sync.
  syncAll: async () => {
    const response = await apiClient.post('/api/analytics/sync-all')
    return response.data as {
      ok: boolean
      channels: number
      ok_count?: number
      synced: number
      imported: number
      failed: Array<{ channel: string; error: string }>
    }
  },
  // GET /api/db/stats - channel stats (videos, views, subs, watch time)
  channelStats: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/db/stats', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/db/costs - monthly API cost breakdown per service
  costs: async () => {
    const response = await apiClient.get('/api/db/costs')
    return response.data
  },
  // GET /api/db/videos - recent video history
  videos: async (limit = 20) => {
    const response = await apiClient.get('/api/db/videos', { params: { limit } })
    return response.data
  },
  // GET /api/extension/ctr/summary - impressions/CTR the browser extension read out of Studio.
  // Empty unless the extension is installed and capture is switched on; the panel says so rather
  // than rendering zeros, because "no readings" and "a CTR of zero" are different things.
  ctrSummary: async (limit = 100) => {
    const response = await apiClient.get('/api/extension/ctr/summary', { params: { limit } })
    return response.data
  },
  // POST /api/studio/ctr-snapshots → { ok, snapshot }
  // Record one cumulative CTR reading (authenticated-user path; the extension uses /api/extension/ctr).
  createCtrSnapshot: async (payload: {
    youtube_id: string
    channel_slug?: string
    impressions?: number
    ctr_percent?: number
    source?: string
  }) => {
    const response = await apiClient.post('/api/studio/ctr-snapshots', payload)
    return response.data
  },
  // §2.3 thumbnail A/B. The verdict comes from the server, which refuses to name a winner below a
  // sample floor -- so the panel renders whatever state it is given rather than picking a number.
  thumbnailAb: async (videoId: string) => {
    const response = await apiClient.get(`/api/thumbnail/ab/${videoId}`)
    return response.data
  },
  thumbnailAbBaseline: async (videoId: string, label?: string) => {
    const response = await apiClient.post(`/api/thumbnail/ab/${videoId}/baseline`, { label })
    return response.data
  },
  thumbnailAbImport: async (videoId: string, channelSlug: string) => {
    const response = await apiClient.post(`/api/thumbnail/ab/${videoId}/import`, { channel_slug: channelSlug })
    return response.data
  },
  thumbnailAbChallenger: async (videoId: string, thumbnailData: string, label?: string) => {
    const response = await apiClient.post(`/api/thumbnail/ab/${videoId}/challenger`, {
      thumbnail_data: thumbnailData,
      label,
    })
    return response.data
  },
  thumbnailAbStop: async (videoId: string) => {
    const response = await apiClient.post(`/api/thumbnail/ab/${videoId}/stop`)
    return response.data
  },
  thumbnailAbSelect: async (videoId: string, variantId: number) => {
    const response = await apiClient.post(`/api/thumbnail/ab/${videoId}/select/${variantId}`)
    return response.data
  },
  // POST /api/studio/thumbnail-ab/variants/{variant_id}/select → { ok, selected_variant, youtube_id }
  // Creator's explicit override: retire every other variant, leave this one live.
  selectThumbnailVariant: async (variantId: number) => {
    const response = await apiClient.post(
      `/api/studio/thumbnail-ab/variants/${encodeURIComponent(String(variantId))}/select`,
    )
    return response.data
  },
  // POST /api/studio/thumbnail-ab/variants/{variant_id}/retire → { ok, variant }
  retireThumbnailVariant: async (variantId: number) => {
    const response = await apiClient.post(
      `/api/studio/thumbnail-ab/variants/${encodeURIComponent(String(variantId))}/retire`,
    )
    return response.data
  },
  // GET /api/analytics/insights - AI insight cards + actions (contract: InsightsResponse)
  insights: async (channelSlug?: string): Promise<InsightsResponse> => {
    const response = await apiClient.get<InsightsResponse>('/api/analytics/insights', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/best-times - best-time-to-publish recommendation
  bestTimes: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/best-times', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/db/ypp - YouTube Partner Program progress (rolling last-30-days snapshot)
  ypp: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/db/ypp', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/ypp-lifetime - real lifetime YPP progress, fetched live from YouTube
  yppLifetime: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/ypp-lifetime', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/traffic-sources - channel-wide traffic source breakdown, live from YouTube
  trafficSources: async (channelSlug: string, lookbackDays = 30) => {
    const response = await apiClient.get('/api/analytics/traffic-sources', {
      params: { channel_slug: channelSlug, lookback_days: lookbackDays },
    })
    return response.data
  },
  // GET /api/analytics/ctr-retention - captured click-through paired against retention, per video.
  // The pairing the extension made possible: click-through is read off the creator's own Studio page
  // and retention comes from the Analytics API, so their relationship separates a *packaging* problem
  // from a *content* problem from a *topic* problem. The server does the classification and refuses to
  // chart anything below a sample floor, so the panel renders whatever state it is handed.
  ctrRetention: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/ctr-retention', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/retention-pattern - where this channel's recent videos lose viewers (§5.4).
  // The same line goes into the script prompt before the next script is written, so the panel that
  // shows it is not a chart: it is the creator's only sight of what is shaping their output.
  retentionPattern: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/retention-pattern', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/retention/{videoId} - where viewers left, and which script segment they left during
  retention: async (videoId: string, refresh = false) => {
    const response = await apiClient.get(`/api/analytics/retention/${encodeURIComponent(videoId)}`, {
      params: { refresh },
    })
    return response.data
  },
  // POST /api/analytics/retention/{videoId}/explain - Claude reads the cliffs against the stored script
  explainRetention: async (videoId: string) => {
    const response = await apiClient.post(`/api/analytics/retention/${encodeURIComponent(videoId)}/explain`)
    return response.data
  },
  // GET /api/analytics/digest - AI weekly digest (contract: DigestResponse)
  digest: async (channelSlug?: string, lookbackDays = 7): Promise<DigestResponse> => {
    const response = await apiClient.get<DigestResponse>('/api/analytics/digest', {
      params: {
        ...(channelSlug ? { channel_slug: channelSlug } : {}),
        lookback_days: lookbackDays,
      },
    })
    return response.data
  },
  // GET /api/analytics/status - sync status per channel
  syncStatus: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/status', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/history - sync history per channel
  syncHistory: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/history', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // POST /api/analytics/sync - trigger manual sync
  triggerSync: async (channelSlug?: string) => {
    const response = await apiClient.post('/api/analytics/sync', {
      ...(channelSlug ? { channel_slug: channelSlug } : {}),
    })
    return response.data
  },
}

export type ScheduleConfig = {
  enabled: boolean
  time: string          // first slot, kept for compatibility
  times: string[]       // every daily slot, "HH:MM" local wall clock (e.g. 09:00 + 18:00)
  timezone: string      // IANA name
  days: string[]        // ["mon", ...]
  per_run: number       // topics started at each slot
  last_run_slot?: string | null
}

export const schedulerApi = {
  // GET /api/scheduler/status?channel_slug
  status: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/scheduler/status', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/scheduler/job-history?limit
  history: async (limit = 20) => {
    const response = await apiClient.get('/api/scheduler/job-history', { params: { limit } })
    return response.data
  },
  // GET /api/scheduler/schedule - this account's own publishing schedule
  getSchedule: async (): Promise<{
    ok: boolean
    schedule: ScheduleConfig
    next_run_at: string | null
    local_now: string
    server_now: string
  }> => {
    const response = await apiClient.get('/api/scheduler/schedule')
    return response.data
  },
  // PUT /api/scheduler/schedule - the runner reads this; no process restart, no .env write
  saveSchedule: async (payload: ScheduleConfig): Promise<{
    ok: boolean
    schedule: ScheduleConfig
    next_run_at: string | null
  }> => {
    const response = await apiClient.put('/api/scheduler/schedule', payload)
    return response.data
  },
  // POST /api/scheduler/run-next
  // Without `topicId` this runs the next pending topic; with it, exactly that queued row.
  // Either way the row is DEQUEUED server-side (marked processing → done/failed), which is
  // what the queue's Run buttons must use — calling the pipeline directly left the row pending.
  runNext: async (channelSlug?: string, topicId?: number) => {
    const response = await apiClient.post('/api/scheduler/run-next', {
      channel_slug: channelSlug ?? null,
      ...(topicId != null ? { topic_id: topicId } : {}),
    })
    return response.data as {
      ok: boolean
      topic: string
      topic_id: number
      job_id?: string
      channel_slug: string | null
      topic_type: string
    }
  },

  // POST /api/scheduler/test-run - triggers publish_next() directly
  testRun: async (channelSlug?: string) => {
    const r = await apiClient.post('/api/scheduler/test-run', { channel_slug: channelSlug ?? null })
    return r.data
  },
}

export const automationApi = {
  // GET /api/env - returns platform .env values (admin-only; non-admin gets DB settings)
  get: async () => {
    const response = await apiClient.get('/api/env')
    return response.data
  },
  // POST /api/settings/sync-env - save toggles to .env
  save: async (values: Record<string, unknown>) => {
    const response = await apiClient.post('/api/settings/sync-env', values)
    return response.data
  },
}

export const aiApi = {
  trending: async (params: {
    channel_slug?: string
    niche?: string
    audience?: string
    recency?: string
    content_type?: string
    count?: number
  }) => {
    const response = await apiClient.post('/api/ai/trending', params)
    return response.data
  },

  // POST /api/ai/claude - proxies a single-prompt Claude call.
  // NOTE: despite the historical name, this endpoint is NOT streaming (SSE) —
  // it returns a single JSON body `{ text, stop_reason }`. Field names must
  // match the backend's ClaudeRequest model exactly (`prompt`/`tokens`), not
  // `messages`/`max_tokens` - a mismatch here previously caused every script
  // generation call to fail with a 422.
  claude: async (prompt: string, tokens = 4096) => {
    return _authFetch(`${_apiBase()}/api/ai/claude`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, tokens }),
    })
  },

  // POST /api/ai/seo
  seo: async (params: { topic: string; script?: string; region?: string; category?: string }) => {
    const response = await apiClient.post('/api/ai/seo', params)
    return response.data
  },

  // POST /api/ai/score - retention score for a script
  score: async (script: string) => {
    const response = await apiClient.post('/api/ai/score', { script })
    return response.data
  },
}

// ── Notifications API ─────────────────────────────────────────────────────────

export type NotificationPrefs = {
  notify_on_complete: boolean
  notify_on_error: boolean
  email_override: string | null
}

export const notificationsApi = {
  // GET /api/user/notifications
  getPrefs: async (): Promise<{ prefs: NotificationPrefs; smtp_configured: boolean }> => {
    const response = await apiClient.get('/api/user/notifications')
    return response.data
  },
  // PUT /api/user/notifications
  updatePrefs: async (prefs: NotificationPrefs) => {
    const response = await apiClient.put('/api/user/notifications', prefs)
    return response.data
  },
  // POST /api/user/notifications/test
  sendTest: async (): Promise<{ ok: boolean; sent_to: string }> => {
    const response = await apiClient.post('/api/user/notifications/test')
    return response.data
  },
}

// ── Account / Profile API ─────────────────────────────────────────────────────

export type UserProfile = {
  user_id: string
  email: string
  plan: 'free' | 'starter' | 'pro' | 'studio' | 'agency' | 'unlimited' | 'enterprise'
  display_name: string
  /** @deprecated Credits are the currency; the video counter is no longer
   *  incremented or displayed. Kept optional for API back-compat. */
  videos_used_this_month?: number
}

export const accountApi = {
  // GET /api/user/profile
  getProfile: async (): Promise<{ profile: UserProfile }> => {
    const response = await apiClient.get('/api/user/profile')
    return response.data
  },
  // PUT /api/user/profile
  updateProfile: async (display_name: string) => {
    const response = await apiClient.put('/api/user/profile', { display_name })
    return response.data
  },
  // DELETE /api/user/account
  deleteAccount: async () => {
    const response = await apiClient.delete('/api/user/account')
    return response.data
  },
}

// ── Channel Ops API ───────────────────────────────────────────────────────────
// ── Channel Profiles API (per-channel video defaults: visuals, captions) ───────
export const channelProfilesApi = {
  // GET /api/channel-profiles/{slug} → { ok, profile }
  get: async (slug: string) => {
    const response = await apiClient.get(`/api/channel-profiles/${encodeURIComponent(slug)}`)
    return response.data as { ok: boolean; profile: Record<string, any> }
  },

  // POST /api/channel-profiles/{slug} (partial save — only sent fields are updated)
  update: async (slug: string, fields: {
    shorts_duration_seconds?: number
    default_visual_source?: string
    default_art_style?: string
    default_image_provider?: string
    captions_enabled?: boolean
    made_for_kids?: boolean | null
    // YouTube category id for future uploads. Null clears the per-channel choice and falls back to the
    // platform default, which is why it is sent explicitly rather than omitted.
    category_id?: string | null
    // Multilingual dubbing. `target_languages` is the FULL ordered list and the
    // FIRST entry is the primary language -- `resolve_multilingual_config()`
    // treats languages[0] as primary and generates a variant for every later
    // entry. So it must include the channel's own language, not just the extras;
    // a list of length 1 means "no variants", which is why the pipeline's guard
    // is `len(target_languages) > 1`.
    multilingual_enabled?: boolean
    multilingual_strategy?: string
    target_languages?: string[]
  }) => {
    const response = await apiClient.post(`/api/channel-profiles/${encodeURIComponent(slug)}`, fields)
    return response.data as { ok: boolean; profile: Record<string, any> }
  },
}

export const channelOpsApi = {
  // GET /api/channel/video-categories — YouTube's real, region-specific category list plus this
  // channel's saved default. Cached server-side for a day (1 quota unit per region).
  videoCategories: async (channel?: string, region = 'SE') => {
    const response = await apiClient.get('/api/channel/video-categories', {
      params: { ...(channel ? { channel } : {}), region },
    })
    return response.data as {
      ok: boolean
      region: string
      channel: string
      default_id: string | null
      categories: Array<{ id: string; title: string }>
    }
  },

  // GET /api/channel/audit?slug
  audit: async (slug?: string) => {
    const response = await apiClient.get('/api/channel/audit', {
      params: slug ? { slug } : {},
    })
    return response.data
  },

  // POST /api/channel/update
  update: async (payload: {
    channel?: string
    description?: string
    keywords?: string
    country?: string
    language?: string
    trailerVideoId?: string
  }) => {
    const response = await apiClient.post('/api/channel/update', payload)
    return response.data
  },

  // POST /api/channel/suggest-branding
  suggestBranding: async (payload: {
    channel?: string
    title?: string
    description?: string
    keywords?: string
    focus?: string
  }) => {
    const response = await apiClient.post('/api/channel/suggest-branding', payload)
    return response.data
  },

  // POST /api/channel/fix-video  { videoId, channel }
  fixVideo: async (videoId: string, channel?: string) => {
    const response = await apiClient.post('/api/channel/fix-video', { videoId, channel })
    return response.data
  },

  // POST /api/channel/fix-selected  { videoIds, channel } - bulk-fix an explicit selection
  fixSelected: async (videoIds: string[], channel?: string) => {
    const response = await apiClient.post('/api/channel/fix-selected', { videoIds, channel })
    return response.data
  },

  // POST /api/channel/bulk-preview  { videoIds, operations, channel } - dry run, writes nothing
  bulkPreview: async (videoIds: string[], operations: Array<{ field: string; action: string; value?: any }>, channel?: string) => {
    const response = await apiClient.post('/api/channel/bulk-preview', { videoIds, operations, channel })
    return response.data
  },

  // POST /api/channel/bulk-apply  { videoIds, operations, channel, confirm } - edits live videos
  bulkApply: async (videoIds: string[], operations: Array<{ field: string; action: string; value?: any }>, channel?: string, confirm = false) => {
    const response = await apiClient.post('/api/channel/bulk-apply', { videoIds, operations, channel, confirm })
    return response.data
  },

  // POST /api/channel/fix-all  { channel }
  fixAll: async (channel?: string) => {
    const response = await apiClient.post('/api/channel/fix-all', { channel })
    return response.data
  },

  // POST /api/channel/audit/coach  { channel } → AI coaching layer on top of the rule-based audit
  auditCoach: async (channel?: string) => {
    const response = await apiClient.post('/api/channel/audit/coach', { channel })
    return response.data
  },

  // GET /api/channel/benchmark?slug&compare → compare against another public channel
  benchmark: async (compare: string, slug?: string) => {
    const response = await apiClient.get('/api/channel/benchmark', {
      params: { compare, ...(slug ? { slug } : {}) },
    })
    return response.data
  },

  // POST /api/channel/keyword-clusters { topic, channel } → real YouTube-data-backed
  // keyword clusters with competition read + recommendation per cluster.
  // Rate-limited server-side (5/hour) since each call spends real YouTube API quota.
  keywordClusters: async (topic: string, channel?: string) => {
    const response = await apiClient.post('/api/channel/keyword-clusters', { topic, channel })
    return response.data
  },

  // POST /api/channel/rank-check { videoId, keyword, channel } → real YouTube search
  // rank snapshot for this video+keyword, stored for future "explain movement" calls.
  // Shares the same 5/hour rate limit as keywordClusters (same quota cost).
  rankCheck: async (videoId: string, keyword: string, channel?: string) => {
    const response = await apiClient.post('/api/channel/rank-check', { videoId, keyword, channel })
    return response.data
  },

  // GET /api/channel/rank-history?videoId&keyword → past rank snapshots, most recent first
  rankHistory: async (videoId: string, keyword: string) => {
    const response = await apiClient.get('/api/channel/rank-history', { params: { videoId, keyword } })
    return response.data
  },

  // POST /api/channel/collaborators - creators in this niche worth approaching.
  // Costs the same YouTube quota as keywordClusters, and shares its 5/hour per-user budget.
  collaborators: async (channel?: string) => {
    const response = await apiClient.post('/api/channel/collaborators', { channel })
    return response.data
  },

  // GET /api/channel/rank-narrative?videoId&keyword → AI narrative explaining movement
  // between the two most recent rank checks (requires 2+ checks to exist)
  rankNarrative: async (videoId: string, keyword: string) => {
    const response = await apiClient.get('/api/channel/rank-narrative', { params: { videoId, keyword } })
    return response.data
  },
}

// ── Upload Studio API ─────────────────────────────────────────────────────────
export const studioApi = {
  // GET /api/studio/videos → { ok, videos: [{name, path, size_mb, dir, mtime}] }
  videos: async () => {
    const response = await apiClient.get('/api/studio/videos')
    return response.data
  },

  // GET /api/studio/info/{encoded_path} → { ok, name, path, duration, duration_str, width, height, codec, fps, size_mb }
  info: async (videoPath: string) => {
    const encoded = encodeURIComponent(videoPath)
    const response = await apiClient.get(`/api/studio/info/${encoded}`)
    return response.data
  },

  // POST /api/studio/extract-clips → { ok, clips: [{label, path, duration, size_mb}] }
  extractClips: async (videoPath: string, clips: Array<{ start: number; end: number; label: string }>) => {
    const response = await apiClient.post('/api/studio/extract-clips', {
      video_path: videoPath,
      clips,
    })
    return response.data
  },

  // POST /api/studio/upload-main → { ok, video_id, url }
  uploadMain: async (payload: {
    video_path: string
    title: string
    description?: string
    tags?: string[]
    channel?: string
    thumbnail_path?: string
    thumbnail_data?: string
    privacy_status?: 'public' | 'unlisted' | 'private'
    notify_subscribers?: boolean
  }) => {
    const response = await apiClient.post('/api/studio/upload-main', payload)
    return response.data
  },

  // POST /api/studio/upload-clips → { ok, ... }
  uploadClips: async (payload: {
    clip_paths: string[]
    title: string
    description?: string
    tags?: string[]
    channel?: string
    youtube_shorts?: boolean
    social_platforms?: boolean
    include_stories?: boolean
    privacy_status?: 'public' | 'unlisted' | 'private'
    notify_subscribers?: boolean
  }) => {
    const response = await apiClient.post('/api/studio/upload-clips', payload)
    return response.data
  },

  // POST /api/studio/generate-metadata → { ok, description, tags[], captions{...} }
  generateMetadata: async (title: string, channel?: string) => {
    const response = await apiClient.post('/api/studio/generate-metadata', { title, channel })
    return response.data
  },

  // POST /api/studio/delete → { ok, deleted }
  deleteVideo: async (videoPath: string) => {
    const response = await apiClient.post('/api/studio/delete', { video_path: videoPath })
    return response.data
  },

  // POST /api/studio/import/analyze { url } → { ok, video_id, title, duration, suggested_clips: [...] }
  // Fetches real captions (no video download) and asks Claude for 2-3 clip-worthy
  // moments grounded in the actual transcript timing. Rate-limited (10/hour).
  importAnalyze: async (url: string) => {
    const response = await apiClient.post('/api/studio/import/analyze', { url })
    return response.data
  },

  // POST /api/studio/import/extract { url, clips } → { ok, clips: [{label, path, duration, size_mb}] }
  // Downloads the source video (cached after first time) and extracts the given
  // clips - same shape/flow as extractClips() above.
  importExtract: async (url: string, clips: Array<{ start: number; end: number; label: string }>) => {
    const response = await apiClient.post('/api/studio/import/extract', { url, clips })
    return response.data
  },

  // ── Creator Studio assets (Phase 1) ───────────────────────────────────────
  // A creator's own source video, before it is published. Owner-scoped on the server; URLs carry
  // `public_id`, never a filesystem path.

  // GET /api/studio/assets?status=&limit=&offset= → { ok, count, assets[] }
  assets: async (params?: { status?: string; limit?: number; offset?: number }) => {
    const response = await apiClient.get('/api/studio/assets', { params })
    return response.data
  },

  // GET /api/studio/assets/{public_id} → { ok, asset, publications[] }
  asset: async (publicId: string) => {
    const response = await apiClient.get(`/api/studio/assets/${encodeURIComponent(publicId)}`)
    return response.data
  },

  // POST /api/studio/assets (multipart) → { ok, asset }
  // Streamed by the server with a size cap, and validated with ffprobe (extension alone is not
  // enough). `onProgress` is the browser's upload byte count, not a render percentage.
  createAsset: async (
    file: File,
    opts?: {
      title?: string
      channelSlug?: string
      onProgress?: (percent: number) => void
      signal?: AbortSignal
    },
  ) => {
    const form = new FormData()
    form.append('file', file)
    if (opts?.title) form.append('title', opts.title)
    if (opts?.channelSlug) form.append('channel_slug', opts.channelSlug)
    const response = await apiClient.post('/api/studio/assets', form, {
      // Let the browser set the multipart boundary; only the auth header is added by the client.
      headers: { 'Content-Type': 'multipart/form-data' },
      signal: opts?.signal,
      onUploadProgress: (event) => {
        if (!opts?.onProgress) return
        const total = event.total ?? 0
        if (total > 0) opts.onProgress(Math.min(99, Math.round((event.loaded / total) * 100)))
      },
    })
    return response.data
  },

  // PATCH /api/studio/assets/{public_id} → { ok, asset }
  updateAsset: async (
    publicId: string,
    payload: { title?: string; description?: string; tags?: string[]; channel_slug?: string | null },
  ) => {
    const response = await apiClient.patch(
      `/api/studio/assets/${encodeURIComponent(publicId)}`,
      payload,
    )
    return response.data
  },

  // POST /api/studio/assets/{public_id}/preview-url → { ok, url, expires_in }
  // The file route needs the Authorization header, which a <video src> cannot send; this mints a
  // short-lived, asset-scoped URL instead.
  previewUrl: async (publicId: string) => {
    const response = await apiClient.post(
      `/api/studio/assets/${encodeURIComponent(publicId)}/preview-url`,
      {},
    )
    return response.data as {
      ok: boolean
      url: string
      expires_in: number
      thumbnail_url?: string
    }
  },

  // POST /api/studio/assets/{public_id}/thumbnail → { ok, asset }
  // Extracts one frame from the source as the asset's cover image. Stored server-side so publish
  // reuses the chosen frame instead of silently re-extracting a different one at upload time.
  generateThumbnail: async (publicId: string, timeS?: number) => {
    const response = await apiClient.post(
      `/api/studio/assets/${encodeURIComponent(publicId)}/thumbnail`,
      timeS !== undefined ? { time_s: timeS } : {},
    )
    return response.data
  },

  // POST /api/studio/assets/{public_id}/publications → { ok, job_id, publication }
  // Durable: `publishing` → `published` (with external_id) or `failed` (with last_error). 409 when
  // the asset is already publishing or already published.
  publishAsset: async (
    publicId: string,
    payload: {
      platform?: 'youtube'
      channel_slug?: string
      title?: string
      description?: string
      tags?: string[]
      privacy_status?: 'public' | 'unlisted' | 'private'
      scheduled_at?: string
    },
  ) => {
    const response = await apiClient.post(
      `/api/studio/assets/${encodeURIComponent(publicId)}/publications`,
      payload,
    )
    return response.data
  },

  // GET /api/studio/publications/{publication_id}/analytics → { available, views, watch_time_minutes, avg_view_duration_seconds, analytics_fetched_at, reason? }
  // Real YouTube Analytics per publication. `available: false` means "not published yet" or
  // "analytics unavailable" — never zeros masquerading as measured data.
  publicationAnalytics: async (publicationId: number) => {
    const response = await apiClient.get(
      `/api/studio/publications/${encodeURIComponent(String(publicationId))}/analytics`,
    )
    return response.data as {
      available: boolean
      reason: string | null
      views: number | null
      watch_time_minutes: number | null
      avg_view_duration_seconds: number | null
      analytics_fetched_at: string | null
    }
  },

  // GET /api/studio/recoverable-renders → { ok, count, renders: [{job_id,title,status,channel_slug,size_bytes,start_time}] }
  // Finished pipeline jobs whose render is still on disk and not yet in the library. This is the
  // "the upload failed, not the render" recovery path.
  recoverableRenders: async () => {
    const response = await apiClient.get('/api/studio/recoverable-renders')
    return response.data as {
      ok: boolean
      count: number
      renders: Array<{
        job_id: string
        title: string
        status: string
        channel_slug: string | null
        youtube_id: string | null
        start_time: string | null
        size_bytes: number
      }>
    }
  },

  // POST /api/studio/recoverable-renders/{job_id} → { ok, asset, already_in_library }
  // Idempotent: the same job returns the same asset, so a double click cannot publish twice.
  recoverRender: async (jobId: string) => {
    const response = await apiClient.post(
      `/api/studio/recoverable-renders/${encodeURIComponent(jobId)}`,
      {},
    )
    return response.data as {
      ok: boolean
      asset: { public_id: string }
      already_in_library: boolean
    }
  },
}

// ── Custom Studio API ─────────────────────────────────────────────────────────
export const customStudioApi = {
  // GET /api/custom-studio/status → { status, step, pct, message, youtube_url, error }
  status: async () => {
    const response = await apiClient.get('/api/custom-studio/status')
    return response.data
  },

  // GET /api/custom-studio/clips → { ok, clips: [{name, size_mb}] }
  listClips: async () => {
    const response = await apiClient.get('/api/custom-studio/clips')
    return response.data
  },

  // POST /api/custom-studio/upload-clips (multipart) → { ok, saved[], total_clips }
  uploadClips: async (formData: FormData) => {
    const res = await _authFetch(`${_apiBase()}/api/custom-studio/upload-clips`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  // POST /api/custom-studio/upload-narration (multipart) → { ok, filename, duration }
  uploadNarration: async (formData: FormData) => {
    const res = await _authFetch(`${_apiBase()}/api/custom-studio/upload-narration`, {
      method: 'POST',
      body: formData,
    })
    return res.json()
  },

  // DELETE /api/custom-studio/clips/{filename} → { ok }
  deleteClip: async (filename: string) => {
    const response = await apiClient.delete(`/api/custom-studio/clips/${encodeURIComponent(filename)}`)
    return response.data
  },

  // POST /api/custom-studio/run → { ok, ... }
  run: async (payload: {

    topic: string
    scriptText: string
    clips: string[]
    assignment?: Record<string, string>
    voice_id?: string
    tts_provider?: string
    el_voice_id?: string
    narration_audio?: string
    language?: string
    channel_slug?: string
    seoTitle?: string
    seoDescription?: string
    seoTags?: string
  }) => {
    const response = await apiClient.post('/api/custom-studio/run', payload)
    return response.data
  },
}

// ── Calendar API ──────────────────────────────────────────────────────────────
export const calendarApi = {
  // GET /api/calendar/events?start=YYYY-MM-DD&end=YYYY-MM-DD&channel_slug=
  events: async (start: string, end: string, channelSlug?: string) => {
    const response = await apiClient.get('/api/calendar/events', {
      params: {
        start,
        end,
        ...(channelSlug ? { channel_slug: channelSlug } : {}),
      },
    })
    return response.data
  },

  // POST /api/calendar/update-scheduled  { topic_id, scheduled_at }
  // `scheduledAt` is an ISO instant, not a date: the runner compares against the current time, so a
  // topic for 18:00 must carry 18:00. Pass null to take it off the calendar.
  updateScheduled: async (topicId: number, scheduledAt: string | null) => {
    const response = await apiClient.post('/api/calendar/update-scheduled', {
      topic_id: topicId,
      scheduled_at: scheduledAt,
    })
    return response.data
  },
}

// ── Public API (no signup required) ───────────────────────────────────────────
export const publicApi = {
  // POST /api/public/seo-analyze { url } - free SEO checklist for any public YouTube video
  seoAnalyze: async (url: string) => {
    const response = await apiClient.post('/api/public/seo-analyze', { url })
    return response.data
  },
}


// ── Kids / Animated Promo API ─────────────────────────────────────────────────
export const kidsApi = {
  // POST /api/promo/animated/generate → { ok, gen_id, status }
  generate: async (params: {
    title: string
    style?: string
    outline?: string
    channel?: string
    audioMode?: string
    voiceId?: string
  }) => {
    const response = await apiClient.post('/api/promo/animated/generate', {
      title: params.title,
      style: params.style ?? 'bright kids-friendly animation',
      outline: params.outline ?? '',
      channel: params.channel ?? '',
      audio_mode: params.audioMode ?? 'music',
      voice_id: params.voiceId ?? null,
    })
    return response.data
  },

  // GET /api/promo/animated/generation/{gen_id} → GenData
  poll: async (genId: string) => {
    const response = await apiClient.get(
      `/api/promo/animated/generation/${encodeURIComponent(genId)}`,
    )
    return response.data
  },

  // POST /api/promo/animated/approve → { ok, status }
  // `coverageRatio` is the animation cost dial (core/animation_coverage.py): the
  // fraction of scenes that get their own generated clip. Omit for the default.
  approve: async (genId: string, coverageRatio?: number) => {
    const response = await apiClient.post('/api/promo/animated/approve', {
      gen_id: genId,
      ...(coverageRatio === undefined ? {} : { coverage_ratio: coverageRatio }),
    })
    return response.data
  },

  // POST /api/promo/animated/publish → { ok, status }
  publish: async (params: {
    genId: string
    title: string
    description?: string
    tags?: string
    channel?: string
  }) => {
    const response = await apiClient.post('/api/promo/animated/publish', {
      gen_id: params.genId,
      title: params.title,
      description: params.description ?? '',
      tags: params.tags ?? '',
      channel: params.channel ?? '',
    })
    return response.data
  },

  // PATCH /api/promo/animated/scene → { ok, scene }   (free)
  editScene: async (params: {
    genId: string
    sceneIndex: number
    narration?: string
    visualKeyword?: string
    speaker?: string
  }) => {
    const response = await apiClient.patch('/api/promo/animated/scene', {
      gen_id: params.genId,
      scene_index: params.sceneIndex,
      narration: params.narration,
      visual_keyword: params.visualKeyword,
      speaker: params.speaker,
    })
    return response.data
  },

  // POST /api/promo/animated/quote → { credits, clips, segments, cost_usd,
  //                                     byok_credits, affordable, credits_remaining }
  // The coverage dial changes what a render costs, so the price comes from the
  // server rather than being hard-coded here -- hard-coding it is how the
  // displayed price drifted 6-13x below the real charge. Free, no side effects.
  quote: async (genId: string, coverageRatio?: number) => {
    const response = await apiClient.post('/api/promo/animated/quote', {
      gen_id: genId,
      ...(coverageRatio === undefined ? {} : { coverage_ratio: coverageRatio }),
    })
    return response.data
  },

  // POST /api/promo/animated/scene/reroll → { ok, scene, credits_remaining }
  // Costs one Claude call (utility = 1 credit). Deliberately NOT the 15-credit
  // `scene_reroll` recipe: that buys a Kling clip, and per-scene clips do not
  // exist yet, so this rewrites the storyboard rather than the video.
  rerollScene: async (params: {
    genId: string
    sceneIndex: number
    instructions?: string
  }) => {
    const response = await apiClient.post('/api/promo/animated/scene/reroll', {
      gen_id: params.genId,
      scene_index: params.sceneIndex,
      instructions: params.instructions ?? '',
    })
    return response.data
  },

  // POST /api/promo/animated/scenes/reorder → { ok, segments }   (free)
  reorderScenes: async (params: { genId: string; order: number[] }) => {
    const response = await apiClient.post('/api/promo/animated/scenes/reorder', {
      gen_id: params.genId,
      order: params.order,
    })
    return response.data
  },
}

// ── Character Profiles API ────────────────────────────────────────────────────
export const characterApi = {
  // GET /api/character-profiles?channel= → [CharProfile]
  list: async (channel: string) => {
    const response = await apiClient.get('/api/character-profiles', { params: { channel } })
    return response.data
  },

  // POST /api/character-profiles → CharProfile
  create: async (payload: {
    channelSlug: string
    profileName: string
    styleLock?: string
    worldLock?: string
    characterLock?: string
    continuityNotes?: string
    imageDataUrl?: string
    setActive?: boolean
  }) => {
    const response = await apiClient.post('/api/character-profiles', {
      channel_slug: payload.channelSlug,
      profile_name: payload.profileName,
      style_lock: payload.styleLock ?? '',
      world_lock: payload.worldLock ?? '',
      character_lock: payload.characterLock ?? '',
      continuity_notes: payload.continuityNotes ?? '',
      image_data_url: payload.imageDataUrl ?? '',
      set_active: payload.setActive ?? false,
    })
    return response.data
  },

  // POST /api/character-profiles/{id} → CharProfile
  update: async (id: number, payload: {
    profileName?: string
    styleLock?: string
    worldLock?: string
    characterLock?: string
    continuityNotes?: string
    imageDataUrl?: string
  }) => {
    const response = await apiClient.post(`/api/character-profiles/${id}`, {
      profile_name: payload.profileName,
      style_lock: payload.styleLock,
      world_lock: payload.worldLock,
      character_lock: payload.characterLock,
      continuity_notes: payload.continuityNotes,
      image_data_url: payload.imageDataUrl,
    })
    return response.data
  },

  // POST /api/character-profiles/{id}/activate → CharProfile
  activate: async (id: number, channelSlug: string, active: boolean) => {
    const response = await apiClient.post(`/api/character-profiles/${id}/activate`, {
      channel_slug: channelSlug,
      active,
    })
    return response.data
  },

  // POST /api/character-profiles/generate-with-claude → { profile }
  generateWithClaude: async (params: {
    characterName: string
    characterDescription: string
    storyContext?: string
    age?: string
    personality?: string
  }) => {
    const response = await apiClient.post('/api/character-profiles/generate-with-claude', {
      character_name: params.characterName,
      character_description: params.characterDescription,
      story_context: params.storyContext ?? '',
      age: params.age ?? '',
      personality: params.personality ?? '',
    })
    return response.data
  },

  // POST /api/character-profiles/generate-image → { image_data_url }
  generateImage: async (params: {
    characterLock: string
    styleLock: string
    characterName?: string
    profileId?: number
  }) => {
    const response = await apiClient.post('/api/character-profiles/generate-image', {
      character_lock: params.characterLock,
      style_lock: params.styleLock,
      character_name: params.characterName,
      profile_id: params.profileId,
    })
    return response.data
  },

  // DELETE /api/character-profiles/{id} → { ok }
  delete: async (id: number) => {
    const response = await apiClient.delete(`/api/character-profiles/${id}`)
    return response.data
  },
}

// ── Thumbnail API ─────────────────────────────────────────────────────────────
export const thumbnailApi = {
  // POST /api/thumbnail/generate-bg → { ok, b64, mime }
  generateBg: async (params: { topic: string; niche?: string; audience?: string }) => {
    const response = await apiClient.post('/api/thumbnail/generate-bg', params)
    return response.data as { ok: boolean; b64: string; mime: string }
  },

  // POST /api/thumbnail/generate → { ok, b64, mime, path, width, height }
  // Full thumbnail with text overlay (headline, subhead, badge, channel name).
  // Supports faceless/hybrid modes and stock/Pollinations backgrounds.
  generate: async (params: {
    topic: string
    thumbnail_text?: string
    thumbnail_subtext?: string
    badge?: string
    channel_name?: string
    mode?: 'faceless' | 'hybrid'
    provider?: 'stock' | 'pollinations'
    face_image_b64?: string
    aspect?: 'landscape' | 'vertical'
  }) => {
    const response = await apiClient.post('/api/thumbnail/generate', params)
    return response.data as {
      ok: boolean
      b64: string
      mime: string
      path: string
      width: number
      height: number
    }
  },

  // GET /api/pexels/bg?q= → { ok, b64, mime, url }
  pexelsBg: async (query: string) => {
    const response = await apiClient.get('/api/pexels/bg', { params: { q: query } })
    return response.data as { ok: boolean; b64: string; mime: string; url?: string }
  },
}

// ── Visual Formats API (creation wizard "Visuals" step) ────────────────────────
export const visualsApi = {
  // POST /api/upload-visual-video (multipart) → { ok, path }
  uploadVideo: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await _authFetch(`${_apiBase()}/api/upload-visual-video`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || 'Upload failed')
    return res.json() as Promise<{ ok: boolean; path: string }>
  },

  // POST /api/upload-visual-audio (multipart) → { ok, path }
  uploadAudio: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await _authFetch(`${_apiBase()}/api/upload-visual-audio`, {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.detail || 'Upload failed')
    return res.json() as Promise<{ ok: boolean; path: string }>
  },
}

// ── YouTube API ───────────────────────────────────────────────────────────────
export const youtubeApi = {
  // POST /api/youtube/set-thumbnail → { ok, message, video_id }
  setThumbnail: async (videoId: string, thumbnailData: string, channelSlug?: string, jobId?: string) => {
    const response = await apiClient.post('/api/youtube/set-thumbnail', {
      video_id: videoId,
      thumbnail_data: thumbnailData,
      channel_slug: channelSlug,
      job_id: jobId,
    })
    return response.data as { ok: boolean; message: string; video_id: string }
  },
}

// ── Branding API ──────────────────────────────────────────────────────────────
export interface BrandingAsset {
  name: string
  path: string
  url?: string
}

export const brandingApi = {
  // GET /api/branding/assets?channel= → { ok, assets: BrandingAsset[] }
  listAssets: async (channel?: string) => {
    const response = await apiClient.get('/api/branding/assets', {
      params: channel ? { channel } : {},
    })
    return response.data as { ok: boolean; assets: BrandingAsset[] }
  },

  // POST /api/branding/generate → { ok, assets: BrandingAsset[] }
  generate: async (payload: {
    channel?: string
    channelName: string
    tagline: string
    stylePreset?: string
    stylePrompt?: string
    scheduleText?: string
  }) => {
    const response = await apiClient.post('/api/branding/generate', payload)
    return response.data as { ok: boolean; assets: BrandingAsset[]; error?: string }
  },

  // POST /api/branding/upload-banner → { ok, error? }
  uploadBanner: async (channel?: string) => {
    const response = await apiClient.post('/api/branding/upload-banner', { channel: channel ?? null })
    return response.data as { ok: boolean; error?: string }
  },

  // POST /api/branding/set-trailer → { ok, error? }
  setTrailer: async (videoId: string, channel?: string) => {
    const response = await apiClient.post('/api/branding/set-trailer', {
      videoId,
      channel: channel ?? null,
    })
    return response.data as { ok: boolean; error?: string }
  },
}

// ── Brand Kit API ─────────────────────────────────────────────────────────────
export interface BrandKit {
  channel_slug: string
  avatar_url?: string | null
  watermark_url?: string | null
  intro_video_id?: string | null
  outro_video_id?: string | null
  thumbnail_template?: string | null
  voice_id?: string | null
}

export const brandKitApi = {
  // GET /api/brand-kit?channel= → BrandKit
  get: async (channel?: string) => {
    const response = await apiClient.get<BrandKit>('/api/brand-kit', {
      params: channel ? { channel } : {},
    })
    return response.data
  },

  // PUT /api/brand-kit → BrandKit
  upsert: async (payload: {
    channel?: string
    avatar_url?: string | null
    watermark_url?: string | null
    intro_video_id?: string | null
    outro_video_id?: string | null
    thumbnail_template?: string | null
    voice_id?: string | null
  }) => {
    const response = await apiClient.put<BrandKit>('/api/brand-kit', payload)
    return response.data
  },
}
