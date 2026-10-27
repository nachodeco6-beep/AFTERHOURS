import { Check, ImageUp, Search, Shuffle, Sparkles, Star, Trash2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
import type { Photo } from '../../../shared/types'
import { MOOD_LABEL, MOODS, type Mood } from '../../data/moods'
import { PALETTES } from '../../data/palettes'
import { DEFAULT_PAIR_ID } from '../../data/typePairs'
import { clearOpenRequest, peekOpenRequest, useLabs } from '../../hooks/useLabs'
import { hexToRgb, rgbToHex } from '../../lib/color'
import { defaultRoles, fillRoles, MAX_COLORS, regenerate, setCount, type LabColor, type PoolColor } from '../../lib/colorLab'
import { loadPairFonts } from '../../lib/fonts'
import { growFree, HARMONIES, lightOf, LIGHT_LABEL, LIGHTS, regenerateFree, rng, surprise, type Harmony, type Light } from '../../lib/harmony'
import { findPalette } from '../../lib/labs'
import { pairById } from '../../lib/pairing'
import { extractPalette, imagePalette } from '../../lib/paletteImage'
import { SEARCH_API_URL, searchPhotos, SearchFailure } from '../../lib/searchApi'
import { DEFAULT_TYPE_STYLE, effectivePair } from '../../lib/typography'
import { PaletteWorkbench, toolButton } from '../moodboard/PaletteWorkbench'
import { PhotoCredit } from '../studio/PhotoCredit'
import { PhotoFrame } from '../studio/PhotoFrame'
import { isTypingTarget, swatchStyle, tabPanelProps } from './labKeys'
import { ChipGroup, Tabs } from './LabUi'

type Panel = 'generar' | 'inspiracion' | 'imagen' | 'foto' | 'guardados'

/** Where the colours on the table came from. */
type Source =
  | { kind: 'harmony'; base: string; harmony: Harmony }
  | { kind: 'inspiration'; id: string; name: string }
  | { kind: 'image'; name: string; url: string; pool: PoolColor[] }
  | { kind: 'photo'; photo: Photo; pool: PoolColor[] }
  | { kind: 'saved'; name: string }

interface ExploreState {
  colors: LabColor[]
  base: string
  harmony: Harmony
  source: Source
  panel: Panel
}

const rand = rng((Date.now() ^ 0x5eed) >>> 0)
const unlocked = (hexes: string[]): LabColor[] => {
  const roles = defaultRoles(hexes)
  return hexes.map((hex, i) => ({ hex, locked: false, role: roles[i], photoId: null }))
}

function initial(): ExploreState {
  const brand = PALETTES[0]
  return { colors: unlocked(brand.colors), base: '#C7FF3D', harmony: 'triada', source: { kind: 'inspiration', id: brand.id, name: brand.name }, panel: 'generar' }
}

// what was on the table stays while you move around the site
let memory: ExploreState | null = null

const HARMONY_LABEL = Object.fromEntries(HARMONIES.map((h) => [h.id, h.label])) as Record<Harmony, string>

function sourceName(s: Source): string {
  switch (s.kind) {
    case 'harmony':
      return `${HARMONY_LABEL[s.harmony]} desde ${s.base}`
    case 'inspiration':
      return s.name
    case 'image':
      return `Tu imagen · ${s.name}`
    case 'photo':
      return `Foto de ${s.photo.author.name}`
    case 'saved':
      return s.name
  }
}

interface Props {
  /** Present only when there's a board to send the palette to. */
  onUseInBoard?: (colors: LabColor[]) => void
}

/** Color Lab · Explorar: palettes from a base colour and a harmony, hand-made ones, your own image or a searched photo, on the same workbench. */
export function ColorExplore({ onUseInBoard }: Props) {
  const labs = useLabs()
  const [state, setState] = useState<ExploreState>(() => {
    const asked = peekOpenRequest('palette')
    const fav = asked && labs.palettes.find((p) => p.id === asked.id)
    const base = memory ?? initial()
    if (!fav) return base
    return { ...base, colors: fav.colors.map((c) => ({ hex: c.hex, role: c.role, locked: false, photoId: null })), source: { kind: 'saved', name: fav.name }, panel: 'guardados' }
  })
  useEffect(() => clearOpenRequest(), [])
  useEffect(() => {
    memory = state
  }, [state])
  const [notice, setNotice] = useState('')
  const say = (t: string) => setNotice(t)
  const [step, setStep] = useState(0)

  const { colors, base, harmony, source, panel } = state
  const set = (patch: Partial<ExploreState>) => setState((s) => ({ ...s, ...patch }))
  const pool = source.kind === 'image' || source.kind === 'photo' ? source.pool : []
  const name = sourceName(source)
  const saved = findPalette(labs, colors)

  // the preview uses the last pair tried in the Type Lab (or the default one)
  const pair = useMemo(() => {
    const fonts = labs.lastPair ?? { display: DEFAULT_PAIR_ID, text: DEFAULT_PAIR_ID }
    return effectivePair(pairById(fonts.display) ?? pairById(DEFAULT_PAIR_ID)!, fonts, DEFAULT_TYPE_STYLE)
  }, [labs.lastPair])
  useEffect(() => {
    loadPairFonts(pair)
  }, [pair])

  // ── generating
  const fromBase = (nextBase: string, nextHarmony: Harmony) => {
    const { colors: next } = regenerateFree(colors, nextHarmony, rand, false, nextBase)
    set({ colors: next, base: nextBase, harmony: nextHarmony, source: { kind: 'harmony', base: nextBase, harmony: nextHarmony } })
    say(`Paleta en ${HARMONY_LABEL[nextHarmony].toLowerCase()} desde ${nextBase}${colors.some((c) => c.locked) ? ', sin tocar los colores con candado' : ''}.`)
  }
  const another = () => {
    if (colors.every((c) => c.locked)) return say('Todos los colores tienen candado: sacale el candado a alguno para cambiarlo.')
    if (pool.length) {
      const next = step + 1
      setStep(next)
      set({ colors: regenerate(colors, pool, [], next) })
      say(`Otros tonos de ${source.kind === 'image' ? 'tu imagen' : 'la foto'}, sin tocar los colores con candado.`)
      return
    }
    const r = regenerateFree(colors, harmony, rand, true)
    set({ colors: r.colors, harmony: r.harmony, source: { kind: 'harmony', base: (r.colors.find((c) => c.locked) ?? r.colors[0]).hex, harmony: r.harmony } })
    say(`Otra paleta (${HARMONY_LABEL[r.harmony].toLowerCase()}), sin tocar los colores con candado.`)
  }
  // the space bar does the same, unless it's typing in a field or pressing a control
  const anotherRef = useRef(another)
  useLayoutEffect(() => {
    anotherRef.current = another
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return
      if (document.querySelector('[aria-modal="true"]')) return
      e.preventDefault()
      anotherRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const applyHexes = (hexes: string[], next: Source, message: string) => {
    set({ colors: unlocked(hexes), source: next })
    say(message)
  }

  // ── saving
  const toggleSaved = () => {
    if (saved) {
      labs.removePalette(saved.id)
      say(`Quitada de guardadas: ${saved.name}.`)
      return
    }
    const res = labs.savePalette(
      name,
      colors.map((c) => ({ hex: c.hex, role: c.role })),
    )
    say(res === 'ok' ? `Guardada: ${name}. La encontrás en «Guardadas» y en la Library.` : 'No se pudo guardar: este navegador no deja guardar datos.')
  }

  const canGrow = colors.length < MAX_COLORS && (!pool.length || setCount(colors, colors.length + 1, pool, []).length > colors.length)

  return (
    <div className="space-y-8">
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>

      {/* where the colours come from */}
      <section aria-labelledby="sources-title" className="border border-line">
        <h3 id="sources-title" className="sr-only">
          De dónde salen los colores
        </h3>
        <div className="border-b border-line px-2 sm:px-4">
          <Tabs
            id="color-explore"
            label="De dónde salen los colores"
            value={panel}
            onChange={(p) => set({ panel: p })}
            tabs={[
              { id: 'generar', label: 'Generar' },
              { id: 'inspiracion', label: 'Inspiración' },
              { id: 'imagen', label: 'Tu imagen' },
              { id: 'foto', label: 'Una foto' },
              { id: 'guardados', label: `Guardadas · ${labs.palettes.length}` },
            ]}
          />
        </div>
        <div {...tabPanelProps('color-explore', panel)} className="p-4 outline-none sm:p-6">
          {panel === 'generar' && <Generate base={base} harmony={harmony} onApply={fromBase} />}
          {panel === 'inspiracion' && (
            <Inspiration
              current={source.kind === 'inspiration' ? source.id : null}
              onPick={(p) => applyHexes(p.colors, { kind: 'inspiration', id: p.id, name: p.name }, `Paleta de inspiración: ${p.name}.`)}
            />
          )}
          {panel === 'imagen' && (
            <OwnImage
              current={source.kind === 'image' ? source : null}
              onRead={(img, hexes) => {
                if (source.kind === 'image' && source.url !== img.url) URL.revokeObjectURL(source.url)
                applyHexes(hexes, { kind: 'image', ...img }, `Colores de tu imagen ${img.name}.`)
              }}
              say={say}
            />
          )}
          {panel === 'foto' && (
            <PhotoSource
              current={source.kind === 'photo' ? source.photo : null}
              onRead={(photo, hexes, p) => applyHexes(hexes, { kind: 'photo', photo, pool: p }, `Colores de la foto de ${photo.author.name}.`)}
            />
          )}
          {panel === 'guardados' && (
            <SavedPalettes
              onOpen={(p) => {
                set({ colors: p.colors.map((c) => ({ hex: c.hex, role: c.role, locked: false, photoId: null })), source: { kind: 'saved', name: p.name } })
                say(`Abierta: ${p.name}.`)
              }}
              onRemove={(id, n) => {
                labs.removePalette(id)
                say(`Borrada: ${n}.`)
              }}
            />
          )}
        </div>
      </section>

      {/* the workbench */}
      <section aria-labelledby="bench-title" className="flex flex-col border border-line lg:h-[min(60rem,calc(100dvh-6rem))]">
        <h3 id="bench-title" className="sr-only">
          Tu paleta
        </h3>
        <PaletteWorkbench
          colors={colors}
          onColors={(next) => set({ colors: next })}
          title={name}
          pair={pair}
          typeStyle={DEFAULT_TYPE_STYLE}
          fileName={name}
          notice={notice}
          say={say}
          countNote={<span className="text-[var(--sheet-mute)]"> · {name}</span>}
          toolbar={
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={another}
                disabled={colors.every((c) => c.locked)}
                className="btn-fill inline-flex h-10 items-center gap-2 bg-acid px-4 text-ink [--fill-color:var(--color-bone)] disabled:opacity-40"
              >
                <Shuffle className="size-3.5" aria-hidden="true" />
                <span className="label">Otra</span>
                <kbd className="label-sm hidden border border-ink/30 px-1 normal-case sm:inline">Espacio</kbd>
              </button>
              <button
                type="button"
                onClick={toggleSaved}
                aria-pressed={Boolean(saved)}
                disabled={!labs.canSave}
                className="label inline-flex h-10 items-center gap-2 border border-[var(--sheet-line)] px-3 text-[var(--sheet-ink)] transition-colors hover:border-[var(--sheet-ink)] disabled:opacity-40"
              >
                <Star className={`size-3.5 ${saved ? 'fill-current' : ''}`} aria-hidden="true" />
                {saved ? 'Guardada' : 'Guardar paleta'}
              </button>
              {onUseInBoard && (
                <button
                  type="button"
                  onClick={() => {
                    onUseInBoard(colors)
                    say('Listo: es la paleta de tu tablero.')
                  }}
                  className="label inline-flex h-10 items-center gap-2 border border-[var(--sheet-line)] px-3 text-[var(--sheet-ink)] transition-colors hover:border-[var(--sheet-ink)]"
                >
                  Usar en mi tablero
                </button>
              )}
              {notice.startsWith('Listo') && <p className="text-sm text-[var(--sheet-ink)]">{notice}</p>}
            </div>
          }
          onShrink={() => set({ colors: setCount(colors, colors.length - 1, [], []) })}
          onGrow={() => set({ colors: pool.length ? setCount(colors, colors.length + 1, pool, []) : fillRoles(growFree(colors, harmony, rand)) })}
          canGrow={canGrow}
          cantGrowNote={pool.length ? `${source.kind === 'image' ? 'Tu imagen' : 'La foto'} no tiene más colores bien distintos para sumar.` : undefined}
          onRegenerate={another}
          regenerateLabel="Otra"
          regenerateHint={
            pool.length
              ? `«Otra» (o la barra espaciadora) cambia los colores sin candado por otros tonos de ${source.kind === 'image' ? 'tu imagen' : 'la foto'}.`
              : '«Otra» (o la barra espaciadora) cambia los colores sin candado: puede variar la armonía, el tono, la saturación y la luz.'
          }
        />
      </section>
    </div>
  )
}

// ─── Sources ──────────────────────────────────────────────────────────────────

function Generate({ base, harmony, onApply }: { base: string; harmony: Harmony; onApply: (base: string, harmony: Harmony) => void }) {
  const [draft, setDraft] = useState<{ for: string; value: string } | null>(null)
  const value = draft?.for === base ? draft.value : base
  const commit = () => {
    const rgb = hexToRgb(value.startsWith('#') ? value : `#${value}`)
    setDraft(null)
    if (rgb && rgbToHex(rgb) !== base) onApply(rgbToHex(rgb), harmony)
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
      <fieldset>
        <legend className="label text-bone">Color base</legend>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <span aria-hidden="true" className="block size-10 border border-line" style={{ backgroundColor: base }} />
          <label className="block">
            <span className="label-sm text-dim">HEX</span>
            <input
              value={value}
              onChange={(e) => setDraft({ for: base, value: e.target.value.toUpperCase() })}
              onBlur={commit}
              onKeyDown={(e) => e.key === 'Enter' && commit()}
              maxLength={7}
              spellCheck={false}
              aria-label="Color base en HEX"
              className="mt-1 block h-10 w-28 border border-line bg-transparent px-2 font-mono text-sm text-bone uppercase outline-none focus-visible:border-acid"
            />
          </label>
          <label className="block">
            <span className="label-sm text-dim">Selector</span>
            <input
              type="color"
              value={base.toLowerCase()}
              onChange={(e) => onApply(e.target.value.toUpperCase(), harmony)}
              aria-label="Color base: selector visual"
              className="mt-1 block h-10 w-16 cursor-pointer border border-line bg-transparent p-0.5"
            />
          </label>
          <button type="button" onClick={() => onApply(surprise(rand), harmony)} className={toolButton}>
            <Sparkles className="size-3.5" aria-hidden="true" /> Sorprendeme
          </button>
        </div>
      </fieldset>
      <div>
        <p id="harmony-label" className="label text-bone">
          Armonía
        </p>
        <div role="radiogroup" aria-labelledby="harmony-label" className="mt-3 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
          {HARMONIES.map((h) => (
            <button
              key={h.id}
              type="button"
              role="radio"
              aria-checked={harmony === h.id}
              onClick={() => onApply(base, h.id)}
              className={`flex flex-col items-start gap-0.5 border px-3 py-2 text-left transition-colors ${harmony === h.id ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
            >
              <span className="label">{h.label}</span>
              <span className={`text-xs ${harmony === h.id ? 'text-ink/70' : 'text-dim'}`}>{h.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Strip({ hexes, className = 'h-10' }: { hexes: string[]; className?: string }) {
  return (
    <span aria-hidden="true" className={`flex w-full overflow-hidden ${className}`}>
      {hexes.map((h, i) => (
        <span key={i} className="flex-1" style={swatchStyle(h)} />
      ))}
    </span>
  )
}

function Inspiration({ current, onPick }: { current: string | null; onPick: (p: (typeof PALETTES)[number]) => void }) {
  const [mood, setMood] = useState<Mood | null>(null)
  const [light, setLight] = useState<Light | null>(null)
  const list = PALETTES.filter((p) => (!mood || p.mood === mood) && (!light || lightOf(p.colors) === light))
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label-sm w-full text-dim sm:w-14">Clima</span>
        <ChipGroup<Mood> label="Clima" options={MOODS.map((m) => ({ id: m, label: MOOD_LABEL[m] }))} value={mood} onChange={setMood} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="label-sm w-full text-dim sm:w-14">Luz</span>
        <ChipGroup<Light> label="Luz" all="Todas" options={LIGHTS.map((l) => ({ id: l, label: LIGHT_LABEL[l] }))} value={light} onChange={setLight} />
      </div>
      <p className="label-sm text-dim" aria-live="polite">
        {list.length} paletas · elegir una reemplaza todos los colores
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-pressed={current === p.id}
              aria-label={`${p.name}, ${MOOD_LABEL[p.mood]}${p.brand ? ', de la marca' : ''}: usar esta paleta`}
              onClick={() => onPick(p)}
              className={`block w-full border p-2 text-left transition-colors ${current === p.id ? 'border-acid' : 'border-line hover:border-bone'}`}
            >
              <Strip hexes={p.colors} />
              <span className="mt-2 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm text-bone">{p.name}</span>
                <span className="label-sm shrink-0 text-dim">{p.brand ? 'Marca' : MOOD_LABEL[p.mood]}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!list.length && <p className="text-sm text-mute">No hay paletas con esos filtros.</p>}
    </div>
  )
}

function OwnImage({
  current,
  onRead,
  say,
}: {
  current: { name: string; url: string } | null
  onRead: (img: { name: string; url: string; pool: PoolColor[] }, hexes: string[]) => void
  say: (t: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [over, setOver] = useState(false)
  const read = async (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Ese archivo no es una imagen. Probá con un JPG, PNG o WebP.')
      return
    }
    setBusy(true)
    setError('')
    const url = URL.createObjectURL(file)
    try {
      const { colors, pool } = await imagePalette(url)
      onRead({ name: file.name, url, pool }, colors)
    } catch {
      URL.revokeObjectURL(url)
      setError('No se pudo leer esa imagen. Probá con un JPG, PNG o WebP.')
      say('No se pudo leer esa imagen.')
    } finally {
      setBusy(false)
    }
  }
  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setOver(false)
    read(e.dataTransfer.files[0])
  }
  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setOver(true)
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-start gap-3 border border-dashed p-5 transition-colors ${over ? 'border-acid bg-acid/5' : 'border-line'}`}
      >
        <label className="btn-fill inline-flex h-11 cursor-pointer items-center gap-2 bg-acid px-4 text-ink [--fill-color:var(--color-bone)] focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-acid">
          <ImageUp className="size-4" aria-hidden="true" />
          <span className="label">{busy ? 'Leyendo…' : 'Elegir una imagen'}</span>
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => read(e.target.files?.[0])} />
        </label>
        <p className="text-sm text-mute">O arrastrala acá. Se procesa en tu navegador: la imagen no se sube a ningún lado.</p>
        {error && (
          <p role="alert" className="text-sm text-alarm">
            {error}
          </p>
        )}
      </div>
      {current && (
        <figure className="w-40">
          <img src={current.url} alt="Tu imagen" className="aspect-square w-full object-cover" />
          <figcaption className="label-sm mt-1 truncate text-dim">{current.name}</figcaption>
        </figure>
      )}
    </div>
  )
}

function PhotoSource({ current, onRead }: { current: Photo | null; onRead: (photo: Photo, hexes: string[], pool: PoolColor[]) => void }) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<{ status: 'idle' | 'loading' | 'done' | 'error'; photos: Photo[]; message?: string }>({ status: 'idle', photos: [] })
  const [reading, setReading] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])

  if (!SEARCH_API_URL) return <p className="text-sm text-mute">La búsqueda de fotos no está conectada en esta versión: probá con «Generar», «Inspiración» o tu propia imagen.</p>

  const search = async (e: FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setState({ status: 'loading', photos: [] })
    try {
      const res = await searchPhotos(q, ctrl.signal)
      setState({ status: 'done', photos: res.photos.slice(0, 12) })
    } catch (err) {
      if (ctrl.signal.aborted) return
      setState({ status: 'error', photos: [], message: err instanceof SearchFailure ? err.message : 'No se pudo buscar. Probá de nuevo.' })
    }
  }
  const pick = async (photo: Photo) => {
    setReading(photo.id)
    const r = await extractPalette([photo])
    setReading(null)
    onRead(photo, r.colors, r.pool)
  }

  return (
    <div className="space-y-4">
      <form role="search" onSubmit={search} className="flex flex-wrap items-end gap-2">
        <label className="relative block min-w-0 flex-1 basis-56">
          <span className="label-sm text-dim">Buscar una foto en Unsplash</span>
          <Search className="pointer-events-none absolute bottom-3 left-2.5 size-3.5 text-dim" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Atardecer en la costa, neón…"
            className="mt-1 block h-10 w-full border border-line bg-transparent pr-2 pl-8 text-sm text-bone outline-none placeholder:text-dim focus-visible:border-acid"
          />
        </label>
        <button type="submit" disabled={state.status === 'loading' || !query.trim()} className={toolButton}>
          {state.status === 'loading' ? 'Buscando…' : 'Buscar'}
        </button>
      </form>
      <div aria-live="polite">
        {state.status === 'error' && <p className="text-sm text-alarm">{state.message}</p>}
        {state.status === 'done' && !state.photos.length && <p className="text-sm text-mute">No encontramos fotos para esa búsqueda. Probá con otras palabras.</p>}
      </div>
      {state.photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" aria-label="Fotos encontradas">
          {state.photos.map((p) => (
            <li key={p.id} className="min-w-0">
              <button
                type="button"
                onClick={() => pick(p)}
                aria-pressed={current?.id === p.id}
                aria-label={`Usar los colores de la foto de ${p.author.name}`}
                className={`relative block aspect-square w-full overflow-hidden ${current?.id === p.id ? 'outline-2 outline-offset-2 outline-acid' : ''}`}
              >
                <PhotoFrame photo={p} size="thumb" className="absolute inset-0" />
                {reading === p.id && <span className="label-sm absolute inset-x-0 bottom-0 bg-ink/80 px-1 text-bone">Leyendo…</span>}
              </button>
              <PhotoCredit photo={p} className="mt-1 truncate text-[0.6875rem] leading-snug text-mute" />
            </li>
          ))}
        </ul>
      )}
      {current && (
        <div className="flex items-center gap-3 border-t border-line pt-4">
          <PhotoFrame photo={current} size="thumb" eager className="relative size-14 shrink-0" />
          <div className="min-w-0 text-sm text-mute">
            <p className="text-bone">Los colores salen de esta foto.</p>
            <PhotoCredit photo={current} className="truncate" />
          </div>
        </div>
      )}
    </div>
  )
}

function SavedPalettes({ onOpen, onRemove }: { onOpen: (p: ReturnType<typeof useLabs>['palettes'][number]) => void; onRemove: (id: string, name: string) => void }) {
  const { palettes } = useLabs()
  if (!palettes.length) return <p className="text-sm text-mute">Todavía no guardaste paletas. Armá una y tocá «Guardar paleta»: va a aparecer acá y en la Library.</p>
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {palettes.map((p) => (
        <li key={p.id} className="border border-line p-2">
          <Strip hexes={p.colors.map((c) => c.hex)} />
          <p className="mt-2 truncate text-sm text-bone">{p.name}</p>
          <div className="-mx-1 mt-1 flex flex-wrap">
            <button type="button" onClick={() => onOpen(p)} className="label-sm inline-flex h-9 items-center gap-1.5 px-1 text-mute hover:text-bone">
              <Check className="size-3.5" aria-hidden="true" /> Usar
            </button>
            <button
              type="button"
              onClick={() => onRemove(p.id, p.name)}
              aria-label={`Borrar ${p.name}`}
              className="label-sm inline-flex h-9 items-center gap-1.5 px-1 text-mute hover:text-alarm"
            >
              <Trash2 className="size-3.5" aria-hidden="true" /> Borrar
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
