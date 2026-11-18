// Evidence-only checks against an already-built standalone artifact.
// No ReDoS payload, server, provider call, or production monkey patch.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { afterEach, test } from 'node:test'

const root = resolve(import.meta.dirname, '../..')
const artifactRequire = createRequire(resolve(root, '.next/standalone/server.js'))
const sourceRequire = createRequire(resolve(root, 'package.json'))
const bundlePath = artifactRequire.resolve('next/dist/compiled/picomatch')
const bundle = artifactRequire('next/dist/compiled/picomatch')
const originalMakeRe = bundle.makeRe
const { hasLocalMatch } = artifactRequire('next/dist/shared/lib/match-local-pattern')
const { hasRemoteMatch } = artifactRequire('next/dist/shared/lib/match-remote-pattern')
const config = JSON.parse(readFileSync(resolve(root, '.next/required-server-files.json'), 'utf8')).config
const digest = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const recordPatterns = () => {
  const patterns = []
  bundle.makeRe = (pattern, ...args) => {
    patterns.push(pattern)
    return originalMakeRe(pattern, ...args)
  }
  return patterns
}
afterEach(() => { bundle.makeRe = originalMakeRe })

test('built deployment disables image optimization and retains only fixed image patterns', () => {
  assert.equal(config.output, 'standalone')
  assert.equal(config.images.unoptimized, true)
  assert.deepEqual(config.images.localPatterns, [{ pathname: '**', search: '' }])
  assert.deepEqual(config.images.remotePatterns, [])
  assert.deepEqual(config.images.domains, [])
})

test('standalone bundle is identical to the installed Next bundle', () => {
  assert.equal(digest(bundlePath), digest(sourceRequire.resolve('next/dist/compiled/picomatch')))
})

test('the retained bundled compiler is callable with a benign fixed pattern', () => {
  assert.equal(bundle.makeRe('/public/*.pdf').test('/public/manual.pdf'), true)
  assert.equal(bundle.makeRe('/public/*.pdf').test('/private/manual.pdf'), false)
})

test('actual built local patterns compile configuration, never candidate paths', () => {
  const patterns = recordPatterns()
  for (const candidate of ['/manual.pdf', '/a+b.pdf', '/question[1].pdf']) {
    assert.equal(hasLocalMatch(config.images.localPatterns, candidate), true)
  }
  assert.deepEqual(patterns, ['**', '**', '**'])
})

test('actual built local search restriction rejects query text before compilation', () => {
  const patterns = recordPatterns()
  assert.equal(hasLocalMatch(config.images.localPatterns, '/manual.pdf?question=overview'), false)
  assert.deepEqual(patterns, [])
})

test('actual built remote configuration rejects remote candidates without compiling', () => {
  const patterns = recordPatterns()
  assert.equal(hasRemoteMatch(config.images.domains, config.images.remotePatterns,
    new URL('https://example.invalid/public/manual.pdf')), false)
  assert.deepEqual(patterns, [])
})

test('controlled local-pattern fixture keeps filename and query as candidate data', () => {
  const patterns = recordPatterns()
  assert.equal(hasLocalMatch([{ pathname: '/public/**' }], '/public/report[1].pdf?q=a+b'), true)
  assert.deepEqual(patterns, ['/public/**'])
})

test('controlled remote-pattern fixture compiles only fixed host and pathname', () => {
  const patterns = recordPatterns()
  assert.equal(hasRemoteMatch([], [{ hostname: 'example.invalid', pathname: '/public/**' }],
    new URL('https://example.invalid/public/report[1].pdf?q=a+b')), true)
  assert.deepEqual(patterns, ['example.invalid', '/public/**'])
})
