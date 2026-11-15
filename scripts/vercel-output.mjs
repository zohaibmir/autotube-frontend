const NOINDEX = { 'X-Robots-Tag': 'noindex, nofollow' }

export function htmlFile(path) {
  return path === '/' ? 'index.html' : `${path.slice(1)}.html`
}

export function buildVercelConfig(paths, site) {
  const routes = []
  if (!site.indexable) {
    routes.push({ src: '^/(.*)$', headers: NOINDEX, continue: true })
  } else {
    routes.push({
      src: '^/(.*)$',
      missing: [{ type: 'host', value: new URL(site.origin).hostname }],
      headers: NOINDEX,
      continue: true,
    })
  }
  routes.push(
    { src: '^/(?:app(?:/.*)?|login|signup|forgot-password|reset-password|app-shell\\.html)$', headers: NOINDEX, continue: true },
    { src: '^/tools/seo-analyzer$', has: [{ type: 'query', key: 'url' }], headers: NOINDEX, continue: true },
    { src: '^/tools/seo-analyzer$', has: [{ type: 'query', key: 'v' }], headers: NOINDEX, continue: true },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
  )
  for (const path of paths) {
    const file = `/${htmlFile(path)}`
    routes.push({ src: `^${escapeRegex(file)}$`, headers: { Location: path }, status: 308 })
    if (path !== '/') routes.push({ src: `^${escapeRegex(path)}/$`, headers: { Location: path }, status: 308 })
    routes.push({ src: `^${escapeRegex(path)}$`, dest: file })
  }
  routes.push(
    { src: '^/(login|signup|forgot-password|reset-password)/$', headers: { Location: '/$1' }, status: 308 },
    { src: '^/(?:app(?:/.*)?|login|signup|forgot-password|reset-password)$', dest: '/app-shell.html', headers: NOINDEX },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/404.html', status: 404, headers: NOINDEX },
  )
  return { version: 3, routes }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
