/**
 * One generation: asks Gemini, validates and handles D5 (an invalid output gets 1 retry).
 * Retries for 429/5xx/timeout (D12) live in gemini.ts; the two share one deadline but
 * count separately, so a request can make up to 6 calls.
 */
import type { Brandbook, GenerateResponse } from '../../shared/types.ts'
import { callGemini } from './gemini.ts'
import type { GeminiCall, GeminiRequest, GeminiSettings } from './gemini.ts'
import { validateBrandbook } from './validate.ts'
import type { Catalog } from './validate.ts'

const MAX_ROUNDS = 2

export interface GenerationSettings extends GeminiSettings {
  budgetMs: number
}

export type GenerationFailure = 'ai_invalid_output' | 'ai_unavailable'

export type GenerationResult =
  | { ok: true; response: GenerateResponse }
  | { ok: false; code: GenerationFailure; upstreamStatus?: number }

/** One entry per call to Gemini, including the ones of a request that ends in an error. */
export interface TracedCall extends GeminiCall {
  round: number
  /** Which rule the output broke; only the rule, because the text can quote the concept */
  invalid?: string[]
}

export interface Generation {
  result: GenerationResult
  rounds: number
  calls: TracedCall[]
}

/** `pair_id: 99 no existe...` -> `pair_id`. An output that does not parse is `json`. */
const ruleNames = (errors: string[]): string[] => [...new Set(errors.map((e) => e.split(/[:[]/, 1)[0]))]

function checkOutput(text: string, catalog: Catalog, schema: object): { brandbook: Brandbook } | { invalid: string[] } {
  let doc: unknown
  try {
    doc = JSON.parse(text)
  } catch {
    return { invalid: ['json'] }
  }
  const { valid, errors } = validateBrandbook(doc, catalog, schema)
  return valid ? { brandbook: doc as Brandbook } : { invalid: ruleNames(errors) }
}

export async function generate(
  request: GeminiRequest,
  settings: GenerationSettings,
  catalog: Catalog,
  schema: object,
): Promise<Generation> {
  const deadline = Date.now() + settings.budgetMs
  const calls: TracedCall[] = []
  const totals = { tokens_in: 0, tokens_out: 0, tokens_thoughts: 0 }

  for (let round = 1; ; round++) {
    const reply = await callGemini(request, settings, deadline, (call) => calls.push({ round, ...call }))
    if (reply.kind === 'unavailable') {
      return { result: { ok: false, code: 'ai_unavailable', upstreamStatus: reply.upstreamStatus }, rounds: round, calls }
    }

    // Invalid outputs also spend tokens: W2 needs them for the cost.
    totals.tokens_in += reply.usage.tokens_in
    totals.tokens_out += reply.usage.tokens_out
    totals.tokens_thoughts += reply.usage.tokens_thoughts

    const checked = checkOutput(reply.text, catalog, schema)
    if ('brandbook' in checked) {
      const response: GenerateResponse = {
        brandbook: checked.brandbook,
        model: reply.model,
        latency_ms: reply.latency_ms,
        ...totals,
      }
      return { result: { ok: true, response }, rounds: round, calls }
    }
    calls[calls.length - 1].invalid = checked.invalid

    if (round === MAX_ROUNDS || deadline - Date.now() < settings.minAttemptMs) {
      return { result: { ok: false, code: 'ai_invalid_output' }, rounds: round, calls }
    }
  }
}
