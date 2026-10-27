import { AnimatePresence } from 'framer-motion'
import { Search } from 'lucide-react'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { useStudio } from '../../hooks/useStudio'
import { joinTags, MAX_TAG_LENGTH, MAX_TAGS, parseTags } from '../../lib/tags'
import { ConfirmDialog } from '../ConfirmDialog'
import { TagChips } from './TagChips'

const EXAMPLE = 'Marca de ropa urbana, surf, California 90s, analógico, flash directo, arena y negro'
const MAX_IDEA = MAX_TAGS * MAX_TAG_LENGTH

export function IdeaEditor({ demo }: { demo: boolean }) {
  const { idea, setIdea, search, searching, requestsFor, board, dirty, dismantleBoard } = useStudio()
  const [confirming, setConfirming] = useState(false)
  const parsed = useMemo(() => parseTags(idea), [idea])
  const tags = parsed.searchable
  const requests = requestsFor(tags)
  const remembered = tags.length - requests
  const canSearch = !demo && tags.length > 0 && !searching
  const extra = parsed.all.length - MAX_TAGS

  const run = () => {
    if (!canSearch) return
    // unsaved changes on the board would be lost: ask first (a saved board stays in «Mis tableros»)
    if (board && dirty) setConfirming(true)
    else {
      if (board) dismantleBoard()
      search(tags)
    }
  }
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      run()
    }
  }

  let info: string
  if (demo) info = 'La búsqueda está desconectada: no se puede buscar en modo demo.'
  else if (!tags.length) info = 'Escribí al menos una etiqueta para buscar.'
  else if (requests === 0) info = 'No gasta pedidos: ya buscaste estas etiquetas en esta visita.'
  else
    info = `Esta búsqueda usa ${requests} ${requests === 1 ? 'pedido' : 'pedidos'} a Unsplash (uno por etiqueta)${
      remembered ? `; ${remembered} ${remembered === 1 ? 'etiqueta ya buscada no gasta' : 'etiquetas ya buscadas no gastan'}` : ''
    }.`

  return (
    <div className="border border-line">
      <div className="label flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
        <label htmlFor="idea" className="text-mute">
          Tu idea
        </label>
        <span className="tabular-nums text-dim">
          {idea.length.toLocaleString('es-AR')} / {MAX_IDEA.toLocaleString('es-AR')}
        </span>
      </div>

      <textarea
        id="idea"
        value={idea}
        onChange={(e) => setIdea(e.target.value)}
        onKeyDown={onKey}
        placeholder={EXAMPLE}
        maxLength={MAX_IDEA}
        rows={3}
        spellCheck
        aria-describedby="idea-help"
        className="idea-editor thin-scroll block min-h-[9rem] w-full resize-none bg-transparent px-4 py-6 font-serif text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.4] text-bone outline-none focus-visible:shadow-[inset_2px_0_0_var(--color-acid)] sm:px-6 md:px-10 md:py-8"
      />

      <div className="border-t border-line px-4 py-5 sm:px-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <p className="label text-mute">
            Etiquetas{' '}
            <span className={parsed.all.length > MAX_TAGS ? 'text-alarm' : 'text-dim'}>
              ({Math.min(parsed.all.length, MAX_TAGS)}/{MAX_TAGS})
            </span>
          </p>
          <p id="idea-help" className="text-xs text-dim">
            Separá los conceptos con comas. Tocá una etiqueta para editarla.
          </p>
        </div>

        {parsed.all.length > 0 ? (
          <TagChips tags={parsed.all} onChange={(next) => setIdea(joinTags(next))} />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <TagChips tags={[]} onChange={(next) => setIdea(joinTags(next))} />
            <button type="button" onClick={() => setIdea(EXAMPLE)} className="label h-10 px-1 text-mute underline-offset-4 hover:text-acid hover:underline">
              Probar con el ejemplo
            </button>
          </div>
        )}

        <div aria-live="polite">
          {extra > 0 && (
            <p className="mt-4 text-sm text-alarm">
              Hay {parsed.all.length} etiquetas y se buscan como máximo {MAX_TAGS}. {extra === 1 ? 'La última queda afuera' : `Las últimas ${extra} quedan afuera`}: sacá alguna o
              juntá conceptos.
            </p>
          )}
          {parsed.truncated && (
            <p className="mt-2 text-sm text-mute">Una etiqueta pasaba los {MAX_TAG_LENGTH} caracteres y se acortó para buscarla.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-line px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p id="search-cost" className="text-sm text-mute">
          {info}
        </p>
        <button
          type="button"
          onClick={run}
          disabled={!canSearch}
          aria-describedby="search-cost"
          data-cursor={canSearch ? 'Buscar' : undefined}
          className="btn-fill inline-flex h-14 shrink-0 items-center justify-center gap-3 bg-acid px-6 text-ink transition-opacity [--fill-color:var(--color-bone)] disabled:bg-char-2 disabled:text-dim disabled:before:hidden"
        >
          <Search className="size-4" strokeWidth={2} aria-hidden="true" />
          <span className="display text-[1.4rem] leading-none tracking-[0.02em]">{searching ? 'Buscando…' : 'Buscar referencias'}</span>
        </button>
      </div>

      <AnimatePresence>
        {confirming && (
          <ConfirmDialog
            title="¿Buscar de nuevo?"
            confirmLabel="Buscar igual"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              setConfirming(false)
              dismantleBoard()
              search(tags)
            }}
          >
            Tu tablero tiene cambios sin guardar. Si buscás de nuevo, se desarma y esos cambios se pierden (las fotos que
            elegiste quedan en tu selección). Si lo querés conservar, cancelá y tocá «Guardar».
          </ConfirmDialog>
        )}
      </AnimatePresence>
    </div>
  )
}
