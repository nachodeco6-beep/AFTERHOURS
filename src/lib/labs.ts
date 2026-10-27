/**
 * Favourites of the labs (pairs and palettes), kept in the browser apart from
 * the boards, under `afterhours.labs`. Same pattern as saved.ts: versioned,
 * read defensively (anything broken is dropped, never thrown) and migrated.
 */
import { TYPE_PAIRS } from '../data/typePairs.ts'
import { hexToRgb, rgbToHex } from './color.ts'
import { MAX_COLORS, MIN_COLORS, ROLES, type Role } from './colorLab.ts'
import type { KeyValue, WriteResult } from './saved.ts'
import { DEFAULT_TYPE_STYLE, type PickedFonts, type TypeStyle } from './typography.ts'

export const LABS_KEY = 'afterhours.labs'
/** 1: first version (pairs, palettes, the last pair tried). */
export const LABS_VERSION = 1
/** Enough for anyone; the oldest go first. */
export const MAX_FAVORITES = 120

export interface SavedPair {
  id: string
  savedAt: number
  fonts: PickedFonts
  style: TypeStyle
}

export interface SavedPaletteColor {
  hex: string
  role: Role | null
}

export interface SavedPalette {
  id: string
  savedAt: number
  name: string
  colors: SavedPaletteColor[]
}

export interface LabsRecord {
  version: number
  pairs: SavedPair[]
  palettes: SavedPalette[]
  /** The last pair tried in the Type Lab: the Color Lab's preview uses it. */
  lastPair: PickedFonts | null
}

export const EMPTY_LABS: LabsRecord = { version: LABS_VERSION, pairs: [], palettes: [], lastPair: null }

// ─── Reading (validation + migration) ───────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const PAIR_IDS = new Set(TYPE_PAIRS.map((p) => p.id))

function readFonts(v: unknown): PickedFonts | null {
  if (!isObj(v) || !num(v.display) || !num(v.text)) return null
  return PAIR_IDS.has(v.display) && PAIR_IDS.has(v.text) ? { display: v.display, text: v.text } : null
}

function readStyle(v: unknown): TypeStyle {
  if (!isObj(v)) return { ...DEFAULT_TYPE_STYLE }
  return {
    weight: num(v.weight) ? v.weight : null,
    leading: num(v.leading) && v.leading >= 0.8 && v.leading <= 3 ? v.leading : DEFAULT_TYPE_STYLE.leading,
    tracking: num(v.tracking) && Math.abs(v.tracking) <= 0.5 ? v.tracking : DEFAULT_TYPE_STYLE.tracking,
    uppercase: v.uppercase === true,
  }
}

/** A pair favourite; the earlier shape was just the fonts ({ display, text }). */
export function readPair(v: unknown, i: number): SavedPair | null {
  if (!isObj(v)) return null
  const fonts = readFonts(isObj(v.fonts) ? v.fonts : v)
  if (!fonts) return null
  return { id: str(v.id) ? v.id : `p${fonts.display}-${fonts.text}-${i}`, savedAt: num(v.savedAt) ? v.savedAt : 0, fonts, style: readStyle(v.style) }
}

/** A palette favourite; the earlier shape was a bare list of HEX. */
export function readPalette(v: unknown, i: number): SavedPalette | null {
  const raw = Array.isArray(v) ? v : isObj(v) && Array.isArray(v.colors) ? v.colors : null
  if (!raw) return null
  const colors: SavedPaletteColor[] = []
  for (const c of raw) {
    const hex = str(c) ? c : isObj(c) && str(c.hex) ? c.hex : null
    const rgb = hex ? hexToRgb(hex) : null
    if (!rgb) return null
    const role = isObj(c) && ROLES.includes(c.role as Role) ? (c.role as Role) : null
    colors.push({ hex: rgbToHex(rgb), role: role && !colors.some((o) => o.role === role) ? role : null })
  }
  if (colors.length < MIN_COLORS || colors.length > MAX_COLORS) return null
  const obj = isObj(v) ? v : {}
  return {
    id: str(obj.id) ? obj.id : `c${i}-${colors.map((c) => c.hex.slice(1)).join('')}`,
    savedAt: num(obj.savedAt) ? obj.savedAt : 0,
    name: str(obj.name) && obj.name.trim() ? obj.name.trim().slice(0, 80) : 'Paleta',
    colors,
  }
}

