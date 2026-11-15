import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { socialImagePath } from '../src/lib/socialImages'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { BLOG_POSTS, CATEGORIES, CONTENT_CLUSTERS, getRelatedPosts } from '../src/content/blogPosts'

const output = JSON.parse(readFileSync(resolve('.vercel/output/config.json'), 'utf8')) as {
  routes: Array<{ src?: string; dest?: string; status?: number; continue?: boolean }>
}
const publicRoutes = output.routes
  .filter((route) => route.dest?.endsWith('.html') && !route.status && route.dest !== '/app-shell.html')
  .map((route) => ({ path: route.src?.slice(1, -1), file: route.dest }))
const homeHtml = readFileSync(resolve('dist/index.html'), 'utf8')
const origin = homeHtml.match(/rel="canonical" href="([^"]+)"/)?.[1].replace(/\/$/, '') || ''
const enabled = /name="robots" content="index, follow"/.test(homeHtml)

test.beforeEach(async ({ page }) => {
  // These tests never contact provider APIs, font services, or the old domain.
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url())
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort()
  })
})

test('bundle report includes the scripts loaded by public templates', async ({ page }) => {
  const report = JSON.parse(readFileSync(resolve('performance-results/bundle.json'), 'utf8')) as {
    publicPages: Array<{ path: string; chunks: Array<{ file: string }> }>
    largestModules: Array<{ module: string }>
    chunks: Array<{ file: string }>
  }
  expect(report.largestModules.some((entry) => entry.module.endsWith('/react-dom-client.production.js'))).toBe(true)
  expect(report.largestModules.some((entry) => entry.module.endsWith('/react-dom-client.development.js'))).toBe(false)
  for (const path of ['/', '/pricing', `/blog/${BLOG_POSTS[0].slug}`]) {
    const scripts = new Set<string>()
    const record = (request: import('@playwright/test').Request) => {
      const url = new URL(request.url())
      if (url.hostname === '127.0.0.1' && url.pathname.endsWith('.js')) scripts.add(url.pathname.slice(1))
    }
    page.on('request', record)
    await page.goto(path)
    await expect(page.locator('h1')).toBeVisible()
    await page.waitForLoadState('networkidle')
    page.off('request', record)
    const template = report.publicPages.find((entry) => entry.path === (path.startsWith('/blog/') ? '/blog/:slug' : path))
    if (!template) throw new Error(`Missing bundle report for ${path}`)
    expect([...scripts].sort()).toEqual(template.chunks.map((chunk) => chunk.file).sort())
    const rawHtml = readFileSync(resolve(`dist/${path === '/' ? 'index' : path.slice(1)}.html`), 'utf8')
    for (const chunk of template.chunks.filter((chunk) => !report.chunks.some((entry) => entry.file === chunk.file))) {
      expect(rawHtml).toContain(`<link rel="modulepreload" crossorigin href="/${chunk.file}"`)
    }
  }
})

