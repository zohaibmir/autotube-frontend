/**
 * studio.spec.ts — the Studio page's video listing.
 *
 * Written for TEST.md's open item "expand e2e coverage for …", aimed at §29.37: this listing was admin-only
 * because the files under `output/` carry no owner metadata, and became owner-scoped once `videos.file_path`
 * recorded which account a render belongs to. The page's own copy still said "needs an admin account" after
 * that change — the kind of staleness only a click-through catches.
 *
 * Read-only: it loads the page and reads the listing endpoint's response. Upload, clip extraction and
 * publishing are deliberately not touched — they spend credits and publish to a live channel.
 */
import { test, expect } from '@playwright/test'
import { captureConsoleErrors, gotoAuthed, realErrors } from './helpers'

type StudioVideos = { ok?: boolean; videos?: Array<{ name?: string; path?: string }> }

test.describe('Studio video listing', () => {
  test('serves the caller their own renders, without an admin-only restriction', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    const apiCall = page.waitForResponse(
      r => r.url().includes('/api/studio/videos') && r.request().method() === 'GET',
      { timeout: 25_000 },
    )
    // The old page now lives behind the Tools tab of the Creator Studio shell; Content (the new
    // library) is the default. `?tab=tools` keeps this spec pointed at the listing it tests.
    await gotoAuthed(page, '/app/studio?tab=tools')
    const response = await apiCall

    // Owner-scoped: a signed-in account gets its own renders rather than a 403. If this fails with 403 the
    // listing has been re-gated, and §29.37's scoping has regressed.
    expect(response.status(), 'the listing is available to the account that owns the renders').toBe(200)
    const body = (await response.json()) as StudioVideos
    expect(body.ok, 'the listing reports ok').toBeTruthy()
    const videos = body.videos ?? []

    // The message the page shows on a 403 is kept as a safety net, but it must not be visible now: §29.37
    // made "the listing needs an admin" untrue, and a stale message here sends people looking for a fix.
    await expect(page.getByText('Video list needs an admin account')).toHaveCount(0)
    await expect(page.getByText('Video list unavailable for this account')).toHaveCount(0)

    if (videos.length > 0) {
      // Something the API returned is actually on the page — the listing is rendered, not just fetched.
      const label = videos[0].name ?? videos[0].path ?? ''
      if (label) {
        await expect(page.getByText(label, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
      }
    }
    // Either way the page must not have crashed into its error state.
    await expect(page.getByText('Something went wrong')).toHaveCount(0)

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
