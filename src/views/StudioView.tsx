import { SectionHeader } from '../components/SectionHeader'

export function StudioView() {
  return (
    <section aria-labelledby="studio-title" className="relative pt-28 pb-24 md:pt-36 md:pb-32">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="studio" no="01" label="Concepto" meta="Fotos de Unsplash" title="Studio" routeTitle>
          Escribí tu idea separando los conceptos con comas. Cada etiqueta se convierte en una búsqueda de fotografías
          reales.
        </SectionHeader>
      </div>
    </section>
  )
}
