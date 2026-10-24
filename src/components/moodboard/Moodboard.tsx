import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, ChevronDown, Pencil, Shuffle } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useBoardData } from '../../hooks/useBoardData'
import { useStudio, type Format, type Template } from '../../hooks/useStudio'
import { FORMAT_ORDER, FORMATS } from '../../lib/formats'
import { MIN_SELECTION } from '../../lib/select'
import { BoardCanvas } from './BoardCanvas'
import { BoardStage } from './BoardStage'
import { BoardViewer } from './BoardViewer'
import { EditPhotosDialog } from './EditPhotosDialog'
import { IncludeSwitches } from './IncludeSwitches'

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
  const { board, selection, updateBoard } = studio
  const [editing, setEditing] = useState(false)
  const [showInclude, setShowInclude] = useState(false)
  const [viewing, setViewing] = useState(false)
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
    />
  )

  return (
    <section id="moodboard" aria-labelledby="moodboard-title" className="mt-20 scroll-mt-20 md:mt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-acid">02 — Moodboard</p>
          <h2 id="moodboard-title" ref={heading} tabIndex={-1} className="display mt-2 text-[clamp(2.75rem,7vw,6rem)] text-bone outline-none">
            Tu tablero
          </h2>
        </div>
        <button type="button" onClick={backToPhotos} className="label inline-flex h-10 items-center gap-2 text-mute hover:text-bone">
          <ArrowUp className="size-3.5" aria-hidden="true" /> Volver a elegir fotos
        </button>
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
                onClick={() => updateBoard({ pairOffset: board.pairOffset + 1 })}
                className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone"
                aria-describedby="pair-position"
              >
                <Shuffle className="size-3.5" aria-hidden="true" /> Otra combinación
              </button>
            )}
            <button type="button" onClick={() => setEditing(true)} className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone">
              <Pencil className="size-3.5" aria-hidden="true" /> Editar fotos
            </button>
          </div>
          {board.include.type && (
            <p id="pair-position" className="label-sm text-dim" aria-live="polite">
              Par {data.position + 1} de {data.ranked.length}: {data.pair.display.family} + {data.pair.text.family}
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
        {viewing && enough && (
          <BoardViewer format={board.format} onClose={() => setViewing(false)}>
            {canvas}
          </BoardViewer>
        )}
      </AnimatePresence>
    </section>
  )
}
