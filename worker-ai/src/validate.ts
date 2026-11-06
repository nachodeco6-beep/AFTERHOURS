/**
 * Validates a model's output with the same rules as afterhours-ai/validate.py:
 * shared/ai/brandbook.schema.json first, then the catalog and text checks. An off-topic answer
 * ({"fuera_de_tema": true}, D16) only has to match the schema: it has nothing to check in the catalog.
 * test/lab-parity.test.mjs fails if the two validators disagree.
 */
import { Validator } from '@cfworker/json-schema'
import type { Schema } from '@cfworker/json-schema'
import REJECTED_PHRASES from '../../shared/ai/frases_rechazadas.json' with { type: 'json' }

export interface CatalogPair {
  id: number
  display: { family: string }
  text: { family: string }
}

export interface CatalogPalette {
  id: string
  mood: string
  colors: readonly string[]
}

export interface Catalog {
  pairs: readonly CatalogPair[]
  palettes: readonly CatalogPalette[]
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/

// Words that give away Spanish in a search query. Leaves out, on purpose, those that
// are also English words ("a", "no", "son"), to avoid false positives.
const SPANISH_STOPWORDS = new Set([
  'de', 'la', 'el', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'con', 'para', 'por', 'del', 'al', 'que', 'en', 'es', 'muy',
])

/** No accents, lowercase, straight apostrophes, single spaces: same as normalize_text in validate.py. */
function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase().replace(/[’ʼ‘]/g, "'").replace(/\s+/g, ' ')
}

/**
 * Which words of the query fall inside a name the concept already has. Same as named_span_covers in validate.py.
 * From each word off the list, takes the longest run that appears in the concept and trims it until it ends off the
 * list. It has to be the longest: with the short run "de la", "luz de la calle" would leave two common words outside
 * and pass. Both ends off the list stop "beach de noche". A run with no listed word is not covered: there is nothing
 * to excuse, and it would leave no words outside.
 */
function namedSpanCovers(words: string[], conceptWords: string[]): boolean[] {
  const haystack = ` ${conceptWords.join(' ')} `
  const covered = words.map(() => false)
  words.forEach((word, start) => {
    if (SPANISH_STOPWORDS.has(word)) return
    let end = words.length
    while (end > start + 1 && !haystack.includes(` ${words.slice(start, end).join(' ')} `)) end--
    while (end > start && SPANISH_STOPWORDS.has(words[end - 1])) end--
    if (words.slice(start, end).some((w) => SPANISH_STOPWORDS.has(w))) covered.fill(true, start, end)
  })
  return covered
}

/** What stays outside the names has to have at least one word, and none on the list. */
function isExcusedByConcept(words: string[], concept: string): boolean {
  const covered = namedSpanCovers(words, normalizeText(concept).match(/[a-z]+/g) ?? [])
  const outside = words.filter((_, i) => !covered[i])
  return outside.length > 0 && !outside.some((w) => SPANISH_STOPWORDS.has(w))
}

/** Returns why a query doesn't look like English, or null when it does. */
export function notEnglishReason(query: string, concept?: string): string | null {
  const q = query.trim()
  if (!q) return 'vacia'
  if ([...q].some((c) => c.codePointAt(0)! > 127)) return 'tiene caracteres no ASCII (tildes o enie): no parece ingles'
  if (!/[A-Za-z]/.test(q)) return 'no tiene letras'
  const words = q.toLowerCase().match(/[a-z]+/g) ?? []
  const hits = [...new Set(words)].filter((w) => SPANISH_STOPWORDS.has(w)).sort()
  if (!hits.length || (concept && isExcusedByConcept(words, concept))) return null
  return `contiene palabras del espanol: ${hits.join(', ')}`
}

