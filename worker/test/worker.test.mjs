// Tests for the built worker (worker.js) with a mocked Unsplash. Run with «npm test».
import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import worker from '../worker.js'

const ORIGIN = 'http://localhost:5173'
const ENV = { UNSPLASH_ACCESS_KEY: 'test-key', ALLOWED_ORIGINS: `https://nachodeco6-beep.github.io, ${ORIGIN}/` }
const ctx = { waitUntil() {}, passThroughOnException() {} }
const realFetch = globalThis.fetch
let calls = []

function mockUnsplash(handler) {
  calls = []
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), headers: new Headers(init?.headers) })
    return handler(String(input))
  }
}
afterEach(() => (globalThis.fetch = realFetch))

const rawPhoto = (id, extra = {}) => ({
  id,
  width: 4000,
  height: 6000,
  color: '#a3b2c1',
  alt_description: 'a surfer at dusk',
  description: null,
  urls: {
    thumb: `https://images.unsplash.com/photo-${id}?ixid=XYZ&w=200`,
    small: `https://images.unsplash.com/photo-${id}?ixid=XYZ&w=400`,
    regular: `https://images.unsplash.com/photo-${id}?ixid=XYZ&w=1080`,
    full: `https://images.unsplash.com/photo-${id}?ixid=XYZ`,
  },
  links: { html: `https://unsplash.com/photos/${id}` },
  user: { name: 'Ana Pérez', links: { html: 'https://unsplash.com/@ana' } },
  ...extra,
})

const get = (path, headers = { Origin: ORIGIN }, method = 'GET') =>
  worker.fetch(new Request(`https://w.example${path}`, { method, headers }), ENV, ctx)

test('search normalises photos and keeps URLs untouched', async () => {
  mockUnsplash(() => Response.json({ total: 2, results: [rawPhoto('abc'), rawPhoto('def', { alt_description: null, color: 'nope' }), { broken: true }] }, { headers: { 'X-Ratelimit-Remaining': '42' } }))
  const res = await get('/search?query=%20Surf%20%20California%20&per_page=15')
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.equal(res.headers.get('X-Cache'), 'MISS')
  assert.equal(res.headers.get('X-Ratelimit-Remaining'), '42')
  const body = await res.json()
  assert.equal(body.total, 2)
  assert.equal(body.photos.length, 2)
  const [a, b] = body.photos
  assert.equal(a.id, 'unsplash:abc')
  assert.equal(a.source, 'unsplash')
  assert.equal(a.unsplashId, 'abc')
  assert.equal(a.alt, 'A surfer at dusk')
  assert.equal(a.color, '#a3b2c1')
  assert.equal(a.urls.small, 'https://images.unsplash.com/photo-abc?ixid=XYZ&w=400')
  assert.equal(a.author.profileUrl, 'https://unsplash.com/@ana?utm_source=afterhours&utm_medium=referral')
  assert.equal(a.pageUrl, 'https://unsplash.com/photos/abc?utm_source=afterhours&utm_medium=referral')
  assert.equal(b.alt, 'Foto de Ana Pérez')
  assert.equal(b.color, null)

  const call = new URL(calls[0].url)
  assert.equal(call.origin + call.pathname, 'https://api.unsplash.com/search/photos')
  assert.equal(call.searchParams.get('query'), 'surf california')
  assert.equal(call.searchParams.get('per_page'), '15')
  assert.equal(call.searchParams.get('page'), '1')
  assert.equal(call.searchParams.get('content_filter'), 'high')
  assert.equal(calls[0].headers.get('Authorization'), 'Client-ID test-key')
})

test('repeated searches are served from cache without calling Unsplash', async () => {
  mockUnsplash(() => Response.json({ total: 1, results: [rawPhoto('cached')] }))
  await get('/search?query=analog%20flash')
  const again = await get('/search?query=ANALOG%20FLASH')
  assert.equal(again.headers.get('X-Cache'), 'HIT')
  assert.equal(calls.length, 1)
  assert.equal((await again.json()).photos[0].id, 'unsplash:cached')
})

