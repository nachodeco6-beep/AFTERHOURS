import { createContext, useContext } from 'react'
import type { Photo } from '../../shared/types'
import type { SearchFailure } from '../lib/searchApi'

export interface TagResult {
  tag: string
  status: 'loading' | 'done' | 'error'
  photos: Photo[]
  /** Matches Unsplash has for this tag (not only the ones fetched). */
  total: number
  error?: SearchFailure
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
}

export const StudioContext = createContext<StudioApi | null>(null)

export function useStudio() {
  const ctx = useContext(StudioContext)
  if (!ctx) throw new Error('useStudio must be used inside <StudioProvider>')
  return ctx
}
