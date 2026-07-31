/**
 * api.spec.ts — API endpoint integration tests
 *
 * These run directly against the backend (http://localhost:8080).
 * No browser required — fast, reliable, tests contract not UI.
 *
 * Coverage: 30 endpoints across all feature areas.
 * Run: npx playwright test e2e/api.spec.ts
 */
import { test, expect, request } from '@playwright/test'

const API  = process.env.TEST_API_URL  || 'http://localhost:8080'
const EMAIL = process.env.TEST_USER_EMAIL    || 'zohaib.mir@gmail.com'
const PASS  = process.env.TEST_USER_PASSWORD || 'mir.mir1121'

// ── Shared state ──────────────────────────────────────────────────────────────
let TOKEN = ''
let HEADERS: Record<string, string> = {}

test.beforeAll(async () => {
  const ctx = await request.newContext()
  const resp = await ctx.post(`${API}/api/auth/login`, {
    data: { email: EMAIL, password: PASS },
  })
  const body = await resp.json()
  expect(resp.ok()).toBe(true)
  TOKEN = body.access_token
  HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }
  await ctx.dispose()
})

// ── Helper ────────────────────────────────────────────────────────────────────
async function apiGet(path: string, params?: Record<string, string>) {
  const ctx = await request.newContext({ baseURL: API })
  const url  = params ? `${path}?${new URLSearchParams(params)}` : path
  const resp = await ctx.get(url, { headers: HEADERS })
  const body = await resp.json()
  await ctx.dispose()
  return { status: resp.status(), body }
}

async function apiPost(path: string, data: object) {
  const ctx  = await request.newContext({ baseURL: API })
  const resp = await ctx.post(path, { headers: HEADERS, data })
  const body = await resp.json()
  await ctx.dispose()
  return { status: resp.status(), body }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────
test.describe('Auth endpoints', () => {
  test('GET /api/auth/me → 200 with user_id', async () => {
    const { status, body } = await apiGet('/api/auth/me')
    expect(status).toBe(200)
    expect(body.user_id).toBeTruthy()
    expect(body.email).toBe(EMAIL)
  })

  test('GET /api/user/profile → 200 with email', async () => {
    const { status, body } = await apiGet('/api/user/profile')
    expect(status).toBe(200)
    expect(body.profile.email).toBe(EMAIL)
  })

  test('GET /api/user/api-keys → 200 with service flags', async () => {
    const { status, body } = await apiGet('/api/user/api-keys')
    expect(status).toBe(200)
    expect(body.keys).toBeDefined()
    expect(typeof body.keys.anthropic).toBe('boolean')
    expect(typeof body.keys.elevenlabs).toBe('boolean')
  })

  test('GET /api/user/notifications → 200 with prefs', async () => {
    const { status, body } = await apiGet('/api/user/notifications')
    expect(status).toBe(200)
    expect(body.prefs).toBeDefined()
    expect(typeof body.prefs.notify_on_complete).toBe('boolean')
  })
})

// ── CHANNELS ──────────────────────────────────────────────────────────────────
test.describe('Channel endpoints', () => {
  test('GET /api/channels → 200 with channels array', async () => {
    const { status, body } = await apiGet('/api/channels')
    expect(status).toBe(200)
    expect(Array.isArray(body.channels)).toBe(true)
    expect(body.channels.length).toBeGreaterThan(0)
    expect(body.channels[0]).toHaveProperty('slug')
  })

  test('GET /api/channel-profiles → 200', async () => {
    const { status, body } = await apiGet('/api/channel-profiles')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.profiles)).toBe(true)
  })

  test('GET /api/channel/audit → 200', async () => {
    const { status } = await apiGet('/api/channel/audit')
    expect(status).toBe(200)
  })
})

// ── QUEUE ─────────────────────────────────────────────────────────────────────
test.describe('Queue endpoints', () => {
  let addedId: number | null = null

  test('GET /api/queue/pending → 200 with items', async () => {
    const { status, body } = await apiGet('/api/queue/pending')
    expect(status).toBe(200)
    expect(Array.isArray(body.items)).toBe(true)
  })

  test('POST /api/queue/add → 200 creates item', async () => {
    const { status, body } = await apiPost('/api/queue/add', {
      topic: `API test topic ${Date.now()}`,
      channel_slug: null,
    })
    expect(status).toBe(200)
    // Get the new item's ID for cleanup
    const list = await apiGet('/api/queue/pending')
    const item = list.body.items?.find((i: any) =>
      i.topic.startsWith('API test topic')
    )
    if (item) addedId = item.id
  })

  test('DELETE /api/queue/delete/:id → 200', async () => {
    if (!addedId) return // skip if add failed
    const ctx  = await request.newContext({ baseURL: API })
    const resp = await ctx.delete(`/api/queue/delete/${addedId}`, { headers: HEADERS })
    expect(resp.status()).toBe(200)
    await ctx.dispose()
  })
})

// ── PIPELINE ──────────────────────────────────────────────────────────────────
test.describe('Pipeline endpoints', () => {
  test('GET /api/pipeline/jobs → 200 with jobs array', async () => {
    const { status, body } = await apiGet('/api/pipeline/jobs')
    expect(status).toBe(200)
    expect(Array.isArray(body.jobs)).toBe(true)
  })

  test('GET /api/pipeline/status → 200', async () => {
    const { status, body } = await apiGet('/api/pipeline/status')
    expect(status).toBe(200)
    expect(['idle', 'running', 'locked']).toContain(body.status)
  })

  test('GET /api/pipeline/lock-status → 200', async () => {
    const { status } = await apiGet('/api/pipeline/lock-status')
    expect(status).toBe(200)
  })
})

