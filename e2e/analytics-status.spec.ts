/**
 * analytics-status.spec.ts — the analytics surfaces render, and the numbers agree with the data.
 *
 * The second test pins the actual regression behind "analytics not loading": `database.get_channel_stats`
 * filtered `status = 'published'`, but `import_channel_uploads` (the analytics sync's upload discovery)
 * writes YouTube's *privacy* status — `'public'` — into `videos.status`. Every video the sync discovered
 * was therefore invisible to the KPI cards, YPP progress, cross-linking and best-time recommendations,
 * while the video-history table (which has no status filter) still listed the very same rows. The symptom
 * the user sees is "Total videos: 0" (or all dash placeholders) next to a table full of videos.
 *
 * The first and third tests are the page-load guarantees for the two URLs this bug was reported against.
 */
import { test, expect } from '@playwright/test'
import { API_URL, BASE_URL, gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

test.describe('Analytics page', () => {
  test('renders the KPI cards, cost panel and video history without errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    await gotoAuthed(page, '/app/analytics')

    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Total Videos', { exact: true })).toBeVisible()
    await expect(page.getByText('API Cost Breakdown', { exact: true })).toBeVisible()
    // With rows the table renders; with no rows the honest empty state renders. Either is a load, not a crash.
    await expect(
      page.getByTestId('video-history-table').or(page.getByText('No video data yet', { exact: true })),
    ).toBeVisible({ timeout: 20_000 })

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('stat KPIs agree with the rows the video-history endpoint reports', async ({ page }) => {
    await gotoAuthed(page, '/app/analytics')
    await expect(page.getByRole('heading', { name: 'Analytics' })).toBeVisible({ timeout: 20_000 })

    // Read the two endpoints the page renders from, authenticated exactly like the page. The assertion
    // holds for the account-wide scope regardless of which channel the page pre-selects, because both
    // endpoints are account-wide when the slug is omitted.
    const result = await page.evaluate(async ({ api }) => {
      const token = localStorage.getItem('vidora_access_token')
      const headers = { Authorization: `Bearer ${token}` }
      const videos = await fetch(`${api}/api/db/videos?limit=5000`, { headers }).then(r => r.json())
      const stats = await fetch(`${api}/api/db/stats`, { headers }).then(r => r.json())
      return { videos: Array.isArray(videos) ? videos : [], stats }
    }, { api: API_URL })

    const live = (result.videos as any[]).filter(v => v.status === 'published' || v.status === 'public')
    expect(result.stats.total_videos, JSON.stringify(result)).toBe(live.length)
    expect(result.stats.total_views, JSON.stringify(result)).toBe(
      live.reduce((sum, v) => sum + (v.views ?? 0), 0),
    )
  })
})

test.describe('Channel detail page', () => {
  test('renders the channel page with its sections navigation', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Resolve a real, owned slug from the list page's own API response — never hardcode one. This is the
    // channel page the original "analytics not loading" report pointed at (`/app/channels/wildfactbook`),
    // which was a duplicate profile that has since been merged into the canonical slug.
    const apiCall = page.waitForResponse(
      r => r.url().includes('/api/channels') && r.request().method() === 'GET',
      { timeout: 20_000 },
    )
    await gotoAuthed(page, '/app/channels')
    const api = (await (await apiCall).json()) as { channels?: { slug: string }[] }
    const slug = (api.channels ?? [])[0]?.slug
    test.skip(!slug, 'this account owns no channels')

    await page.goto(`${BASE_URL}/app/channels/${slug}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('navigation', { name: 'Channel sections' })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Videos', { exact: true }).first()).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})