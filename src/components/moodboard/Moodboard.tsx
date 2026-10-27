import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, Check, ChevronDown, Palette, Pencil, Save, Shuffle, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardData } from '../../hooks/useBoardData'
import { useStudio, type Format, type Template, type WriteResult } from '../../hooks/useStudio'
import { basisOf, recalc } from '../../lib/colorLab'
import { FORMAT_ORDER, FORMATS } from '../../lib/formats'
import { MIN_SELECTION } from '../../lib/select'
import { BoardCanvas } from './BoardCanvas'
import { BoardStage } from './BoardStage'
import { BoardViewer } from './BoardViewer'
import { ColorLab } from './ColorLab'
import { EditPhotosDialog } from './EditPhotosDialog'
import { IncludeSwitches } from './IncludeSwitches'
import { TypeLab } from './TypeLab'

const TEMPLATES: { id: Template; label: string; hint: string }[] = [
  { id: 'editorial', label: 'Editorial', hint: 'Asimétrica, con jerarquía' },
  { id: 'collage', label: 'Collage', hint: 'Densa, poco aire' },
  { id: 'grilla', label: 'Grilla', hint: 'Ordenada, mucho aire' },
]

const FORMAT_SHORT: Record<Format, string> = { horizontal: '16:9', vertical: '4:5', a4: 'A4' }

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The board section: toolbar + canvas. Shown once «Armar moodboard» was used. */
export function Moodboard() {
  const studio = useStudio()
  const { board, selection, updateBoard, saveBoard, dirty, canSave } = studio
  const [editing, setEditing] = useState(false)
  const [showInclude, setShowInclude] = useState(false)
  const [viewing, setViewing] = useState(false)
  const [typeLab, setTypeLab] = useState(false)
  const [colorLab, setColorLab] = useState(false)
  const [saveResult, setSaveResult] = useState<WriteResult | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const photos = useMemo(() => selection.map((s) => s.photo), [selection])
  const data = useBoardData(board, photos)

  // every «Armar» scrolls to the board and moves focus to its heading
  const buildId = board?.buildId
  useEffect(() => {
    if (!buildId) return
    const frame = requestAnimationFrame(() => {
      document.getElementById('moodboard')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
      heading.current?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [buildId])

  if (!board) return null

  const backToPhotos = () => {
    document.getElementById('results-title')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    document.getElementById('results-title')?.focus({ preventScroll: true })
  }

  const enough = selection.length >= MIN_SELECTION

  // one canvas, shown either on the page (scaled to fit) or in the big viewer
  const canvas = (scale: number) => (
    <BoardCanvas
      board={board}
      photos={photos}
      tags={data.tags}
      palette={data.palette}
      paletteLoading={data.paletteLoading}
      pair={data.pair}
      fontsReady={data.fontsReady}
      notes={data.notes}
      onTitle={(title) => updateBoard({ title })}
      onNotes={(notes) => updateBoard({ notes })}
      scale={scale}
      onTypeLab={() => {
        setViewing(false)
        setTypeLab(true)
      }}
      onColorLab={() => {
        setViewing(false)
        setColorLab(true)
      }}
    />
  )

  // the photos changed under an edited palette: keep it, or recalculate (locked colours stay)
  const edit = board.paletteEdit
  const photosBasis = basisOf(photos.map((p) => p.id))
  const stale = edit !== null && data.autoPalette !== null && edit.basis !== photosBasis

  const save = () => setSaveResult(saveBoard())

  return (
    <section id="moodboard" aria-labelledby="moodboard-title" className="mt-20 scroll-mt-20 md:mt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-acid">02 — Moodboard</p>
          <h2 id="moodboard-title" ref={heading} tabIndex={-1} className="display mt-2 text-[clamp(2.75rem,7vw,6rem)] text-bone outline-none">
            Tu tablero
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <button type="button" onClick={backToPhotos} className="label inline-flex h-10 items-center gap-2 text-mute hover:text-bone">
            <ArrowUp className="size-3.5" aria-hidden="true" /> Volver a elegir fotos
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!enough}
            aria-describedby="save-status"
            className={`label inline-flex h-10 items-center gap-2 border px-4 transition-colors disabled:opacity-40 ${dirty ? 'border-bone bg-bone text-ink hover:bg-transparent hover:text-bone' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
          >
            {dirty ? <Save className="size-3.5" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
            {dirty ? 'Guardar' : 'Guardado'}
          </button>
        </div>
      </div>
      <div id="save-status" className="-mt-3 mb-4 min-h-5">
        {saveResult === 'full' || saveResult === 'unavailable' ? (
          <p role="alert" className="text-sm text-alarm">
            {saveResult === 'full'
              ? 'No se pudo guardar: el navegador se quedó sin espacio. Borrá algún tablero de «Mis tableros» y probá de nuevo.'
              : 'No se pudo guardar: este navegador no deja guardar datos (puede ser una ventana privada). El tablero sigue acá mientras no cierres la pestaña.'}
          </p>
        ) : (
          <p role="status" className="label-sm text-dim">
            {!canSave
              ? 'Este navegador no deja guardar (puede ser una ventana privada)'
              : saveResult === 'ok' && !dirty
                ? 'Guardado en este navegador'
                : board.savedId
                  ? dirty
                    ? 'Hay cambios sin guardar'
                    : ''
                  : 'Se guarda en este navegador'}
          </p>
        )}
      </div>

      {/* toolbar: controls, not part of the board */}
      <div className="mb-8 border-y border-line py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div role="radiogroup" aria-label="Formato" className="-mx-1 flex flex-wrap gap-1">
            {FORMAT_ORDER.map((id) => {
              const on = board.format === id
              const f = FORMATS[id]
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${f.label}: ${f.hint}`}
                  title={`${f.label} · ${f.hint}`}
                  onClick={() => updateBoard({ format: id })}
                  className={`label relative inline-flex h-10 items-center px-3 tabular-nums transition-colors ${on ? 'text-ink' : 'text-mute hover:text-bone'}`}
                >
                  {on && <motion.span layoutId="format-pick" className="absolute inset-0 bg-bone" transition={{ type: 'spring', stiffness: 400, damping: 36 }} />}
                  <span className="relative">{FORMAT_SHORT[id]}</span>
                </button>
              )
            })}
          </div>
          <span aria-hidden="true" className="hidden h-6 w-px bg-line sm:block" />
          <div role="radiogroup" aria-label="Plantilla" className="-mx-1 flex flex-wrap gap-1">
            {TEMPLATES.map((t) => {
              const on = board.template === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  title={t.hint}
                  onClick={() => updateBoard({ template: t.id })}
                  className={`label relative inline-flex h-10 items-center px-3 transition-colors ${on ? 'text-ink' : 'text-mute hover:text-bone'}`}
                >
                  {on && <motion.span layoutId="template-pick" className="absolute inset-0 bg-bone" transition={{ type: 'spring', stiffness: 400, damping: 36 }} />}
                  <span className="relative">{t.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowInclude((v) => !v)}
              aria-expanded={showInclude}
              aria-controls="board-include"
              className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone"
            >
              Qué incluir <ChevronDown className={`size-3.5 transition-transform ${showInclude ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
            {board.include.type && (
              <button
                type="button"
                onClick={() => updateBoard({ pairOffset: board.pairOffset + 1, fonts: null })}
                className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone"
                aria-describedby="pair-position"
              >
                <Shuffle className="size-3.5" aria-hidden="true" /> Otra combinación
              </button>
            )}
            {board.include.palette && (
              <button type="button" onClick={() => setColorLab(true)} className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone">
                <Palette className="size-3.5" aria-hidden="true" /> Color Lab
              </button>
            )}
            {board.include.type && (
              <button type="button" onClick={() => setTypeLab(true)} className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone">
                <Type className="size-3.5" aria-hidden="true" /> Type Lab
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)} className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone">
              <Pencil className="size-3.5" aria-hidden="true" /> Editar fotos
            </button>
          </div>
          {board.include.type && (
            <p id="pair-position" className="label-sm text-dim" aria-live="polite">
              {board.fonts ? 'Elegido en el Type Lab' : `Par ${data.position + 1} de ${data.ranked.length}`}: {data.pair.display.family} + {data.pair.text.family}
            </p>
          )}
        </div>
        <AnimatePresence initial={false}>
          {showInclude && (
            <motion.div
              id="board-include"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 max-w-md border-t border-line-soft pt-1">
                <IncludeSwitches value={board.include} onChange={(include) => updateBoard({ include })} idPrefix="board" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stale && board.include.palette && (
        <div role="status" className="mb-4 flex flex-col gap-3 border border-line bg-char/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-bone">
            Cambiaste las fotos: la paleta automática sería otra. ¿Mantenés la tuya o la recalculás con las fotos nuevas? Los colores con candado se quedan.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => edit && updateBoard({ paletteEdit: { ...edit, basis: photosBasis } })}
              className="label inline-flex h-10 items-center border border-line px-3 text-bone hover:border-bone"
            >
              Mantener la mía
            </button>
            <button
              type="button"
              onClick={() => edit && data.autoPalette && updateBoard({ paletteEdit: recalc(edit, data.autoPalette.pool, photos.map((p) => p.id)) })}
              className="label inline-flex h-10 items-center bg-bone px-3 text-ink hover:bg-acid"
            >
              Recalcular
            </button>
          </div>
        </div>
      )}

      {enough ? (
        <BoardStage format={board.format} viewing={viewing} onView={() => setViewing(true)}>
          {canvas}
        </BoardStage>
      ) : (
        <div className="border border-line p-6 text-sm text-mute">
          El tablero necesita al menos {MIN_SELECTION} fotos.{' '}
          <button type="button" onClick={backToPhotos} className="text-bone underline underline-offset-4 hover:text-acid">
            Sumá fotos desde las referencias
          </button>
          .
        </div>
      )}

      <AnimatePresence>{editing && <EditPhotosDialog onClose={() => setEditing(false)} />}</AnimatePresence>
      <AnimatePresence>
        {typeLab && board.include.type && (
          <TypeLab
            board={board}
            auto={data.auto}
            pair={data.pair}
            fontsReady={data.fontsReady}
            tags={data.tags}
            notes={data.notes}
            onChange={(patch) => updateBoard(patch)}
            onClose={() => setTypeLab(false)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {colorLab && board.include.palette && (
          <ColorLab board={board} photos={photos} auto={data.autoPalette} pair={data.pair} onChange={(paletteEdit) => updateBoard({ paletteEdit })} onClose={() => setColorLab(false)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewing && enough && (
          <BoardViewer format={board.format} onClose={() => setViewing(false)}>
            {canvas}
          </BoardViewer>
        )}
      </AnimatePresence>
    </section>
  )
}
