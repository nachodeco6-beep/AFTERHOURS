/**
 * Divergence between the AI palette and the photos' palette (D20). Pure.
 *
 * The metric is a PROPOSAL, to calibrate with real boards: D = half the ΔE of
 * the two backgrounds + half the average ΔE of the cheapest one-to-one
 * matching. In dev mode D shows next to the palette, to tune the threshold.
 */
import type { DivergenceDismissal, PaletteOrigin } from './aiProposal.ts'
import { deltaE, hexToRgb, rgbToLab, type Lab } from './color.ts'
import { defaultRoles } from './colorLab.ts'

/** Warns from here up (D ≥ 45, N7). It starts high: a missed notice costs little (D19). */
export const DIVERGENCE_THRESHOLD = 45
/** A dismissed notice comes back when D grew by this much (D20). */
export const REWARN_DELTA = 10

const labOf = (hex: string): Lab => rgbToLab(hexToRgb(hex) ?? [0, 0, 0])

/** Index of the background (fondo) that defaultRoles gives this palette. */
const backgroundOf = (hexes: string[]) => Math.max(0, defaultRoles(hexes).indexOf('fondo'))

/**
 * Cheapest injective assignment of the smaller palette's colours into the
 * larger one: brute force over every option (120 with 5 against 5). Returns
 * the total ΔE; `small` and `large` are Lab lists with small.length ≤ large.length.
 */
function cheapestMatch(small: Lab[], large: Lab[]): number {
  const used = large.map(() => false)
  const walk = (i: number): number => {
    if (i === small.length) return 0
    let best = Infinity
    for (let j = 0; j < large.length; j++) {
      if (used[j]) continue
      used[j] = true
      const cost = deltaE(small[i], large[j]) + walk(i + 1)
      if (cost < best) best = cost
      used[j] = false
    }
    return best
  }
  return walk(0)
}

/**
 * D between the AI palette (5 colours) and the photos' palette (k ≤ 5; with
 * few photos it comes smaller). Each of the k colours pairs with a different
 * AI colour and the average is over k. With no photo colours there is nothing
 * to compare: null, and no notice.
 */
export function paletteDistance(aiHexes: string[], photoHexes: string[]): number | null {
  if (!aiHexes.length || !photoHexes.length) return null
  const ai = aiHexes.map(labOf)
  const photos = photoHexes.map(labOf)
  const backgrounds = deltaE(ai[backgroundOf(aiHexes)], photos[backgroundOf(photoHexes)])
  const [small, large] = photos.length <= ai.length ? [photos, ai] : [ai, photos]
  const match = cheapestMatch(small, large) / small.length
  return 0.5 * backgrounds + 0.5 * match
}

export interface WarnInput {
  /** Only an AI palette warns (D22): manual edits keep today's notice, «fotos» has nothing to diverge from. */
  origin: PaletteOrigin
  /** From paletteDistance; null = nothing to compare. */
  d: number | null
  /** The dismissal saved with the project (D23), if any. */
  dismissal: DivergenceDismissal | null
  /** The photos on the board right now. */
  photoIds: string[]
}

/**
 * Whether the divergence notice shows. Dismissed, it comes back when D grew
 * by REWARN_DELTA, or when more than half of the photos of now weren't there
 * at the dismissal (N6) — always with D still over the threshold.
 */
export function shouldWarn({ origin, d, dismissal, photoIds }: WarnInput): boolean {
  if (origin !== 'ia' || d === null || d < DIVERGENCE_THRESHOLD) return false
  if (!dismissal) return true
  if (d >= dismissal.d + REWARN_DELTA) return true
  const known = new Set(dismissal.photoIds)
  const fresh = photoIds.filter((id) => !known.has(id)).length
  return fresh > photoIds.length / 2
}
