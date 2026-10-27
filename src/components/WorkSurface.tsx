import type { CSSProperties, ReactNode } from 'react'
import type { Surface } from '../hooks/useSurface'

/**
 * The work table of the labs: the area where samples are tried sits on a sheet
 * of grid paper (or a neutral grey, or black), while the rest of the panel
 * stays dark, like a sheet resting on the desk. Shared by the Type Lab and the
 * Color Lab. Inside, use the `--sheet-*` colours so ink reads on any surface.
 */
const SURFACES: { id: Surface; label: string }[] = [
  { id: 'paper', label: 'Hoja' },
  { id: 'gray', label: 'Gris neutro' },
  { id: 'black', label: 'Negro' },
]

const grid = (fine: string, strong: string) => ({
  backgroundImage: [
    `linear-gradient(${strong} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${strong} 1px, transparent 1px)`,
    `linear-gradient(${fine} 1px, transparent 1px)`,
    `linear-gradient(90deg, ${fine} 1px, transparent 1px)`,
  ].join(', '),
  backgroundSize: '64px 64px, 64px 64px, 8px 8px, 8px 8px',
})

/** Ink checked against each surface: text and secondary text ≥ 4.5:1 on all three (on grey only full ink passes). */
const LOOK: Record<Surface, CSSProperties> = {
  paper: {
    backgroundColor: '#FAFAF7',
    ...grid('rgba(9, 9, 9, 0.045)', 'rgba(9, 9, 9, 0.11)'),
    '--sheet-ink': '#090909',
    '--sheet-mute': '#4a4945',
    '--sheet-line': 'rgba(9, 9, 9, 0.16)',
  } as CSSProperties,
  gray: {
    backgroundColor: '#808080',
    ...grid('rgba(9, 9, 9, 0.06)', 'rgba(9, 9, 9, 0.14)'),
    '--sheet-ink': '#090909',
    '--sheet-mute': '#090909',
    '--sheet-line': 'rgba(9, 9, 9, 0.25)',
  } as CSSProperties,
  black: {
    backgroundColor: '#090909',
    ...grid('rgba(241, 240, 232, 0.035)', 'rgba(241, 240, 232, 0.08)'),
    '--sheet-ink': '#F1F0E8',
    '--sheet-mute': '#a3a29b',
    '--sheet-line': 'rgba(241, 240, 232, 0.16)',
  } as CSSProperties,
}

/** Small «Mesa» switch; dark pill so it reads on any surface. */
export function SurfacePicker({ value, onChange }: { value: Surface; onChange: (s: Surface) => void }) {
  return (
    <div role="radiogroup" aria-label="Mesa de trabajo" className="inline-flex items-center gap-0.5 border border-line bg-ink/90 p-0.5 backdrop-blur-sm">
      <span className="label-sm px-2 text-dim" aria-hidden="true">
        Mesa
      </span>
      {SURFACES.map((s) => (
        <button
          key={s.id}
          type="button"
          role="radio"
          aria-checked={value === s.id}
          onClick={() => onChange(s.id)}
          className={`label-sm h-8 px-2.5 transition-colors ${value === s.id ? 'bg-bone text-ink' : 'text-mute hover:text-bone'}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  )
}

/** The sheet itself. */
export function WorkSurface({ surface, className = '', children, label }: { surface: Surface; className?: string; children: ReactNode; label?: string }) {
  return (
    <section aria-label={label} data-surface={surface} className={`text-[var(--sheet-ink)] ${className}`} style={LOOK[surface]}>
      {children}
    </section>
  )
}
