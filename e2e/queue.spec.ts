/**
 * queue.spec.ts — Topic queue CRUD tests
 *
 * Tests:
 *   1. Queue page loads, shows pending items
 *   2. Add topic → appears in list
 *   3. Delete topic → it is removed from the list
 *   4. Queue count updates after add/delete
 *   5. Empty queue shows empty state
 *
 * The three write tests sit behind `E2E_CONFIRM_TARGET`, like every other mutating spec here.
 * They used not to, which made `.github/workflows/e2e.yml`'s "read-only by default" promise false: a
 * dispatch with `run_mutating: false` still added rows to the shared project's `topic_queue` and deleted
 * them again. The cost is not only stray rows when a test fails midway (the old cleanup helper was written
 * precisely because they accumulated) — a topic sitting in the queue *while it is due* can be claimed by the
 * scheduler and rendered for real, spending credits on a topic no human asked for.
 */
import { test, expect, Page } from '@playwright/test'
import { gotoAuthed, API_URL } from './helpers'

// Names the environment these tests may write to. Unset = the write tests skip.
const target = process.env.E2E_CONFIRM_TARGET
const WRITE_SKIP = 'Set E2E_CONFIRM_TARGET to the environment these write tests may use '
  + '(e.g. E2E_CONFIRM_TARGET=local). See E2E_TEST_PLAN.md §6.'

// Printed as well as annotated: the list reporter only shows "-N skipped", and a skip nobody notices is how a
// suite rots into decoration.
if (!target) {
  console.warn('[queue] the three write tests are SKIPPED — E2E_CONFIRM_TARGET is not set, so these specs '
    + 'have not been told which database they may write to.')
}

/**
 * Delete a pending topic by its exact text, using the page's own session token.
 *
 * This spec used to leave a topic behind on every run, which is how the queue grew
 * "Playwright test topic ..." rows indefinitely and eventually buried the assertions.
 */
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
    { topic, apiUrl: API_URL }
  )
}

test.describe('Queue', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/app/queue')
    await page.waitForTimeout(2000)
  })

  test('queue page loads without error', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/queue/)
    // Heading or title
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('existing queue items are displayed', async ({ page }) => {
    // Should show either queue rows (each has a Remove control) or an empty state
    const rows     = page.getByRole('button', { name: 'Remove from queue' })
    const empty    = page.getByText(/queue is empty/i)
    await expect(rows.first().or(empty)).toBeVisible({ timeout: 8000 })
  })

  test('can add a topic via UI form', async ({ page }) => {
    test.skip(!target, WRITE_SKIP)
    const topic = `Playwright ui-add ${Date.now()}`

    // Exact controls. The previous version guessed: it fell back to
    // `getByRole('button', { name: /\+/i }).first()` and submitted with
    // `/add|save|submit/i` matched `.last()`, either of which can land on the Bulk Add
    // path and add nothing — which is why this test passed and failed intermittently.
    await page.getByRole('button', { name: /^add topic$/i }).click()
    await page.getByPlaceholder(/topic or video title/i).fill(topic)
    await page.getByRole('button', { name: /^add$/i }).click()

    await expect(page.getByText(topic).first()).toBeVisible({ timeout: 10_000 })

    await removeByTopic(page, topic)
  })

  test('add topic via API then check it shows in UI', async ({ page }) => {
    test.skip(!target, WRITE_SKIP)
    const topic = `Playwright api-add ${Date.now()}`
    const token = await page.evaluate(() => localStorage.getItem('vidora_access_token'))

    await page.evaluate(
      async ({ topic, token, apiUrl }) => {
        await fetch(`${apiUrl}/api/queue/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ topic, channel_slug: null }),
        })
      },
      { topic, token, apiUrl: API_URL }
    )

    // Reload to see the new item
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(topic).first()).toBeVisible({ timeout: 10_000 })

    await removeByTopic(page, topic)
  })

  test('delete topic via API then verify it disappears', async ({ page }) => {
    test.skip(!target, WRITE_SKIP)
    const token = await page.evaluate(() => localStorage.getItem('vidora_access_token'))

    // Unique per run, and matched EXACTLY. The old version used the shared prefix "Delete test" and
    // deleted only the first match, so a run that failed part-way left its topic behind, the next run
    // deleted the leftover instead of its own, and the queue accumulated rows. That matters beyond
    // tidiness: this is the shared queue, and a topic sitting in it while it is due can be claimed by
    // the scheduler and RENDERED FOR REAL (`api.spec.ts`'s header says so too).
    const topic = `Delete test ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Add a topic
    await page.evaluate(
      async ({ topic, token, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ topic, channel_slug: null }),
        })
        return r.json()
      },
      { topic, token, apiUrl: API_URL }
    )

    // Get its ID
    const listResp = await page.evaluate(
      async ({ token, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/queue/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        return r.json()
      },
      { token, apiUrl: API_URL }
    )

    const item = listResp.items?.find((i: any) => i.topic === topic)
    expect(item, `the topic this run added ("${topic}") is not in the queue`).toBeTruthy()
    if (item) {
      await page.evaluate(
        async ({ id, token, apiUrl }) => {
          await fetch(`${apiUrl}/api/queue/delete/${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          })
        },
        { id: item.id, token, apiUrl: API_URL }
      )
    }
    // Verify cleanup worked — on this run's topic, so a leftover from an older run cannot mask it.
    const finalList = await page.evaluate(
      async ({ token, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/queue/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        return r.json()
      },
      { token, apiUrl: API_URL }
    )
    const stillExists = finalList.items?.some((i: any) => i.topic === topic)
    expect(stillExists).toBeFalsy()
  })
})
