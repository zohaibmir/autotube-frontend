import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { build, createServer, loadEnv } from 'vite'
import { buildRobots, buildSitemap, resolveSiteConfig } from './site-config.mjs'
import { buildVercelConfig, htmlFile } from './vercel-output.mjs'
import { bundleReport } from './performance-budget.mjs'
import { generateBrandImages, generateSocialImage } from './social-images.mjs'

const { values: { mode } } = parseArgs({ options: { mode: { type: 'string', default: 'production' } } })
const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
const site = resolveSiteConfig(env)
// The SSR loader must not switch the subsequent client build to development.
process.env.NODE_ENV ??= 'production'
const server = await createServer({ mode, server: { middlewareMode: true, watch: null }, appType: 'custom' })
try {
  const { PUBLIC_PAGES } = await server.ssrLoadModule('/src/PublicRoutes.tsx')
  const consentBuild = await build({
    configFile: false,
    mode,
    logLevel: 'warn',
    build: {
      write: false,
      minify: 'terser',
      lib: { entry: path.resolve('src/consent-bootstrap.ts'), formats: ['iife'], name: 'VidoraConsent' },
    },
  })
  const consentOutputs = (Array.isArray(consentBuild) ? consentBuild : [consentBuild]).flatMap((result) => result.output ?? [])
  const bootstrap = consentOutputs.find((item) => item.type === 'chunk')
  if (!bootstrap || consentOutputs.length !== 1 || bootstrap.imports.length || bootstrap.dynamicImports.length) {
    throw new Error('Consent bootstrap must be one self-contained script.')
  }
  await build({ mode, plugins: [bundleReport(Boolean(env.VITE_SENTRY_DSN), PUBLIC_PAGES, bootstrap.code)] })
  const bundle = JSON.parse(await readFile('performance-results/bundle.json', 'utf8'))
  const entryFiles = new Set(bundle.chunks.map((chunk) => chunk.file))
  const template = (await readFile('dist/index.html', 'utf8'))
    .replace('<head>', `<head><script data-consent-bootstrap>${bootstrap.code.replaceAll('</script', '<\\/script')}</script>`)
    .replace('</head>', '<link rel="icon" type="image/png" sizes="48x48" href="/favicon.png" /></head>')
  const headMatch = template.match(/<head>([\s\S]*?)<\/head>/)
  if (!headMatch) throw new Error('Built HTML is missing its head.')
  const shellHead = headMatch[1].replace(/<title[^>]*>[\s\S]*?<\/title>/, '').replace(/<meta name="robots"[^>]*>/, '')
  await writeFile('dist/app-shell.html', template)
  const { PUBLIC_PATHS, renderPage } = await server.ssrLoadModule('/src/prerender.tsx')
  const { socialImagePath } = await server.ssrLoadModule('/src/lib/socialImages.ts')
  await generateBrandImages()
  const cards = []
  if (new Set(PUBLIC_PATHS).size !== PUBLIC_PATHS.length) throw new Error('Duplicate public SEO paths.')
  for (const route of [...PUBLIC_PATHS, '/404']) {
    if (!/^\/(?:[a-z0-9-]+\/?)*$/.test(route)) throw new Error(`Invalid public URL slug: ${route}`)
    const pageBundle = bundle.publicPages.find((page) => page.path === (route.startsWith('/blog/') ? '/blog/:slug' : route))
    if (!pageBundle && route !== '/404') throw new Error(`Missing public bundle: ${route}`)
    const preloads = (pageBundle?.chunks ?? []).filter((chunk) => !entryFiles.has(chunk.file))
      .map((chunk) => `<link rel="modulepreload" crossorigin href="/${chunk.file}">`).join('')
    const html = renderPage(route, shellHead + preloads)
    const file = path.join('dist', htmlFile(route))
    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, html)
    if (route !== '/404') {
      const title = html.match(/<title[^>]*>(.*?)<\/title>/)?.[1]
      if (!title) throw new Error(`Missing title for social image: ${route}`)
      cards.push(await generateSocialImage(path.join('dist', socialImagePath(route)), title))
    }
  }
  await writeFile('dist/sitemap.xml', buildSitemap(PUBLIC_PATHS, site))
  await writeFile('dist/robots.txt', buildRobots(site))
  await writeFile('performance-results/images.json', JSON.stringify(cards, null, 2))

  // Vercel's Build Output API preserves status codes and environment-specific headers.
  const output = path.resolve('.vercel/output')
  await rm(output, { recursive: true, force: true })
  await mkdir(output, { recursive: true })
  await cp('dist', path.join(output, 'static'), { recursive: true })
  await writeFile(path.join(output, 'config.json'), JSON.stringify(buildVercelConfig(PUBLIC_PATHS, site), null, 2))
  console.log(`Prerendered ${PUBLIC_PATHS.length} public pages and a 404. Indexing ${site.indexable ? `enabled for ${site.origin}` : 'disabled'}.`)
} finally {
  await server.close()
}
