import { useMemo, type CSSProperties, type ReactNode } from 'react'
import type { Photo } from '../../../shared/types'
import type { TypePair } from '../../data/typePairs'
import { onlyImages, type Board } from '../../hooks/useStudio'
import { compose, type BlockKind, type Item } from '../../lib/compose'
import { pad } from '../../lib/format'
import { canvasGeometry, FORMATS } from '../../lib/formats'
import type { PaletteResult } from '../../lib/paletteImage'
import { fontCss } from '../../lib/typography'
import { UNSPLASH_URL } from '../../lib/unsplash'
import { PhotoCredit } from '../studio/PhotoCredit'
import { PhotoFrame } from '../studio/PhotoFrame'
import { KeywordsBlock, NotesBlock, PaletteBlock, TypeBlock } from './Blocks'

const TEMPLATE_NAME = {
  editorial: 'Editorial',
  collage: 'Collage',
  grilla: 'Grilla',
} as const
const FORMAT_SHORT = { horizontal: '16:9', vertical: '4:5', a4: 'A4' } as const

export interface CanvasProps {
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
  /** How much the canvas is scaled on screen: picks the right image size. */
  scale: number
  /** Opens the Type Lab from the type block. */
  onTypeLab?: () => void
  /** Opens the Color Lab from the palette block. */
  onColorLab?: () => void
}

function PhotoCell({ photo, number, width }: { photo: Photo; number: number; width: number }) {
  return (
    <figure className="group relative h-full w-full overflow-hidden bg-char">
      <PhotoFrame photo={photo} className="absolute inset-0" sizes={`${Math.max(1, Math.ceil(width))}px`} />
      {/* discreet credit on hover/focus; the footer always lists every credit */}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent px-2.5 pt-6 pb-2 text-[0.6875rem] leading-tight text-bone/80 opacity-0 transition-opacity duration-300 group-focus-within:opacity-100 group-hover:opacity-100">
        <span className="label-sm text-acid">{pad(number)}</span>
        <PhotoCredit photo={photo} className="min-w-0 truncate" />
      </figcaption>
    </figure>
  )
}

/**
 * The board itself: a canvas with the format's fixed size (see formats.ts),
 * the same on every screen. The parent scales it to fit.
 */
export function BoardCanvas({ board, photos, tags, palette, paletteLoading, pair, fontsReady, notes, onTitle, onNotes, scale, onTypeLab, onColorLab }: CanvasProps) {
  const { include, template, format } = board
  const bare = onlyImages(include)
  const blocks = useMemo<BlockKind[]>(
    () => [include.keywords && tags.length > 0 && 'keywords', include.palette && 'palette', include.type && 'type', include.notes && 'notes'].filter(Boolean) as BlockKind[],
    [include, tags.length],
  )
  const ratios = useMemo(() => photos.map((p) => p.width / p.height), [photos])
  const geo = canvasGeometry(format, template, photos.length, bare)
  const { width: gw, height: gh } = geo.grid
  const layout = useMemo(
    () =>
      compose(ratios, blocks, template, {
        width: gw,
        height: gh,
        gap: geo.gap,
      }),
    [ratios, blocks, template, gw, gh, geo.gap],
  )

  // the pair's own weight overrides .display's 900, so 400-only fonts aren't faux-bolded
  // plus the Type Lab's spacing and case
  const titleStyle: CSSProperties = include.type
    ? { ...fontCss(pair.display), textTransform: board.typeStyle.uppercase ? 'uppercase' : 'none', letterSpacing: `${board.typeStyle.tracking}em` }
    : {}

  const render = (item: Item, w: number, h: number): ReactNode => {
    switch (item.kind) {
      case 'photo':
        return <PhotoCell photo={photos[item.index]} number={item.index + 1} width={w * scale} />
      case 'palette':
        return <PaletteBlock palette={palette} loading={paletteLoading} vertical={w / h < 0.8} onOpenLab={onColorLab} />
      case 'type':
        return <TypeBlock pair={pair} fontsReady={fontsReady} style={board.typeStyle} onOpenLab={onTypeLab} />
      case 'keywords':
        return <KeywordsBlock tags={tags} />
      case 'notes':
        return <NotesBlock value={notes} onChange={onNotes} />
    }
  }

  const keyOf = (item: Item) => (item.kind === 'photo' ? photos[item.index].id : item.kind)
  const inset = { left: geo.pad, right: geo.pad }

  return (
    <article
      aria-label={`Moodboard: ${board.title}`}
      className="relative overflow-hidden bg-[#0c0c0b] text-bone"
      style={{ width: geo.width, height: geo.height }}
      data-format={format}
      data-export-width={FORMATS[format].exportWidth}
      data-export-height={FORMATS[format].exportHeight}
    >
      <header className="absolute flex flex-col border-b border-line" style={{ ...inset, top: geo.pad, height: geo.header }}>
        <div className="flex h-4 items-baseline justify-between gap-6">
          <p className="label text-acid">Moodboard</p>
          <p className="label text-dim">
            {photos.length} fotos · {TEMPLATE_NAME[template]} · {FORMAT_SHORT[format]}
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
          className="display mt-2 w-full min-w-0 bg-transparent p-0 text-bone outline-none placeholder:text-dim focus-visible:shadow-[inset_0_-2px_0_var(--color-acid)]"
          style={{
            fontSize: geo.title,
            height: Math.round(geo.title * 0.95),
            lineHeight: 1,
            ...titleStyle,
          }}
          placeholder="Título"
        />
      </header>

      <div className="absolute" style={{ left: geo.grid.x, top: geo.grid.y, width: gw, height: gh }}>
        {layout.cells.map((c) => (
          <div key={keyOf(c.item)} className="absolute" style={{ left: c.x, top: c.y, width: c.w, height: c.h }}>
            {render(c.item, c.w, c.h)}
          </div>
        ))}
      </div>

      <footer className="absolute border-t border-line pt-2.5" style={{ ...inset, bottom: geo.pad, height: geo.footer }}>
        <div className="flex h-[18px] items-baseline justify-between gap-4">
          <p className="label-sm text-dim">
            Créditos ·{' '}
            <a href={UNSPLASH_URL} target="_blank" rel="noopener noreferrer" className="text-mute hover:text-acid">
              Fotos de Unsplash
            </a>
          </p>
          <p className="display text-base leading-none text-bone">Afterhours</p>
        </div>
        <ol
          className="grid gap-x-4"
          style={{
            gridTemplateColumns: `repeat(${geo.creditColumns}, minmax(0, 1fr))`,
            gridAutoRows: 16,
          }}
        >
          {photos.map((p, i) => (
            <li key={p.id} className="flex min-w-0 items-baseline gap-1.5 text-[11px] leading-4 text-mute">
              <span className="label-sm shrink-0 text-dim">{pad(i + 1)}</span>
              <span className="min-w-0 truncate">
                Foto:{' '}
                <a href={p.author.profileUrl} target="_blank" rel="noopener noreferrer" className="text-bone hover:text-acid hover:underline">
                  {p.author.name}
                </a>
              </span>
            </li>
          ))}
        </ol>
      </footer>
    </article>
  )
}
