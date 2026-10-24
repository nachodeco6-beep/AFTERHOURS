import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowUpRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Photo } from '../../../shared/types'
import { useStudio, type TagResult } from '../../hooks/useStudio'
import { pad } from '../../lib/format'
import { PhotoCredit } from './PhotoCredit'
import { PhotoFrame } from './PhotoFrame'
import { PhotoViewer } from './PhotoViewer'

interface Group extends TagResult {
  /** Position among all tags, so numbering doesn't change when filtering. */
  index: number
  /** Photos Unsplash returned before removing the ones already shown under an earlier tag. */
  fetched: number
}

const ALL = '__all__'

function PhotoCard({ photo, onOpen }: { photo: Photo; onOpen: () => void }) {
  // very tall photos are cropped a little so one image can't swallow a column
  const ratio = Math.max(photo.width / photo.height, 0.6)
  return (
    <figure className="group">
      <button
        type="button"
        onClick={onOpen}
        data-cursor="Ver"
        aria-label={`Ver en grande. ${photo.alt}. Foto de ${photo.author.name}`}
        className="relative block w-full overflow-hidden"
        style={{ aspectRatio: ratio }}
      >
        <PhotoFrame
          photo={photo}
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="absolute inset-0 transition-transform duration-[1.2s] ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
        />
        <span
          aria-hidden="true"
          className="absolute right-2 bottom-2 grid size-9 translate-y-2 place-items-center bg-acid text-ink opacity-0 transition-[opacity,transform] duration-500 ease-[var(--ease-out-expo)] group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
        >
          <ArrowUpRight className="size-4" strokeWidth={1.75} />
        </span>
      </button>
      <figcaption>
        <PhotoCredit photo={photo} className="mt-2 text-xs leading-snug text-mute" />
      </figcaption>
    </figure>
  )
}

function GroupStatus({ group }: { group: Group }) {
  if (group.status === 'loading') return <>Revelando…</>
  if (group.status === 'error') return <span className="text-alarm">No se pudo buscar</span>
  return (
    <>
      {group.photos.length} {group.photos.length === 1 ? 'foto' : 'fotos'}
      <span className="hidden sm:inline"> · {group.total.toLocaleString('es-AR')} en Unsplash</span>
    </>
  )
}

function GroupBody({ group, onOpen }: { group: Group; onOpen: (photo: Photo) => void }) {
  if (group.status === 'loading') {
    return (
      <p className="label flex items-center gap-3 py-10 text-mute">
        <span aria-hidden="true" className="size-2 animate-pulse bg-acid" /> Revelando…
      </p>
    )
  }
  if (group.status === 'error') {
    return (
      <p className="flex items-start gap-2 py-6 text-sm text-mute">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alarm" strokeWidth={1.5} aria-hidden="true" />
        {group.error?.message}
      </p>
    )
  }
  if (!group.photos.length) {
    return (
      <p className="py-6 text-sm text-mute">
        {group.fetched
          ? 'Las fotos de esta etiqueta ya aparecen en las etiquetas anteriores.'
          : `Unsplash no tiene fotos para «${group.tag}». Probá con otra palabra; en inglés suele haber más resultados.`}
      </p>
    )
  }
  return (
    <ul className="columns-2 gap-3 sm:gap-4 md:columns-3 xl:columns-4">
      {group.photos.map((photo) => (
        <li key={photo.id} className="mb-5 break-inside-avoid sm:mb-6">
          <PhotoCard photo={photo} onOpen={() => onOpen(photo)} />
        </li>
      ))}
    </ul>
  )
}

