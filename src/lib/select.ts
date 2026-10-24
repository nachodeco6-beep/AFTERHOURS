/**
 * «Completar por mí»: tops up the visitor's own picks with photos from the
 * pool, up to a target (9 by default). Pure and deterministic.
 *
 * Rules, in order of importance:
 * 1. The visitor's picks are never removed or replaced.
 * 2. Every tag that still has candidates ends up represented.
 * 3. No photographer appears more than twice in the final selection.
 * 4. Colours stay coherent with the picks (Unsplash's dominant `color`).
 * 5. Orientations get mixed (landscape / portrait / square).
 * Ties fall back to the pool order, i.e. Unsplash's relevance.
 */
import type { Photo } from '../../shared/types.ts'
import { hexToRgb, rgbToLab, deltaE, type Lab } from './color.ts'

export interface Entry {
  photo: Photo
  /** The tag (search) the photo came from. */
  tag: string
}

export type Orientation = 'landscape' | 'portrait' | 'square'

export const COMPLETE_TARGET = 9
/** A board needs at least 3 photos and holds up to 12. */
export const MIN_SELECTION = 3
export const MAX_SELECTION = 12
export const MAX_AUTHOR_REPEATS = 2

export function orientationOf(p: Pick<Photo, 'width' | 'height'>): Orientation {
  const r = p.width / p.height
  if (r > 1.15) return 'landscape'
  if (r < 0.87) return 'portrait'
  return 'square'
}

const labOf = (p: Photo): Lab | null => {
  const rgb = p.color ? hexToRgb(p.color) : null
  return rgb ? rgbToLab(rgb) : null
}

/** Ideal share of each orientation in a board: mostly landscape/portrait, a few squares. */
const ORIENTATION_SHARE: Record<Orientation, number> = { landscape: 0.45, portrait: 0.4, square: 0.15 }

export function completeSelection(selected: Entry[], pool: Entry[], tags: string[], target = COMPLETE_TARGET): Entry[] {
  const chosen = [...selected]
  const added: Entry[] = []
  const used = new Set(chosen.map((e) => e.photo.id))
  const authorCount = new Map<string, number>()
  for (const e of chosen) authorCount.set(e.photo.author.name, (authorCount.get(e.photo.author.name) ?? 0) + 1)

  // candidates in pool order (relevance), without repeats
  const candidates = pool.filter((e, i) => !used.has(e.photo.id) && pool.findIndex((o) => o.photo.id === e.photo.id) === i)
  const rank = new Map(candidates.map((e, i) => [e.photo.id, i]))

  while (chosen.length < target) {
    const open = candidates.filter((e) => !used.has(e.photo.id) && (authorCount.get(e.photo.author.name) ?? 0) < MAX_AUTHOR_REPEATS)
    if (!open.length) break

    // 2. tags with no photo yet come first, in the visitor's tag order
    const present = new Set(chosen.map((e) => e.tag))
    const missing = tags.find((t) => !present.has(t) && open.some((e) => e.tag === t))
    const scoped = missing ? open.filter((e) => e.tag === missing) : open

    // 4. colour reference: the picks (or, with no picks yet, whatever is chosen so far)
    const refs = chosen.map((e) => labOf(e.photo)).filter((l): l is Lab => l !== null)
    // 5. orientation balance so far
    const counts: Record<Orientation, number> = { landscape: 0, portrait: 0, square: 0 }
    for (const e of chosen) counts[orientationOf(e.photo)]++
    const total = chosen.length + 1

    let best: Entry | null = null
    let bestScore = Infinity
    for (const e of scoped) {
      const lab = labOf(e.photo)
      const colour = refs.length && lab ? Math.min(...refs.map((r) => deltaE(r, lab))) / 100 : 0.5
      const o = orientationOf(e.photo)
      // how far over its ideal share this orientation would go (0 = still under-represented)
      const over = Math.max(0, (counts[o] + 1) / total - ORIENTATION_SHARE[o])
      const relevance = (rank.get(e.photo.id) ?? 0) / Math.max(1, candidates.length)
      const score = colour * 0.55 + over * 0.35 + relevance * 0.1
      if (score < bestScore) {
        bestScore = score
        best = e
      }
    }
    if (!best) break
    chosen.push(best)
    added.push(best)
    used.add(best.photo.id)
    authorCount.set(best.photo.author.name, (authorCount.get(best.photo.author.name) ?? 0) + 1)
  }
  return added
}
