import { useId } from 'react'
import type { FontSpec } from '../../data/typePairs'
import { LEADING_RANGE, TRACKING_RANGE, weightsOf, type TypeStyle } from '../../lib/typography'

const fmt = (n: number, digits: number) => n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

const SIZE_RANGE: [number, number] = [24, 128]

interface Props {
  style: TypeStyle
  onStyle: (patch: Partial<TypeStyle>) => void
  /** The headline as its pair has it, before the weight chosen here. */
  font: FontSpec
  /** The weight the headline shows now. */
  shownWeight: number
  /** Headline size in px (only where there's a size to choose: Explorar). */
  size?: number
  onSize?: (px: number) => void
}

/** The Type Lab's adjustments: size (optional), headline weight, tracking, leading and capitals. */
export function TypeControls({ style, onStyle, font, shownWeight, size, onSize }: Props) {
  const id = useId()
  const weights = weightsOf(font)
  const activeWeight = weights.includes(shownWeight) ? shownWeight : weights.reduce((a, w) => (Math.abs(w - shownWeight) < Math.abs(a - shownWeight) ? w : a), weights[0])

  return (
    <fieldset>
      <legend className="label text-bone">Ajustes del titular y el texto</legend>
      <div className="mt-4 space-y-5">
        {size !== undefined && onSize && (
          <label className="block">
            <span className="label-sm flex justify-between text-dim">
              Tamaño del titular <output className="tabular-nums text-mute">{size} px</output>
            </span>
            <input
              type="range"
              min={SIZE_RANGE[0]}
              max={SIZE_RANGE[1]}
              step={2}
              value={size}
              aria-label="Tamaño del titular"
              aria-valuetext={`${size} px`}
              onChange={(e) => onSize(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--color-acid)]"
            />
          </label>
        )}
        <div>
          <p id={`${id}-weight`} className="label-sm text-dim">
            Peso del titular
          </p>
          {weights.length > 1 ? (
            <div role="radiogroup" aria-labelledby={`${id}-weight`} className="mt-2 flex flex-wrap gap-1">
              {weights.map((w) => (
                <button
                  key={w}
                  type="button"
                  role="radio"
                  aria-checked={w === activeWeight}
                  onClick={() => onStyle({ weight: w })}
                  className={`label h-10 min-w-12 border px-2 tabular-nums transition-colors ${w === activeWeight ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
                >
                  {w}
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-mute">{font.family} tiene un solo peso.</p>
          )}
        </div>
        <label className="block">
          <span className="label-sm flex justify-between text-dim">
            Espaciado del titular <output className="tabular-nums text-mute">{fmt(style.tracking, 3)} em</output>
          </span>
          <input
            type="range"
            min={TRACKING_RANGE[0]}
            max={TRACKING_RANGE[1]}
            step={0.005}
            value={style.tracking}
            aria-label="Espaciado del titular"
            aria-valuetext={`${fmt(style.tracking, 3)} em`}
            onChange={(e) => onStyle({ tracking: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--color-acid)]"
          />
        </label>
        <label className="block">
          <span className="label-sm flex justify-between text-dim">
            Interlineado del texto <output className="tabular-nums text-mute">{fmt(style.leading, 2)}</output>
          </span>
          <input
            type="range"
            min={LEADING_RANGE[0]}
            max={LEADING_RANGE[1]}
            step={0.05}
            value={style.leading}
            aria-label="Interlineado del texto"
            aria-valuetext={fmt(style.leading, 2)}
            onChange={(e) => onStyle({ leading: Number(e.target.value) })}
            className="mt-2 w-full accent-[var(--color-acid)]"
          />
        </label>
        <button
          type="button"
          role="switch"
          aria-checked={style.uppercase}
          onClick={() => onStyle({ uppercase: !style.uppercase })}
          className="flex w-full items-center justify-between gap-4 py-1 text-left"
        >
          <span className="text-sm text-bone">Título en mayúsculas</span>
          <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 border transition-colors ${style.uppercase ? 'border-acid bg-acid' : 'border-line bg-char'}`}>
            <span className={`absolute top-0.5 size-4 transition-[left] ${style.uppercase ? 'left-[1.375rem] bg-ink' : 'left-0.5 bg-mute'}`} />
          </span>
        </button>
      </div>
    </fieldset>
  )
}
