/**
 * AFTERHOURS AI Worker.
 *
 *   POST /generate { concept, clientId, turnstileToken }
 *     -> { brandbook, model, latency_ms, tokens_in, tokens_out, tokens_thoughts, remaining, resetAt }
 *   GET /quota?clientId= -> { remaining, resetAt }
 *
 * The secrets live in GEMINI_API_KEY, TURNSTILE_SECRET_KEY and IP_HASH_SECRET. Both endpoints only
 * answer requests whose Origin is listed in ALLOWED_ORIGINS; `/` is an open status check.
 */
import SCHEMA from '../../shared/ai/brandbook.schema.json'
import TEMPLATE from '../../shared/ai/brandbook_system_prompt_v4.md'
import type { AiErrorBody, AiErrorCode, GenerateResponse, QuotaInfo } from '../../shared/types.ts'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import { toGeminiSchema } from './gemini.ts'
import { generate, MAX_CALLS_PER_GENERATION } from './generate.ts'
import type { Generation, GenerationSettings } from './generate.ts'
import { ipKey, isClientId } from './identity.ts'
import { LimitsClient } from './limits-do.ts'
import type { Limits, Settlement, Who } from './limits.ts'
import { renderSystemPrompt } from './prompt.ts'
import { verifyTurnstile } from './turnstile.ts'

export { LimitsDO } from './limits-do.ts'

export interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GEMINI_FALLBACK_MODEL?: string
  ALLOWED_ORIGINS?: string
  AI_TIMEOUT_BUDGET_MS?: string
  AI_ATTEMPT_TIMEOUT_MS?: string
  AI_MIN_ATTEMPT_MS?: string
  AI_BACKOFF_BASE_MS?: string
  AI_MAX_OUTPUT_TOKENS?: string
  LIMITS?: DurableObjectNamespace
  FREE_PER_24H?: string
  IP_PER_DAY?: string
  GLOBAL_PER_DAY?: string
  QUOTA_HOLD_MS?: string
  TURNSTILE_SECRET_KEY?: string
  IP_HASH_SECRET?: string
}

const DEFAULT_ORIGINS = ['https://nachodeco6-beep.github.io', 'http://localhost:5173']
const CONCEPT_MIN = 3
const CONCEPT_MAX = 500

// Built once per isolate: a broken template fails at startup, not on a user's request.
const SYSTEM_PROMPT = renderSystemPrompt(TEMPLATE, TYPE_PAIRS, PALETTES)
const RESPONSE_SCHEMA = toGeminiSchema(SCHEMA)
const CATALOG = { pairs: TYPE_PAIRS, palettes: PALETTES }

// ─── Responses ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function fail(
  code: AiErrorCode,
  status: number,
  message: string,
  { upstreamStatus, quota }: { upstreamStatus?: number; quota?: QuotaInfo } = {},
): Response {
  const body: AiErrorBody = {
    error: { code, message, ...(upstreamStatus === undefined ? {} : { upstreamStatus }) },
    ...quota,
  }
  return json(body, status)
}

function allowedOrigins(env: Env): string[] {
  const list = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list.length ? list : DEFAULT_ORIGINS
}

function withCors(response: Response, origin: string | null): Response {
  const res = new Response(response.body, response)
  if (origin) res.headers.set('Access-Control-Allow-Origin', origin)
  res.headers.append('Vary', 'Origin')
  return res
}

// ─── Configuration ──────────────────────────────────────────────────────────

function positiveInt(raw: string | undefined): number | null {
  const text = raw?.trim() ?? ''
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return value > 0 ? value : null
}

const missingNames = (checks: [string, unknown][]): string[] =>
  checks.filter(([, value]) => value === null).map(([name]) => name)

