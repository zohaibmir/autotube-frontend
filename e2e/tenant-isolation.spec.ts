/**
 * Tenant isolation across four roles — the test that would have caught this
 * month's bugs (jobs written without an owner, the shorts listing walking every
 * directory, the calendar returning every tenant's queued topics).
 *
 * Two safety gates, both deliberate:
 *
 *   1. Every role must have credentials, or the file SKIPS with the command that
 *      provisions them. A silently-skipping isolation test is worse than none.
 *   2. `E2E_CONFIRM_TARGET` must name the environment being written to. The local
 *      `.env` points at production Supabase, and these specs create real rows, so
 *      mutating a database has to be an explicit act. See E2E_TEST_PLAN.md §6.
 *
 * Fixtures are namespace-prefixed (`e2e-<run>`) and created as tenant A only, so a
 * leftover row is findable. Nothing here spends credits: the queue and the
 * social-post log are metadata, not generation.
 */
import { test, expect } from '@playwright/test'
import {
  apiAs, findQueueId, gotoAuthedAs, hasRole, missingRolesMessage, missingTenants, BASE_URL,
} from './helpers'

// The three tenants are mandatory: an isolation test with one account proves nothing.
// The admin is optional — it only gates the one assertion that checks the admin is
// *not* handed other tenants' content, so requiring your real admin password to run
// the whole file would be a poor trade.
const missing = missingTenants()
const target = process.env.E2E_CONFIRM_TARGET

// Printed as well as annotated: the list reporter only shows "-N skipped", and a
// skip nobody notices is how an isolation suite rots into decoration.
if (missing.length) {
  console.warn(`[tenant-isolation] SKIPPED — ${missingRolesMessage()}`)
}
if (!target) {
  console.warn('[tenant-isolation] SKIPPED — E2E_CONFIRM_TARGET is not set, so these ' +
    'mutating specs have not been told which database they may write to.')
}

