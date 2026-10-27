import { AnimatePresence, motion } from 'framer-motion'
import { ArrowUp, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { NAV } from '../data/nav'
import { timeZoneLabel, useClock } from '../hooks/useClock'
import { useDialog } from '../hooks/useDialog'
import { formatClock } from '../lib/format'
import { routeHref, scrollToTop, type RouteId } from '../lib/router'
import { PlanIcon } from './PlanIcon'

/** «Página | Planta»: the usual page, or the 3D plan over it. */
function ViewSwitch({ plantaOpen, onPlanta }: { plantaOpen: boolean; onPlanta: () => void }) {
  const base = 'label-sm flex h-8 items-center gap-1.5 px-2 transition-colors sm:px-2.5'
  return (
    <div role="group" aria-label="Cómo ver AFTERHOURS" className="flex border border-line">
      <button type="button" aria-pressed={!plantaOpen} className={`${base} ${plantaOpen ? 'text-mute hover:text-bone' : 'bg-acid text-ink'}`}>
        Página
      </button>
      <button type="button" aria-pressed={plantaOpen} onClick={onPlanta} className={`${base} ${plantaOpen ? 'bg-acid text-ink' : 'text-mute hover:text-bone'}`}>
        <PlanIcon />
        Planta
      </button>
    </div>
  )
}

export function Header({ route, plantaOpen = false, onPlanta = () => {} }: { route: RouteId; plantaOpen?: boolean; onPlanta?: () => void }) {
  const now = useClock()
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
          <a href={routeHref('home')} className="group flex items-center gap-2" aria-label="AFTERHOURS — inicio" data-cursor="Inicio">
            <span className="display text-[1.55rem] leading-none tracking-[0.01em] text-bone">Afterhours</span>
            <span className="mt-[-0.6rem] size-1.5 bg-acid transition-transform duration-500 group-hover:rotate-45" />
          </a>

          <nav aria-label="Principal" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {NAV.filter((item) => item.route !== 'home').map((item) => (
                <li key={item.route}>
                  <a
                    href={routeHref(item.route)}
                    aria-current={route === item.route ? 'page' : undefined}
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

          <div className="flex items-center gap-2 sm:gap-5">
            <ViewSwitch plantaOpen={plantaOpen} onPlanta={onPlanta} />
            <time className="label hidden tabular-nums text-mute sm:block" dateTime={now.toISOString()} aria-label="Tu hora local">
              {formatClock(now)}
            </time>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="group flex h-10 items-center gap-3 pl-2 text-bone"
            >
              <span className="label max-[400px]:sr-only">Menú</span>
              <span aria-hidden="true" className="flex w-6 flex-col gap-[5px]">
                <span className="h-px w-full bg-current transition-transform duration-500 group-hover:scale-x-75" />
                <span className="h-px w-full origin-right bg-current transition-transform duration-500 group-hover:scale-x-50" />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>{open && <Menu onClose={() => setOpen(false)} route={route} />}</AnimatePresence>
    </>
  )
}

function Menu({ onClose, route }: { onClose: () => void; route: RouteId }) {
  const ref = useRef<HTMLDivElement>(null)
  const now = useClock()
  useDialog(ref, true, onClose)

  return (
    <motion.div
      ref={ref}
      id="site-menu"
      role="dialog"
      aria-modal="true"
      aria-label="Menú"
      className="fixed inset-0 z-[70] flex flex-col overflow-y-auto bg-ink"
      initial={{ clipPath: 'inset(0 0 100% 0)' }}
      animate={{ clipPath: 'inset(0 0 0% 0)' }}
      exit={{ clipPath: 'inset(0 0 100% 0)' }}
      transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1800px] shrink-0 items-center justify-between px-4 sm:px-6 md:px-10">
        <span className="display text-[1.55rem] leading-none text-bone">Afterhours</span>
        <button type="button" onClick={onClose} className="group flex h-10 items-center gap-3 text-bone" data-autofocus>
          <span className="label">Cerrar</span>
          <X className="size-5 transition-transform duration-500 group-hover:rotate-90" strokeWidth={1.25} aria-hidden="true" />
        </button>
      </div>

      <nav aria-label="Menú" className="mx-auto flex w-full max-w-[1800px] flex-1 flex-col justify-center px-4 sm:px-6 md:px-10">
        <ul className="border-t border-line">
          {NAV.map((item, i) => (
            <motion.li
              key={item.route}
              className="border-b border-line"
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 + i * 0.07, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            >
              <a
                href={routeHref(item.route)}
                onClick={() => {
                  // same route: the hash won't change, so close and go back up by hand
                  if (item.route === route) scrollToTop()
                  onClose()
                }}
                aria-current={route === item.route ? 'page' : undefined}
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

      <div className="mx-auto grid w-full max-w-[1800px] shrink-0 grid-cols-2 gap-4 px-4 py-6 text-mute sm:px-6 md:grid-cols-3 md:px-10">
        <div>
          <p className="label-sm text-dim">Hora local</p>
          <p className="label mt-1 tabular-nums text-bone">{formatClock(now)}</p>
        </div>
        <div>
          <p className="label-sm text-dim">Zona horaria</p>
          <p className="label mt-1 truncate">{timeZoneLabel()}</p>
        </div>
        <div className="col-span-2 flex items-end md:col-span-1 md:justify-end">
          <button
            type="button"
            onClick={() => {
              scrollToTop()
              onClose()
            }}
            className="label inline-flex h-10 items-center gap-1 text-bone hover:text-acid"
          >
            Volver arriba <ArrowUp className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