/** D9: the numbers live in the environment, so there are no defaults to fall back to. */
function readSettings(env: Env, apiKey: string): GenerationSettings | { missing: string[] } {
  const model = env.GEMINI_MODEL?.trim() || null
  const budgetMs = positiveInt(env.AI_TIMEOUT_BUDGET_MS)
  const attemptTimeoutMs = positiveInt(env.AI_ATTEMPT_TIMEOUT_MS)
  const minAttemptMs = positiveInt(env.AI_MIN_ATTEMPT_MS)
  const backoffBaseMs = positiveInt(env.AI_BACKOFF_BASE_MS)
  const maxOutputTokens = positiveInt(env.AI_MAX_OUTPUT_TOKENS)
  if (
    model === null ||
    budgetMs === null ||
    attemptTimeoutMs === null ||
    minAttemptMs === null ||
    backoffBaseMs === null ||
    maxOutputTokens === null
  ) {
    return {
      missing: missingNames([
        ['GEMINI_MODEL', model],
        ['AI_TIMEOUT_BUDGET_MS', budgetMs],
        ['AI_ATTEMPT_TIMEOUT_MS', attemptTimeoutMs],
        ['AI_MIN_ATTEMPT_MS', minAttemptMs],
        ['AI_BACKOFF_BASE_MS', backoffBaseMs],
        ['AI_MAX_OUTPUT_TOKENS', maxOutputTokens],
      ]),
    }
  }
  const fallbackModel = env.GEMINI_FALLBACK_MODEL?.trim() || null
  return { apiKey, model, fallbackModel, budgetMs, attemptTimeoutMs, minAttemptMs, backoffBaseMs, maxOutputTokens }
}

interface LimitsAccess {
  client: LimitsClient
  ipSecret: string
}

/**
 * A value that can't work counts as broken, so it is reported instead of failing later: a cap
 * below one generation's worst case would never open, and a hold shorter than the budget would
 * expire while the generation is still running.
 */
function readLimits(env: Env): LimitsAccess | { missing: string[] } {
  const perClient = positiveInt(env.FREE_PER_24H)
  const perIp = positiveInt(env.IP_PER_DAY)
  const rawGlobal = positiveInt(env.GLOBAL_PER_DAY)
  const globalCalls = rawGlobal !== null && rawGlobal >= MAX_CALLS_PER_GENERATION ? rawGlobal : null
  const rawHold = positiveInt(env.QUOTA_HOLD_MS)
  const holdMs = rawHold !== null && rawHold > (positiveInt(env.AI_TIMEOUT_BUDGET_MS) ?? 0) ? rawHold : null
  const namespace = env.LIMITS ?? null
  const ipSecret = env.IP_HASH_SECRET?.trim() || null
  if (perClient === null || perIp === null || globalCalls === null || holdMs === null || namespace === null || ipSecret === null) {
    return {
      missing: missingNames([
        ['FREE_PER_24H', perClient],
        ['IP_PER_DAY', perIp],
        ['GLOBAL_PER_DAY', globalCalls],
        ['QUOTA_HOLD_MS', holdMs],
        ['LIMITS', namespace],
        ['IP_HASH_SECRET', ipSecret],
      ]),
    }
  }
  const limits: Limits = { perClient, perIp, globalCalls, holdMs, callsPerGeneration: MAX_CALLS_PER_GENERATION }
  return { client: new LimitsClient(namespace, limits), ipSecret }
}

// ─── Log ────────────────────────────────────────────────────────────────────

/**
 * One line per request that reached Gemini, whatever the outcome: it is what P2 and P3 calculate
 * the real cost from. Never holds the concept, the key, the clientId or the IP.
 *
 * Tokens: tokens_out already includes tokens_thoughts, which is how it gets billed. In the lab,
 * tokens_out does not include them, so the comparable number here is tokens_out_no_thoughts.
 * unmetered_calls are the calls cut off by a timeout or a network error: they report 0 tokens
 * though they may have spent some, so if it is above 0 the totals are a lower bound.
 */
