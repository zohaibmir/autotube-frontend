/**
 * retention-feedback-panel.spec.ts — the Analytics panel showing what the script generator is told (§5.4).
 *
 * This panel is a trust surface rather than a chart. The same sentence it displays is inserted into the
 * prompt before the next script is written, so if it renders the wrong thing — or renders nothing while
 * the generator is in fact being instructed — a creator has no way to tell that their output is being
 * shaped by a measurement they cannot see.
 *
 *   * **live** — account-agnostic; asserts the panel agrees with the response the page itself made, in
 *     whichever of the three states that account is actually in.
 *   * **intercepted** — serves a fixed `ok` payload, because an account with fewer than three usable
 *     curves only ever takes the short branch and would leave the quoting untested. Nothing is seeded;
 *     one response is replaced in the browser (TEST.md §29.54).
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, captureConsoleErrors, realErrors } from './helpers'

const PANEL = 'retention-feedback-panel'

test.describe('Retention feedback panel (§5.4)', () => {
  test('live: renders whichever state the API reported, and claims nothing more', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    const apiResponse = page.waitForResponse(
      r => r.url().includes('/api/analytics/retention-pattern') && r.request().method() === 'GET',
      { timeout: 30_000 },
    )
    await gotoAuthed(page, '/app/analytics')
    const response = await apiResponse
    expect(response.status(), 'the panel should get a 200').toBe(200)
    const body = (await response.json()) as any

    const panel = page.getByTestId(PANEL)
    await expect(panel.getByText('What your next script is told', { exact: true }))
      .toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText(body.headline, { exact: false }).first()).toBeVisible({ timeout: 15_000 })

    if (body.state === 'ok') {
      // The screenshot a creator would see: the exact sentence, quoted under a label that says where it
      // goes. A paraphrase here would make the panel a description of the feature rather than a view of it.
      await expect(panel.getByText('In every new script prompt', { exact: true })).toBeVisible()
      await expect(panel.getByText(body.advice, { exact: false }).first()).toBeVisible()
      await expect(panel.getByText(`Based on ${body.videos} of your last ${body.examined} videos`, { exact: false })
        .first()).toBeVisible()
    } else {
      // Both refusals: the creator must be told the feedback is *off*, not left to infer it from silence.
      expect(['not_enough_data', 'no_pattern']).toContain(body.state)
      await expect(panel.getByText(/Nothing is being added to your scripts/)).toBeVisible()
      await expect(panel.getByText('In every new script prompt', { exact: true })).toHaveCount(0)
    }

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('ok state: quotes the exact sentence the prompt receives', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    const advice =
      'On 80% of your last 5 videos with retention data, viewers left between 0% and 10% of the way in. ' +
      'Open on the strongest moment instead of building to it, and get to the first concrete fact inside ' +
      'the first minute.'

    await page.route('**/api/analytics/retention-pattern*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          state: 'ok',
          videos: 5,
          examined: 7,
          needed: 0,
          min_videos: 3,
          window: [0.0, 0.1],
          share: 0.8,
          is_intro: true,
          advice,
          headline: '4 of your 5 videos with a clear drop lost viewers around the 0–10% mark. '
            + 'That is a format pattern, not 4 separate mistakes.',
          channel_slug: 'e2e',
        }),
      }),
    )
    await gotoAuthed(page, '/app/analytics')

    const panel = page.getByTestId(PANEL)
    await expect(panel.getByText('4 of your 5 videos', { exact: false })).toBeVisible({ timeout: 20_000 })
    await expect(panel.getByText('Based on 5 of your last 7 videos with a retention curve.', { exact: true }))
      .toBeVisible()
    await expect(panel.getByText('In every new script prompt', { exact: true })).toBeVisible()
    // Verbatim, both ways: the panel must not trim, reword or summarise what the model is handed.
    await expect(panel.getByText(advice, { exact: true })).toBeVisible()
    // And it must not claim the feedback is off while it is demonstrably on.
    await expect(panel.getByText(/Nothing is being added to your scripts/)).toHaveCount(0)

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
