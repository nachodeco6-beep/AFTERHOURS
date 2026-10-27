import { AnimatePresence } from 'framer-motion'
import { Copy, FolderOpen, PenLine, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { useStudio, type SavedBoard, type WriteResult } from '../../hooks/useStudio'
import { FORMATS } from '../../lib/formats'
import { ConfirmDialog } from '../ConfirmDialog'
import { PhotoFrame } from './PhotoFrame'

const FORMAT_SHORT = { horizontal: '16:9', vertical: '4:5', a4: 'A4' } as const
const date = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const FAILED: Record<Exclude<WriteResult, 'ok'>, string> = {
  full: 'No se pudo: el navegador se quedó sin espacio. Borrá algún tablero y probá de nuevo.',
  unavailable: 'No se pudo: este navegador no deja guardar datos (puede ser una ventana privada).',
}

/** A tiny lámina: the lead photo and up to three more, in the board's format. */
function Thumb({ board }: { board: SavedBoard }) {
  const f = FORMATS[board.format]
  const [lead, ...rest] = board.photos
  return (
    <div className="grid grid-cols-[3fr_2fr] gap-0.5 bg-[#0c0c0b] p-1.5" style={{ aspectRatio: `${f.width} / ${f.height}` }}>
      <PhotoFrame photo={lead.photo} size="thumb" className="relative" />
      <div className="grid gap-0.5" style={{ gridTemplateRows: `repeat(${Math.max(1, Math.min(3, rest.length))}, minmax(0, 1fr))` }}>
        {rest.slice(0, 3).map((p) => (
          <PhotoFrame key={p.photo.id} photo={p.photo} size="thumb" className="relative" />
        ))}
      </div>
    </div>
  )
}

/** «Mis tableros»: boards saved in this browser. */
export function MyBoards() {
  const { saved, canSave, board, dirty, openSaved, duplicateSaved, renameSaved, removeSaved } = useStudio()
  const [renaming, setRenaming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<SavedBoard | null>(null)
  const [opening, setOpening] = useState<SavedBoard | null>(null)
  const [message, setMessage] = useState('')

  if (!saved.length) return null

  const report = (res: WriteResult, done: string) => setMessage(res === 'ok' ? done : FAILED[res])

  const open = (r: SavedBoard) => {
    // unsaved changes would be lost: ask first
    if (board && dirty) setOpening(r)
    else openSaved(r.id)
  }

  const finishRename = (r: SavedBoard, value: string) => {
    setRenaming(null)
    if (value.trim() && value.trim() !== r.title) report(renameSaved(r.id, value), `Renombrado: «${value.trim()}».`)
  }

  const onRenameKey = (e: KeyboardEvent<HTMLInputElement>, r: SavedBoard) => {
    if (e.key === 'Enter') finishRename(r, e.currentTarget.value)
    else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setRenaming(null)
    }
  }

  const action = 'label-sm inline-flex h-9 items-center gap-1.5 px-2 text-mute transition-colors hover:text-bone'

  return (
    <section aria-labelledby="saved-title" className="mt-20 md:mt-28">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label text-acid">03 — Archivo</p>
          <h2 id="saved-title" className="display mt-2 text-[clamp(2.25rem,5vw,4rem)] text-bone">
            Mis tableros
          </h2>
        </div>
        <p className="label-sm max-w-xs text-dim">{canSave ? 'Se guardan en este navegador: no viajan a otros dispositivos.' : 'Este navegador no deja guardar: estos tableros se ven pero no se pueden cambiar.'}</p>
      </div>

      <p role="status" aria-live="polite" className="mb-3 min-h-5 text-sm text-mute">
        {message}
      </p>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {saved.map((r) => {
          const current = board?.savedId === r.id
          return (
            <li key={r.id} className={`flex flex-col border ${current ? 'border-bone' : 'border-line'}`}>
              <button type="button" onClick={() => open(r)} aria-label={`Abrir «${r.title}»`} className="block">
                <Thumb board={r} />
              </button>
              <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
                {renaming === r.id ? (
                  <input
                    autoFocus
                    defaultValue={r.title}
                    maxLength={80}
                    aria-label={`Nuevo nombre para «${r.title}»`}
                    onKeyDown={(e) => onRenameKey(e, r)}
                    onBlur={(e) => finishRename(r, e.currentTarget.value)}
                    className="h-9 w-full min-w-0 border-b border-acid bg-transparent text-base text-bone outline-none"
                  />
                ) : (
                  <p className="truncate text-base text-bone" title={r.title}>
                    {r.title}
                  </p>
                )}
                <p className="label-sm text-dim">
                  {r.photos.length} fotos · {FORMAT_SHORT[r.format]} · {date.format(r.savedAt)}
                  {current && <span className="text-acid"> · abierto</span>}
                </p>
                <div className="-mx-2 mt-auto flex flex-wrap">
                  <button type="button" onClick={() => open(r)} className={action}>
                    <FolderOpen className="size-3.5" aria-hidden="true" /> Abrir
                  </button>
                  <button type="button" onClick={() => report(duplicateSaved(r.id), `Duplicado: «${r.title} (copia)».`)} disabled={!canSave} className={`${action} disabled:opacity-40`}>
                    <Copy className="size-3.5" aria-hidden="true" /> Duplicar
                  </button>
                  <button type="button" onClick={() => setRenaming(r.id)} disabled={!canSave} className={`${action} disabled:opacity-40`}>
                    <PenLine className="size-3.5" aria-hidden="true" /> Renombrar
                  </button>
                  <button type="button" onClick={() => setDeleting(r)} disabled={!canSave} className={`${action} hover:text-alarm disabled:opacity-40`}>
                    <Trash2 className="size-3.5" aria-hidden="true" /> Borrar
                  </button>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <AnimatePresence>
        {deleting && (
          <ConfirmDialog
            title="¿Borrar el tablero?"
            confirmLabel="Borrar"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              const r = deleting
              setDeleting(null)
              report(removeSaved(r.id), `Borrado: «${r.title}».`)
            }}
          >
            «{deleting.title}» se borra de este navegador y no se puede recuperar.
            {board?.savedId === deleting.id && ' El tablero abierto queda en pantalla, sin guardar.'}
          </ConfirmDialog>
        )}
        {opening && (
          <ConfirmDialog
            title="¿Abrir otro tablero?"
            confirmLabel="Abrir sin guardar"
            onCancel={() => setOpening(null)}
            onConfirm={() => {
              const r = opening
              setOpening(null)
              openSaved(r.id)
            }}
          >
            Tu tablero tiene cambios sin guardar. Si abrís «{opening.title}», esos cambios se pierden. Si los querés conservar, cancelá y tocá «Guardar».
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </section>
  )
}
