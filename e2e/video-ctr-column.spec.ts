/**
 * video-ctr-column.spec.ts — the captured click-through joined into both video tables (§5.1).
 *
 * The two things this column can get wrong are both invisible to an offline test, because both are about
 * what a creator *reads*:
 *
 *   * **a gap rendered as a zero.** Capture is opt-in and per-video, so most rows have no reading. A
 *     `0.00%` there is indistinguishable from a real measurement of zero.
 *   * **a lifetime figure sitting beside windowed ones.** Views and watch time are synced over a period;
 *     a CTR reading is cumulative since publication. Same styling, same row, so unless the cell is dated
 *     and the header says what kind of number it is, the two read as comparable.
 *
 * Test 1 is live and proves both surfaces carry the column and the caution. Test 2 forces the rendering
 * with a fixed payload (nothing seeded — one response replaced in the browser, TEST.md §29.54), because
 * the account's own videos may have no readings at all and the interesting half would never be drawn.
 */
import { test, expect, type Locator } from '@playwright/test'
import { gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

const FLAG = 'Click-through'

/** Read the page's own channels response, so a slug is never guessed. */
async function channelsFrom(page: import('@playwright/test').Page) {
  const response = page.waitForResponse(
    r => r.url().includes('/api/channels') && r.request().method() === 'GET',
    { timeout: 25_000 },
  )
  await gotoAuthed(page, '/app/analytics')
  const body = (await (await response).json().catch(() => ({}))) as any
  return (body?.channels ?? []) as any[]
}

test.describe('Captured click-through in the video tables (§5.1)', () => {
  test('live: both tables carry the column, and say what kind of number it is', async ({ page }) => {
    const errors = captureConsoleErrors(page)
    const channels = await channelsFrom(page)

    const header = page.getByTestId('video-history-table')
      .getByRole('columnheader', { name: FLAG })
    // With no synced rows the table renders its empty state instead of its headers (AnalyticsPage's
    // `NoData`), so there is no column to assert. That is an account state, not a regression: assert
    // the empty state is the honest one, then skip rather than report the table as broken.
    const noRows = page.getByText(/No video data yet/i).first()
    await expect(header.or(noRows).first()).toBeVisible({ timeout: 25_000 })
    if (!(await header.isVisible().catch(() => false))) {
      test.skip(true, 'this account has no synced videos, so the video table renders its empty state')
    }
    // The caution is the point, not decoration: without it a lifetime figure beside windowed ones reads
    // as "this week's click-through".
    await expect(header).toHaveAttribute('title', /not a window/)

    test.skip(channels.length === 0, 'this account owns no channels, so the Channel Details table cannot open')

    await gotoAuthed(page, `/app/channels/${channels[0].slug}`)
    const channelHeader = page.getByTestId('channel-videos-table')
      .getByRole('columnheader', { name: FLAG })
    await expect(channelHeader).toBeVisible({ timeout: 25_000 })
    await expect(channelHeader).toHaveAttribute('title', /not a window/)

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('renders a dated reading, an em dash for a gap, and never a confident zero', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // The table is filtered client-side by the selected channel, which is whatever the account's default
    // is. Rather than guess the slug, hold the request until the page's own channels response has said
    // what it will filter on, then answer with rows that survive that filter.
    let release!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    let slug = ''

    await page.route('**/api/db/videos*', async (route) => {
      await held
      await route.fulfill({
        json: [
          { id: 1, topic: 'E2E captured reading', title: 'E2E captured reading', channel_slug: slug,
            views: 4200, status: 'published',
            ctr_percent: 4.25, ctr_impressions: 1200, ctr_captured_at: '2026-10-12T09:30:00' },
          { id: 2, topic: 'E2E never captured', title: 'E2E never captured', channel_slug: slug,
            views: 900, status: 'published',
            ctr_percent: null, ctr_impressions: null, ctr_captured_at: null },
        ],
      })
    })

    const channels = await channelsFrom(page)
    slug = (channels.find((c: any) => c.is_default)?.slug ?? channels[0]?.slug ?? '') as string
    release()

    const table = page.getByTestId('video-history-table')
    await expect(table.getByText('E2E captured reading')).toBeVisible({ timeout: 20_000 })

    // By cell index rather than by text: the row has several '—' cells (retention, cost), so a text
    // match would pass without ever looking at the column under test.
    const ctrCell = (row: Locator) => row.locator('td').nth(4)
    const withReading = table.locator('tr', { hasText: 'E2E captured reading' })
    const withoutReading = table.locator('tr', { hasText: 'E2E never captured' })

    await expect(ctrCell(withReading)).toContainText('4.25%')
    await expect(ctrCell(withReading)).toContainText(/as of /)
    await expect(ctrCell(withReading).locator('[title]').first())
      .toHaveAttribute('title', /Cumulative since publication, not a window/)

    // The gap: an em dash, and a tooltip that says why rather than reporting a failure.
    await expect(ctrCell(withoutReading)).toHaveText('—')
    await expect(ctrCell(withoutReading).locator('[title]'))
      .toHaveAttribute('title', /No click-through reading captured/)

    // The one assertion that catches the whole class of bug, stated globally.
    await expect(table.getByText('0.00%')).toHaveCount(0)

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
