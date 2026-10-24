/**
 * AFTERHOURS search Worker.
 *
 * Proxies Unsplash so the access key never reaches the browser:
 *   GET /search?query=…&per_page=15&page=1  → { total, photos }
 *   GET /download?id=…                      → { url } (Unsplash's required download ping)
 *
 * The key lives in the UNSPLASH_ACCESS_KEY secret. Only the origins listed in
 * ALLOWED_ORIGINS get CORS access.
 */
import type { ApiErrorBody, ApiErrorCode, DownloadResponse, Photo, SearchResponse } from '../../shared/types'

export interface Env {
  UNSPLASH_ACCESS_KEY?: string
  ALLOWED_ORIGINS?: string
}

const DEFAULT_ORIGINS = ['https://nachodeco6-beep.github.io', 'http://localhost:5173']
const UNSPLASH_API = 'https://api.unsplash.com'
const CACHE_SECONDS = 60 * 60
const TIMEOUT_MS = 8000
const QUERY_MAX = 100
const PER_PAGE_DEFAULT = 15
const PER_PAGE_MAX = 30
const PAGE_MAX = 100
const MEMORY_MAX = 100

// ─── Responses ──────────────────────────────────────────────────────────────

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

function fail(
  code: ApiErrorCode,
  status: number,
  message: string,
  extra: { upstreamStatus?: number; rateLimitRemaining?: number } = {},
): Response {
  const body: ApiErrorBody = { error: { code, message, ...extra } }
  return json(body, status, { 'Cache-Control': 'no-store' })
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
  if (origin) {
    res.headers.set('Access-Control-Allow-Origin', origin)
    res.headers.set('Access-Control-Expose-Headers', 'X-Cache, X-Ratelimit-Remaining')
  }
  res.headers.append('Vary', 'Origin')
  return res
}

// ─── Unsplash ───────────────────────────────────────────────────────────────

interface UnsplashPhoto {
  id: string
  width: number
  height: number
  color: string | null
  alt_description: string | null
  description: string | null
  urls: { thumb: string; small: string; regular: string; full: string }
  links: { html: string }
  user: { name: string; links: { html: string } }
}

function withUtm(link: string): string {
  const url = new URL(link)
  url.searchParams.set('utm_source', 'afterhours')
  url.searchParams.set('utm_medium', 'referral')
  return url.toString()
}

function isUnsplashPhoto(v: unknown): v is UnsplashPhoto {
  const p = v as UnsplashPhoto | null
  return Boolean(
    p &&
      typeof p.id === 'string' &&
      typeof p.width === 'number' &&
      typeof p.height === 'number' &&
      p.urls &&
      typeof p.urls.small === 'string' &&
      typeof p.urls.regular === 'string' &&
      p.links &&
      typeof p.links.html === 'string' &&
      p.user &&
      typeof p.user.name === 'string' &&
      p.user.links &&
      typeof p.user.links.html === 'string',
  )
}

function normalizePhoto(raw: unknown): Photo | null {
  if (!isUnsplashPhoto(raw)) return null
  const text = (raw.alt_description || raw.description || '').trim()
  const alt = text ? text.charAt(0).toUpperCase() + text.slice(1) : `Foto de ${raw.user.name}`
  return {
    id: `unsplash:${raw.id}`,
    source: 'unsplash',
    width: raw.width,
    height: raw.height,
    color: raw.color && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : null,
    alt,
    // hotlinked exactly as Unsplash sends them (ixid included)
    urls: { thumb: raw.urls.thumb, small: raw.urls.small, regular: raw.urls.regular, full: raw.urls.full },
    author: { name: raw.user.name, profileUrl: withUtm(raw.user.links.html) },
    pageUrl: withUtm(raw.links.html),
    unsplashId: raw.id,
  }
}

