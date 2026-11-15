import { gzipSync } from 'node:zlib'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

export const PERFORMANCE_BUDGETS = {
  initialBytes: 570_000,
  initialGzipBytes: 175_000,
  lcpMs: 2_500,
  cls: 0.1,
}

export function assertPerformanceBudgets(bundle, pages) {
  const failures = []
  function check(label, value, limit) {
    if (!Number.isFinite(value) || value < 0 || value > limit) failures.push(`${label}: ${value}; budget ${limit}`)
  }
  check('Initial JavaScript bytes', bundle.initialBytes, PERFORMANCE_BUDGETS.initialBytes)
  check('Initial JavaScript gzip bytes', bundle.initialGzipBytes, PERFORMANCE_BUDGETS.initialGzipBytes)
  if (!pages.length) failures.push('No Lighthouse pages were measured.')
  for (const page of pages) {
    check(`${page.route} lab LCP (ms)`, page.lcpMs, PERFORMANCE_BUDGETS.lcpMs)
    check(`${page.route} lab CLS`, page.cls, PERFORMANCE_BUDGETS.cls)
  }
  if (failures.length) throw new Error(`Performance budgets failed:\n${failures.join('\n')}`)
}

export function measureInitialJs(bundle, pageFiles = [], inlineJs = '') {
  const initial = new Set()
  function visit(file) {
    if (initial.has(file)) return
    const chunk = bundle[file]
    if (!chunk || chunk.type !== 'chunk') throw new Error(`Missing JavaScript chunk: ${file}`)
    initial.add(file)
    for (const dependency of chunk.imports) visit(dependency)
  }
  for (const chunk of Object.values(bundle)) {
    if (chunk.type === 'chunk' && chunk.isEntry) visit(chunk.fileName)
  }
  for (const file of pageFiles) visit(file)
  if (!initial.size) throw new Error('Build has no JavaScript entry.')
  const chunks = [...initial].map((file) => ({
    file,
    bytes: Buffer.byteLength(bundle[file].code),
    gzipBytes: gzipSync(bundle[file].code).length,
  }))
  const modules = [...initial].flatMap((file) => Object.entries(bundle[file].modules)
    .map(([id, module]) => ({ module: path.relative(process.cwd(), id), bytes: module.renderedLength })))
    .sort((a, b) => b.bytes - a.bytes)
  const inlineBytes = Buffer.byteLength(inlineJs)
  const inlineGzipBytes = inlineJs ? gzipSync(inlineJs).length : 0
  return {
    initialBytes: inlineBytes + chunks.reduce((total, chunk) => total + chunk.bytes, 0),
    initialGzipBytes: inlineGzipBytes + chunks.reduce((total, chunk) => total + chunk.gzipBytes, 0),
    inlineBytes,
    inlineGzipBytes,
    chunks,
    largestModules: modules.slice(0, 20),
  }
}

export function bundleReport(telemetryEnabled, pages, inlineJs = '') {
  return {
    name: 'initial-js-report',
    async generateBundle(_options, bundle) {
      const entry = measureInitialJs(bundle, [], inlineJs)
      const publicPages = pages.map((page) => {
        const chunk = Object.values(bundle).find((chunk) => chunk.type === 'chunk' && chunk.facadeModuleId?.endsWith(`/${page.source}`))
        if (!chunk) throw new Error(`Missing public-page chunk: ${page.source}`)
        return { path: page.path, ...measureInitialJs(bundle, [chunk.fileName], inlineJs) }
      })
      const largest = [...publicPages].sort((a, b) => b.initialGzipBytes - a.initialGzipBytes)[0]
      const report = {
        initialBytes: Math.max(...publicPages.map((page) => page.initialBytes)),
        initialGzipBytes: largest.initialGzipBytes,
        chunks: entry.chunks,
        entryBytes: entry.initialBytes,
        entryGzipBytes: entry.initialGzipBytes,
        inlineBytes: entry.inlineBytes,
        inlineGzipBytes: entry.inlineGzipBytes,
        largestModules: largest.largestModules,
        publicPages,
        telemetryEnabled,
        replayFiles: Object.values(bundle)
          .filter((chunk) => chunk.type === 'chunk' && Object.keys(chunk.modules).some((id) => id.includes('/@sentry/replay/')))
          .map((chunk) => chunk.fileName),
      }
      await mkdir('performance-results', { recursive: true })
      await writeFile('performance-results/bundle.json', JSON.stringify(report, null, 2))
      console.log(`Initial JS: ${report.initialBytes} bytes / ${report.initialGzipBytes} gzip bytes (including static imports).`)
    },
  }
}
