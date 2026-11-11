import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Brandbook } from '../shared/types.ts'
import { AiFailure, CLIENT_ID_KEY, generate, getClientId, getQuota, isUsableBrandbook, type AiTransport } from '../src/lib/aiApi.ts'
import type { KeyValue } from '../src/lib/saved.ts'

// A fake Worker answer for the fetch fake below: these tests never call a model.
const brandbook: Brandbook = {
  mood: 'urbano',
  pair_id: 1,
  palette_id: 'after-hours',
  concepts: ['frase uno', 'frase dos'],
  search_queries: ['night street', 'neon sign'],
  applications: ['web', 'social'],
  rationale: 'porque sí',
}
const metrics = { model: 'test-model', latency_ms: 10, tokens_in: 1, tokens_out: 2, tokens_thoughts: 1 }
const okBody = { brandbook, ...metrics, remaining: 2, resetAt: '2026-11-11T00:00:00Z' }
const request = { concept: 'bar de vinos naturales', clientId: '123e4567-e89b-42d3-a456-426614174000', turnstileToken: 'tok-1' }

function respond(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      if (body === undefined) throw new SyntaxError('not JSON')
      return body
    },
  } as unknown as Response
}

/** fetch fake: records the calls and answers with what it was given. */
function fakeFetch(answer: Response | Error) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const fn = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    if (answer instanceof Error) throw answer
    return answer
  }) as typeof fetch
  return { fn, calls }
}

const transport = (fn: typeof fetch, over: Partial<AiTransport> = {}): AiTransport => ({ baseUrl: 'http://ai.test', fetchFn: fn, ...over })

const failsWith = (code: string) => (err: unknown) => err instanceof AiFailure && err.code === code

// ─── generate ───────────────────────────────────────────────────────────────

test('generate posts the concept, the clientId and the token to /generate', async () => {
  const { fn, calls } = fakeFetch(respond(200, okBody))
  await generate(request, transport(fn))
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'http://ai.test/generate')
  assert.equal(calls[0].init?.method, 'POST')
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), request)
})

test('a 200 with a usable brandbook resolves with it, quota included', async () => {
  const { fn } = fakeFetch(respond(200, okBody))
  const res = await generate(request, transport(fn))
  assert.ok('brandbook' in res)
  assert.deepEqual(res.brandbook, brandbook)
  assert.equal(res.remaining, 2)
  assert.equal(res.resetAt, '2026-11-11T00:00:00Z')
})

test('a 200 with fuera_de_tema resolves without a brandbook (D16)', async () => {
  const { fn } = fakeFetch(respond(200, { fuera_de_tema: true, ...metrics, remaining: 3, resetAt: null }))
  const res = await generate(request, transport(fn))
  assert.ok(!('brandbook' in res))
  assert.ok('fuera_de_tema' in res && res.fuera_de_tema === true)
})

test('quota_exceeded carries remaining and resetAt', async () => {
  const body = { error: { code: 'quota_exceeded', message: 'sin intentos' }, remaining: 0, resetAt: '2026-11-11T09:30:00Z' }
  const { fn } = fakeFetch(respond(429, body))
  await assert.rejects(generate(request, transport(fn)), (err: unknown) => {
    assert.ok(err instanceof AiFailure)
    assert.equal(err.code, 'quota_exceeded')
    assert.equal(err.remaining, 0)
    assert.equal(err.resetAt, '2026-11-11T09:30:00Z')
    return true
  })
})

test('global_limit arrives as its own code', async () => {
  const { fn } = fakeFetch(respond(429, { error: { code: 'global_limit', message: 'tope global' }, remaining: 1, resetAt: null }))
  await assert.rejects(generate(request, transport(fn)), failsWith('global_limit'))
})

test('an error without quota fields leaves remaining and resetAt as null', async () => {
  const { fn } = fakeFetch(respond(503, { error: { code: 'ai_unavailable', message: 'caída' } }))
  await assert.rejects(generate(request, transport(fn)), (err: unknown) => {
    assert.ok(err instanceof AiFailure)
    assert.equal(err.code, 'ai_unavailable')
    assert.equal(err.remaining, null)
    assert.equal(err.resetAt, null)
    return true
  })
})

