// Tests for the built Worker (dist/worker.js) with a mocked Gemini. Run with «npm test».
// Every Gemini reply here is SIMULATED: BOOK is written by hand to exercise the Worker's logic,
// and is not the output of a model. The real run is afterhours-ai/scripts/smoke_worker.py.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import worker from '../dist/worker.js'
import { toGeminiSchema } from '../src/gemini.ts'
import { renderSystemPrompt } from '../src/prompt.ts'

const TEMPLATE = readFileSync(new URL('../../shared/ai/brandbook_system_prompt_v4.md', import.meta.url), 'utf8')
const SCHEMA = JSON.parse(readFileSync(new URL('../../shared/ai/brandbook.schema.json', import.meta.url), 'utf8'))

const ORIGIN = 'http://localhost:5173'
const KEY = 'test-key-no-real'
const CONCEPT = 'Una cafetería brutalista junto al mar'
const ENV = {
  GEMINI_API_KEY: KEY,
  GEMINI_MODEL: 'model-main',
  ALLOWED_ORIGINS: `https://nachodeco6-beep.github.io, ${ORIGIN}/`,
  AI_TIMEOUT_BUDGET_MS: '3000',
  AI_ATTEMPT_TIMEOUT_MS: '1000',
  AI_MIN_ATTEMPT_MS: '5',
  AI_BACKOFF_BASE_MS: '1',
}

const BOOK = {
  mood: 'urbano',
  pair_id: 62,
  palette_id: 'after-hours',
  concepts: ['Ruido de calle', 'La noche no pide permiso'],
  search_queries: ['neon alley', 'urban wall'],
  applications: ['web'],
  rationale: 'Texto de prueba, simulado.',
}

// ─── Mocked Gemini: one step per expected call; one call too many fails the test ───

const realFetch = globalThis.fetch
const realConsole = { log: console.log, error: console.error }
let calls = []
let logs = []
let errors = []

function mockGemini(...steps) {
  calls = []
  globalThis.fetch = async (input, init) => {
    const call = { url: String(input), headers: new Headers(init?.headers), body: JSON.parse(init.body), signal: init.signal }
    calls.push(call)
    const step = steps[calls.length - 1]
    if (!step) throw new assert.AssertionError({ message: `llamada ${calls.length} a Gemini no esperada` })
    return step(init)
  }
}

const reply = (text, usage = {}) => () =>
  Response.json({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage })
const valid = (usage) => reply(JSON.stringify(BOOK), usage)
const invalid = (usage) => reply(JSON.stringify({ ...BOOK, pair_id: 99 }), usage)
const status = (code, body = 'detalle interno de Gemini') => () => new Response(body, { status: code })
const delayed = (ms, step) => async (init) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
  return step(init)
}
// Only ends if the Worker gave fetch its timeout signal.
const hang = () => (init) =>
  new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }))
// Headers arrive, the body never does, and nothing ties it to the signal.
const hangBody = () => () => new Response(new ReadableStream({ start() {} }), { status: 200 })
const networkError = () => () => {
  throw new TypeError('network down')
}

beforeEach(() => {
  logs = []
  errors = []
  console.log = (...args) => logs.push(args.join(' '))
  console.error = (...args) => errors.push(args.join(' '))
})
afterEach(() => {
  globalThis.fetch = realFetch
  console.log = realConsole.log
  console.error = realConsole.error
})

const send = (body, { env = ENV, headers = { Origin: ORIGIN }, path = '/generate', method = 'POST' } = {}) =>
  worker.fetch(new Request(`https://w.example${path}`, { method, headers, ...(body === undefined ? {} : { body }) }), env)
const generate = (env = ENV) => send(JSON.stringify({ concept: CONCEPT }), { env })
const lastLog = () => {
  assert.equal(logs.length, 1, `se esperaba una línea de log: ${logs.join('\n')}`)
  return JSON.parse(logs[0])
}
async function assertError(res, httpStatus, code, upstreamStatus) {
  assert.equal(res.status, httpStatus)
  const { error } = await res.json()
  assert.equal(error.code, code)
  assert.ok(error.message.length > 10)
  assert.equal(error.upstreamStatus, upstreamStatus)
}