// Whole words only: "solo siento" does not contain "lo siento". Runs on normalized text, so ASCII is enough.
const REJECTED = REJECTED_PHRASES.map((phrase) => {
  const normalized = normalizeText(phrase)
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return { phrase: normalized, pattern: new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`) }
})

/** The name goes first so the log can tell this rule apart: it records the name, not the text. */
function apologyErrors(field: string, text: string): string[] {
  const normalized = normalizeText(text)
  return REJECTED.filter(({ pattern }) => pattern.test(normalized)).map(({ phrase }) => `disculpa: ${field} contiene '${phrase}'`)
}

interface ShapedBrandbook {
  mood: string
  pair_id: number
  palette_id: string
  concepts: string[]
  search_queries: string[]
  applications: string[]
  rationale: string
}

const OFF_TOPIC = 'fuera_de_tema'

/**
 * The schema's two branches share no key, so the document's keys say which one can accept it.
 * Validating against that branch gives the same verdict as the whole schema, with errors that name
 * the field instead of "matches no branch". test/validate.test.mjs compares the two.
 */
function branchFor(doc: object, schema: object): Schema {
  const { anyOf } = schema as { anyOf: (Schema & { properties: object })[] }
  return anyOf.find((branch) => OFF_TOPIC in branch.properties === OFF_TOPIC in doc)!
}

/** Without a concept, no search query is excused. */
export function validateBrandbook(doc: unknown, catalog: Catalog, schema: object, concept?: string): ValidationResult {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { valid: false, errors: ['el documento no es un objeto JSON'] }
  }

  // Without a valid shape the rest makes no sense: it assumes the fields exist and have the right type.
  const shape = new Validator(branchFor(doc, schema), '2020-12', false).validate(doc)
  if (!shape.valid) {
    return { valid: false, errors: shape.errors.map((e) => `schema: ${e.instanceLocation} - ${e.error}`) }
  }
  if (OFF_TOPIC in doc) return { valid: true, errors: [] }

  const obj = doc as ShapedBrandbook
  const errors: string[] = []

  const pair = catalog.pairs.find((p) => p.id === obj.pair_id)
  if (!pair) errors.push(`pair_id: ${obj.pair_id} no existe en el catalogo de pares`)
  else if (!pair.display.family || !pair.text.family) {
    errors.push(`pair_id: ${obj.pair_id} esta incompleto en el catalogo (sin display/text)`)
  }

  const palette = catalog.palettes.find((p) => p.id === obj.palette_id)
  if (!palette) {
    errors.push(`palette_id: '${obj.palette_id}' no existe en el catalogo de paletas`)
  } else {
    if (palette.colors.length !== 5) {
      errors.push(`palette_id: '${obj.palette_id}' tiene ${palette.colors.length} colores, se esperan 5`)
    }
    const seen = new Set<string>()
    palette.colors.forEach((color, i) => {
      if (!HEX_RE.test(color)) {
        errors.push(`palette_id: '${obj.palette_id}' color[${i}] '${color}' no es HEX de 6 digitos`)
        return
      }
      if (seen.has(color.toLowerCase())) {
        errors.push(`palette_id: '${obj.palette_id}' color[${i}] '${color}' esta duplicado`)
      }
      seen.add(color.toLowerCase())
    })
  }

  obj.search_queries.forEach((q, i) => {
    const reason = notEnglishReason(q, concept)
    if (reason) errors.push(`search_queries[${i}]: '${q}' - ${reason}`)
  })

  // The schema accepts " " because minLength counts spaces.
  for (const field of ['concepts', 'search_queries', 'applications'] as const) {
    obj[field].forEach((value, i) => {
      if (!value.trim()) errors.push(`${field}[${i}]: esta vacio`)
    })
  }
  if (!obj.rationale.trim()) errors.push('rationale: esta vacio')

  if (palette && obj.mood !== palette.mood) {
    errors.push(`mood: '${obj.mood}' no coincide con el de la paleta '${obj.palette_id}' (${palette.mood})`)
  }

  for (const field of ['concepts', 'search_queries'] as const) {
    obj[field].forEach((value, i) => errors.push(...apologyErrors(`${field}[${i}]`, value)))
  }
  errors.push(...apologyErrors('rationale', obj.rationale))

  return { valid: errors.length === 0, errors }
}