function logGeneration({ result, rounds, calls }: Generation, totalMs: number, settlement: Settlement | null): void {
  const sum = (field: 'tokens_in' | 'tokens_out' | 'tokens_thoughts') => calls.reduce((acc, call) => acc + call[field], 0)
  console.log(
    JSON.stringify({
      event: 'generate',
      outcome: result.ok ? 'ok' : result.code,
      model: result.ok ? result.response.model : null,
      upstream_status: result.ok ? null : (result.upstreamStatus ?? null),
      rounds,
      gemini_calls: calls.length,
      unmetered_calls: calls.filter((call) => typeof call.outcome !== 'number').length,
      tokens_in: sum('tokens_in'),
      tokens_out: sum('tokens_out'),
      tokens_thoughts: sum('tokens_thoughts'),
      tokens_out_no_thoughts: sum('tokens_out') - sum('tokens_thoughts'),
      charged: settlement?.outcome === 'charged',
      global_calls_today: settlement?.globalCallsToday ?? null,
      total_ms: totalMs,
      calls,
    }),
  )
}

// ─── Handlers ───────────────────────────────────────────────────────────────

interface GenerateBody {
  concept?: unknown
  clientId?: unknown
  turnstileToken?: unknown
}

async function readBody(request: Request): Promise<GenerateBody | null> {
  try {
    return (await request.json()) as GenerateBody | null
  } catch {
    return null
  }
}

/** The trimmed concept, or null if it isn't a usable one. */
function readConcept(body: GenerateBody): string | null {
  if (typeof body.concept !== 'string') return null
  const concept = body.concept.trim()
  const length = [...concept].length
  return length >= CONCEPT_MIN && length <= CONCEPT_MAX ? concept : null
}

const CLIENT_ID_MESSAGE = 'El campo «clientId» tiene que ser un UUID.'

async function whoIsAsking(request: Request, clientId: string, ipSecret: string): Promise<Who> {
  return { clientId, ipKey: await ipKey(request.headers.get('CF-Connecting-IP'), ipSecret) }
}

/** For answers that refuse the request anyway: without the ledger they just go out without a quota. */
async function quotaIfAvailable(client: LimitsClient, who: Who): Promise<QuotaInfo | undefined> {
  try {
    return await client.peek(who)
  } catch (error) {
    console.error('afterhours-ai: no se pudo leer el cupo', error)
    return undefined
  }
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const body = await readBody(request)
  if (!isClientId(body?.clientId)) return fail('invalid_params', 400, CLIENT_ID_MESSAGE)

  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) return fail('missing_key', 500, 'Falta cargar el secreto GEMINI_API_KEY en el Worker.')

  const settings = readSettings(env, apiKey)
  const access = readLimits(env)
  const turnstileSecret = env.TURNSTILE_SECRET_KEY?.trim() || null
  if ('missing' in settings || 'missing' in access || turnstileSecret === null) {
    const missing = [
      ...('missing' in settings ? settings.missing : []),
      ...('missing' in access ? access.missing : []),
      ...(turnstileSecret === null ? ['TURNSTILE_SECRET_KEY'] : []),
    ]
    return fail('missing_config', 500, `Faltan o no son válidas estas variables del Worker: ${missing.join(', ')}.`)
  }

  const { client } = access
  const who = await whoIsAsking(request, body.clientId, access.ipSecret)

  const concept = readConcept(body)
  if (concept === null) {
    return fail('invalid_params', 400, `El campo «concept» tiene que ser un texto de entre ${CONCEPT_MIN} y ${CONCEPT_MAX} caracteres.`, {
      quota: await quotaIfAvailable(client, who),
    })
  }

  const captcha = await verifyTurnstile(body.turnstileToken, turnstileSecret, request.headers.get('CF-Connecting-IP'))
  if (!captcha.ok) {
    console.error(JSON.stringify({ event: 'captcha_failed', reason: captcha.reason }))
    return fail('captcha_failed', 403, 'No pudimos verificar que sos una persona. Probá de nuevo.', {
      quota: await quotaIfAvailable(client, who),
    })
  }

  // If the ledger fails this throws, on purpose: without it, Gemini is not called.
  const reservation = await client.reserve(who)
  if (!reservation.ok) {
    return reservation.code === 'global_limit'
      ? fail('global_limit', 429, 'La IA llegó a su límite de hoy. La app sigue funcionando en modo clásico.', { quota: reservation.quota })
      : fail('quota_exceeded', 429, 'Ya usaste tus intentos de IA por ahora. La app sigue funcionando en modo clásico.', { quota: reservation.quota })
  }

  const started = Date.now()
  const generation = await generate(
    { systemPrompt: SYSTEM_PROMPT, concept, responseSchema: RESPONSE_SCHEMA },
    settings,
    CATALOG,
    SCHEMA,
  )
  const totalMs = Date.now() - started

  // Before answering, so a valid brandbook never leaves without being charged. If it fails, the
  // brandbook still goes out, because Gemini is already paid for. The hold will expire without
  // charging the user and leave the worst case counted, which is what `reservation.quota` says for now.
  const { result, calls } = generation
  let settlement: Settlement | null = null
  try {
    settlement = await client.settle(reservation.holdId, who, { valid: result.ok, calls: calls.length })
  } catch (error) {
    console.error('afterhours-ai: no se pudo cerrar la reserva', error)
  }
  logGeneration(generation, totalMs, settlement)
  const quota = settlement?.quota ?? reservation.quota

  if (result.ok) {
    const response: GenerateResponse = { ...result.response, ...quota }
    return json(response)
  }
  if (result.code === 'ai_invalid_output') {
    return fail('ai_invalid_output', 502, 'La IA devolvió una propuesta que no pasó la validación. Probá de nuevo.', { quota })
  }
  return fail('ai_unavailable', 503, 'La IA no está disponible en este momento. Probá de nuevo en unos minutos.', {
    upstreamStatus: result.upstreamStatus,
    quota,
  })
}