// ─── The request to Gemini ──────────────────────────────────────────────────

test('a valid output comes back with its metrics', async () => {
  mockGemini(valid({ promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 7 }))
  const res = await generate()
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.equal(res.headers.get('Cache-Control'), 'no-store')
  const body = await res.json()
  assert.deepEqual(body.brandbook, BOOK)
  assert.equal(body.model, 'model-main')
  assert.equal(body.tokens_in, 100)
  assert.equal(body.tokens_out, 27, 'candidates + thoughts')
  assert.equal(body.tokens_thoughts, 7)
  assert.equal(typeof body.latency_ms, 'number')
  assert.deepEqual(Object.keys(body).sort(), ['brandbook', 'latency_ms', 'model', 'tokens_in', 'tokens_out', 'tokens_thoughts'])
})

test('the request carries the real prompt, schema and settings, and the key only in the header', async () => {
  mockGemini(valid())
  await generate()
  const [call] = calls
  assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/model-main:generateContent')
  assert.ok(!call.url.includes(KEY))
  assert.equal(call.headers.get('x-goog-api-key'), KEY)
  assert.equal(call.headers.get('Content-Type'), 'application/json')
  const expectedPrompt = renderSystemPrompt(TEMPLATE, TYPE_PAIRS, PALETTES)
  assert.ok(expectedPrompt.length > 10000)
  assert.equal(call.body.systemInstruction.parts[0].text, expectedPrompt)
  assert.deepEqual(call.body.contents, [{ role: 'user', parts: [{ text: CONCEPT }] }])
  assert.equal(call.body.generationConfig.responseMimeType, 'application/json')
  assert.equal(call.body.generationConfig.temperature, 0.2)
  assert.deepEqual(call.body.generationConfig.responseSchema, toGeminiSchema(SCHEMA))
})

test('the concept goes out trimmed', async () => {
  mockGemini(valid())
  await send(JSON.stringify({ concept: `  ${CONCEPT}\n` }))
  assert.equal(calls[0].body.contents[0].parts[0].text, CONCEPT)
})

test('text split across parts is joined, and thoughts are left out', async () => {
  const text = JSON.stringify(BOOK)
  const parts = [{ text: 'razonando...', thought: true }, { text: text.slice(0, 10) }, { text: text.slice(10) }]
  mockGemini(() => Response.json({ candidates: [{ content: { parts } }] }))
  const res = await generate()
  assert.equal(res.status, 200)
  assert.deepEqual((await res.json()).brandbook, BOOK)
})

// ─── HTTP: nothing here may reach Gemini ────────────────────────────────────

test('origins outside ALLOWED_ORIGINS are refused', async () => {
  mockGemini()
  const res = await send(JSON.stringify({ concept: CONCEPT }), { headers: { Origin: 'https://evil.example' } })
  await assertError(res, 403, 'origin_not_allowed')
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null)
  assert.equal(calls.length, 0)
})

test('requests without Origin are refused, preflight included', async () => {
  mockGemini()
  await assertError(await send(JSON.stringify({ concept: CONCEPT }), { headers: {} }), 403, 'origin_not_allowed')
  await assertError(await send(undefined, { headers: {}, method: 'OPTIONS' }), 403, 'origin_not_allowed')
  assert.equal(calls.length, 0)
})

test('an empty ALLOWED_ORIGINS falls back to the default list', async () => {
  mockGemini()
  const env = { ...ENV, ALLOWED_ORIGINS: ' , ' }
  await assertError(await send(JSON.stringify({ concept: '' }), { env }), 400, 'invalid_params')
  await assertError(await send(JSON.stringify({ concept: '' }), { env, headers: { Origin: 'https://evil.example' } }), 403, 'origin_not_allowed')
})

test('preflight answers allowed origins', async () => {
  const res = await send(undefined, { method: 'OPTIONS' })
  assert.equal(res.status, 204)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.match(res.headers.get('Access-Control-Allow-Methods'), /POST/)
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /Content-Type/)
})

