/**
 * settings.spec.ts — Settings page tests
 *
 * Tests:
 *   1. Settings page loads with tabs
 *   2. API Keys tab shows service cards
 *   3. Notifications tab shows toggles
 *   4. Account tab shows profile info
 *   5. Voices tab shows voice list
 */
import { test, expect } from '@playwright/test'
import { gotoAuthed } from './helpers'

test.describe('Settings page', () => {
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/app/settings')
    await page.waitForTimeout(2500)
  })

  test('settings page loads and shows tabs', async ({ page }) => {
    await expect(page).toHaveURL(/\/app\/settings/)
    // Should have tab navigation
    const tabs = page.getByRole('tab')
    await expect(tabs.first()).toBeVisible()
    expect(await tabs.count()).toBeGreaterThan(1)
  })

  test('API Keys tab shows service cards', async ({ page }) => {
    await page.getByRole('tab', { name: 'API Keys', exact: true }).click()
    // Should show Anthropic at minimum
    await expect(page.locator('text=/anthropic/i').first()).toBeVisible({ timeout: 5000 })
  })

  test('Notifications tab shows toggles', async ({ page }) => {
    await page.getByRole('tab', { name: 'Notifications', exact: true }).click()
    const toggles = page.locator('[role="switch"], input[type="checkbox"]')
    await expect(toggles.first()).toBeAttached({ timeout: 5000 })
  })

  test('Account tab shows profile email', async ({ page }) => {
    await page.getByRole('tab', { name: 'Account', exact: true }).click()
    await expect(page.locator('text=/gmail\.com/').first()).toBeVisible({ timeout: 5000 })
  })

  test('Voices tab shows voice entries', async ({ page }) => {
    const voicesTab = page.getByRole('tab', { name: 'Voices', exact: true })
    await voicesTab.click()
    await expect(voicesTab).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('text=/edge tts|neural|voice/i').first()).toBeVisible({ timeout: 8000 })
  })

  test('every settings tab opens without crashing', async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (e) => pageErrors.push(e.message))
    const labels = ['API Keys', 'Voices', 'Social Accounts', 'Scheduler', 'Automation',
      'Integrations', 'Preferences', 'Notifications', 'Account']
    for (const label of labels) {
      const tab = page.getByRole('tab', { name: label, exact: true })
      await tab.click()
      await expect(tab).toHaveAttribute('aria-selected', 'true')
      await expect(page.getByText('Something went wrong')).toHaveCount(0)
    }
    expect(pageErrors).toHaveLength(0)
  })

  test('Preferences link switches to Notifications tab', async ({ page }) => {
    await page.getByRole('tab', { name: 'Preferences', exact: true }).click()
    await page.getByRole('button', { name: 'Settings → Notifications' }).click()
    await expect(page.getByRole('tab', { name: 'Notifications', exact: true }))
      .toHaveAttribute('aria-selected', 'true')
  })
})
