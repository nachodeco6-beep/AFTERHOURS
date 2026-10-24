import { Maximize2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FORMATS, type Format } from '../../lib/formats'

/** Fixed site header and the minimised «Tu selección» bar: the board fits between them. */
const SITE_HEADER = 64
const TRAY_BAR = 56
/** Breathing room above and below the board inside the viewport. */
const BREATH = 24

interface StageProps {
  format: Format
  /** The board is open in the big viewer: keep its place here. */
  viewing: boolean
  onView: () => void
  /** Renders the canvas at its real size; gets the scale it's shown at. */
  children: (scale: number) => ReactNode
}

/** Shows the fixed-size canvas scaled to fit the available width and height, with air around it. */
export function BoardStage({ format, viewing, onView, children }: StageProps) {
  const spec = FORMATS[format]
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth, h: window.innerHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const padY = room.w >= 768 ? 32 : 16
  const height = Math.max(220, room.h - SITE_HEADER - TRAY_BAR - BREATH * 2 - padY * 2)
  const scale = room.w ? Math.min(room.w / spec.width, height / spec.height) : 0

  return (
    <div>
      <div className="border border-line bg-char/40 px-3 py-4 sm:px-6 md:p-8">
        <div ref={box} className="flex w-full justify-center">
          <div className="relative shrink-0" style={{ width: spec.width * scale, height: spec.height * scale }} data-board-stage>
            {scale > 0 &&
              (viewing ? (
                <div className="label-sm grid h-full place-items-center border border-dashed border-line text-dim">Abierto en grande</div>
              ) : (
                <div
                  className="absolute top-0 left-0 origin-top-left shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
                  style={{
                    width: spec.width,
                    height: spec.height,
                    transform: `scale(${scale})`,
                  }}
                >
                  {children(scale)}
                </div>
              ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="label-sm text-dim">
          {spec.label} · {spec.exportWidth} × {spec.exportHeight} px
        </p>
        <button type="button" onClick={onView} className="label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone hover:border-bone">
          <Maximize2 className="size-3.5" aria-hidden="true" /> Ver en grande
        </button>
      </div>
    </div>
  )
}
