import type { ApiErrorBody, ApiErrorCode, Photo, SearchResponse } from '../../shared/types'

/** Photos per tag. */
export const PER_PAGE = 15

function baseUrl(raw: string | undefined): string | null {
  const value = raw?.trim()
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

const RAW_URL = import.meta.env.VITE_SEARCH_API_URL

/** Worker base URL, or null when search isn't connected (demo mode). */
export const SEARCH_API_URL = baseUrl(RAW_URL)

/** VITE_SEARCH_API_URL is set but isn't a usable http(s) address. */
export const SEARCH_URL_INVALID = Boolean(RAW_URL?.trim()) && SEARCH_API_URL === null

export type FailureCode = ApiErrorCode | 'network' | 'bad_response' | 'not_configured'

export class SearchFailure extends Error {
  readonly code: FailureCode
  readonly rateLimitRemaining?: number

  constructor(code: FailureCode, rateLimitRemaining?: number) {
    super(MESSAGES[code])
    this.code = code
    this.rateLimitRemaining = rateLimitRemaining
  }
}

/** What the visitor reads, per error code. */
const MESSAGES: Record<FailureCode, string> = {
  rate_limited: 'Se alcanzó el límite de búsquedas de Unsplash por esta hora. Probá de nuevo más tarde.',
  missing_key: 'El buscador no tiene cargada la clave de Unsplash. Revisá la configuración del Worker.',
  invalid_key: 'Unsplash rechazó la clave del buscador. Revisá la configuración del Worker.',
  origin_not_allowed: 'El buscador no acepta pedidos desde esta página. Revisá ALLOWED_ORIGINS en el Worker.',
  unsplash_error: 'Unsplash no está respondiendo bien en este momento. Probá de nuevo en unos minutos.',
  unsplash_unreachable: 'No pudimos comunicarnos con Unsplash. Probá de nuevo en unos minutos.',
  invalid_params: 'Esta etiqueta no se puede buscar. Probá escribiéndola de otra forma.',
  not_found: 'El buscador no reconoce este pedido. Revisá la dirección configurada.',
  method_not_allowed: 'El buscador no reconoce este pedido. Revisá la dirección configurada.',
  network: 'No pudimos conectarnos con el buscador. Revisá tu conexión e intentá de nuevo.',
  bad_response: 'El buscador respondió algo inesperado. Intentá de nuevo.',
  not_configured: 'La búsqueda todavía no está conectada.',
}

function isPhoto(v: unknown): v is Photo {
  const p = v as Photo | null
  return Boolean(
    p &&
      typeof p.id === 'string' &&
      typeof p.width === 'number' &&
      typeof p.height === 'number' &&
      p.width > 0 &&
      p.height > 0 &&
      p.urls &&
      typeof p.urls.small === 'string' &&
      typeof p.urls.regular === 'string' &&
      p.author &&
      typeof p.author.name === 'string' &&
      typeof p.author.profileUrl === 'string' &&
      typeof p.pageUrl === 'string',
  )
}

function errorCode(body: unknown): ApiErrorBody['error'] | null {
  const err = (body as ApiErrorBody | null)?.error
  return err && typeof err.code === 'string' && err.code in MESSAGES ? err : null
}

/** One search = one request to the Worker = (at most) one request to Unsplash. */
export async function searchPhotos(query: string, signal?: AbortSignal): Promise<SearchResponse> {
  if (!SEARCH_API_URL) throw new SearchFailure('not_configured')
  const params = new URLSearchParams({ query, per_page: String(PER_PAGE), page: '1' })

  let res: Response
  try {
    res = await fetch(`${SEARCH_API_URL}/search?${params}`, { signal, headers: { Accept: 'application/json' } })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new SearchFailure('network')
  }

  const body: unknown = await res.json().catch(() => null)
  if (!res.ok) {
    const err = errorCode(body)
    if (err) throw new SearchFailure(err.code, err.rateLimitRemaining)
    throw new SearchFailure(res.status === 429 ? 'rate_limited' : 'bad_response')
  }

  const data = body as Partial<SearchResponse> | null
  if (!data || !Array.isArray(data.photos)) throw new SearchFailure('bad_response')
  const photos = data.photos.filter(isPhoto)
  return { total: typeof data.total === 'number' ? data.total : photos.length, photos }
}
