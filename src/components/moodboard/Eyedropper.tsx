import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Photo } from '../../../shared/types'
import { rgbToHex } from '../../lib/color'
import { pad } from '../../lib/format'
import { PhotoFrame } from '../studio/PhotoFrame'

interface Props {
  photos: Photo[]
  /** Photo to start on. */
  start: number
  onPick: (hex: string, photoId: string) => void
  onCancel: () => void
}

/**
 * «Tomar de una foto»: a dropper over the board's photos. Mouse or touch to aim
 * and pick; with the keyboard, arrows move the sight (Shift for bigger steps)
 * and Enter picks.
 */
export function Eyedropper({ photos, start, onPick, onCancel }: Props) {
  const [index, setIndex] = useState(Math.max(0, Math.min(photos.length - 1, start)))
  const [aim, setAim] = useState({ x: 0.5, y: 0.5 })
  const [hex, setHex] = useState<string | null>(null)
  const [loaded, setLoaded] = useState<{ id: string; ok: boolean } | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const photo = photos[index]
  const state = loaded?.id !== photo.id ? 'loading' : loaded.ok ? 'ready' : 'failed'

  /** The colour under a point of the photo (0–1), or null if it can't be read. */
  const read = (a: { x: number; y: number }) => {
    const c = canvas.current
    const ctx = c?.getContext('2d', { willReadFrequently: true })
    if (!c || !ctx || !c.width) return null
    try {
      const px = ctx.getImageData(Math.min(c.width - 1, Math.round(a.x * c.width)), Math.min(c.height - 1, Math.round(a.y * c.height)), 1, 1).data
      return rgbToHex([px[0], px[1], px[2]])
    } catch {
      return null
    }
  }
  const moveTo = (a: { x: number; y: number }) => {
    setAim(a)
    if (state === 'ready') setHex(read(a))
  }

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      const c = canvas.current
      const ctx = c?.getContext('2d', { willReadFrequently: true })
      if (!c || !ctx) return setLoaded({ id: photo.id, ok: false })
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      ctx.drawImage(img, 0, 0)
      try {
        const px = ctx.getImageData(Math.round(c.width / 2), Math.round(c.height / 2), 1, 1).data // throws if the photo can't be read
        setAim({ x: 0.5, y: 0.5 })
        setHex(rgbToHex([px[0], px[1], px[2]]))
        setLoaded({ id: photo.id, ok: true })
      } catch {
        setLoaded({ id: photo.id, ok: false })
      }
    }
    img.onerror = () => !cancelled && setLoaded({ id: photo.id, ok: false })
    img.src = photo.urls.small
    return () => {
      cancelled = true
    }
  }, [photo])

  const aimAt = (e: PointerEvent) => {
    const r = area.current?.getBoundingClientRect()
    if (!r) return
    moveTo({ x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) })
  }

  const onKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.05 : 0.01
    const move: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    if (move[e.key]) {
      e.preventDefault()
      const [dx, dy] = move[e.key]
      moveTo({ x: Math.min(1, Math.max(0, aim.x + dx)), y: Math.min(1, Math.max(0, aim.y + dy)) })
    } else if (e.key === 'Enter' && state === 'ready' && hex) {
      e.preventDefault()
      onPick(hex, photo.id)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="label text-[var(--sheet-ink)]">Tomar de una foto</p>
        <button type="button" onClick={onCancel} className="label-sm h-8 border border-[var(--sheet-line)] px-3 text-[var(--sheet-ink)] hover:border-[var(--sheet-ink)]">
          Cancelar
        </button>
      </div>
      <div role="radiogroup" aria-label="Foto" className="mt-3 flex flex-wrap gap-1.5">
        {photos.map((p, i) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={i === index}
            aria-label={`Foto ${pad(i + 1)}, de ${p.author.name}`}
            onClick={() => {
              setIndex(i)
              setHex(null)
            }}
            className={`relative size-11 overflow-hidden ${i === index ? 'outline-2 outline-offset-2 outline-[var(--sheet-ink)]' : 'opacity-70 hover:opacity-100'}`}
            style={i === index ? { outlineStyle: 'solid' } : undefined}
          >
            <PhotoFrame photo={p} size="thumb" eager className="absolute inset-0" />
          </button>
        ))}
      </div>
      <div
        ref={area}
        tabIndex={0}
        role="application"
        aria-label={`Cuentagotas sobre la foto ${pad(index + 1)}. Mové la mira con las flechas y tocá Enter para tomar el color${hex ? `; ahora: ${hex}` : ''}.`}
        onKeyDown={onKey}
        onPointerMove={aimAt}
        onPointerDown={aimAt}
        onClick={() => state === 'ready' && hex && onPick(hex, photo.id)}
        className="relative mt-3 w-full cursor-crosshair touch-none overflow-hidden bg-[var(--sheet-line)]"
        style={{ aspectRatio: `${photo.width} / ${photo.height}`, maxHeight: '52vh' }}
      >
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden="true" />
        {state === 'ready' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
            style={{ left: `${aim.x * 100}%`, top: `${aim.y * 100}%`, backgroundColor: hex ?? 'transparent' }}
          />
        )}
        {state !== 'ready' && (
          <p className="label-sm absolute inset-0 grid place-items-center bg-[var(--sheet-line)] text-[var(--sheet-ink)]">
            {state === 'loading' ? 'Cargando la foto…' : 'No se pudo leer esta foto: probá con otra.'}
          </p>
        )}
      </div>
      <p className="label-sm mt-2 flex items-center gap-2 text-[var(--sheet-mute)]" aria-live="polite">
        {state === 'ready' && hex && <span aria-hidden="true" className="size-3 border border-[var(--sheet-line)]" style={{ backgroundColor: hex }} />}
        {state === 'ready' && hex ? `${hex} · tocá o Enter para usarlo` : 'Apuntá a un color'}
      </p>
    </div>
  )
}