async function callUnsplash(path: string, key: string): Promise<Response | null> {
  try {
    return await fetch(`${UNSPLASH_API}${path}`, {
      headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return null // network error or timeout
  }
}

async function upstreamError(res: Response): Promise<Response> {
  const header = res.headers.get('X-Ratelimit-Remaining')
  const remaining = header !== null && header.trim() !== '' && Number.isFinite(Number(header)) ? Number(header) : undefined
  const extra = { upstreamStatus: res.status, ...(remaining !== undefined ? { rateLimitRemaining: remaining } : {}) }
  const text = await res.text().catch(() => '')

  if (res.status === 401) {
    return fail('invalid_key', 502, 'Unsplash rechazó la clave. Revisá que el secreto UNSPLASH_ACCESS_KEY sea la «Access Key» de tu app.', extra)
  }
  if (res.status === 429 || (res.status === 403 && (remaining === 0 || /rate limit/i.test(text)))) {
    return fail('rate_limited', 429, 'Se alcanzó el límite de pedidos a Unsplash por esta hora. Probá de nuevo más tarde.', extra)
  }
  if (res.status === 404) {
    return fail('not_found', 404, 'Unsplash no encontró lo que pediste.', extra)
  }
  if (res.status >= 500) {
    return fail('unsplash_error', 502, `Unsplash no está respondiendo bien (error ${res.status}). Probá en unos minutos.`, extra)
  }
  return fail('unsplash_error', 502, `Unsplash rechazó el pedido (error ${res.status}).`, extra)
}

// ─── Caching ────────────────────────────────────────────────────────────────
// The Cache API only works when the Worker runs on a custom domain; on
// *.workers.dev it silently does nothing. A small in-memory cache per isolate
// covers that case on a best-effort basis, and Cache-Control lets browsers
// reuse responses too.

const memory = new Map<string, { expires: number; body: string; remaining: string | null }>()

function rememberInMemory(key: string, body: string, remaining: string | null) {
  memory.delete(key)
  memory.set(key, { expires: Date.now() + CACHE_SECONDS * 1000, body, remaining })
  while (memory.size > MEMORY_MAX) memory.delete(memory.keys().next().value as string)
}

function edgeCache(): Cache | null {
  return typeof caches !== 'undefined' && 'default' in caches ? (caches as unknown as { default: Cache }).default : null
}

function cachedResponse(body: string, source: 'HIT' | 'MISS', remaining: string | null): Response {
  const headers: Record<string, string> = { 'Cache-Control': `public, max-age=${CACHE_SECONDS}`, 'X-Cache': source }
  if (remaining !== null) headers['X-Ratelimit-Remaining'] = remaining
  return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } })
}

// ─── Handlers ───────────────────────────────────────────────────────────────

function intParam(url: URL, name: string, fallback: number, min: number, max: number): number | null {
  const raw = url.searchParams.get(name)
  if (raw === null || raw === '') return fallback
  if (!/^\d+$/.test(raw)) return null
  const n = Number(raw)
  return n >= min && n <= max ? n : null
}

