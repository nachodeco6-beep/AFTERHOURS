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

import type { Template } from '../lib/compose'

export type { Template }

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
  include: Include
  /** Index into the ranked type pairs («Otra combinación»). */
  pairOffset: number
  /** Art-direction notes; null = use the generated text. */
  notes: string | null
  /** Changes on every «Armar», so the view can scroll to the new board. */
  buildId: number
}

export type ToggleResult = 'added' | 'removed' | 'full'

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
  updateBoard: (patch: Partial<Omit<Board, 'buildId'>>) => void
  dismantleBoard: () => void
}

export const StudioContext = createContext<StudioApi | null>(null)

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>')
  return ctx
}
