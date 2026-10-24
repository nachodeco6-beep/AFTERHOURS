import { motion } from 'framer-motion'
import { Minus, Plus, Scan, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type TouchEvent } from 'react'
import { useDialog } from '../../hooks/useDialog'
import { FORMATS, type Format } from '../../lib/formats'

/** Height of the viewer's top bar. */
const BAR = 64
const STEP = 1.4

interface ViewerProps {
  format: Format
  onClose: () => void
  /** Renders the canvas at its real size; gets the scale it's shown at. */
  children: (scale: number) => ReactNode
}

const typing = (el: EventTarget | null) => el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))

/** «Ver en grande»: the board full screen, fitted at first, with zoom (buttons, keys, pinch, ctrl + wheel). */
export function BoardViewer({ format, onClose, children }: ViewerProps) {
  const spec = FORMATS[format]
  const dialog = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  useDialog(dialog, true, onClose)

  const [view, setView] = useState({
    w: window.innerWidth,
    h: window.innerHeight,
  })
  useEffect(() => {
    const onResize = () => setView({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const fit = Math.min((view.w - 32) / spec.width, (view.h - BAR - 32) / spec.height)
  const max = Math.max(2, fit * 4)
  const [zoom, setZoom] = useState<number | null>(null) // null = fitted to the screen
  const z = Math.min(max, Math.max(fit, zoom ?? fit))

  // keep the point under the fingers / cursor (or the centre) where it was while zooming
  const anchor = useRef<{
    x: number
    y: number
    px: number
    py: number
  } | null>(null)
  const zoomTo = (next: number, at?: { x: number; y: number }) => {
    const el = scroller.current
    if (el) {
      const px = at?.x ?? el.clientWidth / 2
      const py = at?.y ?? el.clientHeight / 2
      anchor.current = {
        x: (el.scrollLeft + px) / el.scrollWidth,
        y: (el.scrollTop + py) / el.scrollHeight,
        px,
        py,
      }
    }
    const clamped = Math.min(max, Math.max(fit, next))
    setZoom(clamped <= fit * 1.001 ? null : clamped)
  }
  useLayoutEffect(() => {
    const el = scroller.current
    const a = anchor.current
    if (!el || !a) return
    el.scrollLeft = a.x * el.scrollWidth - a.px
    el.scrollTop = a.y * el.scrollHeight - a.py
    anchor.current = null
  }, [z])

  // ctrl / ⌘ + wheel (and trackpad pinch) zooms instead of zooming the whole page
  const zRef = useRef(z)
  useLayoutEffect(() => {
    zRef.current = z
  })
  const zoomRef = useRef(zoomTo)
  useLayoutEffect(() => {
    zoomRef.current = zoomTo
  })
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomRef.current(zRef.current * Math.exp(-e.deltaY * 0.01), {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const pinch = useRef<{ d: number; z: number } | null>(null)
  const distance = (e: TouchEvent) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) pinch.current = { d: distance(e), z }
  }
  const onTouchMove = (e: TouchEvent) => {
    const p = pinch.current
    const el = scroller.current
    if (!p || !el || e.touches.length !== 2) return
    const r = el.getBoundingClientRect()
    const mid = {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top,
    }
    zoomTo((p.z * distance(e)) / p.d, mid)
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === '+' || e.key === '=') zoomTo(z * STEP)
    else if (e.key === '-') zoomTo(z / STEP)
    else if (e.key === '0') zoomTo(fit)
    else return
    e.preventDefault()
  }

  const fitted = zoom === null
  const button = 'grid size-10 place-items-center text-mute transition-colors hover:text-bone disabled:opacity-30 disabled:hover:text-mute'

  return (
    <motion.div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby="viewer-title"
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[80] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-2 sm:px-4" style={{ height: BAR }}>
        <div className="min-w-0 pl-2">
          <h2 id="viewer-title" className="label text-bone">
            Tu tablero
          </h2>
          <p className="label-sm truncate text-dim">
            {spec.label} · <span className="max-sm:hidden">usá + y − o </span>
            pellizcá para acercar
          </p>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => zoomTo(z / STEP)} disabled={fitted} aria-label="Alejar" className={button}>
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <p className="label-sm w-12 text-center tabular-nums text-mute" aria-live="polite">
            <span className="sr-only">Zoom </span>
            {Math.round(z * 100)}%
          </p>
          <button type="button" onClick={() => zoomTo(z * STEP)} disabled={z >= max * 0.999} aria-label="Acercar" className={button}>
            <Plus className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => zoomTo(fit)} disabled={fitted} aria-label="Ajustar a la pantalla" title="Ajustar a la pantalla" className={button}>
            <Scan className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar" data-autofocus className={`${button} ml-1 border-l border-line`}>
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="thin-scroll min-h-0 flex-1 overflow-auto [touch-action:pan-x_pan-y]"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="grid min-h-full w-max min-w-full place-items-center p-4">
          <div className="relative" style={{ width: spec.width * z, height: spec.height * z }}>
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                width: spec.width,
                height: spec.height,
                transform: `scale(${z})`,
              }}
            >
              {children(z)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
