/**
 * job-activity.spec.ts — the job detail page's **Recent Activity** card.
 *
 * Written for TEST.md §29.42: the card renders the job record's `events` array, which the API has always
 * returned and **no frontend file had ever consumed** — so the "Step: …" lines, and now the thumbnail
 * outcome ("Thumbnail NOT set — HTTP 403 forbidden …"), were write-only. A component nothing renders cannot
 * be caught by an offline suite; this asserts the rendered card matches the API's own payload, in order.
 *
 * Account-agnostic: it finds a job with events through the page's own list request, and skips — visibly, with
 * a reason — when this account has no such job, rather than passing vacuously.
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

test.describe('Job detail — Recent Activity', () => {
  test('shows exactly the events the API returned, newest first', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    const listResponse = page.waitForResponse(
      r => r.url().includes('/api/pipeline/jobs') && r.request().method() === 'GET',
      { timeout: 25_000 },
    )
    await gotoAuthed(page, '/app/jobs')
    const list = (await (await listResponse).json().catch(() => ({}))) as any

    const jobs: any[] = list?.jobs ?? []
    const withEvents = jobs.filter(j => Array.isArray(j.events) && j.events.length > 0)
    test.skip(
      withEvents.length === 0,
      'no job on this account has recorded events, so the card is legitimately absent',
    )

    const target = withEvents[0]
    await gotoAuthed(page, `/app/jobs/${target.job_id}`)

    const cardHeading = page.getByText('Recent Activity', { exact: true })
    await expect(cardHeading).toBeVisible({ timeout: 20_000 })

    // The card renders the last 8 events, newest first.
    const expected: string[] = target.events
      .slice(-8)
      .reverse()
      .map((e: any) => String(e.message ?? '').trim())
    const rendered = (await page.locator('h3:has-text("Recent Activity") + ul > li span').allInnerTexts())
      .map(t => t.trim())
      .filter(Boolean)

    expect(rendered, 'the card rendered a different set of events than the API returned').toEqual(expected)

    // A warning-or-worse event must not render as an ordinary info line: the whole point of the card is that a
    // skipped thumbnail is visibly *not* a success. Colour is asserted via the class the card sets.
    const warningIndex = target.events.slice(-8).reverse()
      .findIndex((e: any) => e.level === 'warning' || e.level === 'error')
    if (warningIndex >= 0) {
      const row = page.locator('h3:has-text("Recent Activity") + ul > li').nth(warningIndex)
      await expect(row.locator('span')).toHaveClass(/text-\[#(B45309|BE123C)\]/)
    }

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