test('an unknown error body falls back by status: 429 is quota, the rest bad_response', async () => {
  const { fn: f429 } = fakeFetch(respond(429, { whatever: true }))
  await assert.rejects(generate(request, transport(f429)), failsWith('quota_exceeded'))
  const { fn: f500 } = fakeFetch(respond(500, 'plain text'))
  await assert.rejects(generate(request, transport(f500)), failsWith('bad_response'))
})

test('a connection error is network', async () => {
  const { fn } = fakeFetch(new TypeError('fetch failed'))
  await assert.rejects(generate(request, transport(fn)), failsWith('network'))
})

test('a 200 that is not JSON is bad_response', async () => {
  const { fn } = fakeFetch(respond(200, undefined))
  await assert.rejects(generate(request, transport(fn)), failsWith('bad_response'))
})

test('a brandbook with a pair_id outside the catalogue is bad_response', async () => {
  const { fn } = fakeFetch(respond(200, { ...okBody, brandbook: { ...brandbook, pair_id: 999_999 } }))
  await assert.rejects(generate(request, transport(fn)), failsWith('bad_response'))
})

test('a brandbook with a palette_id outside the catalogue is bad_response', async () => {
  const { fn } = fakeFetch(respond(200, { ...okBody, brandbook: { ...brandbook, palette_id: 'no-existe' } }))
  await assert.rejects(generate(request, transport(fn)), failsWith('bad_response'))
})

test('without a base URL nothing is fetched: not_configured', async () => {
  const { fn, calls } = fakeFetch(respond(200, okBody))
  await assert.rejects(generate(request, transport(fn, { baseUrl: null })), failsWith('not_configured'))
  assert.equal(calls.length, 0)
})

test('a request that outlives the client timeout is timeout', async () => {
  const hanging = ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch
  await assert.rejects(generate(request, transport(hanging, { timeoutMs: 20 })), failsWith('timeout'))
})

test('an abort by the caller rethrows the abort, not an AiFailure', async () => {
  const hanging = ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))) as typeof fetch
  const ac = new AbortController()
  const pending = generate(request, transport(hanging), ac.signal)
  ac.abort()
  await assert.rejects(pending, (err: unknown) => !(err instanceof AiFailure))
})

// ─── isUsableBrandbook ──────────────────────────────────────────────────────

test('isUsableBrandbook rejects empty phrase lists and strange moods', () => {
  assert.ok(isUsableBrandbook(brandbook))
  assert.ok(!isUsableBrandbook({ ...brandbook, concepts: [] }))
  assert.ok(!isUsableBrandbook({ ...brandbook, search_queries: ['ok', 42] }))
  assert.ok(!isUsableBrandbook({ ...brandbook, mood: 'festivo' }))
  assert.ok(!isUsableBrandbook({ ...brandbook, rationale: '  ' }))
})

// ─── getQuota ───────────────────────────────────────────────────────────────

test('getQuota asks with the clientId and takes a null resetAt', async () => {
  const { fn, calls } = fakeFetch(respond(200, { remaining: 3, resetAt: null }))
  const quota = await getQuota(request.clientId, transport(fn))
  assert.equal(calls[0].url, `http://ai.test/quota?clientId=${request.clientId}`)
  assert.deepEqual(quota, { remaining: 3, resetAt: null })
})

test('a quota answer without remaining is bad_response', async () => {
  const { fn } = fakeFetch(respond(200, { resetAt: null }))
  await assert.rejects(getQuota(request.clientId, transport(fn)), failsWith('bad_response'))
})

// ─── getClientId ────────────────────────────────────────────────────────────

class Memory implements KeyValue {
  data = new Map<string, string>()
  getItem(k: string) {
    return this.data.get(k) ?? null
  }
  setItem(k: string, v: string) {
    this.data.set(k, v)
  }
}

test('getClientId creates one UUID and keeps it in storage', () => {
  const storage = new Memory()
  const id = getClientId(storage)
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
  assert.equal(storage.getItem(CLIENT_ID_KEY), id)
  assert.equal(getClientId(storage), id)
})

test('getClientId replaces a stored value that is not a UUID', () => {
  const storage = new Memory()
  storage.setItem(CLIENT_ID_KEY, 'no-soy-un-uuid')
  const id = getClientId(storage)
  assert.notEqual(id, 'no-soy-un-uuid')
  assert.equal(storage.getItem(CLIENT_ID_KEY), id)
})

test('without storage the id holds for the visit', () => {
  assert.equal(getClientId(null), getClientId(null))
})
