/**
 * Type Lab · Explorar: the catalogue of pairs, its filters, a random pick and
 * «fijar una fuente y buscarle compañera». Pure, no DOM.
 */
import type { Mood } from '../data/moods.ts'
import { PAIR_INFO, type HeadStyle } from '../data/pairInfo.ts'
import { TYPE_PAIRS, type FontSpec, type TypePair } from '../data/typePairs.ts'
import { fontStack, isDecorative, normalize, publicFontsUrl, type TypeStyle } from './typography.ts'

/** Which side of a pair: the headline or the text. */
export type Side = 'display' | 'text'

export const pairById = (id: number) => TYPE_PAIRS.find((p) => p.id === id)

export const styleOf = (p: TypePair): HeadStyle => PAIR_INFO[p.id]?.style ?? (p.display.kind === 'script' ? 'script' : p.display.kind)
export const moodsOf = (p: TypePair): Mood[] => PAIR_INFO[p.id]?.moods ?? []

/** The catalogue: Nacho's 12 first, then the rest, in the list's order. */
export const CATALOG: TypePair[] = [...TYPE_PAIRS.filter((p) => p.nacho), ...TYPE_PAIRS.filter((p) => !p.nacho)]

export interface PairFilter {
  /** Style of the headline; null = any. */
  style: HeadStyle | null
  mood: Mood | null
  /** Part of a font's name (either side). */
  query: string
}

export const NO_FILTER: PairFilter = { style: null, mood: null, query: '' }

/** Every condition at once: style AND clima AND name. */
export function filterPairs(pairs: TypePair[], f: PairFilter): TypePair[] {
  const q = normalize(f.query)
  return pairs.filter(
    (p) =>
      (!f.style || styleOf(p) === f.style) &&
      (!f.mood || moodsOf(p).includes(f.mood)) &&
      (!q || normalize(p.display.family).includes(q) || normalize(p.text.family).includes(q)),
  )
}

/** «Otro par»: one of `pairs` at random, never the one on the table (when there's another). */
export function randomPair(pairs: TypePair[], rand: () => number, current: number | null = null): TypePair | null {
  const pool = pairs.length > 1 ? pairs.filter((p) => p.id !== current) : pairs
  return pool.length ? pool[Math.floor(rand() * pool.length) % pool.length] : null
}

// ─── Companions ─────────────────────────────────────────────────────────────

export interface Companion {
  font: FontSpec
  /** The pair the font comes from, on its other side (what the Type Lab stores). */
  from: number
  /** True when the catalogue already pairs it with the fixed font. */
  inCatalog: boolean
}

const fontKey = (f: FontSpec) => `${f.family}${f.style?.fontStyle === 'italic' ? ' italic' : ''}`
const other = (side: Side): Side => (side === 'display' ? 'text' : 'display')

/** How a font reads as a style (a headline uses its pair's style; text fonts their kind). */
function styleOfFont(f: FontSpec, side: Side, from: TypePair): HeadStyle {
  if (side === 'display') return styleOf(from)
  return f.kind
}

/** How well `candidate` (going on `side`) completes `fixed`: style contrast, and reading well small when it's the text. */
function score(fixed: HeadStyle, candidate: FontSpec, side: Side, from: TypePair): number {
  const style = styleOfFont(candidate, side, from)
  let s = style !== fixed ? 3 : fixed === 'display' || fixed === 'script' ? 1 : 0
  if (side === 'text') {
    if (candidate.kind === 'sans' || candidate.kind === 'serif') s += 2
    if (candidate.kind === 'mono') s -= 1
    if (candidate.kind === 'script' || isDecorative(candidate)) s -= 5
  } else if (style === 'display' || style === 'serif') s += 1
  return s
}

/**
 * Fonts that go well with `fixed`, placed on `side` (fixing the headline asks
 * for text fonts, and the other way round). Pairs of the catalogue with that
 * font come first; then fonts of other families from the catalogue's other
 * side, with contrast of style and, for text, good reading at small sizes.
 * Never the same family as the fixed font.
 */
export function companions(fixed: FontSpec, fixedSide: Side, limit = 12): Companion[] {
  const side = other(fixedSide)
  const out: Companion[] = []
  const seen = new Set<string>([fixed.family])
  // 1. the catalogue already pairs them
  for (const p of CATALOG) {
    if (p[fixedSide].family !== fixed.family) continue
    const f = p[side]
    if (seen.has(f.family)) continue
    seen.add(f.family)
    out.push({ font: f, from: p.id, inCatalog: true })
  }
  // 2. other families, best match first (ties: how often the catalogue uses it, then its order)
  const fixedFrom = CATALOG.find((p) => p[fixedSide].family === fixed.family)
  const fixedStyle = fixedFrom ? styleOfFont(fixed, fixedSide, fixedFrom) : fixed.kind
  const uses = new Map<string, number>()
  for (const p of CATALOG) uses.set(fontKey(p[side]), (uses.get(fontKey(p[side])) ?? 0) + 1)
  const rest: { c: Companion; s: number; order: number }[] = []
  CATALOG.forEach((p, order) => {
    const f = p[side]
    if (seen.has(f.family)) return
    seen.add(f.family)
    rest.push({ c: { font: f, from: p.id, inCatalog: false }, s: score(fixedStyle, f, side, p) * 10 + (uses.get(fontKey(f)) ?? 0), order })
  })
  rest.sort((a, b) => b.s - a.s || a.order - b.order)
  return [...out, ...rest.map((r) => r.c)].slice(0, Math.max(limit, out.length))
}

// ─── Copy ───────────────────────────────────────────────────────────────────

export const pairName = (p: TypePair) => `${p.display.family}${p.display.style?.fontStyle === 'italic' ? ' Itálica' : ''} + ${p.text.family}`

/** The `<link>` tags to use the pair from Google Fonts. */
export const linkTags = (p: TypePair) =>
  [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="${publicFontsUrl(p)}" rel="stylesheet">`,
  ].join('\n')

const round = (n: number, d: number) => Number(n.toFixed(d))

/** CSS for the pair as set in the Type Lab: family, weight and the adjustments. */
export function pairCss(p: TypePair, style: TypeStyle): string {
  const d = p.display
  const head = [
    `  font-family: ${fontStack(d)};`,
    `  font-weight: ${d.weight ?? 400};`,
    ...(d.style?.fontStyle ? [`  font-style: ${d.style.fontStyle};`] : []),
    ...(d.style?.fontStretch ? [`  font-stretch: ${d.style.fontStretch};`] : []),
    ...(d.style?.fontVariationSettings ? [`  font-variation-settings: ${d.style.fontVariationSettings};`] : []),
    ...(style.tracking ? [`  letter-spacing: ${round(style.tracking, 3)}em;`] : []),
    ...(style.uppercase ? ['  text-transform: uppercase;'] : []),
  ]
  const t = p.text
  const body = [
    `  font-family: ${fontStack(t)};`,
    `  font-weight: ${t.weight ?? 400};`,
    ...(t.style?.fontStretch ? [`  font-stretch: ${t.style.fontStretch};`] : []),
    `  line-height: ${round(style.leading, 2)};`,
  ]
  return `/* Titular */\nh1, h2, h3 {\n${head.join('\n')}\n}\n\n/* Texto */\nbody {\n${body.join('\n')}\n}\n`
}
