import { ArrowRight } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { routeHref } from '../lib/router'

/** The primary call to action: lime, with a gentle magnetic pull toward the pointer. */
export function CreateButton() {
  const ref = useRef<HTMLAnchorElement>(null)

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
      href={routeHref('studio')}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      data-cursor="Crear"
      className="btn-fill group inline-flex h-16 items-center gap-6 bg-acid pr-5 pl-6 text-ink transition-transform duration-500 ease-[var(--ease-out-expo)] [--fill-color:var(--color-bone)] sm:h-[4.5rem] sm:pl-7"
    >
      <span className="display text-[1.65rem] leading-none tracking-[0.02em] sm:text-[1.9rem]">Crear moodboard</span>
      <ArrowRight
        className="size-6 transition-transform duration-500 ease-[var(--ease-out-expo)] group-hover:translate-x-1"
        strokeWidth={1.5}
        aria-hidden="true"
      />
    </a>
  )
}
