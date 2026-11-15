import assert from 'node:assert/strict'
import test from 'node:test'
import { buildRobots, buildSitemap, resolveSiteConfig } from './site-config.mjs'
import { buildVercelConfig } from './vercel-output.mjs'

const origin = 'https://marketing.example'
const paths = ['/', '/pricing', '/blog/a-real-post', '/tools/seo-analyzer']

test('unconfigured and preview builds cannot advertise indexable URLs', () => {
  for (const env of [
    {},
    { VITE_MARKETING_ORIGIN: origin },
    { VITE_MARKETING_ORIGIN: origin, VITE_SITE_INDEXABLE: 'true', VERCEL_ENV: 'preview' },
    { VITE_MARKETING_ORIGIN: origin, VITE_SITE_INDEXABLE: 'true', VERCEL_ENV: 'development' },
  ]) {
    const site = resolveSiteConfig(env)
    assert.equal(site.indexable, false)
    assert.doesNotMatch(buildSitemap(paths, site), /<loc>/)
    assert.doesNotMatch(buildRobots(site), /Sitemap:/)
    assert.equal(buildVercelConfig(paths, site).routes[0].headers['X-Robots-Tag'], 'noindex, nofollow')
  }
})

test('indexing requires a validated canonical origin and explicit opt-in', () => {
  for (const value of [
    '', 'http://marketing.example', `${origin}/pricing`, `${origin}?x=1`,
    `${origin}#top`, 'https://name:password@marketing.example', 'https://localhost',
    'https://<new-domain>',
  ]) {
    assert.throws(() => resolveSiteConfig({ VITE_MARKETING_ORIGIN: value, VITE_SITE_INDEXABLE: 'true' }))
  }
  assert.throws(() => resolveSiteConfig({ VITE_SITE_INDEXABLE: 'yes' }))
  const site = resolveSiteConfig({ VITE_MARKETING_ORIGIN: `${origin}/`, VITE_SITE_INDEXABLE: 'true' })
  assert.equal(site.origin, origin)
  assert.equal(site.indexable, true)
  assert.deepEqual([...buildSitemap(paths, site).matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]), paths.map((path) => `${origin}${path}`))
  assert.match(buildRobots(site), new RegExp(`Sitemap: ${origin}/sitemap.xml`))
  assert.doesNotMatch(buildRobots(site), /Disallow:/)
})

test('Vercel separates known pages, private SPA paths, redirects and real 404s', () => {
  const site = resolveSiteConfig({ VITE_MARKETING_ORIGIN: origin, VITE_SITE_INDEXABLE: 'true' })
  const config = buildVercelConfig(paths, site)
  const sourceRoutes = config.routes.filter((route) => route.src)
  const terminal = (path) => sourceRoutes.find((route) => !route.continue && new RegExp(route.src).test(path))
  assert.equal(terminal('/pricing').dest, '/pricing.html')
  assert.equal(terminal('/blog/a-real-post').dest, '/blog/a-real-post.html')
  for (const path of ['/app', '/app/settings', '/login', '/signup', '/forgot-password', '/reset-password']) {
    assert.equal(terminal(path).dest, '/app-shell.html')
    assert.equal(terminal(path).headers['X-Robots-Tag'], 'noindex, nofollow')
  }
  for (const path of ['/missing', '/blog/missing', '/api/health', '/pricing-extra', '/appended']) {
    assert.equal(terminal(path).status, 404)
    assert.equal(terminal(path).dest, '/404.html')
  }
  for (const path of ['/pricing/', '/pricing.html']) {
    assert.equal(terminal(path).status, 308)
    assert.equal(terminal(path).headers.Location, '/pricing')
  }
  assert.equal(terminal('/index.html').headers.Location, '/')
  const recovery = terminal('/reset-password/')
  assert.equal('/reset-password/'.replace(new RegExp(recovery.src), recovery.headers.Location), '/reset-password')
  assert.deepEqual(config.routes[0].missing, [{ type: 'host', value: 'marketing.example' }])
  assert.equal(sourceRoutes.filter((route) => route.has?.[0].type === 'query').length, 2)
})
