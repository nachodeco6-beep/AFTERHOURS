import { useEffect, useRef, useState } from 'react'
import type { Work } from '../../data/archive'
import { renderArtwork } from '../../lib/art'

const RENDER_WIDTH = 1200

interface ArtworkProps {
  work: Work
  /** Positioning + surface classes for the frame. Defaults to `relative bg-char`. */
  className?: string
  /** Start rendering immediately instead of waiting to scroll near it. */
  eager?: boolean
  fit?: 'cover' | 'contain'
}

/**
 * Lazily renders a generative work and shows it as a real <img>. While rendering
 * it shows a quiet placeholder; if rendering fails it falls back to a typographic
 * plate, so the layout never breaks.
 */
export function Artwork({ work, className = 'relative bg-char', eager = false, fit = 'cover' }: ArtworkProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    const start = () =>
      renderArtwork(work.id, work.style, work.seed, work.ratio, RENDER_WIDTH)
        .then((url) => !cancelled && setSrc(url))
        .catch(() => !cancelled && setFailed(true))

    if (eager || !('IntersectionObserver' in window)) {
      start()
      return () => {
        cancelled = true
      }
    }
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          io.disconnect()
          start()
        }
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => {
      cancelled = true
      io.disconnect()
    }
  }, [work, eager])

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      {!loaded && !failed && (
        <div aria-hidden="true" className="absolute inset-0 flex items-end p-4">
          <span className="label-sm text-dim">Developing {work.no}…</span>
          <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-transparent via-white/[0.02] to-transparent" />
        </div>
      )}
      {failed && (
        <div className="absolute inset-0 flex flex-col justify-between bg-char p-5" role="img" aria-label={`${work.title} (preview unavailable)`}>
          <span className="label-sm text-dim">No. {work.no} — preview unavailable</span>
          <span className="display text-[clamp(2rem,4vw,3.5rem)] text-dim">{work.title}</span>
        </div>
      )}
      {src && (
        <img
          src={src}
          alt={`${work.title} — ${work.medium.toLowerCase()}`}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          draggable={false}
          className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${fit === 'cover' ? 'object-cover' : 'object-contain'} ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
