import assert from 'node:assert/strict'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { assertPerformanceBudgets, measureInitialJs, PERFORMANCE_BUDGETS } from './performance-budget.mjs'

function chunk(fileName, code, imports = [], isEntry = false) {
  return { type: 'chunk', fileName, code, imports, isEntry, modules: {} }
}

test('initial JS includes shared static imports once, but not lazy routes', () => {
  const bundle = {
    'entry.js': chunk('entry.js', 'entry', ['shared.js', 'shared.js'], true),
    'shared.js': chunk('shared.js', 'shared', ['entry.js']),
    'private.js': chunk('private.js', 'private dashboard code'),
  }
  const report = measureInitialJs(bundle)
  assert.deepEqual(report.chunks.map(({ file }) => file), ['entry.js', 'shared.js'])
  assert.equal(report.initialBytes, Buffer.byteLength('entryshared'))
  assert.equal(report.initialGzipBytes, gzipSync('entry').length + gzipSync('shared').length)
  const withPage = measureInitialJs(bundle, ['private.js'])
  assert.equal(withPage.initialBytes, report.initialBytes + Buffer.byteLength('private dashboard code'))
  const withBootstrap = measureInitialJs(bundle, [], 'consent bootstrap')
  assert.equal(withBootstrap.initialBytes, report.initialBytes + Buffer.byteLength('consent bootstrap'))
  assert.equal(withBootstrap.initialGzipBytes, report.initialGzipBytes + gzipSync('consent bootstrap').length)
  assert.throws(() => measureInitialJs({ 'entry.js': chunk('entry.js', '', ['missing.js'], true) }), /Missing JavaScript chunk/)
})

test('bundle and lab metrics fail budgets above their thresholds, not at them', () => {
  const bundle = { initialBytes: PERFORMANCE_BUDGETS.initialBytes, initialGzipBytes: PERFORMANCE_BUDGETS.initialGzipBytes }
  const page = { route: '/', lcpMs: PERFORMANCE_BUDGETS.lcpMs, cls: PERFORMANCE_BUDGETS.cls }
  assert.doesNotThrow(() => assertPerformanceBudgets(bundle, [page]))
  for (const key of ['initialBytes', 'initialGzipBytes']) {
    assert.throws(() => assertPerformanceBudgets({ ...bundle, [key]: bundle[key] + 1 }, [page]), /Performance budgets failed/)
  }
  assert.throws(() => assertPerformanceBudgets(bundle, [{ ...page, lcpMs: page.lcpMs + 1 }]), /lab LCP/)
  assert.throws(() => assertPerformanceBudgets(bundle, [{ ...page, cls: page.cls + 0.001 }]), /lab CLS/)
})

test('missing or invalid measurements cannot produce a passing audit', () => {
  const bundle = { initialBytes: 100, initialGzipBytes: 50 }
  assert.throws(() => assertPerformanceBudgets(bundle, []), /No Lighthouse pages/)
  for (const value of [undefined, NaN, Infinity, -1]) {
    assert.throws(() => assertPerformanceBudgets(bundle, [{ route: '/', lcpMs: value, cls: 0 }]), /lab LCP/)
    assert.throws(() => assertPerformanceBudgets({ ...bundle, initialGzipBytes: value }, [{ route: '/', lcpMs: 100, cls: 0 }]), /gzip bytes/)
  }
})
