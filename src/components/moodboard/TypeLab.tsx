import { motion } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { TYPE_PAIRS, type FontSpec, type TypePair } from '../../data/typePairs'
import { useDialog } from '../../hooks/useDialog'
import type { Board } from '../../hooks/useStudio'
import { queueFont } from '../../lib/fonts'
import {
  DEFAULT_TYPE_STYLE,
  effectivePair,
  fontCss,
  LEADING_RANGE,
  legibilityNotes,
  TRACKING_RANGE,
  weightsOf,
  type PickedFonts,
  type TypeStyle,
} from '../../lib/typography'

type Mode = 'pair' | 'text' | 'display'

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'pair', label: 'Par completo', hint: 'Cambian titular y texto' },
  { id: 'text', label: 'Solo el texto', hint: 'El titular queda fijo' },
  { id: 'display', label: 'Solo el titular', hint: 'El texto queda fijo' },
]

const CATEGORIES = [...new Set(TYPE_PAIRS.map((p) => p.category))]

interface Option {
  key: string
  /** Pair the font comes from. */
  id: number
  sample: FontSpec
  name: string
  category: string
}

interface LabProps {
  board: Board
  /** The ranked pair («automático»). */
  auto: TypePair
  /** The pair as shown, Type Lab choices included. */
  pair: TypePair
  fontsReady: boolean | null
  tags: string[]
  notes: string
  onChange: (patch: { fonts?: PickedFonts | null; typeStyle?: TypeStyle }) => void
  onClose: () => void
}

/** A line of text in a font that loads only when the line comes into view. */
function FontSample({ spec, text, className }: { spec: FontSpec; text: string; className: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      queueFont(spec)
      io.disconnect()
    })
    io.observe(el)
    return () => io.disconnect()
  }, [spec])
  return (
    <span ref={ref} className={className} style={fontCss(spec)} aria-hidden="true">
      {text}
    </span>
  )
}

