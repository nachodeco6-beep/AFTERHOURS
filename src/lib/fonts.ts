import type { FontSpec, TypePair } from '../data/typePairs'
import { googleFontsUrl } from './typography'

const TIMEOUT_MS = 5000

const descriptor = (f: FontSpec) => `${f.style?.fontStyle === 'italic' ? 'italic ' : ''}400 1em '${f.family}'`

/**
 * Loads only the fonts of this pair from Google Fonts, on demand. Resolves
 * true when both are usable, false if they couldn't load (the board then shows
 * the fallback stack and says so).
 */
export async function loadPairFonts(pair: TypePair): Promise<boolean> {
  const url = googleFontsUrl(pair)
  if (url && !document.querySelector(`link[data-pair-fonts="${CSS.escape(url)}"]`)) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.dataset.pairFonts = url
    document.head.appendChild(link)
    await new Promise<void>((resolve) => {
      link.addEventListener('load', () => resolve(), { once: true })
      link.addEventListener('error', () => resolve(), { once: true })
    })
  }
  if (!('fonts' in document)) return true
  const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), TIMEOUT_MS))
  const loading = Promise.all([pair.display, pair.text].map((f) => document.fonts.load(descriptor(f))))
    .then(() => [pair.display, pair.text].every((f) => document.fonts.check(descriptor(f))))
    .catch(() => false)
  return Promise.race([loading, timeout])
}
