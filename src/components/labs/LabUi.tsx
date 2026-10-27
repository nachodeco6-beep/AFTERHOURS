import { useRef, type KeyboardEvent, type ReactNode } from 'react'

/** A row of chips where one is chosen (null = «Todos»). */
export function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  all = 'Todos',
}: {
  label: string
  options: { id: T; label: string }[]
  value: T | null
  onChange: (v: T | null) => void
  all?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1">
      {[{ id: null, label: all }, ...options].map((o) => (
        <button
          key={o.id ?? 'all'}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`label-sm h-8 border px-2.5 transition-colors ${value === o.id ? 'border-bone bg-bone text-ink' : 'border-line text-mute hover:text-bone'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Tabs with arrow keys (the panels are rendered by the caller with `tabPanelProps`). */
export function Tabs<T extends string>({
  id,
  label,
  tabs,
  value,
  onChange,
}: {
  id: string
  label: string
  tabs: { id: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  const refs = useRef(new Map<T, HTMLButtonElement>())
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null
    if (next === null) return
    e.preventDefault()
    const t = tabs[(next + tabs.length) % tabs.length]
    onChange(t.id)
    refs.current.get(t.id)?.focus()
  }
  return (
    <div role="tablist" aria-label={label} className="thin-scroll -mb-px flex overflow-x-auto">
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            if (el) refs.current.set(t.id, el)
            else refs.current.delete(t.id)
          }}
          type="button"
          role="tab"
          id={`${id}-tab-${t.id}`}
          aria-selected={value === t.id}
          aria-controls={`${id}-panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKey(e, i)}
          className={`label h-11 shrink-0 border-b-2 px-3 whitespace-nowrap transition-colors ${value === t.id ? 'border-acid text-bone' : 'border-transparent text-mute hover:text-bone'}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
