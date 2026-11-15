export function resolveSiteConfig(env) {
  const value = (env.VITE_MARKETING_ORIGIN || '').trim()
  const indexing = env.VITE_SITE_INDEXABLE || 'false'
  if (!['true', 'false'].includes(indexing)) {
    throw new Error('VITE_SITE_INDEXABLE must be true or false.')
  }

  let origin = ''
  if (value) {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash ||
      url.hostname === 'localhost' || /[<>]/.test(value)
    ) {
      throw new Error('VITE_MARKETING_ORIGIN must be an absolute HTTPS origin, without a path or credentials.')
    }
    origin = url.origin
  }
  if (indexing === 'true' && !origin) {
    throw new Error('Set VITE_MARKETING_ORIGIN before enabling VITE_SITE_INDEXABLE.')
  }

  return {
    origin,
    indexable: indexing === 'true' && env.VERCEL_ENV !== 'preview' && env.VERCEL_ENV !== 'development',
  }
}

export function buildSitemap(paths, config) {
  const entries = config.indexable
    ? paths.map((path) => `  <url><loc>${escapeXml(`${config.origin}${path}`)}</loc></url>`)
    : []
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

export function buildRobots(config) {
  return `User-agent: *\nAllow: /\n${config.indexable ? `\nSitemap: ${config.origin}/sitemap.xml\n` : ''}`
}

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
