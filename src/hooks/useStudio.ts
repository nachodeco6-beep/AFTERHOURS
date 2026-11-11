import { createContext, useContext } from 'react'
import type { Photo } from '../../shared/types'
import type { SearchFailure } from '../lib/searchApi'
import type { Entry } from '../lib/select'

export interface TagResult {
  tag: string
  status: 'loading' | 'done' | 'error'
  photos: Photo[]
  /** Matches Unsplash has for this tag (not only the ones fetched). */
  total: number
  error?: SearchFailure
}

/** A photo in «Tu selección». `auto` = added by «Completar por mí». */
export interface Picked extends Entry {
  auto: boolean
}

import type { Brandbook } from '../../shared/types'
import type { AiRequestState, DivergenceDismissal, PaletteOrigin } from '../lib/aiProposal'
import type { PaletteEdit } from '../lib/colorLab'
import type { Template } from '../lib/compose'
import type { Format } from '../lib/formats'
import type { SavedBoard, WriteResult } from '../lib/saved'
import type { PickedFonts, TypeStyle } from '../lib/typography'

export type { Format, PickedFonts, SavedBoard, Template, TypeStyle, WriteResult }

/** What the moodboard shows besides the photos. All off = «Solo imágenes». */
export interface Include {
  palette: boolean
  type: boolean
  keywords: boolean
  notes: boolean
}

export const DEFAULT_INCLUDE: Include = { palette: true, type: true, keywords: true, notes: false }

export const onlyImages = (inc: Include) => !inc.palette && !inc.type && !inc.keywords && !inc.notes

/**
 * The moodboard settings. Its photos are the selection itself, in order:
 * reordering, removing or replacing on the board edits the selection.
 */
export interface Board {
  title: string
  template: Template
  /** Fixed canvas size: 16:9, 4:5 or A4. */
  format: Format
  include: Include
  /** Index into the ranked type pairs («Otra combinación»). */
  pairOffset: number
  /** Art-direction notes; null = use the generated text. */
  notes: string | null
  /** Fonts picked by hand in the Type Lab; null = the ranked pair («Otra combinación»). */
  fonts: PickedFonts | null
  typeStyle: TypeStyle
  /** Palette edited in the Color Lab; null = the automatic one, read from the photos. */
  paletteEdit: PaletteEdit | null
  /** Who put the active palette there (D22): the AI, a hand edit, or the photos. */
  paletteOrigin: PaletteOrigin
  /** The AI palette as proposed, kept even when another palette is active (D22). */
  aiPalette: PaletteEdit | null
  /** The applied brandbook, saved whole with the project (N9); null = no AI direction. */
  ai: Brandbook | null
  /** A dismissed divergence notice: D and the photos of that moment (D23). */
  divergenceDismissal: DivergenceDismissal | null
  /** Stored fields this build doesn't know, carried so saving never erases them (N9). */
  extras: Record<string, unknown>
  /** The saved board this one is (or null if it was never saved). */
  savedId: string | null
  /** Changes on every «Armar», so the view can scroll to the new board. */
  buildId: number
}

export type ToggleResult = 'added' | 'removed' | 'full'

/** The AI side of the Studio (W3a). The panel over it is Nacho's (W3b). */
export interface StudioAiApi {
  /** False when the env isn't set: the AI never shows and the web is the classic one (D8). */
  available: boolean
  state: AiRequestState
  /** Attempts left, when known (from /quota on mount and every answer). */
  remaining: number | null
  /** ISO in UTC: when the next attempt comes back; null with the quota full. */
  resetAt: string | null
  /** One generation. getToken comes from the Turnstile widget (a fresh token per request, N3). */
  propose: (concept: string, getToken: () => Promise<string>) => Promise<void>
  /** Applies the ready proposal to the board (D15); with no board yet, it waits for «Armar». */
  apply: () => void
  discard: () => void
  /** AI queries to add with one click when the user brought their own tags (N1). */
  suggestedTags: string[]
  /** False when the board already searches the most tags it can. */
  addSuggestedTag: (tag: string) => boolean
}

export interface StudioApi {
  idea: string
  setIdea: (idea: string) => void
  /** null until the first search. */
  results: TagResult[] | null
  searching: boolean
  search: (tags: string[]) => void
  /** How many of these tags would actually hit the Worker (the rest are remembered). */
  requestsFor: (tags: string[]) => number

  /** Tags of the current results, in order. */
  tags: string[]
  /** Every unique photo of the current results that isn't selected. */
  pool: Entry[]

  selection: Picked[]
  isSelected: (photoId: string) => boolean
  toggleSelect: (entry: Entry) => ToggleResult
  removeSelected: (photoId: string) => void
  /** Moves a photo one place before (-1) or after (+1). */
  moveSelected: (photoId: string, delta: -1 | 1) => void
  reorderSelection: (photoIds: string[]) => void
  replaceSelected: (photoId: string, entry: Entry) => void
  /** «Completar por mí»; returns how many photos were added. */
  complete: () => number

  board: Board | null
  buildBoard: (include: Include) => void
  updateBoard: (patch: Partial<Omit<Board, 'buildId' | 'savedId'>>) => void
  dismantleBoard: () => void

  /** The tags the board speaks of (keywords, notes, type pair). */
  concept: string[]
  /** Boards saved in this browser, most recent first. */
  saved: SavedBoard[]
  /** False when the browser doesn't let us store anything (private mode, blocked). */
  canSave: boolean
  /** There's a board with changes that aren't saved. */
  dirty: boolean
  saveBoard: () => WriteResult
  openSaved: (id: string) => void
  duplicateSaved: (id: string) => WriteResult
  renameSaved: (id: string, title: string) => WriteResult
  removeSaved: (id: string) => WriteResult

  ai: StudioAiApi
}

export const StudioContext = createContext<StudioApi | null>(null)

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>')
  return ctx
}