// ── SCHEDULER ─────────────────────────────────────────────────────────────────
test.describe('Scheduler endpoints', () => {
  test('GET /api/scheduler/status → 200 with queue count', async () => {
    const { status, body } = await apiGet('/api/scheduler/status')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.queue).toBeDefined()
    expect(typeof body.queue.pending_count).toBe('number')
  })

  test('GET /api/scheduler/job-history → 200', async () => {
    const { status, body } = await apiGet('/api/scheduler/job-history')
    expect(status).toBe(200)
    expect(Array.isArray(body.history)).toBe(true)
  })
})

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
test.describe('Analytics endpoints', () => {
  test('GET /api/analytics/status → 200', async () => {
    const { status } = await apiGet('/api/analytics/status')
    expect(status).toBe(200)
  })

  test('GET /api/db/stats → 200 with video count', async () => {
    const { status, body } = await apiGet('/api/db/stats')
    expect(status).toBe(200)
    expect(typeof body.total_videos).toBe('number')
  })

  test('GET /api/db/costs → 200', async () => {
    const { status } = await apiGet('/api/db/costs')
    expect(status).toBe(200)
  })
})

// ── BILLING ───────────────────────────────────────────────────────────────────
test.describe('Billing endpoints', () => {
  test('GET /api/billing/usage → 200 with plan', async () => {
    const { status, body } = await apiGet('/api/billing/usage')
    expect(status).toBe(200)
    expect(body.plan).toBeTruthy()
    expect(typeof body.used).toBe('number')
    expect(typeof body.limit).toBe('number')
  })

  test('GET /api/billing/plan → 200 with features', async () => {
    const { status, body } = await apiGet('/api/billing/plan')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.features)).toBe(true)
  })
})

// ── SOCIAL ────────────────────────────────────────────────────────────────────
test.describe('Social endpoints', () => {
  test('GET /api/social/platforms → 200', async () => {
    const { status } = await apiGet('/api/social/platforms')
    expect(status).toBe(200)
  })

  test('GET /api/community-posts → 200 with posts array', async () => {
    const { status, body } = await apiGet('/api/community-posts')
    expect(status).toBe(200)
    expect(Array.isArray(body.posts)).toBe(true)
  })
})

// ── SHORTS ────────────────────────────────────────────────────────────────────
test.describe('Shorts endpoints', () => {
  test('GET /api/shorts/list → 200', async () => {
    const { status, body } = await apiGet('/api/shorts/list')
    expect(status).toBe(200)
    expect(body.ok).toBe(true)
    expect(Array.isArray(body.shorts)).toBe(true)
  })

  test('GET /api/shorts/status with unknown job_id → not_found', async () => {
    const { status, body } = await apiGet('/api/shorts/status', { job_id: 'nonexistent' })
    expect(status).toBe(200)
    expect(body.status).toBe('not_found')
  })
})

// ── VOICES ────────────────────────────────────────────────────────────────────
test.describe('Voices endpoint', () => {
  test('GET /api/voices/list → 200 with groups', async () => {
    const { status, body } = await apiGet('/api/voices/list')
    expect(status).toBe(200)
    expect(Array.isArray(body.groups)).toBe(true)
    expect(body.groups.length).toBeGreaterThan(0)
  })
})

// ── STUDIO ────────────────────────────────────────────────────────────────────
test.describe('Studio endpoints', () => {
  test('GET /api/studio/videos → 200', async () => {
    const { status } = await apiGet('/api/studio/videos')
    expect(status).toBe(200)
  })

  test('GET /api/custom-studio/status → 200', async () => {
    const { status } = await apiGet('/api/custom-studio/status')
    expect(status).toBe(200)
  })
})

// ── CALENDAR ──────────────────────────────────────────────────────────────────
test.describe('Calendar endpoint', () => {
  test('GET /api/calendar/events with dates → 200', async () => {
    const { status, body } = await apiGet('/api/calendar/events', {
      start: '2026-07-01',
      end: '2026-07-31',
    })
    expect(status).toBe(200)
    expect(Array.isArray(body.events)).toBe(true)
  })
})

// ── SECURITY ──────────────────────────────────────────────────────────────────
test.describe('Security — unauthenticated requests', () => {
  test('protected endpoint without token → 401', async () => {
    const ctx  = await request.newContext({ baseURL: API })
    const resp = await ctx.get('/api/auth/me')
    expect(resp.status()).toBe(401)
    await ctx.dispose()
  })

  test('protected endpoint with bad token → 401', async () => {
    const ctx  = await request.newContext({ baseURL: API })
    const resp = await ctx.get('/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.here' },
    })
    expect(resp.status()).toBe(401)
    await ctx.dispose()
  })

  test('health endpoint is public → 200', async () => {
    const ctx  = await request.newContext({ baseURL: API })
    const resp = await ctx.get('/api/health')
    expect(resp.status()).toBe(200)
    await ctx.dispose()
  })
})