/** The photo pool, grouped by tag, without repeating a photo across tags. */
export function Results({ results }: { results: TagResult[] }) {
  const { searching } = useStudio()
  const [filter, setFilter] = useState(ALL)
  const [openId, setOpenId] = useState<string | null>(null)

  const groups = useMemo<Group[]>(() => {
    const seen = new Set<string>()
    return results.map((r, index) => ({
      ...r,
      index,
      fetched: r.photos.length,
      photos: r.photos.filter((p) => !seen.has(p.id) && (seen.add(p.id), true)),
    }))
  }, [results])

  const active = groups.some((g) => g.tag === filter) ? filter : ALL
  const visible = active === ALL ? groups : groups.filter((g) => g.tag === active)
  const photos = visible.flatMap((g) => g.photos)
  const tagOf = useMemo(() => new Map(groups.flatMap((g) => g.photos.map((p) => [p.id, g.tag] as const))), [groups])
  const openIndex = photos.findIndex((p) => p.id === openId)

  const total = groups.reduce((n, g) => n + g.photos.length, 0)
  const loading = groups.filter((g) => g.status === 'loading').length
  const failed = groups.filter((g) => g.status === 'error')
  const allFailed = failed.length === groups.length && !loading
  const rateLimited = failed.find((g) => g.error?.code === 'rate_limited')

  let status: string
  if (loading) status = `Buscando ${loading} de ${groups.length} ${groups.length === 1 ? 'etiqueta' : 'etiquetas'}…`
  else if (allFailed) status = 'La búsqueda no funcionó.'
  else status = `${total} ${total === 1 ? 'foto' : 'fotos'} en ${groups.length} ${groups.length === 1 ? 'etiqueta' : 'etiquetas'}${failed.length ? `; ${failed.length} no se pudo buscar` : ''}.`

  return (
    <section aria-labelledby="results-title" aria-busy={searching} className="mt-20 md:mt-28">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h2 id="results-title" className="display text-[clamp(2.75rem,7vw,6rem)] text-bone">
          Referencias
        </h2>
        <p className="label text-dim" role="status" aria-live="polite">
          {status}
        </p>
      </div>

      {(allFailed || rateLimited) && (
        <div role="alert" className="mb-10 flex items-start gap-3 border border-alarm/50 p-4 text-sm text-bone sm:p-5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-alarm" strokeWidth={1.5} aria-hidden="true" />
          <p>
            {(rateLimited ?? failed[0]).error?.message}
            {rateLimited?.error?.rateLimitRemaining !== undefined && (
              <span className="text-mute"> Pedidos restantes en esta hora: {rateLimited.error.rateLimitRemaining}.</span>
            )}
          </p>
        </div>
      )}

      {groups.length > 1 && (
        <div className="mb-12 flex flex-col gap-4 border-y border-line py-3 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filtrar por etiqueta" className="-mx-1 flex flex-wrap gap-1">
            {[{ key: ALL, label: 'Todas', count: total, state: 'done' as TagResult['status'] }, ...groups.map((g) => ({ key: g.tag, label: g.tag, count: g.photos.length, state: g.status }))].map(
              (f) => {
                const on = active === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFilter(f.key)}
                    aria-pressed={on}
                    className={`label relative inline-flex h-10 max-w-full items-center gap-1.5 px-3 transition-colors ${on ? 'text-ink' : 'text-mute hover:text-bone'}`}
                  >
                    {on && (
                      <motion.span layoutId="studio-filter" className="absolute inset-0 bg-bone" transition={{ type: 'spring', stiffness: 400, damping: 36 }} />
                    )}
                    <span className="relative truncate">{f.label}</span>
                    <span className={`relative text-[0.625rem] ${on ? 'text-ink/60' : f.state === 'error' ? 'text-alarm' : 'text-dim'}`}>
                      {f.state === 'loading' ? '…' : f.state === 'error' ? '!' : f.count}
                    </span>
                  </button>
                )
              },
            )}
          </div>
          <p className="label text-dim">
            Mostrando <span className="text-bone">{photos.length}</span> de {total}
          </p>
        </div>
      )}

      <div className="space-y-16 md:space-y-24">
        {visible.map((group) => (
          <section key={group.tag} aria-labelledby={`group-${group.index}`}>
            <header className="mb-6 flex items-baseline justify-between gap-4 border-b border-line pb-3">
              <h3 id={`group-${group.index}`} className="display min-w-0 text-[clamp(1.75rem,3.2vw,3rem)] break-words text-bone">
                <span className="label mr-3 align-middle text-acid">{pad(group.index + 1)}</span>
                {group.tag}
              </h3>
              <p className="label shrink-0 text-right text-dim">
                <GroupStatus group={group} />
              </p>
            </header>
            <GroupBody group={group} onOpen={(p) => setOpenId(p.id)} />
          </section>
        ))}
      </div>

      <AnimatePresence>
        {openIndex >= 0 && (
          <PhotoViewer
            key="viewer"
            photos={photos}
            index={openIndex}
            onClose={() => setOpenId(null)}
            onNavigate={(i) => setOpenId(photos[(i + photos.length) % photos.length].id)}
            tagOf={(p) => tagOf.get(p.id)}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
