import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { Work } from '../../data/archive'
import { useDialog } from '../../hooks/useDialog'
import { Artwork } from './Artwork'

interface ArchiveModalProps {
  works: Work[]
  index: number
  onClose: () => void
  onNavigate: (index: number) => void
}

export function ArchiveModal({ works, index, onClose, onNavigate }: ArchiveModalProps) {
  const ref = useRef<HTMLDivElement>(null)
  const work = works[index]
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

  const meta: [string, string][] = [
    ['No.', work.no],
    ['Category', work.category],
    ['Year', work.year],
    ['Medium', work.medium],
    ['Format', work.ratio >= 1 ? (work.ratio === 1 ? 'Square' : 'Landscape') : 'Portrait'],
  ]

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="work-title"
      className="fixed inset-0 z-[75] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line px-4 sm:px-6 md:px-10">
        <p className="label text-mute">
          Night Archive <span className="text-dim">/</span> <span className="tabular-nums text-bone">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-dim"> of {String(works.length).padStart(2, '0')}</span>
        </p>
        <button type="button" onClick={onClose} className="group flex h-10 items-center gap-3 text-bone" data-autofocus>
          <span className="label">Close</span>
          <X className="size-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <div className="thin-scroll flex-1 overflow-y-auto lg:overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={work.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="grid h-full gap-8 p-4 sm:p-6 md:p-10 lg:grid-cols-12 lg:gap-12"
          >
            <div className="flex items-center justify-center lg:col-span-8 lg:h-full lg:min-h-0">
              <div className="relative w-full lg:h-full" style={{ aspectRatio: work.ratio }}>
                <Artwork work={work} eager fit="contain" className="absolute inset-0" />
              </div>
            </div>

            <div className="flex flex-col lg:col-span-4 lg:py-2">
              <p className="label text-acid">No. {work.no}</p>
              <h3 id="work-title" className="display mt-3 text-[clamp(3rem,5vw,5.5rem)] text-bone">
                {work.title}
              </h3>
              <p className="editorial mt-6 text-[1.4rem] leading-snug text-bone">{work.description}</p>
              <dl className="mt-8 border-t border-line">
                {meta.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line py-3">
                    <dt className="label text-dim">{k}</dt>
                    <dd className="label text-right text-bone">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-8 flex gap-2 pb-6 lg:mt-auto lg:pb-0">
                <button
                  type="button"
                  onClick={() => onNavigate(index - 1)}
                  className="label inline-flex h-12 flex-1 items-center justify-center gap-2 border border-line text-mute transition-colors hover:border-bone hover:text-bone"
                >
                  <ArrowLeft className="size-4" strokeWidth={1.5} aria-hidden="true" /> Previous
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate(index + 1)}
                  className="label inline-flex h-12 flex-1 items-center justify-center gap-2 border border-line text-mute transition-colors hover:border-bone hover:text-bone"
                >
                  Next <ArrowRight className="size-4" strokeWidth={1.5} aria-hidden="true" />
                </button>
              </div>
              <p className="label-sm mt-3 hidden text-dim lg:block">Use ← → to browse, Esc to close</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
