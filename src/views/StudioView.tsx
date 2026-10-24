import { AnimatePresence } from 'framer-motion'
import { ArrowUpRight, Info } from 'lucide-react'
import { useState } from 'react'
import { Reveal } from '../components/Reveal'
import { SectionHeader } from '../components/SectionHeader'
import { IncludeDialog } from '../components/moodboard/IncludeDialog'
import { IdeaEditor } from '../components/studio/IdeaEditor'
import { Results } from '../components/studio/Results'
import { SelectionTray } from '../components/studio/SelectionTray'
import { useStudio } from '../hooks/useStudio'
import { SEARCH_API_URL, SEARCH_URL_INVALID } from '../lib/searchApi'
import { UNSPLASH_URL } from '../lib/unsplash'

function DemoNotice() {
  return (
    <div role="note" className="mb-10 flex items-start gap-3 border border-acid/40 bg-acid/[0.04] p-4 sm:p-5">
      <Info className="mt-0.5 size-4 shrink-0 text-acid" strokeWidth={1.75} aria-hidden="true" />
      <div className="text-sm leading-relaxed">
        <p className="text-bone">La búsqueda todavía no está conectada. Estás viendo la interfaz en modo demo.</p>
        <p className="mt-1 text-mute">
          {SEARCH_URL_INVALID
            ? 'La dirección configurada en VITE_SEARCH_API_URL no es válida.'
            : 'Para conectarla hay que publicar el buscador y configurar VITE_SEARCH_API_URL (ver worker/README.md).'}{' '}
          Mientras tanto no se muestran fotos.
        </p>
      </div>
    </div>
  )
}

export function StudioView() {
  const { results, selection, board, buildBoard } = useStudio()
  const demo = SEARCH_API_URL === null
  const [choosing, setChoosing] = useState(false)

  const showBoard = () => document.getElementById('moodboard')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section aria-labelledby="studio-title" className="relative pt-28 pb-20 md:pt-36 md:pb-28">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        {demo && <DemoNotice />}

        <SectionHeader id="studio" no="01" label="Concepto" meta="Fotos de Unsplash" title="Studio" routeTitle>
          Escribí tu idea separando los conceptos con comas. Cada etiqueta se convierte en una búsqueda de fotografías
          reales en Unsplash.
        </SectionHeader>

        <Reveal>
          <IdeaEditor demo={demo} />
        </Reveal>

        {results ? (
          <Results results={results} />
        ) : (
          <p className="mt-16 max-w-xl border-l border-line pl-4 text-sm leading-relaxed text-dim md:mt-20">
            {demo
              ? 'En modo demo no hay fotos para mostrar: acá van a aparecer las referencias cuando la búsqueda esté conectada.'
              : 'Todavía no buscaste nada. Escribí una idea y tocá «Buscar referencias»: las fotos aparecen acá, agrupadas por etiqueta.'}
          </p>
        )}

        <div className="mt-20 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between md:mt-28">
          <a href={UNSPLASH_URL} target="_blank" rel="noopener noreferrer" className="label inline-flex items-center gap-1.5 text-bone hover:text-acid">
            Fotos de Unsplash <ArrowUpRight className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
          </a>
          <p className="label-sm text-dim">Cada foto lleva el crédito de su autor</p>
        </div>
      </div>

      <SelectionTray onBuild={() => setChoosing(true)} onShowBoard={showBoard} />
      <AnimatePresence>
        {choosing && (
          <IncludeDialog
            count={selection.length}
            initial={board?.include}
            onClose={() => setChoosing(false)}
            onBuild={(include) => {
              setChoosing(false)
              buildBoard(include)
            }}
          />
        )}
      </AnimatePresence>
    </section>
  )
}
