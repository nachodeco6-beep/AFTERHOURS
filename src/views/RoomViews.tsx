import { ArrowUpRight } from 'lucide-react'
import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react'
import { LibraryRow, SavedLabs } from '../components/labs/SavedLabs'
import { ColorLab } from '../components/moodboard/ColorLab'
import { TypeLab } from '../components/moodboard/TypeLab'
import { SectionHeader } from '../components/SectionHeader'
import { MyBoards } from '../components/studio/MyBoards'
import { useBoardData } from '../hooks/useBoardData'
import { useStudio, type Include } from '../hooks/useStudio'
import { basisOf, type LabColor } from '../lib/colorLab'
import { routeHref } from '../lib/router'
import { MIN_SELECTION } from '../lib/select'
import type { PickedFonts, TypeStyle } from '../lib/typography'

// «Explorar» (catalogue, harmonies, 61 palettes) loads only when a lab is opened
const TypeExplore = lazy(() => import('../components/labs/TypeExplore').then((m) => ({ default: m.TypeExplore })))
const ColorExplore = lazy(() => import('../components/labs/ColorExplore').then((m) => ({ default: m.ColorExplore })))

const Loading = () => (
  <p className="label-sm flex items-center gap-2 py-16 text-mute">
    <span aria-hidden="true" className="size-2 animate-pulse bg-acid" /> Abriendo el lab…
  </p>
)

const go = (route: 'studio' | 'home') => {
  location.hash = routeHref(route)
}

/** A room of the app: its header, then what it holds. */
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

/** The current board, for the labs' «Con mi tablero» (and «Usar en mi tablero»). */
function useLabBoard(part: keyof Include) {
  const studio = useStudio()
  const { board, selection, updateBoard, saved } = studio
  const photos = useMemo(() => selection.map((s) => s.photo), [selection])
  const data = useBoardData(board, photos)
  const ready = board !== null && selection.length >= MIN_SELECTION
  const enable = () => board && updateBoard({ include: { ...board.include, [part]: true } })
  return { board, photos, data, ready, on: Boolean(board?.include[part]), enable, updateBoard, saved }
}

type LabMode = 'explore' | 'board'

/**
 * «Explorar | Con mi tablero». Exploring is always there; the board is only an
 * option when there's one open or saved — otherwise the switch says how to get one.
 */
function ModeSwitch({ title, mode, onMode, available }: { title: string; mode: LabMode; onMode: (m: LabMode) => void; available: boolean }) {
  const base = 'label flex h-11 items-center px-4 transition-colors'
  return (
    <div className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-3">
      <div role="radiogroup" aria-label={`Cómo usar el ${title}`} className="inline-flex border border-line">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'explore'}
          onClick={() => onMode('explore')}
          className={`${base} ${mode === 'explore' ? 'bg-acid text-ink' : 'text-mute hover:text-bone'}`}
        >
          Explorar
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'board'}
          aria-disabled={!available}
          aria-describedby={available ? undefined : 'mode-board-note'}
          onClick={() => available && onMode('board')}
          className={`${base} ${mode === 'board' ? 'bg-acid text-ink' : available ? 'text-mute hover:text-bone' : 'cursor-not-allowed text-dim'}`}
        >
          Con mi tablero
        </button>
      </div>
      {!available && (
        <p id="mode-board-note" className="text-sm text-mute">
          Para trabajar sobre un tablero, primero armá uno.{' '}
          <a href={routeHref('studio')} className="text-bone underline underline-offset-2 hover:text-acid">
            Ir al Studio
          </a>
        </p>
      )}
    </div>
  )
}

function LabPage({
  no,
  id,
  title,
  intro,
  mode,
  onMode,
  available,
  children,
}: {
  no: string
  id: string
  title: string
  intro: ReactNode
  mode: LabMode
  onMode: (m: LabMode) => void
  available: boolean
  children: ReactNode
}) {
  return (
    <section aria-labelledby={`${id}-title`} className="relative pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id={id} no={no} label={title} meta={mode === 'explore' ? 'Explorar' : 'Con mi tablero'} title={title} routeTitle>
          {intro}
        </SectionHeader>
        <ModeSwitch title={title} mode={mode} onMode={onMode} available={available} />
        {children}
      </div>
    </section>
  )
}

/** «Con mi tablero» without one open: open a saved one right here. */
function OpenSaved() {
  return (
    <div>
      <p className="mb-6 max-w-xl text-sm text-mute">No tenés un tablero abierto. Abrí uno de los que guardaste para trabajarlo acá.</p>
      <MyBoards heading={false} />
    </div>
  )
}

