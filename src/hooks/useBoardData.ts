import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Photo } from '../../shared/types'
import type { TypePair } from '../data/typePairs'
import { loadPairFonts } from '../lib/fonts'
import { extractPalette, type PaletteResult } from '../lib/paletteImage'
import { writeNotes } from '../lib/notes'
import { effectivePair, pairKey, rankPairs, type PickedFonts, type TypeStyle } from '../lib/typography'
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

/**
 * Ranked type pairs for the concept, the pair shown (the ranked one, or the
 * fonts picked in the Type Lab, with its weight) and whether its fonts loaded.
 */
export function useTypePair(concept: string[], offset: number, enabled: boolean, picked: PickedFonts | null = null, style: TypeStyle | null = null) {
  const conceptKey = concept.join('\n')
  const ranked = useMemo(() => rankPairs(conceptKey ? conceptKey.split('\n') : []), [conceptKey])
  const auto: TypePair = ranked[((offset % ranked.length) + ranked.length) % ranked.length]
  const pair = useMemo(() => (style ? effectivePair(auto, picked, style) : auto), [auto, picked, style])
  const key = pairKey(pair)
  const [loaded, setLoaded] = useState<{ key: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    loadPairFonts(pair).then((ok) => !cancelled && setLoaded({ key: pairKey(pair), ok }))
    return () => {
      cancelled = true
    }
  }, [pair, enabled])

  return { pair, auto, ranked, position: ranked.indexOf(auto), fontsReady: loaded?.key === key ? loaded.ok : null }
}

/** Everything the board shows besides the photos, derived from the Studio state. */
export function useBoardData(board: Board | null, photos: Photo[]) {
  const { concept: tags } = useStudio()
  const include = board?.include
  const { palette: autoPalette, loading } = usePalette(photos, Boolean(board && include?.palette))
  // a palette edited in the Color Lab replaces the automatic one (order, count and roles)
  const edit = board?.paletteEdit
  const palette: PaletteResult | null = edit
    ? { colors: edit.colors.map((c) => c.hex), roles: edit.colors.map((c) => c.role), source: autoPalette?.source ?? 'pixels', pool: autoPalette?.pool ?? [] }
    : autoPalette
  const paletteLoading = edit ? false : loading
  const { pair, auto, ranked, position, fontsReady } = useTypePair(tags, board?.pairOffset ?? 0, Boolean(board && include?.type), board?.fonts ?? null, board?.typeStyle ?? null)

  const generated = writeNotes({
    tags,
    palette: palette?.colors ?? [],
    ratios: photos.map((p) => p.width / p.height),
    pair: include?.type ? { display: pair.display.family, text: pair.text.family, category: pair.category } : null,
  })

  return { tags, palette, autoPalette, paletteLoading, pair, auto, ranked, position, fontsReady, notes: board?.notes ?? generated }
}
