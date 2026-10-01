// Generates public/sitemap.xml from the static marketing routes + every blog
// post slug in src/content/blogPosts.ts. Run automatically before build/dev
// (see package.json "predev"/"prebuild") so the sitemap can never silently
// drift out of sync with the actual blog content.
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SITE_URL = 'https://channelpilot.io'

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/how-it-works', priority: '0.8', changefreq: 'monthly' },
  { path: '/pricing', priority: '0.9', changefreq: 'monthly' },
  { path: '/about', priority: '0.5', changefreq: 'monthly' },
  { path: '/contact', priority: '0.4', changefreq: 'monthly' },
  { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  { path: '/blog', priority: '0.8', changefreq: 'weekly' },
  { path: '/tools/seo-analyzer', priority: '0.7', changefreq: 'monthly' },
]

function extractBlogSlugs() {
  const src = readFileSync(path.join(__dirname, '..', 'src', 'content', 'blogPosts.ts'), 'utf-8')
  const matches = [...src.matchAll(/slug:\s*'([^']+)'/g)]
  return matches.map((m) => m[1])
}

function buildUrlEntry(loc, priority, changefreq) {
  return `  <url>\n    <loc>${SITE_URL}${loc}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
}

function main() {
  const slugs = extractBlogSlugs()
  const entries = [
    ...STATIC_ROUTES.map((r) => buildUrlEntry(r.path, r.priority, r.changefreq)),
    ...slugs.map((slug) => buildUrlEntry(`/blog/${slug}`, '0.6', 'monthly')),
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`

  const outPath = path.join(__dirname, '..', 'public', 'sitemap.xml')
  writeFileSync(outPath, xml, 'utf-8')
  console.log(`Generated sitemap.xml with ${STATIC_ROUTES.length} static routes + ${slugs.length} blog posts.`)
}

main()
