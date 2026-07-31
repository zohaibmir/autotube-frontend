/**
 * Shared test helpers — auth, navigation, API utilities.
 * Import in every spec file.
 */
import { Page, expect } from '@playwright/test'

export const TEST_EMAIL    = process.env.TEST_USER_EMAIL    || 'zohaib.mir@gmail.com'
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'mir.mir1121'
export const API_URL       = process.env.TEST_API_URL       || 'http://localhost:8080'
export const BASE_URL      = process.env.TEST_BASE_URL      || 'http://localhost:5173'

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Log in via the API and inject token into localStorage.
 * Much faster than UI login — avoids Supabase round-trip in tests.
 */
export async function loginViaApi(page: Page): Promise<string> {
  const resp = await page.evaluate(
    async ({ email, password, apiUrl }) => {
      const r = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      return r.json()
    },
    { email: TEST_EMAIL, password: TEST_PASSWORD, apiUrl: API_URL }
  )

  if (!resp.ok || !resp.access_token) {
    throw new Error(`Login failed: ${JSON.stringify(resp)}`)
  }

  await page.evaluate(
    ({ access, refresh, user }) => {
      localStorage.setItem('vidora_access_token',  access)
      localStorage.setItem('vidora_refresh_token', refresh)
      localStorage.setItem('vidora_user', JSON.stringify(user))
    },
    {
      access:  resp.access_token,
      refresh: resp.refresh_token,
      user: {
        id:         resp.user.id,
        email:      resp.user.email,
        name:       resp.user.name || resp.user.email,
        plan:       'free',
        created_at: new Date().toISOString(),
      },
    }
  )

  return resp.access_token
}

/** Navigate to a protected route, injecting auth first. */
export async function gotoAuthed(page: Page, path: string) {
  // Open any page to get an origin we can run JS on
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' })
  await loginViaApi(page)
  await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded' })
}

/** Assert no console errors during test. */
export function captureConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return errors
}

/** Wait for a toast/status message containing text. */
export async function expectToast(page: Page, text: string) {
  await expect(page.locator(`text=${text}`).first()).toBeVisible({ timeout: 6000 })
}

/** Wait for the page title to settle (not "Loading"). */
export async function waitForPageLoad(page: Page) {
  await page.waitForFunction(
    () => !document.title.startsWith('Loading'),
    { timeout: 8000 }
  )
}
