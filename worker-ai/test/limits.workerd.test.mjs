// Simultaneity on the real thing: the built Worker and the Durable Object with SQLite, running in
// workerd through Miniflare. In Node these tests would prove little, because the ledger is synchronous.
// Gemini and siteverify are SIMULATED with outboundService: BOOK is written by hand and is not the
// output of a model.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import { convertV4MiniflareOptions, Miniflare } from 'miniflare'

const ORIGIN = 'http://localhost:5173'
const BOOK = {
  mood: 'urbano',
  pair_id: 62,
  palette_id: 'after-hours',
  concepts: ['Ruido de calle', 'La noche no pide permiso'],
  search_queries: ['neon alley', 'urban wall'],
  applications: ['web'],
  rationale: 'Texto de prueba, simulado.',
}

const script = readFileSync(new URL('../dist/worker.js', import.meta.url), 'utf8')
let geminiCalls = 0
let geminiDelayMs = 100
let nextClient = 0

/** A browser nobody used yet, so the tests share one object without stepping on each other. */
const newClient = () => `${String(++nextClient).padStart(8, '0')}-1111-4111-8111-111111111111`
/** A network nobody used yet. */
const newIp = () => `198.51.${Math.floor(nextClient / 250)}.${(nextClient % 250) + 1}`

async function outbound(request) {
  const url = new URL(request.url)
  if (url.hostname === 'challenges.cloudflare.com') return Response.json({ success: true })
  if (url.hostname === 'generativelanguage.googleapis.com') {
    geminiCalls++
    await new Promise((resolve) => setTimeout(resolve, geminiDelayMs))
    return Response.json({
      candidates: [{ content: { parts: [{ text: JSON.stringify(BOOK) }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5, thoughtsTokenCount: 1 },
    })
  }
  throw new Error(`salida no esperada a ${url.hostname}`)
}

function start(bindings) {
  return new Miniflare(
    convertV4MiniflareOptions({
      workers: [
        {
          name: 'afterhours-ai',
          modules: true,
          script,
          compatibilityDate: '2025-10-01',
          durableObjects: { LIMITS: { className: 'LimitsDO', useSQLite: true } },
          outboundService: outbound,
          bindings: {
            GEMINI_API_KEY: 'gemini-key-no-real',
            GEMINI_MODEL: 'model-main',
            ALLOWED_ORIGINS: ORIGIN,
            AI_TIMEOUT_BUDGET_MS: '3000',
            AI_ATTEMPT_TIMEOUT_MS: '2000',
            AI_MIN_ATTEMPT_MS: '5',
            AI_BACKOFF_BASE_MS: '1',
            AI_MAX_OUTPUT_TOKENS: '4096',
            QUOTA_HOLD_MS: '10000',
            TURNSTILE_SECRET_KEY: 'turnstile-secret-no-real',
            IP_HASH_SECRET: 'ip-secret-no-real',
            ...bindings,
          },
        },
      ],
    }),
  )
}

const generate = (mf, clientId, ip) =>
  mf.dispatchFetch('http://w.example/generate', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip },
    body: JSON.stringify({ concept: 'Una cafetería junto al mar', clientId, turnstileToken: 'token-simulado' }),
  })

const readAll = (responses) => Promise.all(responses.map(async (res) => ({ status: res.status, body: await res.json() })))

let tight, wide

before(async () => {
  tight = start({ FREE_PER_24H: '1', IP_PER_DAY: '1000', GLOBAL_PER_DAY: '100000' })
  wide = start({ FREE_PER_24H: '3', IP_PER_DAY: '1000', GLOBAL_PER_DAY: '100000' })
  await Promise.all([tight.ready, wide.ready])
})

after(async () => {
  await Promise.all([tight.dispose(), wide.dispose()])
})

beforeEach(() => {
  geminiCalls = 0
  geminiDelayMs = 100
})

test('DoD, on the real object: two simultaneous requests with 1 attempt left, only one passes', async () => {
  const client = newClient()
  const ip = newIp()
  const results = await readAll(await Promise.all([generate(tight, client, ip), generate(tight, client, ip)]))

  assert.deepEqual(results.map((r) => r.status).sort(), [200, 429], JSON.stringify(results))
  assert.equal(geminiCalls, 1, 'el segundo se rechaza sin llamar a Gemini')
  assert.equal(results.find((r) => r.status === 429).body.error.code, 'quota_exceeded')
  assert.equal(results.find((r) => r.status === 200).body.remaining, 0)
})

test('a burst of 12 simultaneous requests with 3 attempts: exactly 3 pass', async () => {
  const client = newClient()
  const ip = newIp()
  const burst = Array.from({ length: 12 }, () => generate(wide, client, ip))
  const results = await readAll(await Promise.all(burst))

  assert.equal(results.filter((r) => r.status === 200).length, 3, JSON.stringify(results.map((r) => r.status)))
  assert.equal(results.filter((r) => r.status === 429).length, 9)
  assert.equal(geminiCalls, 3)
})

test('the IP cap holds under a burst of different browsers', async () => {
  const mf = start({ FREE_PER_24H: '3', IP_PER_DAY: '2', GLOBAL_PER_DAY: '100000' })
  try {
    const ip = newIp()
    const burst = Array.from({ length: 6 }, () => generate(mf, newClient(), ip))
    const results = await readAll(await Promise.all(burst))
    assert.equal(results.filter((r) => r.status === 200).length, 2, JSON.stringify(results.map((r) => r.status)))
    assert.equal(geminiCalls, 2)
  } finally {
    await mf.dispose()
  }
})

test('the global cap holds under a burst: holds in progress count, so it never goes over', async () => {
  const mf = start({ FREE_PER_24H: '3', IP_PER_DAY: '1000', GLOBAL_PER_DAY: '12' })
  try {
    const burst = Array.from({ length: 6 }, () => generate(mf, newClient(), newIp()))
    const results = await readAll(await Promise.all(burst))
    assert.equal(results.filter((r) => r.status === 200).length, 2, JSON.stringify(results.map((r) => r.status)))
    assert.equal(results.filter((r) => r.status === 429 && r.body.error.code === 'global_limit').length, 4)
    assert.equal(geminiCalls, 2)

    // Each one used 1 call and gave 5 back, so it opens again without waiting for the next day.
    const later = await generate(mf, newClient(), newIp())
    assert.equal(later.status, 200)
    await later.json()
  } finally {
    await mf.dispose()
  }
})

test('the count survives between requests and /quota reads the same object', async () => {
  const client = newClient()
  const ip = newIp()
  await (await generate(wide, client, ip)).json()
  const res = await wide.dispatchFetch(`http://w.example/quota?clientId=${client}`, {
    headers: { Origin: ORIGIN, 'CF-Connecting-IP': ip },
  })
  assert.equal(res.status, 200)
  const quota = await res.json()
  assert.equal(quota.remaining, 2)
  assert.equal(Date.parse(quota.resetAt) > Date.now() + 23 * 60 * 60 * 1000, true, quota.resetAt)
})
