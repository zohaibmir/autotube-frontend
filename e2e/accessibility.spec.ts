import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

const routing = JSON.parse(readFileSync('.vercel/output/config.json', 'utf8')) as {
  routes: Array<{ dest?: string; status?: number }>
}
const article = routing.routes.find((route) => route.dest?.startsWith('/blog/') && !route.status)?.dest?.replace(/\.html$/, '')
if (!article) throw new Error('No prerendered article available to audit.')
const allPaths = routing.routes.filter((route) => route.dest?.endsWith('.html') && !route.status && route.dest !== '/app-shell.html')
  .map((route) => route.dest === '/index.html' ? '/' : route.dest!.replace(/\.html$/, ''))
const paths = [
  '/', '/pricing', '/tools/seo-analyzer', '/how-it-works', '/contact', '/blog', article,
  '/cookies', '/about', '/faq', '/extension', '/extension/privacy', '/terms', '/privacy',
]

test.beforeEach(async ({ page }) => {
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
})

for (const path of allPaths) {
  test(`WCAG 2.2 AA automated checks: ${path}`, async ({ page }) => {
    await page.goto(path, { waitUntil: 'networkidle' })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    await test.info().attach('axe-results', { body: JSON.stringify(results), contentType: 'application/json' })
    expect(results.violations.map(({ id, nodes }) => ({ id, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) }))).toEqual([])
  })
}

test('analyzer results and errors remain accessible on mobile without live providers', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 812 })
  const video = {
    title: 'An example video for an offline accessibility test', title_len: 55, status: 'public',
    views: 12345, tags_count: 8, desc_len: 400, category: 'Education', language: 'en',
    duration_secs: 240, has_chapters: true, is_short: false, issues: [],
  }
  for (const response of [
    { status: 200, body: { ok: true, video_id: 'offline0001', score: 90, video } },
    { status: 200, body: { ok: true, video_id: 'offline0001', score: 50, video: { ...video, tags_count: 0, issues: ['Missing tags'] } } },
    { status: 429, body: { detail: 'Please wait before analyzing another video.' } },
    { status: 500, body: { detail: 'Analysis temporarily unavailable.' } },
  ]) {
    await page.route('**/api/public/seo-analyze', (route) => route.fulfill({ status: response.status, json: response.body }))
    await page.goto('/tools/seo-analyzer')
    await page.getByRole('textbox', { name: 'YouTube video URL' }).fill('https://www.youtube.com/watch?v=offline0001')
    await page.getByRole('button', { name: 'Analyze', exact: true }).click()
    if (response.status === 200) {
      await expect(page.getByText(video.title, { exact: true })).toBeVisible()
      await expect(page.locator('img')).toHaveAttribute('width', '480')
      await expect(page.locator('img')).toHaveAttribute('height', '360')
    } else {
      await expect(page.getByRole('alert')).toContainText(response.body.detail!)
    }
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    expect(audit.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.unroute('**/api/public/seo-analyze')
  }
})

test('contact form works with keyboard, exposes failures and distinguishes stored messages', async ({ page }) => {
  await page.route('**/api/contact', (route) => route.fulfill({ status: 503, json: { detail: 'Please try again later.' } }))
  await page.goto('/contact')
  const name = page.getByRole('textbox', { name: 'Name', exact: true })
  await name.focus()
  await expect(name).toBeFocused()
  expect(await name.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid')
  await name.fill('Offline Test')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeFocused()
  await page.keyboard.type('test@example.invalid')
  await page.getByRole('textbox', { name: 'Subject', exact: true }).fill('Accessibility test')
  await page.getByRole('textbox', { name: 'Message', exact: true }).fill('This message stays in the test browser.')
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('alert')).toContainText('Please try again later.')
  await page.unroute('**/api/contact')
  await page.route('**/api/contact', (route) => route.fulfill({ json: { ok: true, emailed: false } }))
  await page.getByRole('button', { name: 'Send message' }).click()
  await expect(page.getByRole('heading', { name: 'Message sent' })).toBeVisible()
  await expect(page.getByText(/We have recorded your message/)).toBeVisible()
  await expect(page.getByText(/within 24 hours/)).toHaveCount(0)
  const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
  expect(audit.violations.map(({ id }) => id)).toEqual([])
})

test('public templates and mobile navigation fit small screens and tablets', async ({ page }) => {
  test.setTimeout(90_000)
  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of paths) {
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${path} overflows at ${width}px`).toBe(true)
    }
    await page.goto('/')
    await page.getByRole('button', { name: 'Open navigation menu' }).click()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze()
    expect(results.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) })), `Open mobile menu at ${width}px`).toEqual([])
  }
})

test('mobile navigation supports keyboard dismissal and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/', { waitUntil: 'networkidle' })
  const toggle = page.getByRole('button', { name: 'Open navigation menu' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  const openToggle = page.getByRole('button', { name: 'Close navigation menu' })
  await expect(openToggle).toHaveAttribute('aria-controls', 'mobile-navigation')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('navigation', { name: 'Mobile', exact: true }).getByRole('link', { name: 'How it works' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('navigation', { name: 'Mobile', exact: true })).toHaveCount(0)
  await expect(toggle).toBeFocused()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
})
