import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

interface SectionHeaderProps {
  id: string
  no: string
  label: string
  meta: string
  title: ReactNode
  children: ReactNode
}

export function SectionHeader({ id, no, label, meta, title, children }: SectionHeaderProps) {
  return (
    <header className="mb-12 md:mb-20">
      <Reveal className="flex items-center justify-between border-t border-line pt-4 text-mute">
        <p className="label">
          <span className="text-acid">{no}</span>
          <span className="mx-2 text-dim">—</span>
          {label}
        </p>
        <p className="label text-dim">{meta}</p>
      </Reveal>
      <div className="mt-8 grid gap-8 md:mt-12 md:grid-cols-12 md:items-end">
        <Reveal as="h2" className="display text-[clamp(3.25rem,12vw,11.5rem)] text-bone md:col-span-8" delay={80}>
          <span id={`${id}-title`}>{title}</span>
        </Reveal>
        <Reveal className="max-w-md text-[0.9375rem] leading-relaxed text-mute md:col-span-4 md:pb-3" delay={180}>
          {children}
        </Reveal>
      </div>
    </header>
  )
}
