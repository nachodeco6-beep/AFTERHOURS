import { motion } from 'framer-motion'
import { RotateCcw, X } from 'lucide-react'
import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { TYPE_PAIRS, type FontSpec, type TypePair } from '../../data/typePairs'
import { useDialog } from '../../hooks/useDialog'
import type { Board } from '../../hooks/useStudio'
import { useSurface } from '../../hooks/useSurface'
import { SurfacePicker, WorkSurface } from '../WorkSurface'
import { DEFAULT_TYPE_STYLE, effectivePair, fontCss, legibilityNotes, type PickedFonts, type TypeStyle } from '../../lib/typography'
import { FontSample } from './FontSample'
import { TypeControls } from './TypeControls'

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
  /** Inside a page («Con mi tablero») instead of a dialog over everything. */
  embedded?: boolean
}

const excerpt = (text: string, max = 320) => {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, flat.lastIndexOf(' ', max))}…`
}

/** The Type Lab: try pairs or single fonts on the board's own title and words, and fine-tune the headline. */
export function TypeLab({ board, auto, pair, fontsReady, tags, notes, onChange, onClose, embedded = false }: LabProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, !embedded, onClose)
  const [mode, setMode] = useState<Mode>('pair')
  const [category, setCategory] = useState<string | null>(null)
  const [surface, setSurface] = useSurface()

  const style = board.typeStyle
  const current: PickedFonts = board.fonts ?? { display: auto.id, text: auto.id }
  // the headline as the pair has it, before the weight chosen here
  const base = effectivePair(auto, board.fonts, DEFAULT_TYPE_STYLE).display
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

  const body = (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-hidden">
      {/* preview, with the board's own words, on the work table */}
      <div className="flex min-h-0 flex-col border-line lg:border-r">
        <WorkSurface surface={surface} label="Vista previa" className="thin-scroll relative flex-1 p-4 sm:p-6 lg:overflow-y-auto lg:p-10">
          <div className="mb-6 flex justify-end">
            <SurfacePicker value={surface} onChange={setSurface} />
          </div>
          <p className="label-sm text-[var(--sheet-mute)]">
            Titular · {pair.display.family}
            {pair.display.style?.fontStyle === 'italic' && ' Itálica'} · {pair.display.weight ?? 400}
          </p>
          <p className="mt-3 text-[clamp(2.25rem,6vw,5rem)] leading-[0.95] break-words" style={title}>
            {board.title || 'Título'}
          </p>
          {tags.length > 0 && (
            <p className="mt-4 text-[clamp(1.1rem,2.4vw,1.75rem)] leading-tight text-[var(--sheet-mute)]" style={display}>
              {tags.join(' / ')}
            </p>
          )}
          <p className="label-sm mt-8 text-[var(--sheet-mute)]">Texto · {pair.text.family}</p>
          <p className="mt-3 max-w-prose text-base" style={text}>
            {excerpt(notes)}
          </p>
          <div className="mt-8 max-w-prose border-t border-[var(--sheet-line)] pt-4">
            <p className="label-sm text-[var(--sheet-mute)]">En tamaño chico</p>
            <p className="mt-2 text-sm" style={title}>
              {board.title || 'Título'}
            </p>
            <p className="mt-1 text-xs text-[var(--sheet-mute)]" style={text}>
              {excerpt(notes, 140)}
            </p>
          </div>
        </WorkSurface>
        <div aria-live="polite" className="space-y-2 border-t border-line p-4 empty:hidden sm:px-6 lg:px-10">
          {fontsReady === false && <p className="label-sm text-alarm">No se pudieron cargar las fuentes: ves una aproximación.</p>}
          {notesList.map((n) => (
            <p key={n} className="flex gap-2 text-sm leading-snug text-mute">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 bg-mute" />
              {n}
            </p>
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="thin-scroll border-t border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-t-0 lg:p-10">
        <TypeControls style={style} onStyle={setStyle} font={base} shownWeight={pair.display.weight ?? 400} />

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

          <div
            role="radiogroup"
            aria-label={mode === 'pair' ? 'Pares tipográficos' : mode === 'text' ? 'Fuentes de texto' : 'Fuentes de titular'}
            className="mt-4 divide-y divide-line-soft border-y border-line"
          >
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
  )

  if (embedded)
    return (
      <div ref={ref} className="flex flex-col border border-line lg:h-[min(60rem,calc(100dvh-8rem))]">
        {body}
      </div>
    )

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
          <button type="button" onClick={onClose} data-autofocus className="btn-fill inline-flex h-10 items-center bg-acid px-4 text-ink [--fill-color:var(--color-bone)]">
            <span className="label">Listo</span>
          </button>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center text-mute hover:text-bone">
            <X className="size-5" strokeWidth={1.25} aria-hidden="true" />
          </button>
        </div>
      </div>

      {body}
    </motion.div>
  )
}