const excerpt = (text: string, max = 320) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(' ', max))}…`
}

const fmt = (n: number, digits: number) => n.toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })

/** The Type Lab: try pairs or single fonts on the board's own title and words, and fine-tune the headline. */
export function TypeLab({ board, auto, pair, fontsReady, tags, notes, onChange, onClose }: LabProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, true, onClose)
  const [mode, setMode] = useState<Mode>('pair')
  const [category, setCategory] = useState<string | null>(null)

  const style = board.typeStyle
  const current: PickedFonts = board.fonts ?? { display: auto.id, text: auto.id }
  // the headline as the pair has it, before the weight chosen here
  const base = effectivePair(auto, board.fonts, DEFAULT_TYPE_STYLE).display
  const weights = weightsOf(base)
  const shownWeight = pair.display.weight ?? 400
  const activeWeight = weights.includes(shownWeight) ? shownWeight : weights.reduce((a, w) => (Math.abs(w - shownWeight) < Math.abs(a - shownWeight) ? w : a), weights[0])
  const notesList = legibilityNotes(pair, style)

  const options = useMemo<Option[]>(() => {
    const inCategory = TYPE_PAIRS.filter((p) => !category || p.category === category)
    if (mode === 'pair') return inCategory.map((p) => ({ key: `p${p.id}`, id: p.id, sample: p.display, name: `${p.display.family} + ${p.text.family}`, category: p.category }))
    const seen = new Set<string>()
    const out: Option[] = []
    for (const p of inCategory) {
      const f = mode === 'text' ? p.text : p.display
      const k = f.family + (f.style?.fontStyle === 'italic' ? ' italic' : '')
      if (seen.has(k)) continue
      seen.add(k)
      out.push({ key: `${mode}${p.id}`, id: p.id, sample: f, name: f.family + (f.style?.fontStyle === 'italic' ? ' Itálica' : ''), category: p.category })
    }
    return out
  }, [mode, category])

  const isChosen = (o: Option) => {
    if (mode === 'pair') return current.display === o.id && current.text === o.id
    const shown = mode === 'text' ? pair.text : pair.display
    return shown.family === o.sample.family && (shown.style?.fontStyle ?? '') === (o.sample.style?.fontStyle ?? '')
  }

  const choose = (o: Option) => {
    if (mode === 'pair') onChange({ fonts: { display: o.id, text: o.id }, typeStyle: { ...style, weight: null } })
    else if (mode === 'text') onChange({ fonts: { display: current.display, text: o.id } })
    else onChange({ fonts: { display: o.id, text: current.text }, typeStyle: { ...style, weight: null } })
  }

  const setStyle = (patch: Partial<TypeStyle>) => onChange({ typeStyle: { ...style, ...patch } })

  const display: CSSProperties = { ...fontCss(pair.display), letterSpacing: `${style.tracking}em` }
  const title: CSSProperties = { ...display, textTransform: style.uppercase ? 'uppercase' : 'none' }
  const text: CSSProperties = { ...fontCss(pair.text), lineHeight: style.leading }
  const sampleText = mode === 'text' ? excerpt(notes, 60) : board.title || 'Título'
  const manual = board.fonts !== null || JSON.stringify(style) !== JSON.stringify(DEFAULT_TYPE_STYLE)

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="typelab-title"
      className="fixed inset-0 z-[80] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="typelab-title" className="display text-[1.75rem] leading-none text-bone">
            Type Lab
          </h2>
          <p className="label-sm truncate text-dim">Los cambios se ven en el tablero al instante</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            data-autofocus
            className="btn-fill inline-flex h-10 items-center bg-acid px-4 text-ink [--fill-color:var(--color-bone)]"
          >
            <span className="label">Listo</span>
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center text-mute hover:text-bone">
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
        {/* preview, with the board's own words */}
        <section aria-label="Vista previa" className="thin-scroll border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:p-10">
          <div className="border border-line bg-[#0c0c0b] p-5 sm:p-8">
            <p className="label-sm text-dim">
              Titular · {pair.display.family}
              {pair.display.style?.fontStyle === 'italic' && ' Itálica'} · {pair.display.weight ?? 400}
            </p>
            <p className="mt-3 text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] break-words text-bone" style={title}>
              {board.title || 'Título'}
            </p>
            {tags.length > 0 && (
              <p className="mt-4 text-[clamp(1.1rem,2.4vw,1.75rem)] leading-tight text-mute" style={display}>
                {tags.join(' / ')}
              </p>
            )}
            <p className="label-sm mt-8 text-dim">Texto · {pair.text.family}</p>
            <p className="mt-3 max-w-prose text-base text-bone/85" style={text}>
              {excerpt(notes)}
            </p>
            <div className="mt-8 border-t border-line pt-4">
              <p className="label-sm text-dim">En tamaño chico</p>
              <p className="mt-2 text-sm text-bone" style={title}>
                {board.title || 'Título'}
              </p>
              <p className="mt-1 text-xs text-mute" style={text}>
                {excerpt(notes, 140)}
              </p>
            </div>
          </div>
          <div aria-live="polite" className="mt-4 space-y-2">
            {fontsReady === false && <p className="label-sm text-alarm">No se pudieron cargar las fuentes: ves una aproximación.</p>}
            {notesList.map((n) => (
              <p key={n} className="flex gap-2 text-sm leading-snug text-mute">
                <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 bg-mute" />
                {n}
              </p>
            ))}
          </div>
        </section>

        {/* controls */}
        <div className="thin-scroll border-t border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-t-0 lg:p-10">
          <fieldset>
            <legend className="label text-bone">Ajustes del titular y el texto</legend>
            <div className="mt-4 space-y-5">
              <div>
                <p id="weight-label" className="label-sm text-dim">
                  Peso del titular
                </p>
                {weights.length > 1 ? (
                  <div role="radiogroup" aria-labelledby="weight-label" className="mt-2 flex flex-wrap gap-1">
                    {weights.map((w) => (
                      <button
                        key={w}
                        type="button"
                        role="radio"
                        aria-checked={w === activeWeight}
                        onClick={() => setStyle({ weight: w })}
                        className={`label h-10 min-w-12 border px-2 tabular-nums transition-colors ${w === activeWeight ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-mute">{base.family} tiene un solo peso.</p>
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
                  onChange={(e) => setStyle({ tracking: Number(e.target.value) })}
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
                  onChange={(e) => setStyle({ leading: Number(e.target.value) })}
                  className="mt-2 w-full accent-[var(--color-acid)]"
                />
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={style.uppercase}
                onClick={() => setStyle({ uppercase: !style.uppercase })}
                className="flex w-full items-center justify-between gap-4 py-1 text-left"
              >
                <span className="text-sm text-bone">Título en mayúsculas</span>
                <span aria-hidden="true" className={`relative h-6 w-11 shrink-0 border transition-colors ${style.uppercase ? 'border-acid bg-acid' : 'border-line bg-char'}`}>
                  <span className={`absolute top-0.5 size-4 transition-[left] ${style.uppercase ? 'left-[1.375rem] bg-ink' : 'left-0.5 bg-mute'}`} />
                </span>
              </button>
            </div>
          </fieldset>

          <div className="mt-10 border-t border-line pt-6">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p id="mode-label" className="label text-bone">
                Fuentes
              </p>
              {manual && (
                <button
                  type="button"
                  onClick={() => onChange({ fonts: null, typeStyle: DEFAULT_TYPE_STYLE })}
                  className="label-sm inline-flex h-8 items-center gap-1.5 text-mute hover:text-bone"
                >
                  <RotateCcw className="size-3" aria-hidden="true" /> Volver al par automático
                </button>
              )}
            </div>
            <div role="radiogroup" aria-labelledby="mode-label" className="mt-3 grid border border-line sm:grid-cols-3">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex flex-col items-start gap-0.5 px-2.5 py-2 text-left transition-colors sm:px-3 ${mode === m.id ? 'bg-bone text-ink' : 'text-mute hover:text-bone'}`}
                >
                  <span className="label">{m.label}</span>
                  <span className={`label-sm normal-case tracking-normal ${mode === m.id ? 'text-ink/70' : 'text-dim'}`}>{m.hint}</span>
                </button>
              ))}
            </div>

            <div role="radiogroup" aria-label="Estilo" className="mt-4 flex flex-wrap gap-1">
              {[null, ...CATEGORIES].map((c) => (
                <button
                  key={c ?? 'all'}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={`label-sm h-8 border px-2.5 transition-colors ${category === c ? 'border-bone text-bone' : 'border-line text-dim hover:text-bone'}`}
                >
                  {c ?? 'Todos'}
                </button>
              ))}
            </div>

            <div role="radiogroup" aria-label={mode === 'pair' ? 'Pares tipográficos' : mode === 'text' ? 'Fuentes de texto' : 'Fuentes de titular'} className="mt-4 divide-y divide-line-soft border-y border-line">
              {options.map((o) => {
                const on = isChosen(o)
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${o.name}, ${o.category}`}
                    onClick={() => choose(o)}
                    className={`group flex w-full items-center gap-4 px-2 py-3 text-left transition-colors ${on ? 'bg-char' : 'hover:bg-char/60'}`}
                  >
                    <span className={`size-2 shrink-0 ${on ? 'bg-acid' : 'bg-line'}`} aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <FontSample spec={o.sample} text={sampleText} className={`block truncate text-bone ${mode === 'text' ? 'text-base' : 'text-2xl leading-tight'}`} />
                      <span className="label-sm mt-1 block truncate text-dim">
                        {o.name} · {o.category}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
