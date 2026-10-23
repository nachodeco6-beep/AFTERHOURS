import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import { ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CATEGORIES, WORKS, type Category, type Work } from '../../data/archive'
import { pad } from '../../lib/format'
import { Reveal } from '../Reveal'
import { SectionHeader } from '../SectionHeader'
import { ArchiveModal } from './ArchiveModal'
import { Artwork } from './Artwork'

type Filter = 'All' | Category

/** Placement cycle for the asymmetric 12-column grid (md and up). */
const PLACEMENT = [
  'md:col-start-1 md:col-span-5',
  'md:col-start-7 md:col-span-4 md:mt-40',
  'md:col-start-2 md:col-span-6 md:mt-10',
  'md:col-start-9 md:col-span-4 md:mt-48',
  'md:col-start-1 md:col-span-4 md:mt-10',
  'md:col-start-6 md:col-span-7 md:mt-32',
]

/** Mobile rhythm: alternate full-bleed and inset cards. */
const MOBILE = ['w-full', 'ml-auto w-[84%]', 'w-[90%]', 'ml-auto w-full']

function Card({ work, index, onOpen }: { work: Work; index: number; onOpen: () => void }) {
  return (
    <figure className="group">
      <button type="button" onClick={onOpen} data-cursor="View" className="block w-full text-left" aria-label={`Open ${work.title}`}>
        <div className="relative overflow-hidden" style={{ aspectRatio: work.ratio }}>
          <Artwork
            work={work}
            className="absolute inset-0 bg-char transition-[filter,transform] duration-[1.2s] ease-[var(--ease-out-expo)] [filter:saturate(0.55)_brightness(0.82)] group-hover:scale-[1.035] group-hover:[filter:saturate(1)_brightness(1)] group-focus-visible:[filter:saturate(1)_brightness(1)]"
            fit="cover"
          />
          <span className="label-sm absolute top-3 left-3 bg-ink/80 px-1.5 py-1 text-bone">No. {work.no}</span>
          <span
            aria-hidden="true"
            className="absolute right-3 bottom-3 grid size-10 translate-y-2 place-items-center bg-acid text-ink opacity-0 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-y-0 group-hover:opacity-100"
          >
            <ArrowUpRight className="size-4" strokeWidth={1.75} />
          </span>
        </div>
        <figcaption className="mt-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h3 className="display text-[clamp(1.75rem,2.6vw,2.6rem)] text-bone transition-colors duration-300 group-hover:text-acid">{work.title}</h3>
            <span className="label shrink-0 text-dim tabular-nums">{pad(index + 1)}</span>
          </div>
          <div className="mt-3 flex items-start justify-between gap-6">
            <p className="line-clamp-2 max-w-[30rem] text-sm leading-relaxed text-mute">{work.description}</p>
            <p className="label shrink-0 text-right text-dim">
              {work.category}
              <br />
              {work.year}
            </p>
          </div>
        </figcaption>
      </button>
    </figure>
  )
}

export function Archive() {
  const [filter, setFilter] = useState<Filter>('All')
  const [openId, setOpenId] = useState<string | null>(null)
  const reduce = useReducedMotion()

  const visible = useMemo(() => (filter === 'All' ? WORKS : WORKS.filter((w) => w.category === filter)), [filter])
  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c, WORKS.filter((w) => w.category === c).length])), [])
  const openIndex = visible.findIndex((w) => w.id === openId)

  return (
    <section id="archive" aria-labelledby="archive-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="archive" no="03" label="Night Archive" meta={`${pad(WORKS.length)} works`} title="Night archive">
          Twelve studies of the city and the landscape after dark — long exposures, empty towers, tides and typography.
          Each work is generated from a seed and rendered live in your browser.
        </SectionHeader>

        <Reveal className="mb-12 flex flex-col gap-4 border-y border-line py-3 md:mb-20 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filter by category" className="-mx-1 flex flex-wrap gap-1">
            {(['All', ...CATEGORIES] as Filter[]).map((c) => {
              const active = filter === c
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setFilter(c)}
                  aria-pressed={active}
                  className={`label relative inline-flex h-10 items-center gap-1.5 px-3 transition-colors ${
                    active ? 'text-ink' : 'text-mute hover:text-bone'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="archive-filter"
                      className="absolute inset-0 -z-0 bg-bone"
                      transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                    />
                  )}
                  <span className="relative">{c}</span>
                  <span className={`relative text-[0.625rem] ${active ? 'text-ink/60' : 'text-dim'}`}>
                    {c === 'All' ? WORKS.length : counts[c]}
                  </span>
                </button>
              )
            })}
          </div>
          <p className="label text-dim" aria-live="polite">
            Showing <span className="text-bone">{pad(visible.length)}</span> of {pad(WORKS.length)}
          </p>
        </Reveal>

        <LayoutGroup>
          <motion.ul layout={!reduce} className="flex flex-col gap-14 md:grid md:grid-cols-12 md:items-start md:gap-x-8 md:gap-y-20">
            <AnimatePresence mode="popLayout" initial={false}>
              {visible.map((work, i) => (
                <motion.li
                  key={work.id}
                  layout={!reduce}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                  className={`${PLACEMENT[i % PLACEMENT.length]} ${MOBILE[i % MOBILE.length]} md:w-auto md:ml-0`}
                >
                  <Card work={work} index={i} onOpen={() => setOpenId(work.id)} />
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        </LayoutGroup>
      </div>

      <AnimatePresence>
        {openIndex >= 0 && (
          <ArchiveModal
            key="modal"
            works={visible}
            index={openIndex}
            onClose={() => setOpenId(null)}
            onNavigate={(i) => setOpenId(visible[(i + visible.length) % visible.length].id)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
