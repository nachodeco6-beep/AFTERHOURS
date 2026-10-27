import { ArrowUpRight } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { ColorLab } from '../components/moodboard/ColorLab'
import { TypeLab } from '../components/moodboard/TypeLab'
import { SectionHeader } from '../components/SectionHeader'
import { MyBoards } from '../components/studio/MyBoards'
import { useBoardData } from '../hooks/useBoardData'
import { useStudio, type Include } from '../hooks/useStudio'
import { routeHref } from '../lib/router'
import { MIN_SELECTION } from '../lib/select'

const go = (route: 'studio' | 'home') => {
  location.hash = routeHref(route)
}

/** A room of the app that needs something first: says what, and offers the way. */
function Room({ no, label, title, meta, children, after }: { no: string; label: string; title: string; meta: string; children: ReactNode; after?: ReactNode }) {
  return (
    <section aria-labelledby={`${label}-title`} className="relative pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id={label} no={no} label={title} meta={meta} title={title} routeTitle>
          {children}
        </SectionHeader>
        {after}
      </div>
    </section>
  )
}

const ToStudio = ({ children = 'Ir al Studio' }: { children?: ReactNode }) => (
  <a href={routeHref('studio')} className="btn-fill mt-8 inline-flex h-14 items-center gap-2 bg-acid px-6 text-ink [--fill-color:var(--color-bone)]">
    <span className="display text-[1.4rem] leading-none tracking-[0.02em]">{children}</span>
    <ArrowUpRight className="size-4" aria-hidden="true" />
  </a>
)

/** The labs work on the current board; with no board (or the block turned off) they explain. */
function useLabBoard(part: keyof Include) {
  const studio = useStudio()
  const { board, selection, updateBoard } = studio
  const photos = useMemo(() => selection.map((s) => s.photo), [selection])
  const data = useBoardData(board, photos)
  const ready = board !== null && selection.length >= MIN_SELECTION
  const enable = () => board && updateBoard({ include: { ...board.include, [part]: true } })
  return { board, photos, data, ready, on: Boolean(board?.include[part]), enable, updateBoard }
}

function NoBoard({ no, label, title, what }: { no: string; label: string; title: string; what: string }) {
  return (
    <Room no={no} label={label} title={title} meta="Sin tablero">
      El {title} trabaja sobre {what} de tu tablero, y todavía no armaste uno. Buscá fotos en el Studio, elegí al menos {MIN_SELECTION} y tocá «Armar moodboard»: después volvé acá.
      <br />
      <ToStudio />
    </Room>
  )
}

function Off({ no, label, title, what, onEnable }: { no: string; label: string; title: string; what: string; onEnable: () => void }) {
  return (
    <Room no={no} label={label} title={title} meta="Tu tablero">
      Tu tablero no muestra {what}. Sumalas para trabajarlas acá.
      <br />
      <button type="button" onClick={onEnable} className="btn-fill mt-8 inline-flex h-14 items-center bg-acid px-6 text-ink [--fill-color:var(--color-bone)]">
        <span className="display text-[1.4rem] leading-none tracking-[0.02em]">Incluir {what}</span>
      </button>
    </Room>
  )
}

export function TypeLabView() {
  const { board, data, ready, on, enable, updateBoard } = useLabBoard('type')
  if (!board || !ready) return <NoBoard no="02" label="type-lab" title="Type Lab" what="las tipografías" />
  if (!on) return <Off no="02" label="type-lab" title="Type Lab" what="tipografías" onEnable={enable} />
  return (
    <>
      <h1 className="sr-only" tabIndex={-1} data-route-title>
        Type Lab
      </h1>
      <TypeLab
        board={board}
        auto={data.auto}
        pair={data.pair}
        fontsReady={data.fontsReady}
        tags={data.tags}
        notes={data.notes}
        onChange={(patch) => updateBoard(patch)}
        onClose={() => go('studio')}
      />
    </>
  )
}

export function ColorLabView() {
  const { board, photos, data, ready, on, enable, updateBoard } = useLabBoard('palette')
  if (!board || !ready) return <NoBoard no="03" label="color-lab" title="Color Lab" what="la paleta" />
  if (!on) return <Off no="03" label="color-lab" title="Color Lab" what="la paleta" onEnable={enable} />
  return (
    <>
      <h1 className="sr-only" tabIndex={-1} data-route-title>
        Color Lab
      </h1>
      <ColorLab board={board} photos={photos} auto={data.autoPalette} pair={data.pair} onChange={(paletteEdit) => updateBoard({ paletteEdit })} onClose={() => go('studio')} />
    </>
  )
}

export function ArchivoView() {
  const { saved } = useStudio()
  return (
    <Room no="04" label="archivo" title="Archivo" meta="Mis tableros" after={<MyBoards heading={false} onOpened={() => go('studio')} />}>
      {saved.length
        ? 'Los tableros que guardaste en este navegador. Abrí uno para seguir trabajándolo en el Studio.'
        : 'Todavía no guardaste ningún tablero. Armá uno en el Studio y tocá «Guardar»: va a aparecer acá.'}
      {!saved.length && (
        <>
          <br />
          <ToStudio />
        </>
      )}
    </Room>
  )
}
