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
    text: 'Una marca, una campaña, un clima. Escribila como te salga y separá cada concepto con una coma.',
    sample: (
      <p className="font-serif text-[1.35rem] leading-snug text-bone">
        Marca de ropa urbana, surf, California 90s<span className="animate-pulse text-acid">|</span>
      </p>
    ),
  },
  {
    no: '02',
    title: 'La cortamos en etiquetas',
    text: 'Cada parte se vuelve una etiqueta que podés editar, sacar o sumar a mano. Hasta seis por búsqueda.',
    sample: (
      <ul className="flex flex-wrap gap-2" aria-label="Ejemplo de etiquetas">
        {['Marca de ropa urbana', 'Surf', 'California 90s'].map((t) => (
          <li key={t} className="label border border-line px-2.5 py-1.5 text-bone">
            {t}
          </li>
        ))}
      </ul>
    ),
  },
  {
    no: '03',
    title: 'Buscamos fotos reales',
    text: 'Cada etiqueta es una búsqueda en Unsplash. Ves las fotos agrupadas por etiqueta, con el crédito de cada fotógrafo.',
    sample: (
      <p className="label text-mute">
        Foto: <span className="text-bone">nombre del autor</span> en <span className="text-bone">Unsplash</span>
      </p>
    ),
  },
]

export function HowItWorks() {
  return (
    <section id="como-funciona" aria-labelledby="como-funciona-title" className="relative py-24 md:py-32">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="como-funciona" no="00" label="Cómo funciona" meta="3 pasos" title="De la idea a la imagen">
          Sin cuentas ni configuración: escribís, ajustás las etiquetas y mirás fotografías reales para empezar tu
          dirección visual.
        </SectionHeader>

        <ol className="grid border-t border-line md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal
              as="li"
              key={step.no}
              delay={i * 90}
              className="flex flex-col gap-6 border-b border-line py-8 md:border-b-0 md:py-10 md:pr-8 md:[&:not(:first-child)]:border-l md:[&:not(:first-child)]:pl-8"
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