const recentFirst = <T extends { savedAt: number }>(list: T[]) => [...list].sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_FAVORITES)
const uniqueBy = <T>(list: T[], key: (t: T) => string) => list.filter((t, i) => list.findIndex((o) => key(o) === key(t)) === i)

/** The stored value, migrated to the current version. Anything unusable is dropped; never throws. */
export function migrateLabs(v: unknown): LabsRecord {
  if (!isObj(v)) return { ...EMPTY_LABS }
  // a future version we don't know: keep only what still reads
  const pairs = Array.isArray(v.pairs) ? v.pairs.map(readPair).filter((p): p is SavedPair => p !== null) : []
  const palettes = Array.isArray(v.palettes) ? v.palettes.map(readPalette).filter((p): p is SavedPalette => p !== null) : []
  return {
    version: LABS_VERSION,
    pairs: recentFirst(uniqueBy(pairs, (p) => p.id)),
    palettes: recentFirst(uniqueBy(palettes, (p) => p.id)),
    lastPair: readFonts(v.lastPair),
  }
}

export function readLabs(storage: KeyValue | null): LabsRecord {
  if (!storage) return { ...EMPTY_LABS }
  try {
    const raw = storage.getItem(LABS_KEY)
    return raw ? migrateLabs(JSON.parse(raw)) : { ...EMPTY_LABS }
  } catch {
    return { ...EMPTY_LABS }
  }
}

export function writeLabs(storage: KeyValue | null, record: LabsRecord): WriteResult {
  if (!storage) return 'unavailable'
  try {
    storage.setItem(LABS_KEY, JSON.stringify(record))
    return 'ok'
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'full' : 'unavailable'
  }
}

// ─── Operations ─────────────────────────────────────────────────────────────

export const samePair = (a: PickedFonts, b: PickedFonts) => a.display === b.display && a.text === b.text
export const findPair = (r: LabsRecord, fonts: PickedFonts) => r.pairs.find((p) => samePair(p.fonts, fonts)) ?? null

/** Saves the pair (once: saving it again updates its adjustments and moves it first). */
export function addPair(r: LabsRecord, fonts: PickedFonts, style: TypeStyle, id: string, now: number): LabsRecord {
  const existing = findPair(r, fonts)
  const entry: SavedPair = { id: existing?.id ?? id, savedAt: now, fonts, style }
  return { ...r, pairs: recentFirst([entry, ...r.pairs.filter((p) => p.id !== entry.id)]) }
}

export const removePair = (r: LabsRecord, id: string): LabsRecord => ({ ...r, pairs: r.pairs.filter((p) => p.id !== id) })

export const paletteKey = (colors: { hex: string }[]) => colors.map((c) => c.hex.toUpperCase()).join('')
export const findPalette = (r: LabsRecord, colors: { hex: string }[]) => r.palettes.find((p) => paletteKey(p.colors) === paletteKey(colors)) ?? null

/** Saves the palette (the same colours in the same order count as the same palette). */
export function addPalette(r: LabsRecord, name: string, colors: SavedPaletteColor[], id: string, now: number): LabsRecord {
  const existing = findPalette(r, colors)
  const entry: SavedPalette = { id: existing?.id ?? id, savedAt: now, name: name.trim().slice(0, 80) || 'Paleta', colors: colors.map((c) => ({ hex: c.hex.toUpperCase(), role: c.role })) }
  return { ...r, palettes: recentFirst([entry, ...r.palettes.filter((p) => p.id !== entry.id)]) }
}

export const removePalette = (r: LabsRecord, id: string): LabsRecord => ({ ...r, palettes: r.palettes.filter((p) => p.id !== id) })

export const setLastPair = (r: LabsRecord, fonts: PickedFonts | null): LabsRecord => ({ ...r, lastPair: fonts })
