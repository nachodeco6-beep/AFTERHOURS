import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { SearchResponse } from '../../shared/types'
import { StudioContext, type Board, type Include, type Picked, type StudioApi, type TagResult, type ToggleResult } from '../hooks/useStudio'
import { DEFAULT_FORMAT } from '../lib/formats'
import { poolOf } from '../lib/pool'
import {
  browserStorage,
  contentOf,
  duplicateBoard,
  makeRecord,
  newId,
  readBoards,
  removeBoard,
  renameBoard,
  signature,
  upsert,
  writeBoards,
  type BoardContent,
  type SavedBoard,
} from '../lib/saved'
import { SearchFailure, searchPhotos } from '../lib/searchApi'
import { completeSelection, MAX_SELECTION, type Entry } from '../lib/select'
import { parseTags, tagKey } from '../lib/tags'
import { DEFAULT_TYPE_STYLE } from '../lib/typography'

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
        format: prev?.format ?? DEFAULT_FORMAT,
        include,
        pairOffset: prev?.pairOffset ?? 0,
        notes: prev?.notes ?? null,
        fonts: prev?.fonts ?? null,
        typeStyle: prev?.typeStyle ?? DEFAULT_TYPE_STYLE,
        paletteEdit: prev?.paletteEdit ?? null,
        savedId: prev?.savedId ?? null,
        buildId: (prev?.buildId ?? 0) + 1,
      }))
    },
    [idea, tags],
  )

  const updateBoard = useCallback((patch: Partial<Omit<Board, 'buildId' | 'savedId'>>) => setBoard((b) => (b ? { ...b, ...patch } : b)), [])
  const dismantleBoard = useCallback(() => setBoard(null), [])

  // ─── Saved boards ─────────────────────────────────────────────────────────

  const ideaTags = useMemo(() => parseTags(idea).searchable, [idea])
  const concept = ideaTags.length ? ideaTags : tags
  const [storage] = useState(browserStorage)
  const [saved, setSaved] = useState<SavedBoard[]>(() => readBoards(storage))
  // signature of the board as last saved or opened: anything else is an unsaved change
  const [savedSignature, setSavedSignature] = useState<string | null>(null)

  const content = useMemo<BoardContent | null>(
    () =>
      board && {
        title: board.title,
        template: board.template,
        format: board.format,
        include: board.include,
        notes: board.notes,
        pairOffset: board.pairOffset,
        fonts: board.fonts,
        typeStyle: board.typeStyle,
        palette: board.paletteEdit,
        concept,
        photos: selection.map((s) => ({ photo: s.photo, tag: s.tag })),
      },
    [board, concept, selection],
  )
  const dirty = content !== null && (board?.savedId == null || signature(content) !== savedSignature)

  const commit = useCallback(
    (next: SavedBoard[]) => {
      const res = writeBoards(storage, next)
      if (res === 'ok') setSaved(next)
      return res
    },
    [storage],
  )

  const saveBoard = useCallback(() => {
    if (!board || !content) return 'unavailable'
    const id = board.savedId ?? newId()
    const res = commit(upsert(saved, makeRecord(content, id, Date.now())))
    if (res === 'ok') {
      setBoard((b) => (b ? { ...b, savedId: id } : b))
      setSavedSignature(signature(content))
    }
    return res
  }, [board, content, saved, commit])

  const openSaved = useCallback(
    (id: string) => {
      const r = saved.find((s) => s.id === id)
      if (!r) return
      setSelection(r.photos.map((p) => ({ photo: p.photo, tag: p.tag, auto: false })))
      setIdea(r.concept.join(', '))
      setBoard((prev) => ({
        title: r.title,
        template: r.template,
        format: r.format,
        include: r.include,
        pairOffset: r.pairOffset,
        notes: r.notes,
        fonts: r.fonts,
        typeStyle: r.typeStyle,
        paletteEdit: r.palette,
        savedId: r.id,
        buildId: (prev?.buildId ?? 0) + 1,
      }))
      setSavedSignature(signature(contentOf(r)))
    },
    [saved],
  )

  const duplicateSaved = useCallback((id: string) => commit(duplicateBoard(saved, id, newId(), Date.now())), [saved, commit])

  const renameSaved = useCallback(
    (id: string, title: string) => {
      const next = renameBoard(saved, id, title)
      const res = commit(next)
      const renamed = next.find((r) => r.id === id)
      // the open board follows its saved name (other unsaved changes stay unsaved)
      if (res === 'ok' && renamed && board?.savedId === id) {
        setBoard((b) => (b ? { ...b, title: renamed.title } : b))
        setSavedSignature(signature(contentOf(renamed)))
      }
      return res
    },
    [saved, commit, board?.savedId],
  )

  const removeSaved = useCallback(
    (id: string) => {
      const res = commit(removeBoard(saved, id))
      if (res === 'ok' && board?.savedId === id) {
        setBoard((b) => (b ? { ...b, savedId: null } : b))
        setSavedSignature(null)
      }
      return res
    },
    [saved, commit, board?.savedId],
  )

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
      concept,
      saved,
      canSave: storage !== null,
      dirty,
      saveBoard,
      openSaved,
      duplicateSaved,
      renameSaved,
      removeSaved,
    }),
    [
      idea,
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
      concept,
      saved,
      storage,
      dirty,
      saveBoard,
      openSaved,
      duplicateSaved,
      renameSaved,
      removeSaved,
    ],
  )

  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>
}
