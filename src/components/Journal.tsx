import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Plus, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useJournal, type Entry, type SaveState } from '../hooks/useJournal'
import { formatClock, formatRelative, formatStamp } from '../lib/format'
import { Reveal } from './Reveal'
import { SectionHeader } from './SectionHeader'

const MAX_CHARS = 20000

function titleOf(e: Entry) {
  const first = e.body.trim().split('\n')[0]
  return first ? first : 'Untitled — blank page'
}

function wordCount(text: string) {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

function SaveIndicator({ state, savedAt, available }: { state: SaveState; savedAt: number | null; available: boolean }) {
  if (!available) return <span className="text-alarm">Not saving — storage blocked</span>
  if (state === 'error') return <span className="text-alarm">Couldn’t save — storage full?</span>
  if (state === 'saving') return <span className="text-mute">Saving…</span>
  if (state === 'saved' && savedAt) return <span className="text-mute">Saved {formatClock(new Date(savedAt), false)}</span>
  return <span className="text-dim">Autosave on</span>
}

export function Journal() {
  const j = useJournal()
  const editor = useRef<HTMLTextAreaElement>(null)
  const [, setTick] = useState(0)

  // refresh relative timestamps once a minute
  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 60000)
    return () => window.clearInterval(t)
  }, [])

  const newEntry = () => {
    j.create()
    requestAnimationFrame(() => editor.current?.focus())
  }

  const open = (id: string) => {
    j.select(id)
    requestAnimationFrame(() => {
      const el = editor.current
      if (!el) return
      el.focus({ preventScroll: true })
      el.setSelectionRange(el.value.length, el.value.length)
    })
  }

  const body = j.active?.body ?? ''
  const listed = j.entries.filter((e) => e.body.trim() || e.id === j.activeId)

  return (
    <section id="the-void" aria-labelledby="the-void-title" className="relative border-t border-line-soft bg-[#0b0b0b] py-24 md:py-32">
      <div className="mx-auto max-w-[1800px] px-4 sm:px-6 md:px-10">
        <SectionHeader id="the-void" no="02" label="The Void" meta="Private journal" title="The void">
          A quiet page for the thoughts that only arrive after midnight. No accounts, no feed, no audience — entries are
          saved automatically and never leave this browser.
        </SectionHeader>

        {!j.available && (
          <p role="alert" className="mb-6 border border-alarm/50 p-4 text-sm text-bone">
            Your browser is blocking local storage, so entries can’t be saved and will disappear when you leave. Copy
            anything you want to keep.
          </p>
        )}

        <Reveal className="grid border border-line lg:grid-cols-12">
          {/* entries */}
          <aside aria-label="Saved entries" className="flex flex-col border-b border-line lg:col-span-4 lg:border-r lg:border-b-0 xl:col-span-3">
            <div className="flex items-center justify-between border-b border-line px-4 py-3 sm:px-5">
              <p className="label text-mute">
                Entries <span className="text-dim">({j.entries.filter((e) => e.body.trim()).length})</span>
              </p>
              <button
                type="button"
                onClick={newEntry}
                className="label -mr-2 inline-flex h-10 items-center gap-1.5 px-2 text-bone transition-colors hover:text-acid"
              >
                <Plus className="size-3.5" strokeWidth={2} aria-hidden="true" /> New entry
              </button>
            </div>

            {listed.length === 0 ? (
              <div className="flex flex-1 flex-col justify-center px-5 py-10 lg:py-16">
                <p className="editorial text-[1.6rem] leading-tight text-bone">The page is blank.</p>
                <p className="editorial text-[1.6rem] leading-tight text-dim">So is the night.</p>
                <p className="mt-4 max-w-[18rem] text-sm leading-relaxed text-mute">
                  Just start writing in the editor — your first entry is created the moment you type.
                </p>
              </div>
            ) : (
              <ul className="thin-scroll max-h-[16rem] overflow-y-auto lg:max-h-[34rem]">
                {listed.map((e) => {
                  const active = e.id === j.activeId
                  return (
                    <li key={e.id} className="border-b border-line-soft last:border-b-0">
                      <button
                        type="button"
                        onClick={() => open(e.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`relative block w-full px-4 py-4 text-left transition-colors sm:px-5 ${active ? 'bg-char' : 'hover:bg-char/60'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`absolute inset-y-0 left-0 w-[2px] bg-acid transition-transform duration-500 ${active ? 'scale-y-100' : 'scale-y-0'}`}
                        />
                        <span className={`block truncate text-[0.9375rem] ${e.body.trim() ? 'text-bone' : 'text-dim italic'}`}>{titleOf(e)}</span>
                        <span className="label-sm mt-1.5 flex justify-between gap-2 text-dim">
                          <span>{formatRelative(e.updatedAt)}</span>
                          <span className="tabular-nums">{e.body.length.toLocaleString()} ch</span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="label-sm mt-auto flex items-center gap-2 border-t border-line px-4 py-3 text-dim sm:px-5">
              <Lock className="size-3" strokeWidth={1.5} aria-hidden="true" /> Stored only on this device
            </p>
          </aside>

          {/* editor */}
          <div className="flex min-w-0 flex-col lg:col-span-8 xl:col-span-9">
            <div className="label flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-3 sm:px-6">
              <span className="text-mute">{j.active ? `Started ${formatStamp(j.active.createdAt)}` : 'New entry'}</span>
              <span aria-live="polite">
                <SaveIndicator state={j.saveState} savedAt={j.savedAt} available={j.available} />
              </span>
            </div>

            <label htmlFor="void-editor" className="sr-only">
              Journal entry
            </label>
            <textarea
              id="void-editor"
              ref={editor}
              value={body}
              onChange={(e) => j.update(e.target.value)}
              placeholder="What’s keeping you awake?"
              maxLength={MAX_CHARS}
              spellCheck
              className="journal-editor thin-scroll min-h-[55svh] w-full flex-1 resize-none bg-transparent px-4 py-6 font-serif text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.45] text-bone outline-none focus-visible:shadow-[inset_2px_0_0_var(--color-acid)] sm:px-6 md:px-10 md:py-10 lg:min-h-[34rem]"
            />

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 sm:px-6">
              <p className="label tabular-nums text-dim">
                <span className="text-mute">{body.length.toLocaleString()}</span> characters
                <span className="mx-2">·</span>
                <span className="text-mute">{wordCount(body).toLocaleString()}</span> words
                {body.length > MAX_CHARS * 0.9 && <span className="ml-2 text-alarm">/ {MAX_CHARS.toLocaleString()} max</span>}
              </p>
              <button
                type="button"
                onClick={() => j.active && j.remove(j.active.id)}
                disabled={!j.active}
                className="label inline-flex h-10 items-center gap-2 px-2 text-mute transition-colors hover:text-alarm disabled:opacity-40 disabled:hover:text-mute"
              >
                <Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> Delete entry
              </button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* undo toast */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[65] flex justify-center px-4" role="status" aria-live="polite">
        <AnimatePresence>
          {j.trash && (
            <motion.div
              key={j.trash.entry.id}
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 24, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="pointer-events-auto relative flex w-full max-w-md items-center justify-between gap-4 overflow-hidden border border-line bg-char py-3 pr-2 pl-4"
            >
              <p className="min-w-0 truncate text-sm text-bone">
                Deleted “<span className="text-mute">{titleOf(j.trash.entry)}</span>”
              </p>
              <div className="flex shrink-0 items-center">
                <button
                  type="button"
                  onClick={j.undo}
                  className="label inline-flex h-10 items-center gap-1.5 bg-acid px-3 text-ink transition-transform active:scale-95"
                >
                  <Undo2 className="size-3.5" strokeWidth={2} aria-hidden="true" /> Undo
                </button>
                <button type="button" onClick={j.dismissTrash} className="label h-10 px-3 text-dim hover:text-bone" aria-label="Dismiss">
                  OK
                </button>
              </div>
              <motion.span
                aria-hidden="true"
                className="absolute bottom-0 left-0 h-px w-full origin-left bg-acid"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 7, ease: 'linear' }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
