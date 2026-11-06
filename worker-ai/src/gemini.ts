/**
 * Talks to Gemini and handles D12: 429/5xx/timeout are retried with backoff, inside the
 * deadline the caller gives. Knows nothing about what the output means; retrying an
 * invalid output (D5) belongs to generate.ts.
 */

const API_ROOT = 'https://generativelanguage.googleapis.com/v1beta/models'
export const MAX_ATTEMPTS = 3
const TEMPERATURE = 0.2

// Keys the Gemini API rejects in responseSchema. Same list as run_benchmark.py.
const GEMINI_UNSUPPORTED = new Set([
  '$schema', '$id', 'title', 'additionalProperties', 'unevaluatedProperties',
  'default', 'examples', 'deprecated', 'readOnly', 'writeOnly', 'const',
])

/** Port of to_gemini_schema in run_benchmark.py; test/lab-parity.test.mjs compares them. */
export function toGeminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toGeminiSchema)
  if (typeof node !== 'object' || node === null) return node

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (GEMINI_UNSUPPORTED.has(key)) continue
    if (key === 'properties') {
      // These keys are property names, not schema keywords: a property called "title" stays.
      out[key] = Object.fromEntries(Object.entries(value as object).map(([name, sub]) => [name, toGeminiSchema(sub)]))
    } else if (key === 'items' || key === 'anyOf') {
      out[key] = toGeminiSchema(value)
    } else {
      out[key] = value
    }
  }
  return out
}

export interface GeminiSettings {
  apiKey: string
  model: string
  fallbackModel: string | null
  attemptTimeoutMs: number
  minAttemptMs: number
  backoffBaseMs: number
  /** Gemini's maxOutputTokens: the ceiling on what one call can generate */
  maxOutputTokens: number
}

export interface GeminiRequest {
  systemPrompt: string
  concept: string
  responseSchema: unknown
}

export interface TokenUsage {
  tokens_in: number
  /** Everything generated: candidates + thoughts */
  tokens_out: number
  /** The thoughts part of tokens_out; the lab's tokens_out is tokens_out - tokens_thoughts */
  tokens_thoughts: number
}

/** One call to Gemini, whatever came out of it. Goes to the log; never holds the concept or the key. */
export interface GeminiCall extends TokenUsage {
  attempt: number
  model: string
  /** HTTP status, or what happened when there was none */
  outcome: number | 'timeout' | 'network'
  ms: number
}

export type GeminiResult =
  | { kind: 'ok'; text: string; model: string; latency_ms: number; usage: TokenUsage }
  | { kind: 'unavailable'; upstreamStatus?: number }

const NO_TOKENS: TokenUsage = { tokens_in: 0, tokens_out: 0, tokens_thoughts: 0 }

interface GeminiEnvelope {
  candidates?: { content?: { parts?: { text?: unknown; thought?: unknown }[] } }[]
  usageMetadata?: { promptTokenCount?: unknown; candidatesTokenCount?: unknown; thoughtsTokenCount?: unknown }
}

const count = (value: unknown): number => (typeof value === 'number' ? value : 0)

/** A 200 with an unreadable envelope has no text and no usage: for D5 it is one more invalid output. */
function readEnvelope(raw: string): { text: string; usage: TokenUsage } {
  let data: GeminiEnvelope | null
  try {
    data = JSON.parse(raw) as GeminiEnvelope | null
  } catch {
    return { text: '', usage: NO_TOKENS }
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const text = parts
    .filter((part) => part.thought !== true && typeof part.text === 'string')
    .map((part) => part.text)
    .join('')
  const thoughts = count(data?.usageMetadata?.thoughtsTokenCount)
  return {
    text,
    usage: {
      tokens_in: count(data?.usageMetadata?.promptTokenCount),
      tokens_out: count(data?.usageMetadata?.candidatesTokenCount) + thoughts,
      tokens_thoughts: thoughts,
    },
  }
}

/** The timeout covers the body too: headers can arrive and the body hang. */
export async function postOnce(url: string, init: RequestInit, signal: AbortSignal): Promise<{ status: number; raw: string }> {
  const aborted = new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason as Error), { once: true })
  })
  const work = (async () => {
    const res = await fetch(url, { ...init, signal })
    if (res.status === 200) return { status: 200, raw: await res.text() }
    // Gemini's error body stays here: it never reaches the browser or the log.
    await res.body?.cancel()
    return { status: res.status, raw: '' }
  })()
  return Promise.race([work, aborted])
}

const isRetryable = (status: number): boolean => status === 429 || status >= 500

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export async function callGemini(
  request: GeminiRequest,
  settings: GeminiSettings,
  deadline: number,
  onCall: (call: GeminiCall) => void,
): Promise<GeminiResult> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: request.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: request.concept }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: request.responseSchema,
      temperature: TEMPERATURE,
      maxOutputTokens: settings.maxOutputTokens,
    },
  })

  let upstreamStatus: number | undefined
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now()
    if (remaining < settings.minAttemptMs) return { kind: 'unavailable', upstreamStatus }

    const model = attempt === MAX_ATTEMPTS && settings.fallbackModel ? settings.fallbackModel : settings.model
    const signal = AbortSignal.timeout(Math.min(settings.attemptTimeoutMs, remaining))
    const started = Date.now()
    try {
      const { status, raw } = await postOnce(
        `${API_ROOT}/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
          body,
        },
        signal,
      )
      const ms = Date.now() - started
      if (status === 200) {
        const { text, usage } = readEnvelope(raw)
        onCall({ attempt, model, outcome: 200, ms, ...usage })
        return { kind: 'ok', text, model, latency_ms: ms, usage }
      }
      onCall({ attempt, model, outcome: status, ms, ...NO_TOKENS })
      if (!isRetryable(status)) return { kind: 'unavailable', upstreamStatus: status }
      upstreamStatus = status
    } catch {
      // What went wrong stays in the call record. A timed-out call may have spent tokens that
      // Gemini never reported, so the zeros here are a lower bound.
      onCall({ attempt, model, outcome: signal.aborted ? 'timeout' : 'network', ms: Date.now() - started, ...NO_TOKENS })
      upstreamStatus = undefined
    }

    if (attempt < MAX_ATTEMPTS) {
      const wait = settings.backoffBaseMs * 2 ** (attempt - 1)
      if (deadline - Date.now() - wait < settings.minAttemptMs) return { kind: 'unavailable', upstreamStatus }
      await sleep(wait)
    }
  }
  return { kind: 'unavailable', upstreamStatus }
}