test('every public page has unique metadata, one H1, and valid local links in raw HTML', async ({ browser, request }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext({ javaScriptEnabled: false })
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  const titles = new Set<string>()
  const links = new Set<string>()
  const images = new Set<string>()
  try {
    for (const route of publicRoutes) {
      await page.goto(route.file!)
      const title = await page.title()
      expect(titles.has(title), `Duplicate title: ${title}`).toBe(false)
      titles.add(title)
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.getByRole('main')).toHaveCount(1)
      const levels = await page.locator('h1,h2,h3,h4,h5,h6').evaluateAll((headings) => headings.map((heading) => Number(heading.tagName.slice(1))))
      expect(levels[0]).toBe(1)
      for (let i = 1; i < levels.length; i++) expect(levels[i], `Skipped heading level on ${route.path}`).toBeLessThanOrEqual(levels[i - 1] + 1)
      await expect(page.locator('head title')).toHaveCount(1)
      await expect(page.locator('head meta[name="description"]')).toHaveCount(1)
      await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', title)
      await expect(page.locator('head meta[name="twitter:title"]')).toHaveAttribute('content', title)
      const imagePath = socialImagePath(route.path)
      await expect(page.locator('head meta[property="og:image"]')).toHaveAttribute('content', `${origin}${imagePath}`)
      await expect(page.locator('head meta[name="twitter:image"]')).toHaveAttribute('content', `${origin}${imagePath}`)
      const image = await request.get(imagePath)
      expect(image.status()).toBe(200)
      const bytes = await image.body()
      const size = await sharp(bytes).metadata()
      expect([size.width, size.height, size.format]).toEqual([1200, 630, 'png'])
      expect(bytes.length).toBeLessThanOrEqual(120_000)
      const digest = createHash('sha256').update(bytes).digest('hex')
      expect(images.has(digest), `Duplicate social image: ${route.path}`).toBe(false)
      images.add(digest)
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', enabled ? 'index, follow' : 'noindex, nofollow')
      if (origin) {
        await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', `${origin}${route.path}`)
      } else {
        await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
        await expect(page.locator('meta[property="og:url"]')).toHaveCount(0)
      }
      for (const href of await page.locator('a[href]').evaluateAll((elements) => elements.map((element) => element.getAttribute('href') || ''))) {
        if (href.startsWith('/') && !href.startsWith('//')) links.add(href.split(/[?#]/)[0])
      }
      const schema = []
      for (const json of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        expect(() => JSON.parse(json)).not.toThrow()
        schema.push(JSON.parse(json))
      }
      if (origin && route.path === '/') {
        const organization = schema.find((item) => item['@type'] === 'Organization')
        const website = schema.find((item) => item['@type'] === 'WebSite')
        expect(organization.url).toBe(`${origin}/`)
        expect(organization.legalName).toBeTruthy()
        expect(website.publisher['@id']).toBe(organization['@id'])
        expect((await request.get(new URL(organization.logo.url).pathname)).status()).toBe(200)
        const application = schema.find((item) => item['@type'] === 'SoftwareApplication')
        expect(application.offers.url).toBe(`${origin}/pricing`)
        expect(application.offers.description).toMatch(/one-time starter credits; paid plans available/)
      }
      if (origin && route.path?.startsWith('/blog/')) {
        const post = schema.find((item) => item['@type'] === 'BlogPosting')
        expect(post.image).toBe(`${origin}${imagePath}`)
        expect(post.publisher.logo.url).toBe(`${origin}/brand-logo.png`)
        expect(post.headline).toBe(await page.locator('h1').innerText())
        expect(post.author['@id']).toBe(post.publisher['@id'])
        await expect(page.getByText(`By ${post.author.name}`, { exact: false })).toBeVisible()
        const expected = BLOG_POSTS.find((item) => `/blog/${item.slug}` === route.path)!
        await expect(page.locator(`time[datetime="${post.datePublished}"]`).first()).toBeVisible()
        if (expected.dateModified) {
          expect(post.dateModified).toBe(expected.dateModified)
          await expect(page.locator(`time[datetime="${post.dateModified}"]`)).toBeVisible()
        } else expect(post).not.toHaveProperty('dateModified')
        for (const source of expected.sources ?? []) {
          await expect(page.getByRole('region', { name: 'References', exact: true })
            .getByRole('link', { name: source.label, exact: true })).toHaveAttribute('href', source.url)
        }
      }
    }
    const knownPaths = new Set([...publicRoutes.map((route) => route.path), '/login', '/signup', '/forgot-password', '/reset-password'])
    for (const href of links) expect(knownPaths.has(href) || href.startsWith('/app/'), `Broken internal link: ${href}`).toBe(true)
    const image = await request.get('/og-image.png')
    expect(image.status()).toBe(200)
    expect(image.headers()['content-type']).toContain('image/png')
    const favicon = await sharp(await (await request.get('/favicon.png')).body()).metadata()
    expect([favicon.width, favicon.height]).toEqual([48, 48])
  } finally {
    await context.close()
  }
})

test('curated guide clusters link supporting posts to an existing pillar', () => {
  const slugs = new Set(BLOG_POSTS.map((post) => post.slug))
  for (const cluster of CONTENT_CLUSTERS) {
    expect(slugs.has(cluster.pillar)).toBe(true)
    for (const slug of cluster.slugs) {
      expect(slugs.has(slug), `Unknown guide: ${slug}`).toBe(true)
      if (slug !== cluster.pillar) {
        const post = BLOG_POSTS.find((item) => item.slug === slug)!
        expect(getRelatedPosts(post).some((related) => related.slug === cluster.pillar)).toBe(true)
      }
    }
  }
})

test('blog index lists newest articles first and category filters retain their guide links', async ({ page }) => {
  await page.goto('/blog')
  const cards = page.locator('main a[href^="/blog/"]')
  const hrefs = await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href')))
  const sortedPosts = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))
  expect(hrefs).toEqual(sortedPosts.map((post) => `/blog/${post.slug}`))
  const dates = hrefs.map((href) => BLOG_POSTS.find((post) => href === `/blog/${post.slug}`)!.date)
  expect(dates).toEqual([...dates].sort().reverse())
  for (const category of CATEGORIES) {
    await page.getByRole('button', { name: category, exact: true }).click()
    const expected = BLOG_POSTS.filter((post) => post.category === category)
    await expect(cards).toHaveCount(expected.length)
    expect(new Set(await cards.evaluateAll((links) => links.map((link) => link.getAttribute('href')))))
      .toEqual(new Set(expected.map((post) => `/blog/${post.slug}`)))
  }
  await page.getByRole('button', { name: 'All', exact: true }).click()
  await expect(cards).toHaveCount(BLOG_POSTS.length)
  const newest = [...BLOG_POSTS].sort((a, b) => b.date.localeCompare(a.date))[0]
  await page.locator(`main a[href="/blog/${newest.slug}"]`).click()
  await expect(page.getByRole('heading', { name: newest.title, exact: true })).toBeVisible()
})

