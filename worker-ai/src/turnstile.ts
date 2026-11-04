/**
 * Server-side check of a Cloudflare Turnstile token. It fails closed: no token, a refused token
 * or an unreachable siteverify all mean "not verified", so Gemini is not called.
 * The secret goes in the POST body, never in a URL.
 */
import { postOnce } from './gemini.ts'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

export type TurnstileResult = { ok: true } | { ok: false; reason: string }

export async function verifyTurnstile(token: unknown, secret: string, ip: string | null): Promise<TurnstileResult> {
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing-token' }

  const form = new URLSearchParams({ secret, response: token })
  if (ip) form.set('remoteip', ip)

  let reply: { status: number; raw: string }
  try {
    reply = await postOnce(SITEVERIFY_URL, { method: 'POST', body: form }, AbortSignal.timeout(TIMEOUT_MS))
  } catch (error) {
    return { ok: false, reason: `unreachable: ${error instanceof Error ? error.name : 'unknown'}` }
  }
  if (reply.status !== 200) return { ok: false, reason: `http-${reply.status}` }

  let data: { success?: unknown; 'error-codes'?: unknown } | null
  try {
    data = JSON.parse(reply.raw) as { success?: unknown; 'error-codes'?: unknown } | null
  } catch {
    return { ok: false, reason: 'unreadable-reply' }
  }
  if (data?.success === true) return { ok: true }
  const codes = Array.isArray(data?.['error-codes']) ? data['error-codes'].join(',') : ''
  return { ok: false, reason: codes || 'refused' }
}
