import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

export interface Entry {
  id: string
  body: string
  createdAt: number
  updatedAt: number
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error'

const KEY = 'afterhours.journal.v1'
const UNDO_MS = 7000

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`

function isEntry(v: unknown): v is Entry {
  if (!v || typeof v !== 'object') return false
  const e = v as Record<string, unknown>
  return typeof e.id === 'string' && typeof e.body === 'string' && typeof e.createdAt === 'number' && typeof e.updatedAt === 'number'
}

function load(): { entries: Entry[]; available: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(KEY)
  } catch {
    return { entries: [], available: false } // storage blocked (private mode, policy…)
  }
  if (!raw) return { entries: [], available: true }
  try {
    const parsed: unknown = JSON.parse(raw)
    return { entries: Array.isArray(parsed) ? parsed.filter(isEntry) : [], available: true }
  } catch {
    // Corrupt data: keep a copy aside rather than silently overwriting it.
    try {
      localStorage.setItem(`${KEY}.corrupt-${Date.now()}`, raw)
    } catch {
      // nothing more we can do
    }
    return { entries: [], available: true }
  }
}

function persist(entries: Entry[]) {
  // Empty drafts are never written to disk.
  localStorage.setItem(KEY, JSON.stringify(entries.filter((e) => e.body.trim().length > 0)))
}

export function useJournal() {
  const [initial] = useState(load)
  const [entries, setEntries] = useState<Entry[]>(initial.entries)
  const [activeId, setActiveId] = useState<string | null>(initial.entries[0]?.id ?? null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [trash, setTrash] = useState<{ entry: Entry; index: number } | null>(null)
  const available = initial.available

  const entriesRef = useRef(entries)
  useLayoutEffect(() => {
    entriesRef.current = entries
  }, [entries])
  const dirty = useRef(false)

  const flush = useCallback(() => {
    if (!dirty.current || !available) return
    try {
      persist(entriesRef.current)
      dirty.current = false
      setSaveState('saved')
      setSavedAt(Date.now())
    } catch {
      setSaveState('error')
    }
  }, [available])

  // Debounced autosave + a final flush when the page is hidden or closed.
  useEffect(() => {
    if (!dirty.current) return
    setSaveState('saving')
    const t = window.setTimeout(flush, 450)
    return () => window.clearTimeout(t)
  }, [entries, flush])

  useEffect(() => {
    const onHide = () => flush()
    const onVisibility = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [flush])

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return
      const next = load().entries
      setEntries((cur) => {
        const draft = cur.find((x) => x.id === activeId && !x.body.trim())
        return draft ? [draft, ...next] : next
      })
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [activeId])

  const mutate = useCallback((fn: (list: Entry[]) => Entry[]) => {
    dirty.current = true
    setEntries(fn)
  }, [])

  /** Drop the active entry if it was left empty — there is nothing to lose. */
  const discardEmpty = useCallback(
    (keepId?: string) => {
      const cur = entriesRef.current.find((e) => e.id === activeId)
      if (cur && cur.id !== keepId && !cur.body.trim()) {
        setEntries((list) => list.filter((e) => e.id !== cur.id))
      }
    },
    [activeId],
  )

  const create = useCallback(() => {
    const cur = entriesRef.current.find((e) => e.id === activeId)
    if (cur && !cur.body.trim()) return cur.id // already on a blank page
    const now = Date.now()
    const entry: Entry = { id: uid(), body: '', createdAt: now, updatedAt: now }
    setEntries((list) => [entry, ...list])
    setActiveId(entry.id)
    return entry.id
  }, [activeId])

  const select = useCallback(
    (id: string) => {
      if (id === activeId) return
      discardEmpty(id)
      setActiveId(id)
    },
    [activeId, discardEmpty],
  )

  const update = useCallback(
    (body: string) => {
      if (!activeId) {
        // typing into the empty state creates the first entry
        const now = Date.now()
        const entry: Entry = { id: uid(), body, createdAt: now, updatedAt: now }
        mutate((list) => [entry, ...list])
        setActiveId(entry.id)
        return
      }
      mutate((list) => list.map((e) => (e.id === activeId ? { ...e, body, updatedAt: Date.now() } : e)))
    },
    [activeId, mutate],
  )

  const remove = useCallback(
    (id: string) => {
      const list = entriesRef.current
      const index = list.findIndex((e) => e.id === id)
      if (index < 0) return
      const entry = list[index]
      const rest = list.filter((e) => e.id !== id)
      mutate(() => rest)
      if (entry.body.trim()) setTrash({ entry, index })
      if (id === activeId) setActiveId(rest[Math.min(index, rest.length - 1)]?.id ?? null)
    },
    [activeId, mutate],
  )

  const undo = useCallback(() => {
    if (!trash) return
    const { entry, index } = trash
    mutate((list) => {
      const next = list.filter((e) => e.id !== entry.id)
      next.splice(Math.min(index, next.length), 0, entry)
      return next
    })
    discardEmpty(entry.id)
    setActiveId(entry.id)
    setTrash(null)
  }, [trash, mutate, discardEmpty])

  useEffect(() => {
    if (!trash) return
    const t = window.setTimeout(() => setTrash(null), UNDO_MS)
    return () => window.clearTimeout(t)
  }, [trash])

  const sorted = useMemo(() => [...entries].sort((a, b) => b.updatedAt - a.updatedAt), [entries])
  const active = entries.find((e) => e.id === activeId) ?? null

  return {
    entries: sorted,
    active,
    activeId,
    available,
    saveState,
    savedAt,
    trash,
    create,
    select,
    update,
    remove,
    undo,
    dismissTrash: () => setTrash(null),
  }
}
