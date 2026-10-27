import { Check, Dices, Lock, Search, Star, Unlock } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { MOOD_LABEL, MOODS, type Mood } from '../../data/moods'
import { HEAD_STYLE_LABEL, HEAD_STYLES, type HeadStyle } from '../../data/pairInfo'
import { DEFAULT_PAIR_ID, type TypePair } from '../../data/typePairs'
import { useCopy } from '../../hooks/useCopy'
import { clearOpenRequest, peekOpenRequest, useLabs } from '../../hooks/useLabs'
import { useSurface, type Surface } from '../../hooks/useSurface'
import { loadPairFonts } from '../../lib/fonts'
import { findPair } from '../../lib/labs'
import { CATALOG, companions, filterPairs, linkTags, moodsOf, NO_FILTER, pairById, pairCss, pairName, randomPair, type PairFilter, type Side } from '../../lib/pairing'
import { DEFAULT_TYPE_STYLE, effectivePair, fontCss, legibilityNotes, pairKey, type PickedFonts, type TypeStyle } from '../../lib/typography'
import { FontSample } from '../moodboard/FontSample'
import { toolButton } from '../moodboard/PaletteWorkbench'
import { TypeControls } from '../moodboard/TypeControls'
import { SurfacePicker, WorkSurface } from '../WorkSurface'
import { tabPanelProps } from './labKeys'
import { ChipGroup, Tabs } from './LabUi'

const SAMPLE_HEADLINE = 'Noches de ciudad'
const SAMPLE_TEXT = 'Un estudio que abre cuando cae el sol. Ideas, referencias y letras que se prueban en serio: con texto de verdad y en los tamaños en que se van a leer.'

type Tab = 'catalog' | 'saved'

interface ExploreState {
  fonts: PickedFonts
  style: TypeStyle
  size: number
  headline: string
  text: string
  filter: PairFilter
  tab: Tab
  fixed: Side | null
}

// what was being tried stays while you move around the site
let memory: ExploreState | null = null

const sameFonts = (a: PickedFonts, b: PickedFonts) => a.display === b.display && a.text === b.text

const composed = (fonts: PickedFonts, style: TypeStyle): TypePair => {
  const auto = pairById(fonts.display) ?? pairById(DEFAULT_PAIR_ID)!
  return effectivePair(auto, fonts, style)
}

interface Props {
  /** Present only when there's a board to send the pair to. */
  onUseInBoard?: (fonts: PickedFonts, style: TypeStyle) => void
}

