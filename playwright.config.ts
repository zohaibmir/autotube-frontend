import { defineConfig, devices } from '@playwright/test'

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
 *   - TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.local OR set below
 */

const BASE_URL  = process.env.TEST_BASE_URL  || 'http://localhost:5173'
const API_URL   = process.env.TEST_API_URL   || 'http://localhost:8080'

export { BASE_URL, API_URL }

export default defineConfig({
  testDir: './e2e',
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
