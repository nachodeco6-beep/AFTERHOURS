/**
 * Reads the AI env config. The only AI file that touches import.meta.env, so
 * everything else (testable under node, where import.meta.env doesn't exist)
 * takes these values injected.
 */

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

const RAW_URL = import.meta.env.VITE_AI_API_URL

/** AI Worker base URL, or null when the AI isn't connected (classic mode). */
export const AI_API_URL = baseUrl(RAW_URL)

/** VITE_AI_API_URL is set but isn't a usable http(s) address. */
export const AI_URL_INVALID = Boolean(RAW_URL?.trim()) && AI_API_URL === null

/** Turnstile site key (public), or null when it's missing. */
export const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() || null

/** Both pieces are set: the web can offer the AI. Anything missing = classic mode (D8). */
export const AI_CONFIGURED = AI_API_URL !== null && TURNSTILE_SITE_KEY !== null
