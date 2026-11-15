/**
 * retention-panel.spec.ts — the Analytics page's **Retention Post-Mortem** panel.
 *
 * Written for TEST.md §29.43/§29.44: the panel shipped with an API, a cache, a table migration and 73
 * offline checks, and had **never been rendered in a browser**. The offline suite cannot catch a component
 * that throws while mapping its own props, an SVG polyline with no points, or a field the UI reads that the
 * API does not send — which is exactly what a `waitForResponse` + "the page agrees with its own API call"
 * assertion does catch.
 *
 * Deliberately account-agnostic: it reads the response the page itself made, so it does not care whether the
 * logged-in account owns one channel or a dozen, or whether the newest video already has a retention curve.
 * Every state the panel can legitimately be in is asserted as such rather than skipped silently:
 *   * no channels            → the panel is disabled and the spec says why;
 *   * a video with no curve  → YouTube has not published one yet (HTTP 502 with the reason);
 *   * a curve                → the chart, the "where they left" list and the advice must all render.
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

test.describe('Retention post-mortem panel', () => {
  test('opens and renders the curve the API returned, with no console errors', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Read the page's own channels response: the retention panel is per-channel, and the page only
    // pre-selects a channel marked `is_default` — otherwise the filter stays "All channels" and the panel is
    // (correctly) disabled, so this spec picks a channel exactly as a user would.
    const channelsResponse = page.waitForResponse(
      r => r.url().includes('/api/channels') && r.request().method() === 'GET',
      { timeout: 25_000 },
    )
    await gotoAuthed(page, '/app/analytics')
    const channelsBody = (await (await channelsResponse).json().catch(() => ({}))) as any
    const channels: any[] = channelsBody?.channels ?? []
    test.skip(channels.length === 0, 'this account owns no channels, so the retention panel cannot be opened')

    const slugs = channels.map(c => c.slug)
    const wanted: string = (channels.find(c => c.is_default)?.slug ?? slugs[0]) as string

    // The channel filter is the only combobox with an empty ("All channels") option.
    const channelFilter = page.getByRole('combobox')
      .filter({ has: page.locator('option[value=""]') })
      .first()
    await expect(channelFilter).toBeVisible({ timeout: 20_000 })
    if ((await channelFilter.inputValue()) !== wanted) {
      await channelFilter.selectOption(wanted)
    }

    const panel = page.getByRole('button', { name: /Retention Post-Mortem/i })
    await expect(panel).toBeVisible({ timeout: 20_000 })
    await expect(panel).toBeEnabled()
    await panel.click()

    // The panel picks the channel's best-performing video by default; YouTube only publishes a retention
    // curve once a video has watch time, so walk the list (as a user would) until one has a curve. Every
    // state it passes through is asserted, not skipped silently.
    const videoSelect = page.locator('select').filter({ hasNot: page.locator('option[value=""]') }).first()
    // A channel with nothing published is a state the panel handles honestly: it says so rather than
    // offering an empty picker. Assert that, then skip -- with no video there is no curve, and failing
    // here would report "the panel is broken" for an account that has simply not synced yet.
    const emptyChannel = page.getByText(/No published videos for this channel yet/i)
    await expect(videoSelect.or(emptyChannel).first()).toBeVisible({ timeout: 20_000 })
    if (!(await videoSelect.isVisible().catch(() => false))) {
      test.skip(true, 'this channel has no published videos, so there is no retention curve to render')
    }
    await expect(videoSelect).toBeVisible({ timeout: 20_000 })
    const videoIds: string[] = await videoSelect
      .locator('option')
      .evaluateAll((opts: any[]) => opts.map(o => o.value).filter(Boolean))
    expect(videoIds.length, 'the panel offered no videos to analyse').toBeGreaterThan(0)

    let rendered: any = null
    for (const videoId of videoIds.slice(0, 6)) {
      const apiResponse = page.waitForResponse(
        r => r.url().includes('/api/analytics/retention/') && r.request().method() === 'GET',
        { timeout: 30_000 },
      )
      if (videoId !== (await videoSelect.inputValue())) {
        await videoSelect.selectOption(videoId)
      }
      const response = await apiResponse
      const body = (await response.json().catch(() => ({}))) as any

      if (response.status() !== 200) {
        expect([502, 404], `unexpected status ${response.status()}`).toContain(response.status())
        await expect(page.getByText(/No retention data|not available for this video/i).first())
          .toBeVisible({ timeout: 15_000 })
        continue
      }

      expect(body.ok, 'the report should be ok when the API answers 200').toBeTruthy()
      const usable = (body.points ?? []).filter((p: any) => typeof p.watch_ratio === 'number')
      if (usable.length <= 1) {
        // Published, but no curve yet: the panel must say that rather than draw an empty chart.
        await expect(page.getByText(/Not enough retention data/i).first()).toBeVisible({ timeout: 15_000 })
        continue
      }
      rendered = { body, usable }
      break
    }

    test.skip(rendered === null, 'no video on this channel has a published retention curve yet')
    const { body, usable } = rendered as { body: any; usable: any[] }

    // The chart draws exactly the points the API sent. Scoped by viewBox: the analytics page has other SVGs
    // (stat sparklines), and `.first()` picked one of those up — 6 points against the curve's 100.
    const chart = page.locator('svg[viewBox="0 0 100 30"] polyline').first()
    await expect(chart).toBeVisible({ timeout: 15_000 })
    const drawnPoints = ((await chart.getAttribute('points')) ?? '').trim().split(/\s+/).filter(Boolean)
    expect(drawnPoints.length, 'the chart drew a different number of points than the API sent')
      .toBe(usable.length)

    await expect(page.getByText(/Share of viewers still watching/i)).toBeVisible()

    // Cliffs: each one the API returned must be named on screen, with its position.
    const dropoffs: any[] = body.dropoffs ?? []
    if (dropoffs.length > 0) {
      await expect(page.getByText('Where they left')).toBeVisible()
      const cliffs = page.locator('p', { hasText: /of the video/ })
      await expect(cliffs.first()).toBeVisible()
      await expect(page.getByText(dropoffs[0].segment_position, { exact: false }).first())
        .toBeVisible({ timeout: 10_000 })
      if (dropoffs[0].segment_excerpt) {
        // The whole point of the feature: the cliff quotes the script line it happened in.
        await expect(page.getByText(dropoffs[0].segment_excerpt, { exact: false }).first()).toBeVisible()
      }
    }

    // Advice is rule-based and always present for a usable curve.
    if ((body.advice ?? []).length > 0) {
      await expect(page.getByText(body.advice[0], { exact: false }).first()).toBeVisible()
    }

    // "Explain what to change" is the AI half; it must be offered (clicking it costs a call, so it is not).
    await expect(page.getByRole('button', { name: /Explain what to change/i })).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
