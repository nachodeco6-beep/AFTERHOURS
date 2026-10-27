import { motion } from 'framer-motion'
import { Check, Lock, Minus, Pipette, Plus, RotateCcw, Shuffle, Unlock, Wand2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { Photo } from '../../../shared/types'
import type { TypePair } from '../../data/typePairs'
import { useDialog } from '../../hooks/useDialog'
import { useSurface } from '../../hooks/useSurface'
import type { Board } from '../../hooks/useStudio'
import { hexToRgb, rgbToHex } from '../../lib/color'
import {
  adjustText,
  contrastRatio,
  formatRatio,
  fromAuto,
  inkOn,
  MAX_COLORS,
  MIN_COLORS,
  regenerate,
  ROLE_LABEL,
  ROLES,
  roleIndex,
  setCount,
  setRole,
  sourceOf,
  toAse,
  toCss,
  toHexList,
  toTokens,
  wcag,
  type LabColor,
  type PaletteEdit,
  type Role,
} from '../../lib/colorLab'
import { pad } from '../../lib/format'
import type { PaletteResult } from '../../lib/paletteImage'
import { fontCss } from '../../lib/typography'
import { PhotoFrame } from '../studio/PhotoFrame'
import { SurfacePicker, WorkSurface } from '../WorkSurface'
import { Eyedropper } from './Eyedropper'

interface LabProps {
  board: Board
  photos: Photo[]
  /** The automatic palette, with the pool of colours present in the photos. */
  auto: PaletteResult | null
  pair: TypePair
  onChange: (edit: PaletteEdit | null) => void
  onClose: () => void
}

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

/** The Color Lab: lock, regenerate from the photos, edit, roles, contrast, preview and export. */
export function ColorLab({ board, photos, auto, pair, onChange, onClose }: LabProps) {
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, true, onClose)
  const [surface, setSurface] = useSurface()
  const [step, setStep] = useState(0)
  const [hover, setHover] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<ExportKind | null>(null)
  const [hexDraft, setHexDraft] = useState('')
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const photoIds = useMemo(() => photos.map((p) => p.id), [photos])
  const pool = useMemo(() => auto?.pool ?? [], [auto])
  const edit: PaletteEdit | null = board.paletteEdit ?? (auto ? fromAuto(auto.colors, pool, photoIds) : null)
  const colors = edit?.colors ?? []
  const touched = board.paletteEdit !== null
  // only if the photos still have a colour different enough from the ones in use
  const canGrow = colors.length < MAX_COLORS && setCount(colors, colors.length + 1, pool, photoIds).length > colors.length

  const update = (next: LabColor[]) => edit && onChange({ colors: next, basis: edit.basis })
  const sourceIndex = (c: LabColor) => {
    const byId = c.photoId ? photoIds.indexOf(c.photoId) : -1
    if (byId >= 0) return byId
    const s = sourceOf(c.hex, pool)
    return s ? s.photo : -1
  }

  const startEdit = (i: number) => {
    setEditing(i)
    setHexDraft(colors[i].hex)
    setPicking(false)
  }
  const setHex = (i: number, hex: string, photoId: string | null = null) => update(colors.map((c, k) => (k === i ? { ...c, hex: hex.toUpperCase(), photoId } : c)))
  const commitDraft = () => {
    if (editing === null) return
    const rgb = hexToRgb(hexDraft.startsWith('#') ? hexDraft : `#${hexDraft}`)
    if (rgb) setHex(editing, rgbToHex(rgb))
    else setHexDraft(colors[editing].hex)
  }

  const say = (text: string) => setNotice(text)

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
    update(colors.map((c, k) => (k === i ? { ...c, hex: r.hex, photoId: null } : c)))
    say(`Ajusté el Texto de ${text} a ${r.hex} para llegar a AA (${formatRatio(r.ratio)}).`)
  }

  // ── export
  const copy = async (kind: Exclude<ExportKind, 'ase'>) => {
    const content = kind === 'hex' ? toHexList(colors) : kind === 'css' ? toCss(colors) : toTokens(colors)
    try {
      await navigator.clipboard.writeText(content)
      setCopied(kind)
      say(kind === 'hex' ? 'Copiado: lista de HEX.' : kind === 'css' ? 'Copiado: variables CSS.' : 'Copiado: tokens en JSON.')
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(null), 1600)
    } catch {
      say('No se pudo copiar: el navegador no dio permiso.')
    }
  }
  const download = () => {
    const blob = new Blob([toAse(colors) as BlobPart], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(board.title || 'paleta').toLowerCase().replace(/[^a-z0-9áéíóúñü]+/gi, '-').replace(/^-|-$/g, '') || 'paleta'}.ase`
    a.click()
    URL.revokeObjectURL(url)
    setCopied('ase')
    say('Descargado: muestras .ase para Adobe.')
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCopied(null), 1600)
  }

  const shown = hover ?? editing
  const shownSource = shown !== null && colors[shown] ? sourceIndex(colors[shown]) : -1
  const title: CSSProperties = { ...fontCss(pair.display), letterSpacing: `${board.typeStyle.tracking}em`, textTransform: board.typeStyle.uppercase ? 'uppercase' : 'none' }
  const body: CSSProperties = { ...fontCss(pair.text), lineHeight: board.typeStyle.leading }
  const card = { bg: bg ?? colors[0]?.hex ?? '#FAFAF7', fg: text ?? inkOn(bg ?? colors[0]?.hex ?? '#FAFAF7') }
  const button = 'label inline-flex h-10 items-center gap-2 border border-line px-3 text-bone transition-colors hover:border-bone disabled:opacity-40 disabled:hover:border-line'

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="colorlab-title"
      className="fixed inset-0 z-[80] flex flex-col bg-ink"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-4 sm:px-6">
        <div className="min-w-0">
          <h2 id="colorlab-title" className="display text-[1.75rem] leading-none text-bone">
            Color Lab
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

      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>

      {!edit ? (
        <p className="label-sm flex flex-1 items-center justify-center gap-2 text-mute">
          <span aria-hidden="true" className="size-2 animate-pulse bg-acid" /> Leyendo colores de las fotos…
        </p>
      ) : (
        <div className="thin-scroll min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:overflow-hidden">
          {/* the work table: swatches, where they come from, preview or dropper */}
          <WorkSurface surface={surface} label="Paleta" className="thin-scroll border-line p-4 sm:p-6 lg:overflow-y-auto lg:border-r lg:p-10">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="label text-[var(--sheet-ink)]">
                {colors.length} colores{auto?.source === 'unsplash' && <span className="text-[var(--sheet-mute)]"> · aproximados, colores de Unsplash</span>}
              </p>
              <SurfacePicker value={surface} onChange={setSurface} />
            </div>

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
                    aria-pressed={editing === i}
                    className="relative h-20 w-full border border-[var(--sheet-line)] sm:h-24"
                    style={{ backgroundColor: c.hex, ...(editing === i ? { outline: '2px solid var(--sheet-ink)', outlineOffset: 3 } : {}) }}
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
                      onClick={() => update(colors.map((x, k) => (k === i ? { ...x, locked: !x.locked } : x)))}
                      aria-pressed={c.locked}
                      aria-label={`${c.locked ? 'Desbloquear' : 'Bloquear'} el color ${i + 1}`}
                      title={c.locked ? 'Desbloquear' : 'Bloquear'}
                      className={`grid size-8 shrink-0 place-items-center border ${c.locked ? 'border-[var(--sheet-ink)] bg-[var(--sheet-ink)]' : 'border-[var(--sheet-line)] hover:border-[var(--sheet-ink)]'}`}
                    >
                      {c.locked ? <Lock className="size-3.5" style={{ color: surface === 'black' ? '#090909' : '#FAFAF7' }} aria-hidden="true" /> : <Unlock className="size-3.5" aria-hidden="true" />}
                    </button>
                  </div>
                  <select
                    value={c.role ?? ''}
                    onChange={(e) => update(setRole(colors, i, (e.target.value || null) as Role | null))}
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

            {/* where the colour comes from */}
            <div className="mt-6">
              <p className="label-sm min-h-4 text-[var(--sheet-mute)]" aria-live="polite">
                {shown === null
                  ? 'Pasá el mouse por un color para ver de qué foto sale'
                  : shownSource >= 0
                    ? `Color ${shown + 1} sale de la foto ${pad(shownSource + 1)}, de ${photos[shownSource].author.name}`
                    : `Color ${shown + 1}: elegido a mano`}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Fotos del tablero">
                {photos.map((p, i) => (
                  <li
                    key={p.id}
                    className={`relative size-10 overflow-hidden transition-opacity sm:size-12 ${shown !== null && shownSource !== i ? 'opacity-35' : ''}`}
                    style={shownSource === i ? { outline: '2px solid var(--sheet-ink)', outlineOffset: 2 } : undefined}
                  >
                    <PhotoFrame photo={p} size="thumb" eager className="absolute inset-0" />
                    <span className="label-sm absolute bottom-0 left-0 bg-ink/80 px-0.5 text-bone">{pad(i + 1)}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 border-t border-[var(--sheet-line)] pt-6">
              {picking && editing !== null ? (
                <Eyedropper
                  photos={photos}
                  start={Math.max(0, sourceIndex(colors[editing]))}
                  onCancel={() => setPicking(false)}
                  onPick={(hex, photoId) => {
                    setHex(editing, hex, photoId)
                    setHexDraft(hex)
                    setPicking(false)
                    say(`Color ${editing + 1}: ${hex}, tomado de una foto.`)
                  }}
                />
              ) : (
                <>
                  <p className="label-sm text-[var(--sheet-mute)]">Así se ve aplicada</p>
                  <div className="mt-3 max-w-lg border border-[var(--sheet-line)] p-6 sm:p-8" style={{ backgroundColor: card.bg, color: card.fg }} aria-label="Vista previa de la paleta">
                    {secondary && <span aria-hidden="true" className="block h-1 w-12" style={{ backgroundColor: secondary }} />}
                    <p className="mt-4 text-[clamp(1.75rem,4vw,2.75rem)] leading-[0.95] break-words" style={title}>
                      {board.title || 'Título'}
                    </p>
                    <p className="mt-3 max-w-prose text-sm" style={body}>
                      Fondo, titular y texto con los colores de la paleta, y un botón en el color de acento.
                    </p>
                    {accent && (
                      <span className="label mt-5 inline-flex h-10 items-center px-4" style={{ backgroundColor: accent, color: inkOn(accent, [card.bg, card.fg, '#090909', '#F1F0E8']) }}>
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
            {editing !== null && colors[editing] && (
              <section aria-labelledby="edit-title" className="border border-line p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 id="edit-title" className="label text-bone">
                    Color {editing + 1}
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
                      onChange={(e) => setHexDraft(e.target.value.toUpperCase())}
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
                      value={colors[editing].hex.toLowerCase()}
                      onChange={(e) => {
                        setHex(editing, e.target.value)
                        setHexDraft(e.target.value.toUpperCase())
                      }}
                      className="mt-1 block h-10 w-16 cursor-pointer border border-line bg-transparent p-0.5"
                    />
                  </label>
                  <button type="button" onClick={() => setPicking(true)} className={button}>
                    <Pipette className="size-3.5" aria-hidden="true" /> Tomar de una foto
                  </button>
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
                    onClick={() => update(setCount(colors, colors.length - 1, pool, photoIds))}
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
                    onClick={() => update(setCount(colors, colors.length + 1, pool, photoIds))}
                    disabled={!canGrow}
                    aria-label="Un color más"
                    className="grid size-10 place-items-center text-bone disabled:opacity-30"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!pool.length || colors.every((c) => c.locked)}
                  onClick={() => {
                    const next = step + 1
                    setStep(next)
                    update(regenerate(colors, pool, photoIds, next))
                    say('Regenerados los colores sin bloquear, con otros tonos de las fotos.')
                  }}
                  className={button}
                >
                  <Shuffle className="size-3.5" aria-hidden="true" /> Regenerar
                </button>
              </div>
              <p className="text-sm text-mute">«Regenerar» cambia los colores sin candado por otros tonos que están en las fotos del tablero.</p>
              {!canGrow && colors.length < MAX_COLORS && <p className="text-sm text-mute">Las fotos no tienen más colores bien distintos para sumar.</p>}
              {touched && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(null)
                    setEditing(null)
                    say('Volviste a la paleta automática.')
                  }}
                  className="label-sm inline-flex h-8 items-center gap-1.5 text-mute hover:text-bone"
                >
                  <RotateCcw className="size-3" aria-hidden="true" /> Volver a la paleta automática
                </button>
              )}
            </section>

            <section aria-labelledby="contrast-title" className="space-y-3 border-t border-line pt-6">
              <h3 id="contrast-title" className="label text-bone">
                Contraste (WCAG)
              </h3>
              {!bg ? (
                <p className="text-sm text-mute">Asigná un color de Fondo para medir el contraste.</p>
              ) : (
                pairs.map((p) => {
                  if (!p.fg) return (
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
                        <button type="button" onClick={adjust} className={`${button} mt-3`}>
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
                  <button key={kind} type="button" onClick={() => copy(kind)} className={button}>
                    {copied === kind ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {copied === kind ? 'Copiado' : label}
                  </button>
                ))}
                <button type="button" onClick={download} className={button}>
                  {copied === 'ase' ? <Check className="size-3.5" aria-hidden="true" /> : null}
                  {copied === 'ase' ? 'Descargado' : 'Descargar .ase'}
                </button>
              </div>
              <p className="text-sm text-mute">Variables CSS y tokens usan los roles como nombre (por ejemplo, --color-fondo).</p>
            </section>
          </div>
        </div>
      )}
    </motion.div>
  )
}