test('unknown paths and methods', async () => {
  mockGemini()
  const notFound = await send(undefined, { path: '/nope', method: 'GET' })
  assert.equal(notFound.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  await assertError(notFound, 404, 'not_found')
  await assertError(await send(JSON.stringify({ concept: CONCEPT }), { path: '/nope' }), 404, 'not_found')
  await assertError(await send(undefined, { method: 'GET' }), 405, 'method_not_allowed')
  assert.equal(calls.length, 0)
})

test('the status check is open and never shows the key', async () => {
  mockGemini()
  const res = await send(undefined, { path: '/', method: 'GET', headers: {} })
  assert.equal(res.status, 200)
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), null)
  const text = await res.text()
  assert.ok(!text.includes(KEY))
  const body = JSON.parse(text)
  assert.equal(body.service, 'afterhours-ai')
  assert.equal(body.keyConfigured, true)

  const noKey = await send(undefined, { path: '/', method: 'GET', env: { ...ENV, GEMINI_API_KEY: ' ' } })
  assert.equal(noKey.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  assert.equal((await noKey.json()).keyConfigured, false)

  const evil = await send(undefined, { path: '/', method: 'GET', headers: { Origin: 'https://evil.example' } })
  assert.equal(evil.status, 200, 'sigue abierto')
  assert.equal(evil.headers.get('Access-Control-Allow-Origin'), null, 'pero sin CORS para un origen ajeno')
  assert.equal(calls.length, 0)
})

test('the concept is validated', async () => {
  mockGemini()
  const bad = {
    'concepto vacío': JSON.stringify({ concept: '' }),
    'solo espacios': JSON.stringify({ concept: '     ' }),
    '2 caracteres': JSON.stringify({ concept: 'ab' }),
    '2 caracteres con espacios alrededor': JSON.stringify({ concept: '  ab  ' }),
    '501 caracteres': JSON.stringify({ concept: 'a'.repeat(501) }),
    'no es un string': JSON.stringify({ concept: 123 }),
    'sin el campo': JSON.stringify({ idea: CONCEPT }),
    'body null': 'null',
    'body que no es JSON': 'hola',
    'body vacío': '',
  }
  for (const [name, body] of Object.entries(bad)) {
    const res = await send(body)
    assert.equal(res.status, 400, name)
    assert.equal((await res.json()).error.code, 'invalid_params', name)
  }
  assert.equal(calls.length, 0)
})

test('the concept limits are inclusive and count characters, not UTF-16 units', async () => {
  for (const concept of ['abc', 'a'.repeat(500), '🙂'.repeat(500)]) {
    mockGemini(valid())
    assert.equal((await send(JSON.stringify({ concept }))).status, 200, `${[...concept].length} caracteres`)
    assert.equal(calls.length, 1)
  }
})

test('a missing key is reported clearly, without calling Gemini', async () => {
  mockGemini()
  for (const GEMINI_API_KEY of [undefined, '   ']) {
    await assertError(await generate({ ...ENV, GEMINI_API_KEY }), 500, 'missing_key')
  }
  assert.equal(calls.length, 0)
})

test('a missing or broken variable is reported by name, with no hidden default (D9)', async () => {
  mockGemini()
  const names = ['GEMINI_MODEL', 'AI_TIMEOUT_BUDGET_MS', 'AI_ATTEMPT_TIMEOUT_MS', 'AI_MIN_ATTEMPT_MS', 'AI_BACKOFF_BASE_MS']
  for (const name of names) {
    const broken = name === 'GEMINI_MODEL' ? [undefined, ' '] : [undefined, '', 'abc', '0', '-5', '1.5']
    for (const value of broken) {
      const res = await generate({ ...ENV, [name]: value })
      assert.equal(res.status, 500, `${name}=${value}`)
      const { error } = await res.json()
      assert.equal(error.code, 'missing_config', `${name}=${value}`)
      assert.ok(error.message.includes(name), error.message)
      for (const other of names.filter((n) => n !== name)) assert.ok(!error.message.includes(other), error.message)
    }
  }
  assert.equal(calls.length, 0)
})

