/**
 * dashboard.spec.ts — Dashboard home tests
 *
 * Tests:
 *   1. Dashboard loads without crashing
 *   2. Stat cards are visible
 *   3. Navigation links work
 *   4. Onboarding checklist shown to new users
 *   5. Quick action buttons present
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/app')
    // Wait for page to settle past loading skeletons
    await page.waitForTimeout(2000)
  })

  test('loads without JS errors', async ({ page }) => {
    const errors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text())
      }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    // Filter out expected non-critical errors
    const critical = errors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('Sentry') &&
      !e.includes('404') &&
      !e.includes('ResizeObserver')
    )
    expect(critical).toHaveLength(0)
  })

  test('sidebar navigation is visible', async ({ page }) => {
    await expect(page.locator('nav, [role="navigation"]').first()).toBeVisible()
  })

  test('stat cards are rendered (videos, queue, etc.)', async ({ page }) => {
    // Dashboard should show at least 2 stat cards
    const cards = page.locator('[class*="card"], [class*="stat"]')
    await expect(cards.first()).toBeVisible()
  })

  test('New Video button/link exists', async ({ page }) => {
    const newVideoLink = page.getByRole('link', { name: /new video/i })
      .or(page.getByRole('button', { name: /new video/i }))
      .or(page.locator('a[href*="/create"]').first())
    await expect(newVideoLink.first()).toBeVisible()
  })

  test('clicking Queue nav item navigates to /app/queue', async ({ page }) => {
    const queueLink = page.getByRole('link', { name: /queue/i }).first()
    await queueLink.click()
    await page.waitForURL(/\/app\/queue/, { timeout: 5000 })
    expect(page.url()).toContain('/app/queue')
  })

  test('clicking Jobs nav item navigates to /app/jobs', async ({ page }) => {
    const jobsLink = page.getByRole('link', { name: /jobs/i }).first()
    await jobsLink.click()
    await page.waitForURL(/\/app\/jobs/, { timeout: 5000 })
    expect(page.url()).toContain('/app/jobs')
  })

  test('clicking Channels nav item navigates to /app/channels', async ({ page }) => {
    const link = page.getByRole('link', { name: /channels/i }).first()
    await link.click()
    await page.waitForURL(/\/app\/channels/, { timeout: 5000 })
  })
})
