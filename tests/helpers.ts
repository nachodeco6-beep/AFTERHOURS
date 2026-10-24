import type { Photo } from '../shared/types.ts'

/** A fake Photo for unit tests only (never shown in the app). */
export function photo(id: string, opts: { w?: number; h?: number; color?: string | null; author?: string } = {}): Photo {
  const { w = 4000, h = 3000, color = '#808080', author = `author-${id}` } = opts
  return {
    id: `unsplash:${id}`,
    source: 'unsplash',
    width: w,
    height: h,
    color,
    alt: `test ${id}`,
    urls: { thumb: `t/${id}`, small: `s/${id}`, regular: `r/${id}`, full: `f/${id}` },
    author: { name: author, profileUrl: `https://unsplash.com/@${author}` },
    pageUrl: `https://unsplash.com/photos/${id}`,
    unsplashId: id,
  }
}

export const L = { w: 6000, h: 4000 } // landscape
export const P = { w: 4000, h: 6000 } // portrait
export const S = { w: 4000, h: 4000 } // square
