import { useReducedMotion } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { NAV } from '../data/nav'
import { timeZoneLabel, useClock } from '../hooks/useClock'
import { formatClock } from '../lib/format'
import { routeHref, scrollToTop } from '../lib/router'
import { Reveal } from './Reveal'

export function Footer() {
  const now = useClock()
  const reduce = useReducedMotion()

  return (
    <footer className="relative overflow-hidden border-t border-line pt-20 md:pt-28">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <Reveal className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <p className="editorial max-w-3xl text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95] text-bone">
            De la idea a la imagen. <span className="text-dim">From vision to visual.</span>
          </p>
          <button
            type="button"
            onClick={scrollToTop}
            data-cursor="Arriba"
            className="btn-fill group label inline-flex h-12 shrink-0 items-center gap-3 self-start border border-line px-5 text-bone transition-colors hover:text-ink md:self-auto"
          >
            Volver arriba
            <ArrowUp className="size-4 transition-transform duration-500 group-hover:-translate-y-0.5" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </Reveal>

        <div className="mt-20 grid gap-10 border-t border-line pt-8 sm:grid-cols-2 lg:grid-cols-12">
          <nav aria-label="Pie de página" className="lg:col-span-3">
            <p className="label-sm text-dim">Índice</p>
            <ul className="mt-4 space-y-2">
              {NAV.map((n) => (
                <li key={n.route}>
                  <a href={routeHref(n.route)} className="group inline-flex items-baseline gap-3 text-bone transition-colors hover:text-acid">
                    <span className="label-sm text-dim group-hover:text-acid">{n.no}</span>
                    {n.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="lg:col-span-5">
            <p className="label-sm text-dim">Colofón</p>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-mute">
              Compuesto en Big Shoulders Display, Inter Tight, Instrument Serif y JetBrains Mono. Las fotografías vienen de
              Unsplash y siempre llevan el crédito de su autor.
            </p>
          </div>
          <div className="lg:col-span-2">
            <p className="label-sm text-dim">Hora local</p>
            <p className="label mt-4 tabular-nums text-bone">{formatClock(now)}</p>
            <p className="label-sm mt-1 text-mute">{timeZoneLabel()}</p>
          </div>
          <div className="lg:col-span-2">
            <p className="label-sm text-dim">Movimiento</p>
            <p className="label mt-4 text-bone">{reduce ? 'Reducido' : 'Completo'}</p>
            <p className="label-sm mt-1 text-mute">Sigue la configuración de tu sistema</p>
          </div>
        </div>
      </div>

      {/* wordmark sized to the exact container width */}
      <div aria-hidden="true" className="mx-auto mt-16 max-w-[1800px] px-2 md:px-6">
        <svg viewBox="0 0 1000 210" className="block w-full" preserveAspectRatio="xMidYMax meet">
          <text
            x="0"
            y="200"
            textLength="1000"
            lengthAdjust="spacingAndGlyphs"
            fontFamily="'Big Shoulders Display', 'Arial Narrow', Impact, sans-serif"
            fontWeight="900"
            fontSize="262"
            fill="#F1F0E8"
          >
            AFTERHOURS
          </text>
        </svg>
      </div>

      <div className="mx-auto flex max-w-[1800px] flex-col gap-2 border-t border-line px-4 py-5 text-dim sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-10">
        <p className="label-sm">© {now.getFullYear()} Afterhours</p>
        <p className="label-sm">From vision to visual</p>
      </div>
    </footer>
  )
}
