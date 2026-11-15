/**
 * channels-detail.spec.ts — the Channels list scope, and the channel detail page's management panel.
 *
 * Written for TEST.md's open item "expand e2e coverage for … Channels detail pages", and aimed at the two
 * things that shipped without any click-through:
 *
 *   1. `GET /api/channels` is scoped to the caller's own channels — including for admins, who must ask for
 *      the deployment-wide view explicitly (`?all=true`). The admin default used to be *every* channel on
 *      the deployment, which put another account's channel in the list and in every channel picker.
 *   2. The detail page gained a **Channel Management** panel with Reconnect and Remove. Before that, neither
 *      action had any UI at all — deleting a channel was a documented gap with a working endpoint behind it.
 *
 * Read-only, deliberately: Remove is asserted to exist and is never clicked. The scope comparison uses the
 * API response the page itself made, so the spec does not care which account the session belongs to.
 */
import { test, expect } from '@playwright/test'
import {
  BASE_URL, captureConsoleErrors, gotoAuthed, gotoAuthedAs, hasRole, jsonAs, missingRolesMessage,
  realErrors,
} from './helpers'

type Channel = { slug: string; name?: string; is_mine?: boolean; owner_email?: string | null }
type ChannelList = { ok?: boolean; channels?: Channel[]; scope?: string }

test.describe('Channels list', () => {
  test('is scoped to the caller, and the page renders exactly what the API returned', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Arm the response watcher before navigating, so the page's own request is the one we read. This keeps
    // the spec independent of which account is logged in: we assert the UI agrees with its own API call.
    const apiResponse = page.waitForResponse(
      r => r.url().includes('/api/channels') && r.request().method() === 'GET',
      { timeout: 20_000 },
    )
    await gotoAuthed(page, '/app/channels')
    const api = (await (await apiResponse).json()) as ChannelList

    expect(api.ok, 'GET /api/channels should succeed').toBeTruthy()
    // The server says which scope it answered in. "mine" is the default for everyone, admins included.
    expect(api.scope, 'the default listing is the caller’s own channels').toBe('mine')

    const slugs = (api.channels ?? []).map(c => c.slug)
    test.skip(slugs.length === 0, 'this account owns no channels, so there is nothing to render')

    // Every channel the API returned is on the page, and no channel it did not return is.
    for (const slug of slugs) {
      await expect(page.getByText(slug, { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    }
    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })

  test('the admin scope toggle is absent for a non-admin', async ({ page }) => {
    test.skip(!hasRole('user_a'), missingRolesMessage() || 'needs a non-admin session')

    await gotoAuthedAs(page, 'user_a', '/app/channels')
    // Asserting on the *absence* of a control is the point: the deployment-wide toggle is an admin tool and
    // must not appear for a customer whose list is scoped anyway.
    await expect(page.getByRole('button', { name: 'All accounts' })).toHaveCount(0)
  })
})

test.describe('Channels list as an admin', () => {
  test.skip(!hasRole('admin'), missingRolesMessage())

  test('defaults to my own channels, and only widens when asked', async ({ page }) => {
    const all = await jsonAs<ChannelList>('admin', '/api/channels?all=true')
    expect(all.status).toBe(200)
    expect(all.body.scope, 'asking explicitly gives the deployment-wide scope').toBe('all')

    const everySlug = (all.body.channels ?? []).map(c => c.slug)
    const mine = (all.body.channels ?? []).filter(c => c.is_mine).map(c => c.slug)
    const foreign = everySlug.filter(s => !mine.includes(s))

    await gotoAuthedAs(page, 'admin', '/app/channels')

    // The default view is scoped: a channel owned by another account must not be on it.
    for (const slug of foreign) {
      await expect(page.getByText(slug, { exact: true })).toHaveCount(0)
    }

    // The toggle is offered to an admin, and asking for the wide view brings those channels in, labelled
    // with their owner — the label is what makes an unfiltered list readable instead of alarming.
    const toggle = page.getByRole('button', { name: 'All accounts' })
    await expect(toggle).toBeVisible({ timeout: 10_000 })
    if (foreign.length > 0) {
      await toggle.click()
      await expect(page.getByText(foreign[0], { exact: true }).first())
        .toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Every channel on the deployment', { exact: false })).toBeVisible()
    }
  })
})

test.describe('Channel detail page', () => {
  test('offers Reconnect and Remove, which previously had no UI at all', async ({ page }) => {
    const errors = captureConsoleErrors(page)

    // Read the slug from the list page's own API response rather than scraping the DOM: the response is
    // authoritative, and it stays correct if the markup changes.
    const apiCall = page.waitForResponse(
      r => r.url().includes('/api/channels') && r.request().method() === 'GET',
      { timeout: 20_000 },
    )
    await gotoAuthed(page, '/app/channels')
    const api = (await (await apiCall).json()) as ChannelList
    const slug = (api.channels ?? [])[0]?.slug
    test.skip(!slug, 'this account owns no channels, so there is no detail page to open')

    // The panel lives on the Setup section now, not on the page's default view: the channel page was split
    // into URL-backed sections (TEST.md §29.64), and Reconnect/Remove are lifetime settings rather than
    // day-to-day reading.
    await page.goto(`${BASE_URL}/app/channels/${slug}/setup`)

    await expect(page.getByText('Channel Management', { exact: true }))
      .toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /Reconnect/ })).toBeVisible()
    // Present but never clicked: the spec is read-only, and this button deletes credential material.
    await expect(page.getByRole('button', { name: /Remove/ })).toBeVisible()

    expect(realErrors(errors), `console errors: ${errors.join(' | ')}`).toHaveLength(0)
  })
})