test('an unexpected error is logged and answered in the common format', async () => {
  const env = {
    ...ENV,
    get GEMINI_API_KEY() {
      throw new Error('fallo de prueba')
    },
  }
  const res = await send(JSON.stringify({ concept: CONCEPT }), { env })
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), ORIGIN)
  await assertError(res, 500, 'ai_unavailable')
  assert.equal(errors.length, 1)
  assert.match(errors[0], /fallo de prueba/)
})

// ─── D5: invalid output, 1 retry ────────────────────────────────────────────

test('D5: each kind of invalid output is rejected, with exactly one retry', async () => {
  const cases = {
    'pair_id inexistente': reply(JSON.stringify({ ...BOOK, pair_id: 99 })),
    'palette_id inexistente': reply(JSON.stringify({ ...BOOK, palette_id: 'no-existe' })),
    'mood distinto al de la paleta': reply(JSON.stringify({ ...BOOK, mood: 'retro' })),
    'campo extra': reply(JSON.stringify({ ...BOOK, colors: ['#000000'] })),
    'query en español': reply(JSON.stringify({ ...BOOK, search_queries: ['luz de la calle', 'urban wall'] })),
    'texto que no es JSON': reply('Acá tenés tu brandbook, espero que te guste'),
    'JSON que no es un objeto': reply('[1, 2]'),
    'sin candidatos': () => Response.json({ promptFeedback: { blockReason: 'SAFETY' } }),
    'sobre ilegible': () => new Response('<html>no es json</html>', { status: 200 }),
  }
  for (const [name, step] of Object.entries(cases)) {
    mockGemini(step, step)
    logs = []
    await assertError(await generate(), 502, 'ai_invalid_output')
    assert.equal(calls.length, 2, name)
  }
})

test('D5: a retry that comes back valid is a success, and tokens add up across both outputs', async () => {
  mockGemini(
    invalid({ promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 1 }),
    valid({ promptTokenCount: 200, candidatesTokenCount: 20, thoughtsTokenCount: 2 }),
  )
  const res = await generate()
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body.brandbook, BOOK)
  assert.equal(body.tokens_in, 300)
  assert.equal(body.tokens_out, 33)
  assert.equal(body.tokens_thoughts, 3)
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[1].body, calls[0].body, 'el reintento es el mismo pedido')
})

test('D5: with no budget left there is no retry', async () => {
  mockGemini(delayed(100, invalid()))
  const env = { ...ENV, AI_TIMEOUT_BUDGET_MS: '200', AI_ATTEMPT_TIMEOUT_MS: '200', AI_MIN_ATTEMPT_MS: '150' }
  await assertError(await generate(env), 502, 'ai_invalid_output')
  assert.equal(calls.length, 1)
})

// ─── D12: 429, 5xx, timeout, retries inside the budget ──────────────────────

test('D12: 429 and every 5xx are retried, and the answer that follows counts', async () => {
  for (const code of [429, 500, 502, 503, 504, 529]) {
    mockGemini(status(code), valid())
    const res = await generate()
    assert.equal(res.status, 200, String(code))
    assert.equal(calls.length, 2, String(code))
  }
})

test('D12: a retryable error is tried 3 times, then ai_unavailable', async () => {
  mockGemini(status(503), status(429), status(503))
  await assertError(await generate(), 503, 'ai_unavailable', 503)
  assert.equal(calls.length, 3)
})

test('D12: the budget can run out before the third attempt', async () => {
  mockGemini(delayed(100, status(503)), delayed(100, status(503)))
  const env = { ...ENV, AI_TIMEOUT_BUDGET_MS: '270', AI_MIN_ATTEMPT_MS: '80' }
  await assertError(await generate(env), 503, 'ai_unavailable', 503)
  assert.equal(calls.length, 2)
})

test('D12: a budget below the minimum makes no call at all', async () => {
  mockGemini()
  await assertError(await generate({ ...ENV, AI_TIMEOUT_BUDGET_MS: '50', AI_MIN_ATTEMPT_MS: '100' }), 503, 'ai_unavailable')
  assert.equal(calls.length, 0)
})

