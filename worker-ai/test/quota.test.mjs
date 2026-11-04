// W2 end to end through the built Worker: Turnstile, the three limits and /quota, on real SQLite
// with a clock the test controls. Gemini and siteverify are SIMULATED: BOOK is written by hand and
// is not the output of a model. test/limits.workerd.test.mjs repeats simultaneity on the real object.
import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import worker, { LimitsDO } from '../dist/worker.js'
import { limitsNamespace } from './support/sqlite-do.mjs'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE
const NOON = Date.UTC(2026, 10, 3, 12, 0, 0)
const iso = (ms) => new Date(ms).toISOString()

const ORIGIN = 'http://localhost:5173'
const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const CLIENT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const IP = '203.0.113.7'
const TOKEN = 'token-de-prueba-simulado'
const GEMINI_KEY = 'gemini-key-no-real'
const TURNSTILE_SECRET = 'turnstile-secret-no-real'
const IP_SECRET = 'ip-secret-no-real'
const CONCEPT = 'Una cafetería brutalista junto al mar'
const BOOK = {
  mood: 'urbano',
  pair_id: 62,
  palette_id: 'after-hours',
  concepts: ['Ruido de calle', 'La noche no pide permiso'],
  search_queries: ['neon alley', 'urban wall'],
  applications: ['web'],
  rationale: 'Texto de prueba, simulado.',
}

// ─── Harness ────────────────────────────────────────────────────────────────

const realFetch = globalThis.fetch
const realConsole = { log: console.log, error: console.error }
const time = { now: NOON }
let namespace, env, geminiCalls, siteverifyCalls, geminiSteps, siteverifyStep, logs, errors

const reply = (text, usage = {}) => () => Response.json({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage })
const valid = (usage) => reply(JSON.stringify(BOOK), usage)
const invalid = (usage) => reply(JSON.stringify({ ...BOOK, pair_id: 99 }), usage)
const status = (code) => () => new Response('detalle interno', { status: code })
const delayed = (ms, step) => async (init) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return step(init)
}
const hang = () => (init) =>
  new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }))
const siteverifySays = (body) => () => Response.json(body)

function gemini(...steps) {
  geminiSteps = steps
}

beforeEach(() => {
  time.now = NOON
  namespace = limitsNamespace(LimitsDO, () => time.now)
  env = {
    GEMINI_API_KEY: GEMINI_KEY,
    GEMINI_MODEL: 'model-main',
    ALLOWED_ORIGINS: ORIGIN,
    AI_TIMEOUT_BUDGET_MS: '3000',
    AI_ATTEMPT_TIMEOUT_MS: '1000',
    AI_MIN_ATTEMPT_MS: '5',
    AI_BACKOFF_BASE_MS: '1',
    AI_MAX_OUTPUT_TOKENS: '4096',
    FREE_PER_24H: '3',
    IP_PER_DAY: '10',
    GLOBAL_PER_DAY: '600',
    QUOTA_HOLD_MS: '10000',
    TURNSTILE_SECRET_KEY: TURNSTILE_SECRET,
    IP_HASH_SECRET: IP_SECRET,
    LIMITS: namespace,
  }
  geminiCalls = []
  siteverifyCalls = []
  geminiSteps = []
  siteverifyStep = siteverifySays({ success: true })
  logs = []
  errors = []
  console.log = (...args) => logs.push(args.join(' '))
  console.error = (...args) => errors.push(args.join(' '))
  globalThis.fetch = async (input, init) => {
    const url = String(input)
    if (url === SITEVERIFY_URL) {
      siteverifyCalls.push({ url, form: new URLSearchParams(init.body), order: geminiCalls.length })
      return siteverifyStep(init)
    }
    geminiCalls.push({ url, body: JSON.parse(init.body) })
    const step = geminiSteps[geminiCalls.length - 1]
    if (!step) throw new assert.AssertionError({ message: `llamada ${geminiCalls.length} a Gemini no esperada` })
    return step(init)
  }
})

afterEach(() => {
  globalThis.fetch = realFetch
  console.log = realConsole.log
  console.error = realConsole.error
})

