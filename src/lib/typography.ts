/**
 * Picks a type pair for the moodboard by matching the pairs' tags against the
 * words of the concept (accents and case ignored). Pure, no DOM.
 */
import { DISPLAY_WEIGHTS } from '../data/fontWeights.ts'
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

const familyParam = (f: FontSpec) => {
  if (f.query) return f.query
  const name = f.family.replace(/ /g, '+')
  return f.weight && f.weight !== 400 ? `${name}:wght@${f.weight}` : name
}

/** Google Fonts css2 URL for one font, or null if the site already ships it. */
export function fontUrl(f: FontSpec): string | null {
  if (SELF_HOSTED.has(f.family)) return null
  return `https://fonts.googleapis.com/css2?family=${familyParam(f)}&display=swap`
}

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

/** Everything needed to set this font as requested: family, weight and special cuts. */
export const fontCss = (f: FontSpec) => ({ fontFamily: fontStack(f), fontWeight: f.weight ?? 400, ...f.style })

// ─── Type Lab ───────────────────────────────────────────────────────────────

/** What the Type Lab adjusts on top of the pair. */
export interface TypeStyle {
  /** Headline weight; null = the pair's own. */
  weight: number | null
  /** Line height of the text font. */
  leading: number
  /** Letter spacing of the headline, in em. */
  tracking: number
  uppercase: boolean
}

export const DEFAULT_TYPE_STYLE: TypeStyle = { weight: null, leading: 1.4, tracking: 0, uppercase: false }
export const LEADING_RANGE: [number, number] = [1.1, 2]
export const TRACKING_RANGE: [number, number] = [-0.05, 0.2]

/** Fonts picked by hand in the Type Lab: the pair each one comes from (they may differ). */
export interface PickedFonts {
  display: number
  text: number
}

const pairById = (id: number) => TYPE_PAIRS.find((p) => p.id === id)

/**
 * The pair the board shows: picked by hand (headline from one pair, text from
 * another) or the ranked one, with the Type Lab's weight on the headline.
 */
export function effectivePair(auto: TypePair, picked: PickedFonts | null, style: TypeStyle): TypePair {
  const d = (picked && pairById(picked.display)) || auto
  const t = (picked && pairById(picked.text)) || auto
  const base: TypePair = d === t ? d : { id: -(d.id * 100 + t.id), display: d.display, text: t.text, category: d.category, tags: [], nacho: false }
  if (style.weight === null || !weightsOf(base.display).includes(style.weight)) return base
  return { ...base, display: { ...base.display, weight: style.weight } }
}

/** A stable key for a pair as shown (fonts and weight), to know when its fonts loaded. */
export const pairKey = (p: TypePair) => [p.display.family, p.display.weight ?? 400, p.display.style?.fontStyle ?? '', p.text.family].join('|')

/** What the site ships of its own fonts (main.tsx): only those weights exist. */
const SHIPPED_WEIGHTS: Record<string, number[]> = { 'Big Shoulders Display': [700, 900], 'JetBrains Mono': [400, 500] }

/** Weights the headline can take in the Type Lab. */
export function weightsOf(f: FontSpec): number[] {
  const shipped = SHIPPED_WEIGHTS[f.family]
  if (shipped) return shipped
  const all = DISPLAY_WEIGHTS[f.family + (f.style?.fontStyle === 'italic' ? ' italic' : '')] ?? [f.weight ?? 400]
  // a custom query loads a weight range: only what's inside it
  const range = f.query?.match(/wght[^@]*@(?:[\d.]+,)*?(\d{3})\.\.(\d{3})/)
  return range ? all.filter((w) => w >= Number(range[1]) && w <= Number(range[2])) : all
}

/** Headline fonts meant for big sizes only. */
const DECORATIVE = new Set(['Monoton', 'Bungee', 'Rubik Mono One', 'Permanent Marker', 'UnifrakturMaguntia', 'Pirata One', 'Sedgwick Ave Display', 'Bagel Fat One', 'Rye', 'Limelight', 'Poiret One', 'Amatic SC', 'Syncopate', 'Michroma'])

/** Gentle warnings when the combination may be hard to read at small sizes. */
export function legibilityNotes(pair: TypePair, style: TypeStyle): string[] {
  const notes: string[] = []
  const d = pair.display
  const weight = style.weight ?? d.weight ?? 400
  if (d.kind === 'script' && style.uppercase) notes.push('Una manuscrita en mayúsculas cuesta leer: probá el título en minúsculas.')
  if (d.kind === 'script' || DECORATIVE.has(d.family)) notes.push(`${d.family} luce en tamaños grandes; en la lámina chica o en el celular el título puede costar leerse.`)
  if (weight <= 300) notes.push('Un titular tan fino se pierde en tamaños chicos.')
  if (style.tracking < -0.02) notes.push('Con el espaciado tan cerrado, las letras del titular se pegan.')
  if (style.leading < 1.25) notes.push('Con tan poco interlineado, el texto se amontona.')
  if (pair.text.kind === 'mono') notes.push('Una monoespaciada en párrafos largos cansa: mejor para textos cortos.')
  return notes
}
