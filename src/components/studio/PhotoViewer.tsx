import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check, Plus, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Photo } from '../../../shared/types'
import { useDialog } from '../../hooks/useDialog'
import { pad } from '../../lib/format'
import { PhotoCredit } from './PhotoCredit'
import { PhotoFrame } from './PhotoFrame'

interface PhotoViewerProps {
  photos: Photo[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
  /** The tag (search) a photo came from, shown in the details. */
  tagOf?: (photo: Photo) => string | undefined
  /** When given, the viewer can add the photo to (or take it out of) the selection. */
  isSelected?: (id: string) => boolean
  onToggleSelect?: (photo: Photo) => void
}

function orientation(p: Photo) {
  const r = p.width / p.height
  if (r > 1.05) return 'Horizontal'
  if (r < 0.95) return 'Vertical'
  return 'Cuadrada'
}

export function PhotoViewer({ photos, index, onClose, onNavigate, tagOf, isSelected, onToggleSelect }: PhotoViewerProps) {
  const ref = useRef<HTMLDivElement>(null)
  const photo = photos[index]
  useDialog(ref, true, onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return
      if (e.key === 'ArrowRight') onNavigate(index + 1)
      if (e.key === 'ArrowLeft') onNavigate(index - 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [index, onNavigate])

  const tag = tagOf?.(photo)
  const many = photos.length > 1
  const selected = isSelected?.(photo.id) ?? false

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="photo-title"
      className="fixed inset-0 z-[75] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6 md:px-10">
        <p className="label text-mute">
          Referencias <span className="text-dim">/</span> <span className="tabular-nums text-bone">{pad(index + 1)}</span>
          <span className="text-dim"> de {pad(photos.length)}</span>
        </p>
        <button type="button" onClick={onClose} className="group flex h-10 items-center gap-3 text-bone" data-autofocus>
          <span className="label">Cerrar</span>
          <X className="size-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto lg:overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="grid h-full gap-8 p-4 sm:p-6 md:p-10 lg:grid-cols-12 lg:gap-12"
          >
            <div className="flex items-center justify-center lg:col-span-8 lg:h-full lg:min-h-0">
              <div className="relative max-h-full w-full lg:h-full" style={{ aspectRatio: `${photo.width} / ${photo.height}` }}>
                <PhotoFrame photo={photo} eager fit="contain" size="large" className="absolute inset-0" />
              </div>
            </div>

            <div className="flex flex-col lg:col-span-4 lg:py-2">
              <p className="label text-acid">{tag ? `Etiqueta — ${tag}` : 'Referencia'}</p>
              <h3 id="photo-title" className="display mt-3 text-[clamp(2.5rem,4.5vw,4.75rem)] break-words text-bone">
                {photo.author.name}
              </h3>
              <PhotoCredit photo={photo} className="editorial mt-4 text-[1.4rem] leading-snug text-mute" />
              {photo.alt && <p className="mt-4 text-sm leading-relaxed text-mute">{photo.alt}</p>}

              <dl className="mt-8 border-t border-line">
                <div className="flex items-center justify-between gap-4 border-b border-line py-3">
                  <dt className="label text-dim">Color dominante</dt>
                  <dd className="label flex items-center gap-2 text-bone">
                    {photo.color ? (
                      <>
                        <span aria-hidden="true" className="size-4 border border-line" style={{ backgroundColor: photo.color }} />
                        {photo.color.toUpperCase()}
                      </>
                    ) : (
                      'Sin dato'
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line py-3">
                  <dt className="label text-dim">Tamaño original</dt>
                  <dd className="label text-right tabular-nums text-bone">
                    {photo.width} × {photo.height} px
                  </dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-line py-3">
                  <dt className="label text-dim">Formato</dt>
                  <dd className="label text-right text-bone">{orientation(photo)}</dd>
                </div>
              </dl>

              {onToggleSelect && (
                <button
                  type="button"
                  onClick={() => onToggleSelect(photo)}
                  aria-pressed={selected}
                  className={`label mt-8 inline-flex h-12 items-center justify-center gap-2 border px-5 transition-colors ${
                    selected ? 'border-acid bg-acid text-ink' : 'border-bone text-bone hover:border-acid hover:text-acid'
                  }`}
                >
                  {selected ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : <Plus className="size-4" strokeWidth={2} aria-hidden="true" />}
                  {selected ? 'En tu selección — sacar' : 'Sumar al moodboard'}
                </button>
              )}
              <a
                href={photo.pageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`btn-fill label inline-flex h-12 items-center justify-center gap-2 bg-acid px-5 text-ink [--fill-color:var(--color-bone)] ${onToggleSelect ? 'mt-2' : 'mt-8'}`}
              >
                Ver en Unsplash <ArrowUpRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
              </a>

              {many && (
                <div className="mt-3 flex gap-2 pb-6 lg:mt-auto lg:pb-0">
                  <button
                    type="button"
                    onClick={() => onNavigate(index - 1)}
                    className="label inline-flex h-12 flex-1 items-center justify-center gap-2 border border-line text-mute transition-colors hover:border-bone hover:text-bone"
                  >
                    <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" /> Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate(index + 1)}
                    className="label inline-flex h-12 flex-1 items-center justify-center gap-2 border border-line text-mute transition-colors hover:border-bone hover:text-bone"
                  >
                    Siguiente <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              )}
              <p className="label-sm mt-3 hidden text-dim lg:block">{many ? 'Usá ← → para recorrer, Esc para cerrar' : 'Esc para cerrar'}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
