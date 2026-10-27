/**
 * Saved boards, kept in the browser (localStorage). Pure apart from the
 * storage handed in, so it can be tested without a browser.
 *
 * A record holds everything needed to rebuild the board as it was: settings,
 * the concept (for keywords and notes), the photos in order with their credits,
 * and what was chosen in the Type Lab. Records are versioned: reading migrates
 * older ones and drops anything that doesn't look like a board.
 */
import type { Photo } from '../../shared/types.ts'
import type { Template } from './compose.ts'
import { DEFAULT_FORMAT, FORMAT_ORDER, type Format } from './formats.ts'
import { DEFAULT_TYPE_STYLE, type PickedFonts, type TypeStyle } from './typography.ts'

export const STORAGE_KEY = 'afterhours.boards'
export const SAVED_VERSION = 1

export interface SavedInclude {
  palette: boolean
  type: boolean
  keywords: boolean
  notes: boolean
}

export interface SavedBoard {
  version: number
  id: string
  /** ms since epoch */
  savedAt: number
  title: string
  template: Template
  format: Format
  include: SavedInclude
  notes: string | null
  pairOffset: number
  fonts: PickedFonts | null
  typeStyle: TypeStyle
  /** The tags of the idea: keywords and notes come from them. */
  concept: string[]
  photos: { photo: Photo; tag: string }[]
}

/** The part of a board that counts as «its content»: what a save keeps. */
export type BoardContent = Omit<SavedBoard, 'version' | 'id' | 'savedAt'>

export const makeRecord = (content: BoardContent, id: string, savedAt: number): SavedBoard => ({ version: SAVED_VERSION, id, savedAt, ...content })

/** Same content ⇔ same signature (used to know if there are unsaved changes). */
export const signature = (c: BoardContent) =>
  JSON.stringify([c.title, c.template, c.format, c.include, c.notes, c.pairOffset, c.fonts, c.typeStyle, c.concept, c.photos.map((p) => [p.photo.id, p.tag])])

export const contentOf = (r: SavedBoard): BoardContent => {
  const { version: _v, id: _i, savedAt: _s, ...content } = r
  return content
}

// ─── Reading (validation + migration) ───────────────────────────────────────

const TEMPLATES: Template[] = ['editorial', 'collage', 'grilla']
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown): v is string => typeof v === 'string'
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function readPhoto(v: unknown): Photo | null {
  if (!isObj(v) || !str(v.id) || !num(v.width) || !num(v.height) || !isObj(v.urls) || !isObj(v.author)) return null
  const { urls, author } = v
  if (![urls.thumb, urls.small, urls.regular, urls.full].every(str) || !str(author.name) || !str(author.profileUrl)) return null
  return {
    id: v.id,
    source: 'unsplash',
    width: v.width,
    height: v.height,
    color: str(v.color) ? v.color : null,
    alt: str(v.alt) ? v.alt : '',
    urls: { thumb: urls.thumb as string, small: urls.small as string, regular: urls.regular as string, full: urls.full as string },
    author: { name: author.name, profileUrl: author.profileUrl },
    pageUrl: str(v.pageUrl) ? v.pageUrl : '',
    unsplashId: str(v.unsplashId) ? v.unsplashId : v.id.replace(/^unsplash:/, ''),
  }
}

function readStyle(v: unknown): TypeStyle {
  if (!isObj(v)) return { ...DEFAULT_TYPE_STYLE }
  return {
    weight: num(v.weight) ? v.weight : null,
    leading: num(v.leading) ? v.leading : DEFAULT_TYPE_STYLE.leading,
    tracking: num(v.tracking) ? v.tracking : DEFAULT_TYPE_STYLE.tracking,
    uppercase: v.uppercase === true,
  }
}

