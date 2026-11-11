import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { QuotaInfo, SearchResponse } from '../../shared/types'
import { StudioContext, type Board, type Include, type Picked, type StudioApi, type TagResult, type ToggleResult } from '../hooks/useStudio'
import { AiFailure, generate, getClientId, getQuota } from '../lib/aiApi'
import { AI_API_URL, AI_CONFIGURED } from '../lib/aiConfig'
import { applyProposal, conceptProblem, nextPaletteOrigin, reduceAiRequest, suggestedQueries, type AiRequestEvent, type AiRequestState, type ProposalPatch } from '../lib/aiProposal'
import { basisOf } from '../lib/colorLab'
import { DEFAULT_FORMAT } from '../lib/formats'
import { poolOf } from '../lib/pool'
import { TurnstileError } from '../lib/turnstile'
import { MAX_TAGS } from '../lib/tags'
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
  const boardRef = useRef(board)
  useLayoutEffect(() => {
    boardRef.current = board
  }, [board])
  const resultsRef = useRef(results)
  useLayoutEffect(() => {
    resultsRef.current = results
  }, [results])

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

  // an AI direction applied before «Armar»: the next build starts from it
  const [pendingAi, setPendingAi] = useState<ProposalPatch | null>(null)

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
        fonts: prev?.fonts ?? pendingAi?.fonts ?? null,
        typeStyle: prev?.typeStyle ?? DEFAULT_TYPE_STYLE,
        paletteEdit: prev?.paletteEdit ?? pendingAi?.paletteEdit ?? null,
        paletteOrigin: prev?.paletteOrigin ?? pendingAi?.paletteOrigin ?? 'fotos',
        aiPalette: prev?.aiPalette ?? pendingAi?.aiPalette ?? null,
        ai: prev?.ai ?? pendingAi?.ai ?? null,
        divergenceDismissal: prev?.divergenceDismissal ?? null,
        extras: prev?.extras ?? {},
        savedId: prev?.savedId ?? null,
        buildId: (prev?.buildId ?? 0) + 1,
      }))
      if (pendingAi) setPendingAi(null)
    },
    [idea, tags, pendingAi],
  )

  // every patch goes through the palette-origin rules (D22): touching a colour
  // over an AI palette turns it manual, with its basis on the photos of now (N5)
  const updateBoard = useCallback(
    (patch: Partial<Omit<Board, 'buildId' | 'savedId'>>) =>
      setBoard((b) => (b ? { ...b, ...nextPaletteOrigin(b, patch, basisOf(selectionRef.current.map((s) => s.photo.id))) } : b)),
    [],
  )
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
        paletteOrigin: board.paletteOrigin,
        aiPalette: board.aiPalette,
        ai: board.ai,
        divergenceDismissal: board.divergenceDismissal,
        extras: board.extras,
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
        paletteOrigin: r.paletteOrigin,
        aiPalette: r.aiPalette,
        ai: r.ai,
        divergenceDismissal: r.divergenceDismissal,
        extras: r.extras,
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

  // ─── AI (W3a) ─────────────────────────────────────────────────────────────
  // The request lives here, not in a component: navigating away doesn't lose a
  // generation that was already charged. The board is only touched by apply().

  const [aiState, setAiState] = useState<AiRequestState>({ status: 'idle' })
  const [aiQuota, setAiQuota] = useState<QuotaInfo | null>(null)
  const aiRequest = useRef(0)

  // the attempts left, without spending one, as soon as the Studio exists
  useEffect(() => {
    if (!AI_CONFIGURED) return
    let cancelled = false
    getQuota(getClientId(storage), { baseUrl: AI_API_URL }).then(
      (quota) => !cancelled && setAiQuota(quota),
      () => undefined, // a failing /quota never blocks the classic web (D8)
    )
    return () => {
      cancelled = true
    }
  }, [storage])

  const proposeAi = useCallback(
    async (concept: string, getToken: () => Promise<string>) => {
      const id = ++aiRequest.current
      const dispatch = (event: AiRequestEvent) => {
        if (aiRequest.current === id) setAiState((s) => reduceAiRequest(s, event))
      }
      dispatch({ type: 'pedir' })
      if (conceptProblem(concept)) {
        dispatch({ type: 'falla', code: 'invalid_params', resetAt: null })
        return
      }
      let token: string
      try {
        token = await getToken()
      } catch (err) {
        const scriptMissing = err instanceof TurnstileError && err.reason === 'script'
        dispatch({ type: 'falla', code: scriptMissing ? 'network' : 'captcha_failed', resetAt: null })
        return
      }
      try {
        const response = await generate({ concept: concept.trim(), clientId: getClientId(storage), turnstileToken: token }, { baseUrl: AI_API_URL })
        setAiQuota({ remaining: response.remaining, resetAt: response.resetAt })
        dispatch({ type: 'respuesta', response })
      } catch (err) {
        const failure = err instanceof AiFailure ? err : new AiFailure('network')
        if (failure.remaining !== null) setAiQuota({ remaining: failure.remaining, resetAt: failure.resetAt })
        dispatch({ type: 'falla', code: failure.code, resetAt: failure.resetAt })
      }
    },
    [storage],
  )

  const applyAi = useCallback(() => {
    if (aiState.status !== 'ready') return
    const brandbook = aiState.proposal.brandbook
    const patch = applyProposal(brandbook, selectionRef.current.map((s) => s.photo.id))
    if (!patch) return
    if (boardRef.current) setBoard((b) => (b ? { ...b, ...patch } : b))
    else setPendingAi(patch)
    // N1: with no tags of the user's own, the AI queries are the search; with
    // some, theirs stay and the AI's wait as suggestions (no Unsplash spent)
    if (!tags.length) search(brandbook.search_queries.slice(0, MAX_TAGS))
    setAiState({ status: 'idle' })
  }, [aiState, tags, search])

  const discardAi = useCallback(() => setAiState({ status: 'idle' }), [])

  const appliedAi = board?.ai ?? pendingAi?.ai ?? null
  const suggestedTags = useMemo(() => (tags.length ? suggestedQueries(appliedAi, tags) : []), [appliedAi, tags])

  const addSuggestedTag = useCallback(
    (tag: string) => {
      const current = resultsRef.current?.map((r) => r.tag) ?? []
      if (current.length >= MAX_TAGS || current.includes(tag)) return false
      search([...current, tag])
      return true
    },
    [search],
  )

  const ai = useMemo<StudioApi['ai']>(
    () => ({
      available: AI_CONFIGURED,
      state: aiState,
      remaining: aiQuota?.remaining ?? null,
      resetAt: aiQuota?.resetAt ?? null,
      propose: proposeAi,
      apply: applyAi,
      discard: discardAi,
      suggestedTags,
      addSuggestedTag,
    }),
    [aiState, aiQuota, proposeAi, applyAi, discardAi, suggestedTags, addSuggestedTag],
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
      ai,
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
      ai,
    ],
  )

  return <StudioContext.Provider value={api}>{children}</StudioContext.Provider>
}
