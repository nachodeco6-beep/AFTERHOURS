import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUpRight, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NAV, type SectionId } from '../data/nav'
import { usePlayer } from '../hooks/useAudioPlayer'
import { timeZoneLabel, useClock } from '../hooks/useClock'
import { useDialog } from '../hooks/useDialog'
import { formatClock } from '../lib/format'
import { EqBars } from './EqBars'

function useActiveSection() {
  const [active, setActive] = useState<SectionId | null>(null)
  useEffect(() => {
    const els = NAV.map((n) => document.getElementById(n.id)).filter((el): el is HTMLElement => !!el)
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id as SectionId)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    els.forEach((el) => io.observe(el))
    const onScroll = () => window.scrollY < window.innerHeight * 0.5 && setActive(null)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
    }
  }, [])
  return active
}

function NowPlaying() {
  const player = usePlayer()
  const live = player.status !== 'idle' && player.status !== 'error'
  if (!live) return null
  const stateLabel = player.isPlaying ? 'Pause' : 'Play'
  return (
    <button
      type="button"
      onClick={player.toggle}
      data-cursor={stateLabel}
      aria-label={`${stateLabel} ${player.mood.title}`}
      className="group hidden h-9 items-center gap-2.5 border border-line px-3 text-mute transition-colors hover:border-bone hover:text-bone sm:inline-flex"
    >
      <EqBars active={player.isPlaying} className={player.isPlaying ? 'text-acid' : ''} />
      <span className="label max-w-[9rem] truncate">{player.mood.title}</span>
    </button>
  )
}

export function Header() {
  const now = useClock()
  const active = useActiveSection()
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[background-color,border-color] duration-500 ${
          scrolled || open ? 'border-b border-line-soft bg-ink' : 'border-b border-transparent'
        }`}
      >
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-4 px-4 sm:px-6 md:px-10">
          <a href="#top" className="group flex items-center gap-2" aria-label="AFTERHOURS — back to top" data-cursor="Top">
            <span className="display text-[1.55rem] leading-none tracking-[0.01em] text-bone">Afterhours</span>
            <span className="mt-[-0.6rem] size-1.5 bg-acid transition-transform duration-500 group-hover:rotate-45" />
          </a>

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {NAV.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    aria-current={active === item.id ? 'true' : undefined}
                    className="group relative flex items-baseline gap-2 py-2 text-mute transition-colors hover:text-bone aria-[current]:text-bone"
                  >
                    <span className="label-sm text-dim transition-colors group-hover:text-acid group-aria-[current]:text-acid">
                      {item.no}
                    </span>
                    <span className="text-[0.8125rem] font-medium tracking-wide">{item.label}</span>
                    <span className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-acid transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:scale-x-100 group-aria-[current]:scale-x-100" />
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-3 sm:gap-5">
            <NowPlaying />
            <time className="label hidden tabular-nums text-mute sm:block" dateTime={now.toISOString()} aria-label="Your local time">
              {formatClock(now)}
            </time>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="group flex h-10 items-center gap-3 pl-2 text-bone"
            >
              <span className="label">Menu</span>
              <span aria-hidden="true" className="flex w-6 flex-col gap-[5px]">
                <span className="h-px w-full bg-current transition-transform duration-500 group-hover:scale-x-75" />
                <span className="h-px w-full origin-right bg-current transition-transform duration-500 group-hover:scale-x-50" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{open && <Menu onClose={() => setOpen(false)} active={active} />}</AnimatePresence>
    </>
  )
}

function Menu({ onClose, active }: { onClose: () => void; active: SectionId | null }) {
  const ref = useRef<HTMLDivElement>(null)
  const now = useClock()
  const player = usePlayer()
  useDialog(ref, true, onClose)

  const go = (id: string) => {
    onClose()
    // let the overlay release scroll lock before jumping
    requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView())
  }

  return (
    <motion.div
      ref={ref}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-ink"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1800px] shrink-0 items-center justify-between px-4 sm:px-6 md:px-10">
        <span className="display text-[1.55rem] leading-none text-bone">Afterhours</span>
        <button type="button" onClick={onClose} className="group flex h-10 items-center gap-3 text-bone" data-autofocus>
          <span className="label">Close</span>
          <X className="size-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Menu" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col justify-center px-4 sm:px-6 md:px-10">
        <ul className="border-t border-line">
          {NAV.map((item, i) => (
            <motion.li
              key={item.id}
              className="border-b border-line"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <a
                href={`#${item.id}`}
                onClick={(e) => {
                  e.preventDefault()
                  go(item.id)
                }}
                aria-current={active === item.id ? 'true' : undefined}
                className="group grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 py-4 sm:grid-cols-[4rem_1fr_auto] md:py-5"
              >
                <span className="label text-dim transition-colors group-hover:text-acid group-aria-[current]:text-acid">{item.no}</span>
                <span className="relative block overflow-hidden">
                  <span className="display block py-[0.08em] text-[clamp(3rem,10vw,9.5rem)] text-bone transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:-translate-y-full group-focus-visible:-translate-y-full">
                    {item.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className="display absolute inset-0 block translate-y-full py-[0.08em] text-[clamp(3rem,10vw,9.5rem)] text-acid transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:translate-y-0 group-focus-visible:translate-y-0"
                  >
                    {item.label}
                  </span>
                </span>
                <span className="hidden max-w-[14rem] text-right text-sm text-mute md:block">{item.blurb}</span>
              </a>
            </motion.li>
          ))}
        </ul>
      </nav>

      <div className="mx-auto grid w-full max-w-[1800px] shrink-0 grid-cols-2 gap-4 px-4 py-6 text-mute sm:px-6 md:grid-cols-4 md:px-10">
        <div>
          <p className="label-sm text-dim">Local time</p>
          <p className="label mt-1 tabular-nums text-bone">{formatClock(now)}</p>
        </div>
        <div>
          <p className="label-sm text-dim">Time zone</p>
          <p className="label mt-1 truncate">{timeZoneLabel()}</p>
        </div>
        <div>
          <p className="label-sm text-dim">Sound room</p>
          <p className="label mt-1 flex items-center gap-2">
            <EqBars active={player.isPlaying} className={player.isPlaying ? 'text-acid' : ''} />
            {player.isPlaying ? player.mood.title : 'Silent'}
          </p>
        </div>
        <div className="flex items-end md:justify-end">
          <a href="#top" onClick={(e) => (e.preventDefault(), go('top'))} className="label inline-flex items-center gap-1 text-bone hover:text-acid">
            Back to the top <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </motion.div>
  )
}
