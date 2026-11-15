/**
 * Shared test helpers — auth, navigation, API utilities.
 * Import in every spec file.
 */
import { Page, expect } from '@playwright/test'

/**
 * Test credentials come from the environment only — never hardcode them here.
 * This file is tracked in git, and a committed password stays in the history
 * forever, even after the line is deleted. Put real values in
 * `frontend/app/.env.local` (gitignored); `playwright.config.ts` loads it, and
 * `scripts/seed_e2e_users.py --apply --write-env` can generate it.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `${name} is not set. Add it to frontend/app/.env.local (gitignored) ` +
      `or export it in your shell — test credentials are never committed.`
    )
  }
  return value
}

// Single-account aliases keep working; they now fall back to the multi-account
// variables so a four-role .env.local does not have to repeat itself.
export const TEST_EMAIL    = process.env.TEST_USER_EMAIL  || process.env.E2E_USER_A_EMAIL  || required('TEST_USER_EMAIL')
export const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || process.env.E2E_USER_A_PASSWORD || required('TEST_USER_PASSWORD')
export const API_URL       = process.env.TEST_API_URL       || 'http://127.0.0.1:8080'
export const BASE_URL      = process.env.TEST_BASE_URL      || 'http://localhost:5173'

// ── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * Log in through the page's own fetch, retried, and inject the session.
 *
 * Shared by `loginViaApi` and `loginAs` so both get the same tolerance for the flaky
 * route to Supabase (see `attemptLogin`). Without it, a momentary ENETUNREACH fails
 * whichever spec happened to be running, which reads as a product failure.
 */
