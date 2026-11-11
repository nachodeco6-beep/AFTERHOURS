/**
 * Client of the AI Worker (worker-ai/): POST /generate and GET /quota.
 * Pure apart from the transport handed in (base URL and fetch), so it can be
 * tested without a browser and without the Worker. Reading the env is
 * aiConfig.ts's job; this file never touches import.meta.env.
 */
import type { AiErrorBody, AiErrorCode, Brandbook, GenerateRequest, GenerateResponse, QuotaInfo } from '../../shared/types.ts'
import { MOODS, type Mood } from '../data/moods.ts'
import { PALETTES } from '../data/palettes.ts'
import { pairById } from './pairing.ts'
import type { KeyValue } from './saved.ts'

/**
 * The Worker holds a quota reservation for QUOTA_HOLD_MS (35 s) at most: a
 * request older than that is already dead on the server, so the client waits
 * just a little longer before giving up.
 */
export const AI_CLIENT_TIMEOUT_MS = 36_000

export type AiFailureCode = AiErrorCode | 'network' | 'bad_response' | 'not_configured' | 'timeout'

/** What the visitor reads, per error code. The final wording is Nacho's (W3b). */
const MESSAGES: Record<AiFailureCode, string> = {
  invalid_params: 'El concepto tiene que tener entre 3 y 500 caracteres.',
  origin_not_allowed: 'La IA no acepta pedidos desde esta página. Revisá ALLOWED_ORIGINS en el Worker.',
  not_found: 'La IA no reconoce este pedido. Revisá la dirección configurada.',
  method_not_allowed: 'La IA no reconoce este pedido. Revisá la dirección configurada.',
  missing_key: 'El Worker de IA no tiene cargada su clave. Revisá la configuración.',
  missing_config: 'Al Worker de IA le falta configuración. Revisá sus variables.',
  ai_invalid_output: 'La IA no logró armar una propuesta válida. Probá de nuevo en un rato.',
  ai_unavailable: 'La IA no está disponible en este momento. El resto de la página sigue andando.',
  captcha_failed: 'No pudimos verificar que sos una persona. Recargá la página y probá de nuevo.',
  quota_exceeded: 'Usaste tus generaciones de hoy.',
  global_limit: 'La IA llegó a su límite diario. El resto de la página sigue andando.',
  network: 'No pudimos conectarnos con la IA. Revisá tu conexión e intentá de nuevo.',
  bad_response: 'La IA respondió algo inesperado. Intentá de nuevo.',
  not_configured: 'La IA todavía no está conectada.',
  timeout: 'La IA tardó demasiado en responder. Probá de nuevo en un rato.',
}

export class AiFailure extends Error {
  readonly code: AiFailureCode
  /** Attempts left, when the Worker said so (it may not know: null). */
  readonly remaining: number | null
  /** ISO in UTC: when the next attempt comes back. */
  readonly resetAt: string | null

  constructor(code: AiFailureCode, quota: Partial<QuotaInfo> = {}) {
    super(MESSAGES[code])
    this.code = code
    this.remaining = typeof quota.remaining === 'number' ? quota.remaining : null
    this.resetAt = typeof quota.resetAt === 'string' ? quota.resetAt : null
  }
}

/** Base URL and fetch handed in (the app passes aiConfig's URL and the browser's fetch). */
export interface AiTransport {
  baseUrl: string | null
  fetchFn?: typeof fetch
  /** Tests shorten it; the app keeps the default. */
  timeoutMs?: number
}

// ─── Defensive checks of what the Worker answers ────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const phraseList = (v: unknown): v is string[] => Array.isArray(v) && v.length > 0 && v.every((s) => str(s) && s.trim() !== '')

/**
 * A brandbook this version of the web can apply: right shape and, above all,
 * pair_id and palette_id that exist in *this* catalogue (an older deploy may
 * not know ids a newer Worker chose).
 */
export function isUsableBrandbook(v: unknown): v is Brandbook {
  return (
    isObj(v) &&
    str(v.mood) &&
    MOODS.includes(v.mood as Mood) &&
    typeof v.pair_id === 'number' &&
    pairById(v.pair_id) !== undefined &&
    str(v.palette_id) &&
    PALETTES.some((p) => p.id === v.palette_id) &&
    phraseList(v.concepts) &&
    phraseList(v.search_queries) &&
    phraseList(v.applications) &&
    str(v.rationale) &&
    v.rationale.trim() !== ''
  )
}