test.describe('tenant isolation (admin + 3 users)', () => {
  test.skip(missing.length > 0, missingRolesMessage())
  test.skip(!target,
    'Set E2E_CONFIRM_TARGET to the environment these mutating specs may write to ' +
    '(e.g. E2E_CONFIRM_TARGET=local). See E2E_TEST_PLAN.md §6.')

  const run           = `${Date.now().toString(36)}`
  const markerTopic   = `e2e-${run}-queue-a`
  const markerTopicB  = `e2e-${run}-queue-b`
  const markerTopicC  = `e2e-${run}-queue-c`
  const markerPostId  = `e2e-${run}-social-marker`
  const markerTitle   = `e2e ${run} social marker`
  const today         = new Date().toISOString().slice(0, 10)

  let queueTopicId: number | undefined
  let queueTopicIdB: number | undefined
  let queueTopicIdC: number | undefined

  test.beforeAll(async () => {
    console.log(`tenant-isolation writing to E2E_CONFIRM_TARGET=${target}`)

    const queued = await apiAs('user_a', '/api/queue/add', {
      method: 'POST',
      body: JSON.stringify({
        topic: markerTopic, type: 'Manual', scheduled_date: today,
      }),
    })
    expect(queued.status, `user_a could not enqueue a topic (HTTP ${queued.status})`)
      .toBeLessThan(400)
    // The add response carries no id (`{ok, added, pending, channel_slug}`), so ids are
    // resolved from the pending list instead -- guessing `body.id` is what silently
    // skipped cleanup and left e2e- rows behind on every earlier run.
    queueTopicId = await findQueueId('user_a', markerTopic)

    // Tenant B gets its own fixture on purpose. Without it "B cannot see A's item"
    // would also pass on an account that simply has nothing, which proves nothing
    // about filtering -- the classic vacuous isolation test.
    const queuedB = await apiAs('user_b', '/api/queue/add', {
      method: 'POST',
      body: JSON.stringify({
        topic: markerTopicB, type: 'Manual', scheduled_date: today,
      }),
    })
    expect(queuedB.status, `user_b could not enqueue a topic (HTTP ${queuedB.status})`)
      .toBeLessThan(400)
    queueTopicIdB = await findQueueId('user_b', markerTopicB)

    // C gets its own fixture for the same reason B does. C used to appear only as a
    // negative, so a scoping bug that handed C an *empty* queue would have satisfied
    // "C cannot see A's" while breaking the product for C.
    const queuedC = await apiAs('user_c', '/api/queue/add', {
      method: 'POST',
      body: JSON.stringify({
        topic: markerTopicC, type: 'Manual', scheduled_date: today,
      }),
    })
    expect(queuedC.status, `user_c could not enqueue a topic (HTTP ${queuedC.status})`)
      .toBeLessThan(400)
    queueTopicIdC = await findQueueId('user_c', markerTopicC)

    const logged = await apiAs('user_a', '/api/social/posts/log', {
      method: 'POST',
      body: JSON.stringify({
        platform: 'instagram', post_id: markerPostId, title: markerTitle,
        status: 'published',
      }),
    })
    expect(logged.status, `user_a could not log a social post (HTTP ${logged.status})`)
      .toBeLessThan(400)
  })

  test.afterAll(async () => {
    // Best effort: each row is deleted by the account that owns it. The fragile
    // `id === queueTopicId ? ... : ...` ternary this replaced would have deleted C's row
    // as B's the moment a third fixture existed.
    const owned: Array<{ id: number | undefined; role: 'user_a' | 'user_b' | 'user_c' }> = [
      { id: queueTopicId,  role: 'user_a' },
      { id: queueTopicIdB, role: 'user_b' },
      { id: queueTopicIdC, role: 'user_c' },
    ]
    for (const { id, role } of owned) {
      if (id !== undefined) {
        await apiAs(role, `/api/queue/delete/${id}`, { method: 'DELETE' })
          .catch(() => undefined)
      }
    }
  })

  test('tenant A sees its own queue item and social post', async () => {
    const queue = await (await apiAs('user_a', '/api/queue/pending')).text()
    expect(queue).toContain(markerTopic)

    const posts = await (await apiAs('user_a', '/api/social/posts')).text()
    expect(posts).toContain(markerPostId)
  })

  test('tenant B sees its own queue item and not A’s', async () => {
    // Both halves matter: B is non-empty, and the item it sees is its own.
    const body = await (await apiAs('user_b', '/api/queue/pending')).text()
    expect(body, "B cannot see its own queue item, so 'B cannot see A's' would be vacuous")
      .toContain(markerTopicB)
    expect(body).not.toContain(markerTopic)
  })

  test("tenant B never sees tenant A's queue item", async () => {
    const body = await (await apiAs('user_b', '/api/queue/pending')).text()
    expect(body).not.toContain(markerTopic)
  })

  test("tenant C never sees tenant A's queue item", async () => {
    const body = await (await apiAs('user_c', '/api/queue/pending')).text()
    expect(body).not.toContain(markerTopic)
  })

  test('tenant C sees its own queue item and not A’s', async () => {
    const body = await (await apiAs('user_c', '/api/queue/pending')).text()
    expect(body, "C cannot see its own queue item, so \"C cannot see A's\" would be vacuous")
      .toContain(markerTopicC)
    expect(body).not.toContain(markerTopic)
  })

  test("the admin's own queue does not contain a tenant's item", async () => {
    test.skip(!hasRole('admin'),
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set, so the admin view is not checked.')
    // Jobs are deliberately unfiltered for the admin (operational visibility, §28). The
    // queue is not: it is platform data keyed by user_id, and the tenancy decision is that
    // an account sees its own. Asserting it means that difference is recorded rather than
    // assumed -- if the queue is ever meant to be an admin-wide view, this is the test to
    // change, deliberately.
    const body = await (await apiAs('admin', '/api/queue/pending')).text()
    expect(body, "the admin's queue leaked a tenant's queued topic").not.toContain(markerTopic)
  })

  test("tenants B and C never see tenant A's social post", async () => {
    for (const role of ['user_b', 'user_c'] as const) {
      const body = await (await apiAs(role, '/api/social/posts')).text()
      expect(body, `${role} was served tenant A's social post`).not.toContain(markerPostId)
    }
  })

  test('content is strictly per-user: the admin is not served it either', async () => {
    test.skip(!hasRole('admin'),
      'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD are not set, so the admin view is not checked.')
    // The admin's *job* list is deliberately unfiltered (operational visibility),
    // but content is not: "each account should only ever see its own videos, posts
    // and analytics" was the tenancy decision. If that changes, this assertion is
    // the place to record it.
    const posts = await (await apiAs('admin', '/api/social/posts')).text()
    expect(posts).not.toContain(markerPostId)
  })

  test('UI: /app/social shows the marker to A and not to B', async ({ page }) => {
    await gotoAuthedAs(page, 'user_a', '/app/social')
    await expect(page.locator(`text=${markerTitle}`).first()).toBeVisible({ timeout: 10_000 })

    await gotoAuthedAs(page, 'user_b', '/app/social')
    await expect(page.locator(`text=${markerTitle}`)).toHaveCount(0)
  })

  test('UI: /app/queue shows the marker to A and not to B', async ({ page }) => {
    await gotoAuthedAs(page, 'user_a', '/app/queue')
    await expect(page.locator(`text=${markerTopic}`).first()).toBeVisible({ timeout: 10_000 })

    await gotoAuthedAs(page, 'user_b', '/app/queue')
    await expect(page.locator(`text=${markerTopic}`)).toHaveCount(0)
  })

  test('an unauthenticated visitor is redirected away from the app', async ({ page }) => {
    await page.goto(BASE_URL + '/app/jobs', { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(/login/)
  })
})