async function handleQuota(request: Request, url: URL, env: Env): Promise<Response> {
  const clientId = url.searchParams.get('clientId')
  if (!isClientId(clientId)) return fail('invalid_params', 400, CLIENT_ID_MESSAGE)

  const access = readLimits(env)
  if ('missing' in access) {
    return fail('missing_config', 500, `Faltan o no son válidas estas variables del Worker: ${access.missing.join(', ')}.`)
  }
  const quota: QuotaInfo = await access.client.peek(await whoIsAsking(request, clientId, access.ipSecret))
  return json(quota)
}

// ─── Entry point ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin')
    const allowed = origin !== null && allowedOrigins(env).includes(origin)

    // `/` stays open to anyone as a status check; it never touches Gemini.
    if (url.pathname === '/' && request.method === 'GET') {
      const status = json({
        service: 'afterhours-ai',
        ok: true,
        keyConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
        endpoints: ['/generate', '/quota'],
      })
      return withCors(status, allowed ? origin : null)
    }

    // Requests without Origin (a browser tab, curl, scripts) are refused too: the Worker URL
    // is public in the site's JavaScript and every generation costs money.
    if (!allowed) {
      return fail(
        'origin_not_allowed',
        403,
        origin === null
          ? 'Este servicio solo responde a la web de AFTERHOURS (el pedido no trae la cabecera Origin).'
          : `El origen ${origin} no tiene permiso para usar este servicio.`,
      )
    }

    if (request.method === 'OPTIONS') {
      return withCors(
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        }),
        origin,
      )
    }

    let response: Response
    try {
      if (url.pathname === '/generate') {
        response = request.method === 'POST' ? await handleGenerate(request, env) : fail('method_not_allowed', 405, 'Solo se aceptan pedidos POST.')
      } else if (url.pathname === '/quota') {
        response = request.method === 'GET' ? await handleQuota(request, url, env) : fail('method_not_allowed', 405, 'Solo se aceptan pedidos GET.')
      } else {
        response = fail('not_found', 404, 'Esta dirección no existe. Usá /generate o /quota.')
      }
    } catch (error) {
      console.error('afterhours-ai: error inesperado', error)
      response = fail('ai_unavailable', 500, 'Algo falló dentro del Worker.')
    }
    return withCors(response, origin)
  },
} satisfies ExportedHandler<Env>
