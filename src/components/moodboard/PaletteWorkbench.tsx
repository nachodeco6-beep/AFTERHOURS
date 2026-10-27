import { Check, Lock, Minus, Plus, Shuffle, Unlock, Wand2, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { TypePair } from '../../data/typePairs'
import { useSurface } from '../../hooks/useSurface'
import { hexToRgb, rgbToHex } from '../../lib/color'
import {
  adjustText,
  contrastRatio,
  formatRatio,
  inkOn,
  MAX_COLORS,
  MIN_COLORS,
  ROLE_LABEL,
  ROLES,
  roleIndex,
  setRole,
  toAse,
  toCss,
  toHexList,
  toTokens,
  wcag,
  type LabColor,
  type Role,
} from '../../lib/colorLab'
import { fontCss, type TypeStyle } from '../../lib/typography'
import { SurfacePicker, WorkSurface } from '../WorkSurface'

type ExportKind = 'hex' | 'css' | 'json' | 'ase'

/** Pass / fail, in words (never colour alone). */
function Verdict({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`label-sm inline-flex items-center gap-1 border px-1.5 py-0.5 ${ok ? 'border-bone/40 text-bone' : 'border-alarm/60 text-alarm'}`}>
      {ok ? <Check className="size-3" aria-hidden="true" /> : <X className="size-3" aria-hidden="true" />}
      {label} {ok ? 'pasa' : 'no pasa'}
    </span>
  )
}

export const toolButton =
  'label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone transition-colors hover:border-bone disabled:opacity-40 disabled:hover:border-line'

export interface WorkbenchProps {
  colors: LabColor[]
  onColors: (next: LabColor[]) => void
  /** Preview: its title, fonts and adjustments. */
  title: string
  pair: TypePair
  typeStyle: TypeStyle
  /** Name of the .ase file, without extension. */
  fileName: string
  /** Screen-reader (and sometimes visible) messages; the owner keeps them. */
  notice: string
  say: (text: string) => void
  /** Next to «N colores» on the sheet (e.g. «aproximados»). */
  countNote?: ReactNode
  /** Above the swatches, on the sheet: the lab's own actions. */
  toolbar?: ReactNode
  /** Under the swatches, on the sheet; `shown` is the colour hovered or being edited. */
  source?: (shown: number | null) => ReactNode
  /** Takes the preview's place while it returns something (e.g. the eyedropper). */
  replacePreview?: (editing: number | null, setHex: (i: number, hex: string, photoId?: string | null) => void) => ReactNode
  /** Extra tools in the colour editor (e.g. «Tomar de una foto»). */
  editTools?: (i: number) => ReactNode
  /** «Un color más» / «Un color menos»; `canGrow` false = disabled (and `cantGrowNote` says why). */
  onGrow: () => void
  onShrink: () => void
  canGrow: boolean
  cantGrowNote?: string
  onRegenerate: () => void
  regenerateLabel: string
  regenerateDisabled?: boolean
  /** What «Regenerar» does, in a line. */
  regenerateHint: ReactNode
  /** Under the palette tools (e.g. «Volver a la paleta automática»). */
  paletteExtra?: ReactNode
}

/**
 * The Color Lab's workbench, shared by «Con mi tablero» and «Explorar»: the
 * swatches on the work table (locks, roles, editing), contrast with «Ajustar»,
 * the preview and export. Where colours come from is up to its owner.
 */
