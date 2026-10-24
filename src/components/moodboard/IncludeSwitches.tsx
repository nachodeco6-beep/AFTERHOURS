import { DEFAULT_INCLUDE, onlyImages, type Include } from '../../hooks/useStudio'

const OPTIONS: { key: keyof Include; label: string; hint: string }[] = [
  { key: 'palette', label: 'Paleta de colores', hint: '5 colores sacados de las fotos' },
  { key: 'type', label: 'Tipografías', hint: 'Un par titular + texto según tu concepto' },
  { key: 'keywords', label: 'Palabras clave', hint: 'Tus etiquetas' },
  { key: 'notes', label: 'Notas de dirección de arte', hint: 'Un texto corto que podés editar' },
]

function Switch({ checked, onChange, label, hint, id }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; id: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <span>
        <span id={`${id}-label`} className="block text-[0.9375rem] text-bone">
          {label}
        </span>
        {hint && <span className="block text-xs text-dim">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 border transition-colors ${checked ? 'border-acid bg-acid' : 'border-line bg-char'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute top-1/2 size-4 -translate-y-1/2 transition-[left,background-color] duration-300 ${checked ? 'left-[calc(100%-1.25rem)] bg-ink' : 'left-1 bg-mute'}`}
        />
      </button>
    </div>
  )
}

/** The «Qué incluir» switches, used before building and on the built board. */
export function IncludeSwitches({ value, onChange, idPrefix }: { value: Include; onChange: (v: Include) => void; idPrefix: string }) {
  return (
    <div className="divide-y divide-line-soft">
      {OPTIONS.map((o) => (
        <Switch key={o.key} id={`${idPrefix}-${o.key}`} label={o.label} hint={o.hint} checked={value[o.key]} onChange={(v) => onChange({ ...value, [o.key]: v })} />
      ))}
      <Switch
        id={`${idPrefix}-only`}
        label="Solo imágenes"
        hint="Apaga todo lo anterior: fotos, título y créditos"
        checked={onlyImages(value)}
        onChange={(v) => onChange(v ? { palette: false, type: false, keywords: false, notes: false } : DEFAULT_INCLUDE)}
      />
    </div>
  )
}