const quotaOf = (v: Record<string, unknown>): Partial<QuotaInfo> => ({
  remaining: typeof v.remaining === 'number' ? v.remaining : undefined,
  resetAt: str(v.resetAt) ? v.resetAt : v.resetAt === null ? null : undefined,
})

function errorOf(body: unknown): AiErrorBody['error'] | null {
  const err = isObj(body) && isObj(body.error) ? body.error : null
  return err && str(err.code) && err.code in MESSAGES ? (err as unknown as AiErrorBody['error']) : null
}

// ─── Requests ───────────────────────────────────────────────────────────────

/**
 * fetch with this client's rules: not_configured without a URL, network on a
 * connection error, timeout past timeoutMs. An abort by the caller rethrows.
 */
async function request(path: string, init: RequestInit, t: AiTransport, signal?: AbortSignal): Promise<Response> {
  if (!t.baseUrl) throw new AiFailure('not_configured')
  const fetchFn = t.fetchFn ?? fetch
  const ac = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    ac.abort()
  }, t.timeoutMs ?? AI_CLIENT_TIMEOUT_MS)
  const onAbort = () => ac.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    return await fetchFn(`${t.baseUrl}${path}`, { ...init, signal: ac.signal })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new AiFailure(timedOut ? 'timeout' : 'network')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/** Reads an error answer; res is known not-ok. */
async function failureOf(res: Response): Promise<AiFailure> {
  const body: unknown = await res.json().catch(() => null)
  const err = errorOf(body)
  if (err) return new AiFailure(err.code, quotaOf(body as Record<string, unknown>))
  return new AiFailure(res.status === 429 ? 'quota_exceeded' : 'bad_response')
}

/**
 * One generation. Resolves with the Worker's answer (a brandbook, or
 * fuera_de_tema when the request isn't a brand, D16); throws AiFailure for
 * everything else. Every call needs a fresh turnstileToken, retries too.
 */
export async function generate(req: GenerateRequest, t: AiTransport, signal?: AbortSignal): Promise<GenerateResponse> {
  const res = await request(
    '/generate',
    { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(req) },
    t,
    signal,
  )
  if (!res.ok) throw await failureOf(res)
  const body: unknown = await res.json().catch(() => null)
  if (!isObj(body)) throw new AiFailure('bad_response')
  if ('brandbook' in body) {
    if (!isUsableBrandbook(body.brandbook)) throw new AiFailure('bad_response')
    return body as unknown as GenerateResponse
  }
  if (body.fuera_de_tema === true) return body as unknown as GenerateResponse
  throw new AiFailure('bad_response')
}

/** The attempts left, without spending one. */
export async function getQuota(clientId: string, t: AiTransport, signal?: AbortSignal): Promise<QuotaInfo> {
  const res = await request(`/quota?clientId=${encodeURIComponent(clientId)}`, { headers: { Accept: 'application/json' } }, t, signal)
  if (!res.ok) throw await failureOf(res)
  const body: unknown = await res.json().catch(() => null)
  if (!isObj(body) || typeof body.remaining !== 'number' || !(str(body.resetAt) || body.resetAt === null)) throw new AiFailure('bad_response')
  return { remaining: body.remaining, resetAt: body.resetAt }
}

// ─── clientId ───────────────────────────────────────────────────────────────

export const CLIENT_ID_KEY = 'afterhours.clientId'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Kept for the visit when there's no storage, so retries count as one browser. */
let visitId: string | null = null

/**
 * The browser's random id for the free quota (the Worker only takes a UUID).
 * Stored once in localStorage; without storage, one id per visit.
 */
export function getClientId(storage: KeyValue | null): string {
  if (storage) {
    try {
      const stored = storage.getItem(CLIENT_ID_KEY)
      if (stored && UUID.test(stored)) return stored
      const fresh = crypto.randomUUID()
      storage.setItem(CLIENT_ID_KEY, fresh)
      return fresh
    } catch {
      // fall through to the per-visit id
    }
  }
  visitId ??= crypto.randomUUID()
  return visitId
}