test('D12: it does not wait for a backoff that would not leave room for another attempt', async () => {
  mockGemini(status(503))
  const env = { ...ENV, AI_TIMEOUT_BUDGET_MS: '500', AI_ATTEMPT_TIMEOUT_MS: '200', AI_MIN_ATTEMPT_MS: '100', AI_BACKOFF_BASE_MS: '450' }
  const started = Date.now()
  await assertError(await generate(env), 503, 'ai_unavailable', 503)
  assert.equal(calls.length, 1)
  assert.ok(Date.now() - started < 300, 'no esperó el backoff')
})

test('D12: backoff doubles between attempts', async () => {
  const at = []
  const stamped = (step) => (init) => {
    at.push(Date.now())
    return step(init)
  }
  mockGemini(stamped(status(503)), stamped(status(503)), stamped(valid()))
  assert.equal((await generate({ ...ENV, AI_BACKOFF_BASE_MS: '100' })).status, 200)
  assert.ok(at[1] - at[0] >= 90, `primera espera: ${at[1] - at[0]}`)
  assert.ok(at[2] - at[1] >= 190, `segunda espera: ${at[2] - at[1]}`)
})

test('D12: a call that hangs is cut off and retried', async () => {
  mockGemini(hang(), valid())
  const res = await generate({ ...ENV, AI_ATTEMPT_TIMEOUT_MS: '50' })
  assert.equal(res.status, 200)
  assert.equal(calls.length, 2)
  assert.equal(calls[0].signal.aborted, true, 'el timeout llega a fetch')
  assert.equal(calls[1].signal.aborted, false)
  const { calls: traced } = lastLog()
  assert.equal(traced[0].outcome, 'timeout')
  assert.ok(traced[0].ms >= 40 && traced[0].ms < 500, `ms: ${traced[0].ms}`)
})

test('D12: the timeout covers a body that never arrives', async () => {
  mockGemini(hangBody(), valid())
  const res = await generate({ ...ENV, AI_ATTEMPT_TIMEOUT_MS: '50' })
  assert.equal(res.status, 200)
  assert.equal(calls.length, 2)
})

test('D12: the last call is cut off at the deadline, not at the attempt timeout', async () => {
  mockGemini(hang())
  const started = Date.now()
  await assertError(await generate({ ...ENV, AI_TIMEOUT_BUDGET_MS: '150', AI_ATTEMPT_TIMEOUT_MS: '5000' }), 503, 'ai_unavailable')
  assert.equal(calls.length, 1)
  assert.ok(Date.now() - started < 1000, `tardó ${Date.now() - started} ms`)
})

test('D12: a network error is retried, and upstreamStatus only reports an HTTP status', async () => {
  mockGemini(networkError(), valid())
  assert.equal((await generate()).status, 200)
  assert.equal(lastLog().calls[0].outcome, 'network')

  mockGemini(status(503), networkError(), networkError())
  await assertError(await generate(), 503, 'ai_unavailable', undefined)
  assert.equal(calls.length, 3)
})

test('D12: other 4xx are not retried and Gemini\'s body is not forwarded', async () => {
  for (const code of [400, 401, 403, 404]) {
    mockGemini(status(code, 'SECRETO-DEL-CUERPO-DE-GEMINI'))
    logs = []
    const res = await generate()
    const text = await res.text()
    assert.equal(res.status, 503, String(code))
    const { error } = JSON.parse(text)
    assert.equal(error.code, 'ai_unavailable')
    assert.equal(error.upstreamStatus, code)
    assert.ok(!text.includes('SECRETO-DEL-CUERPO-DE-GEMINI'))
    assert.ok(!logs.join('\n').includes('SECRETO-DEL-CUERPO-DE-GEMINI'))
    assert.equal(calls.length, 1, String(code))
  }
})

test('D12: the body of an error is not read, so one that hangs does not spend the attempt timeout', async () => {
  mockGemini(() => new Response(new ReadableStream({ start() {} }), { status: 503 }), valid())
  const res = await generate({ ...ENV, AI_ATTEMPT_TIMEOUT_MS: '100' })
  assert.equal(res.status, 200)
  assert.equal(lastLog().calls[0].outcome, 503)
})

