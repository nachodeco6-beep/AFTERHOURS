import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStudio } from '../../hooks/useStudio'
import { COMPLETE_TARGET, MAX_SELECTION, MIN_SELECTION } from '../../lib/select'
import { PhotoFrame } from './PhotoFrame'

interface TrayProps {
  /** «Armar moodboard»: opens the «Qué incluir» panel. */
  onBuild: () => void
  /** With a board already built, the main button takes you to it. */
  onShowBoard: () => void
}

/** «Tu selección»: fixed at the bottom while there are picked photos. */
export function SelectionTray({ onBuild, onShowBoard }: TrayProps) {
  const { selection, removeSelected, complete, pool, board } = useStudio()
  const [notice, setNotice] = useState('')
  const count = selection.length
  const visible = count > 0
  const canComplete = count < COMPLETE_TARGET && pool.length > 0
  const ready = count >= MIN_SELECTION

  // leave room at the end of the page so the tray never covers content
  useEffect(() => {
    document.documentElement.style.setProperty('--tray-space', visible ? '9.5rem' : '0px')
    return () => document.documentElement.style.setProperty('--tray-space', '0px')
  }, [visible])

  const onComplete = () => {
    const added = complete()
    setNotice(added ? `Sumamos ${added} ${added === 1 ? 'foto' : 'fotos'} del pozo a tu selección.` : 'No quedan fotos que sumen sin repetir fotógrafo.')
  }

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      <AnimatePresence>
        {visible && (
          <motion.aside
            aria-label="Tu selección"
            className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-4 py-3 sm:px-6 md:flex-row md:items-center md:gap-6 md:px-10">
              <div className="flex shrink-0 items-baseline justify-between gap-4 md:block">
                <p className="label text-bone">Tu selección</p>
                <p className="label mt-0.5 tabular-nums text-dim">
                  <span className={ready ? 'text-acid' : 'text-bone'}>{count}</span> / {MAX_SELECTION}
                  {!ready && <span className="ml-2 normal-case tracking-normal">· mínimo {MIN_SELECTION}</span>}
                </p>
              </div>

              <ul className="thin-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto py-1" aria-label="Fotos elegidas">
                {selection.map((s, i) => (
                  <li key={s.photo.id} className="relative shrink-0">
                    <div className="relative size-14 sm:size-16">
                      <PhotoFrame photo={s.photo} size="thumb" eager className="absolute inset-0" />
                      <span className="label-sm absolute bottom-0 left-0 bg-ink/80 px-1 text-bone">{String(i + 1).padStart(2, '0')}</span>
                      {s.auto && (
                        <span className="absolute top-0.5 left-0.5 size-2 bg-acid" title="Sumada por «Completar por mí»">
                          <span className="sr-only">Sumada por «Completar por mí»</span>
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSelected(s.photo.id)}
                      aria-label={`Sacar de tu selección la foto ${i + 1}, de ${s.photo.author.name}`}
                      className="absolute -top-1 -right-1 grid size-6 place-items-center border border-line bg-ink text-mute hover:border-alarm hover:text-alarm"
                    >
                      <X className="size-3" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={onComplete}
                  disabled={!canComplete}
                  className="label inline-flex h-12 flex-1 items-center justify-center gap-2 border border-line px-4 text-bone transition-colors hover:border-bone disabled:opacity-40 disabled:hover:border-line md:flex-none"
                >
                  <Sparkles className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Completar por mí
                </button>
                <button
                  type="button"
                  onClick={board ? onShowBoard : onBuild}
                  disabled={!ready}
                  className="btn-fill inline-flex h-12 flex-1 items-center justify-center bg-acid px-5 text-ink [--fill-color:var(--color-bone)] disabled:bg-char-2 disabled:text-dim disabled:before:hidden md:flex-none"
                >
                  <span className="display text-[1.25rem] leading-none tracking-[0.02em]">{board ? 'Ver moodboard' : 'Armar moodboard'}</span>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}
