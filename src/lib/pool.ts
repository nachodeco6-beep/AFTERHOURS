import type { Photo } from '../../shared/types'
import type { Entry } from './select'

interface TagPhotos {
  tag: string
  photos: Photo[]
}

/**
 * Removes photos already shown under an earlier tag, keeping each group's
 * original size in `fetched`. Used by the results grid and the photo pool.
 */
export function dedupeGroups<T extends TagPhotos>(results: T[]): (T & { index: number; fetched: number })[] {
  const seen = new Set<string>()
  return results.map((r, index) => ({
    ...r,
    index,
    fetched: r.photos.length,
    photos: r.photos.filter((p) => !seen.has(p.id) && (seen.add(p.id), true)),
  }))
}

/** Every unique photo of the results, with the tag it belongs to, in display order. */
export function poolOf(results: TagPhotos[]): Entry[] {
  return dedupeGroups(results).flatMap((g) => g.photos.map((photo) => ({ photo, tag: g.tag })))
}
