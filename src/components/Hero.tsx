import { ArrowDownRight } from 'lucide-react'
import { useRef, type CSSProperties, type PointerEvent } from 'react'
import { timeZoneLabel, useClock } from '../hooks/useClock'
import { formatClock, nightPhase } from '../lib/format'
import { HeroCanvas } from './HeroCanvas'

const LINES = [
  { text: 'The world', indent: false },
  { text: 'goes quiet.', indent: false },
  { text: 'We come', indent: true },
  { text: 'alive.', indent: true, accent: true },
]

function EnterButton() {
  const ref = useRef<HTMLAnchorElement>(null)

  // gentle magnetic pull toward the pointer
  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== 'mouse' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left - r.width / 2) / r.width
    const y = (e.clientY - r.top - r.height / 2) / r.height
    el.style.transform = `translate3d(${x * 10}px, ${y * 8}px, 0)`
  }
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = ''
  }

  return (
    <a
      ref={ref}
      href="#sound-room"
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-cursor="Enter"
      className="btn-fill group inline-flex h-16 items-center gap-6 bg-acid pr-5 pl-6 text-ink transition-transform duration-500 ease-[var(--ease-out-expo)] [--fill-color:var(--color-bone)] sm:h-[4.5rem] sm:pl-7"
    >
      <span className="display text-[1.65rem] leading-none tracking-[0.02em] sm:text-[1.9rem]">Enter the night</span>
      <ArrowDownRight
        className="size-6 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:rotate-[-45deg]"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </a>
  )
}

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
            N° 00 <span className="text-dim">/</span> An index of the night
          </p>
          <p className="label hidden text-mute md:col-span-4 md:col-start-5 md:block">
            For night owls, designers,
            <br />
            musicians &amp; restless minds
          </p>
          <div className="text-right md:col-span-3 md:col-start-10">
            <p className="label-sm text-dim">Your local time</p>
            <p className="mt-1 font-mono text-[1.0625rem] tabular-nums tracking-[0.06em] text-bone sm:text-lg" aria-live="off">
              <time dateTime={now.toISOString()}>
                {hh}
                <span className="text-acid">:</span>
                {mm}
                <span className="text-acid">:</span>
                <span className="text-mute">{ss}</span>
              </time>
            </p>
            <p className="label-sm mt-1 text-mute">
              {nightPhase(now)}
              <span className="hidden sm:inline"> · {timeZoneLabel()}</span>
            </p>
          </div>
        </div>

        {/* headline */}
        <h1 id="hero-title" className="display mt-auto pt-10 text-[clamp(3.4rem,min(16vw,15svh),14rem)] text-bone md:text-[clamp(4rem,min(11vw,13.5svh),15rem)]">
          <span className="sr-only">The world goes quiet. We come alive.</span>
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
            <span className="editorial text-[1.35rem] leading-none text-bone">A place for the hours</span>{' '}
            nobody schedules. Music for the drive home, a page for the thoughts that arrive at 3 a.m., and an archive of work
            made while everyone else was asleep.
          </p>
          <div className="flex items-end justify-between gap-6 md:col-span-7 md:justify-end md:gap-12">
            <EnterButton />
            <a
              href="#sound-room"
              className="group flex flex-col items-center gap-3 text-mute hover:text-bone"
              aria-label="Scroll to the Sound Room"
            >
              <span className="label-sm [writing-mode:vertical-rl]">Scroll</span>
              <span aria-hidden="true" className="relative block h-14 w-px overflow-hidden bg-line">
                <span className="absolute inset-x-0 top-0 h-1/2 animate-[scrollcue_2.2s_var(--ease-in-out-quart)_infinite] bg-acid" />
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
