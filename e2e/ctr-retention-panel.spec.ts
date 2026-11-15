/**
 * ctr-retention-panel.spec.ts — the Analytics page's **Packaging or content?** panel (§5.2).
 *
 * Two tests, because the interesting half of this panel only renders for an account that already has
 * paired readings, and the account CI logs in as does not:
 *
 *   1. **live** — account-agnostic, against whatever the real API returns. Proves the wiring (route,
 *      auth, query) and asserts whichever state is genuinely there.
 *   2. **intercepted** — serves a fixed `ok` payload over the real logged-in page, so the quadrant
 *      grouping, labels, advice, ordering and per-row figures are all exercised regardless of the
 *      account's data. Without it the rich branch could regress and CI would stay green forever: the
 *      first live run here answered `have=1 counts={}`, which takes the short branch and never renders
 *      a single quadrant.
 *
 * The interception writes nothing and reads nothing real — it replaces one response in the browser, so
 * no rows are seeded into a database (TEST.md §29.54).
 *
 * `test_analytics_correlations.py` §8 pins the payload *keys*; only a browser shows the panel actually
 * draws them. A component that throws while mapping its own props, or a `.toFixed()` on a numeric
 * string, passes every offline check.
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

test.describe('Click-through vs retention panel (§5.2)', () => {
  test('live: renders the comparison the API returned, in whichever state it is in', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Registered before navigating: the panel fetches on mount.
    const apiResponse = page.waitForResponse(
      r => r.url().includes('/api/analytics/ctr-retention') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoAuthed(page, '/app/analytics')
    const response = await apiResponse
    expect(response.status(), 'the panel should get a 200').toBe(200)
    const body = (await response.json()) as any

    const panel = page.getByTestId('ctr-retention-panel')
    await expect(panel.getByText('Packaging or content?', { exact: true })).toBeVisible({ timeout: 20_000 })

    // ── The short state. Most accounts see this, and it must not look like a finding. ──
    if (body.state === 'not_enough_data') {
      expect(body.is_screening, 'an empty sample must not be dressed as a result').toBeFalsy()
      await expect(panel.getByText(body.headline, { exact: false }).first())
        .toBeVisible({ timeout: 15_000 })
      // The decisive assertion: an empty quadrant chart reads as "your channel is like this", so the
      // panel must draw none of them until it has the sample to justify one.
      for (const label of ['Over-promised', 'Under-clicked', 'Topic problem', 'Working']) {
        await expect(panel.getByText(label, { exact: true })).toHaveCount(0)
      }
      expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
      return
    }

    expect(body.state).toBe('ok')
    expect(body.videos.length, 'the ok state must carry videos').toBeGreaterThan(0)

    // Headline and medians. Each is formatted by the panel (`?.toFixed(2)`), so a numeric string or a
    // null arriving from the API blanks the section with a TypeError instead of a number.
    await expect(panel.getByText(body.headline, { exact: false }).first()).toBeVisible({ timeout: 15_000 })
    await expect(panel.getByText(`Median across ${body.have} videos`, { exact: false }).first()).toBeVisible()
    await expect(panel.getByText(`${body.median_ctr.toFixed(2)}% click-through`, { exact: false }).first())
      .toBeVisible()
    await expect(panel.getByText(`${body.median_retention.toFixed(1)}% retention`, { exact: false }).first())
      .toBeVisible()

    // Every quadrant the counts claim must have a group, with that many rows under it and its advice on
    // screen. This catches a quadrant the panel cannot draw: it would be counted in `have` and appear in
    // no group at all.
    let grouped = 0
    for (const [quadrant, count] of Object.entries(body.counts as Record<string, number>)) {
      const inQuadrant = body.videos.filter((v: any) => v.quadrant === quadrant)
      expect(inQuadrant.length, `counts.${quadrant} disagrees with videos[]`).toBe(count)
      if (count === 0) continue
      grouped += count
      await expect(panel.getByText(inQuadrant[0].label, { exact: true }).first()).toBeVisible()
      await expect(panel.getByText(inQuadrant[0].advice, { exact: false }).first()).toBeVisible()
      await expect(panel.getByText(`${count} video${count !== 1 ? 's' : ''}`, { exact: true }).first())
        .toBeVisible()
    }
    expect(grouped, 'videos were counted but drawn in no group').toBe(body.videos.length)

    // Every video has a row — the panel prints the title when there is one and the id when there is not,
    // because a video captured before its `videos` row existed is still a data point.
    for (const v of body.videos) {
      await expect(panel.getByText(v.title || v.youtube_id, { exact: true }).first()).toBeVisible()
    }
    const first = body.videos[0]
    await expect(panel.getByText(`${first.ctr_percent.toFixed(2)}%`, { exact: true }).first()).toBeVisible()
    await expect(panel.getByText(`${first.retention_percent.toFixed(1)}%`, { exact: true }).first())
      .toBeVisible()

    // The limits are rendered rather than buried in the docs.
    for (const caveat of body.caveats) {
      await expect(panel.getByText(caveat, { exact: false }).first()).toBeVisible()
    }

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  /**
   * The `ok` branch, which the live test above cannot reach on this account (it answered `have=1`).
   * Served over the real logged-in page, so everything except this one response is production code.
   *
   * The fixture covers all four quadrants, includes a video with **no title** (the panel must fall back
   * to the id), and puts *two* videos in one quadrant — so the grouping, the group count and the
   * "N videos" label are all exercised rather than assumed.
   */
  test('ok state: draws every quadrant, row and caveat the payload describes', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Spelled out rather than imported from the server module: the panel's job is to print exactly what
    // it is handed, so a fixture sharing the source of truth could not catch a mismatch.
    const LABELS = {
      clickbait: 'Over-promised',
      packaging: 'Under-clicked',
      topic:     'Topic problem',
      working:   'Working',
    }
    const ADVICE = {
      clickbait: 'The thumbnail won a click the video did not hold. Fix the video or the promise, not the thumbnail.',
      packaging: 'A video people stay for that nobody clicked. Cheapest fix there is: rewrite the title and thumbnail.',
      topic:     'Low on both. This is a topic or audience problem, not a packaging one -- do not spend the week on thumbnails.',
      working:   'High on both. Leave it alone and work out what to repeat.',
    }
    type Quadrant = keyof typeof LABELS
    const row = (
      youtube_id: string, title: string | null, ctr: number, retention: number, quadrant: Quadrant,
    ) => ({
      youtube_id, title,
      ctr_percent: ctr,
      retention_percent: retention,
      quadrant,
      label: LABELS[quadrant],
      advice: ADVICE[quadrant],
      vs_median_ctr: Number((ctr - 3.5).toFixed(4)),
      vs_median_retention: Number((retention - 37.1).toFixed(4)),
      channel_slug: 'e2e',
      published_at: '2026-01-05',
      thumbnail: 'https://example.invalid/t.jpg',
    })

    const fixture = {
      state: 'ok',
      have: 5,
      needed: 0,
      min_videos: 5,
      median_ctr: 3.5,
      median_retention: 37.1,
      counts: { clickbait: 1, packaging: 1, topic: 1, working: 2 },
      headline: '2 of 5 videos hold their audience but are not being clicked. That is the cheapest thing on this page to fix.',
      is_screening: true,
      caveats: [
        'Split against your own median, not a published benchmark -- there is no universal good click-through rate.',
        'Both figures are lifetime averages since publication, so neither is a reading for this week.',
        'Correlation, not cause. Treat a quadrant as a place to look, not a verdict.',
        '5 videos is enough to screen and not enough to be confident. It sharpens as readings accumulate.',
      ],
      videos: [
        row('cb-1', 'Over-promised by its own thumbnail', 5.0, 20.0, 'clickbait'),
        row('pk-1', null, 1.0, 55.0, 'packaging'),
        row('tp-1', 'A topic nobody searched for', 0.5, 10.0, 'topic'),
        row('wk-1', 'The one that worked', 6.0, 60.0, 'working'),
        row('wk-2', 'And its sequel', 4.5, 40.0, 'working'),
      ],
      dropped: { paired: 5, ctr_only: 3, retention_only: 2 },
      channel_slug: 'e2e',
    }

    await page.route('**/api/analytics/ctr-retention*', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixture) }),
    )
    await gotoAuthed(page, '/app/analytics')
    const panel = page.getByTestId('ctr-retention-panel')
    await expect(panel.getByText('Packaging or content?', { exact: true })).toBeVisible({ timeout: 20_000 })

    // The headline and both medians, which the panel formats itself.
    await expect(panel.getByText(fixture.headline, { exact: false })).toBeVisible()
    await expect(panel.getByText('Median across 5 videos', { exact: false })).toBeVisible()
    await expect(panel.getByText('3.50% click-through', { exact: false })).toBeVisible()
    await expect(panel.getByText('37.1% retention', { exact: false })).toBeVisible()

    // All four groups, each with its own label and its advice.
    for (const quadrant of ['clickbait', 'packaging', 'topic', 'working'] as Quadrant[]) {
      await expect(panel.getByText(LABELS[quadrant], { exact: true })).toBeVisible()
      await expect(panel.getByText(ADVICE[quadrant], { exact: false })).toBeVisible()
    }
    // The per-group counts: one quadrant holds two videos, the other three hold one each.
    await expect(panel.getByText('2 videos', { exact: true })).toHaveCount(1)
    await expect(panel.getByText('1 video', { exact: true })).toHaveCount(3)

    // Every row, including the one with no title -- it must fall back to its id rather than vanish.
    for (const v of fixture.videos) {
      await expect(panel.getByText(v.title ?? v.youtube_id, { exact: true })).toBeVisible()
    }

    // A figure and the delta printed beneath it, both formatted by the panel.
    await expect(panel.getByText('5.00%', { exact: true })).toBeVisible()
    await expect(panel.getByText('+1.50', { exact: true })).toBeVisible()
    await expect(panel.getByText('20.0%', { exact: true })).toBeVisible()
    await expect(panel.getByText('-17.1', { exact: true })).toBeVisible()

    // Ordering is the panel's, not the payload's: the two actionable quadrants lead, `working` is last.
    const y = async (label: string) =>
      (await panel.getByText(label, { exact: true }).first().boundingBox())?.y ?? 0
    expect(await y('Over-promised'), 'the actionable quadrants must lead')
      .toBeLessThan(await y('Under-clicked'))
    expect(await y('Under-clicked')).toBeLessThan(await y('Working'))

    // The limits are rendered rather than buried in the docs.
    for (const caveat of fixture.caveats) {
      await expect(panel.getByText(caveat, { exact: false })).toBeVisible()
    }

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
