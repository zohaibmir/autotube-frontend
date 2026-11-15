import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { assertPerformanceBudgets } from './performance-budget.mjs'

const run = promisify(execFile)
function median(values) {
  if (values.some((value) => !Number.isFinite(value))) throw new Error('Lighthouse returned an invalid metric.')
  return [...values].sort((a, b) => a - b)[1]
}

await mkdir('performance-results', { recursive: true })
const server = await preview({ preview: { host: '127.0.0.1', port: 4181, strictPort: true } })
const summaries = []
try {
  const routing = JSON.parse(await readFile('.vercel/output/config.json', 'utf8'))
  const article = routing.routes.find((route) => route.dest?.startsWith('/blog/') && !route.status)?.dest.replace(/\.html$/, '')
  if (!article) throw new Error('No prerendered article available to audit.')
  for (const route of ['/', '/pricing', '/tools/seo-analyzer', article]) {
    const runs = []
    for (let attempt = 1; attempt <= 3; attempt++) {
      const file = `performance-results/${route === '/' ? 'home' : route.slice(1).replaceAll('/', '-')}-run-${attempt}.json`
      await run(process.execPath, [
        'node_modules/lighthouse/cli/index.js', `http://127.0.0.1:4181${route}`,
        '--output=json', `--output-path=${file}`, '--only-categories=performance',
        '--chrome-flags=--headless --disable-dev-shm-usage --host-resolver-rules="MAP * ~NOTFOUND, EXCLUDE 127.0.0.1"',
        '--blocked-url-patterns=https://*', '--blocked-url-patterns=http://localhost:*',
        '--no-enable-error-reporting',
      ], { env: { ...process.env, CHROME_PATH: chromium.executablePath() }, maxBuffer: 5 * 1024 * 1024 })
      const report = JSON.parse(await readFile(file, 'utf8'))
      if (report.runtimeError) throw new Error(`${route}: ${report.runtimeError.message}`)
      if (report.categories.performance.score === null) throw new Error(`${route}: Lighthouse did not return a performance score.`)
      runs.push({
        score: report.categories.performance.score * 100,
        lcpMs: report.audits['largest-contentful-paint'].numericValue,
        cls: report.audits['cumulative-layout-shift'].numericValue,
        tbtMs: report.audits['total-blocking-time'].numericValue,
      })
    }
    const metrics = {
      route,
      score: median(runs.map((run) => run.score)),
      lcpMs: median(runs.map((run) => run.lcpMs)),
      cls: median(runs.map((run) => run.cls)),
      tbtMs: median(runs.map((run) => run.tbtMs)),
    }
    summaries.push(metrics)
    console.log(metrics)
  }
  await writeFile('performance-results/summary.json', JSON.stringify(summaries, null, 2))
  const bundle = JSON.parse(await readFile('performance-results/bundle.json', 'utf8'))
  assertPerformanceBudgets(bundle, summaries)
  console.log('Initial-JS and local mobile LCP/CLS budgets passed. Field INP/CWV are not measured by this audit.')
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))
}
