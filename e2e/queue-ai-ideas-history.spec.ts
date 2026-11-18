/**
 * queue-ai-ideas-history.spec.ts — Queue AI-ideas modal, History tab, dedup and bulk selection.
 *
 * Read-only coverage (always runs):
 *   1. the page exposes "AI Ideas" and a way to reach the History panel
 *   2. the AI Ideas modal opens with its generation controls
 *   3. the history endpoint returns a `total` (the "Load more" contract)
 *
 * Write coverage (behind E2E_CONFIRM_TARGET):
 *   4. re-adding the same topic is skipped by the dedup guard
 *   5. bulk selection deletes exactly the topics that were checked
 *
 * The write tests are latched exactly like queue.spec.ts: without E2E_CONFIRM_TARGET they
 * skip, so a default e2e dispatch stays read-only against the shared project's `topic_queue`.
 * Deliberate safety choice: the "Select all" control is asserted to exist but never clicked,
 * because "select all → delete" would remove every pending topic it happens to share a
 * project with — the one action this suite must never perform on a shared queue.
 */
import { test, expect, Page } from '@playwright/test'
import { gotoAuthed, API_URL } from './helpers'

// Names the environment these tests may write to. Unset = the write tests skip.
const target = process.env.E2E_CONFIRM_TARGET
const WRITE_SKIP = 'Set E2E_CONFIRM_TARGET to the environment these write tests may use '
  + '(e.g. E2E_CONFIRM_TARGET=local). See E2E_TEST_PLAN.md §6.'

if (!target) {
  console.warn('[queue-ai-history] the two write tests are SKIPPED — E2E_CONFIRM_TARGET is not set, '
    + 'so these specs have not been told which database they may write to.')
}

/** Add a pending topic through the page's own session, returning the API response body. */
async function addTopicViaApi(page: Page, topic: string): Promise<any> {
  return page.evaluate(
    async ({ topic, apiUrl }) => {
      const token = localStorage.getItem('vidora_access_token')
      const r = await fetch(`${apiUrl}/api/queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topic, channel_slug: null }),
      })
      return r.json()
    },
    { topic, apiUrl: API_URL },
  )
}

/** Delete every pending topic matching the exact text (cleanup, idempotent). */
async function removeByTopic(page: Page, topic: string): Promise<void> {
  await page.evaluate(
    async ({ topic, apiUrl }) => {
      const token = localStorage.getItem('vidora_access_token')
      const list = await fetch(`${apiUrl}/api/queue/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.json())
      for (const item of list.items ?? []) {
        if (item.topic === topic) {
          await fetch(`${apiUrl}/api/queue/delete/${item.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        }
      }
    },
    { topic, apiUrl: API_URL },
  )
}

test.describe('Queue — AI ideas, history, bulk', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/app/queue')
  })

  test('exposes AI Ideas and a way into History', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'AI Ideas' })).toBeVisible()

    // Empty queues render "View history"; non-empty ones render a History tab. Both land
    // on the same History panel, whose search input is the stable marker of success.
    const historyTab = page.getByRole('button', { name: 'History' })
    if (await historyTab.count()) {
      await historyTab.click()
    } else {
      await page.getByRole('button', { name: /View history/i }).first().click()
    }
    await expect(page.getByPlaceholder('Search topics…')).toBeVisible()
    await expect(page.getByRole('button', { name: /Clear history/i })).toBeVisible()
  })

  test('AI Ideas modal opens with generation controls', async ({ page }) => {
    await page.getByRole('button', { name: 'AI Ideas' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('button', { name: /Generate ideas/i })).toBeVisible()
    await expect(page.getByPlaceholder(/mysteries of the deep ocean/i)).toBeVisible()
  })

  test('history endpoint returns a total for the Load-more control', async ({ page }) => {
    const res = await page.evaluate(async ({ apiUrl }) => {
      const token = localStorage.getItem('vidora_access_token')
      const r = await fetch(`${apiUrl}/api/queue/history?limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      return r.json()
    }, { apiUrl: API_URL })

    expect(typeof res.total).toBe('number')
    expect(Array.isArray(res.items)).toBe(true)
  })

  test('re-adding the same topic is skipped by dedup', async ({ page }) => {
    test.skip(!target, WRITE_SKIP)
    const topic = `Playwright dedup ${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const first = await addTopicViaApi(page, topic)
    expect(first?.added, JSON.stringify(first)).toBe(1)

    const second = await addTopicViaApi(page, topic)
    expect(second?.duplicate, JSON.stringify(second)).toBe(true)
    expect(second?.added ?? 1, JSON.stringify(second)).toBe(0)

    await removeByTopic(page, topic)
  })

  test('bulk selection deletes only the checked topics', async ({ page }) => {
    test.skip(!target, WRITE_SKIP)
    const topics = [
      `Playwright bulk-1 ${Date.now()}`,
      `Playwright bulk-2 ${Date.now()}`,
      `Playwright bulk-3 ${Date.now()}`,
    ]
    for (const topic of topics) {
      await addTopicViaApi(page, topic)
    }
    await page.reload({ waitUntil: 'domcontentloaded' })

    // Enter selection mode on the now-non-empty queue.
    await page.getByRole('button', { name: 'Select' }).click()
    await expect(page.getByText('0 selected')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Select all' })).toBeVisible()

    // Check only this run's three rows — never "Select all" on a shared queue.
    for (const topic of topics) {
      const row = page.locator('div.group', { hasText: topic }).first()
      await row.getByRole('button', { name: 'Select topic' }).click()
    }
    await expect(page.getByText('3 selected')).toBeVisible()

    await page.getByRole('button', { name: 'Delete selected' }).click()
    await expect(page.getByRole('button', { name: 'Delete selected' })).toHaveCount(0)

    for (const topic of topics) {
      await expect(page.getByText(topic)).toHaveCount(0)
    }
  })
})