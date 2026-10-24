import { motion } from 'framer-motion'
import { useRef, type ReactNode } from 'react'
import { useDialog } from '../hooks/useDialog'

interface ConfirmProps {
  title: string
  children: ReactNode
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

/** A small «are you sure?» before something that can't be undone. Focus starts on «cancel». */
export function ConfirmDialog({ title, children, confirmLabel, cancelLabel = 'Cancelar', onConfirm, onCancel }: ConfirmProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, true, onCancel)
  return (
    <motion.div className="fixed inset-0 z-[85] flex items-end justify-center bg-ink/80 p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div ref={ref} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" className="w-full max-w-md border border-line bg-char p-5 sm:p-6">
        <h2 id="confirm-title" className="display text-[2rem] text-bone">
          {title}
        </h2>
        <div id="confirm-body" className="mt-3 text-sm leading-relaxed text-mute">
          {children}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} data-autofocus className="label h-12 border border-line px-5 text-bone hover:border-bone">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="btn-fill label h-12 bg-acid px-5 text-ink [--fill-color:var(--color-bone)]">
            {confirmLabel}
          </button>
        </div>
      </div>
    </motion.div>
  )
}