test('origins outside ALLOWED_ORIGINS are refused', async () => {
  mockUnsplash(() => Response.json({ total: 0, results: [] }))
  const res = await get('/search?query=surf', { Origin: 'https://evil.example' })
  assert.equal(res.status, 403)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal((await res.json()).error.code, 'origin_not_allowed')
  assert.equal(calls.length, 0)
})

test('preflight answers allowed origins', async () => {
  const res = await get('/search', { Origin: ORIGIN, 'Access-Control-Request-Method': 'GET' }, 'OPTIONS')
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /GET/)
})

test('parameters are validated', async () => {
  mockUnsplash(() => Response.json({ total: 0, results: [] }))
  for (const path of ['/search', '/search?query=%20%20', `/search?query=${'a'.repeat(101)}`, '/search?query=x&per_page=31', '/search?query=x&per_page=0', '/search?query=x&per_page=abc', '/search?query=x&page=0']) {
    const res = await get(path)
    assert.equal(res.status, 400, path)
    assert.equal((await res.json()).error.code, 'invalid_params', path)
  }
  assert.equal(calls.length, 0)
  const ok = await get(`/search?query=${'a'.repeat(100)}&per_page=30`)
  assert.equal(ok.status, 200)
})

test('a missing key is reported clearly', async () => {
  const res = await worker.fetch(new Request('https://w.example/search?query=surf', { headers: { Origin: ORIGIN } }), { ALLOWED_ORIGINS: ORIGIN }, ctx)
  assert.equal(res.status, 500)
  assert.equal((await res.json()).error.code, 'missing_key')
})

test('Unsplash errors become clear JSON errors', async () => {
  const cases = [
    [new Response('OAuth error: The access token is invalid', { status: 401 }), 502, 'invalid_key'],
    [new Response('Rate Limit Exceeded', { status: 403, headers: { 'X-Ratelimit-Remaining': '0' } }), 429, 'rate_limited'],
    [new Response('Server error', { status: 503 }), 502, 'unsplash_error'],
  ]
  for (const [i, [upstream, status, code]] of cases.entries()) {
    mockUnsplash(() => upstream)
    const res = await get(`/search?query=error-case-${i}`)
    assert.equal(res.status, status, code)
    const { error } = await res.json()
    assert.equal(error.code, code)
    assert.equal(error.upstreamStatus, upstream.status)
    assert.ok(error.message.length > 10)
    if (code === 'rate_limited') assert.equal(error.rateLimitRemaining, 0)
  }
  mockUnsplash(() => {
    throw new TypeError('network down')
  })
  const down = await get('/search?query=offline')
  assert.equal(down.status, 503)
  assert.equal((await down.json()).error.code, 'unsplash_unreachable')
})

test('download pings the Unsplash download endpoint', async () => {
  mockUnsplash(() => Response.json({ url: 'https://images.unsplash.com/photo-abc?ixid=XYZ&fm=jpg' }))
  const res = await get('/download?id=unsplash:abc_DEF-1')
  assert.equal(res.status, 200)
  assert.equal((await res.json()).url, 'https://images.unsplash.com/photo-abc?ixid=XYZ&fm=jpg')
  assert.equal(calls[0].url, 'https://api.unsplash.com/photos/abc_DEF-1/download')
  assert.equal(calls[0].headers.get('Authorization'), 'Client-ID test-key')

  const bad = await get('/download?id=../../me')
  assert.equal(bad.status, 400)
  assert.equal(calls.length, 1)
})

test('unknown paths and methods', async () => {
  assert.equal((await get('/nope')).status, 404)
  assert.equal((await get('/search?query=x', { Origin: ORIGIN }, 'POST')).status, 405)
  const root = await get('/')
  assert.equal(root.status, 200)
  assert.equal((await root.json()).keyConfigured, true)
})
