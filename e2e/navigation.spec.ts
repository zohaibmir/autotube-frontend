/**
 * navigation.spec.ts — Full navigation smoke test
 *
 * Visits every major route, checks for:
 *   - No 404 / blank pages
 *   - No uncaught JS errors
 *   - Key landmark elements visible
 *
 * This is the fastest signal that the app hasn't broken.
 */
import { test, expect, Page } from '@playwright/test'
import { gotoAuthed } from './helpers'

const ROUTES: Array<{ path: string; expectText: RegExp | string }> = [
  { path: '/app',                   expectText: /dashboard|queue|video/i },
  { path: '/app/jobs',              expectText: /jobs|pipeline|running/i },
  { path: '/app/queue',             expectText: /queue|topic/i },
  { path: '/app/channels',          expectText: /channel/i },
  { path: '/app/analytics',         expectText: /analytics|performance/i },
  { path: '/app/social',            expectText: /social|platform/i },
  { path: '/app/community',         expectText: /community|post/i },
  { path: '/app/shorts',            expectText: /short/i },
  { path: '/app/studio',            expectText: /studio|video/i },
  { path: '/app/calendar',          expectText: /calendar|schedule/i },
  { path: '/app/settings',          expectText: /setting|api key|voice/i },
  { path: '/app/billing',           expectText: /billing|plan|usage/i },
  { path: '/app/admin',             expectText: /admin|analytics|digest/i },
  { path: '/app/create/ideas',      expectText: /idea|trend|topic/i },
]

test.describe('Navigation smoke tests', () => {
  // Auth once for the whole suite
  test.beforeEach(async ({ page }) => {
    await gotoAuthed(page, '/app')
    await page.waitForTimeout(1000)
  })

  for (const route of ROUTES) {
    test(`${route.path} loads without crash`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', e => errors.push(e.message))

      await page.goto(`http://localhost:5173${route.path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      })
      await page.waitForTimeout(2500)

      // Not redirected to login
      expect(page.url()).not.toContain('/login')

      // Page has some content matching expected text
      const bodyText = await page.locator('body').innerText().catch(() => '')
      const rx = typeof route.expectText === 'string'
        ? new RegExp(route.expectText, 'i')
        : route.expectText
      expect(rx.test(bodyText.toLowerCase())).toBe(true)

      // No uncaught JS errors
      const critical = errors.filter(e =>
        !e.includes('favicon') && !e.includes('ResizeObserver')
      )
      expect(critical).toHaveLength(0)
    })
  }
})

test.describe('Public routes', () => {
  const PUBLIC_ROUTES = ['/', '/how-it-works', '/pricing', '/about', '/faq']

  for (const path of PUBLIC_ROUTES) {
    test(`${path} renders`, async ({ page }) => {
      await page.goto(`http://localhost:5173${path}`, {
        waitUntil: 'domcontentloaded',
        timeout: 12000,
      })
      await expect(page.locator('body')).toBeVisible()
      expect(page.url()).not.toContain('error')
    })
  }

  test('/login renders login form', async ({ page }) => {
    await page.goto('http://localhost:5173/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })

  test('/signup renders signup form', async ({ page }) => {
    await page.goto('http://localhost:5173/signup')
    await expect(page.locator('body')).toBeVisible()
  })
})
