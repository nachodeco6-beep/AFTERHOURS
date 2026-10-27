import { ArrowUpRight, Check, Copy } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { TypePair } from '../../data/typePairs'
import { hexToRgb, luminance } from '../../lib/color'
import type { PaletteResult } from '../../lib/paletteImage'
import { fontCss, specimenUrl, type TypeStyle } from '../../lib/typography'

/** Every block fills its cell of the canvas (fixed size, the same on every screen). */
const BLOCK = 'relative flex h-full min-h-0 w-full flex-col overflow-hidden [container-type:size]'

const BlockLabel = ({ children }: { children: ReactNode }) => <p className="label-sm text-dim">{children}</p>

// ─── Palette ────────────────────────────────────────────────────────────────

function Swatch({ hex, onCopied }: { hex: string; onCopied: (hex: string | null) => void }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number>(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const rgb = hexToRgb(hex)
  const light = rgb ? luminance(rgb) > 0.4 : false

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      onCopied(hex)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch {
      onCopied(null)
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copiar el color ${hex}`}
      className={`group/sw relative flex min-h-12 min-w-0 flex-1 items-end p-2 text-left focus-visible:z-10 focus-visible:outline-offset-[-3px] ${light ? 'text-ink' : 'text-bone'}`}
      style={{ backgroundColor: hex }}
    >
      <span className="label-sm flex items-center gap-1 tabular-nums">
        {copied ? <Check className="size-3" strokeWidth={2.5} aria-hidden="true" /> : <Copy className="size-3 opacity-0 transition-opacity group-hover/sw:opacity-70 group-focus-visible/sw:opacity-70" strokeWidth={2} aria-hidden="true" />}
        {/* a small palette keeps the colours and drops the codes (still in the button's label) */}
        <span className="[@container(max-width:340px)]:hidden">{copied ? 'Copiado' : hex}</span>
      </span>
    </button>
  )
}

export function PaletteBlock({ palette, loading, vertical }: { palette: PaletteResult | null; loading: boolean; vertical: boolean }) {
  const [announce, setAnnounce] = useState('')
  return (
    <div className={`${BLOCK} gap-2 bg-char p-3`}>
      <div className="flex items-baseline justify-between gap-2">
        <BlockLabel>Paleta</BlockLabel>
        {palette?.source === 'unsplash' && <p className="label-sm text-mute">Aproximada · colores de Unsplash</p>}
      </div>
      {loading || !palette ? (
        <p className="label-sm flex flex-1 items-center gap-2 text-mute">
          <span aria-hidden="true" className="size-2 animate-pulse bg-acid" /> Leyendo colores…
        </p>
      ) : (
        <div className={`flex min-h-0 flex-1 ${vertical ? 'flex-col' : 'flex-row'}`} role="group" aria-label="Colores de la paleta">
          {palette.colors.map((hex) => (
            <Swatch key={hex} hex={hex} onCopied={(h) => setAnnounce(h ? `Copiado ${h}` : 'No se pudo copiar el color')} />
          ))}
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>
    </div>
  )
}

// ─── Type ───────────────────────────────────────────────────────────────────

export function TypeBlock({ pair, fontsReady, style, onOpenLab }: { pair: TypePair; fontsReady: boolean | null; style: TypeStyle; onOpenLab?: () => void }) {
  const display: CSSProperties = { ...fontCss(pair.display), letterSpacing: `${style.tracking}em` }
  const text: CSSProperties = { ...fontCss(pair.text), lineHeight: style.leading }
  return (
    <div className={`${BLOCK} justify-between gap-3 border border-line p-4`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="label-sm min-w-0 truncate text-dim">Tipografía · {pair.category}</p>
        {onOpenLab && (
          <button type="button" onClick={onOpenLab} data-ui className="label-sm inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-mute hover:text-acid">
            Type Lab <ArrowUpRight className="size-3" aria-hidden="true" />
          </button>
        )}
      </div>
      <p className="text-[clamp(2.5rem,32cqmin,9rem)] leading-[0.95] text-bone" style={display} aria-hidden="true">
        Aa
      </p>
      <div className="space-y-3">
        {/* in a low cell the sample paragraph gives way to the font names */}
        <p className="text-[clamp(0.8rem,5.5cqi,1.05rem)] text-mute [@container(max-height:250px)]:hidden" style={text}>
          Las fotos marcan el clima; la tipografía pone la voz. Este párrafo usa la fuente de texto del par.
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t border-line pt-3">
          <dt className="label-sm text-dim">Titular</dt>
          <dd className="min-w-0 truncate text-sm text-bone">
            <a href={specimenUrl(pair.display)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-acid">
              {pair.display.family}
              {pair.display.style?.fontStyle === 'italic' && ' Itálica'}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </dd>
          <dt className="label-sm text-dim">Texto</dt>
          <dd className="min-w-0 truncate text-sm text-bone">
            <a href={specimenUrl(pair.text)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-acid">
              {pair.text.family}
              <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          </dd>
        </dl>
        {fontsReady === false && <p className="label-sm text-alarm">No se pudieron cargar las fuentes: ves una aproximación.</p>}
      </div>
    </div>
  )
}

// ─── Keywords ───────────────────────────────────────────────────────────────

export function KeywordsBlock({ tags }: { tags: string[] }) {
  return (
    <div className={`${BLOCK} justify-between gap-3 border border-line bg-char p-4`}>
      {/* the acid stays a small detail: it's the interface's colour, it shouldn't compete with the photos */}
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="h-px w-6 bg-acid" />
        <p className="label-sm text-acid">Palabras clave</p>
      </div>
      <ul className="display flex flex-wrap gap-x-[0.35em] gap-y-[0.12em] text-[clamp(1.4rem,12cqmin,3.5rem)] leading-[1.05] text-bone">
        {tags.map((t, i) => (
          <li key={t}>
            {t}
            {i < tags.length - 1 && <span className="text-dim"> /</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Notes ──────────────────────────────────────────────────────────────────

export function NotesBlock({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className={`${BLOCK} gap-2 border border-line p-4`}>
      <label htmlFor="board-notes" className="label-sm text-dim">
        Notas de dirección de arte
      </label>
      <textarea
        id="board-notes"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="thin-scroll min-h-0 w-full flex-1 resize-none bg-transparent font-serif text-[clamp(0.95rem,6cqi,1.2rem)] leading-snug text-bone outline-none focus-visible:shadow-[inset_2px_0_0_var(--color-acid)]"
      />
    </div>
  )
}
