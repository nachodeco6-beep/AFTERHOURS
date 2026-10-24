import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useRef, useState } from 'react'
import { DEFAULT_INCLUDE, type Include } from '../../hooks/useStudio'
import { useDialog } from '../../hooks/useDialog'
import { IncludeSwitches } from './IncludeSwitches'

/** Short panel shown on «Armar moodboard»: what goes on the board besides the photos. */
export function IncludeDialog({ initial, count, onClose, onBuild }: { initial?: Include; count: number; onClose: () => void; onBuild: (inc: Include) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState<Include>(initial ?? DEFAULT_INCLUDE)
  useDialog(ref, true, onClose)

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/80 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="include-title"
        className="w-full max-w-md border border-line bg-char p-5 sm:p-6"
        initial={{ y: 24 }}
        animate={{ y: 0 }}
        exit={{ y: 24 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label text-acid">{count} fotos</p>
            <h2 id="include-title" className="display mt-2 text-[2.5rem] text-bone">
              Qué incluir
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center text-mute hover:text-bone">
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-mute">Lo podés cambiar después, sobre el tablero armado.</p>
        <div className="mt-4 border-y border-line">
          <IncludeSwitches value={value} onChange={setValue} idPrefix="pre" />
        </div>
        <button
          type="button"
          onClick={() => onBuild(value)}
          data-autofocus
          className="btn-fill mt-6 inline-flex h-14 w-full items-center justify-center bg-acid text-ink [--fill-color:var(--color-bone)]"
        >
          <span className="display text-[1.4rem] leading-none tracking-[0.02em]">Armar moodboard</span>
        </button>
      </motion.div>
    </motion.div>
  )
}
