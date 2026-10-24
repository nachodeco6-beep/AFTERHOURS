import { motion, Reorder, useDragControls } from 'framer-motion'
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, RefreshCw, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Photo } from '../../../shared/types'
import { useDialog } from '../../hooks/useDialog'
import { useStudio, type Picked } from '../../hooks/useStudio'
import { pad } from '../../lib/format'
import { MIN_SELECTION } from '../../lib/select'
import { PhotoFrame } from '../studio/PhotoFrame'

interface RowProps {
  item: Picked
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onReplace: () => void
}

function Row({ item, index, count, onMove, onRemove, onReplace }: RowProps) {
  const controls = useDragControls()
  const name = item.photo.author.name
  return (
    <Reorder.Item value={item.photo.id} dragListener={false} dragControls={controls} className="flex items-center gap-2 border-b border-line-soft bg-char py-2 sm:gap-3">
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Arrastrar la foto ${index + 1} para cambiarla de lugar (con teclado, usá «Antes» y «Después»)`}
        tabIndex={-1}
        className="grid h-12 w-8 shrink-0 cursor-grab touch-none place-items-center text-dim hover:text-bone active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <div className="relative size-12 shrink-0">
        <PhotoFrame photo={item.photo} size="thumb" eager className="absolute inset-0" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="label-sm text-acid">
          {pad(index + 1)}
          {index === 0 && <span className="ml-2 text-dim normal-case tracking-normal">principal</span>}
        </p>
        <p className="truncate text-sm text-bone">{name}</p>
        <p className="truncate text-xs text-dim">{item.tag}</p>
      </div>
      <div className="flex shrink-0 items-center">
        <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Mover antes la foto ${index + 1}, de ${name}`} title="Antes" className="grid size-10 place-items-center text-mute hover:text-bone disabled:opacity-30">
          <ArrowUp className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={index === count - 1} aria-label={`Mover después la foto ${index + 1}, de ${name}`} title="Después" className="grid size-10 place-items-center text-mute hover:text-bone disabled:opacity-30">
          <ArrowDown className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={onReplace} aria-label={`Reemplazar la foto ${index + 1}, de ${name}`} title="Reemplazar" className="grid size-10 place-items-center text-mute hover:text-acid">
          <RefreshCw className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={count <= MIN_SELECTION}
          aria-label={`Sacar la foto ${index + 1}, de ${name}`}
          title={count <= MIN_SELECTION ? `El tablero necesita al menos ${MIN_SELECTION} fotos` : 'Sacar'}
          className="grid size-10 place-items-center text-mute hover:text-alarm disabled:opacity-30 disabled:hover:text-mute"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
    </Reorder.Item>
  )
}

function Replace({ target, onPick, onBack }: { target: Picked; onPick: (photo: Photo, tag: string) => void; onBack: () => void }) {
  const { pool, tags } = useStudio()
  const [tag, setTag] = useState<string | null>(null)
  const visible = tag ? pool.filter((e) => e.tag === tag) : pool
  const present = tags.filter((t) => pool.some((e) => e.tag === t))

  return (
    <div>
      <button type="button" onClick={onBack} className="label inline-flex h-10 items-center gap-2 text-mute hover:text-bone" data-autofocus>
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver al orden
      </button>
      <p className="mt-2 text-sm text-mute">
        Elegí la foto que reemplaza a la de <span className="text-bone">{target.photo.author.name}</span>.
      </p>
      {present.length > 1 && (
        <div role="group" aria-label="Filtrar por etiqueta" className="mt-4 flex flex-wrap gap-1">
          {[null, ...present].map((t) => (
            <button
              key={t ?? 'all'}
              type="button"
              onClick={() => setTag(t)}
              aria-pressed={tag === t}
              className={`label h-9 px-3 ${tag === t ? 'bg-bone text-ink' : 'text-mute hover:text-bone'}`}
            >
              {t ?? 'Todas'}
            </button>
          ))}
        </div>
      )}
      {visible.length ? (
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {visible.map((e) => (
            <li key={e.photo.id}>
              <button
                type="button"
                onClick={() => onPick(e.photo, e.tag)}
                aria-label={`Usar la foto de ${e.photo.author.name} (${e.tag})`}
                className="group relative block aspect-square w-full overflow-hidden"
              >
                <PhotoFrame photo={e.photo} size="thumb" className="absolute inset-0 transition-transform duration-500 group-hover:scale-105" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 text-sm text-dim">No quedan fotos sin usar en las referencias. Hacé otra búsqueda para tener más opciones.</p>
      )}
    </div>
  )
}

/** Reorder (drag or «Antes»/«Después»), remove or replace the board's photos. */
export function EditPhotosDialog({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const { selection, moveSelected, reorderSelection, removeSelected, replaceSelected } = useStudio()
  const [replacing, setReplacing] = useState<string | null>(null)
  const [announce, setAnnounce] = useState('')
  useDialog(ref, true, onClose)
  const target = selection.find((s) => s.photo.id === replacing)

  const move = (id: string, index: number, delta: -1 | 1) => {
    moveSelected(id, delta)
    setAnnounce(`Foto movida a la posición ${index + delta + 1} de ${selection.length}.`)
  }

  return (
    <motion.div className="fixed inset-0 z-[80] flex justify-end bg-ink/70" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-photos-title"
        className="thin-scroll flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-line bg-char p-5 sm:p-6"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-acid">{selection.length} fotos</p>
            <h2 id="edit-photos-title" className="display mt-2 text-[2.5rem] text-bone">
              {target ? 'Reemplazar' : 'Editar fotos'}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center text-mute hover:text-bone" data-autofocus={target ? undefined : true}>
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>

        {target ? (
          <div className="mt-4">
            <Replace
              target={target}
              onBack={() => setReplacing(null)}
              onPick={(photo, tag) => {
                replaceSelected(target.photo.id, { photo, tag })
                setAnnounce(`Foto reemplazada por una de ${photo.author.name}.`)
                setReplacing(null)
              }}
            />
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-mute">
              Arrastrá desde <GripVertical className="inline size-3.5" aria-hidden="true" /> o usá las flechas. La foto 01 va en el lugar principal.
            </p>
            <Reorder.Group axis="y" values={selection.map((s) => s.photo.id)} onReorder={reorderSelection} className="mt-4 border-t border-line-soft">
              {selection.map((s, i) => (
                <Row
                  key={s.photo.id}
                  item={s}
                  index={i}
                  count={selection.length}
                  onMove={(d) => move(s.photo.id, i, d)}
                  onRemove={() => {
                    removeSelected(s.photo.id)
                    setAnnounce(`Sacaste la foto de ${s.photo.author.name}.`)
                  }}
                  onReplace={() => setReplacing(s.photo.id)}
                />
              ))}
            </Reorder.Group>
          </>
        )}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
      </motion.div>
    </motion.div>
  )
}