/** One stored record, migrated to the current version; null if it isn't a usable board. */
export function readRecord(v: unknown): SavedBoard | null {
  if (!isObj(v) || !str(v.id) || !Array.isArray(v.photos)) return null
  const photos = v.photos
    .map((p) => (isObj(p) ? { photo: readPhoto(p.photo), tag: str(p.tag) ? p.tag : '' } : null))
    .filter((p): p is { photo: Photo; tag: string } => p !== null && p.photo !== null)
  if (!photos.length) return null
  const inc = isObj(v.include) ? v.include : {}
  const fonts = isObj(v.fonts) && num(v.fonts.display) && num(v.fonts.text) ? { display: v.fonts.display, text: v.fonts.text } : null
  return {
    version: SAVED_VERSION,
    id: v.id,
    savedAt: num(v.savedAt) ? v.savedAt : 0,
    title: str(v.title) && v.title.trim() ? v.title : 'Moodboard',
    template: TEMPLATES.includes(v.template as Template) ? (v.template as Template) : 'editorial',
    // boards saved before formats existed were open-ended: the default lámina
    format: FORMAT_ORDER.includes(v.format as Format) ? (v.format as Format) : DEFAULT_FORMAT,
    include: {
      palette: inc.palette !== false,
      type: inc.type !== false,
      keywords: inc.keywords !== false,
      notes: inc.notes === true,
    },
    notes: str(v.notes) ? v.notes : null,
    pairOffset: num(v.pairOffset) ? Math.trunc(v.pairOffset) : 0,
    fonts,
    typeStyle: readStyle(v.typeStyle),
    concept: Array.isArray(v.concept) ? v.concept.filter(str) : [],
    photos,
  }
}

/** Minimal storage interface (localStorage in the app, a fake in tests). */
export interface KeyValue {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Every saved board, most recent first. Never throws. */
export function readBoards(storage: KeyValue | null): SavedBoard[] {
  if (!storage) return []
  try {
    const raw = storage.getItem(STORAGE_KEY)
    const list: unknown = raw ? JSON.parse(raw) : []
    if (!Array.isArray(list)) return []
    return list
      .map(readRecord)
      .filter((r): r is SavedBoard => r !== null)
      .sort((a, b) => b.savedAt - a.savedAt)
  } catch {
    return []
  }
}

export type WriteResult = 'ok' | 'full' | 'unavailable'

/** Stores the whole list. «full» when the browser ran out of room, «unavailable» when it doesn't let us store at all. */
export function writeBoards(storage: KeyValue | null, list: SavedBoard[]): WriteResult {
  if (!storage) return 'unavailable'
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(list))
    return 'ok'
  } catch (e) {
    const name = e instanceof Error ? e.name : ''
    return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' ? 'full' : 'unavailable'
  }
}

// ─── List operations ────────────────────────────────────────────────────────

/** Adds or replaces a record, most recent first. */
export const upsert = (list: SavedBoard[], record: SavedBoard) => [record, ...list.filter((r) => r.id !== record.id)]

export const removeBoard = (list: SavedBoard[], id: string) => list.filter((r) => r.id !== id)

export function renameBoard(list: SavedBoard[], id: string, title: string): SavedBoard[] {
  const clean = title.trim().slice(0, 80)
  return clean ? list.map((r) => (r.id === id ? { ...r, title: clean } : r)) : list
}

/** A copy right after the original, titled «… (copia)». */
export function duplicateBoard(list: SavedBoard[], id: string, newId: string, now: number): SavedBoard[] {
  const original = list.find((r) => r.id === id)
  if (!original) return list
  const copy: SavedBoard = { ...original, id: newId, savedAt: now, title: `${original.title} (copia)`.slice(0, 80) }
  return [copy, ...list]
}

/** localStorage if the browser lets us use it (private modes may not). */
export function browserStorage(): KeyValue | null {
  try {
    const s = (globalThis as unknown as { localStorage?: KeyValue & { removeItem(key: string): void } }).localStorage
    if (!s) return null
    const probe = `${STORAGE_KEY}.probe`
    s.setItem(probe, '1')
    s.removeItem(probe)
    return s
  } catch {
    return null
  }
}

export const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`)
