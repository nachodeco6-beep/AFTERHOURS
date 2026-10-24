import type { ReactNode } from 'react'
import { CreateButton } from './CreateButton'
import { Reveal } from './Reveal'
import { SectionHeader } from './SectionHeader'

interface Step {
  no: string
  title: string
  text: string
  /** A small typographic illustration. Never a photo: results only come from real searches. */
  sample: ReactNode
}

const STEPS: Step[] = [
  {
    no: '01',
    title: 'Escribís la idea',
    text: 'Una marca, una campaña, un clima, separado por comas. Cada parte es una etiqueta y cada etiqueta, una búsqueda de fotos reales en Unsplash.',
    sample: (
      <ul className="flex flex-wrap gap-2" aria-label="Ejemplo de etiquetas">
        {['Ropa urbana', 'Surf', 'California 90s'].map((t) => (
          <li key={t} className="label border border-line px-2.5 py-1.5 text-bone">
            {t}
          </li>
        ))}
      </ul>
    ),
  },
  {
    no: '02',
    title: 'Elegís las fotos',
    text: 'Sumás las que te gustan a tu selección, de 3 a 12. Si te faltan, «Completar por mí» suma fotos que acompañan tus colores y etiquetas.',
    sample: (
      <p className="label text-mute">
        Tu selección <span className="text-acid">6</span> / 12
      </p>
    ),
  },
  {
    no: '03',
    title: 'Armamos el moodboard',
    text: 'Una composición editorial con tus fotos: la primera elegida va en el lugar principal y cada foto en un espacio a su medida. Editorial, collage o grilla.',
    sample: (
      <div aria-hidden="true" className="grid h-14 grid-cols-6 grid-rows-2 gap-1">
        <span className="col-span-3 row-span-2 border border-line" />
        <span className="col-span-2 border border-line" />
        <span className="border border-line" />
        <span className="border border-acid bg-acid/20" />
        <span className="col-span-2 border border-line" />
      </div>
    ),
  },
  {
    no: '04',
    title: 'Elegís qué incluir',
    text: 'Paleta sacada de las fotos, un par tipográfico según tu concepto, palabras clave y notas. O solo imágenes. Cada foto con su crédito.',
    sample: (
      <p className="label text-mute">
        Paleta · Tipografías · Palabras clave · Notas
      </p>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="como-funciona" no="00" label="Cómo funciona" meta="4 pasos" title="De la idea a la imagen">
          Sin cuentas ni configuración: escribís, elegís fotografías reales y AFTERHOURS las compone en un tablero con
          paleta y tipografías.
        </SectionHeader>

        <ol className="grid border-t border-line md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal
              as="li"
              key={step.no}
              delay={i * 90}
              className="flex flex-col gap-6 border-b border-line py-8 md:py-10 md:pr-8 md:even:border-l md:even:pl-8 xl:border-b-0 xl:[&:nth-child(3)]:border-l xl:[&:nth-child(3)]:pl-8"
            >
              <span aria-hidden="true" className="display outline-text text-[clamp(4rem,8vw,7rem)] text-bone">
                {step.no}
              </span>
              <h3 className="display text-[clamp(2rem,3vw,2.75rem)] text-bone">{step.title}</h3>
              <p className="max-w-sm text-[0.9375rem] leading-relaxed text-mute">{step.text}</p>
              <div className="mt-auto border-t border-line-soft pt-5">{step.sample}</div>
            </Reveal>
          ))}
        </ol>

        <Reveal className="mt-14 flex flex-col items-start gap-5 md:mt-20 md:flex-row md:items-center md:justify-between">
          <p className="editorial max-w-xl text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight text-bone">
            Empezá por una idea. <span className="text-dim">Las fotos vienen solas.</span>
          </p>
          <CreateButton />
        </Reveal>
      </div>
    </section>
  )
}
