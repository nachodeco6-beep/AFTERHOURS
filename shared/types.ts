/**
 * Types shared by the Workers (worker/, worker-ai/) and the front end (src/).
 * Type-only: nothing here ends up in any bundle.
 */
import type { Mood } from '../src/data/moods.ts'

export interface PhotoUrls {
  /** ~200 px wide */
  thumb: string
  /** ~400 px wide */
  small: string
  /** ~1080 px wide */
  regular: string
  /** original size */
  full: string
}

/** A photo normalised from the Unsplash API. URLs are hotlinked untouched (ixid included). */
export interface Photo {
  /** 'unsplash:<id>' */
  id: string
  source: 'unsplash'
  width: number
  height: number
  /** Dominant colour as HEX, as sent by Unsplash */
  color: string | null
  alt: string
  urls: PhotoUrls
  /** profileUrl carries the UTM referral parameters */
  author: { name: string; profileUrl: string }
  /** The photo's page on Unsplash, with UTM referral parameters */
  pageUrl: string
  /** Raw Unsplash id, needed for /download */
  unsplashId: string
}

export interface SearchResponse {
  total: number
  photos: Photo[]
}

export interface DownloadResponse {
  url: string
}

export type ApiErrorCode =
  | 'invalid_params'
  | 'origin_not_allowed'
  | 'not_found'
  | 'method_not_allowed'
  | 'missing_key'
  | 'invalid_key'
  | 'rate_limited'
  | 'unsplash_error'
  | 'unsplash_unreachable'

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode
    message: string
    /** HTTP status Unsplash answered with, when the error came from Unsplash */
    upstreamStatus?: number
    /** Value of Unsplash's X-Ratelimit-Remaining header, when present */
    rateLimitRemaining?: number
  }
}

// ─── AI Worker (worker-ai/) ─────────────────────────────────────────────────

/** Art direction chosen by the model. Mirrors shared/ai/brandbook.schema.json. */
export interface Brandbook {
  /** Always the mood of the chosen palette */
  mood: Mood
  /** Id of an entry in TYPE_PAIRS */
  pair_id: number
  /** Id of an entry in PALETTES */
  palette_id: string
  /** 2 to 4 brand phrases in Spanish */
  concepts: string[]
  /** 2 to 4 Unsplash searches in English */
  search_queries: string[]
  /** 1 to 6 lowercase slugs (web, social, print…) */
  applications: string[]
  rationale: string
}

export interface GenerateRequest {
  /** The idea in natural language, 3 to 500 characters */
  concept: string
}

export interface GenerateResponse {
  brandbook: Brandbook
  /** The Gemini model that answered */
  model: string
  latency_ms: number
  tokens_in: number
  tokens_out: number
}

export type AiErrorCode =
  | 'invalid_params'
  | 'origin_not_allowed'
  | 'not_found'
  | 'method_not_allowed'
  | 'missing_key'
  | 'ai_invalid_output'
  | 'ai_unavailable'

export interface AiErrorBody {
  error: {
    code: AiErrorCode
    message: string
    /** HTTP status Gemini answered with, when the error came from Gemini */
    upstreamStatus?: number
  }
}
