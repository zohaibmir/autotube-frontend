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
    const tabs = page.locator('[role="tab"], button[class*="tab"]')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThan(1)
  })

  test('API Keys tab shows service cards', async ({ page }) => {
    // Click the API Keys tab
    const apiKeysTab = page.getByRole('tab', { name: /api keys/i })
      .or(page.getByRole('button', { name: /api keys/i }))
    
    if (await apiKeysTab.isVisible()) {
      await apiKeysTab.click()
      await page.waitForTimeout(1000)
    }
    // Should show Anthropic at minimum
    await expect(page.locator('text=/anthropic/i').first()).toBeVisible({ timeout: 5000 })
  })

  test('Notifications tab shows toggles', async ({ page }) => {
    const notifTab = page.getByRole('tab', { name: /notification/i })
      .or(page.getByRole('button', { name: /notification/i }))
    
    if (await notifTab.isVisible()) {
      await notifTab.click()
      await page.waitForTimeout(1000)
      // Should show toggle for job completion
      const toggles = page.locator('[role="switch"], input[type="checkbox"]')
      const count = await toggles.count()
      expect(count).toBeGreaterThan(0)
    }
  })

  test('Account tab shows profile email', async ({ page }) => {
    const accountTab = page.getByRole('tab', { name: /account/i })
      .or(page.getByRole('button', { name: /account/i }))
    
    if (await accountTab.isVisible()) {
      await accountTab.click()
      await page.waitForTimeout(1500)
      // Should show the logged-in email
      await expect(page.locator('text=/gmail\.com/').first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('Voices tab shows voice entries', async ({ page }) => {
    const voicesTab = page.getByRole('tab', { name: /voice/i })
      .or(page.getByRole('button', { name: /voice/i }))
    
    if (await voicesTab.isVisible()) {
      await voicesTab.click()
      await page.waitForTimeout(2000)
      // Should list voices
      const voices = page.locator('[class*="voice"], text=/edge tts/i').first()
      await expect(voices).toBeVisible({ timeout: 5000 })
    }
  })
})
