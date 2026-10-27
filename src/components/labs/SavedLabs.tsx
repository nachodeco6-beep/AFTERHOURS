import { ArrowUpRight, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DEFAULT_PAIR_ID } from '../../data/typePairs'
import { requestOpen, useLabs } from '../../hooks/useLabs'
import { pairById, pairName } from '../../lib/pairing'
import { routeHref } from '../../lib/router'
import { effectivePair } from '../../lib/typography'
import { FontSample } from '../moodboard/FontSample'

const goTo = (route: 'type-lab' | 'color-lab') => {
  location.hash = routeHref(route)
}

const date = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short' })
const action = 'label-sm inline-flex h-9 items-center gap-1.5 px-2 text-mute transition-colors hover:text-bone'

/** A row of the Library: a title, how many, and its content (or why it's empty). */
export function LibraryRow({ id, title, count, children }: { id: string; title: string; count: number; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-title`} className="mt-16 border-t border-line pt-6 first:mt-0 md:mt-20">
      <div className="mb-6 flex items-baseline justify-between gap-4">
        <h2 id={`${id}-title`} className="display text-[clamp(1.75rem,3.5vw,2.75rem)] text-bone">
          {title}
        </h2>
        <p className="label text-dim tabular-nums">{count}</p>
      </div>
      {children}
    </section>
  )
}

/** «Pares guardados» and «Paletas guardadas»: open in their lab, or delete. */
export function SavedLabs() {
  const { pairs, palettes, removePair, removePalette } = useLabs()
  const [message, setMessage] = useState('')

  const open = (kind: 'pair' | 'palette', id: string) => {
    requestOpen({ kind, id })
    goTo(kind === 'pair' ? 'type-lab' : 'color-lab')
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {message}
      </p>
      <LibraryRow id="saved-pairs" title="Pares guardados" count={pairs.length}>
        {pairs.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {pairs.map((s) => {
              const p = effectivePair(pairById(s.fonts.display) ?? pairById(DEFAULT_PAIR_ID)!, s.fonts, s.style)
              const name = pairName(p)
              return (
                <li key={s.id} className="flex flex-col border border-line">
                  <div className="flex-1 bg-[#FAFAF7] p-4 text-ink">
                    <FontSample spec={p.display} text="Noches de ciudad" className="line-clamp-2 block text-[1.6rem] leading-[1.02]" />
                    <FontSample spec={p.text} text="Un estudio que abre cuando cae el sol." className="mt-1.5 block truncate text-sm text-[#4a4945]" />
                  </div>
                  <div className="border-t border-line p-3">
                    <p className="truncate text-sm text-bone">{name}</p>
                    <p className="label-sm text-dim">{date.format(s.savedAt)}</p>
                    <div className="-mx-2 mt-1 flex flex-wrap">
                      <button type="button" onClick={() => open('pair', s.id)} aria-label={`Abrir ${name} en el Type Lab`} className={action}>
                        <ArrowUpRight className="size-3.5" aria-hidden="true" /> Abrir en el Type Lab
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removePair(s.id)
                          setMessage(`Borrado: ${name}.`)
                        }}
                        aria-label={`Borrar ${name}`}
                        className={`${action} hover:text-alarm`}
                      >
                        <Trash2 className="size-3.5" aria-hidden="true" /> Borrar
                      </button>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="max-w-md text-sm text-mute">
            Todavía no guardaste pares. En el{' '}
            <a href={routeHref('type-lab')} className="text-bone underline underline-offset-2 hover:text-acid">
              Type Lab
            </a>{' '}
            tocá la estrella de los que te gusten.
          </p>
        )}
      </LibraryRow>

      <LibraryRow id="saved-palettes" title="Paletas guardadas" count={palettes.length}>
        {palettes.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {palettes.map((p) => (
              <li key={p.id} className="flex flex-col border border-line">
                <span aria-hidden="true" className="flex h-24">
                  {p.colors.map((c, i) => (
                    <span key={i} className="flex-1" style={{ backgroundColor: c.hex }} />
                  ))}
                </span>
                <div className="border-t border-line p-3">
                  <p className="truncate text-sm text-bone">{p.name}</p>
                  <p className="label-sm truncate text-dim">
                    {p.colors.map((c) => c.hex).join(' · ')} · {date.format(p.savedAt)}
                  </p>
                  <div className="-mx-2 mt-1 flex flex-wrap">
                    <button type="button" onClick={() => open('palette', p.id)} aria-label={`Abrir ${p.name} en el Color Lab`} className={action}>
                      <ArrowUpRight className="size-3.5" aria-hidden="true" /> Abrir en el Color Lab
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removePalette(p.id)
                        setMessage(`Borrada: ${p.name}.`)
                      }}
                      aria-label={`Borrar ${p.name}`}
                      className={`${action} hover:text-alarm`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" /> Borrar
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-md text-sm text-mute">
            Todavía no guardaste paletas. En el{' '}
            <a href={routeHref('color-lab')} className="text-bone underline underline-offset-2 hover:text-acid">
              Color Lab
            </a>{' '}
            tocá «Guardar paleta».
          </p>
        )}
      </LibraryRow>
    </>
  )
}