test('D12: the fallback model is used on the third attempt only', async () => {
  mockGemini(status(503), status(503), valid())
  const res = await generate({ ...ENV, GEMINI_FALLBACK_MODEL: 'model-fallback' })
  assert.equal(res.status, 200)
  assert.deepEqual(calls.map((c) => c.url.match(/models\/(.+):/)[1]), ['model-main', 'model-main', 'model-fallback'])
  assert.equal((await res.json()).model, 'model-fallback')
})

test('D12: without a fallback the third attempt stays on the main model', async () => {
  for (const GEMINI_FALLBACK_MODEL of [undefined, '  ']) {
    mockGemini(status(503), status(503), valid())
    const res = await generate({ ...ENV, GEMINI_FALLBACK_MODEL })
    assert.equal((await res.json()).model, 'model-main')
    assert.ok(calls[2].url.includes('/model-main:'))
  }
})

test('D12: latency_ms measures only the call that answered', async () => {
  mockGemini(delayed(200, status(503)), delayed(30, valid()))
  const body = await (await generate({ ...ENV, AI_BACKOFF_BASE_MS: '200' })).json()
  assert.ok(body.latency_ms >= 25 && body.latency_ms < 150, `latency_ms: ${body.latency_ms}`)
})

// ─── D5 and D12 together: separate counters, one deadline ───────────────────

test('each mechanism keeps its own count: 503, 503, invalid, 503, 503, valid is a success', async () => {
  mockGemini(status(503), status(503), invalid(), status(503), status(503), valid())
  const res = await generate()
  assert.equal(res.status, 200)
  assert.equal(calls.length, 6)
  const log = lastLog()
  assert.equal(log.rounds, 2)
  assert.deepEqual(log.calls.map((c) => [c.round, c.attempt]), [[1, 1], [1, 2], [1, 3], [2, 1], [2, 2], [2, 3]])
})

test('the fallback only applies to the third attempt of each round', async () => {
  mockGemini(invalid(), status(503), status(503), valid())
  const res = await generate({ ...ENV, GEMINI_FALLBACK_MODEL: 'model-fallback' })
  assert.deepEqual(calls.map((c) => c.url.match(/models\/(.+):/)[1]), ['model-main', 'model-main', 'model-main', 'model-fallback'])
  assert.equal((await res.json()).model, 'model-fallback')
})

test('an invalid output followed by an unavailable Gemini ends as ai_unavailable', async () => {
  mockGemini(invalid(), status(503), status(503), status(503))
  await assertError(await generate(), 503, 'ai_unavailable', 503)
  assert.equal(calls.length, 4)
})

test('both mechanisms share one deadline: the retry for D5 does not get a fresh budget', async () => {
  mockGemini(delayed(100, invalid()), delayed(100, status(503)))
  const env = { ...ENV, AI_TIMEOUT_BUDGET_MS: '270', AI_MIN_ATTEMPT_MS: '80' }
  await assertError(await generate(env), 503, 'ai_unavailable', 503)
  assert.equal(calls.length, 2)
})

test('the whole request stays inside the budget even if every call hangs', async () => {
  mockGemini(hang(), hang(), hang())
  const started = Date.now()
  const env = { ...ENV, AI_TIMEOUT_BUDGET_MS: '300', AI_ATTEMPT_TIMEOUT_MS: '100', AI_MIN_ATTEMPT_MS: '20' }
  await assertError(await generate(env), 503, 'ai_unavailable')
  const elapsed = Date.now() - started
  assert.ok(elapsed < 900, `tardó ${elapsed} ms`)
})

// ─── Log: the data W2 needs, for every outcome ──────────────────────────────

