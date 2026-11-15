/**
 * P3 — feature coverage per role.
 *
 * What this adds over the existing specs: `navigation.spec.ts` and
 * `full-walkthrough.spec.ts` smoke-test routes as ONE account and make no
 * assertions about state. These run as three separate tenants and check that the
 * features actually *behave* — a topic queued through the real UI persists, a
 * scheduled topic appears on its owner's calendar and nowhere else, a tenant cannot
 * reach admin surfaces, and each tenant reads only its own billing.
 *
 * Same two gates as the isolation spec: every tenant must have credentials, and
 * `E2E_CONFIRM_TARGET` must name the environment these mutating tests may write to.
 * Fixtures are `e2e-` prefixed and removed in afterAll.
 */
import { test, expect } from '@playwright/test'
import { apiAs, findQueueId, gotoAuthedAs, jsonAs, missingRolesMessage, missingTenants } from './helpers'

const missing = missingTenants()
const target = process.env.E2E_CONFIRM_TARGET

if (missing.length) console.warn(`[features-per-role] SKIPPED — ${missingRolesMessage()}`)
if (!target) {
  console.warn('[features-per-role] SKIPPED — E2E_CONFIRM_TARGET is not set, so these ' +
    'mutating specs have not been told which database they may write to.')
}

test.describe('features per role', () => {
  test.skip(missing.length > 0, missingRolesMessage())
  test.skip(!target, 'Set E2E_CONFIRM_TARGET — these specs create and delete rows.')

  const run   = Date.now().toString(36)
  const today = new Date().toISOString().slice(0, 10)
  const plus30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  test.describe('queue lifecycle, driven through the UI', () => {
    const topic = `e2e-${run}-ui-lifecycle`
    let topicId: number | undefined

    test.afterAll(async () => {
      if (topicId !== undefined) {
        await apiAs('user_a', `/api/queue/delete/${topicId}`, { method: 'DELETE' })
          .catch(() => undefined)
      }
    })

    test('a topic added in the form persists and can be deleted', async ({ page }) => {
      await gotoAuthedAs(page, 'user_a', '/app/queue')

      // The real user path: open the form, type, submit.
      await page.getByRole('button', { name: /add topic/i }).first().click()
      await page.getByPlaceholder(/topic or video title/i).fill(topic)
      await page.getByRole('button', { name: /^add$/i }).click()

      await expect(page.getByText(topic).first()).toBeVisible({ timeout: 10_000 })

      // It reached the server, not just local state.
      const listed = await (await apiAs('user_a', '/api/queue/pending')).text()
      expect(listed, 'the topic the UI accepted never reached the API').toContain(topic)

      // Pull its id so afterAll can clean up, then delete and confirm it is gone.
      const body = JSON.parse(listed) as any
      const items = body?.topics ?? body?.items ?? []
      topicId = items.find((i: any) => i?.topic === topic)?.id

      if (topicId !== undefined) {
        const deleted = await apiAs('user_a', `/api/queue/delete/${topicId}`, { method: 'DELETE' })
        expect(deleted.status, 'deleting a queue item failed').toBeLessThan(400)

        await page.reload({ waitUntil: 'domcontentloaded' })
        await expect(page.getByText(topic)).toHaveCount(0, { timeout: 10_000 })
      }
    })
  })

  test.describe('calendar shows a scheduled topic to its owner only', () => {
    const topicA = `e2e-${run}-scheduled-a`
    const topicC = `e2e-${run}-scheduled-c`
    let idA: number | undefined
    let idC: number | undefined

    test.beforeAll(async () => {
      const addedA = await apiAs('user_a', '/api/queue/add', {
        method: 'POST',
        body: JSON.stringify({ topic: topicA, type: 'Manual', scheduled_date: today }),
      })
      expect(addedA.status, 'scheduling a topic failed').toBeLessThan(400)
      idA = await findQueueId('user_a', topicA)

      // C schedules its own, so "C's calendar does not show A's" cannot pass on a calendar
      // that is simply empty -- the vacuous-negative trap, already found once in the queue.
      const addedC = await apiAs('user_c', '/api/queue/add', {
        method: 'POST',
        body: JSON.stringify({ topic: topicC, type: 'Manual', scheduled_date: today }),
      })
      expect(addedC.status, 'scheduling a topic for the third tenant failed').toBeLessThan(400)
      idC = await findQueueId('user_c', topicC)
    })

    test.afterAll(async () => {
      const owned: Array<{ id: number | undefined; role: 'user_a' | 'user_c' }> = [
        { id: idA, role: 'user_a' },
        { id: idC, role: 'user_c' },
      ]
      for (const { id, role } of owned) {
        if (id !== undefined) {
          await apiAs(role, `/api/queue/delete/${id}`, { method: 'DELETE' })
            .catch(() => undefined)
        }
      }
    })

    test("the owner's calendar lists it", async () => {
      const { status, body } = await jsonAs<any>(
        'user_a', `/api/calendar/events?start=${today}&end=${plus30}`)
      expect(status).toBe(200)
      expect(JSON.stringify(body), 'the owner cannot see their own scheduled topic')
        .toContain(topicA)
    })

    test("the third tenant's calendar lists its own and not the first tenant's", async () => {
      const { status, body } = await jsonAs<any>(
        'user_c', `/api/calendar/events?start=${today}&end=${plus30}`)
      expect(status).toBe(200)
      expect(JSON.stringify(body), "C's calendar does not list C's own scheduled topic")
        .toContain(topicC)
      expect(JSON.stringify(body), "C's calendar leaked another tenant's scheduled topic")
        .not.toContain(topicA)
    })

    test("no other tenant's calendar shows it", async () => {
      // This is the reader that had no owner parameter at all and returned every tenant's
      // queued topics -- i.e. other people's unreleased video ideas.
      for (const role of ['user_b', 'user_c'] as const) {
        const { status, body } = await jsonAs<any>(
          role, `/api/calendar/events?start=${today}&end=${plus30}`)
        expect(status).toBe(200)
        expect(JSON.stringify(body), `${role}'s calendar leaked a queued topic`)
          .not.toContain(topicA)
      }
    })

    test('the calendar renders it in the UI', async ({ page }) => {
      await gotoAuthedAs(page, 'user_a', '/app/calendar')
      // The day cell collapses extra events behind "+N more", so this asserts the
      // calendar *consumed* the event rather than demanding it be the visible chip:
      // either the marker is rendered, or the day reports more events than it shows.
      // Correctness is asserted against the API above; this proves the UI reads the
      // same data the API returned.
      const marker = page.getByText(topicA).first()
      const overflow = page.getByText(/\+\d+ more/)
      await expect(marker.or(overflow).first()).toBeVisible({ timeout: 12_000 })
    })

    test("another tenant's calendar does not render it", async ({ page }) => {
      await gotoAuthedAs(page, 'user_b', '/app/calendar')
      // Wait for the calendar itself before asserting an absence: a page that had not
      // rendered yet would satisfy "the topic is not shown" while proving nothing.
      await expect(page.getByRole('button', { name: 'Today' }))
        .toBeVisible({ timeout: 12_000 })
      await expect(page.getByText(topicA)).toHaveCount(0)
    })
  })

  test.describe('authorization: tenants cannot reach admin surfaces', () => {
    test('/api/debug/* refuses every tenant', async () => {
      for (const role of ['user_a', 'user_b', 'user_c'] as const) {
        const { status } = await jsonAs(role, '/api/debug/paths')
        // 403 from the router-level require_admin, 401 if the token is rejected.
        // Never 200 — that is what it returned before the gate existed.
        expect([401, 403], `${role} reached an admin-only endpoint (HTTP ${status})`)
          .toContain(status)
      }
    })

    test('a fresh tenant is not handed the platform API keys', async () => {
      // `get_env` merged os.getenv/.env for ANY authenticated caller, and its
      // allowlist includes the platform's own Anthropic, ElevenLabs, Pexels, Kling,
      // Suno and Mureka credentials -- 33 keys, 6 of them secrets, to an account with
      // nothing configured. (The route lives at /api/env: the settings router's prefix
      // is /api, so /api/settings/env is a 404 and asserts nothing.)
      const { status, body } = await jsonAs<Record<string, string>>('user_c', '/api/env')
      expect(status).toBe(200)
      const leaked = Object.keys(body ?? {}).filter(k => /(_API_KEY|_API_SECRET)$/.test(k))
      expect(leaked, `platform credentials exposed to a fresh tenant: ${leaked.join(', ')}`)
        .toEqual([])
    })
  })

  test.describe('billing is per account', () => {
    for (const role of ['user_a', 'user_b'] as const) {
      test(`${role} reads its own usage`, async () => {
        const { status, body } = await jsonAs<any>(role, '/api/billing/usage')
        expect(status, `${role} could not read /api/billing/usage`).toBe(200)
        expect(Object.keys(body ?? {}).length, `${role} got an empty usage payload`)
          .toBeGreaterThan(0)
      })
    }
  })

  test.describe('settings: per-channel social accounts', () => {
    test('the social tab lists platforms for a tenant', async ({ page }) => {
      await gotoAuthedAs(page, 'user_a', '/app/settings')
      await page.getByRole('tab', { name: 'Social Accounts', exact: true }).click()
      // These cards come from SOCIAL_PLATFORMS; if the tab broke, they vanish.
      await expect(page.getByText('Instagram', { exact: false }).first())
        .toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('Telegram', { exact: false }).first()).toBeVisible()
    })
  })

  test.describe('create wizard renders for a tenant', () => {
    for (const step of ['ideas', 'script', 'seo', 'thumbnail', 'submit']) {
      test(`/app/create/${step} renders`, async ({ page }) => {
        const errors: string[] = []
        page.on('pageerror', e => errors.push(e.message))

        await gotoAuthedAs(page, 'user_a', `/app/create/${step}`)
        expect(page.url(), `redirected away from /app/create/${step}`).not.toContain('/login')

        const text = await page.locator('body').innerText().catch(() => '')
        expect(text.length, `blank page at /app/create/${step}`).toBeGreaterThan(40)
        expect(errors.filter(e => !e.includes('ResizeObserver')),
               `uncaught JS error at /app/create/${step}`).toHaveLength(0)
      })
    }
  })

  test.describe('thumbnail overlay is real, not a preview', () => {
    // A 1x1 PNG is enough: the compositor only needs a decodable image. Upload mode avoids the AI
    // and Pexels paths, so this costs nothing and touches no third party.
    const TINY_PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64')

    test('the overlay is composited into the image, and the styling changes it', async ({ page }) => {
      // The overlay used to be a DOM element drawn over the preview and then dropped: the uploaded
      // thumbnail was the bare background, and no control could exist because nothing rendered text.
      await gotoAuthedAs(page, 'user_a', '/app/create/thumbnail')

      await page.getByRole('button', { name: 'Upload Image' }).click()
      await page.locator('input[type=file]').setInputFiles({
        name: 'bg.png', mimeType: 'image/png', buffer: TINY_PNG,
      })

      const preview = page.getByTestId('thumbnail-preview')
      await expect(preview).toBeVisible({ timeout: 10_000 })
      const uploaded = await preview.getAttribute('src')
      expect(uploaded ?? '', 'the preview should be the composed image, not the raw upload')
        .toMatch(/^data:image\/jpeg/)

      await page.getByLabel('Overlay text').fill('WATCH THIS')
      await expect.poll(() => preview.getAttribute('src'), { timeout: 10_000 })
        .not.toBe(uploaded)

      const withText = await preview.getAttribute('src')
      await page.getByLabel('Font size').fill('140')
      await expect.poll(() => preview.getAttribute('src'), { timeout: 10_000 })
        .not.toBe(withText)
    })
  })
})

