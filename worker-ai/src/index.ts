/**
 * AFTERHOURS AI Worker.
 *
 *   POST /generate { concept } -> { brandbook, model, latency_ms, tokens_in, tokens_out, tokens_thoughts }
 *
 * The Gemini key lives in the GEMINI_API_KEY secret. /generate only answers requests whose
 * Origin is listed in ALLOWED_ORIGINS; `/` is an open status check.
 */
import SCHEMA from '../../shared/ai/brandbook.schema.json'
import TEMPLATE from '../../shared/ai/brandbook_system_prompt_v4.md'
import type { AiErrorBody, AiErrorCode } from '../../shared/types.ts'
import { PALETTES } from '../../src/data/palettes.ts'
import { TYPE_PAIRS } from '../../src/data/typePairs.ts'
import { toGeminiSchema } from './gemini.ts'
import { generate } from './generate.ts'
import type { Generation, GenerationSettings } from './generate.ts'
import { renderSystemPrompt } from './prompt.ts'

export interface Env {
  GEMINI_API_KEY?: string
  GEMINI_MODEL?: string
  GEMINI_FALLBACK_MODEL?: string
  ALLOWED_ORIGINS?: string
  AI_TIMEOUT_BUDGET_MS?: string
  AI_ATTEMPT_TIMEOUT_MS?: string
  AI_MIN_ATTEMPT_MS?: string
  AI_BACKOFF_BASE_MS?: string
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

function fail(code: AiErrorCode, status: number, message: string, extra: { upstreamStatus?: number } = {}): Response {
  const body: AiErrorBody = { error: { code, message, ...extra } }
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

/** D9: the numbers live in the environment, so there are no defaults to fall back to. */
function readSettings(env: Env, apiKey: string): GenerationSettings | { missing: string[] } {
  const model = env.GEMINI_MODEL?.trim() || null
  const budgetMs = positiveInt(env.AI_TIMEOUT_BUDGET_MS)
  const attemptTimeoutMs = positiveInt(env.AI_ATTEMPT_TIMEOUT_MS)
  const minAttemptMs = positiveInt(env.AI_MIN_ATTEMPT_MS)
  const backoffBaseMs = positiveInt(env.AI_BACKOFF_BASE_MS)
  if (model === null || budgetMs === null || attemptTimeoutMs === null || minAttemptMs === null || backoffBaseMs === null) {
    const checks: [string, unknown][] = [
      ['GEMINI_MODEL', model],
      ['AI_TIMEOUT_BUDGET_MS', budgetMs],
      ['AI_ATTEMPT_TIMEOUT_MS', attemptTimeoutMs],
      ['AI_MIN_ATTEMPT_MS', minAttemptMs],
      ['AI_BACKOFF_BASE_MS', backoffBaseMs],
    ]
    return { missing: checks.filter(([, value]) => value === null).map(([name]) => name) }
  }
  const fallbackModel = env.GEMINI_FALLBACK_MODEL?.trim() || null
  return { apiKey, model, fallbackModel, budgetMs, attemptTimeoutMs, minAttemptMs, backoffBaseMs }
}

// ─── Log ────────────────────────────────────────────────────────────────────

/**
 * One line per request that reached Gemini, whatever the outcome: W2's global cap has to
 * count calls and tokens, because failed requests are not charged to the user (D7) but do
 * cost money. Never holds the concept or the key.
 */
function logGeneration({ result, rounds, calls }: Generation, totalMs: number): void {
  const sum = (field: 'tokens_in' | 'tokens_out' | 'tokens_thoughts') => calls.reduce((acc, call) => acc + call[field], 0)
  console.log(
    JSON.stringify({
      event: 'generate',
      outcome: result.ok ? 'ok' : result.code,
      model: result.ok ? result.response.model : null,
      upstream_status: result.ok ? null : (result.upstreamStatus ?? null),
      rounds,
      gemini_calls: calls.length,
      tokens_in: sum('tokens_in'),
      tokens_out: sum('tokens_out'),
      tokens_thoughts: sum('tokens_thoughts'),
      total_ms: totalMs,
      calls,
    }),
  )
}

// ─── Handlers ───────────────────────────────────────────────────────────────

/** The trimmed concept, or null if the body doesn't carry a usable one. */
async function readConcept(request: Request): Promise<string | null> {
  let body: { concept?: unknown } | null
  try {
    body = (await request.json()) as { concept?: unknown } | null
  } catch {
    return null
  }
  if (typeof body?.concept !== 'string') return null
  const concept = body.concept.trim()
  const length = [...concept].length
  return length >= CONCEPT_MIN && length <= CONCEPT_MAX ? concept : null
}

async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const concept = await readConcept(request)
  if (concept === null) {
    return fail('invalid_params', 400, `El campo «concept» tiene que ser un texto de entre ${CONCEPT_MIN} y ${CONCEPT_MAX} caracteres.`)
  }

  const apiKey = env.GEMINI_API_KEY?.trim()
  if (!apiKey) return fail('missing_key', 500, 'Falta cargar el secreto GEMINI_API_KEY en el Worker.')

  const settings = readSettings(env, apiKey)
  if ('missing' in settings) {
    return fail('missing_config', 500, `Faltan o no son válidas estas variables del Worker: ${settings.missing.join(', ')}.`)
  }

  const started = Date.now()
  const generation = await generate(
    { systemPrompt: SYSTEM_PROMPT, concept, responseSchema: RESPONSE_SCHEMA },
    settings,
    CATALOG,
    SCHEMA,
  )
  logGeneration(generation, Date.now() - started)

  const { result } = generation
  if (result.ok) return json(result.response)
  if (result.code === 'ai_invalid_output') {
    return fail('ai_invalid_output', 502, 'La IA devolvió una propuesta que no pasó la validación. Probá de nuevo.')
  }
  const extra = result.upstreamStatus === undefined ? {} : { upstreamStatus: result.upstreamStatus }
  return fail('ai_unavailable', 503, 'La IA no está disponible en este momento. Probá de nuevo en unos minutos.', extra)
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
        endpoints: ['/generate'],
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
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        }),
        origin,
      )
    }

    let response: Response
    try {
      if (url.pathname !== '/generate') response = fail('not_found', 404, 'Esta dirección no existe. Usá /generate.')
      else if (request.method !== 'POST') response = fail('method_not_allowed', 405, 'Solo se aceptan pedidos POST.')
      else response = await handleGenerate(request, env)
    } catch (error) {
      console.error('afterhours-ai: error inesperado', error)
      response = fail('ai_unavailable', 500, 'Algo falló dentro del Worker.')
    }
    return withCors(response, origin)
  },
} satisfies ExportedHandler<Env>