test('the dashboard retains query context after moving providers out of marketing', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, json: { detail: 'Offline regression test: data is unavailable.' } }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: {
    user_id: 'offline-user', email: 'test@example.invalid', plan: 'free', role: 'user',
  } }))
  await page.addInitScript(() => {
    localStorage.setItem('vidora_access_token', 'offline-test-token')
    localStorage.setItem('vidora_user', JSON.stringify({
      id: 'offline-user', email: 'test@example.invalid', name: 'Offline Test', plan: 'free',
      created_at: '2026-01-01T00:00:00Z',
    }))
  })
  const session = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/auth/me')
  await page.goto('/')
  expect((await session).status()).toBe(200)
  await page.evaluate(() => {
    history.pushState(null, '', '/app')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('link', { name: 'Queue', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Queue', exact: true }).click()
  await expect(page).toHaveURL(/\/app\/queue$/)
  expect(errors).toEqual([])
})

test('Replay is downloaded only after consent in a telemetry-configured build', async ({ page }) => {
  const bundle = JSON.parse(readFileSync('performance-results/bundle.json', 'utf8')) as {
    telemetryEnabled: boolean; replayFiles: string[]; chunks: Array<{ file: string }>
  }
  test.skip(!bundle.telemetryEnabled, 'Run against a build with a reserved test Sentry DSN.')
  expect(bundle.replayFiles.length).toBeGreaterThan(0)
  expect(bundle.chunks.some((chunk) => bundle.replayFiles.includes(chunk.file))).toBe(false)
  const requested = new Set<string>()
  page.on('request', (request) => requested.add(new URL(request.url()).pathname.slice(1)))
  await page.goto('/', { waitUntil: 'networkidle' })
  expect(bundle.replayFiles.some((file) => requested.has(file))).toBe(false)
  await page.getByRole('button', { name: 'Accept all', exact: true }).click()
  await expect.poll(() => bundle.replayFiles.some((file) => requested.has(file))).toBe(true)
})

for (const decision of ['unset', 'granted', 'denied', 'stale', 'malformed', 'unavailable']) {
  test(`consent is correct before hydration and remains stable: ${decision}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error' && /hydration|hydrating|Minified React error/.test(message.text())) errors.push(message.text())
    })
    await page.addInitScript((value) => {
      if (value === 'unset') return
      if (value === 'unavailable') {
        const getItem = Storage.prototype.getItem
        Storage.prototype.getItem = function (key) {
          if (key === 'vidora_consent') throw new DOMException('Storage blocked for offline test', 'SecurityError')
          return getItem.call(this, key)
        }
        return
      }
      localStorage.setItem('vidora_consent', value === 'malformed' ? '{invalid' : JSON.stringify({
        version: value === 'stale' ? 0 : 1,
        replay: value === 'granted' ? 'granted' : 'denied',
        decidedAt: '2026-01-01T00:00:00Z',
      }))
    }, decision)
    let releaseScripts!: () => void
    const scriptsReady = new Promise<void>((resolve) => { releaseScripts = resolve })
    await page.route('http://127.0.0.1:*/**/*.js', async (route) => {
      await scriptsReady
      await route.continue()
    })
    const banner = page.getByRole('dialog', { name: 'Cookies and stored data' })
    const decided = decision === 'granted' || decision === 'denied'
    try {
      await page.goto('/', { waitUntil: 'commit' })
      await expect(page.locator('[data-consent-banner]')).toHaveCount(1)
      await expect(page.locator('h1')).toBeVisible()
      if (decided) await expect(banner).toBeHidden()
      else await expect(banner).toBeVisible()
    } finally {
      releaseScripts()
    }
    await page.waitForLoadState('networkidle')
    if (decided) await expect(page.locator('[data-consent-banner]')).toHaveCount(0)
    else {
      await expect(banner).toBeVisible()
      await page.getByRole('button', { name: 'Essential only', exact: true }).click()
      if (decision === 'unavailable') await expect(banner).toBeVisible()
      else await expect(banner).toBeHidden()
    }
    await page.goto('/cookies')
    await page.getByRole('button', { name: 'Change my choice', exact: true }).click()
    await expect(banner).toBeVisible()
    expect(errors).toEqual([])
  })
}

test('hydration and client navigation replace metadata without stale tags', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydration|hydrating|Minified React error/.test(message.text())) errors.push(message.text())
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Essential only' }).click()
  for (const label of ['Pricing', 'Blog', 'About']) {
    await page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveTitle(new RegExp(`^${label} \\| Vidora$`))
    await expect(page.locator('head title')).toHaveCount(1)
    for (const selector of [
      'meta[name="description"]', 'meta[name="robots"]', 'meta[property="og:title"]',
      'meta[property="og:description"]', 'meta[property="og:image"]', 'meta[name="twitter:card"]',
    ]) {
      await expect(page.locator(`head ${selector}`)).toHaveCount(1)
    }
    await expect(page.locator('head meta[property="og:title"]')).toHaveAttribute('content', `${label} | Vidora`)
    if (origin) await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${origin}/${label.toLowerCase()}`)
  }
  await page.goto('/cookies')
  await expect(page.getByText('You have chosen essential only. Error replays are off. You can change this at any time.')).toBeVisible()
  expect(errors).toEqual([])
})

