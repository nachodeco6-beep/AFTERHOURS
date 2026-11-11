/**
 * W3a demo: the AI data and logic with bare HTML controls, no design (that's
 * W3b, Nacho's). Served only in development: vite build bundles index.html
 * alone, so none of this reaches production; tsc still checks it.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAiProposal } from '../hooks/useAiProposal'
import { useBoardData } from '../hooks/useBoardData'
import { useStudio, DEFAULT_INCLUDE } from '../hooks/useStudio'
import { PALETTES } from '../data/palettes'
import { AI_API_URL, TURNSTILE_SITE_KEY } from '../lib/aiConfig'
import { pairById } from '../lib/pairing'
import { MIN_SELECTION } from '../lib/select'
import { parseTags } from '../lib/tags'
import { createTokenSource, TurnstileError, type TokenSource } from '../lib/turnstile'

const Swatches = ({ colors }: { colors: string[] }) => (
  <span>
    {colors.map((hex, i) => (
      <span key={i} title={hex} style={{ display: 'inline-block', width: 24, height: 24, background: hex, border: '1px solid #999', verticalAlign: 'middle' }} />
    ))}
  </span>
)

export function AiDemo() {
  const studio = useStudio()
  const { board, selection, results, saved } = studio
  const photos = useMemo(() => selection.map((s) => s.photo), [selection])
  const data = useBoardData(board, photos)

  // Turnstile: invisible widget in this container, one fresh token per request (N3)
  const container = useRef<HTMLDivElement>(null)
  const source = useRef<TokenSource | null>(null)
  const getToken = useCallback(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return Promise.reject(new TurnstileError('script'))
    source.current ??= createTokenSource(container.current, TURNSTILE_SITE_KEY)
    return source.current.getToken()
  }, [])

  const ai = useAiProposal(data.autoPalette?.colors ?? null, getToken)

  const [concept, setConcept] = useState('')
  const [idea, setIdea] = useState('')
  const [saveResult, setSaveResult] = useState('')
  const [log, setLog] = useState<string[]>([])
  const state = ai.state
  useEffect(() => {
    const extra = state.status === 'error' ? ` (${state.code})` : state.status === 'sin-intentos' ? ` (${state.reason})` : ''
    setLog((l) => [...l, `${new Date().toLocaleTimeString()} — ${state.status}${extra}`])
  }, [state])

  const proposalPair = ai.proposal ? pairById(ai.proposal.pair_id) : undefined
  const proposalPalette = ai.proposal ? PALETTES.find((p) => p.id === ai.proposal?.palette_id) : undefined
  const boardPair = board?.fonts ? pairById(board.fonts.display) : undefined

  return (
    <main style={{ fontFamily: 'sans-serif', maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <h1>Demo W3a — datos y lógica, sin diseño</h1>
      <p>
        Worker: <code>{AI_API_URL ?? 'sin configurar'}</code> · IA disponible: {String(ai.available)} · Intentos: {ai.remaining ?? '—'} · Vuelven:{' '}
        {ai.resetAt ?? '—'}
      </p>

      <h2>1 · Proponer</h2>
      <textarea aria-label="Concepto" rows={3} style={{ width: '100%' }} value={concept} onChange={(e) => setConcept(e.target.value)} placeholder="Concepto de marca (3 a 500 caracteres)" />
      <div ref={container} />
      <button type="button" onClick={() => void ai.propose(concept)} disabled={!ai.available || state.status === 'loading'}>
        Proponer
      </button>
      <p>
        Estado: <strong>{state.status}</strong>
        {state.status === 'error' && <> · código: {state.code}</>}
        {state.status === 'sin-intentos' && <> · motivo: {state.reason} · vuelve: {state.resetAt ?? '—'}</>}
        {state.status === 'fuera-de-tema' && <> · «Esto no parece una marca» (mensaje final: Nacho, D16)</>}
      </p>
      <details>
        <summary>Log de estados ({log.length})</summary>
        <pre>{log.join('\n')}</pre>
      </details>

      {ai.proposal && (
        <section>
          <h2>2 · Propuesta</h2>
          <p>
            mood: <strong>{ai.proposal.mood}</strong> · par {ai.proposal.pair_id}: {proposalPair?.display.family} + {proposalPair?.text.family} · paleta{' '}
            {ai.proposal.palette_id} {proposalPalette && <Swatches colors={[...proposalPalette.colors]} />}
          </p>
          <p>frases: {ai.proposal.concepts.join(' · ')}</p>
          <p>búsquedas: {ai.proposal.search_queries.join(' · ')}</p>
          <p>aplicaciones: {ai.proposal.applications.join(', ')}</p>
          <p>rationale: {ai.proposal.rationale}</p>
          <button type="button" onClick={ai.apply}>
            Aplicar
          </button>{' '}
          <button type="button" onClick={ai.discard}>
            Descartar
          </button>
        </section>
      )}

      <h2>3 · Búsqueda y selección</h2>
      <input aria-label="Idea" style={{ width: '60%' }} value={idea} onChange={(e) => setIdea(e.target.value)} placeholder="etiquetas propias, separadas por comas" />
      <button type="button" onClick={() => studio.search(parseTags(idea).searchable)}>
        Buscar mis etiquetas
      </button>
      {ai.suggestedTags.length > 0 && (
        <p>
          Sugerencias de la IA (un clic suma, no gasta hasta elegir · N1):{' '}
          {ai.suggestedTags.map((tag) => (
            <button key={tag} type="button" onClick={() => ai.addSuggestedTag(tag)}>
              + {tag}
            </button>
          ))}
        </p>
      )}
      <ul>
        {(results ?? []).map((r) => (
          <li key={r.tag}>
            {r.tag}: {r.status}
            {r.status === 'done' && <> · {r.photos.length} fotos</>}
            {r.status === 'error' && <> · {r.error?.code}</>}
          </li>
        ))}
      </ul>
      <p>
        Seleccionadas: {selection.length} (mínimo {MIN_SELECTION}){' '}
        <button type="button" onClick={() => studio.complete()}>
          Completar por mí
        </button>{' '}
        <button type="button" onClick={() => studio.buildBoard(DEFAULT_INCLUDE)} disabled={selection.length < MIN_SELECTION}>
          Armar
        </button>
      </p>

      {board && (
        <section>
          <h2>4 · Tablero</h2>
          <p>
            «{board.title}» · par: {boardPair ? `${boardPair.display.family} + ${boardPair.text.family}` : 'automático'} · origen de la paleta:{' '}
            <strong>{board.paletteOrigin}</strong>
          </p>
          <p>
            Paleta activa: {data.palette ? <Swatches colors={data.palette.colors} /> : 'leyendo…'} · de las fotos:{' '}
            {data.autoPalette ? <Swatches colors={data.autoPalette.colors} /> : '—'}
          </p>
          {board.ai && (
            <>
              <p>frases guardadas: {board.ai.concepts.join(' · ')}</p>
              <p>rationale guardado: {board.ai.rationale}</p>
            </>
          )}
          <p>
            D = {ai.divergence?.toFixed(1) ?? '—'} · ¿avisa? {String(ai.photoPaletteDiverges)}{' '}
            <button type="button" onClick={ai.applyPhotoPalette}>
              Usar paleta de tus fotos
            </button>{' '}
            <button type="button" onClick={ai.restoreAiPalette} disabled={!board.aiPalette}>
              Volver a la paleta de la IA
            </button>{' '}
            <button type="button" onClick={ai.dismissDivergence} disabled={!ai.photoPaletteDiverges}>
              Descartar aviso
            </button>
          </p>
          <p>
            <button type="button" onClick={() => setSaveResult(studio.saveBoard())}>
              Guardar
            </button>{' '}
            {saveResult && <>resultado: {saveResult}</>}
          </p>
        </section>
      )}

      <h2>5 · Guardados</h2>
      <ul>
        {saved.map((r) => (
          <li key={r.id}>
            «{r.title}» · origen {r.paletteOrigin} · {r.ai ? `con IA (${r.ai.palette_id})` : 'sin IA'}{' '}
            <button type="button" onClick={() => studio.openSaved(r.id)}>
              Reabrir
            </button>
          </li>
        ))}
      </ul>
    </main>
  )
}
