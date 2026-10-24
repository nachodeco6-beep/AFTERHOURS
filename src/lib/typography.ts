/**
 * Picks a type pair for the moodboard by matching the pairs' tags against the
 * words of the concept (accents and case ignored). Pure, no DOM.
 */
import { DEFAULT_PAIR_ID, TYPE_PAIRS, type FontSpec, type TypePair } from '../data/typePairs.ts'

const STOP = new Set(['de', 'del', 'la', 'el', 'los', 'las', 'lo', 'y', 'e', 'o', 'u', 'en', 'con', 'a', 'al', 'para', 'por', 'un', 'una', 'unos', 'unas', 'sin', 'muy', 'mas'])

/** Lowercase, without accents, punctuation turned into spaces. */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Rough singular: «deportes» → «deporte», «flores» → «flor». */
const stem = (w: string) => (w.length > 5 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)

const words = (text: string) =>
  normalize(text)
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .map(stem)

/** Same word, or same first 5 letters for longer words («urbana» ~ «urbano», «romantica» ~ «romantico»). */
const sameWord = (a: string, b: string) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5))

export function scorePair(pair: TypePair, concept: string[]): number {
  const text = ` ${concept.map(normalize).join(' ')} `
  const conceptWords = concept.flatMap(words)
  let score = 0
  for (const tag of pair.tags) {
    const tagWords = words(tag)
    if (!tagWords.length) continue
    // a multi-word tag found as a phrase counts most («alta costura», «art deco»)
    if (tagWords.length > 1 && text.includes(` ${normalize(tag)} `)) {
      score += 3
      continue
    }
    const hits = tagWords.filter((tw) => conceptWords.some((cw) => sameWord(tw, cw))).length
    if (hits === tagWords.length) score += 2
    else if (hits > 0) score += 1
  }
  if (words(pair.category).some((cw) => conceptWords.some((w) => sameWord(cw, w)))) score += 1
  return score
}

/**
 * Pairs that match the concept, best first (ties: Nacho's picks, then list
 * order). With no match at all: the neutral editorial default, then the rest of
 * Nacho's picks, so «Otra combinación» still has somewhere to go.
 */
export function rankPairs(concept: string[]): TypePair[] {
  const scored = TYPE_PAIRS.map((pair) => ({ pair, score: scorePair(pair, concept) })).filter((s) => s.score > 0)
  if (!scored.length) {
    const fallback = TYPE_PAIRS.find((p) => p.id === DEFAULT_PAIR_ID) as TypePair
    return [fallback, ...TYPE_PAIRS.filter((p) => p.nacho && p.id !== DEFAULT_PAIR_ID)]
  }
  scored.sort((a, b) => b.score - a.score || Number(b.pair.nacho) - Number(a.pair.nacho) || a.pair.id - b.pair.id)
  return scored.map((s) => s.pair)
}

/** Fonts we already ship with the site; no need to ask Google for them. */
const SELF_HOSTED = new Set(['Big Shoulders Display', 'Inter Tight', 'JetBrains Mono'])

const familyParam = (f: FontSpec) => f.query ?? f.family.replace(/ /g, '+')

/** Google Fonts css2 URL for just the fonts of this pair, or null if both are already on the site. */
export function googleFontsUrl(pair: TypePair): string | null {
  const fonts = [pair.display, pair.text].filter((f) => !SELF_HOSTED.has(f.family))
  const unique = fonts.filter((f, i) => fonts.findIndex((o) => familyParam(o) === familyParam(f)) === i)
  if (!unique.length) return null
  return `https://fonts.googleapis.com/css2?${unique.map((f) => `family=${familyParam(f)}`).join('&')}&display=swap`
}

export const specimenUrl = (f: FontSpec) => `https://fonts.google.com/specimen/${f.family.replace(/ /g, '+')}`

const FALLBACK: Record<FontSpec['kind'], string> = {
  serif: 'Georgia, "Times New Roman", serif',
  sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace',
  script: '"Brush Script MT", cursive',
}

export const fontStack = (f: FontSpec) => `'${f.family}', ${FALLBACK[f.kind]}`
