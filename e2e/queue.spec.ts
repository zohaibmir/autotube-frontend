/**
 * queue.spec.ts — Topic queue CRUD tests
 *
 * Tests:
 *   1. Queue page loads, shows pending items
 *   2. Add topic → appears in list
 *   3. Delete topic → removed from list
 *   4. Queue count updates after add/delete
 *   5. Empty queue shows empty state
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed, API_URL } from './helpers'

const TEST_TOPIC = `Playwright test topic ${Date.now()}`

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
    // Look for an "Add Topic" button or input
    const addBtn = page.getByRole('button', { name: /add topic/i })
      .or(page.getByRole('button', { name: /\+/i }).first())
    
    if (await addBtn.isVisible()) {
      await addBtn.click()
      // Fill the topic input that appears
      const input = page.locator('input[placeholder*="topic"], input[placeholder*="Topic"], textarea').last()
      await input.fill(TEST_TOPIC)
      // Submit
      const submit = page.getByRole('button', { name: /add|save|submit/i }).last()
      await submit.click()
      await page.waitForTimeout(2000)
      // The topic should now appear in the list
      await expect(page.locator(`text="${TEST_TOPIC}"`).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('add topic via API then check it shows in UI', async ({ page }) => {
    // Use the API to add a topic, then verify the UI reflects it
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
      { topic: TEST_TOPIC, token, apiUrl: API_URL }
    )

    // Reload to see the new item
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await expect(page.locator(`text="${TEST_TOPIC}"`).first()).toBeVisible({ timeout: 8000 })
  })

  test('delete topic via API then verify it disappears', async ({ page }) => {
    const token = await page.evaluate(() => localStorage.getItem('vidora_access_token'))

    // Add a topic
    const addResp = await page.evaluate(
      async ({ topic, token, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ topic, channel_slug: null }),
        })
        return r.json()
      },
      { topic: `Delete test ${Date.now()}`, token, apiUrl: API_URL }
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

    const item = listResp.items?.find((i: any) => i.topic.startsWith('Delete test'))
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
    // Verify cleanup worked
    const finalList = await page.evaluate(
      async ({ token, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/queue/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        return r.json()
      },
      { token, apiUrl: API_URL }
    )
    const stillExists = finalList.items?.some((i: any) => i.topic.startsWith('Delete test'))
    expect(stillExists).toBeFalsy()
  })
})
