import { motion } from 'framer-motion'
import { Pipette, RotateCcw, X } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Photo } from '../../../shared/types'
import type { TypePair } from '../../data/typePairs'
import { useDialog } from '../../hooks/useDialog'
import type { Board } from '../../hooks/useStudio'
import { fromAuto, MAX_COLORS, regenerate, setCount, sourceOf, type LabColor, type PaletteEdit } from '../../lib/colorLab'
import { pad } from '../../lib/format'
import type { PaletteResult } from '../../lib/paletteImage'
import { PhotoFrame } from '../studio/PhotoFrame'
import { Eyedropper } from './Eyedropper'
import { PaletteWorkbench, toolButton } from './PaletteWorkbench'

interface LabProps {
  board: Board
  photos: Photo[]
  /** The automatic palette, with the pool of colours present in the photos. */
  auto: PaletteResult | null
  pair: TypePair
  onChange: (edit: PaletteEdit | null) => void
  onClose: () => void
  /** Inside a page («Con mi tablero») instead of a dialog over everything. */
  embedded?: boolean
}

/** The Color Lab on the board: lock, regenerate from the photos, eyedropper, back to the automatic palette (the rest is the shared workbench). */
export function ColorLab({ board, photos, auto, pair, onChange, onClose, embedded = false }: LabProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, !embedded, onClose)
  const [step, setStep] = useState(0)
  const [picking, setPicking] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const photoIds = useMemo(() => photos.map((p) => p.id), [photos])
  const pool = useMemo(() => auto?.pool ?? [], [auto])
  const edit: PaletteEdit | null = board.paletteEdit ?? (auto ? fromAuto(auto.colors, pool, photoIds) : null)
  const colors = edit?.colors ?? []
  const touched = board.paletteEdit !== null
  // only if the photos still have a colour different enough from the ones in use
  const canGrow = colors.length < MAX_COLORS && setCount(colors, colors.length + 1, pool, photoIds).length > colors.length

  const update = (next: LabColor[]) => edit && onChange({ colors: next, basis: edit.basis })
  const sourceIndex = (c: LabColor) => {
    const byId = c.photoId ? photoIds.indexOf(c.photoId) : -1
    if (byId >= 0) return byId
    const s = sourceOf(c.hex, pool)
    return s ? s.photo : -1
  }
  const say = (text: string) => setNotice(text)

  const body = !edit ? (
    <p className="label-sm flex flex-1 items-center justify-center gap-2 py-16 text-mute">
      <span aria-hidden="true" className="size-2 animate-pulse bg-acid" /> Leyendo colores de las fotos…
    </p>
  ) : (
    <PaletteWorkbench
      colors={colors}
      onColors={(next) => update(next)}
      title={board.title}
      pair={pair}
      typeStyle={board.typeStyle}
      fileName={board.title}
      notice={notice}
      say={say}
      countNote={auto?.source === 'unsplash' && <span className="text-[var(--sheet-mute)]"> · aproximados, colores de Unsplash</span>}
      source={(shown) => {
        const src = shown !== null && colors[shown] ? sourceIndex(colors[shown]) : -1
        return (
          <div className="mt-6">
            <p className="label-sm min-h-4 text-[var(--sheet-mute)]" aria-live="polite">
              {shown === null
                ? 'Pasá el mouse por un color para ver de qué foto sale'
                : src >= 0
                  ? `Color ${shown + 1} sale de la foto ${pad(src + 1)}, de ${photos[src].author.name}`
                  : `Color ${shown + 1}: elegido a mano`}
            </p>
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Fotos del tablero">
              {photos.map((p, i) => (
                <li
                  key={p.id}
                  className={`relative size-10 overflow-hidden transition-opacity sm:size-12 ${shown !== null && src !== i ? 'opacity-35' : ''}`}
                  style={src === i ? { outline: '2px solid var(--sheet-ink)', outlineOffset: 2 } : undefined}
                >
                  <PhotoFrame photo={p} size="thumb" eager className="absolute inset-0" />
                  <span className="label-sm absolute bottom-0 left-0 bg-ink/80 px-0.5 text-bone">{pad(i + 1)}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      }}
      replacePreview={(editing, setHex) =>
        picking !== null && editing === picking ? (
          <Eyedropper
            photos={photos}
            start={Math.max(0, sourceIndex(colors[picking]))}
            onCancel={() => setPicking(null)}
            onPick={(hex, photoId) => {
              setHex(picking, hex, photoId)
              setPicking(null)
              say(`Color ${picking + 1}: ${hex}, tomado de una foto.`)
            }}
          />
        ) : null
      }
      editTools={(i) => (
        <button type="button" onClick={() => setPicking(i)} className={toolButton}>
          <Pipette className="size-3.5" aria-hidden="true" /> Tomar de una foto
        </button>
      )}
      onShrink={() => update(setCount(colors, colors.length - 1, pool, photoIds))}
      onGrow={() => update(setCount(colors, colors.length + 1, pool, photoIds))}
      canGrow={canGrow}
      cantGrowNote="Las fotos no tienen más colores bien distintos para sumar."
      regenerateLabel="Regenerar"
      regenerateDisabled={!pool.length}
      onRegenerate={() => {
        const next = step + 1
        setStep(next)
        update(regenerate(colors, pool, photoIds, next))
        say('Regenerados los colores sin bloquear, con otros tonos de las fotos.')
      }}
      regenerateHint="«Regenerar» cambia los colores sin candado por otros tonos que están en las fotos del tablero."
      paletteExtra={
        touched && (
          <button
            type="button"
            onClick={() => {
              onChange(null)
              setPicking(null)
              say('Volviste a la paleta automática.')
            }}
            className="label-sm inline-flex h-8 items-center gap-1.5 text-mute hover:text-bone"
          >
            <RotateCcw className="size-3" aria-hidden="true" /> Volver a la paleta automática
          </button>
        )
      }
    />
  )

  const status = (
    <p className="sr-only" role="status" aria-live="polite">
      {notice}
    </p>
  )

  if (embedded)
    return (
      <div ref={ref} className="flex flex-col border border-line lg:h-[min(60rem,calc(100dvh-8rem))]">
        {status}
        {body}
      </div>
    )

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="colorlab-title"
      className="fixed inset-0 z-[80] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="colorlab-title" className="display text-[1.75rem] leading-none text-bone">
            Color Lab
          </h2>
          <p className="label-sm truncate text-dim">Los cambios se ven en el tablero al instante</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={onClose} data-autofocus className="btn-fill inline-flex h-10 items-center bg-acid px-4 text-ink [--fill-color:var(--color-bone)]">
            <span className="label">Listo</span>
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center text-mute hover:text-bone">
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>
      {status}
      {body}
    </motion.div>
  )
}
