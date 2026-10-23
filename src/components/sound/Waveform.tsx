import { useState, type CSSProperties, type PointerEvent } from 'react'
import { formatDuration } from '../../lib/format'

interface WaveformProps {
  peaks: number[]
  accent: string
  currentTime: number
  duration: number
  onSeek: (seconds: number) => void
  label: string
}

/**
 * Waveform scrubber. The bars are decoration; a transparent native range input
 * sits on top so dragging, clicking and keyboard seeking all work accessibly.
 */
export function Waveform({ peaks, accent, currentTime, duration, onSeek, label }: WaveformProps) {
  const known = Number.isFinite(duration) && duration > 0
  const progress = known ? Math.min(1, currentTime / duration) : 0
  const [hover, setHover] = useState<number | null>(null)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!known || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    setHover(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)))
  }

  return (
    <div
      className="group/wave relative h-16 has-[:focus-visible]:outline has-[:focus-visible]:outline-1 has-[:focus-visible]:outline-offset-4 has-[:focus-visible]:outline-acid"
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
      style={{ '--accent': accent } as CSSProperties}
    >
      <div aria-hidden="true" className="flex h-full items-center gap-px sm:gap-[2px]">
        {peaks.map((p, i) => {
          const pos = (i + 0.5) / peaks.length
          const played = pos <= progress
          const hovered = hover !== null && pos <= hover && !played
          return (
            <span
              key={i}
              className="min-w-0 flex-1 transition-colors duration-150"
              style={{
                height: `${Math.max(6, p * 100)}%`,
                background: played ? 'var(--accent)' : hovered ? 'rgba(241,240,232,0.45)' : 'rgba(241,240,232,0.16)',
              }}
            />
          )
        })}
      </div>
      {/* playhead */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 w-px bg-bone" style={{ left: `${progress * 100}%` }} />
      {hover !== null && (
        <span
          aria-hidden="true"
          className="label-sm pointer-events-none absolute -top-6 -translate-x-1/2 bg-bone px-1.5 py-0.5 text-ink tabular-nums"
          style={{ left: `${hover * 100}%` }}
        >
          {formatDuration(hover * duration)}
        </span>
      )}
      <input
        type="range"
        min={0}
        max={known ? duration : 1}
        step={0.1}
        value={known ? Math.min(currentTime, duration) : 0}
        disabled={!known}
        onChange={(e) => onSeek(Number(e.target.value))}
        onKeyDown={(e) => {
          // the fine step suits dragging; arrows jump 5s, PageUp/PageDown 15s
          const jump = ({ ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5, PageUp: 15, PageDown: -15 } as Record<string, number>)[e.key]
          if (jump === undefined || !known) return
          e.preventDefault()
          onSeek(currentTime + jump)
        }}
        aria-label={label}
        aria-valuetext={known ? `${formatDuration(currentTime)} of ${formatDuration(duration)}` : 'Duration not yet available'}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </div>
  )
}
