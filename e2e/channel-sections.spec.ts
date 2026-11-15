/**
 * channel-sections.spec.ts — the channel page's URL-backed sections, and the Videos list they open on.
 *
 * Two problems this page had, both structural rather than cosmetic (TEST.md §29.63–§29.64):
 *
 *   * twelve panels stacked in one column, with the Videos list eleventh below `xl` — it sat at y≈4135 on a
 *     1024px laptop, five screens of settings before the object the page is about;
 *   * the Videos panel stated no purpose beyond the word "Videos", and rendered up to 30 rows with no way
 *     to narrow them.
 *
 * The sections are URL-backed on purpose — bookmarkable, shareable, survivable across a refresh — which is
 * also what makes them testable: navigating to a URL is the same act as clicking the tab.
 *
 * The second test serves a fixed payload rather than depending on the account's own videos, because paging
 * and search are the point and an account with three videos can never exercise them. Nothing is seeded; one
 * response is replaced in the browser (TEST.md §29.54).
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, BASE_URL } from './helpers'

/** 25 rows: enough for three pages at ten per page, and enough for a search to narrow meaningfully. */
function videosFixture() {
  return Array.from({ length: 25 }, (_, i) => ({
    id: i + 1,
    // No `channel_slug`: the panel keeps rows whose slug is absent or matches, so these always qualify
    // without having to know which channel the logged-in account owns.
    youtube_id: `vid${String(i + 1).padStart(3, '0')}`,
    title: i % 5 === 0 ? `Pyramids documentary ${i + 1}` : `Unrelated upload ${i + 1}`,
    status: 'published',
    published_at: '2026-01-05T10:00:00Z',
    views: 1000 + i,
    ctr_percent: null,
    ctr_impressions: null,
  }))
}

async function firstChannelSlug(page: import('@playwright/test').Page) {
  const channelsResponse = page.waitForResponse(
    r => r.url().includes('/api/channels') && r.request().method() === 'GET',
    { timeout: 60_000 },
  )
  await gotoAuthed(page, '/app/channels')
  const channels = (((await (await channelsResponse).json().catch(() => ({}))) as any)?.channels) ?? []
  return channels[0]?.slug as string | undefined
}

test.describe('Channel page sections', () => {
  test('live: the four sections exist, and the URL decides which one is open', async ({ page }) => {
    test.setTimeout(180_000)

    const slug = await firstChannelSlug(page)
    test.skip(!slug, 'this account owns no channels')

    await gotoAuthed(page, `/app/channels/${slug}`)
    const nav = page.getByRole('navigation', { name: 'Channel sections' })
    await expect(nav).toBeVisible({ timeout: 30_000 })

    // Labelled as navigation, not as a tab widget: these links change the URL, so `aria-current` is the
    // honest signal — a `role="tablist"` would promise an in-page swap that does not happen.
    await expect(nav.getByRole('link')).toHaveText(['Videos', 'SEO', 'Growth', 'Setup'])
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Videos')

    // The deep link is the whole reason for URL-backed sections.
    await page.goto(`${BASE_URL}/app/channels/${slug}/seo`, { waitUntil: 'domcontentloaded' })
    await expect(nav.locator('[aria-current="page"]')).toHaveText('SEO', { timeout: 30_000 })
    await expect(page.getByText(/How discoverable the channel is/).first()).toBeVisible({ timeout: 20_000 })

    // An unknown segment falls back to the first section rather than rendering nothing.
    await page.goto(`${BASE_URL}/app/channels/${slug}/nonsense`, { waitUntil: 'domcontentloaded' })
    await expect(nav.locator('[aria-current="page"]')).toHaveText('Videos', { timeout: 30_000 })
  })

  test('the Videos list says what it is for, and can be searched and paged', async ({ page }) => {
    test.setTimeout(180_000)

    await page.route('**/api/db/videos*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(videosFixture()) }),
    )

    const slug = await firstChannelSlug(page)
    test.skip(!slug, 'this account owns no channels')

    await gotoAuthed(page, `/app/channels/${slug}`)
    const table = page.getByTestId('channel-videos-table')
    await expect(table).toBeVisible({ timeout: 30_000 })

    // The heading states the panel's purpose. This is the sentence that was missing.
    await expect(page.getByText(/Everything published on this channel/).first()).toBeVisible()

    // Ten rows, a range summary, and a pager reflecting 25 videos across three pages.
    await expect(table.locator('tbody tr')).toHaveCount(10)
    await expect(page.getByText('1–10 of 25', { exact: true })).toBeVisible()
    await expect(page.getByText('Page 1 of 3', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeDisabled()

    await page.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Page 2 of 3', { exact: true })).toBeVisible()
    await expect(page.getByText('11–20 of 25', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Previous' })).toBeEnabled()

    // Search narrows the set and resets to page one. Five titles contain "Pyramids" (every fifth row).
    await page.getByRole('searchbox', { name: /Search this channel/ }).fill('Pyramids')
    await expect(page.getByText('1–5 of 5', { exact: true })).toBeVisible()
    await expect(table.locator('tbody tr')).toHaveCount(5)
    // Five results fit on one page, so the pager removes itself rather than offering a page 1 of 1.
    await expect(page.getByText(/^Page \d+ of \d+$/)).toHaveCount(0)

    // A search matching nothing gets its own empty state — naming the term, saying how many videos exist,
    // and offering a way out. That is a different situation from a channel with no videos at all, and
    // Primer's guidance is to say which one the reader is in.
    await page.getByRole('searchbox', { name: /Search this channel/ }).fill('nothing matches this')
    await expect(page.getByText(/No videos match/)).toBeVisible()
    await expect(page.getByText(/25 videos on this channel/)).toBeVisible()
    await page.getByRole('button', { name: 'Clear search' }).click()
    await expect(table.locator('tbody tr')).toHaveCount(10)
  })
})