export function PaletteWorkbench(props: WorkbenchProps) {
  const { colors, onColors, title, pair, typeStyle, fileName, notice, say } = props
  const [surface, setSurface] = useSurface()
  const [hover, setHover] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  // the HEX being typed, for the colour it was started on
  const [draft, setDraft] = useState<{ for: string; value: string } | null>(null)
  const [copied, setCopied] = useState<ExportKind | null>(null)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const edited = editing !== null && editing < colors.length ? editing : null
  const hexDraft = edited !== null && draft?.for === colors[edited].hex ? draft.value : edited !== null ? colors[edited].hex : ''

  const setHex = (i: number, hex: string, photoId: string | null = null) => onColors(colors.map((c, k) => (k === i ? { ...c, hex: hex.toUpperCase(), photoId } : c)))
  const startEdit = (i: number) => {
    setEditing(i)
    setDraft(null)
  }
  const commitDraft = () => {
    if (edited === null) return
    const rgb = hexToRgb(hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`)
    if (rgb) setHex(edited, rgbToHex(rgb))
    setDraft(null)
  }

  // ── roles and contrast
  const at = (role: Role) => {
    const i = roleIndex(colors, role)
    return i >= 0 ? colors[i].hex : null
  }
  const bg = at('fondo')
  const text = at('texto')
  const accent = at('acento')
  const secondary = at('secundario')
  const pairs = [
    { key: 'texto', label: 'Texto sobre Fondo', fg: text, adjustable: true },
    { key: 'acento', label: 'Acento sobre Fondo', fg: accent, adjustable: false },
  ] as const

  const adjust = () => {
    if (!bg || !text) return
    const r = adjustText(text, bg)
    const i = roleIndex(colors, 'texto')
    if (!r.changed || i < 0) return
    onColors(colors.map((c, k) => (k === i ? { ...c, hex: r.hex, photoId: null } : c)))
    say(`Ajusté el Texto de ${text} a ${r.hex} para llegar a AA (${formatRatio(r.ratio)}).`)
  }

  // ── export
  const flash = (kind: ExportKind) => {
    setCopied(kind)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 1600)
  }
  const copy = async (kind: Exclude<ExportKind, 'ase'>) => {
    const content = kind === 'hex' ? toHexList(colors) : kind === 'css' ? toCss(colors) : toTokens(colors)
    try {
      await navigator.clipboard.writeText(content)
      flash(kind)
      say(kind === 'hex' ? 'Copiado: lista de HEX.' : kind === 'css' ? 'Copiado: variables CSS.' : 'Copiado: tokens en JSON.')
    } catch {
      say('No se pudo copiar: el navegador no dio permiso.')
    }
  }
  const download = () => {
    const blob = new Blob([toAse(colors) as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${
      (fileName || 'paleta')
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñü]+/gi, '-')
        .replace(/^-|-$/g, '') || 'paleta'
    }.ase`
    a.click()
    URL.revokeObjectURL(url)
    flash('ase')
    say('Descargado: muestras .ase para Adobe.')
  }

  const shown = hover ?? edited
  const titleCss: CSSProperties = { ...fontCss(pair.display), letterSpacing: `${typeStyle.tracking}em`, textTransform: typeStyle.uppercase ? 'uppercase' : 'none' }
  const bodyCss: CSSProperties = { ...fontCss(pair.text), lineHeight: typeStyle.leading }
  const card = { bg: bg ?? colors[0]?.hex ?? '#FAFAF7', fg: text ?? inkOn(bg ?? colors[0]?.hex ?? '#FAFAF7') }
  const replaced = props.replacePreview?.(edited, setHex)

  return (
    <div className="thin-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:overflow-hidden">
      {/* the work table: swatches, where they come from, preview */}
      <WorkSurface surface={surface} label="Paleta" className="thin-scroll border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:p-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <p className="label text-[var(--sheet-ink)]">
            {colors.length} colores{props.countNote}
          </p>
          <SurfacePicker value={surface} onChange={setSurface} />
        </div>
        {props.toolbar}

        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Colores">
          {colors.map((c, i) => (
            <li key={i} className="flex min-w-0 flex-col gap-1.5">
              <button
                type="button"
                onClick={() => startEdit(i)}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Color ${i + 1}: ${c.hex}${c.role ? `, ${ROLE_LABEL[c.role]}` : ''}${c.locked ? ', bloqueado' : ''}. Editar`}
                aria-pressed={edited === i}
                className="relative h-20 w-full border border-[var(--sheet-line)] sm:h-24"
                style={{ backgroundColor: c.hex, ...(edited === i ? { outline: '2px solid var(--sheet-ink)', outlineOffset: 3 } : {}) }}
              >
                {c.role && (
                  <span className="label-sm absolute top-1.5 left-1.5 px-1" style={{ color: inkOn(c.hex), backgroundColor: 'transparent' }}>
                    {ROLE_LABEL[c.role]}
                  </span>
                )}
                {c.locked && <Lock className="absolute top-1.5 right-1.5 size-3.5" style={{ color: inkOn(c.hex) }} aria-hidden="true" />}
              </button>
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-xs tabular-nums">{c.hex}</span>
                <button
                  type="button"
                  onClick={() => onColors(colors.map((x, k) => (k === i ? { ...x, locked: !x.locked } : x)))}
                  aria-pressed={c.locked}
                  aria-label={`${c.locked ? 'Desbloquear' : 'Bloquear'} el color ${i + 1}`}
                  title={c.locked ? 'Desbloquear' : 'Bloquear'}
                  className={`grid size-8 shrink-0 place-items-center border ${c.locked ? 'border-[var(--sheet-ink)] bg-[var(--sheet-ink)]' : 'border-[var(--sheet-line)] hover:border-[var(--sheet-ink)]'}`}
                >
                  {c.locked ? (
                    <Lock className="size-3.5" style={{ color: surface === 'black' ? '#090909' : '#FAFAF7' }} aria-hidden="true" />
                  ) : (
                    <Unlock className="size-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
              <select
                value={c.role ?? ''}
                onChange={(e) => onColors(setRole(colors, i, (e.target.value || null) as Role | null))}
                aria-label={`Rol del color ${i + 1}`}
                className="h-8 w-full border border-[var(--sheet-line)] bg-transparent px-1 text-xs text-[var(--sheet-ink)]"
              >
                <option value="">Sin rol</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>

        {props.source?.(shown)}

        <div className="mt-8 border-t border-[var(--sheet-line)] pt-6">
          {replaced ?? (
            <>
              <p className="label-sm text-[var(--sheet-mute)]">Así se ve aplicada</p>
              <div
                className="mt-3 max-w-lg border border-[var(--sheet-line)] p-6 sm:p-8"
                style={{ backgroundColor: card.bg, color: card.fg }}
                aria-label="Vista previa de la paleta"
              >
                {secondary && <span aria-hidden="true" className="block h-1 w-12" style={{ backgroundColor: secondary }} />}
                <p className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95] break-words" style={titleCss}>
                  {title || 'Título'}
                </p>
                <p className="mt-3 max-w-prose text-sm" style={bodyCss}>
                  Fondo, titular y texto con los colores de la paleta, y un botón en el color de acento.
                </p>
                {accent && (
                  <span
                    className="label mt-5 inline-flex h-10 items-center px-4"
                    style={{ backgroundColor: accent, color: inkOn(accent, [card.bg, card.fg, '#090909', '#F1F0E8']) }}
                  >
                    Ver el proyecto
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </WorkSurface>

      {/* controls */}
      <div className="thin-scroll space-y-8 border-t border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-t-0 lg:p-10">
        {edited !== null && (
          <section aria-labelledby="edit-title" className="border border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 id="edit-title" className="label text-bone">
                Color {edited + 1}
              </h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Cerrar la edición del color" className="grid size-8 place-items-center text-mute hover:text-bone">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="block">
                <span className="label-sm text-dim">HEX</span>
                <input
                  value={hexDraft}
                  onChange={(e) => setDraft({ for: colors[edited].hex, value: e.target.value.toUpperCase() })}
                  onBlur={commitDraft}
                  onKeyDown={(e) => e.key === 'Enter' && commitDraft()}
                  maxLength={7}
                  spellCheck={false}
                  className="mt-1 block h-10 w-28 border border-line bg-transparent px-2 font-mono text-sm text-bone uppercase outline-none focus-visible:border-acid"
                />
              </label>
              <label className="block">
                <span className="label-sm text-dim">Selector</span>
                <input
                  type="color"
                  value={colors[edited].hex.toLowerCase()}
                  onChange={(e) => setHex(edited, e.target.value)}
                  className="mt-1 block h-10 w-16 cursor-pointer border border-line bg-transparent p-0.5"
                />
              </label>
              {props.editTools?.(edited)}
            </div>
          </section>
        )}

        <section aria-labelledby="palette-tools" className="space-y-4">
          <h3 id="palette-tools" className="label text-bone">
            Paleta
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Cantidad de colores" className="inline-flex items-center border border-line">
              <button
                type="button"
                onClick={props.onShrink}
                disabled={colors.length <= MIN_COLORS}
                aria-label="Un color menos"
                className="grid size-10 place-items-center text-bone disabled:opacity-30"
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <output className="label w-20 text-center tabular-nums text-bone" aria-live="polite">
                {colors.length} colores
              </output>
              <button
                type="button"
                onClick={props.onGrow}
                disabled={!props.canGrow}
                aria-label="Un color más"
                className="grid size-10 place-items-center text-bone disabled:opacity-30"
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <button type="button" disabled={props.regenerateDisabled || colors.every((c) => c.locked)} onClick={props.onRegenerate} className={toolButton}>
              <Shuffle className="size-3.5" aria-hidden="true" /> {props.regenerateLabel}
            </button>
          </div>
          <p className="text-sm text-mute">{props.regenerateHint}</p>
          {!props.canGrow && colors.length < MAX_COLORS && props.cantGrowNote && <p className="text-sm text-mute">{props.cantGrowNote}</p>}
          {props.paletteExtra}
        </section>

        <section aria-labelledby="contrast-title" className="space-y-3 border-t border-line pt-6">
          <h3 id="contrast-title" className="label text-bone">
            Contraste (WCAG)
          </h3>
          {!bg ? (
            <p className="text-sm text-mute">Asigná un color de Fondo para medir el contraste.</p>
          ) : (
            pairs.map((p) => {
              if (!p.fg)
                return (
                  <p key={p.key} className="text-sm text-mute">
                    {p.label}: asigná un color de {p.key === 'texto' ? 'Texto' : 'Acento'} para medirlo.
                  </p>
                )
              const ratio = contrastRatio(p.fg, bg)
              const v = wcag(ratio)
              return (
                <div key={p.key} className="border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-2 text-sm text-bone">
                      <span aria-hidden="true" className="grid h-6 w-10 place-items-center text-xs font-semibold" style={{ backgroundColor: bg, color: p.fg }}>
                        Aa
                      </span>
                      {p.label}
                    </p>
                    <p className="display text-2xl leading-none text-bone tabular-nums">{formatRatio(ratio)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Verdict ok={v.aa} label="AA normal" />
                    <Verdict ok={v.aaa} label="AAA normal" />
                    <Verdict ok={v.aaLarge} label="AA grande" />
                    <Verdict ok={v.aaaLarge} label="AAA grande" />
                  </div>
                  {p.adjustable && !v.aa && (
                    <button type="button" onClick={adjust} className={`${toolButton} mt-3`}>
                      <Wand2 className="size-3.5" aria-hidden="true" /> Ajustar a AA
                    </button>
                  )}
                </div>
              )
            })
          )}
          {notice.startsWith('Ajusté') && <p className="text-sm text-bone">{notice}</p>}
          <p className="label-sm text-dim">Texto grande: desde 24 px, o 18,5 px en negrita.</p>
        </section>

        <section aria-labelledby="export-title" className="space-y-3 border-t border-line pt-6">
          <h3 id="export-title" className="label text-bone">
            Exportar
          </h3>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['hex', 'Copiar HEX'],
                ['css', 'Copiar CSS'],
                ['json', 'Copiar JSON'],
              ] as const
            ).map(([kind, label]) => (
              <button key={kind} type="button" onClick={() => copy(kind)} className={toolButton}>
                {copied === kind ? <Check className="size-3.5" aria-hidden="true" /> : null}
                {copied === kind ? 'Copiado' : label}
              </button>
            ))}
            <button type="button" onClick={download} className={toolButton}>
              {copied === 'ase' ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {copied === 'ase' ? 'Descargado' : 'Descargar .ase'}
            </button>
          </div>
          <p className="text-sm text-mute">Variables CSS y tokens usan los roles como nombre (por ejemplo, --color-fondo).</p>
        </section>
      </div>
    </div>
  )
}
