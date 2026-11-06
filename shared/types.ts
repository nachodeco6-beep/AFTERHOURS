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
  /** Random UUID the web generates once and keeps in localStorage */
  clientId: string
  /** Turnstile token. Single use and valid for 300 s: every request needs a new one, retries too */
  turnstileToken: string
}

/** What GET /quota answers, and what /generate adds to its answers */
export interface QuotaInfo {
  /** Generations left right now: the browser's, the IP's, and 0 if the global cap is closed */
  remaining: number
  /** ISO in UTC: when the next attempt comes back. Null if the quota is full */
  resetAt: string | null
}

interface GenerationMetrics extends QuotaInfo {
  /** The Gemini model that answered */
  model: string
  /** Only the call that answered: no backoff, no failed attempts */
  latency_ms: number
  /** All the calls that got a 200, invalid outputs included */
  tokens_in: number
  /** Everything generated, thoughts included. The lab's tokens_out is tokens_out - tokens_thoughts */
  tokens_out: number
  /** The thoughts part of tokens_out: already counted there, don't add them */
  tokens_thoughts: number
}

export interface GenerateBrandbookResponse extends GenerationMetrics {
  brandbook: Brandbook
}

/** The request isn't a brand (D16). Doesn't spend an attempt; `remaining` is unchanged */
export interface GenerateOffTopicResponse extends GenerationMetrics {
  fuera_de_tema: true
}

/** Tell them apart by the key: `'brandbook' in response` */
export type GenerateResponse = GenerateBrandbookResponse | GenerateOffTopicResponse

export type AiErrorCode =
  | 'invalid_params'
  | 'origin_not_allowed'
  | 'not_found'
  | 'method_not_allowed'
  | 'missing_key'
  | 'missing_config'
  | 'ai_invalid_output'
  | 'ai_unavailable'
  | 'captcha_failed'
  | 'quota_exceeded'
  | 'global_limit'

/** The quota fields are missing only when it can't be known: no valid clientId, or the Worker misconfigured or failing */
export interface AiErrorBody extends Partial<QuotaInfo> {
  error: {
    code: AiErrorCode
    message: string
    /** HTTP status Gemini answered with, when the error came from Gemini */
    upstreamStatus?: number
  }
}
