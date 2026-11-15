import { writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'
import { buildRobots, buildSitemap, resolveSiteConfig } from './site-config.mjs'

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const site = resolveSiteConfig({ ...loadEnv(mode, process.cwd(), ''), ...process.env })
const server = await createServer({ mode, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { PUBLIC_PATHS } = await server.ssrLoadModule('/src/prerender.tsx')
  await writeFile('public/sitemap.xml', buildSitemap(PUBLIC_PATHS, site))
  await writeFile('public/robots.txt', buildRobots(site))
  console.log(site.indexable ? `Generated sitemap for ${PUBLIC_PATHS.length} public pages.` : 'Indexing disabled: generated empty sitemap and crawlable robots.txt.')
} finally {
  await server.close()
}