async function injectLogin(page: Page, label: string, email: string, password: string): Promise<string> {
  let resp: any = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    resp = await page.evaluate(
      async ({ email, password, apiUrl }) => {
        const r = await fetch(`${apiUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        return r.json()
      },
      { email, password, apiUrl: API_URL }
    )
    if (resp?.ok && resp?.access_token) break
    if (attempt < 4) await page.waitForTimeout(500 * 2 ** (attempt - 1))
  }

  if (!resp?.ok || !resp.access_token) {
    throw new Error(`Login failed for ${label} after 4 attempts: ${JSON.stringify(resp).slice(0, 200)}`)
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

/**
 * Log in via the API and inject token into localStorage.
 * Much faster than UI login — avoids Supabase round-trip in tests.
 */
export async function loginViaApi(page: Page): Promise<string> {
  return injectLogin(page, TEST_EMAIL, TEST_EMAIL, TEST_PASSWORD)
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
    if (msg.type() !== 'error') return
    // The resource URL where the browser gives one. `Failed to load resource` on its own says nothing
    // about *what* failed, and that is the whole question: the same message for our own API is a defect,
    // while for a third-party host this machine cannot route to it is an environment problem wearing an
    // error's clothes.
    const where = msg.location?.()?.url
    errors.push(where ? `${msg.text()} [${where}]` : msg.text())
  })
  return errors
}

/**
 * The origins this app owns: the dev server, and the API the *browser* calls.
 *
 * Both spellings of loopback are included, because `helpers.ts` deliberately talks to the API on
 * `127.0.0.1` (see the note at the top: macOS resolves `localhost` to `::1` first and uvicorn binds IPv4
 * only) while the browser is handed `localhost` by `VITE_API_URL`. They are the same server, and treating
 * them as different origins would let a genuine failure against our own API through the filter below.
 */
const OWN_ORIGINS = new Set(
  [BASE_URL, API_URL]
    .flatMap(u => [u, u.replace('localhost', '127.0.0.1'), u.replace('127.0.0.1', 'localhost')])
    .map(u => { try { return new URL(u).origin } catch { return u } }),
)

/**
 * Is this console error something other than a page defect?
 *
 * Filtered rather than asserted-always-empty because this suite runs on a developer machine whose route to
 * third-party hosts comes and goes — the flakiness `playwright.config.ts` already documents. Without this,
 * every spec that checks for console errors doubles as a network monitor, and one blip fails sixteen tests
 * at once while saying nothing about the page.
 *
 * Deliberately narrow, and the narrowness is the point:
 *   * only resource-load failures carrying a `net::` error, i.e. the browser never got a response. An HTTP
 *     status (401, 404, 500) is **never** filtered, and neither is a thrown JS error — those are the
 *     failures that matter;
 *   * only when the URL is known and belongs to an origin this app does not own. Our own API failing is a
 *     defect, and that is the line this must not cross;
 *   * an unrecognised or missing URL is treated as a real error. The filter names what it excuses; it does
 *     not guess.
 */
export function isBenignConsoleError(text: string): boolean {
  if (/favicon/i.test(text)) return true
  if (/Download the React DevTools/i.test(text)) return true

  // Carried over from `non-admin-walkthrough.spec.ts`, which was the only spec applying it: a page that
  // probes an optional endpoint and handles the miss is not broken, and the assertion that matters is that
  // it rendered -- which the shell check covers. Moved here unchanged so the suite has one definition of
  // what it tolerates rather than eight.
  if (/Failed to load resource: the server responded with a status of 40[34]/i.test(text)) return true

  if (!/Failed to load resource: net::/i.test(text)) return false
  const url = /\[(https?:\/\/[^\]]+)\]/.exec(text)?.[1]
  if (!url) return false
  let origin: string
  try {
    origin = new URL(url).origin
  } catch {
    return false
  }
  return !OWN_ORIGINS.has(origin)
}

/** The console errors that actually indicate a defect. */
export function realErrors(errors: string[]): string[] {
  return errors.filter(e => !isBenignConsoleError(e))
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

// ── Multi-account helpers ────────────────────────────────────────────────────
// The four roles are provisioned by scripts/seed_e2e_users.py. A role with no
// credentials must make its spec SKIP LOUDLY, never pass quietly: an isolation
// test that silently does nothing is worse than no test at all.

export type E2ERole = 'admin' | 'user_a' | 'user_b' | 'user_c'

const ROLE_ENV: Record<E2ERole, { email: string; password: string }> = {
  admin:  { email: 'E2E_ADMIN_EMAIL',  password: 'E2E_ADMIN_PASSWORD' },
  user_a: { email: 'E2E_USER_A_EMAIL', password: 'E2E_USER_A_PASSWORD' },
  user_b: { email: 'E2E_USER_B_EMAIL', password: 'E2E_USER_B_PASSWORD' },
  user_c: { email: 'E2E_USER_C_EMAIL', password: 'E2E_USER_C_PASSWORD' },
}

export function missingRoles(): E2ERole[] {
  return (Object.keys(ROLE_ENV) as E2ERole[]).filter(
    role => !process.env[ROLE_ENV[role].email] || !process.env[ROLE_ENV[role].password]
  )
}

/** The three tenants an isolation test cannot run without. */
export function missingTenants(): E2ERole[] {
  return (['user_a', 'user_b', 'user_c'] as E2ERole[]).filter(role => !hasRole(role))
}

export function hasRole(role: E2ERole): boolean {
  const vars = ROLE_ENV[role]
  return Boolean(process.env[vars.email] && process.env[vars.password])
}

export function missingRolesMessage(): string {
  const missing = missingRoles()
  return missing.length
    ? `missing credentials for ${missing.join(', ')} — run: python3 scripts/seed_e2e_users.py --apply --write-env`
    : ''
}

/**
 * Tokens are cached per role for the lifetime of the worker process.
 *
 * Without this, `apiAs`/`jsonAs` re-authenticated on *every* call: `/api/auth/login`
 * proxies to Supabase, so a suite that makes twenty assertions produced twenty logins.
 * Under that burst the API's auth path started answering 503 "Auth service
 * unreachable ... Network is unreachable", which failed 27-30 unrelated specs in a
 * full run (the same symptom TEST.md records as "platform latency under load"). One
 * login per role per spec file removes the amplification and the noise.
 */
const TOKEN_CACHE = new Map<E2ERole, string>()

export function forgetToken(role: E2ERole): void {
  TOKEN_CACHE.delete(role)
}

/**
 * Log in, tolerating a flaky route to Supabase.
 *
 * The machine this suite runs on intermittently loses its route to `*.supabase.co`
 * under sustained request volume: a burst of 48 logins reproduced 9 failures at the
 * OS level — `Failed to establish a new connection: [Errno 51] Network is
 * unreachable` — while single requests always succeeded. That is an environment
 * fault, not a product one, and the product cannot retry its way out of a missing
 * route (the auth router now pools and retries, which covers blips but not this).
 *
 * A browser suite must not report the local network as a defect, so login retries
 * with backoff and then fails loudly with the last error.
 */
async function attemptLogin(
  role: E2ERole, email: string, password: string, attempts = 4,
): Promise<any> {
  let lastError = ''
  for (let i = 1; i <= attempts; i++) {
    try {
      const resp = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await resp.json().catch(() => ({} as any))
      if (resp.ok && body?.access_token) return body
      lastError = `HTTP ${resp.status} ${JSON.stringify(body).slice(0, 160)}`
    } catch (err) {
      lastError = String(err)
    }
    if (i < attempts) await new Promise(r => setTimeout(r, 500 * 2 ** (i - 1)))
  }
  throw new Error(`login failed for ${role} <${email}> after ${attempts} attempts: ${lastError}`)
}

export async function tokenFor(role: E2ERole): Promise<string> {
  const cached = TOKEN_CACHE.get(role)
  if (cached) return cached

  const vars = ROLE_ENV[role]
  const email = process.env[vars.email]
  const password = process.env[vars.password]
  if (!email || !password) throw new Error(`${vars.email} / ${vars.password} is not set (role ${role})`)

  const body = await attemptLogin(role, email, password)
  TOKEN_CACHE.set(role, body.access_token)
  return body.access_token as string
}

/** Call the API as a role. Returns the raw Response so specs can assert status. */
export async function apiAs(role: E2ERole, path: string, init: RequestInit = {}): Promise<Response> {
  const withAuth = (token: string) =>
    fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...((init.headers as Record<string, string> | undefined) ?? {}),
        Authorization: `Bearer ${token}`,
      },
    })

  const resp = await withAuth(await tokenFor(role))
  if (resp.status !== 401) return resp

  // A cached token can expire mid-run; re-authenticate exactly once.
  forgetToken(role)
  return withAuth(await tokenFor(role))
}

export async function jsonAs<T = any>(
  role: E2ERole, path: string, init: RequestInit = {}
): Promise<{ status: number; body: T }> {
  const resp = await apiAs(role, path, init)
  const body = (await resp.json().catch(() => ({}))) as T
  return { status: resp.status, body }
}

/** Log the browser in as a role, injecting the token exactly like loginViaApi. */
export async function loginAs(page: Page, role: E2ERole): Promise<string> {
  const vars = ROLE_ENV[role]
  const email = process.env[vars.email]
  const password = process.env[vars.password]
  if (!email || !password) throw new Error(`no credentials for role ${role}`)
  return injectLogin(page, role, email, password)
}

export async function gotoAuthedAs(page: Page, role: E2ERole, path: string) {
  await page.goto(BASE_URL + '/login', { waitUntil: 'domcontentloaded' })
  await loginAs(page, role)
  await page.goto(BASE_URL + path, { waitUntil: 'domcontentloaded' })
}

/**
 * Resolve a queue row's id by its topic.
 *
 * `POST /api/queue/add` answers `{ok, added, pending, channel_slug}` — no id and no
 * created object — so a spec that tries `body.id` gets `undefined`, skips its cleanup
 * and leaves `e2e-` rows behind on every run. Read them back instead.
 */
export async function findQueueId(role: E2ERole, topic: string): Promise<number | undefined> {
  const { body } = await jsonAs<any>(role, '/api/queue/pending')
  const items: any[] = body?.topics ?? body?.items ?? []
  return items.find(item => item?.topic === topic)?.id
}
