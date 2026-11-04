/**
 * Validates a model's output with the same rules as afterhours-ai/validate.py:
 * shared/ai/brandbook.schema.json first, then the catalog and text checks.
 * test/lab-parity.test.mjs fails if the two validators disagree.
 */
import { Validator } from '@cfworker/json-schema'
import type { Schema } from '@cfworker/json-schema'

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

/** Returns why a query doesn't look like English, or null when it does. */
export function notEnglishReason(query: string): string | null {
  const q = query.trim()
  if (!q) return 'vacia'
  if ([...q].some((c) => c.codePointAt(0)! > 127)) return 'tiene caracteres no ASCII (tildes o enie): no parece ingles'
  if (!/[A-Za-z]/.test(q)) return 'no tiene letras'
  const words = q.toLowerCase().match(/[a-z]+/g) ?? []
  const hits = [...new Set(words)].filter((w) => SPANISH_STOPWORDS.has(w)).sort()
  return hits.length ? `contiene palabras del espanol: ${hits.join(', ')}` : null
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

export function validateBrandbook(doc: unknown, catalog: Catalog, schema: object): ValidationResult {
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { valid: false, errors: ['el documento no es un objeto JSON'] }
  }

  // Without a valid shape the rest makes no sense: it assumes the fields exist and have the right type.
  const shape = new Validator(schema as Schema, '2020-12', false).validate(doc)
  if (!shape.valid) {
    return { valid: false, errors: shape.errors.map((e) => `schema: ${e.instanceLocation} - ${e.error}`) }
  }

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
    const reason = notEnglishReason(q)
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

  return { valid: errors.length === 0, errors }
}
