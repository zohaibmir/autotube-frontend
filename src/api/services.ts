import apiClient from './client'
import { tokenStore } from '@lib/tokenStore'
import { Job, Channel, PaginatedResponse, ApiResponse } from '@types/api'

const _apiBase = () => import.meta.env.VITE_API_URL ?? 'http://localhost:8080'
const _authFetch = (url: string, init: RequestInit) => {
  const token = tokenStore.getAccess()
  return fetch(url, {
    ...init,
    headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  })
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
  action: async (jobId: string, action: 'cancel' | 'retry' | 'resume-from-merge') => {
    if (action === 'cancel') {
      // cancel uses a dedicated global endpoint
      const response = await apiClient.post('/api/pipeline/cancel')
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
}

export const channelsApi = {
  // GET /api/channels
  list: async () => {
    const response = await apiClient.get<{ ok: boolean; channels: Channel[] }>('/api/channels')
    return response.data.channels ?? []
  },

  // POST /api/channels/{slug}/reset-auth
  resetAuth: async (slug: string) => {
    const response = await apiClient.post(`/api/channels/${slug}/reset-auth`)
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
    const response = await apiClient.post('/api/queue/add', {
      topic,
      channel_slug: channelSlug ?? null,
      scheduled_date: scheduledDate ?? null,
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
  // GET /api/voices/list — all Edge TTS groups + EL settings
  list: async (): Promise<VoiceListResponse> => {
    const r = await apiClient.get<VoiceListResponse>('/api/voices/list')
    return r.data
  },

  // GET /api/voices/assignments — { slug: voice_id } map
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
}

// ── BYOK API Keys ─────────────────────────────────────────────────────────────
export const byokApi = {
  // Backend returns { keys: { anthropic: bool, elevenlabs: bool, ... } } — normalise
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

  // POST /api/community-posts/generate — returns text, does NOT save
  generate: async (payload: {
    title: string
    description?: string
    tags?: string[]
    channel_slug?: string
  }): Promise<{ ok: boolean; post?: string; source?: string; error?: string }> => {
    const r = await apiClient.post('/api/community-posts/generate', payload)
    return r.data
  },

  // POST /api/community-posts — save a draft to the library
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
  status: 'idle' | 'running' | 'done' | 'failed'
  topic?: string
  message?: string
  video_path?: string | null
  video_url?: string | null
  youtube_url?: string | null
  error?: string | null
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
    const r = await apiClient.post('/api/shorts/pipeline-run', payload)
    return r.data
  },
}

export const billingApi = {
  // GET /api/auth/me — real plan + usage data
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

  // GET /api/billing/usage → { plan, used, limit, pct }
  usage: async (): Promise<{ plan: string; used: number; limit: number; pct: number }> => {
    const response = await apiClient.get('/api/billing/usage')
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

  // GET /api/social/status?channel_slug — platforms with connection status + stats
  status: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/social/status', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },

  // POST /api/social/config — save platform credentials
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
  // GET /api/db/stats — channel stats (videos, views, subs, watch time)
  channelStats: async () => {
    const response = await apiClient.get('/api/db/stats')
    return response.data
  },
  // GET /api/db/costs — monthly API cost breakdown per service
  costs: async () => {
    const response = await apiClient.get('/api/db/costs')
    return response.data
  },
  // GET /api/db/videos — recent video history
  videos: async (limit = 20) => {
    const response = await apiClient.get('/api/db/videos', { params: { limit } })
    return response.data
  },
  // GET /api/analytics/insights — YouTube analytics data
  insights: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/insights', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/db/ypp — YouTube Partner Program progress
  ypp: async () => {
    const response = await apiClient.get('/api/db/ypp')
    return response.data
  },
  // GET /api/analytics/digest — AI weekly digest summary
  digest: async (channelSlug?: string, lookbackDays = 7) => {
    const response = await apiClient.get('/api/analytics/digest', {
      params: {
        ...(channelSlug ? { channel_slug: channelSlug } : {}),
        lookback_days: lookbackDays,
      },
    })
    return response.data
  },
  // GET /api/analytics/status — sync status per channel
  syncStatus: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/status', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // GET /api/analytics/history — sync history per channel
  syncHistory: async (channelSlug?: string) => {
    const response = await apiClient.get('/api/analytics/history', {
      params: channelSlug ? { channel_slug: channelSlug } : {},
    })
    return response.data
  },
  // POST /api/analytics/sync — trigger manual sync
  triggerSync: async (channelSlug?: string) => {
    const response = await apiClient.post('/api/analytics/sync', {
      ...(channelSlug ? { channel_slug: channelSlug } : {}),
    })
    return response.data
  },
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
  // POST /api/scheduler/run-next
  runNext: async (channelSlug?: string) => {
    const response = await apiClient.post('/api/scheduler/run-next', {
      channel_slug: channelSlug ?? null,
    })
    return response.data
  },

  // POST /api/scheduler/test-run — triggers publish_next() directly
  testRun: async (channelSlug?: string) => {
    const r = await apiClient.post('/api/scheduler/test-run', { channel_slug: channelSlug ?? null })
    return r.data
  },
}

export const automationApi = {
  // GET /api/settings — returns current automation settings from .env
  get: async () => {
    const response = await apiClient.get('/api/settings')
    return response.data
  },
  // POST /api/settings/sync-env — save toggles to .env
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

  // POST /api/ai/claude — proxies a single-prompt Claude call.
  // NOTE: despite the historical name, this endpoint is NOT streaming (SSE) —
  // it returns a single JSON body `{ text, stop_reason }`. Field names must
  // match the backend's ClaudeRequest model exactly (`prompt`/`tokens`), not
  // `messages`/`max_tokens` — a mismatch here previously caused every script
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

  // POST /api/ai/score — retention score for a script
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
  plan: 'free' | 'pro' | 'enterprise'
  display_name: string
  videos_used_this_month: number
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
export const channelOpsApi = {
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

  // POST /api/channel/fix-all  { channel }
  fixAll: async (channel?: string) => {
    const response = await apiClient.post('/api/channel/fix-all', { channel })
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

  // POST /api/calendar/update-scheduled  { topic_id, scheduled_date }
  updateScheduled: async (topicId: number, scheduledDate: string | null) => {
    const response = await apiClient.post('/api/calendar/update-scheduled', {
      topic_id: topicId,
      scheduled_date: scheduledDate,
    })
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
  approve: async (genId: string) => {
    const response = await apiClient.post('/api/promo/animated/approve', { gen_id: genId })
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

  // GET /api/pexels/bg?q= → { ok, b64, mime, url }
  pexelsBg: async (query: string) => {
    const response = await apiClient.get('/api/pexels/bg', { params: { q: query } })
    return response.data as { ok: boolean; b64: string; mime: string; url?: string }
  },
}

// ── YouTube API ───────────────────────────────────────────────────────────────
export const youtubeApi = {
  // POST /api/youtube/set-thumbnail → { ok, message, video_id }
  setThumbnail: async (videoId: string, thumbnailData: string) => {
    const response = await apiClient.post('/api/youtube/set-thumbnail', {
      video_id: videoId,
      thumbnail_data: thumbnailData,
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
