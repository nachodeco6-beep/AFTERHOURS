import { Plus, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { MAX_TAG_LENGTH, MAX_TAGS } from '../../lib/tags'

interface TagChipsProps {
  tags: string[]
  onChange: (tags: string[]) => void
}

function Chip({ tag, index, active, onEdit, onRemove }: { tag: string; index: number; active: boolean; onEdit: (value: string) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tag)
  const button = useRef<HTMLButtonElement>(null)
  const done = useRef(false)
  const wasEditing = useRef(false)

  // after editing, focus goes back to the chip (if it still exists)
  useEffect(() => {
    if (wasEditing.current && !editing) button.current?.focus()
    wasEditing.current = editing
  }, [editing])

  const finish = (save: boolean) => {
    if (done.current) return // Enter/Escape already handled it; ignore the blur that follows
    done.current = true
    setEditing(false)
    if (save && draft.trim() !== tag) onEdit(draft)
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      e.preventDefault()
      finish(e.key === 'Enter')
    }
  }

  if (editing) {
    return (
      <li className="flex">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => finish(true)}
          onKeyDown={onKey}
          maxLength={MAX_TAG_LENGTH}
          autoFocus
          aria-label={`Editar etiqueta «${tag}». Enter para guardar, Escape para cancelar`}
          className="label h-10 w-[min(16rem,70vw)] border border-acid bg-ink px-3 text-bone outline-none"
        />
      </li>
    )
  }

  return (
    <li className={`group flex items-stretch border transition-colors ${active ? 'border-line hover:border-bone' : 'border-dashed border-line text-dim'}`}>
      <button
        ref={button}
        data-chip-index={index}
        type="button"
        onClick={() => {
          setDraft(tag)
          done.current = false
          setEditing(true)
        }}
        title="Editar"
        aria-label={`Editar etiqueta «${tag}»${active ? '' : ' (no se busca)'}`}
        className={`label min-h-10 max-w-[min(22rem,72vw)] truncate py-2 pr-1 pl-3 text-left ${active ? 'text-bone' : 'text-dim'}`}
      >
        {tag}
      </button>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Sacar etiqueta «${tag}»`}
        className="grid w-9 shrink-0 place-items-center text-mute transition-colors hover:text-alarm"
      >
        <X className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
      </button>
    </li>
  )
}

/** The tags cut from the idea. Every change is written back into the idea text. */
export function TagChips({ tags, onChange }: TagChipsProps) {
  const [draft, setDraft] = useState('')
  const full = tags.length >= MAX_TAGS

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!draft.trim() || full) return
    onChange([...tags, draft])
    setDraft('')
  }

  return (
    <div>
      <ul className="flex flex-wrap gap-2" aria-label="Etiquetas">
        {tags.map((tag, i) => (
          <Chip
            key={`${tag}-${i}`}
            tag={tag}
            index={i}
            active={i < MAX_TAGS}
            onEdit={(value) => {
              onChange(tags.map((t, j) => (j === i ? value : t)))
              // an edited chip is a new chip; put focus back on whatever now sits in its place
              requestAnimationFrame(() =>
                (document.querySelector<HTMLElement>(`[data-chip-index="${i}"]`) ?? document.getElementById('add-tag'))?.focus(),
              )
            }}
            onRemove={() => {
              onChange(tags.filter((_, j) => j !== i))
              // the chip disappears; keep focus inside the tag list
              requestAnimationFrame(() => document.getElementById('add-tag')?.focus())
            }}
          />
        ))}
        <li>
          <form onSubmit={add} className="flex">
            <label htmlFor="add-tag" className="sr-only">
              Sumar una etiqueta
            </label>
            <input
              id="add-tag"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={full}
              maxLength={MAX_TAG_LENGTH}
              placeholder={full ? `Máximo ${MAX_TAGS}` : 'Sumar etiqueta'}
              className="label h-10 w-40 border border-r-0 border-line bg-transparent px-3 text-bone outline-none placeholder:text-dim focus:border-acid disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={full || !draft.trim()}
              aria-label="Sumar etiqueta"
              className="grid size-10 place-items-center border border-line text-bone transition-colors hover:border-acid hover:text-acid disabled:opacity-40 disabled:hover:border-line disabled:hover:text-bone"
            >
              <Plus className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </form>
        </li>
      </ul>
    </div>
  )
}