/** The board doesn't show this block: offer to turn it on. */
function Off({ what, onEnable }: { what: string; onEnable: () => void }) {
  return (
    <div className="border border-line p-6">
      <p className="max-w-xl text-sm text-mute">Tu tablero no muestra {what}. Sumalas para trabajarlas acá.</p>
      <button type="button" onClick={onEnable} className="btn-fill mt-5 inline-flex h-12 items-center bg-acid px-5 text-ink [--fill-color:var(--color-bone)]">
        <span className="display text-[1.25rem] leading-none tracking-[0.02em]">Incluir {what}</span>
      </button>
    </div>
  )
}

export function TypeLabView() {
  const lab = useLabBoard('type')
  const { board, data, ready, on, enable, updateBoard } = lab
  const [mode, setMode] = useState<LabMode>('explore')
  const available = ready || lab.saved.length > 0
  const useInBoard = board && ready ? (fonts: PickedFonts, typeStyle: TypeStyle) => updateBoard({ fonts, typeStyle, include: { ...board.include, type: true } }) : undefined
  return (
    <LabPage
      no="02"
      id="type-lab"
      title="Type Lab"
      mode={available ? mode : 'explore'}
      onMode={setMode}
      available={available}
      intro="Pares tipográficos para inspirarte: filtralos por estilo y clima, probalos con tus palabras, fijá una fuente para buscarle compañera y guardá los que te gusten."
    >
      {mode === 'board' && available ? (
        !board || !ready ? (
          <OpenSaved />
        ) : !on ? (
          <Off what="tipografías" onEnable={enable} />
        ) : (
          <TypeLab
            embedded
            board={board}
            auto={data.auto}
            pair={data.pair}
            fontsReady={data.fontsReady}
            tags={data.tags}
            notes={data.notes}
            onChange={(patch) => updateBoard(patch)}
            onClose={() => setMode('explore')}
          />
        )
      ) : (
        <Suspense fallback={<Loading />}>
          <TypeExplore onUseInBoard={useInBoard} />
        </Suspense>
      )}
    </LabPage>
  )
}

export function ColorLabView() {
  const lab = useLabBoard('palette')
  const { board, photos, data, ready, on, enable, updateBoard } = lab
  const [mode, setMode] = useState<LabMode>('explore')
  const available = ready || lab.saved.length > 0
  const useInBoard =
    board && ready
      ? (colors: LabColor[]) =>
          updateBoard({
            paletteEdit: { colors, basis: basisOf(photos.map((p) => p.id)) },
            include: { ...board.include, palette: true },
          })
      : undefined
  return (
    <LabPage
      no="03"
      id="color-lab"
      title="Color Lab"
      mode={available ? mode : 'explore'}
      onMode={setMode}
      available={available}
      intro="Paletas para inspirarte: generalas desde un color y una armonía, recorré las armadas a mano o sacalas de una imagen. Con candados, contraste, vista previa y exportar."
    >
      {mode === 'board' && available ? (
        !board || !ready ? (
          <OpenSaved />
        ) : !on ? (
          <Off what="la paleta" onEnable={enable} />
        ) : (
          <ColorLab
            embedded
            board={board}
            photos={photos}
            auto={data.autoPalette}
            pair={data.pair}
            onChange={(paletteEdit) => updateBoard({ paletteEdit })}
            onClose={() => setMode('explore')}
          />
        )
      ) : (
        <Suspense fallback={<Loading />}>
          <ColorExplore onUseInBoard={useInBoard} />
        </Suspense>
      )}
    </LabPage>
  )
}

export function LibraryView() {
  const { saved } = useStudio()
  return (
    <Room
      no="04"
      label="library"
      title="Library"
      meta="Lo que guardaste"
      after={
        <>
          <LibraryRow id="saved-boards" title="Tableros" count={saved.length}>
            {saved.length ? (
              <MyBoards heading={false} onOpened={() => go('studio')} />
            ) : (
              <div>
                <p className="max-w-md text-sm text-mute">Todavía no guardaste ningún tablero. Armá uno en el Studio y tocá «Guardar»: va a aparecer acá.</p>
                <ToStudio />
              </div>
            )}
          </LibraryRow>
          <SavedLabs />
        </>
      }
    >
      Lo que guardaste en este navegador: tableros, pares tipográficos y paletas. No viaja a otros dispositivos.
    </Room>
  )
}