async function handleSearch(url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const query = (url.searchParams.get('query') ?? '').trim().replace(/\s+/g, ' ')
  if (query.length < 1 || query.length > QUERY_MAX) {
    return fail('invalid_params', 400, `El parámetro «query» tiene que tener entre 1 y ${QUERY_MAX} caracteres.`)
  }
  const perPage = intParam(url, 'per_page', PER_PAGE_DEFAULT, 1, PER_PAGE_MAX)
  if (perPage === null) return fail('invalid_params', 400, `El parámetro «per_page» tiene que ser un número entre 1 y ${PER_PAGE_MAX}.`)
  const page = intParam(url, 'page', 1, 1, PAGE_MAX)
  if (page === null) return fail('invalid_params', 400, `El parámetro «page» tiene que ser un número entre 1 y ${PAGE_MAX}.`)

  const key = env.UNSPLASH_ACCESS_KEY?.trim()
  if (!key) return fail('missing_key', 500, 'Falta cargar el secreto UNSPLASH_ACCESS_KEY en el Worker.')

  const normalized = query.toLowerCase()
  const params = new URLSearchParams({ query: normalized, per_page: String(perPage), page: String(page) })
  const cacheKey = `${url.origin}/search?${params}`

  const fromMemory = memory.get(cacheKey)
  if (fromMemory && fromMemory.expires > Date.now()) return cachedResponse(fromMemory.body, 'HIT', null)

  const cache = edgeCache()
  const hit = cache ? await cache.match(cacheKey).catch(() => undefined) : undefined
  if (hit) {
    const body = await hit.text()
    rememberInMemory(cacheKey, body, null)
    return cachedResponse(body, 'HIT', null)
  }

  params.set('content_filter', 'high')
  const res = await callUnsplash(`/search/photos?${params}`, key)
  if (!res) return fail('unsplash_unreachable', 503, 'No pudimos comunicarnos con Unsplash. Probá de nuevo en unos minutos.')
  if (!res.ok) return upstreamError(res)

  let data: { total?: unknown; results?: unknown }
  try {
    data = await res.json()
  } catch {
    return fail('unsplash_error', 502, 'Unsplash respondió algo que no pudimos leer.', { upstreamStatus: res.status })
  }
  const photos = Array.isArray(data.results) ? data.results.map(normalizePhoto).filter((p): p is Photo => p !== null) : []
  const payload: SearchResponse = { total: typeof data.total === 'number' ? data.total : photos.length, photos }
  const body = JSON.stringify(payload)
  const remaining = res.headers.get('X-Ratelimit-Remaining')

  rememberInMemory(cacheKey, body, remaining)
  if (cache) ctx.waitUntil(cache.put(cacheKey, cachedResponse(body, 'HIT', null)).catch(() => undefined))
  return cachedResponse(body, 'MISS', remaining)
}

async function handleDownload(url: URL, env: Env): Promise<Response> {
  const id = (url.searchParams.get('id') ?? '').replace(/^unsplash:/, '')
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return fail('invalid_params', 400, 'El parámetro «id» no es un identificador de Unsplash válido.')
  }
  const key = env.UNSPLASH_ACCESS_KEY?.trim()
  if (!key) return fail('missing_key', 500, 'Falta cargar el secreto UNSPLASH_ACCESS_KEY en el Worker.')

  const res = await callUnsplash(`/photos/${id}/download`, key)
  if (!res) return fail('unsplash_unreachable', 503, 'No pudimos comunicarnos con Unsplash. Probá de nuevo en unos minutos.')
  if (!res.ok) return upstreamError(res)

  const data = (await res.json().catch(() => null)) as { url?: unknown } | null
  if (!data || typeof data.url !== 'string') {
    return fail('unsplash_error', 502, 'Unsplash respondió algo que no pudimos leer.', { upstreamStatus: res.status })
  }
  const body: DownloadResponse = { url: data.url }
  return json(body, 200, { 'Cache-Control': 'no-store' })
}

// ─── Entry point ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin')
    // Browsers always send Origin on cross-origin fetches; unknown sites are refused.
    // Requests without Origin (opening the URL in a tab, curl) are served without CORS headers.
    if (origin !== null && !allowedOrigins(env).includes(origin)) {
      return fail('origin_not_allowed', 403, `El origen ${origin} no tiene permiso para usar esta búsqueda.`)
    }

    if (request.method === 'OPTIONS') {
      return withCors(
        new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400',
          },
        }),
        origin,
      )
    }
    if (request.method !== 'GET') {
      return withCors(fail('method_not_allowed', 405, 'Solo se aceptan pedidos GET.'), origin)
    }

    const url = new URL(request.url)
    let response: Response
    try {
      if (url.pathname === '/search') response = await handleSearch(url, env, ctx)
      else if (url.pathname === '/download') response = await handleDownload(url, env)
      else if (url.pathname === '/')
        response = json({
          service: 'afterhours-search',
          ok: true,
          keyConfigured: Boolean(env.UNSPLASH_ACCESS_KEY?.trim()),
          endpoints: ['/search?query=…&per_page=15&page=1', '/download?id=…'],
        })
      else response = fail('not_found', 404, 'Esta dirección no existe. Usá /search o /download.')
    } catch {
      response = fail('unsplash_error', 500, 'Algo falló dentro del Worker.')
    }
    return withCors(response, origin)
  },
} satisfies ExportedHandler<Env>
