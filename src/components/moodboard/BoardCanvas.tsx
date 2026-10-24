import { useMemo, type CSSProperties, type ReactNode } from 'react'
import type { Photo } from '../../../shared/types'
import type { TypePair } from '../../data/typePairs'
import { onlyImages, type Board } from '../../hooks/useStudio'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { compose, composeMobile, type BlockKind, type Item, type Template } from '../../lib/compose'
import { pad } from '../../lib/format'
import type { PaletteResult } from '../../lib/paletteImage'
import { fontStack } from '../../lib/typography'
import { PhotoCredit } from '../studio/PhotoCredit'
import { PhotoFrame } from '../studio/PhotoFrame'
import { KeywordsBlock, NotesBlock, PaletteBlock, TypeBlock } from './Blocks'

/** Gutter (px) and outer padding per template: the same grid, different air. */
const AIR: Record<Template, { gap: number; mobileGap: number; frame: string }> = {
  editorial: { gap: 20, mobileGap: 16, frame: 'p-5 sm:p-8 md:p-12' },
  collage: { gap: 4, mobileGap: 4, frame: 'p-3 sm:p-4 md:p-5' },
  grilla: { gap: 32, mobileGap: 14, frame: 'p-6 sm:p-10 md:p-16' },
}

interface CanvasProps {
  board: Board
  photos: Photo[]
  tags: string[]
  palette: PaletteResult | null
  paletteLoading: boolean
  pair: TypePair
  fontsReady: boolean | null
  notes: string
  onTitle: (title: string) => void
  onNotes: (notes: string) => void
}

function PhotoCell({ photo, number, widthShare }: { photo: Photo; number: number; widthShare: number }) {
  return (
    <figure className="group relative h-full w-full overflow-hidden bg-char">
      <PhotoFrame photo={photo} className="absolute inset-0" sizes={`(min-width: 768px) ${Math.round(widthShare * 100)}vw, 100vw`} />
      {/* discreet credit: on hover/focus on desktop, always on touch screens */}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-2.5 pt-6 pb-2 text-[0.6875rem] leading-tight text-bone/80 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <span className="label-sm text-acid">{pad(number)}</span>
        <PhotoCredit photo={photo} className="min-w-0 truncate" />
      </figcaption>
    </figure>
  )
}

export function BoardCanvas({ board, photos, tags, palette, paletteLoading, pair, fontsReady, notes, onTitle, onNotes }: CanvasProps) {
  const desktop = useMediaQuery('(min-width: 768px)')
  const { include, template } = board
  const bare = onlyImages(include)
  const blocks = useMemo<BlockKind[]>(
    () => [include.keywords && tags.length > 0 && 'keywords', include.palette && 'palette', include.type && 'type', include.notes && 'notes'].filter(Boolean) as BlockKind[],
    [include, tags.length],
  )
  const ratios = useMemo(() => photos.map((p) => p.width / p.height), [photos])
  const layout = useMemo(() => (desktop ? compose(ratios, blocks, template) : null), [desktop, ratios, blocks, template])
  const mobile = useMemo(() => (desktop ? null : composeMobile(ratios, blocks, template)), [desktop, ratios, blocks, template])
  const air = AIR[template]

  const titleStyle: CSSProperties = include.type ? { fontFamily: fontStack(pair.display), ...pair.display.style, textTransform: 'none' } : {}

  const render = (item: Item, widthShare: number, vertical: boolean): ReactNode => {
    switch (item.kind) {
      case 'photo':
        return <PhotoCell photo={photos[item.index]} number={item.index + 1} widthShare={widthShare} />
      case 'palette':
        return <PaletteBlock palette={palette} loading={paletteLoading} vertical={vertical} />
      case 'type':
        return <TypeBlock pair={pair} fontsReady={fontsReady} />
      case 'keywords':
        return <KeywordsBlock tags={tags} />
      case 'notes':
        return <NotesBlock value={notes} onChange={onNotes} />
    }
  }

  const keyOf = (item: Item) => (item.kind === 'photo' ? photos[item.index].id : item.kind)

  return (
    <article aria-label={`Moodboard: ${board.title}`} className={`border border-line bg-[#0c0c0b] ${air.frame}`}>
      <header className={`flex flex-col gap-4 border-b border-line ${bare ? 'mb-5 pb-4' : 'mb-8 pb-6 md:mb-12 md:pb-8'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <p className="label text-acid">Moodboard</p>
          <p className="label text-dim">
            {photos.length} fotos · {template === 'editorial' ? 'Editorial' : template === 'collage' ? 'Collage' : 'Grilla'}
          </p>
        </div>
        <label htmlFor="board-title" className="sr-only">
          Título del moodboard
        </label>
        <input
          id="board-title"
          value={board.title}
          onChange={(e) => onTitle(e.target.value)}
          maxLength={80}
          spellCheck
          className={`w-full min-w-0 bg-transparent text-bone outline-none placeholder:text-dim focus-visible:shadow-[inset_0_-2px_0_var(--color-acid)] ${
            bare ? 'display text-[clamp(1.5rem,3vw,2.25rem)]' : 'display text-[clamp(2.75rem,8.5vw,8.5rem)] leading-[0.9]'
          }`}
          style={titleStyle}
          placeholder="Título"
        />
      </header>

      {layout && (
        <div style={{ containerType: 'inline-size' }}>
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
              gridAutoRows: `calc((100cqi - ${11 * air.gap}px) / 12)`,
              gap: air.gap,
            }}
          >
            {layout.cells.map((c) => (
              <div key={keyOf(c.item)} className="min-h-0 min-w-0" style={{ gridColumn: `${c.col} / span ${c.w}`, gridRow: `${c.row} / span ${c.h}` }}>
                {render(c.item, c.w / 12, c.w / c.h < 0.8)}
              </div>
            ))}
          </div>
        </div>
      )}

      {mobile && (
        <div className={`grid ${mobile.columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ gap: air.mobileGap }}>
          {mobile.cells.map((c) => (
            <div key={keyOf(c.item)} className={c.span === 2 && mobile.columns === 2 ? 'col-span-2' : ''} style={c.ratio ? { aspectRatio: c.ratio } : undefined}>
              {render(c.item, c.span === 2 || mobile.columns === 1 ? 1 : 0.5, false)}
            </div>
          ))}
        </div>
      )}

      <footer className={`border-t border-line ${bare ? 'mt-5 pt-4' : 'mt-8 pt-6 md:mt-12'}`}>
        <p className="label-sm text-dim">Créditos</p>
        <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-mute sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <li key={p.id} className="flex min-w-0 gap-2">
              <span className="label-sm shrink-0 pt-px text-dim">{pad(i + 1)}</span>
              <PhotoCredit photo={p} className="min-w-0" />
            </li>
          ))}
        </ol>
        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="display text-lg text-bone">Afterhours</p>
          <p className="label-sm text-dim">Fotos de Unsplash</p>
        </div>
      </footer>
    </article>
  )
}
