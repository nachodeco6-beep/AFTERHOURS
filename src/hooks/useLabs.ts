import { useSyncExternalStore } from 'react'
import { addPair, addPalette, readLabs, removePair, removePalette, setLastPair, writeLabs, type LabsRecord, type SavedPaletteColor } from '../lib/labs'
import { browserStorage, newId, type WriteResult } from '../lib/saved'
import type { PickedFonts, TypeStyle } from '../lib/typography'

/**
 * The labs' favourites, shared by the Type Lab, the Color Lab and the Archivo
 * (a tiny store over localStorage: every view sees the same list).
 */
const storage = browserStorage()
let state: LabsRecord = readLabs(storage)
const listeners = new Set<() => void>()

function commit(next: LabsRecord): WriteResult {
  const result = writeLabs(storage, next)
  state = next
  listeners.forEach((l) => l())
  return result
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** What a favourite opened from the Archivo asks its lab to show (taken once). */
export type OpenRequest = { kind: 'pair'; id: string } | { kind: 'palette'; id: string }
let pending: OpenRequest | null = null
export const requestOpen = (r: OpenRequest) => {
  pending = r
}
export const takeOpenRequest = () => {
  const r = pending
  pending = null
  return r
}

export function useLabs() {
  const labs = useSyncExternalStore(subscribe, () => state)
  return {
    ...labs,
    canSave: storage !== null,
    savePair: (fonts: PickedFonts, style: TypeStyle) => commit(addPair(state, fonts, style, newId(), Date.now())),
    removePair: (id: string) => commit(removePair(state, id)),
    savePalette: (name: string, colors: SavedPaletteColor[]) => commit(addPalette(state, name, colors, newId(), Date.now())),
    removePalette: (id: string) => commit(removePalette(state, id)),
    /** Remembered quietly (no message if the browser doesn't let us). */
    setLastPair: (fonts: PickedFonts) => {
      if (state.lastPair?.display !== fonts.display || state.lastPair?.text !== fonts.text) commit(setLastPair(state, fonts))
    },
  }
}