/** Type Lab · Explorar: the catalogue of pairs, filters, a test table with your own words, companions for a fixed font, favourites and copy. */
export function TypeExplore({ onUseInBoard }: Props) {
  const labs = useLabs()
  const [surface, setSurface] = useSurface()
  const [state, setState] = useState<ExploreState>(() => {
    const asked = peekOpenRequest('pair')
    const fav = asked && labs.pairs.find((p) => p.id === asked.id)
    const base: ExploreState = memory ?? {
      fonts: labs.lastPair ?? { display: DEFAULT_PAIR_ID, text: DEFAULT_PAIR_ID },
      style: DEFAULT_TYPE_STYLE,
      size: 72,
      headline: '',
      text: '',
      filter: NO_FILTER,
      tab: 'catalog',
      fixed: null,
    }
    return fav ? { ...base, fonts: fav.fonts, style: fav.style, fixed: null } : base
  })
  useEffect(() => clearOpenRequest(), [])
  useEffect(() => {
    memory = state
  }, [state])

  const [notice, setNotice] = useState('')
  const say = (t: string) => setNotice(t)
  const { copied, copy } = useCopy(say)
  const tester = useRef<HTMLElement>(null)

  const { fonts, style, size, filter, tab, fixed } = state
  const set = (patch: Partial<ExploreState>) => setState((s) => ({ ...s, ...patch }))
  const pair = useMemo(() => composed(fonts, style), [fonts, style])
  const base = useMemo(() => composed(fonts, DEFAULT_TYPE_STYLE).display, [fonts])
  const headline = state.headline.trim() || SAMPLE_HEADLINE
  const text = state.text.trim() || SAMPLE_TEXT
  const name = pairName(pair)
  const saved = findPair(labs, fonts)

  // the pair on the table: load its fonts; remember it for the Color Lab's preview
  const key = pairKey(pair)
  const [loaded, setLoaded] = useState<{ key: string; ok: boolean } | null>(null)
  useEffect(() => {
    let cancelled = false
    loadPairFonts(pair).then((ok) => !cancelled && setLoaded({ key: pairKey(pair), ok }))
    return () => {
      cancelled = true
    }
  }, [pair])
  const fontsReady = loaded?.key === key ? loaded.ok : null
  const { setLastPair } = labs
  useEffect(() => setLastPair(fonts), [fonts, setLastPair])

  const shown = useMemo(() => filterPairs(CATALOG, filter), [filter])

  const tryPair = (next: PickedFonts, nextStyle: TypeStyle = { ...style, weight: null }, from?: string) => {
    set({ fonts: next, style: nextStyle, fixed: null })
    say(`En la mesa: ${pairName(composed(next, nextStyle))}${from ? ` (${from})` : ''}.`)
    // on a phone the table is above the catalogue: bring it into view
    const top = tester.current?.getBoundingClientRect().top ?? 0
    if (top < -40) tester.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const another = () => {
    const p = randomPair(shown, Math.random, fonts.display === fonts.text ? fonts.display : null)
    if (p) tryPair({ display: p.id, text: p.id }, { ...style, weight: null }, 'al azar')
    else say('No hay pares con esos filtros.')
  }
  const toggleSaved = () => {
    if (saved) {
      labs.removePair(saved.id)
      say(`Quitado de guardados: ${name}.`)
    } else {
      const res = labs.savePair(fonts, style)
      say(res === 'ok' ? `Guardado: ${name}. Lo encontrás en «Guardados» y en la Library.` : 'No se pudo guardar: este navegador no deja guardar datos.')
    }
  }

  const fixedFont = fixed ? pair[fixed] : null
  const options = useMemo(() => (fixed && fixedFont ? companions(fixedFont, fixed) : []), [fixed, fixedFont])
  const chooseCompanion = (from: number) => {
    const next = fixed === 'display' ? { display: fonts.display, text: from } : { display: from, text: fonts.text }
    set({ fonts: next, style: fixed === 'text' ? { ...style, weight: null } : style })
    say(`En la mesa: ${pairName(composed(next, style))}.`)
  }

  const display: CSSProperties = { ...fontCss(pair.display), letterSpacing: `${style.tracking}em`, textTransform: style.uppercase ? 'uppercase' : 'none' }
  const body: CSSProperties = { ...fontCss(pair.text), lineHeight: style.leading }
  const notes = legibilityNotes(pair, style)
  const savedPairs = labs.pairs

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>

      {/* the test table */}
      <section
        ref={tester}
        aria-labelledby="type-table-title"
        className="scroll-mt-20 border border-line lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto thin-scroll"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h3 id="type-table-title" className="label text-bone">
            Mesa de prueba
          </h3>
          <button
            type="button"
            onClick={toggleSaved}
            aria-pressed={Boolean(saved)}
            disabled={!labs.canSave}
            className="label-sm inline-flex h-9 items-center gap-1.5 border border-line px-2.5 text-bone transition-colors hover:border-bone disabled:opacity-40"
          >
            <Star className={`size-3.5 ${saved ? 'fill-acid text-acid' : ''}`} aria-hidden="true" />
            {saved ? 'Guardado' : 'Guardar par'}
          </button>
        </div>

        <WorkSurface surface={surface} label="Mesa de prueba" className="p-4 sm:p-6">
          <div className="mb-5 flex justify-end">
            <SurfacePicker value={surface} onChange={setSurface} />
          </div>
          <p className="label-sm text-[var(--sheet-mute)]">
            Titular · {pair.display.family}
            {pair.display.style?.fontStyle === 'italic' && ' Itálica'} · {pair.display.weight ?? 400}
          </p>
          <p className="mt-3 leading-[0.95] break-words" style={{ ...display, fontSize: `clamp(1.75rem, ${(size / 16) * 0.75}rem + 2vw, ${size / 16}rem)` }}>
            {headline}
          </p>
          <p className="label-sm mt-6 text-[var(--sheet-mute)]">Texto · {pair.text.family}</p>
          <p className="mt-2 max-w-prose text-base" style={body}>
            {text}
          </p>
          <div className="mt-6 max-w-prose border-t border-[var(--sheet-line)] pt-4">
            <p className="label-sm text-[var(--sheet-mute)]">En tamaño chico</p>
            <p className="mt-2 text-sm" style={display}>
              {headline}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-[var(--sheet-mute)]" style={body}>
              {text}
            </p>
          </div>
        </WorkSurface>
        <div aria-live="polite" className="space-y-2 border-t border-line px-4 py-3 empty:hidden">
          {fontsReady === false && <p className="label-sm text-alarm">No se pudieron cargar las fuentes: ves una aproximación.</p>}
          {notes.map((n) => (
            <p key={n} className="flex gap-2 text-sm leading-snug text-mute">
              <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 bg-mute" />
              {n}
            </p>
          ))}
        </div>

        <div className="space-y-8 border-t border-line p-4 sm:p-6">
          {/* fix a font, find it a companion */}
          <section aria-labelledby="fix-title">
            <h4 id="fix-title" className="label text-bone">
              Fijar una fuente y buscarle compañera
            </h4>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(['display', 'text'] as const).map((side) => {
                const on = fixed === side
                const f = pair[side]
                return (
                  <button
                    key={side}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set({ fixed: on ? null : side })}
                    className={`flex items-center gap-2 border px-3 py-2 text-left transition-colors ${on ? 'border-acid text-bone' : 'border-line text-mute hover:border-bone hover:text-bone'}`}
                  >
                    {on ? <Lock className="size-3.5 shrink-0 text-acid" aria-hidden="true" /> : <Unlock className="size-3.5 shrink-0" aria-hidden="true" />}
                    <span className="min-w-0">
                      <span className="label-sm block">{side === 'display' ? 'Fijar el titular' : 'Fijar el texto'}</span>
                      <span className="block truncate text-sm">{f.family}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            {fixed && fixedFont && (
              <div className="mt-4">
                <p id="companions-label" className="text-sm text-mute">
                  {fixed === 'display' ? 'Textos' : 'Titulares'} que acompañan a {fixedFont.family}: primero los del catálogo, después otras familias con contraste
                  {fixed === 'display' ? ' y buena lectura en chico' : ''}.
                </p>
                <div role="radiogroup" aria-labelledby="companions-label" className="mt-2 divide-y divide-line-soft border-y border-line">
                  {options.map((c) => {
                    const on = (fixed === 'display' ? pair.text.family : pair.display.family) === c.font.family
                    return (
                      <button
                        key={`${c.font.family}-${c.from}`}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${c.font.family}${c.inCatalog ? ', del catálogo' : ''}`}
                        onClick={() => chooseCompanion(c.from)}
                        className={`flex w-full items-center gap-3 px-2 py-2.5 text-left transition-colors ${on ? 'bg-char' : 'hover:bg-char/60'}`}
                      >
                        <span className={`size-2 shrink-0 ${on ? 'bg-acid' : 'bg-line'}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <FontSample
                            spec={c.font}
                            text={fixed === 'display' ? text : headline}
                            className={`block truncate text-bone ${fixed === 'display' ? 'text-sm' : 'text-xl leading-tight'}`}
                          />
                          <span className="label-sm mt-0.5 block truncate text-dim">
                            {c.font.family}
                            {c.inCatalog && <span className="text-acid"> · del catálogo</span>}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>

          {/* your own words */}
          <section aria-labelledby="words-title" className="space-y-3">
            <h4 id="words-title" className="label text-bone">
              Tu texto
            </h4>
            <label className="block">
              <span className="label-sm text-dim">Titular</span>
              <input
                value={state.headline}
                onChange={(e) => set({ headline: e.target.value })}
                placeholder={SAMPLE_HEADLINE}
                maxLength={80}
                className="mt-1 block h-10 w-full border border-line bg-transparent px-2 text-sm text-bone outline-none placeholder:text-dim focus-visible:border-acid"
              />
            </label>
            <label className="block">
              <span className="label-sm text-dim">Párrafo</span>
              <textarea
                value={state.text}
                onChange={(e) => set({ text: e.target.value })}
                placeholder={SAMPLE_TEXT}
                maxLength={600}
                rows={3}
                className="mt-1 block w-full resize-y border border-line bg-transparent px-2 py-1.5 text-sm text-bone outline-none placeholder:text-dim focus-visible:border-acid"
              />
            </label>
          </section>

          <TypeControls
            style={style}
            onStyle={(p) => set({ style: { ...style, ...p } })}
            font={base}
            shownWeight={pair.display.weight ?? 400}
            size={size}
            onSize={(px) => set({ size: px })}
          />

          <section aria-labelledby="pair-copy-title" className="space-y-3 border-t border-line pt-6">
            <h4 id="pair-copy-title" className="label text-bone">
              Llevártelo
            </h4>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['link', 'Copiar <link>', linkTags(pair), 'Copiado: el <link> de Google Fonts.'],
                  ['css', 'Copiar CSS', pairCss(pair, style), 'Copiado: el CSS del par.'],
                  ['name', 'Copiar nombre', name, `Copiado: «${name}».`],
                ] as const
              ).map(([k, label, content, done]) => (
                <button key={k} type="button" onClick={() => copy(k, content, done)} className={toolButton}>
                  {copied === k && <Check className="size-3.5" aria-hidden="true" />}
                  {copied === k ? 'Copiado' : label}
                </button>
              ))}
            </div>
            {onUseInBoard && (
              <button
                type="button"
                onClick={() => {
                  onUseInBoard(fonts, style)
                  say(`Listo: tu tablero usa ${name}.`)
                }}
                className="btn-fill inline-flex h-11 items-center bg-acid px-4 text-ink [--fill-color:var(--color-bone)]"
              >
                <span className="label">Usar en mi tablero</span>
              </button>
            )}
            {notice.startsWith('Listo') && <p className="text-sm text-bone">{notice}</p>}
          </section>
        </div>
      </section>

      {/* the catalogue */}
      <section aria-labelledby="catalog-title" className="min-w-0">
        <h3 id="catalog-title" className="sr-only">
          Pares tipográficos
        </h3>
        <div className="border-b border-line">
          <Tabs
            id="type-explore"
            label="Pares"
            value={tab}
            onChange={(t) => set({ tab: t })}
            tabs={[
              { id: 'catalog', label: `Catálogo · ${CATALOG.length}` },
              { id: 'saved', label: `Guardados · ${savedPairs.length}` },
            ]}
          />
        </div>

        {tab === 'catalog' ? (
          <div {...tabPanelProps('type-explore', 'catalog')} className="pt-5 outline-none">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="label-sm w-full text-dim sm:w-24">Titular</span>
                <ChipGroup<HeadStyle>
                  label="Estilo del titular"
                  options={HEAD_STYLES.map((s) => ({ id: s, label: HEAD_STYLE_LABEL[s] }))}
                  value={filter.style}
                  onChange={(s) => set({ filter: { ...filter, style: s } })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="label-sm w-full text-dim sm:w-24">Clima</span>
                <ChipGroup<Mood>
                  label="Clima"
                  options={MOODS.map((m) => ({ id: m, label: MOOD_LABEL[m] }))}
                  value={filter.mood}
                  onChange={(m) => set({ filter: { ...filter, mood: m } })}
                />
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="relative block min-w-0 flex-1 basis-56">
                  <span className="label-sm text-dim">Buscar por fuente</span>
                  <Search className="pointer-events-none absolute bottom-3 left-2.5 size-3.5 text-dim" aria-hidden="true" />
                  <input
                    type="search"
                    value={filter.query}
                    onChange={(e) => set({ filter: { ...filter, query: e.target.value } })}
                    placeholder="Montserrat, Bodoni…"
                    className="mt-1 block h-10 w-full border border-line bg-transparent pr-2 pl-8 text-sm text-bone outline-none placeholder:text-dim focus-visible:border-acid"
                  />
                </label>
                <button type="button" onClick={another} disabled={!shown.length} className={toolButton}>
                  <Dices className="size-3.5" aria-hidden="true" /> Otro par
                </button>
              </div>
              <p className="label-sm text-dim" aria-live="polite">
                {shown.length === CATALOG.length ? `${shown.length} pares` : `${shown.length} de ${CATALOG.length} pares`}
              </p>
            </div>
            {shown.length ? (
              <PairGrid
                pairs={shown.map((p) => ({ key: `c${p.id}`, fonts: { display: p.id, text: p.id }, style: null }))}
                current={fonts}
                headline={headline}
                text={text}
                surface={surface}
                onTry={tryPair}
                say={say}
              />
            ) : (
              <p className="mt-6 text-sm text-mute">
                No hay pares con esos filtros.{' '}
                <button type="button" onClick={() => set({ filter: NO_FILTER })} className="text-bone underline underline-offset-2 hover:text-acid">
                  Sacar los filtros
                </button>
              </p>
            )}
          </div>
        ) : (
          <div {...tabPanelProps('type-explore', 'saved')} className="pt-5 outline-none">
            {savedPairs.length ? (
              <PairGrid
                pairs={savedPairs.map((s) => ({ key: s.id, fonts: s.fonts, style: s.style }))}
                current={fonts}
                headline={headline}
                text={text}
                surface={surface}
                onTry={tryPair}
                say={say}
                onRemove={(f) => {
                  const s = findPair(labs, f)
                  if (s) {
                    labs.removePair(s.id)
                    say(`Quitado de guardados: ${pairName(composed(s.fonts, s.style))}.`)
                  }
                }}
              />
            ) : (
              <p className="text-sm text-mute">Todavía no guardaste pares. Probá uno en la mesa y tocá «Guardar par»: va a aparecer acá y en la Library.</p>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

/** Cards of pairs on the work table: each shows the pair in use, with a star (or «Quitar» among the saved ones). */
function PairGrid({
  pairs,
  current,
  headline,
  text,
  surface,
  onTry,
  onRemove,
  say,
}: {
  pairs: { key: string; fonts: PickedFonts; style: TypeStyle | null }[]
  current: PickedFonts
  headline: string
  text: string
  surface: Surface
  onTry: (fonts: PickedFonts, style?: TypeStyle) => void
  onRemove?: (fonts: PickedFonts) => void
  say: (text: string) => void
}) {
  const labs = useLabs()
  return (
    <WorkSurface surface={surface} label="Pares" className="mt-5 p-3 sm:p-4">
      <ul className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {pairs.map((item) => {
          const p = composed(item.fonts, item.style ?? DEFAULT_TYPE_STYLE)
          const n = pairName(p)
          const active = sameFonts(item.fonts, current)
          const fav = findPair(labs, item.fonts)
          const moods = item.fonts.display === item.fonts.text ? moodsOf(pairById(item.fonts.display)!) : []
          return (
            <li key={item.key} className={`flex min-w-0 flex-col border ${active ? 'border-[var(--sheet-ink)]' : 'border-[var(--sheet-line)]'}`}>
              <button
                type="button"
                onClick={() => onTry(item.fonts, item.style ?? undefined)}
                aria-pressed={active}
                aria-label={`Probar ${n}`}
                className="flex min-w-0 flex-1 flex-col p-4 text-left text-[var(--sheet-ink)]"
              >
                <FontSample spec={p.display} text={headline} className="line-clamp-2 block text-[1.75rem] leading-[1.02] break-words" />
                <FontSample spec={p.text} text={text} className="mt-2 line-clamp-3 block text-sm leading-snug text-[var(--sheet-mute)]" />
              </button>
              <div className="flex items-center gap-2 border-t border-[var(--sheet-line)] py-1.5 pr-1.5 pl-4">
                <p className="min-w-0 flex-1 text-[var(--sheet-mute)]">
                  <span className="block truncate text-xs text-[var(--sheet-ink)]">{n}</span>
                  {moods.length > 0 && <span className="label-sm block truncate">{moods.map((m) => MOOD_LABEL[m]).join(' · ')}</span>}
                </p>
                {onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(item.fonts)}
                    className="label-sm inline-flex h-9 items-center px-2 text-[var(--sheet-mute)] hover:text-[var(--sheet-ink)]"
                  >
                    Quitar
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-pressed={Boolean(fav)}
                    aria-label={fav ? `Quitar ${n} de guardados` : `Guardar ${n}`}
                    disabled={!labs.canSave}
                    onClick={() => {
                      if (fav) {
                        labs.removePair(fav.id)
                        say(`Quitado de guardados: ${n}.`)
                      } else {
                        labs.savePair(item.fonts, item.style ?? DEFAULT_TYPE_STYLE)
                        say(`Guardado: ${n}.`)
                      }
                    }}
                    className="grid size-9 shrink-0 place-items-center text-[var(--sheet-ink)] disabled:opacity-40"
                  >
                    <Star className={`size-4 ${fav ? 'fill-current' : ''}`} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </WorkSurface>
  )
}
