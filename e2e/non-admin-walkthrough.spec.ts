/**
 * Non-admin walkthrough: every authenticated page, as a customer.
 *
 * Why this exists
 * ---------------
 * TEST.md has carried "non-admin walkthrough of the remaining pages" as an open item since the
 * beginning. The specs that do exist each drive one surface; nothing walked the whole app as a
 * customer, so a page that renders a raw error, or a limit that disagrees with the API, could sit
 * unnoticed while every other suite passed.
 *
 * Read-only on purpose. It visits routes and reads what the API already returns; it creates nothing,
 * deletes nothing, and spends nothing. `E2E_CONFIRM_TARGET` is therefore NOT required.
 *
 * What it asserts, per page:
 *   1. the dashboard shell renders -- i.e. `ProtectedRoute` let a real customer in, rather than
 *      bouncing them to /login, which is what a broken token path looks like;
 *   2. no crash copy on screen;
 *   3. no console errors.
 *
 * And three things the per-page loop cannot express:
 *   - `/app/admin` sends a customer away instead of showing them platform data;
 *   - the Billing page's numbers are the API's numbers (the drift class E3 fixed in the copy);
 *   - the Channels page lists only channels the caller owns.
 */
import { test, expect } from '@playwright/test'
import {
  gotoAuthedAs, captureConsoleErrors, hasRole, missingRolesMessage, jsonAs, realErrors,
} from './helpers'

const ROLE = 'user_a' as const

// Every authenticated route in `App.tsx` / the dashboard router. Kept as a list so adding a route
// without adding it here is a visible omission rather than an invisible one.
const PAGES: Array<{ path: string; name: string }> = [
  { path: '/app', name: 'dashboard' },
  { path: '/app/jobs', name: 'jobs' },
  { path: '/app/jobs/new', name: 'new job' },
  { path: '/app/queue', name: 'queue' },
  { path: '/app/calendar', name: 'calendar' },
  { path: '/app/channels', name: 'channels' },
  { path: '/app/create', name: 'create' },
  { path: '/app/create/ideas', name: 'create · ideas' },
  { path: '/app/create/script', name: 'create · script' },
  { path: '/app/create/seo', name: 'create · seo' },
  { path: '/app/create/thumbnail', name: 'create · thumbnail' },
  { path: '/app/create/visuals', name: 'create · visuals' },
  { path: '/app/create/submit', name: 'create · submit' },
  { path: '/app/studio', name: 'studio' },
  { path: '/app/studio/custom', name: 'custom studio' },
  { path: '/app/shorts', name: 'shorts' },
  { path: '/app/kids', name: 'kids studio' },
  { path: '/app/social', name: 'social' },
  { path: '/app/analytics', name: 'analytics' },
  { path: '/app/community', name: 'community' },
  { path: '/app/seo-generator', name: 'seo generator' },
  { path: '/app/settings', name: 'settings' },
  { path: '/app/billing', name: 'billing' },
]

/**
 * The benign-console rules and the filter now live in `helpers.ts`, because eight specs check for console
 * errors and each one was carrying its own idea of what counts. They had already drifted: this file excused
 * 403/404 responses, nothing else did. One shared definition means a rule can only be relaxed in one place,
 * with one justification.
 *
 * The 403/404 exemption is carried over as-is rather than tightened here -- the comment that justified it
 * ("a page that probes an optional endpoint and handles the miss is not broken") is still the reason, and
 * changing what this suite tolerates belongs in its own change, not in a refactor.
 */

