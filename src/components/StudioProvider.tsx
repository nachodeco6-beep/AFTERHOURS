import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SearchResponse } from '../../shared/types'
import { StudioContext, type Board, type Include, type Picked, type StudioApi, type TagResult, type ToggleResult } from '../hooks/useStudio'
import { poolOf } from '../lib/pool'
import { SearchFailure, searchPhotos } from '../lib/searchApi'
import { completeSelection, MAX_SELECTION, type Entry } from '../lib/select'
import { parseTags, tagKey } from '../lib/tags'

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase('es') + s.slice(1)

/**
 * Holds the Studio's idea, results, selection and moodboard above the router,
 * so they survive a trip to the home page. Successful searches are remembered
 * for the visit: repeating a tag doesn't spend another Unsplash request.
 * The selection keeps whole photos, so it also survives filters and new searches.
 */
export function StudioProvider({ children }: { children: ReactNode }) {
  const [idea, setIdea] = useState('')
  const [results, setResults] = useState<TagResult[] | null>(null)
  const [selection, setSelection] = useState<Picked[]>([])
  const [board, setBoard] = useState<Board | null>(null)
  const remembered = useRef(new Map<string, SearchResponse>())
  const controller = useRef<AbortController | null>(null)
  const selectionRef = useRef(selection)
  useLayoutEffect(() => {
    selectionRef.current = selection
  }, [selection])

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

  // ─── Selection ────────────────────────────────────────────────────────────

  const tags = useMemo(() => results?.map((r) => r.tag) ?? [], [results])
  const selectedIds = useMemo(() => new Set(selection.map((s) => s.photo.id)), [selection])
  const pool = useMemo(() => (results ? poolOf(results).filter((e) => !selectedIds.has(e.photo.id)) : []), [results, selectedIds])
  const poolRef = useRef(pool)
  useLayoutEffect(() => {
    poolRef.current = pool
  }, [pool])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const toggleSelect = useCallback((entry: Entry): ToggleResult => {
    const current = selectionRef.current
    if (current.some((s) => s.photo.id === entry.photo.id)) {
      setSelection(current.filter((s) => s.photo.id !== entry.photo.id))
      return 'removed'
    }
    if (current.length >= MAX_SELECTION) return 'full'
    setSelection([...current, { ...entry, auto: false }])
    return 'added'
  }, [])

  const removeSelected = useCallback((id: string) => setSelection((list) => list.filter((s) => s.photo.id !== id)), [])

  const moveSelected = useCallback((id: string, delta: -1 | 1) => {
    setSelection((list) => {
      const i = list.findIndex((s) => s.photo.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }, [])

  const reorderSelection = useCallback((ids: string[]) => {
    setSelection((list) => {
      const byId = new Map(list.map((s) => [s.photo.id, s]))
      const next = ids.map((id) => byId.get(id)).filter((s): s is Picked => Boolean(s))
      return next.length === list.length ? next : list
    })
  }, [])

  const replaceSelected = useCallback((id: string, entry: Entry) => {
    setSelection((list) =>
      list.some((s) => s.photo.id === entry.photo.id) ? list : list.map((s) => (s.photo.id === id ? { ...entry, auto: false } : s)),
    )
  }, [])

  const complete = useCallback(() => {
    const added = completeSelection(selectionRef.current, poolRef.current, tags)
    if (added.length) setSelection((list) => [...list, ...added.map((e) => ({ ...e, auto: true }))])
    return added.length
  }, [tags])

  // ─── Board ────────────────────────────────────────────────────────────────

  const buildBoard = useCallback(
    (include: Include) => {
      const first = parseTags(idea).searchable[0] ?? tags[0] ?? 'Moodboard'
      setBoard((prev) => ({
        title: prev?.title ?? capitalize(first),
        template: prev?.template ?? 'editorial',
        include,
        pairOffset: prev?.pairOffset ?? 0,
        notes: prev?.notes ?? null,
        buildId: (prev?.buildId ?? 0) + 1,
      }))
    },
    [idea, tags],
  )

  const updateBoard = useCallback((patch: Partial<Omit<Board, 'buildId'>>) => setBoard((b) => (b ? { ...b, ...patch } : b)), [])
  const dismantleBoard = useCallback(() => setBoard(null), [])

  const searching = results?.some((r) => r.status === 'loading') ?? false

  const api = useMemo<StudioApi>(
    () => ({
      idea,
      setIdea,
      results,
      searching,
      search,
      requestsFor,
      tags,
      pool,
      selection,
      isSelected,
      toggleSelect,
      removeSelected,
      moveSelected,
      reorderSelection,
      replaceSelected,
      complete,
      board,
      buildBoard,
      updateBoard,
      dismantleBoard,
    }),
    [idea, results, searching, search, requestsFor, tags, pool, selection, isSelected, toggleSelect, removeSelected, moveSelected, reorderSelection, replaceSelected, complete, board, buildBoard, updateBoard, dismantleBoard],
  )

  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>
}
