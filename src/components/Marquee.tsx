import type { CSSProperties } from 'react'

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="mx-6 size-[0.5em] shrink-0 text-acid md:mx-10" aria-hidden="true">
      <path d="M12 0v24M0 12h24M3.5 3.5l17 17M20.5 3.5l-17 17" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  )
}

/** A slow typographic band. Purely decorative, so hidden from assistive tech. */
export function Marquee({ words, duration = 50, outline = false }: { words: string[]; duration?: number; outline?: boolean }) {
  const row = (
    <div className="flex shrink-0 items-center">
      {words.map((w) => (
        <span key={w} className="flex items-center">
          <span className={outline ? 'outline-text' : undefined}>{w}</span>
          <Star />
        </span>
      ))}
    </div>
  )
  return (
    <div aria-hidden="true" className="relative overflow-hidden border-y border-line py-5 select-none md:py-7">
      <div
        className="marquee-track display flex w-max text-[clamp(2.5rem,6vw,5.5rem)] text-bone"
        style={{ '--marquee-duration': `${duration}s` } as CSSProperties}
      >
        {row}
        {row}
      </div>
    </div>
  )
}
