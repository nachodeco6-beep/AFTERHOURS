import { useEffect, useRef, useState } from 'react'

const INTERACTIVE = 'a, button, [role="button"], input[type="range"], label, select, [data-cursor]'

/**
 * A dot that tracks the pointer exactly and a ring that follows with inertia.
 * Only mounts for fine pointers with hover, so touch devices keep native behaviour.
 */
export function Cursor() {
  const [enabled, setEnabled] = useState(false)
  const dot = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const label = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => setEnabled(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (!enabled) return
    const root = document.documentElement
    root.classList.add('has-cursor')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const pos = { x: -100, y: -100 }
    const lag = { x: -100, y: -100 }
    let raf = 0
    let visible = false

    const setVisible = (v: boolean) => {
      visible = v
      if (dot.current) dot.current.style.opacity = v ? '1' : '0'
      if (ring.current) ring.current.style.opacity = v ? '1' : '0'
    }

    const probe = (target: Element | null) => {
      const textual = target?.closest('textarea, input[type="text"], [contenteditable="true"]')
      const hit = textual ? null : target?.closest<HTMLElement>(INTERACTIVE)
      const text = hit?.dataset.cursor ?? ''
      ring.current?.setAttribute('data-state', textual ? 'text' : hit ? (text ? 'label' : 'hover') : 'idle')
      if (label.current && label.current.textContent !== text) label.current.textContent = text
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      pos.x = e.clientX
      pos.y = e.clientY
      if (!visible) {
        lag.x = pos.x
        lag.y = pos.y
        setVisible(true)
      }
      probe(e.target as Element | null)
    }

    // content scrolling under a still pointer changes what it is over
    const onScroll = () => visible && probe(document.elementFromPoint(pos.x, pos.y))

    const onDown = () => ring.current?.setAttribute('data-down', 'true')
    const onUp = () => ring.current?.removeAttribute('data-down')
    const onLeave = () => setVisible(false)

    const tick = () => {
      const k = reduce ? 1 : 0.2
      lag.x += (pos.x - lag.x) * k
      lag.y += (pos.y - lag.y) * k
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`
      if (ring.current) ring.current.style.transform = `translate3d(${lag.x}px, ${lag.y}px, 0)`
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      root.classList.remove('has-cursor')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[100]">
      <div ref={dot} className="absolute top-0 left-0 opacity-0 transition-opacity duration-300">
        <span className="absolute -top-[3px] -left-[3px] block size-1.5 bg-acid" />
      </div>
      <div ref={ring} data-state="idle" className="group/cursor absolute top-0 left-0 opacity-0 transition-opacity duration-300">
        <span
          className="absolute top-0 left-0 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-bone/50 transition-[width,height,background-color,border-color] duration-500 ease-[var(--ease-out-expo)]
            group-data-[state=hover]/cursor:size-14 group-data-[state=hover]/cursor:border-acid
            group-data-[state=label]/cursor:size-20 group-data-[state=label]/cursor:border-acid group-data-[state=label]/cursor:bg-acid
            group-data-[state=text]/cursor:size-0 group-data-[state=text]/cursor:border-transparent
            group-data-[down=true]/cursor:scale-90"
        >
          <span
            ref={label}
            className="label-sm font-medium text-ink opacity-0 transition-opacity duration-300 group-data-[state=label]/cursor:opacity-100"
          />
        </span>
      </div>
    </div>
  )
}
