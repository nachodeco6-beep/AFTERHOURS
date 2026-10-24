import type { CSSProperties } from 'react'
import { timeZoneLabel, useClock } from '../hooks/useClock'
import { formatClock } from '../lib/format'
import { CreateButton } from './CreateButton'
import { HeroCanvas } from './HeroCanvas'

const LINES = [
  { text: 'From', indent: false },
  { text: 'Vision', indent: false },
  { text: 'To', indent: true },
  { text: 'Visual', indent: true, accent: true },
]

export function Hero({ ready }: { ready: boolean }) {
  const now = useClock()
  const [hh, mm, ss] = formatClock(now).split(':')

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className={`relative isolate flex min-h-[100svh] flex-col overflow-hidden ${ready ? 'is-ready' : ''}`}
    >
      <HeroCanvas />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-ink via-ink/60 to-transparent" />

      <div className="relative mx-auto flex w-full max-w-[1800px] flex-1 flex-col px-4 pt-24 pb-6 sm:px-6 md:px-10 md:pt-28 md:pb-8">
        {/* top meta row */}
        <div className="grid grid-cols-2 gap-6 border-t border-line/70 pt-4 md:grid-cols-12">
          <p className="label text-mute md:col-span-3">
            N° 00 <span className="text-dim">/</span> Estudio creativo digital
          </p>
          <p className="label hidden text-mute md:col-span-4 md:col-start-5 md:block">
            Para directores de arte,
            <br />
            diseñadores y marcas
          </p>
          <div className="text-right md:col-span-3 md:col-start-10">
            <p className="label-sm text-dim">Tu hora local</p>
            <p className="mt-1 font-mono text-[1.0625rem] tabular-nums tracking-[0.06em] text-bone sm:text-lg" aria-live="off">
              <time dateTime={now.toISOString()}>
                {hh}
                <span className="text-acid">:</span>
                {mm}
                <span className="text-acid">:</span>
                <span className="text-mute">{ss}</span>
              </time>
            </p>
            <p className="label-sm mt-1 text-mute">{timeZoneLabel()}</p>
          </div>
        </div>

        {/* headline */}
        <h1
          id="hero-title"
          tabIndex={-1}
          data-route-title
          className="display mt-auto pt-10 outline-none text-[clamp(3.4rem,min(22vw,12svh),14rem)] text-bone md:text-[clamp(4rem,min(11vw,13.5svh),15rem)]"
        >
          <span className="sr-only">From vision to visual</span>
          {LINES.map((line, i) => (
            <span
              key={line.text}
              aria-hidden="true"
              className={`line-mask ${line.indent ? 'pl-[12vw] md:pl-[30vw]' : ''}`}
              style={{ '--line-delay': `${150 + i * 110}ms` } as CSSProperties}
            >
              <span className={line.accent ? 'text-acid' : undefined}>{line.text}</span>
            </span>
          ))}
        </h1>

        {/* bottom row */}
        <div className="mt-8 grid items-end gap-8 md:mt-10 md:grid-cols-12">
          <p className="max-w-[26rem] text-[0.9375rem] leading-relaxed text-mute md:col-span-5">
            <span className="editorial text-[1.35rem] leading-none text-bone">Escribí una idea.</span> AFTERHOURS busca
            fotografías reales y te ayuda a convertirla en una dirección visual.
          </p>
          <div className="flex items-end justify-between gap-6 md:col-span-7 md:justify-end md:gap-12">
            <CreateButton />
            <button
              type="button"
              onClick={() => document.getElementById('como-funciona')?.scrollIntoView()}
              className="group flex flex-col items-center gap-3 text-mute hover:text-bone"
              aria-label="Bajar a «Cómo funciona»"
            >
              <span className="label-sm [writing-mode:vertical-rl]">Bajar</span>
              <span aria-hidden="true" className="relative block h-14 w-px overflow-hidden bg-line">
                <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_2.2s_var(--ease-in-out-quart)_infinite] bg-acid" />
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