const post = (body, { ip = IP, useEnv = env } = {}) =>
  worker.fetch(
    new Request('https://w.example/generate', {
      method: 'POST',
      headers: { Origin: ORIGIN, ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
    useEnv,
  )
const ask = (fields = {}, options) => post({ concept: CONCEPT, clientId: CLIENT, turnstileToken: TOKEN, ...fields }, options)
const quota = (clientId = CLIENT, { ip = IP, useEnv = env, origin = ORIGIN, method = 'GET' } = {}) =>
  worker.fetch(
    new Request(`https://w.example/quota?clientId=${clientId}`, {
      method,
      headers: { ...(origin ? { Origin: origin } : {}), ...(ip ? { 'CF-Connecting-IP': ip } : {}) },
    }),
    useEnv,
  )
const askValid = async (fields, options) => {
  gemini(valid())
  geminiCalls = []
  return ask(fields, options)
}
const globalCount = (day = '2026-11-03') =>
  namespace.storage.sql.exec('SELECT calls FROM global_calls WHERE day = ?', day).toArray()[0]?.calls ?? 0
const generationLogs = () => logs.map((line) => JSON.parse(line)).filter((line) => line.event === 'generate')

async function assertRefused(res, httpStatus, code, expectedQuota) {
  assert.equal(res.status, httpStatus)
  const body = await res.json()
  assert.equal(body.error.code, code)
  assert.ok(body.error.message.length > 10)
  assert.equal(body.remaining, expectedQuota?.remaining)
  assert.equal(body.resetAt, expectedQuota?.resetAt)
}

// ─── DoD: browser, 24 h ─────────────────────────────────────────────────────

test('DoD: the 4th attempt in 24 h is refused without calling Gemini, and at 24 h + 1 min it passes again', async () => {
  const seen = []
  for (let i = 0; i < 3; i++) {
    const res = await askValid()
    assert.equal(res.status, 200)
    seen.push((await res.json()).remaining)
    time.now += MINUTE
  }
  assert.deepEqual(seen, [2, 1, 0])

  const resetAt = iso(NOON + DAY)
  gemini()
  geminiCalls = []
  await assertRefused(await ask(), 429, 'quota_exceeded', { remaining: 0, resetAt })
  assert.equal(geminiCalls.length, 0)

  time.now = NOON + DAY - MINUTE
  await assertRefused(await ask(), 429, 'quota_exceeded', { remaining: 0, resetAt })
  assert.equal(geminiCalls.length, 0)

  time.now = NOON + DAY + MINUTE
  const back = await askValid()
  assert.equal(back.status, 200)
  assert.equal(geminiCalls.length, 1)
})

test('a successful answer carries the quota after charging, with the time the attempt comes back', async () => {
  const body = await (await askValid()).json()
  assert.equal(body.remaining, 2)
  assert.equal(body.resetAt, iso(NOON + DAY))
  assert.deepEqual(await (await quota()).json(), { remaining: 2, resetAt: iso(NOON + DAY) })
})

// ─── DoD: D7, only a valid brandbook charges ────────────────────────────────

test('DoD: an invalid generation does not charge', async () => {
  gemini(invalid(), invalid())
  await assertRefused(await ask(), 502, 'ai_invalid_output', { remaining: 3, resetAt: null })
  assert.equal(geminiCalls.length, 2)
  assert.deepEqual(await (await quota()).json(), { remaining: 3, resetAt: null })
})

test('D7: Gemini being unavailable does not charge either', async () => {
  gemini(status(503), status(503), status(503))
  const res = await ask()
  assert.equal(res.status, 503)
  const body = await res.json()
  assert.equal(body.error.code, 'ai_unavailable')
  assert.equal(body.error.upstreamStatus, 503)
  assert.equal(body.remaining, 3)
  assert.equal(body.resetAt, null)
})

test('D7: a failure leaves all 3 attempts usable', async () => {
  gemini(invalid(), invalid())
  await ask()
  for (let i = 0; i < 3; i++) assert.equal((await askValid()).status, 200, `intento ${i}`)
  await assertRefused(await ask(), 429, 'quota_exceeded', { remaining: 0, resetAt: iso(NOON + DAY) })
})

test('D5: a retry that comes out valid charges once', async () => {
  gemini(invalid(), valid())
  const res = await ask()
  assert.equal(res.status, 200)
  assert.equal((await res.json()).remaining, 2)
})

// ─── DoD: simultaneous requests ─────────────────────────────────────────────

test('DoD: two simultaneous requests with 1 attempt left: only one passes and Gemini is called once', async () => {
  await askValid()
  await askValid()
  geminiCalls = []
  gemini(delayed(30, valid()))

  const results = await Promise.all([ask(), ask()])
  assert.deepEqual(results.map((res) => res.status).sort(), [200, 429])
  assert.equal(geminiCalls.length, 1, 'el segundo se rechaza antes de llamar a Gemini')
  const refused = await results.find((res) => res.status === 429).json()
  assert.equal(refused.error.code, 'quota_exceeded')
  assert.equal(refused.remaining, 0)
  assert.equal((await (await quota()).json()).remaining, 0)
})

test('the attempt is taken before calling Gemini, with the worst case set aside on the global count', async () => {
  let duringTheCall
  gemini(async () => {
    duringTheCall = { global: globalCount(), quota: await (await quota()).json() }
    return valid()()
  })
  await ask()
  assert.equal(duringTheCall.global, 6)
  assert.equal(duringTheCall.quota.remaining, 2)
  assert.equal(globalCount(), 1, 'al cerrar devuelve las que no usó')
})

// ─── DoD: global cap ────────────────────────────────────────────────────────

test('DoD: the global cap blocks any browser without calling Gemini, and reopens the next UTC day', async () => {
  env.GLOBAL_PER_DAY = '6'
  gemini(status(503), status(503), invalid(), status(503), status(503), valid())
  assert.equal((await ask()).status, 200)
  assert.equal(geminiCalls.length, 6)
  assert.equal(globalCount(), 6, 'exactamente el peor caso: no se pasa')

  geminiCalls = []
  gemini()
  const closed = { remaining: 0, resetAt: '2026-11-04T00:00:00.000Z' }
  await assertRefused(await ask({ clientId: OTHER }, { ip: '198.51.100.1' }), 429, 'global_limit', closed)
  assert.equal(geminiCalls.length, 0)
  assert.deepEqual(await (await quota(OTHER, { ip: '198.51.100.1' })).json(), closed)

  time.now = Date.UTC(2026, 10, 4, 0, 0, 0)
  gemini(valid())
  assert.equal((await ask({ clientId: OTHER }, { ip: '198.51.100.1' })).status, 200)
})

test('D18: valid, invalid, 429, 5xx and timeouts all count as one call each', async () => {
  env.FREE_PER_24H = '100'
  const scenarios = [
    { name: 'válida', steps: [valid()], calls: 1 },
    { name: 'inválida y válida', steps: [invalid(), valid()], calls: 2 },
    { name: 'dos inválidas', steps: [invalid(), invalid()], calls: 2 },
    { name: '503 tres veces', steps: [status(503), status(503), status(503)], calls: 3 },
    { name: '429 tres veces', steps: [status(429), status(429), status(429)], calls: 3 },
    { name: '500 y válida', steps: [status(500), valid()], calls: 2 },
    { name: 'timeout y válida', steps: [hang(), valid()], calls: 2 },
  ]
  env.AI_ATTEMPT_TIMEOUT_MS = '50'
  let total = 0
  for (const { name, steps, calls } of scenarios) {
    gemini(...steps)
    geminiCalls = []
    logs = []
    await ask()
    total += calls
    assert.equal(geminiCalls.length, calls, name)
    assert.equal(globalCount(), total, name)
    assert.equal(generationLogs()[0].global_calls_today, total, name)
  }
})

test('a timeout counts as a whole call and is flagged, because its 0 tokens are only a lower bound', async () => {
  env.AI_ATTEMPT_TIMEOUT_MS = '30'
  gemini(hang(), valid({ promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 5 }))
  await ask()
  assert.equal(globalCount(), 2)
  const [log] = generationLogs()
  assert.equal(log.gemini_calls, 2)
  assert.equal(log.unmetered_calls, 1)
  assert.equal(log.calls[0].outcome, 'timeout')
  assert.equal(log.calls[0].tokens_out, 0)
})

test('a network error is flagged like a timeout; an HTTP error is not', async () => {
  gemini(() => {
    throw new TypeError('red caída')
  }, status(503), valid())
  await ask()
  const [log] = generationLogs()
  assert.equal(log.gemini_calls, 3)
  assert.equal(log.unmetered_calls, 1)
})

// ─── IP ─────────────────────────────────────────────────────────────────────

test('the IP cap is shared by the browsers behind it, and other IPs are not affected', async () => {
  env.IP_PER_DAY = '2'
  assert.equal((await askValid()).status, 200)
  assert.equal((await askValid({ clientId: OTHER })).status, 200)

  const third = '33333333-3333-4333-8333-333333333333'
  gemini()
  geminiCalls = []
  await assertRefused(await ask({ clientId: third }), 429, 'quota_exceeded', { remaining: 0, resetAt: iso(NOON + DAY) })
  assert.equal(geminiCalls.length, 0)
  assert.equal((await askValid({ clientId: third }, { ip: '198.51.100.1' })).status, 200)
})

test('IPv6 addresses of the same /64 count as one, and a request without an IP does not get past the cap', async () => {
  env.IP_PER_DAY = '1'
  assert.equal((await askValid({}, { ip: '2001:db8:1:2::1' })).status, 200)
  await assertRefused(await ask({ clientId: OTHER }, { ip: '2001:db8:1:2::2' }), 429, 'quota_exceeded', { remaining: 0, resetAt: iso(NOON + DAY) })

  const third = '33333333-3333-4333-8333-333333333333'
  const fourth = '44444444-4444-4444-8444-444444444444'
  assert.equal((await askValid({ clientId: third }, { ip: null })).status, 200)
  await assertRefused(await ask({ clientId: fourth }, { ip: null }), 429, 'quota_exceeded', { remaining: 0, resetAt: iso(NOON + DAY) })
})

test('the IP is never stored as is', async () => {
  await askValid()
  const stored = JSON.stringify(namespace.storage.sql.exec('SELECT * FROM charges').toArray())
  assert.ok(stored.includes(CLIENT))
  assert.ok(!stored.includes(IP), stored)
})

// ─── DoD: Turnstile ─────────────────────────────────────────────────────────

test('DoD: without a token it is refused, with no call to siteverify or Gemini and nothing taken', async () => {
  for (const turnstileToken of [undefined, '', 123, null]) {
    await assertRefused(await ask({ turnstileToken }), 403, 'captcha_failed', { remaining: 3, resetAt: null })
  }
  assert.equal(siteverifyCalls.length, 0)
  assert.equal(geminiCalls.length, 0)
  assert.equal(globalCount(), 0)
})

test('the token is checked on the server before Gemini, with the secret in the body and not in the URL', async () => {
  await askValid()
  assert.equal(siteverifyCalls.length, 1)
  const [call] = siteverifyCalls
  assert.equal(call.url, SITEVERIFY_URL)
  assert.ok(!call.url.includes(TURNSTILE_SECRET))
  assert.equal(call.form.get('secret'), TURNSTILE_SECRET)
  assert.equal(call.form.get('response'), TOKEN)
  assert.equal(call.form.get('remoteip'), IP)
  assert.equal(call.order, 0, 'antes de llamar a Gemini')
})

test('without an IP, remoteip is left out', async () => {
  await askValid({}, { ip: null })
  assert.equal(siteverifyCalls[0].form.has('remoteip'), false)
})

test('every way siteverify can say no blocks: refused, 500, unreadable, unreachable', async () => {
  const refusals = {
    'success false': siteverifySays({ success: false, 'error-codes': ['invalid-input-response'] }),
    'token ya usado': siteverifySays({ success: false, 'error-codes': ['timeout-or-duplicate'] }),
    'success como texto': siteverifySays({ success: 'true' }),
    'sin campo success': siteverifySays({}),
    'null': () => new Response('null', { status: 200 }),
    '500': () => new Response(JSON.stringify({ success: true }), { status: 500 }),
    'no es JSON': () => new Response('<html>', { status: 200 }),
    'red caída': () => {
      throw new TypeError('red caída')
    },
  }
  for (const [name, step] of Object.entries(refusals)) {
    siteverifyStep = step
    geminiCalls = []
    const res = await ask()
    assert.equal(res.status, 403, name)
    assert.equal((await res.json()).error.code, 'captcha_failed', name)
    assert.equal(geminiCalls.length, 0, name)
    assert.equal(globalCount(), 0, name)
  }
})

test('siteverify hanging is cut off and blocks', { timeout: 15000 }, async () => {
  siteverifyStep = hang()
  const started = Date.now()
  await assertRefused(await ask(), 403, 'captcha_failed', { remaining: 3, resetAt: null })
  assert.ok(Date.now() - started < 8000, `tardó ${Date.now() - started} ms`)
  assert.equal(geminiCalls.length, 0)
})

test('the reason a captcha failed is logged, without the token or the secret', async () => {
  siteverifyStep = siteverifySays({ success: false, 'error-codes': ['invalid-input-secret'] })
  await ask()
  const output = [...logs, ...errors].join('\n')
  assert.match(output, /invalid-input-secret/)
  assert.ok(!output.includes(TOKEN))
  assert.ok(!output.includes(TURNSTILE_SECRET))
  assert.equal(generationLogs().length, 0, 'no llegó a Gemini: no es una generación')
})

test('the log tells an answer that is not a 200 from one that can not be read', async () => {
  siteverifyStep = () => new Response('{}', { status: 500 })
  await ask()
  assert.match(errors.join('\n'), /"reason":"http-500"/)

  errors = []
  siteverifyStep = () => new Response('<html>', { status: 200 })
  await ask()
  assert.match(errors.join('\n'), /"reason":"unreadable-reply"/)
})

test('the captcha is not spent when the configuration is broken', async () => {
  const { TURNSTILE_SECRET_KEY: _, ...withoutSecret } = env
  const res = await ask({}, { useEnv: withoutSecret })
  assert.equal(res.status, 500)
  const { error } = await res.json()
  assert.equal(error.code, 'missing_config')
  assert.ok(error.message.includes('TURNSTILE_SECRET_KEY'), error.message)
  assert.equal(siteverifyCalls.length, 0)
  assert.equal(geminiCalls.length, 0)
})

// ─── Configuration that can't work ──────────────────────────────────────────

test('missing or useless limit settings are reported by name, on both endpoints', async () => {
  const broken = {
    'GLOBAL_PER_DAY menor que el peor caso': ['GLOBAL_PER_DAY', '5'],
    'QUOTA_HOLD_MS igual al presupuesto': ['QUOTA_HOLD_MS', '3000'],
    'QUOTA_HOLD_MS menor que el presupuesto': ['QUOTA_HOLD_MS', '2999'],
    'sin el Durable Object': ['LIMITS', undefined],
    'sin el secreto de la IP': ['IP_HASH_SECRET', undefined],
    'secreto de la IP vacío': ['IP_HASH_SECRET', '  '],
  }
  for (const [name, [variable, value]] of Object.entries(broken)) {
    const useEnv = { ...env, [variable]: value }
    for (const res of [await ask({}, { useEnv }), await quota(CLIENT, { useEnv })]) {
      assert.equal(res.status, 500, name)
      const { error } = await res.json()
      assert.equal(error.code, 'missing_config', name)
      assert.ok(error.message.includes(variable), error.message)
    }
    assert.equal(geminiCalls.length, 0, name)
  }
})

test('the smallest values that can work are accepted', async () => {
  env.GLOBAL_PER_DAY = '6'
  env.QUOTA_HOLD_MS = '3001'
  assert.equal((await askValid()).status, 200)
})

// ─── clientId and concept ───────────────────────────────────────────────────

test('without a valid clientId there is no quota to report, and nothing is called', async () => {
  for (const clientId of [undefined, '', 'hola', 123]) {
    await assertRefused(await ask({ clientId }), 400, 'invalid_params')
  }
  for (const body of ['null', 'no es json', '']) await assertRefused(await post(body), 400, 'invalid_params')
  assert.equal(siteverifyCalls.length, 0)
  assert.equal(geminiCalls.length, 0)
})

test('an invalid concept reports the quota and spends neither the captcha nor an attempt', async () => {
  await assertRefused(await ask({ concept: 'ab' }), 400, 'invalid_params', { remaining: 3, resetAt: null })
  assert.equal(siteverifyCalls.length, 0)
  assert.equal(globalCount(), 0)
})

// ─── GET /quota ─────────────────────────────────────────────────────────────

test('/quota answers without spending, however many times it is called', async () => {
  for (let i = 0; i < 5; i++) {
    const res = await quota()
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
    assert.equal(res.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await res.json(), { remaining: 3, resetAt: null })
  }
  assert.equal(geminiCalls.length, 0)
  assert.equal(siteverifyCalls.length, 0)
  assert.equal(globalCount(), 0)
  assert.equal(namespace.storage.sql.exec('SELECT COUNT(*) AS n FROM charges').toArray()[0].n, 0)
})

test('/quota follows the IP limit too', async () => {
  env.IP_PER_DAY = '1'
  await askValid()
  assert.deepEqual(await (await quota(OTHER)).json(), { remaining: 0, resetAt: iso(NOON + DAY) })
  // Another network has its 1 free: the browser has 3 but the IP cap holds it to 1, and nothing is pending.
  assert.deepEqual(await (await quota(OTHER, { ip: '198.51.100.1' })).json(), { remaining: 1, resetAt: null })
})

test('/quota refuses other origins, other methods and a bad clientId', async () => {
  for (const origin of ['https://evil.example', null]) {
    await assertRefused(await quota(CLIENT, { origin }), 403, 'origin_not_allowed')
  }
  await assertRefused(await quota(CLIENT, { method: 'POST' }), 405, 'method_not_allowed')
  await assertRefused(await quota('hola'), 400, 'invalid_params')
})

test('/quota does not need the Gemini key or the captcha secret', async () => {
  const { GEMINI_API_KEY: _a, TURNSTILE_SECRET_KEY: _b, ...useEnv } = env
  assert.equal((await quota(CLIENT, { useEnv })).status, 200)
})

// ─── The ledger failing ─────────────────────────────────────────────────────

function failingOn(op) {
  const real = namespace.get()
  return {
    idFromName: (name) => name,
    get: () => ({
      fetch: async (url, init) => {
        if (JSON.parse(init.body).op === op) throw new Error(`DO caído en ${op}`)
        return real.fetch(url, init)
      },
    }),
  }
}

test('without the ledger Gemini is not called: failing closed is what protects the money', async () => {
  env.LIMITS = failingOn('reserve')
  const res = await ask()
  await assertRefused(res, 500, 'ai_unavailable')
  assert.equal(geminiCalls.length, 0)
  assert.match(errors.join('\n'), /DO caído en reserve/)
})

test('/quota with the ledger down is an error, not a made-up number', async () => {
  env.LIMITS = failingOn('peek')
  await assertRefused(await quota(), 500, 'ai_unavailable')
})

test('an answer from the ledger that is not OK counts as failing', async () => {
  // Readable and shaped like a reservation, so only the status can stop it.
  const body = { ok: true, holdId: 'x', quota: { remaining: 3, resetAt: null } }
  env.LIMITS = { idFromName: (name) => name, get: () => ({ fetch: async () => Response.json(body, { status: 500 }) }) }
  await assertRefused(await ask(), 500, 'ai_unavailable')
  assert.equal(geminiCalls.length, 0)
  assert.match(errors.join('\n'), /LimitsDO respondió 500/)
})

test('a refused captcha still answers when the ledger is down, without a quota', async () => {
  env.LIMITS = failingOn('peek')
  await assertRefused(await ask({ turnstileToken: '' }), 403, 'captcha_failed')
  assert.match(errors.join('\n'), /DO caído en peek/)
})

test('if settling fails after a valid brandbook it is delivered anyway, with the quota the reservation left', async () => {
  env.LIMITS = failingOn('settle')
  gemini(valid())
  const res = await ask()
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.brandbook, BOOK)
  assert.equal(body.remaining, 2)
  assert.equal(body.resetAt, iso(NOON + DAY))
  assert.match(errors.join('\n'), /DO caído en settle/)
  const [log] = generationLogs()
  assert.equal(log.charged, false)
  assert.equal(log.global_calls_today, null)
  assert.equal(globalCount(), 6, 'nadie cerró: el peor caso queda contado')
})

test('if settling fails after a failed generation the error still goes out with a quota', async () => {
  env.LIMITS = failingOn('settle')
  gemini(invalid(), invalid())
  await assertRefused(await ask(), 502, 'ai_invalid_output', { remaining: 2, resetAt: iso(NOON + DAY) })
})

// ─── Log: the cost data for P2 and P3 ───────────────────────────────────────

test('one log line per generation with tokens split out: tokens_out includes the thoughts', async () => {
  gemini(valid({ promptTokenCount: 4926, candidatesTokenCount: 156, thoughtsTokenCount: 1137 }))
  await ask()
  const [log] = generationLogs()
  assert.equal(generationLogs().length, 1)
  assert.equal(log.tokens_in, 4926)
  assert.equal(log.tokens_out, 1293, 'candidates + thoughts: lo que se cobra como salida')
  assert.equal(log.tokens_thoughts, 1137)
  assert.equal(log.tokens_out_no_thoughts, 156, 'el número comparable con tokens_out del laboratorio')
  assert.equal(log.unmetered_calls, 0)
  assert.equal(log.charged, true)
  assert.equal(log.global_calls_today, 1)
})

test('tokens of failed calls are logged too, and a failed generation says it did not charge', async () => {
  gemini(
    invalid({ promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 1 }),
    invalid({ promptTokenCount: 200, candidatesTokenCount: 20, thoughtsTokenCount: 2 }),
  )
  await ask()
  const [log] = generationLogs()
  assert.equal(log.outcome, 'ai_invalid_output')
  assert.equal(log.tokens_in, 300)
  assert.equal(log.tokens_out, 33)
  assert.equal(log.tokens_thoughts, 3)
  assert.equal(log.tokens_out_no_thoughts, 30)
  assert.equal(log.charged, false)
  assert.equal(log.global_calls_today, 2)
})

test('requests refused by a limit are not generations', async () => {
  env.FREE_PER_24H = '1'
  await askValid()
  logs = []
  gemini()
  await ask()
  assert.deepEqual(logs, [])
})

test('no response or log holds the clientId, the IP, the concept or any secret, on any path', async () => {
  const scenarios = [
    [valid({ promptTokenCount: 1, candidatesTokenCount: 1 })],
    [invalid(), invalid()],
    [status(503), status(503), status(503)],
    [hang(), valid()],
  ]
  env.AI_ATTEMPT_TIMEOUT_MS = '30'
  for (const steps of scenarios) {
    gemini(...steps)
    geminiCalls = []
    logs = []
    errors = []
    const text = await (await ask()).text()
    const output = [...logs, ...errors].join('\n')
    assert.ok(logs.length > 0, 'hubo log')
    for (const secret of [GEMINI_KEY, TURNSTILE_SECRET, IP_SECRET, TOKEN]) {
      assert.ok(!text.includes(secret), text)
      assert.ok(!output.includes(secret), output)
    }
    assert.ok(!output.includes(CLIENT), output)
    assert.ok(!output.includes(IP), output)
    assert.ok(!output.includes(CONCEPT), output)
  }
})
