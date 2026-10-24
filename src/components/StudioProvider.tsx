import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SearchResponse } from '../../shared/types'
import { StudioContext, type StudioApi, type TagResult } from '../hooks/useStudio'
import { SearchFailure, searchPhotos } from '../lib/searchApi'
import { tagKey } from '../lib/tags'

/**
 * Holds the Studio's idea and results above the router, so they survive a
 * trip to the home page. Successful searches are remembered for the visit:
 * repeating a tag doesn't spend another Unsplash request.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [idea, setIdea] = useState('')
  const [results, setResults] = useState<TagResult[] | null>(null)
  const remembered = useRef(new Map<string, SearchResponse>())
  const controller = useRef<AbortController | null>(null)

  useEffect(() => () => controller.current?.abort(), [])

  const requestsFor = useCallback((tags: string[]) => tags.filter((t) => !remembered.current.has(tagKey(t))).length, [])

  const search = useCallback((tags: string[]) => {
    controller.current?.abort()
    const ac = new AbortController()
    controller.current = ac

    const update = (tag: string, patch: Partial<TagResult>) =>
      setResults((list) => list?.map((r) => (r.tag === tag ? { ...r, ...patch } : r)) ?? list)

    setResults(
      tags.map((tag) => {
        const hit = remembered.current.get(tagKey(tag))
        return hit ? { tag, status: 'done', photos: hit.photos, total: hit.total } : { tag, status: 'loading', photos: [], total: 0 }
      }),
    )

    for (const tag of tags) {
      const key = tagKey(tag)
      if (remembered.current.has(key)) continue
      searchPhotos(tag, ac.signal).then(
        (res) => {
          remembered.current.set(key, res)
          if (!ac.signal.aborted) update(tag, { status: 'done', photos: res.photos, total: res.total })
        },
        (err: unknown) => {
          if (ac.signal.aborted) return
          update(tag, { status: 'error', error: err instanceof SearchFailure ? err : new SearchFailure('network') })
        },
      )
    }
  }, [])

  const searching = results?.some((r) => r.status === 'loading') ?? false

  const api = useMemo<StudioApi>(
    () => ({ idea, setIdea, results, searching, search, requestsFor }),
    [idea, results, searching, search, requestsFor],
  )

  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>
}
