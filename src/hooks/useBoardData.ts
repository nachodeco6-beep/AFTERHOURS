import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../../shared/types'
import type { TypePair } from '../data/typePairs'
import { loadPairFonts } from '../lib/fonts'
import { extractPalette, type PaletteResult } from '../lib/paletteImage'
import { writeNotes } from '../lib/notes'
import { parseTags } from '../lib/tags'
import { rankPairs } from '../lib/typography'
import { useStudio, type Board } from './useStudio'

/** The board's palette, recalculated whenever its photos change (by id, not by array identity). */
export function usePalette(photos: Photo[], enabled: boolean) {
  const key = photos.map((p) => p.id).join('|')
  const latest = useRef(photos)
  useLayoutEffect(() => {
    latest.current = photos
  }, [photos])
  const [state, setState] = useState<{ key: string; result: PaletteResult } | null>(null)

  useEffect(() => {
    if (!enabled || !key) return
    let cancelled = false
    extractPalette(latest.current).then((result) => !cancelled && setState({ key, result }))
    return () => {
      cancelled = true
    }
  }, [key, enabled])

  const fresh = state?.key === key
  return { palette: fresh ? state.result : null, loading: enabled && !fresh }
}

/** Ranked type pairs for the concept, the current pick, and whether its fonts loaded. */
export function useTypePair(concept: string[], offset: number, enabled: boolean) {
  const conceptKey = concept.join('\n')
  const ranked = useMemo(() => rankPairs(conceptKey ? conceptKey.split('\n') : []), [conceptKey])
  const pair: TypePair = ranked[((offset % ranked.length) + ranked.length) % ranked.length]
  const [loaded, setLoaded] = useState<{ id: number; ok: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadPairFonts(pair).then((ok) => !cancelled && setLoaded({ id: pair.id, ok }))
    return () => {
      cancelled = true
    }
  }, [pair, enabled])

  return { pair, ranked, position: ranked.indexOf(pair), fontsReady: loaded?.id === pair.id ? loaded.ok : null }
}

/** Everything the board shows besides the photos, derived from the Studio state. */
export function useBoardData(board: Board | null, photos: Photo[]) {
  const { idea, tags: resultTags } = useStudio()
  const ideaTags = parseTags(idea).searchable
  const tags = ideaTags.length ? ideaTags : resultTags
  const include = board?.include
  const { palette, loading: paletteLoading } = usePalette(photos, Boolean(board && include?.palette))
  const { pair, ranked, position, fontsReady } = useTypePair(tags, board?.pairOffset ?? 0, Boolean(board && include?.type))

  const generated = writeNotes({
    tags,
    palette: palette?.colors ?? [],
    ratios: photos.map((p) => p.width / p.height),
    pair: include?.type ? { display: pair.display.family, text: pair.text.family, category: pair.category } : null,
  })

  return { tags, palette, paletteLoading, pair, ranked, position, fontsReady, notes: board?.notes ?? generated }
}