test('private shell and unknown blog URLs stay noindex without home canonicals', async ({ page, request }) => {
  const shell = await request.get('/app-shell.html')
  expect(await shell.text()).toContain('content="noindex, nofollow"')
  expect(await shell.text()).not.toContain('rel="canonical"')
  await page.goto('/')
  await page.getByRole('button', { name: 'Essential only' }).click()
  await page.evaluate(() => {
    history.pushState(null, '', '/blog/this-post-does-not-exist')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
  await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
})

test('sitemap and robots use only the configured, approved public origin', async ({ request }) => {
  const xml = await (await request.get('/sitemap.xml')).text()
  const robots = await (await request.get('/robots.txt')).text()
  const urls = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1])
  expect(urls).toEqual(enabled ? publicRoutes.map((route) => `${origin}${route.path}`) : [])
  expect(robots).not.toContain('Disallow:')
  expect(robots.includes('Sitemap:')).toBe(enabled)
  if (enabled) expect(robots).toContain(`Sitemap: ${origin}/sitemap.xml`)
})

test('every public route hydrates without errors in a non-UTC browser', async ({ browser }) => {
  test.setTimeout(90_000)
  const context = await browser.newContext({ timezoneId: 'America/Los_Angeles' })
  await context.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
  const page = await context.newPage()
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`))
  try {
    for (const route of publicRoutes) {
      await page.goto(route.path!, { waitUntil: 'networkidle' })
      await expect(page.locator('head title')).toHaveCount(1)
      await expect(page.locator('h1')).toHaveCount(1)
    }
    expect(errors).toEqual([])
  } finally {
    await context.close()
  }
})

test('key marketing pages fit narrow mobile viewports', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  for (const path of ['/', '/pricing', '/tools/seo-analyzer']) {
    await page.goto(path, { waitUntil: 'networkidle' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows on mobile`).toBe(true)
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    await expect(page.getByRole('navigation', { name: 'Mobile', exact: true })).toBeVisible()
  }
})

test('private routes load on demand and unauthenticated workspaces still redirect', async ({ page }) => {
  const scripts: string[] = []
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url())
  })
  await page.goto('/', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Essential only' }).click()
  expect(scripts.filter((url) => /\/(?:LoginPage|SignupPage|DashboardPage)-/.test(url))).toEqual([])
  await page.getByRole('link', { name: 'Sign in', exact: true }).click()
  await expect(page.locator('input[type="email"]')).toBeVisible()
  await expect(page.locator('input[type="password"]')).toBeVisible()
  expect(scripts.some((url) => /\/LoginPage-/.test(url))).toBe(true)
  for (const path of ['/signup', '/forgot-password', '/reset-password', '/app/settings']) {
    await page.evaluate((next) => {
      history.pushState(null, '', next)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
    if (path.startsWith('/app')) {
      await expect(page).toHaveURL(/\/login$/)
      await expect(page.locator('input[type="email"]')).toBeVisible()
    } else {
      const heading = path === '/signup' ? 'Create account' : path === '/forgot-password' ? 'Reset your password' : 'Link not valid'
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    }
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  }
})
