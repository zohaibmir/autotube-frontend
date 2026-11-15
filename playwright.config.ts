import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Load `.env.local` (gitignored) before the specs read process.env.
 *
 * Test credentials are deliberately NOT hardcoded in the specs: those files are
 * tracked, and a committed password stays in git history forever. Workers
 * inherit this process's environment, so setting it here is enough.
 *
 * Dependency-free on purpose — Node's `--env-file` cannot be used from inside
 * the config file.
 */
function loadEnvLocal(): void {
  const path = fileURLToPath(new URL('.env.local', import.meta.url))
  let text: string
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return   // absent is fine — the specs fail loudly with a clear message
  }
  for (const line of text.split('\n')) {
    if (/^\s*#/.test(line)) continue
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1]
    if (process.env[key] !== undefined) continue    // real environment wins
    process.env[key] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
}

loadEnvLocal()

/**
 * Playwright E2E configuration for Vidora frontend.
 *
 * Prerequisites:
 *   cd frontend/app && npm install -D @playwright/test --legacy-peer-deps
 *   npx playwright install chromium
 *
 * Run all tests:    npx playwright test
 * Run one file:     npx playwright test e2e/auth.spec.ts
 * Run with UI:      npx playwright test --ui
 * Show report:      npx playwright show-report
 *
 * Requirements:
 *   - Backend running on http://localhost:8080
 *   - Frontend dev server running on http://localhost:5173
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local (gitignored; loaded
 *     automatically by this config). Never commit real credentials.
 */

const BASE_URL  = process.env.TEST_BASE_URL  || 'http://localhost:5173'
// `127.0.0.1`, not `localhost`, for the API. On macOS `localhost` resolves to `::1` first and uvicorn
// binds IPv4 only (`--host 127.0.0.1`), so a Node request can fail with
// `connect ECONNREFUSED ::1:8080` before falling back — which showed up as ~2 spurious suite failures
// per run. The literal address is unambiguous on every platform, and the browser half is unaffected
// either way. Must match `helpers.ts`'s default.
const API_URL   = process.env.TEST_API_URL   || 'http://127.0.0.1:8080'

export { BASE_URL, API_URL }

export default defineConfig({
  testDir: './e2e',
  // Raw HTML SEO tests run against the production build, not the dev SPA server.
  testIgnore: ['**/social-tags.spec.ts', '**/accessibility.spec.ts'],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,       // sequential — shared backend state
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never' }], ['list']],

  use: {
    baseURL: BASE_URL,
    headless: true,
    screenshot: 'only-on-failure',
    video:      'retain-on-failure',
    trace:      'retain-on-failure',
    actionTimeout:    12_000,
    navigationTimeout: 20_000,

    /**
     * Pre-record cookie consent in every context.
     *
     * `CookieBanner` renders a fixed dialog pinned to the bottom of the viewport
     * until `vidora_consent` exists in localStorage. It is correct behaviour, but it
     * silently swallowed clicks aimed at anything behind it, and three specs were
     * failing on a 12-second click timeout for no product reason (auth.spec two,
     * settings.spec one): the call log said "subtree intercepts pointer events".
     *
     * 'denied' on purpose — a test run must never opt itself into analytics. No spec
     * asserts the banner; if one ever does, it has to clear this key first. The
     * `version` here must match VERSION in src/lib/consent.ts, or the banner returns
     * when that constant is bumped.
     */
    storageState: {
      cookies: [],
      origins: [
        {
          origin: BASE_URL,
          localStorage: [
            {
              name: 'vidora_consent',
              value: JSON.stringify({
                version: 1,
                replay: 'denied',
                decidedAt: '2026-01-01T00:00:00.000Z',
              }),
            },
          ],
        },
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Start dev server automatically if not already running
  webServer: {
    command: 'npm run dev -- --port 5173',
    url: BASE_URL,
    reuseExistingServer: true,  // don't restart if already running
    timeout: 30_000,
  },
})