test('the log counts calls and tokens of a request that ends in ai_invalid_output', async () => {
  mockGemini(
    reply(JSON.stringify({ ...BOOK, mood: 'retro' }), { promptTokenCount: 100, candidatesTokenCount: 10, thoughtsTokenCount: 1 }),
    reply('no es json', { promptTokenCount: 200, candidatesTokenCount: 20, thoughtsTokenCount: 2 }),
  )
  await generate()
  const log = lastLog()
  assert.equal(log.event, 'generate')
  assert.equal(log.outcome, 'ai_invalid_output')
  assert.equal(log.model, null)
  assert.equal(log.gemini_calls, 2)
  assert.equal(log.tokens_in, 300)
  assert.equal(log.tokens_out, 33)
  assert.equal(log.tokens_thoughts, 3)
  assert.deepEqual(log.calls.map((c) => c.invalid), [['mood'], ['json']])
  assert.deepEqual(log.calls.map((c) => [c.tokens_in, c.tokens_out, c.tokens_thoughts]), [[100, 11, 1], [200, 22, 2]])
})

test('the log counts calls and tokens of a request that ends in ai_unavailable', async () => {
  mockGemini(invalid({ promptTokenCount: 100, candidatesTokenCount: 10 }), status(503), status(429), status(503))
  await generate()
  const log = lastLog()
  assert.equal(log.outcome, 'ai_unavailable')
  assert.equal(log.upstream_status, 503)
  assert.equal(log.gemini_calls, 4)
  assert.equal(log.tokens_in, 100)
  assert.equal(log.tokens_out, 10)
  assert.deepEqual(log.calls.map((c) => c.outcome), [200, 503, 429, 503])
})

test('the log records every attempt with its own latency and model', async () => {
  mockGemini(delayed(60, status(503)), delayed(20, status(503)), valid({ promptTokenCount: 5, candidatesTokenCount: 6 }))
  await generate({ ...ENV, GEMINI_FALLBACK_MODEL: 'model-fallback' })
  const log = lastLog()
  assert.equal(log.outcome, 'ok')
  assert.equal(log.model, 'model-fallback')
  assert.equal(log.upstream_status, null)
  assert.deepEqual(log.calls.map((c) => c.model), ['model-main', 'model-main', 'model-fallback'])
  assert.ok(log.calls[0].ms >= 50, `ms: ${log.calls[0].ms}`)
  assert.ok(log.calls[1].ms >= 15 && log.calls[1].ms < log.calls[0].ms, `ms: ${log.calls[1].ms}`)
  assert.ok(log.total_ms >= log.calls[0].ms + log.calls[1].ms)
})

test('requests rejected before reaching Gemini leave no generation in the log', async () => {
  mockGemini()
  await send(JSON.stringify({ concept: '' }))
  assert.deepEqual(logs, [])
})

// ─── Secrets ────────────────────────────────────────────────────────────────

test('neither the key nor the concept reach responses or logs, on any path', async () => {
  const scenarios = [
    [valid({ promptTokenCount: 1, candidatesTokenCount: 1 })],
    [invalid(), reply('no es json')],
    [status(503), status(503), status(503)],
    [status(400)],
    [networkError(), networkError(), networkError()],
  ]
  for (const steps of scenarios) {
    mockGemini(...steps)
    logs = []
    const text = await (await generate()).text()
    assert.ok(logs.length > 0, 'hubo log')
    for (const output of [text, logs.join('\n')]) assert.ok(!output.includes(KEY), output)
    assert.ok(!logs.join('\n').includes(CONCEPT), logs.join('\n'))
  }
})

test('the log names the rule that stopped the output: the schema catches a pair_id out of range', async () => {
  mockGemini(invalid(), valid())
  await generate()
  assert.deepEqual(lastLog().calls[0].invalid, ['schema'])
  assert.equal(lastLog().calls[1].invalid, undefined)
})

test('a rule name in the log never quotes what the model wrote', async () => {
  const quoted = JSON.stringify({ ...BOOK, search_queries: [`${CONCEPT} de la calle`, 'urban wall'] })
  mockGemini(reply(quoted), reply(quoted))
  await generate()
  const log = lastLog()
  assert.deepEqual(log.calls[0].invalid, ['search_queries'])
  assert.ok(!logs[0].includes(CONCEPT))
})
