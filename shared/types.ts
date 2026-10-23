/**
 * Types shared by the search Worker (worker/) and the front end (src/).
 * Type-only: nothing here ends up in either bundle.
 */

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