test.describe('non-admin walkthrough', () => {
  test.skip(!hasRole(ROLE), missingRolesMessage())

  for (const page_ of PAGES) {
    test(`${page_.path} renders for a customer`, async ({ page }) => {
      const errors = captureConsoleErrors(page)
      await gotoAuthedAs(page, ROLE, page_.path)
      await page.waitForTimeout(1500)

      // 1. The shell. If ProtectedRoute bounced them, this is what fails -- and the message says so,
      //    because "nav not found" would otherwise read like a layout bug.
      await expect(
        page.locator('nav[aria-label="Main navigation"]'),
        `${page_.name} did not render the dashboard shell (were they bounced to /login?)`,
      ).toBeVisible({ timeout: 12000 })

      // 2. No crash copy.
      const body = await page.locator('body').innerText()
      expect(body, `${page_.name} shows a crash message`).not.toMatch(
        /something went wrong|unexpected error|application error|unhandled/i,
      )

      // 3. No console errors.
      const bad = realErrors(errors)
      expect(bad, `${page_.name} logged console errors:\n  ${bad.join('\n  ')}`).toEqual([])
    })
  }


  // ── The three things the loop above cannot express ─────────────────────────────────────────────

  test('a customer is sent away from /app/admin', async ({ page }) => {
    await gotoAuthedAs(page, ROLE, '/app/admin')
    await page.waitForTimeout(1500)

    // AdminPage's own guard is `<Navigate to="/app" replace />` for a non-admin, so the URL is the
    // assertion. If this ever passes with the URL unchanged, the page is rendering platform data.
    expect(page.url(), 'a customer stayed on the admin route').not.toContain('/app/admin')
    const body = await page.locator('body').innerText()
    expect(body, 'admin content leaked to a customer').not.toMatch(
      /gross margin|platform intelligence|byok/i,
    )
  })

  test('Billing shows the numbers the API reports', async ({ page }) => {
    // The live version of the E3 class: the copy and the billing code must not disagree. Read the
    // API first, then assert the page agrees with it, so this cannot be satisfied by a stale constant.
    const { status, body: usage } = await jsonAs<any>(ROLE, '/api/billing/usage')
    expect(status, `the usage endpoint answered ${status}`).toBe(200)
    expect(usage?.plan, 'the usage endpoint returned no plan').toBeTruthy()

    await gotoAuthedAs(page, ROLE, '/app/billing')
    await page.waitForTimeout(2500)
    const body = await page.locator('body').innerText()

    // The plan label the page shows must be the plan the API reports, not a hardcoded string.
    const planLabel = usage.plan === 'free' ? 'Free' : usage.plan
    expect(body, `Billing does not show the plan the API reports (${usage.plan})`).toMatch(
      new RegExp(String(planLabel), 'i'),
    )

    if (typeof usage.credits_remaining === 'number') {
      expect(
        body,
        `Billing does not show the credit balance the API reports (${usage.credits_remaining})`,
      ).toContain(String(usage.credits_remaining))
    }
  })

  test('the Channels page lists only channels the caller owns', async ({ page }) => {
    const { body: listed } = await jsonAs<any>(ROLE, '/api/channels')
    const channels: any[] = Array.isArray(listed) ? listed : (listed?.channels || [])
    // `scope: "mine"` is the API's own statement about what it just returned.
    expect(listed?.scope ?? 'mine', 'the default channel listing was not scoped to the caller').toBe('mine')

    await gotoAuthedAs(page, ROLE, '/app/channels')

    if (channels.length === 0) {
      // The empty state is part of the open item, so assert it rather than skipping. Wait for it
      // rather than sleeping: the page shows skeletons until the query settles, and a fixed timeout
      // failed here first (the skeleton has no text, so the assertion simply saw nothing).
      await expect(
        page.getByText(/no channels connected/i).first(),
        'a customer with no channels never left the loading state',
      ).toBeVisible({ timeout: 25000 })
    } else {
      for (const ch of channels) {
        await expect(
          page.getByText(ch.slug, { exact: false }).first(),
          `the page is missing the caller's own channel ${ch.slug}`,
        ).toBeVisible({ timeout: 25000 })
      }
    }

    const body = await page.locator('body').innerText()

    // And nothing belonging to someone else.
    //
    // The admin's view is used only to learn the full set of slugs on the deployment -- the question
    // has to be asked from *this* caller's side. "A channel that is not the admin's" is not the same
    // as "a channel that is not this customer's", and the difference is exactly the caller's own
    // channels. Comparing the admin's `is_mine` demanded that the page hide the caller's own channel;
    // it only ever passed while `is_mine` was broken (always false, because the listing omitted
    // `user_id`) AND the caller owned nothing -- i.e. vacuously.
    if (hasRole('admin')) {
      const { body: all } = await jsonAs<any>('admin', '/api/channels?all=true')
      const allChannels: any[] = Array.isArray(all) ? all : (all?.channels || [])
      const owned = new Set(channels.map((c: any) => c.slug))
      const foreign = allChannels
        .map((c: any) => c.slug)
        .filter((slug: string) => slug && !owned.has(slug))

      // A slug can be a substring of another (`my` is inside `my-channel`), so remove the caller's
      // own channels from the text before looking for anyone else's.
      let text = body
      for (const slug of owned) text = text.split(slug).join('')

      for (const slug of foreign) {
        expect(text, `another account's channel (${slug}) is on this customer's page`).not.toContain(slug)
      }
    }
  })
})
